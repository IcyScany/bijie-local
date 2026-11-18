<template>
	<view class="page">
		<view class="user-card">
			<image v-if="avatarDisplay" class="avatar" :src="avatarDisplay" mode="aspectFill" />
			<view v-else class="avatar placeholder">{{ avatarText(user.nickname) }}</view>

			<view class="user-info">
				<text class="nickname">{{ user.nickname || '未设置昵称' }}</text>
				<text class="role">{{ user.isAdmin ? '管理员' : '普通用户' }}</text>
			</view>

			<view class="edit-btn" @click="openProfile">编辑资料</view>
		</view>

		<view class="stats">
			<view class="stat">
				<text class="stat-num">{{ user.contributionPoints || 0 }}</text>
				<text class="stat-label">共创积分</text>
			</view>
			<view class="stat">
				<text class="stat-num date">{{ formatDate(user.lastContributionDate) }}</text>
				<text class="stat-label">最近共创</text>
			</view>
		</view>

		<!-- 管理员菜单（仅管理员可见） -->
		<view v-if="user.isAdmin" class="menu">
			<view class="menu-item" @click="goReview">
				<view class="menu-left">
					<text class="menu-label">审核管理</text>
					<text class="menu-tag">管理员</text>
					<text v-if="pendingCount" class="menu-badge">{{ pendingCount > 99 ? '99+' : pendingCount }}</text>
				</view>
				<text class="menu-arrow">›</text>
			</view>
			<view class="menu-item" @click="goSpots">
				<view class="menu-left">
					<text class="menu-label">地点管理</text>
					<text class="menu-tag">管理员</text>
				</view>
				<text class="menu-arrow">›</text>
			</view>
			<view class="menu-item" @click="goAdmins">
				<view class="menu-left">
					<text class="menu-label">管理权限</text>
					<text class="menu-tag">管理员</text>
				</view>
				<text class="menu-arrow">›</text>
			</view>
		</view>

		<view class="menu">
			<view class="menu-item" @click="goContributions">
				<text class="menu-label">我的共创</text>
				<text class="menu-arrow">›</text>
			</view>
			<view class="menu-item" @click="goContributors">
				<text class="menu-label">共创者排行</text>
				<text class="menu-arrow">›</text>
			</view>
		</view>

		<!-- 我的收藏 -->
		<view class="section-head">
			<text class="section-title">我的收藏</text>
			<text class="section-more" @click="openFavorites">查看全部 ›</text>
		</view>
		<view class="fav-card">
			<view v-if="!favorites.length" class="fav-empty">还没有收藏地点</view>
			<view v-for="spot in favorites" :key="spot._id" class="fav-item" @click="openFavorites">
				<image v-if="spot.thumb" class="fav-thumb" :src="spot.thumb" mode="aspectFill" />
				<view v-else class="fav-thumb fav-thumb-placeholder">📍</view>
				<view class="fav-info">
					<text class="fav-name">{{ spot.name }}</text>
					<text class="fav-address" v-if="spot.address">{{ spot.address }}</text>
				</view>
			</view>
		</view>

		<view v-if="showProfile" class="mask">
			<view class="profile-card">
				<text class="profile-title">完善你的资料</text>
				<text class="profile-sub">设置头像和昵称，让共创记录更清晰</text>

				<button class="avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
					<image v-if="avatarUrl" class="avatar-img" :src="avatarUrl" mode="aspectFill" />
					<view v-else class="avatar-placeholder">{{ avatarText(nickname) }}</view>
				</button>
				<text class="avatar-tip">点击设置头像</text>

				<input
					id="nicknameInput"
					class="nickname-input"
					type="nickname"
					v-model="nickname"
					placeholder="请输入昵称"
					@blur="onNicknameChange"
					@change="onNicknameChange"
				/>

				<button class="save-btn" :disabled="saving" @click="saveProfile">{{ saving ? '保存中...' : '保存' }}</button>
				<text class="skip" @click="showProfile = false">取消</text>
			</view>
		</view>
	</view>
</template>

