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
	/* Google Maps Style - Global Styles */
	page {
		background-color: $bg-page;
		color: $text-main;
		font-size: $fs-md;
		line-height: 1.5;
		font-family: 'Google Sans', 'Roboto', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
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

	/* FAB - Floating Action Button */
	.gm-fab {
		width: 112rpx;
		height: 112rpx;
		border-radius: 50%;
		background-color: $brand;
		color: $text-inverse;
		box-shadow: $shadow-fab;
		display: flex;
		align-items: center;
		justify-content: center;
		
		&:active {
			transform: scale(0.95);
		}
	}

	/* Google Material Card */
	.gm-card {
		background-color: $bg-card;
		border-radius: $radius-sm;
		box-shadow: $shadow-card;
		transition: all $duration-fast cubic-bezier(0.4, 0, 0.2, 1);
	}

	/* Google Material Chip */
	.gm-chip {
		display: inline-flex;
		align-items: center;
		padding: 12rpx 24rpx;
		border-radius: $radius-pill;
		background-color: $bg-fill;
		color: $text-regular;
		font-size: $fs-sm;
		font-weight: 500;
		transition: all $duration-fast cubic-bezier(0.4, 0, 0.2, 1);
		
		&:active {
			background-color: $bg-fill-hover;
		}
		
		&.active {
			background-color: $brand-soft;
			color: $brand;
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
