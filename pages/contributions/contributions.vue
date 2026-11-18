<template>
	<view class="page">
		<view class="tabs">
			<view class="tab" :class="{ 'tab-active': activeType === 'all' }" @click="switchType('all')">全部</view>
			<view class="tab" :class="{ 'tab-active': activeType === 'new' }" @click="switchType('new')">补充新地点</view>
			<view class="tab" :class="{ 'tab-active': activeType === 'update' }" @click="switchType('update')">地点更新</view>
		</view>

		<view v-if="loading" class="hint">加载中...</view>
		<view v-else-if="!list.length" class="hint">还没有共创记录</view>
		<view v-else class="list">
			<view v-for="item in list" :key="item._id" class="item" @click="openDetail(item)">
				<view class="item-head">
					<text class="item-action">{{ actionText(item.action) }}</text>
					<text class="item-status" :class="'status-' + (item.status || 'pending')">{{ statusText(item.status) }}</text>
				</view>
				<text class="item-name" v-if="item.spot_name">{{ item.spot_name }}</text>
				<text class="item-reason" v-if="item.report_reason">{{ item.report_reason }}</text>
				<text class="item-date">{{ formatDate(item.create_date) }}</text>
			</view>
			<view class="end">已经到底啦</view>
		</view>

		<!-- 共创详情 -->
		<view v-if="detailItem" class="detail-mask" @click="closeDetail">
			<view class="detail-card" @click.stop>
				<view class="detail-head">
					<text class="detail-title">{{ actionText(detailItem.action) }}</text>
					<text class="item-status" :class="'status-' + (detailItem.status || 'pending')">{{ statusText(detailItem.status) }}</text>
				</view>
				<view class="detail-row">
					<text class="detail-label">地点</text>
					<text class="detail-value">{{ detailItem.spot_name || '—' }}</text>
				</view>
				<view class="detail-row">
					<text class="detail-label">类型</text>
					<text class="detail-value">{{ detailItem.report_type === 'update' ? '更新反馈' : (detailItem.report_type === 'image' ? '补充图片' : '新增地点') }}</text>
				</view>
				<view v-if="detailItem.report_reason" class="detail-row">
					<text class="detail-label">说明</text>
					<text class="detail-value">{{ detailItem.report_reason }}</text>
				</view>
				<view class="detail-row">
					<text class="detail-label">提交时间</text>
					<text class="detail-value">{{ formatDate(detailItem.create_date) }}</text>
				</view>
				<view v-if="detailItem.update_date" class="detail-row">
					<text class="detail-label">更新时间</text>
					<text class="detail-value">{{ formatDate(detailItem.update_date) }}</text>
				</view>
				<view class="detail-btn" @click="closeDetail">关闭</view>
			</view>
		</view>
	</view>
</template>

<script setup>
	import { ref } from 'vue'
	import { onShow } from '@dcloudio/uni-app'
	import { ensureLogin, getToken, isAuthError, relogin } from '@/utils/auth.js'

	const spotsObj = uniCloud.importObject('spots', {
		customUI: true
	})

	const list = ref([])
	const loading = ref(false)
	const activeType = ref('all')

	// 详情弹窗当前项
	const detailItem = ref(null)
	function openDetail(item) {
		detailItem.value = item
	}
	function closeDetail() {
		detailItem.value = null
	}

	onShow(() => {
		load()
	})

	function switchType(type) {
		if (activeType.value === type) return
		activeType.value = type
		load()
	}

	async function load() {
		loading.value = true
		try {
			await ensureLogin()
			let res
			try {
				res = await spotsObj.listMyContributions(getToken(), { type: activeType.value })
			} catch (err) {
				if (!isAuthError(err)) throw err
				await relogin()
				res = await spotsObj.listMyContributions(getToken(), { type: activeType.value })
			}
			list.value = (res && res.list) || []
		} catch (e) {
			list.value = []
			uni.showToast({
				title: (e && (e.errMsg || e.message)) || '加载失败',
				icon: 'none'
			})
		} finally {
			loading.value = false
		}
	}

	function actionText(action) {
		const map = {
			add: '新增地点',
			update: '修改地点',
			submit: '提交地点',
			image: '补充图片'
		}
		return map[action] || '共创'
	}

	function statusText(status) {
		const map = {
			pending: '待审核',
			approved: '已通过',
			rejected: '已驳回'
		}
		return map[status] || '待审核'
	}

	function formatDate(ts) {
		if (!ts) return ''
		const d = new Date(Number(ts))
		const y = d.getFullYear()
		const m = d.getMonth() + 1
		const day = d.getDate()
		const hh = d.getHours()
		const mm = d.getMinutes()
		return y + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day) + ' ' + (hh < 10 ? '0' + hh : hh) + ':' + (mm < 10 ? '0' + mm : mm)
	}
