<template>
	<view class="page">
		<view class="hero">
			<view class="hero-badge">毕节 · 七星关</view>
			<text class="hero-title">毕节生活地图</text>
			<text class="hero-subtitle">发现身边的美食、景点与便民服务</text>
		</view>

		<view class="menu">
			<view class="menu-card" @click="goMap">
				<view class="menu-icon map">🗺️</view>
				<view class="menu-body">
					<text class="menu-title">打开生活地图</text>
					<text class="menu-desc">在地图上查看美食、景点等地点分布</text>
				</view>
				<text class="menu-arrow">›</text>
			</view>

			<view class="menu-card" @click="goAdmin">
				<view class="menu-icon admin">🛠️</view>
				<view class="menu-body">
					<text class="menu-title">地点管理</text>
					<text class="menu-desc">维护地点列表、审核用户提交内容</text>
				</view>
				<text class="menu-arrow">›</text>
			</view>

			<view class="menu-card" @click="goContribute">
				<view class="menu-icon contribute">📝</view>
				<view class="menu-body">
					<text class="menu-title">我来补充 / 更新</text>
					<text class="menu-desc">提交新地点或反馈错误，共建本地地图</text>
				</view>
				<text class="menu-arrow">›</text>
			</view>

			<view class="menu-card" @click="goContributors">
				<view class="menu-icon contributor">🏅</view>
				<view class="menu-body">
					<text class="menu-title">共创者排行</text>
					<text class="menu-desc">查看为地图共创地点的用户</text>
				</view>
				<text class="menu-arrow">›</text>
			</view>
		</view>

		<text class="footer">数据由本地用户共建 · 毕节七星关</text>

		<view v-if="showProfile" class="mask">
			<view class="profile-card">
				<text class="profile-title">完善你的资料</text>
				<text class="profile-sub">设置头像和昵称，让共创记录更清晰</text>

				<button class="avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
					<image v-if="avatarUrl" class="avatar-img" :src="avatarUrl" mode="aspectFill" />
					<view v-else class="avatar-placeholder">{{ avatarText() }}</view>
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
				<text class="skip" @click="skipProfile">稍后再说</text>
			</view>
		</view>
	</view>
</template>

