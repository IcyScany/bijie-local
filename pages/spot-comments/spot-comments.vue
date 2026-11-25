<template>
	<view class="page">
		<view class="header">
			<text class="spot-name">{{ spotName }}</text>
			<view class="summary">
				<view class="summary-score">
					<text class="avg">{{ total ? avg : '—' }}</text>
					<view class="stars">
						<text
							v-for="n in 5"
							:key="n"
							class="star"
							:class="{ on: n <= Math.round(avg) }"
						>★</text>
					</view>
				</view>
				<text class="summary-count">{{ total }} 条评价</text>
			</view>
		</view>

		<AppSkeleton v-if="loading" :count="4" />
		<view v-else-if="!list.length" class="empty">
			<text class="empty-icon">💬</text>
			<text class="empty-text">还没有评价，快来抢沙发</text>
		</view>
		<scroll-view v-else class="list" scroll-y>
			<view
				v-for="item in list"
				:key="item._id"
				class="comment"
				@longpress="onLongPress(item)"
			>
				<image v-if="avatarUrl(item)" class="c-avatar" :src="avatarUrl(item)" mode="aspectFill" />
				<view v-else class="c-avatar c-avatar-text">{{ avatarText(item.nickname) }}</view>
				<view class="c-body">
					<view class="c-head">
						<text class="c-name">{{ item.nickname || '匿名用户' }}</text>
						<text class="c-date">{{ formatDate(item.create_date) }}</text>
					</view>
					<view class="stars small">
						<text
							v-for="n in 5"
							:key="n"
							class="star"
							:class="{ on: n <= item.rating }"
						>★</text>
					</view>
					<text class="c-content">{{ item.content }}</text>
				</view>
			</view>
		</scroll-view>

		<view class="bottom-bar">
			<button v-if="canManage" class="write-btn" @click="openComposer">
				<text class="write-icon">✎</text> 写评价
			</button>
		</view>

		<view v-if="composerVisible" class="mask" @click="closeComposer">
			<view class="composer" @click.stop>
				<text class="composer-title">评价「{{ spotName }}」</text>

				<view class="rate-row">
					<text
						v-for="n in 5"
						:key="n"
						class="rate-star"
						:class="{ on: n <= rating }"
						@click="rating = n"
					>★</text>
					<text class="rate-text">{{ rateText }}</text>
				</view>

				<textarea
					class="composer-input"
					v-model="content"
					placeholder="说说你的体验吧～"
					maxlength="500"
				/>

				<view class="composer-actions">
					<button class="c-btn cancel" @click="closeComposer">取消</button>
					<button class="c-btn submit" :disabled="submitting" @click="submit">{{ submitting ? '发布中...' : '发布' }}</button>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
	import { ref, computed } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import { ensureLogin, getToken, isAuthError, relogin, isAdmin } from '@/utils/auth.js'
	import { resolveCloudFiles } from '@/utils/cloudFile.js'
	import AppSkeleton from '@/components/AppSkeleton.vue'

	const commentObj = uniCloud.importObject('spot-comments', {
		customUI: true
	})

	const spotId = ref('')
	const spotName = ref('')
	const list = ref([])
	const total = ref(0)
	const avg = ref(0)
	const loading = ref(false)
	const composerVisible = ref(false)
	const rating = ref(5)
	const content = ref('')
	const submitting = ref(false)
	const avatarMap = ref({})
	// 仅管理员可发布评价
	const canManage = ref(isAdmin())

	const rateText = computed(() => {
		const map = {
			1: '很差',
			2: '较差',
			3: '一般',
			4: '满意',
			5: '很棒'
		}
		return map[rating.value] || ''
	})

	const myOpenid = uni.getStorageSync('uni_openid') || ''

	onLoad((query) => {
		canManage.value = isAdmin()
		spotId.value = query.spotId || ''
		spotName.value = query.spotName ? decodeURIComponent(query.spotName) : ''
		loadComments()
	})

	function avatarText(name) {
		return name ? String(name).charAt(0) : '用'
	}

	function avatarUrl(item) {
		return item.avatar ? (avatarMap.value[item.avatar] || '') : ''
	}

	function formatDate(ts) {
		if (!ts) return ''
		const d = new Date(Number(ts))
		const m = d.getMonth() + 1
		const day = d.getDate()
		const hh = d.getHours()
		const mm = d.getMinutes()
		return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day) +
			' ' + (hh < 10 ? '0' + hh : hh) + ':' + (mm < 10 ? '0' + mm : mm)
	}

	async function resolveAvatars(items) {
		const ids = []
		;(items || []).forEach(item => {
			if (item.avatar && ids.indexOf(item.avatar) === -1) {
				ids.push(item.avatar)
			}
		})
		if (!ids.length) return
		const map = await resolveCloudFiles(ids)
		avatarMap.value = Object.assign({}, avatarMap.value, map)
	}

	async function loadComments() {
		if (!spotId.value) {
			uni.showToast({
				title: '缺少地点信息',
				icon: 'none'
			})
			return
		}
		loading.value = true
		try {
			const res = await commentObj.getList({
				spot_id: spotId.value,
				page: 1,
				pageSize: 50
			})
			const data = res.data || {}
			list.value = data.list || []
			total.value = data.total || 0
			avg.value = data.avg || 0
			resolveAvatars(list.value)
		} catch (err) {
			uni.showToast({
				title: (err && (err.errMsg || err.message)) || '加载失败',
				icon: 'none'
			})
		} finally {
			loading.value = false
		}
	}

	async function openComposer() {
		if (!canManage.value) {
			uni.showToast({
				title: '仅管理员可发布评价',
				icon: 'none'
			})
			return
		}
		try {
			await ensureLogin()
		} catch (e) {
			uni.showToast({
				title: (e && e.message) || '登录失败',
				icon: 'none'
			})
			return
		}
		rating.value = 5
		content.value = ''
		composerVisible.value = true
	}

	function closeComposer() {
		composerVisible.value = false
	}

	// 提交评价，登录态失效时自动重试一次
	async function addComment(token) {
		return commentObj.addComment({
			spot_id: spotId.value,
			rating: rating.value,
			content: content.value
		}, token)
	}

	async function submit() {
		if (!String(content.value).trim()) {
			uni.showToast({
				title: '请输入评价内容',
				icon: 'none'
			})
			return
		}
		try {
			await ensureLogin()
		} catch (e) {
			uni.showToast({
				title: (e && e.message) || '登录失败',
				icon: 'none'
			})
			return
		}

		submitting.value = true
		try {
			let res
			try {
				res = await addComment(getToken())
			} catch (err) {
				if (!isAuthError(err)) throw err
				await relogin()
				res = await addComment(getToken())
			}
			const item = (res && res.data) || null
			if (item) {
				list.value.unshift(item)
				total.value += 1
				// 重新计算平均分
				const sum = list.value.reduce((acc, c) => acc + Number(c.rating || 0), 0)
				avg.value = total.value ? Math.round((sum / list.value.length) * 10) / 10 : 0
				resolveAvatars([item])
			}
			composerVisible.value = false
			uni.showToast({
				title: '已发布',
				icon: 'success'
			})
		} catch (err) {
			uni.showToast({
				title: (err && (err.errMsg || err.message)) || '发布失败',
				icon: 'none'
			})
		} finally {
			submitting.value = false
		}
	}

	// 长按删除自己的评价
	function onLongPress(item) {
		if (!myOpenid || item.openid !== myOpenid) return
		uni.showModal({
			title: '删除评价',
			content: '确定删除这条评价吗？',
			success: async (res) => {
				if (!res.confirm) return
				try {
					await commentObj.remove(item._id, getToken())
					list.value = list.value.filter(c => c._id !== item._id)
					total.value = Math.max(0, total.value - 1)
					const sum = list.value.reduce((acc, c) => acc + Number(c.rating || 0), 0)
					avg.value = list.value.length ? Math.round((sum / list.value.length) * 10) / 10 : 0
				} catch (err) {
					uni.showToast({
						title: (err && (err.errMsg || err.message)) || '删除失败',
						icon: 'none'
					})
				}
			}
		})
	}
