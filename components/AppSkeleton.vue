<template>
	<view class="skeleton">
		<view v-for="n in count" :key="n" class="sk-item">
			<view class="sk-thumb"></view>
			<view class="sk-lines">
				<view class="sk-line w70"></view>
				<view class="sk-line w45"></view>
			</view>
		</view>
	</view>
</template>

<script setup>
	defineProps({
		count: {
			type: Number,
			default: 5
		}
	})
</script>

<style lang="scss">
	.skeleton {
		padding: $space-xs 0;
	}

	.sk-item {
		display: flex;
		align-items: center;
		background-color: $bg-card;
		border-radius: $radius-lg;
		padding: $space-md;
		margin: 0 $space-md $space-sm;
		box-shadow: $shadow-sm;
	}

	.sk-thumb {
		width: 96rpx;
		height: 96rpx;
		border-radius: $radius-md;
		margin-right: $space-md;
		flex-shrink: 0;
		background: linear-gradient(90deg, $bg-fill 25%, $bg-fill-hover 37%, $bg-fill 63%);
		background-size: 400% 100%;
		animation: sk-shimmer 1.4s ease infinite;
	}

	.sk-lines {
		flex: 1;
	}

	.sk-line {
		height: 28rpx;
		border-radius: 8rpx;
		background: linear-gradient(90deg, $bg-fill 25%, $bg-fill-hover 37%, $bg-fill 63%);
		background-size: 400% 100%;
		animation: sk-shimmer 1.4s ease infinite;
	}

	.sk-line + .sk-line {
		margin-top: 16rpx;
	}

	.w70 {
		width: 70%;
	}

	.w45 {
		width: 45%;
	}

	@keyframes sk-shimmer {
		0% {
			background-position: 100% 0;
		}

		100% {
			background-position: 0 0;
		}
	}
</style>
