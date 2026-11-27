<template>
	<view class="page">
		<view class="card">
			<text class="card-title">管理员（{{ admins.length }}）</text>
			<view v-for="item in admins" :key="item.openid" class="admin-item">
				<image v-if="avatarMap[item.openid]" class="admin-avatar" :src="avatarMap[item.openid]" mode="aspectFill" />
				<view v-else class="admin-avatar admin-avatar-text">{{ avatarText(item.name) }}</view>
				<view class="admin-info">
					<view class="admin-name-row">
						<text class="admin-name">{{ item.name }}</text>
						<text class="admin-level" :class="{ 'level-super': item.is_super }">{{ item.is_super ? '超级管理员' : '管理员' }}</text>
					</view>
					<text v-if="item.remark && item.remark !== item.name && item.remark !== '超级管理员'" class="admin-remark">备注：{{ item.remark }}</text>
					<text class="admin-openid">{{ item.openid }}</text>
					<text class="admin-date">加入时间：{{ formatDate(item.create_date) }}</text>
				</view>
				<view class="admin-actions">
					<text v-if="!item.is_super" class="admin-op" @click="toggleSuper(item, true)">设为超管</text>
					<text v-else-if="item.openid !== myOpenid" class="admin-op" @click="toggleSuper(item, false)">取消超管</text>
					<text v-if="!item.is_super" class="admin-remove" @click="confirmRemove(item)">移除</text>
				</view>
			</view>
			<view v-if="!admins.length" class="empty">暂无管理员</view>
		</view>

		<view class="card">
			<text class="card-title">添加管理员</text>
			<view class="search-row">
				<input class="input search-input" v-model="keyword" placeholder="输入用户昵称 / openid 搜索" confirm-type="search" @confirm="doSearch" />
				<button class="search-btn" :disabled="searching" @click="doSearch">{{ searching ? '搜索中' : '搜索' }}</button>
			</view>
			<view v-if="searched" class="search-results">
				<view v-if="!results.length && !canAddRaw" class="empty">未找到匹配用户</view>
				<view v-for="u in results" :key="u.openid" class="result-item">
					<image v-if="avatarMap[u.openid]" class="admin-avatar" :src="avatarMap[u.openid]" mode="aspectFill" />
					<view v-else class="admin-avatar admin-avatar-text">{{ avatarText(u.nickname) }}</view>
					<view class="result-info">
						<text class="admin-name">{{ u.nickname }}</text>
						<text class="admin-openid">{{ u.openid }}</text>
					</view>
					<text v-if="isAdminUser(u.openid)" class="result-added">已是管理员</text>
					<text v-else class="result-add" @click="addByUser(u)">添加</text>
				</view>
				<view v-if="canAddRaw" class="result-item">
					<view class="admin-avatar admin-avatar-text">{{ avatarText(keyword) }}</view>
					<view class="result-info">
						<text class="admin-name">直接使用该 openid</text>
						<text class="admin-openid">{{ keyword.trim() }}</text>
					</view>
					<text v-if="isAdminUser(keyword.trim())" class="result-added">已是管理员</text>
					<text v-else class="result-add" @click="addByUser({ openid: keyword.trim() })">添加</text>
				</view>
			</view>
			<text class="tip">按昵称搜索用户即可添加，无需再查 openid；也可直接粘贴 openid 添加</text>
		</view>
	</view>
</template>