</script>

<style lang="scss">
	.page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background-color: $bg-page;
	}

	/* ── 评分摘要 ── */
	.header {
		padding: 40rpx $space-lg $space-md;
		background: linear-gradient(180deg, $brand-soft 0%, $bg-page 100%);
		flex-shrink: 0;
	}

	.spot-name {
		display: block;
		font-size: $fs-xl;
		font-weight: 700;
		color: $text-main;
	}

	.summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: $space-md;
	}

	.summary-score {
		display: flex;
		align-items: center;
	}

	.avg {
		font-size: 48rpx;
		font-weight: 700;
		color: $warning;
		margin-right: $space-sm;
	}

	.stars {
		display: inline-flex;
		align-items: center;
	}

	.star {
		font-size: 30rpx;
		color: $border-strong;
		line-height: 1;
	}

	.star.on {
		color: $warning;
	}

	.stars.small .star {
		font-size: 24rpx;
	}

	.summary-count {
		font-size: $fs-sm;
		color: $text-secondary;
	}

	/* ── 列表 ── */
	.list {
		flex: 1;
		height: 0;
		min-height: 0;
		padding: $space-xs 0 $space-md;
	}

	.comment {
		display: flex;
		background-color: $bg-card;
		border-radius: $radius-lg;
		padding: $space-md;
		margin: 0 $space-md $space-sm;
		box-shadow: $shadow-sm;
	}

	.c-avatar {
		width: 72rpx;
		height: 72rpx;
		border-radius: 50%;
		margin-right: $space-md;
		flex-shrink: 0;
		background-color: $bg-fill;
	}

	.c-avatar-text {
		line-height: 72rpx;
		text-align: center;
		font-size: $fs-lg;
		color: $text-inverse;
		background-image: $brand-gradient;
	}

	.c-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.c-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.c-name {
		font-size: $fs-md;
		font-weight: 600;
		color: $text-main;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.c-date {
		font-size: $fs-xs;
		color: $text-placeholder;
		flex-shrink: 0;
		margin-left: $space-sm;
	}

	.c-body .stars {
		margin-top: 8rpx;
	}

	.c-content {
		margin-top: 12rpx;
		font-size: $fs-md;
		color: $text-regular;
		line-height: 1.6;
		word-break: break-all;
	}

	/* ── 空状态 ── */
	.empty {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding-bottom: 80rpx;
	}

	.empty-icon {
		font-size: 80rpx;
		line-height: 1;
		opacity: 0.4;
		margin-bottom: 20rpx;
	}

	.empty-text {
		font-size: $fs-md;
		color: $text-secondary;
	}

	/* ── 底部操作栏 ── */
	.bottom-bar {
		flex-shrink: 0;
		padding: $space-md $space-lg;
		padding-bottom: calc(#{$space-md} + constant(safe-area-inset-bottom));
		padding-bottom: calc(#{$space-md} + env(safe-area-inset-bottom));
		background-color: $bg-card;
		box-shadow: 0 -4rpx 20rpx rgba(29, 33, 41, 0.05);
	}

	.write-btn {
		width: 100%;
		font-size: $fs-lg;
		font-weight: 600;
		color: $text-inverse;
		background-image: $brand-gradient;
		box-shadow: $brand-shadow;
		border-radius: $radius-pill;
	}

	.write-icon {
		margin-right: 8rpx;
	}

	/* ── 评价输入弹窗 ── */
	.mask {
		position: fixed;
		left: 0;
		top: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(17, 24, 39, 0.5);
		display: flex;
		align-items: flex-end;
		z-index: 99;
	}

	.composer {
		width: 100%;
		background-color: $bg-card;
		border-radius: $radius-xl $radius-xl 0 0;
		padding: $space-lg $space-lg 40rpx;
		box-sizing: border-box;
	}

	.composer-title {
		display: block;
		font-size: $fs-lg;
		font-weight: 700;
		color: $text-main;
		text-align: center;
	}

	.rate-row {
		display: flex;
		align-items: center;
		justify-content: center;
		margin: $space-lg 0;
	}

	.rate-star {
		font-size: 64rpx;
		color: $border-strong;
		line-height: 1;
		margin: 0 8rpx;
		transition: transform $duration-fast ease;

		&:active {
			transform: scale(1.15);
		}
	}

	.rate-star.on {
		color: $warning;
	}

	.rate-text {
		margin-left: $space-md;
		font-size: $fs-md;
		font-weight: 500;
		color: $warning;
	}

	.composer-input {
		width: 100%;
		height: 220rpx;
		padding: 20rpx $space-md;
		font-size: $fs-md;
		color: $text-main;
		background-color: $bg-fill;
		border-radius: $radius-md;
	}

	.composer-actions {
		display: flex;
		margin-top: $space-lg;
		gap: 20rpx;
	}

	.c-btn {
		flex: 1;
		font-size: $fs-lg;
		font-weight: 600;
		border-radius: $radius-pill;
	}

	.c-btn.cancel {
		color: $text-regular;
		background-color: $bg-fill;
	}

	.c-btn.submit {
		color: $text-inverse;
		background-image: $brand-gradient;
		box-shadow: $brand-shadow;
	}
</style>
