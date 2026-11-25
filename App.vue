<script setup>
	import {
		onLaunch,
		onShow,
		onHide
	} from '@dcloudio/uni-app'
	import {
		ensureLogin,
		getUserInfo
	} from '@/utils/auth.js'

	// 应用启动时静默登录，获取用户身份与权限
	onLaunch(() => {
		console.log('App Launch')
		ensureLogin().catch((e) => {
			console.error('[auth] 启动登录失败', e)
		})
	})
	onShow(() => {
		console.log('App Show')
		checkProfile()
	})
	onHide(() => {
		console.log('App Hide')
	})

	// 首次进入提示完善头像昵称（仅提示一次）
	async function checkProfile() {
		try {
			await ensureLogin()
		} catch (e) {
			return
		}
		if (uni.getStorageSync('profile_prompted')) return
		const info = getUserInfo()
		const name = String(info.nickname || '')
		if (name && !/^用户.{4}$/.test(name)) return
		uni.setStorageSync('profile_prompted', true)
		uni.showModal({
			title: '完善资料',
			content: '设置头像和昵称，让共创记录更清晰',
			confirmText: '去设置',
			success: (res) => {
				if (res.confirm) {
					uni.switchTab({
						url: '/pages/mine/mine'
					})
				}
			}
		})
	}
</script>

<style lang="scss">
	/* 导入 Google Maps 工具类 */
	@import "./styles/google-maps.scss";
	/* 导入 Tabbar 样式 */
	@import "./styles/tabbar.scss";
	/* 导入全局样式 */
	@import "./styles/global.scss";
</style>
