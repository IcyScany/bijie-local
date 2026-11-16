<script setup>
	import {
		onLaunch,
		onShow,
		onHide
	} from '@dcloudio/uni-app'
	import {
		ensureLogin
	} from '@/utils/auth.js'

	// 应用启动时静默登录，获取用户身份与权限
	onLaunch(() => {
		console.log('App Launch')
		ensureLogin().catch(() => {})
	})
	onShow(() => {
		console.log('App Show')
	})
	onHide(() => {
		console.log('App Hide')
	})
</script>

<style lang="scss">
	/* 导入 Google Maps 工具类 */
	@import "./styles/google-maps.scss";
	/* 导入 Tabbar 样式 */
	@import "./styles/tabbar.scss";
</style>