<script setup>
	import { ref, computed } from 'vue'
	import { onShow } from '@dcloudio/uni-app'
	import { ensureLogin, getToken, isAuthError, relogin, isSuperAdmin, getOpenid, refreshAuthFlags } from '@/utils/auth.js'
	import { resolveCloudFiles } from '@/utils/cloudFile.js'

	// 当前用户 openid（用于隐藏"取消自己的超管"按钮）
	const myOpenid = getOpenid()

	const admins = ref([])
	const avatarMap = ref({})
	const adding = ref(false)
	// 搜索添加管理员
	const keyword = ref('')
	const searching = ref(false)
	const searched = ref(false)
	const results = ref([])

	// 关键字是否为可用 openid（用于兜底直接添加）
	const canAddRaw = computed(() => {
		const k = keyword.value.trim()
		return !!k && /^[\w-]{10,}$/.test(k) && !results.value.some(u => u.openid === k)
	})

	onShow(async () => {
		await ensureLogin().catch(() => {})
		// 强制刷新超管标记，避免其他超管因本地缓存过期被误判
		await refreshAuthFlags().catch(() => {})
		if (!isSuperAdmin()) {
			uni.showToast({
				title: '仅超级管理员可访问',
				icon: 'none'
			})
			setTimeout(() => {
				uni.navigateBack()
			}, 800)
			return
		}
		loadAdmins()
	})

	async function callAuth(data) {
		await ensureLogin()
		let res
		try {
			res = await uniCloud.callFunction({
				name: 'user-auth',
				data: {
					...data,
					token: getToken()
				}
			})
		} catch (err) {
			if (!isAuthError(err)) throw err
			await relogin()
			res = await uniCloud.callFunction({
				name: 'user-auth',
				data: {
					...data,
					token: getToken()
				}
			})
		}
		const result = res.result || {}
		if (result.code !== 0) {
			throw new Error(result.message || '操作失败')
		}
		return result.data
	}

	async function loadAdmins() {
		try {
			const data = await callAuth({
				action: 'listAdmins'
			})
			admins.value = (data && data.list) || []
			await resolveAvatars(admins.value)
		} catch (e) {
			admins.value = []
			uni.showToast({
				title: (e && e.message) || '加载失败',
				icon: 'none'
			})
		}
	}

	// 解析管理员头像（云存储 fileID -> 临时链接）
	async function resolveAvatars(list) {
		const ids = []
		;(list || []).forEach(item => {
			if (item.avatar && ids.indexOf(item.avatar) === -1) {
				ids.push(item.avatar)
			}
		})
		const map = {}
		;(list || []).forEach(item => {
			if (item.avatar && item.avatar.indexOf('http') === 0) {
				map[item.openid] = item.avatar
			}
		})
		if (ids.length) {
			const resolved = await resolveCloudFiles(ids)
			;(list || []).forEach(item => {
				if (item.avatar && resolved[item.avatar]) {
					map[item.openid] = resolved[item.avatar]
				}
			})
		}
		avatarMap.value = Object.assign({}, avatarMap.value, map)
	}

	function avatarText(name) {
		return name ? String(name).charAt(0) : '管'
	}

	function formatDate(ts) {
		if (!ts) return '—'
		const d = new Date(Number(ts))
		const y = d.getFullYear()
		const m = d.getMonth() + 1
		const day = d.getDate()
		return y + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day)
	}

	function isAdminUser(openid) {
		return admins.value.some(a => a.openid === openid)
	}

	// 按昵称 / openid 搜索用户
	async function doSearch() {
		const k = keyword.value.trim()
		if (!k) {
			uni.showToast({
				title: '请输入昵称或 openid',
				icon: 'none'
			})
			return
		}
		searching.value = true
		try {
			const data = await callAuth({
				action: 'searchUsers',
				keyword: k
			})
			results.value = (data && data.list) || []
			searched.value = true
			await resolveAvatars(results.value)
		} catch (e) {
			uni.showToast({
				title: (e && e.message) || '搜索失败',
				icon: 'none'
			})
		} finally {
			searching.value = false
		}
	}

	// 选中的用户直接加入管理员白名单
	async function addByUser(user) {
		const openid = user && user.openid
		if (!openid) return
		adding.value = true
		try {
			await callAuth({
				action: 'addAdmin',
				openid
			})
			uni.showToast({
				title: '已添加',
				icon: 'success'
			})
			keyword.value = ''
			results.value = []
			searched.value = false
			await loadAdmins()
		} catch (e) {
			uni.showToast({
				title: (e && e.message) || '添加失败',
				icon: 'none'
			})
		} finally {
			adding.value = false
		}
	}

	// 设为 / 取消超级管理员
	function toggleSuper(item, isSuper) {
		uni.showModal({
			title: isSuper ? '设为超级管理员' : '取消超级管理员',
			content: isSuper
				? '确定将「' + item.name + '」设为超级管理员？'
				: '确定取消「' + item.name + '」的超级管理员？',
			success: async (r) => {
				if (!r.confirm) return
				try {
					await callAuth({
						action: 'setAdminSuper',
						openid: item.openid,
						is_super: isSuper
					})
					await loadAdmins()
					uni.showToast({
						title: '已更新',
						icon: 'success'
					})
				} catch (e) {
					uni.showToast({
						title: (e && e.message) || '操作失败',
						icon: 'none'
					})
				}
			}
		})
	}

	function confirmRemove(item) {
		uni.showModal({
			title: '移除管理员',
			content: '确定移除「' + item.name + '」？',
			success: async (r) => {
				if (!r.confirm) return
				try {
					await callAuth({
						action: 'removeAdmin',
						openid: item.openid
					})
					await loadAdmins()
					uni.showToast({
						title: '已移除',
						icon: 'success'
					})
				} catch (e) {
					uni.showToast({
						title: (e && e.message) || '移除失败',
						icon: 'none'
					})
				}
			}
		})
	}
