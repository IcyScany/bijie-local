<template>
	<view class="page">
		<view class="card">
			<text class="card-title">管理员（{{ admins.length }}）</text>
			<view v-for="item in admins" :key="item.openid" class="admin-item">
				<image v-if="avatarMap[item.openid]" class="admin-avatar" :src="avatarMap[item.openid]" mode="aspectFill" />
				<view v-else class="admin-avatar admin-avatar-text">{{ avatarText(item.name) }}</view>
				<view class="admin-info">
					<text class="admin-name">{{ item.name }}</text>
					<text v-if="item.remark && item.remark !== item.name" class="admin-remark">备注：{{ item.remark }}</text>
					<text class="admin-openid">{{ item.openid }}</text>
					<text class="admin-date">加入时间：{{ formatDate(item.create_date) }}</text>
				</view>
				<text class="admin-remove" @click="confirmRemove(item)">移除</text>
			</view>
			<view v-if="!admins.length" class="empty">暂无管理员</view>
		</view>

		<view class="card">
			<text class="card-title">添加管理员</text>
			<input class="input" v-model="newOpenid" placeholder="输入用户 openid" />
			<button class="add-btn" :disabled="adding" @click="addAdmin">{{ adding ? '添加中...' : '添加' }}</button>
			<text class="tip">提示：让对方在「我的」页复制其 openid，或从云数据库 users 表查询</text>
		</view>
	</view>
</template>

<script setup>
	import { ref } from 'vue'
	import { onShow } from '@dcloudio/uni-app'
	import { ensureLogin, getToken, isAuthError, relogin } from '@/utils/auth.js'
	import { resolveCloudFiles } from '@/utils/cloudFile.js'

	const admins = ref([])
	const avatarMap = ref({})
	const newOpenid = ref('')
	const adding = ref(false)

	onShow(() => {
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
		avatarMap.value = map
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

	async function addAdmin() {
		const openid = newOpenid.value.trim()
		if (!openid) {
			uni.showToast({
				title: '请输入 openid',
				icon: 'none'
			})
			return
		}
		adding.value = true
		try {
			await callAuth({
				action: 'addAdmin',
				openid
			})
			newOpenid.value = ''
			await loadAdmins()
			uni.showToast({
				title: '已添加',
				icon: 'success'
			})
		} catch (e) {
			uni.showToast({
				title: (e && e.message) || '添加失败',
				icon: 'none'
			})
		} finally {
			adding.value = false
		}
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

	.admin-remove {
		flex-shrink: 0;
		margin-left: $space-md;
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
</style>