<script setup>
	import { ref, getCurrentInstance } from 'vue'
	import { onShow } from '@dcloudio/uni-app'
	import { ensureLogin, getUserInfo, getToken, isAdmin } from '@/utils/auth.js'
	import { resolveCloudFile } from '@/utils/cloudFile.js'
	import { compressImage, getFileSize, MAX_IMAGE_SIZE } from '@/utils/image.js'

	const instance = getCurrentInstance()

	const spotFavObj = uniCloud.importObject('spot-favorites', {
		customUI: true
	})

	const spotsObj = uniCloud.importObject('spots', {
		customUI: true
	})

	// 待审核数量（仅管理员）
	const pendingCount = ref(0)

	const favorites = ref([])

	const user = ref({
		nickname: '',
		avatar: '',
		contributionCount: 0,
		contributionPoints: 0,
		lastContributionDate: 0,
		isAdmin: false
	})

	const showProfile = ref(false)
	const nickname = ref('')
	const avatarUrl = ref('')
	const avatarDisplay = ref('')
	const avatarChanged = ref(false)
	const saving = ref(false)

	onShow(() => {
		loadProfile()
		loadFavorites()
		loadPendingCount()
	})

	// 加载待审核数量（仅管理员显示）
	async function loadPendingCount() {
		if (!isAdmin()) {
			pendingCount.value = 0
			return
		}
		try {
			const res = await spotsObj.getList({
				status: 'pending',
				page: 1,
				pageSize: 1
			})
			pendingCount.value = res.total || 0
		} catch (e) {
			pendingCount.value = 0
		}
	}

	// 加载收藏地点列表
	async function loadFavorites() {
		try {
			await ensureLogin()
		} catch (e) {
			favorites.value = []
			return
		}
		try {
			const res = await spotFavObj.list(getToken())
			favorites.value = (res && res.data) || []
		} catch (e) {
			favorites.value = []
		}
	}

	// 打开收藏目录页
	function openFavorites() {
		uni.navigateTo({
			url: '/pages/favorites/favorites'
		})
	}

	// 加载当前用户资料与共创统计
	async function loadProfile() {
		try {
			await ensureLogin()
		} catch (e) {
			return
		}
		try {
			const res = await uniCloud.callFunction({
				name: 'user-auth',
				data: {
					action: 'profile',
					token: getToken()
				}
			})
			const result = res.result || {}
			if (result.code === 0 && result.data) {
				user.value = result.data
			}
			refreshAvatar()
		} catch (e) {
			const info = getUserInfo()
			user.value = {
				nickname: info.nickname || '',
				avatar: info.avatar || '',
				contributionCount: 0,
				contributionPoints: 0,
				lastContributionDate: 0,
				isAdmin: false
			}
			refreshAvatar()
		}
	}

	// 将云存储 fileID 转为临时链接用于展示（支付宝云/腾讯云不支持 fileID 直显）
	async function refreshAvatar() {
		avatarDisplay.value = ''
		if (!user.value.avatar) return
		const url = await resolveCloudFile(user.value.avatar)
		avatarDisplay.value = url || ''
	}

	// 取昵称首字作为头像占位
	function avatarText(name) {
		return name ? String(name).charAt(0) : '头'
	}

	// 时间戳格式化为 YYYY-MM-DD
	function formatDate(ts) {
		if (!ts) return '暂无'
		const d = new Date(Number(ts))
		const y = d.getFullYear()
		const m = d.getMonth() + 1
		const day = d.getDate()
		return y + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day)
	}

	// 打开资料编辑弹窗
	function openProfile() {
		nickname.value = user.value.nickname || ''
		avatarUrl.value = avatarDisplay.value || ''
		avatarChanged.value = false
		showProfile.value = true
	}

	// 选取微信头像
	function onChooseAvatar(e) {
		const url = e.detail && e.detail.avatarUrl
		if (url) {
			avatarUrl.value = url
			avatarChanged.value = true
		}
	}

	// 微信「使用微信昵称」通过 blur/change 事件回填，需手动同步到输入值
	function onNicknameChange(e) {
		if (e && e.detail && e.detail.value !== undefined) {
			nickname.value = e.detail.value
		}
	}

	// 兜底：直接读取输入框当前真实值，应对回填事件未同步的情况
	function readNicknameFromInput() {
		return new Promise((resolve) => {
			uni.createSelectorQuery()
				.in(instance.proxy)
				.select('#nicknameInput')
				.fields({ properties: ['value'] }, (res) => {
					resolve(res && res.value ? String(res.value) : '')
				})
				.exec()
		})
	}

	// 保存昵称与头像
	async function saveProfile() {
		const inputValue = await readNicknameFromInput()
		const name = String(inputValue || nickname.value || '').trim()
		if (!name) {
			uni.showToast({
				title: '请输入昵称',
				icon: 'none'
			})
			return
		}

		try {
			await ensureLogin()
		} catch (e) {
			uni.showToast({
				title: (e && e.message) || '登录失败，请稍后重试',
				icon: 'none'
			})
			return
		}

		saving.value = true
		try {
			let avatar = ''
			if (avatarChanged.value && avatarUrl.value) {
				const size = await getFileSize(avatarUrl.value)
				if (size > MAX_IMAGE_SIZE) {
					uni.showToast({
						title: '头像图片不能超过 6MB',
						icon: 'none'
					})
					return
				}
				const filePath = await compressImage(avatarUrl.value)
				const ext = (filePath.split('.').pop() || 'png').split('?')[0]
				const cloudPath = 'avatars/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext
				const uploadRes = await uniCloud.uploadFile({
					filePath,
					cloudPath
				})
				avatar = uploadRes.fileID
			}

			const payload = {
				action: 'updateProfile',
				token: getToken(),
				nickname: name
			}
			// 仅在更换头像时提交，避免把临时链接写回数据库
			if (avatar) {
				payload.avatar = avatar
			}

			const res = await uniCloud.callFunction({
				name: 'user-auth',
				data: payload
			})
			const result = res.result || {}
			if (result.code !== 0) {
				throw new Error(result.message || '保存失败')
			}

			user.value.nickname = name
			if (avatar) {
				user.value.avatar = avatar
				await refreshAvatar()
			}
			uni.setStorageSync('user_info', {
				nickname: name,
				avatar: user.value.avatar || ''
			})
			showProfile.value = false
			uni.showToast({
				title: '已保存',
				icon: 'success'
			})
		} catch (err) {
			uni.showToast({
				title: (err && err.message) || '保存失败',
				icon: 'none'
			})
		} finally {
			saving.value = false
		}
	}

	function goReview() {
		uni.navigateTo({
			url: '/pages/admin/review'
		})
	}

	function goSpots() {
		uni.navigateTo({
			url: '/pages/admin/spots'
		})
	}

	function goAdmins() {
		uni.navigateTo({
			url: '/pages/admin/admins'
		})
	}

	function goContributors() {
		uni.switchTab({
			url: '/pages/contributors/contributors'
		})
	}

	function goContributions() {
		uni.navigateTo({
			url: '/pages/contributions/contributions'
		})
	}
