<template>
	<view class="points-rule">
		<view class="points-rule-head" @click="toggle">
			<text class="points-rule-title">{{ title }}</text>
			<text class="points-rule-arrow" :class="{ 'points-rule-arrow-open': expanded }">›</text>
		</view>
		<view v-if="expanded" class="points-rule-list">
			<view v-for="rule in rules" :key="rule.label" class="points-rule-item">
				<text class="points-rule-item-label">{{ rule.label }}</text>
				<text class="points-rule-item-value">{{ rule.value }}</text>
			</view>
			<text class="points-rule-note">审核通过后计入积分</text>
		</view>
	</view>
</template>

<script setup>
	import { ref } from 'vue'

	defineProps({
		title: {
			type: String,
			default: '积分规则'
		}
	})

	const expanded = ref(false)

	function toggle() {
		expanded.value = !expanded.value
	}

	// 与云端 spots/lib/contributions.js 的 POINTS 保持一致
	const rules = [
		{ label: '新增地点', value: '+5 分' },
		{ label: '地点更新', value: '+2 分' },
		{ label: '补充图片', value: '+2 分/次' }
	]
</script>

<style lang="scss" scoped>
	.points-rule {
		padding: 4rpx 0;
		margin-bottom: $space-sm;
	}

	.points-rule-head {
		display: flex;
		align-items: center;
	}

	.points-rule-title {
		font-size: $fs-xs;
		color: $text-placeholder;
	}

	.points-rule-arrow {
		margin-left: 6rpx;
		font-size: $fs-sm;
		line-height: 1;
		color: $text-disabled;
		transition: transform $duration-fast ease;
	}

	.points-rule-arrow-open {
		transform: rotate(90deg);
	}

	.points-rule-list {
		margin-top: 10rpx;
		padding: $space-sm $space-md;
		background-color: $bg-fill;
		border-radius: $radius-sm;
		animation: fadeIn $duration-normal ease;
	}

	.points-rule-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8rpx 0;
	}

	.points-rule-item-label {
		font-size: $fs-xs;
		color: $text-secondary;
	}

	.points-rule-item-value {
		font-size: $fs-xs;
		font-weight: 600;
		color: $brand;
	}

	.points-rule-note {
		display: block;
		margin-top: 4rpx;
		font-size: $fs-xs;
		color: $text-disabled;
	}
</style>