</script>

<style lang="scss">
	.page {
		min-height: 100vh;
		background-color: $bg-page;
		padding: $space-lg;
		box-sizing: border-box;
	}

	.card {
		background-color: $bg-card;
		border-radius: $radius-lg;
		padding: $space-lg;
		margin-bottom: $space-md;
		box-shadow: $shadow-card;
	}

	.card-title {
		display: block;
		font-size: 30rpx;
		font-weight: 600;
		color: $text-main;
		margin-bottom: $space-md;
	}

	.admin-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: $space-md 0;
		border-bottom: 1rpx solid $border-color;
	}

	.admin-item:last-child {
		border-bottom: none;
	}

	.admin-avatar {
		width: 80rpx;
		height: 80rpx;
		border-radius: 50%;
		flex-shrink: 0;
		margin-right: $space-md;
		background-color: $bg-fill;
	}

	.admin-avatar-text {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 32rpx;
		color: $text-inverse;
		background-image: $brand-gradient;
	}

	.admin-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.admin-name {
		font-size: 30rpx;
		font-weight: 500;
		color: $text-main;
	}

	.admin-remark {
		margin-top: 4rpx;
		font-size: $fs-xs;
		color: $text-secondary;
	}

	.admin-openid {
		margin-top: 6rpx;
		font-size: $fs-xs;
		color: $text-secondary;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.admin-date {
		margin-top: 4rpx;
		font-size: $fs-xs;
		color: $text-secondary;
	}

	.admin-name-row {
		display: flex;
		align-items: center;
	}

	.admin-level {
		margin-left: $space-sm;
		padding: 2rpx 14rpx;
		font-size: $fs-xs;
		line-height: 1.6;
		color: $text-secondary;
		background-color: $bg-fill;
		border-radius: 100rpx;
	}

	.level-super {
		color: #1A73E8;
		background-color: rgba(26, 115, 232, 0.12);
	}

	.admin-actions {
		flex-shrink: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 10rpx;
		margin-left: $space-md;
	}

	.admin-op {
		font-size: $fs-sm;
		color: $brand;
	}

	.admin-remove {
		font-size: $fs-sm;
		color: $danger;
	}

	.empty {
		padding: $space-lg 0;
		text-align: center;
		font-size: $fs-sm;
		color: $text-secondary;
	}

	.input {
		width: 100%;
		height: 88rpx;
		padding: 0 $space-md;
		font-size: $fs-md;
		background-color: $bg-fill;
		border-radius: $radius-md;
		box-sizing: border-box;
	}

	.add-btn {
		width: 100%;
		margin-top: $space-md;
		font-size: $fs-lg;
		font-weight: 600;
		color: $text-inverse;
		background-image: $brand-gradient;
		box-shadow: $brand-shadow;
		border-radius: $radius-pill;
	}

	.tip {
		display: block;
		margin-top: $space-sm;
		font-size: $fs-xs;
		color: $text-secondary;
		line-height: 1.5;
	}

	.search-row {
		display: flex;
		align-items: center;
		gap: $space-sm;
	}

	.search-input {
		flex: 1;
		min-width: 0;
	}

	.search-btn {
		flex-shrink: 0;
		height: 88rpx;
		line-height: 88rpx;
		padding: 0 36rpx;
		font-size: $fs-md;
		font-weight: 600;
		color: $text-inverse;
		background-image: $brand-gradient;
		border-radius: $radius-md;
	}

	.search-results {
		margin-top: $space-md;
	}

	.result-item {
		display: flex;
		align-items: center;
		padding: $space-sm 0;
		border-bottom: 1rpx solid $border-color;
	}

	.result-item:last-child {
		border-bottom: none;
	}

	.result-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.result-add {
		flex-shrink: 0;
		margin-left: $space-md;
		padding: 8rpx 30rpx;
		font-size: $fs-sm;
		color: $text-inverse;
		background-color: $brand;
		border-radius: $radius-pill;
	}

	.result-added {
		flex-shrink: 0;
		margin-left: $space-md;
		font-size: $fs-sm;
		color: $text-secondary;
	}
</style>
