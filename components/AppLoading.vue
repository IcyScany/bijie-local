<template>
	<view class="app-loading" :class="{ compact }">
		<view class="spinner"></view>
		<text v-if="text" class="loading-text">{{ text }}</text>
	</view>
</template>

<script setup>
	defineProps({
		text: {
			type: String,
			default: '加载中...'
		},
		compact: {
			type: Boolean,
			default: false
		}
	})
</script>

<style lang="scss">
	.app-loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 80rpx 0;
	}

	.app-loading.compact {
		padding: 24rpx 0;
	}

	.app-loading.compact .spinner {
		width: 36rpx;
		height: 36rpx;
		border-width: 4rpx;
	}

	.app-loading.compact .loading-text {
		margin-top: 10rpx;
		font-size: $fs-xs;
	}

	.spinner {
		width: 60rpx;
		height: 60rpx;
		border-radius: 50%;
		border: 6rpx solid $brand-soft;
		border-top-color: $brand;
		animation: app-loading-spin 0.8s linear infinite;
	}

	.loading-text {
		margin-top: 20rpx;
		font-size: $fs-sm;
		color: $text-secondary;
	}

	@keyframes app-loading-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