</script>

<style lang="scss">
	.page {
		min-height: 100vh;
		background-color: $bg-page;
		padding: $space-lg $space-lg 48rpx;
		box-sizing: border-box;
	}

	.user-card {
		display: flex;
		align-items: center;
		background-image: $brand-gradient;
		border-radius: $radius-xl;
		padding: 44rpx $space-lg;
		box-shadow: $brand-shadow;
		animation: fadeIn 0.4s ease;
	}

	.avatar {
		width: 128rpx;
		height: 128rpx;
		border-radius: 50%;
		border: 4rpx solid rgba(255, 255, 255, 0.85);
		margin-right: $space-md;
		flex-shrink: 0;
	}

	.avatar.placeholder {
		line-height: 128rpx;
		text-align: center;
		font-size: 52rpx;
		font-weight: 500;
		color: $brand;
		background-color: #ffffff;
	}

	.user-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.nickname {
		font-size: 38rpx;
		font-weight: 700;
		color: $text-inverse;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.role {
		margin-top: 10rpx;
		font-size: $fs-sm;
		color: rgba(255, 255, 255, 0.9);
	}

	.edit-btn {
		padding: 12rpx 28rpx;
		font-size: $fs-sm;
		font-weight: 500;
		color: $text-inverse;
		border: 2rpx solid rgba(255, 255, 255, 0.85);
		border-radius: $radius-pill;
		transition: all $duration-fast ease;

		&:active {
			transform: scale(0.95);
			opacity: 0.9;
		}
	}

	.stats {
		display: flex;
		background-color: $bg-card;
		border-radius: $radius-lg;
		margin-top: $space-md;
		padding: $space-lg 0;
		box-shadow: $shadow-card;
	}

	.stat {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.stat:first-child {
		border-right: 1rpx solid $border-color;
	}

	.stat-num {
		font-size: 48rpx;
		font-weight: 700;
		color: $brand;
	}

	.stat-num.date {
		font-size: 32rpx;
		line-height: 64rpx;
	}

	.stat-label {
		margin-top: 8rpx;
		font-size: $fs-sm;
		color: $text-secondary;
	}

	.menu {
		background-color: $bg-card;
		border-radius: $radius-lg;
		margin-top: $space-md;
		overflow: hidden;
		box-shadow: $shadow-card;
	}

	.menu-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: $space-lg;
		border-bottom: 1rpx solid $border-color;
		transition: all $duration-fast ease;

		&:active {
			background-color: $bg-fill;
		}
	}

	.menu-item:last-child {
		border-bottom: none;
	}

	.menu-label {
		font-size: 30rpx;
		font-weight: 500;
		color: $text-main;
	}

	.menu-left {
		display: flex;
		align-items: center;
	}

	.menu-tag {
		margin-left: 12rpx;
		padding: 2rpx 12rpx;
		font-size: 20rpx;
		font-weight: 500;
		line-height: 1.6;
		color: $brand;
		background-color: rgba(0, 123, 139, 0.1);
		border-radius: $radius-pill;
	}

	.menu-badge {
		margin-left: 12rpx;
		min-width: 32rpx;
		height: 32rpx;
		line-height: 32rpx;
		padding: 0 10rpx;
		text-align: center;
		font-size: 20rpx;
		color: #FFFFFF;
		background-color: #EA4335;
		border-radius: 16rpx;
	}

	.menu-arrow {
		font-size: 40rpx;
		color: $text-disabled;
	}

	/* 我的收藏 */
	.section-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin: $space-lg 0 $space-sm;
	}

	.section-title {
		font-size: 30rpx;
		font-weight: 600;
		color: $text-main;
	}

	.section-more {
		font-size: $fs-sm;
		color: $brand;
	}

	.fav-card {
		background-color: $bg-card;
		border-radius: $radius-lg;
		overflow: hidden;
		box-shadow: $shadow-card;
	}

	.fav-empty {
		padding: $space-lg;
		text-align: center;
		font-size: $fs-sm;
		color: $text-secondary;
	}

	.fav-item {
		display: flex;
		align-items: center;
		padding: $space-md $space-lg;
		border-bottom: 1rpx solid $border-color;
	}

	.fav-item:last-child {
		border-bottom: none;
	}

	.fav-thumb {
		width: 96rpx;
		height: 96rpx;
		border-radius: $radius-sm;
		flex-shrink: 0;
		margin-right: $space-md;
		background-color: $bg-fill;
	}

	.fav-thumb-placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 40rpx;
	}

	.fav-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.fav-name {
		font-size: 30rpx;
		font-weight: 500;
		color: $text-main;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.fav-address {
		margin-top: 6rpx;
		font-size: $fs-sm;
		color: $text-secondary;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mask {
		position: fixed;
		left: 0;
		top: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(17, 24, 39, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 99;
		animation: fadeIn 0.2s ease;
	}

	.profile-card {
		width: 620rpx;
		background-color: $bg-card;
		border-radius: $radius-xl;
		padding: 52rpx 44rpx 44rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
		box-sizing: border-box;
		box-shadow: $shadow-float;
		animation: fadeIn 0.3s ease;
	}

	.profile-title {
		font-size: 36rpx;
		font-weight: 700;
		color: $text-main;
	}

	.profile-sub {
		margin-top: 12rpx;
		font-size: $fs-sm;
		color: $text-secondary;
		text-align: center;
		line-height: 1.5;
	}

	.avatar-btn {
		width: 144rpx;
		height: 144rpx;
		margin: $space-lg 0 0;
		padding: 0;
		border-radius: 50%;
		background-color: $bg-fill;
		overflow: hidden;
		line-height: normal;
		transition: all $duration-fast ease;

		&:active {
			transform: scale(0.95);
		}
	}

	.avatar-img {
		width: 144rpx;
		height: 144rpx;
	}

	.avatar-placeholder {
		width: 144rpx;
		height: 144rpx;
		line-height: 144rpx;
		text-align: center;
		font-size: 52rpx;
		color: $text-inverse;
		background-image: $brand-gradient;
	}

	.avatar-tip {
		margin-top: 12rpx;
		font-size: $fs-xs;
		color: $text-secondary;
	}

	.nickname-input {
		width: 100%;
		height: 88rpx;
		margin-top: $space-md;
		padding: 0 $space-md;
		font-size: $fs-lg;
		text-align: center;
		background-color: $bg-fill;
		border-radius: $radius-md;
		transition: all $duration-fast ease;

		&:focus {
			background-color: $bg-fill-hover;
		}
	}

	.save-btn {
		width: 100%;
		margin-top: $space-lg;
		font-size: $fs-lg;
		font-weight: 600;
		color: $text-inverse;
		background-image: $brand-gradient;
		box-shadow: $brand-shadow;
		border-radius: $radius-pill;
	}

	.skip {
		margin-top: $space-md;
		font-size: $fs-sm;
		color: $text-secondary;
	}
</style>