<script setup>
	import { ref, getCurrentInstance } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import {
		ensureLogin,
		isAdmin,
		getUserInfo,
		getToken
	} from '@/utils/auth.js'
	import { compressImage, getFileSize, MAX_IMAGE_SIZE } from '@/utils/image.js'

	const instance = getCurrentInstance()

	const showProfile = ref(false)
	const nickname = ref('')
	const avatarUrl = ref('')
	const avatarChanged = ref(false)
	const saving = ref(false)

	onLoad(() => {
		initProfile()
	})

	// 首次进入：登录后若昵称仍为默认值，则引导完善头像与昵称
	async function initProfile() {
		try {
			await ensureLogin()
		} catch (e) {
			return
		}
		const info = getUserInfo()
		const name = String(info.nickname || '')
		if (!name || /^用户.{4}$/.test(name)) {
			nickname.value = /^用户/.test(name) ? '' : name
			avatarUrl.value = info.avatar || ''
			showProfile.value = true
		}
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

	// 无头像时以昵称首字占位
	function avatarText() {
		return nickname.value ? nickname.value.charAt(0) : '头'
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

		saving.value = true
		try {
			let avatar = avatarUrl.value
			if (avatarChanged.value && avatar) {
				const size = await getFileSize(avatar)
				if (size > MAX_IMAGE_SIZE) {
					uni.showToast({
						title: '头像图片不能超过 6MB',
						icon: 'none'
					})
					return
				}
				const compressed = await compressImage(avatar)
				const ext = (compressed.split('.').pop() || 'png').split('?')[0]
				const cloudPath = 'avatars/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext
				const uploadRes = await uniCloud.uploadFile({
					filePath: compressed,
					cloudPath
				})
				avatar = uploadRes.fileID
			}

			const payload = {
				action: 'updateProfile',
				token: getToken(),
				nickname: name
			}
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

			const info = getUserInfo()
			uni.setStorageSync('user_info', {
				nickname: name,
				avatar: avatar || ''
			})
			avatarUrl.value = avatar || ''
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

	function skipProfile() {
		showProfile.value = false
	}

	// 打开生活地图页面
	function goMap() {
		uni.navigateTo({
			url: '/pages/map/map'
		})
	}

	// 校验管理员身份后进入地点管理
	async function goAdmin() {
		try {
			await ensureLogin()
		} catch (e) {
			uni.showToast({
				title: e.message || '登录失败',
				icon: 'none'
			})
			return
		}
		if (isAdmin()) {
			uni.navigateTo({
				url: '/pages/admin/review'
			})
			return
		}
		uni.showToast({
			title: '仅管理员可访问',
			icon: 'none'
		})
	}

	// 打开发布/更新页面
	function goContribute() {
		uni.navigateTo({
			url: '/pages/contribute/contribute'
		})
	}

	// 打开共创者排行页面
	function goContributors() {
		uni.navigateTo({
			url: '/pages/contributors/contributors'
		})
	}
</script>

<style lang="scss">
	.page {
		min-height: 100vh;
		background: linear-gradient(180deg, $brand-soft 0%, $bg-page 360rpx);
		padding: 40rpx $space-lg;
		box-sizing: border-box;
	}

	.hero {
		padding: 60rpx 16rpx 40rpx;
		animation: fadeIn 0.4s ease;
	}

	.hero-badge {
		display: inline-block;
		padding: 10rpx 28rpx;
		font-size: $fs-xs;
		font-weight: 500;
		color: $brand;
		background-color: rgba(255, 255, 255, 0.95);
		border: 1rpx solid rgba(0, 105, 92, 0.2);
		border-radius: $radius-pill;
		box-shadow: $shadow-sm;
	}

	.hero-title {
		display: block;
		margin-top: $space-md;
		font-size: $fs-xxl;
		font-weight: 700;
		letter-spacing: 1rpx;
		color: $text-main;
	}

	.hero-subtitle {
		display: block;
		margin-top: $space-sm;
		font-size: $fs-md;
		color: $text-regular;
		line-height: 1.5;
	}

	.menu {
		margin-top: 48rpx;
	}

	.menu-card {
		display: flex;
		align-items: center;
		background-color: $bg-card;
		border-radius: $radius-lg;
		padding: $space-lg;
		margin-bottom: $space-md;
		box-shadow: $shadow-card;
		transition: all $duration-normal ease;
		
		&:active {
			transform: translateY(2rpx);
			box-shadow: $shadow-sm;
		}
	}

	.menu-icon {
		width: 100rpx;
		height: 100rpx;
		line-height: 100rpx;
		text-align: center;
		font-size: 52rpx;
		border-radius: $radius-lg;
		margin-right: $space-md;
		flex-shrink: 0;
	}

	.menu-icon.map {
		background-color: $brand-soft;
	}

	.menu-icon.admin {
		background-color: $success-soft;
	}

	.menu-icon.contribute {
		background-color: $orange-soft;
	}

	.menu-icon.contributor {
		background-color: $purple-soft;
	}

	.menu-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.menu-title {
		font-size: $fs-lg;
		font-weight: 600;
		color: $text-main;
	}

	.menu-desc {
		margin-top: 8rpx;
		font-size: $fs-sm;
		color: $text-secondary;
		line-height: 1.4;
	}

	.menu-arrow {
		font-size: 44rpx;
		color: $text-disabled;
		flex-shrink: 0;
		margin-left: $space-sm;
	}

	.footer {
		display: block;
		margin-top: 48rpx;
		text-align: center;
		font-size: $fs-sm;
		color: $text-placeholder;
		line-height: 1.5;
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