</script>

<style lang="scss">
	.page {
		min-height: 100vh;
		background-color: $bg-page;
		padding: $space-lg;
		box-sizing: border-box;
	}

	.tabs {
		display: flex;
		background-color: $bg-card;
		border-radius: $radius-pill;
		padding: 6rpx;
		margin-bottom: $space-md;
		box-shadow: $shadow-card;
	}

	.tab {
		flex: 1;
		text-align: center;
		padding: 14rpx 0;
		font-size: $fs-sm;
		color: $text-secondary;
		border-radius: $radius-pill;
	}

	.tab-active {
		color: $text-inverse;
		background-color: $brand;
		font-weight: 600;
	}

	.hint {
		padding: 120rpx 0;
		text-align: center;
		font-size: $fs-md;
		color: $text-secondary;
	}

	.list {
		display: flex;
		flex-direction: column;
	}

	.item {
		background-color: $bg-card;
		border-radius: $radius-lg;
		padding: $space-md $space-lg;
		margin-bottom: $space-sm;
		box-shadow: $shadow-card;
	}

	.item-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.item-action {
		font-size: 30rpx;
		font-weight: 600;
		color: $text-main;
	}

	.item-status {
		font-size: $fs-xs;
		padding: 4rpx 16rpx;
		border-radius: $radius-pill;
	}

	.status-pending {
		color: #B26A00;
		background-color: #FEF1E6;
	}

	.status-approved {
		color: #188038;
		background-color: #E6F4EA;
	}

	.status-rejected {
		color: #C5221F;
		background-color: #FCE8E6;
	}

	.item-name {
		display: block;
		margin-top: 10rpx;
		font-size: $fs-md;
		color: $text-main;
	}

	.item-reason {
		display: block;
		margin-top: 6rpx;
		font-size: $fs-sm;
		color: $text-secondary;
		line-height: 1.5;
	}

	.item-date {
		display: block;
		margin-top: 10rpx;
		font-size: $fs-xs;
		color: $text-secondary;
	}

	.end {
		padding: $space-md 0;
		text-align: center;
		font-size: $fs-xs;
		color: $text-disabled;
	}

	/* 共创详情弹窗 */
	.detail-mask {
		position: fixed;
		left: 0;
		top: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(32, 33, 36, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 999;
		padding: 0 48rpx;
		box-sizing: border-box;
	}

	.detail-card {
		width: 100%;
		background-color: $bg-card;
		border-radius: $radius-lg;
		padding: $space-lg;
		box-sizing: border-box;
		box-shadow: $shadow-card;
	}

	.detail-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: $space-md;
	}

	.detail-title {
		font-size: 32rpx;
		font-weight: 600;
		color: $text-main;
	}

	.detail-row {
		display: flex;
		align-items: flex-start;
		margin-bottom: 20rpx;
	}

	.detail-label {
		width: 140rpx;
		flex-shrink: 0;
		font-size: $fs-sm;
		color: $text-secondary;
	}

	.detail-value {
		flex: 1;
		font-size: $fs-sm;
		color: $text-main;
		line-height: 1.5;
		word-break: break-all;
	}

	.detail-btn {
		margin-top: $space-md;
		height: 80rpx;
		line-height: 80rpx;
		text-align: center;
		font-size: 28rpx;
		color: $text-inverse;
		background-color: $brand;
		border-radius: $radius-pill;
	}
</style>
