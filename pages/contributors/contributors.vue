<template>
	<view class="page">
		<view class="header">
			<text class="title">共创者排行</text>
			<text class="subtitle">感谢每一位为毕节生活地图共创地点的用户</text>
		</view>

		<view class="rule-wrap">
			<PointsRuleCard />
		</view>

		<AppSkeleton v-if="loading" :count="6" />
		<view v-else-if="!list.length" class="empty">暂无共创者，快去补充地点吧</view>
		<scroll-view v-else class="list" scroll-y>
			<view v-for="(item, index) in list" :key="item.openid" class="item">
				<view class="rank" :class="'rank-' + (index + 1)">{{ index + 1 }}</view>
				<view class="avatar">{{ avatarText(item.name) }}</view>
				<view class="info">
					<text class="name">{{ item.name }}</text>
					<text class="sub">最近共创：{{ formatDate(item.lastDate) }}</text>
				</view>
				<view class="count">
					<text class="count-num">{{ item.points }}</text>
					<text class="count-label">分</text>
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<script setup>
	import { ref } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import AppSkeleton from '@/components/AppSkeleton.vue'
	import PointsRuleCard from '@/components/PointsRuleCard.vue'

	const list = ref([])
	const loading = ref(false)

	onLoad(() => {
		loadContributors()
	})

	// 拉取共创者排行数据
	async function loadContributors() {
		loading.value = true
		try {
			const res = await uniCloud.callFunction({
				name: 'user-auth',
				data: { action: 'contributors' }
			})
			const result = res.result || {}
			if (result.code !== 0) {
				throw new Error(result.message || '加载失败')
			}
			list.value = (result.data && result.data.list) || []
		} catch (err) {
			uni.showToast({
				title: (err && err.message) || '加载失败',
				icon: 'none'
			})
		} finally {
			loading.value = false
		}
	}

	// 取名称首字作为头像文字
	function avatarText(name) {
		return name ? String(name).charAt(0) : '?'
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
</script>

<style lang="scss">
	.page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background-color: $bg-page;
	}

	.header {
		padding: 52rpx $space-lg 0;
		background: linear-gradient(180deg, $brand-soft 0%, $bg-page 100%);
		animation: fadeIn 0.4s ease;
	}

	.title {
		display: block;
		font-size: $fs-xl;
		font-weight: 700;
		color: $text-main;
	}

	.subtitle {
		display: block;
		margin-top: 12rpx;
		font-size: $fs-sm;
		color: $text-secondary;
		line-height: 1.5;
	}

	.rule-wrap {
		padding: 0 $space-lg;
	}

	.list {
		flex: 1;
		height: 0;
		min-height: 0;
		padding: $space-xs 0 $space-md;
	}

	.item {
		display: flex;
		align-items: center;
		background-color: $bg-card;
		border-radius: $radius-lg;
		padding: $space-md;
		margin: 0 $space-md $space-sm;
		box-shadow: $shadow-card;
		transition: all $duration-fast ease;

		&:active {
			transform: translateY(2rpx);
			box-shadow: $shadow-sm;
		}
	}

	.rank {
		width: 52rpx;
		text-align: center;
		font-size: $fs-lg;
		font-weight: 700;
		color: $text-placeholder;
		margin-right: $space-sm;
	}

	.rank-1 {
		color: #f5a623;
	}

	.rank-2 {
		color: #97a3b4;
	}

	.rank-3 {
		color: #cd8a5b;
	}

	.avatar {
		width: 80rpx;
		height: 80rpx;
		line-height: 80rpx;
		text-align: center;
		font-size: $fs-lg;
		font-weight: 500;
		color: $text-inverse;
		background-image: $brand-gradient;
		border-radius: 50%;
		margin-right: 20rpx;
		flex-shrink: 0;
	}

	.info {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.name {
		font-size: $fs-lg;
		font-weight: 600;
		color: $text-main;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sub {
		margin-top: 8rpx;
		font-size: $fs-sm;
		color: $text-secondary;
	}

	.count {
		display: flex;
		align-items: baseline;
		margin-left: $space-sm;
	}

	.count-num {
		font-size: 38rpx;
		font-weight: 700;
		color: $brand;
	}

	.count-label {
		margin-left: 4rpx;
		font-size: $fs-xs;
		color: $text-secondary;
	}

	.empty {
		flex: 1;
		text-align: center;
		padding-top: 160rpx;
		font-size: $fs-md;
		color: $text-secondary;
	}
</style>
