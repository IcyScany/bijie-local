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

	/* Google Maps Style - Global Styles */
	page {
		background-color: $bg-page;
		color: $text-main;
		font-size: $fs-md;
		line-height: 1.5;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
		-webkit-font-smoothing: antialiased;
	}

	button::after {
		border: none;
	}

	/* Google Material Button - 标准圆角 */
	button {
		border-radius: $radius-sm;
		transition: all $duration-fast cubic-bezier(0.4, 0, 0.2, 1);
		font-weight: 500;
		letter-spacing: 0.25px;
		
		&:active {
			opacity: 0.92;
		}
	}

	/* Animations */
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(8rpx);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes slideUp {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}
</style>
