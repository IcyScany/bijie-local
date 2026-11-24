<template>
	<view class="page">
		<view class="tabs">
			<view class="tab" :class="{ 'tab-active': activeType === 'all' }" @click="switchType('all')">全部</view>
			<view class="tab" :class="{ 'tab-active': activeType === 'new' }" @click="switchType('new')">补充新地点</view>
			<view class="tab" :class="{ 'tab-active': activeType === 'update' }" @click="switchType('update')">地点更新</view>
			<view class="tab" :class="{ 'tab-active': activeType === 'image' }" @click="switchType('image')">补充图片</view>
		</view>

		<PointsRuleCard />

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
				<view class="item-foot">
					<text class="item-date">{{ formatDate(item.create_date) }}</text>
					<text class="item-points" :class="'item-points-' + (item.status || 'pending')">{{ pointsText(item) }}</text>
				</view>
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
				<scroll-view class="detail-body" scroll-y>
				<view class="detail-row">
					<text class="detail-label">地点</text>
					<text class="detail-value">{{ detailItem.spot_name || '—' }}</text>
				</view>
				<view class="detail-row">
					<text class="detail-label">类型</text>
					<text class="detail-value">{{ reportTypeText(detailItem.report_type) }}</text>
				</view>
				<view class="detail-row">
					<text class="detail-label">积分</text>
					<text class="detail-value detail-points" :class="'item-points-' + (detailItem.status || 'pending')">{{ pointsText(detailItem) }}</text>
				</view>
				<view v-if="detailItem.report_reason" class="detail-row">
					<text class="detail-label">说明</text>
					<text class="detail-value">{{ detailItem.report_reason }}</text>
				</view>
				<view v-if="detailSpot && detailSpot.address" class="detail-row">
					<text class="detail-label">地址</text>
					<text class="detail-value">{{ detailSpot.address }}</text>
				</view>
				<view v-if="detailSpot && detailSpot.remark" class="detail-row">
					<text class="detail-label">备注</text>
					<text class="detail-value">{{ detailSpot.remark }}</text>
				</view>
				<view v-if="detailImages.length" class="detail-row">
					<text class="detail-label">图片</text>
					<view class="detail-images">
						<image
							v-for="(img, i) in detailImages"
							:key="i"
							class="detail-image"
							:src="img"
							mode="aspectFill"
							@click="previewDetailImage(i)"
						/>
					</view>
				</view>
				<view v-if="detailSpot && detailSpot.reject_reason" class="detail-row">
					<text class="detail-label">驳回原因</text>
					<text class="detail-value detail-reject">{{ detailSpot.reject_reason }}</text>
				</view>
				<view class="detail-row">
					<text class="detail-label">提交时间</text>
					<text class="detail-value">{{ formatDate(detailItem.create_date) }}</text>
				</view>
				<view v-if="detailItem.update_date" class="detail-row">
					<text class="detail-label">更新时间</text>
					<text class="detail-value">{{ formatDate(detailItem.update_date) }}</text>
				</view>
				</scroll-view>
				<view class="detail-btn" @click="closeDetail">关闭</view>
			</view>
		</view>
	</view>
</template>

<script setup>
	import { ref } from 'vue'
	import { onShow } from '@dcloudio/uni-app'
	import { ensureLogin, getToken, isAuthError, relogin } from '@/utils/auth.js'
	import { resolveCloudFiles } from '@/utils/cloudFile.js'
	import PointsRuleCard from '@/components/PointsRuleCard.vue'

	const spotsObj = uniCloud.importObject('spots', {
		customUI: true
	})

	const list = ref([])
	const loading = ref(false)
	const activeType = ref('all')

	// 详情弹窗当前项
	const detailItem = ref(null)
	// 详情弹窗关联的提交/地点信息（异步加载）
	const detailSpot = ref(null)
	const detailImages = ref([])

	// 打开详情：拉取关联提交的完整内容（地址、备注、图片、驳回原因）
	async function openDetail(item) {
		detailItem.value = item
		detailSpot.value = null
		detailImages.value = []
		if (!item || !item.spot_id) return
		try {
			const res = await spotsObj.getDetail(item.spot_id)
			if (detailItem.value !== item) return
			const spot = (res && res.data) || null
			detailSpot.value = spot
			// 优先使用服务端解析好的图片链接，回退到客户端解析
			if (spot && Array.isArray(spot.image_urls) && spot.image_urls.length) {
				detailImages.value = spot.image_urls.slice()
			} else {
				const ids = (spot && Array.isArray(spot.images)) ? spot.images : []
				if (ids.length) {
					const map = await resolveCloudFiles(ids)
					if (detailItem.value !== item) return
					detailImages.value = ids.map(id => map[id] || '').filter(Boolean)
				}
			}
		} catch (e) {
			detailSpot.value = null
		}
	}

	function closeDetail() {
		detailItem.value = null
		detailSpot.value = null
		detailImages.value = []
	}

	// 预览详情图片
	function previewDetailImage(index) {
		if (!detailImages.value.length) return
		uni.previewImage({
			urls: detailImages.value,
			current: index
		})
	}

	function reportTypeText(type) {
		if (type === 'update') return '更新反馈'
		if (type === 'image') return '补充图片'
		return '新增地点'
	}

	function pointsText(item) {
		return '+' + (Number(item && item.points) || 0) + ' 分'
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

	.item-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: 10rpx;
	}

	.item-date {
		font-size: $fs-xs;
		color: $text-secondary;
	}

	.item-points {
		font-size: $fs-sm;
		font-weight: 600;
	}

	.item-points-approved {
		color: $brand;
	}

	.item-points-pending {
		color: $text-placeholder;
	}

	.item-points-rejected {
		color: $text-disabled;
		text-decoration: line-through;
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
		max-height: 82vh;
		display: flex;
		flex-direction: column;
		background-color: $bg-card;
		border-radius: $radius-lg;
		padding: $space-lg;
		box-sizing: border-box;
		box-shadow: $shadow-card;
	}

	.detail-body {
		flex: 1;
		min-height: 0;
		max-height: 64vh;
	}

	.detail-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-shrink: 0;
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

	.detail-points {
		font-weight: 600;
	}

	.detail-reject {
		color: $danger;
	}

	.detail-images {
		flex: 1;
		display: flex;
		flex-wrap: wrap;
		gap: 12rpx;
	}

	.detail-image {
		width: 140rpx;
		height: 140rpx;
		border-radius: $radius-sm;
		background-color: $bg-fill;
	}

	.detail-btn {
		flex-shrink: 0;
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
