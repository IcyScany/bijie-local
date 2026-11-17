<template>
	<view class="page">
		<view class="tabs">
			<view class="tab" :class="{ 'tab-active': activeType === 'all' }" @click="switchType('all')">全部</view>
			<view class="tab" :class="{ 'tab-active': activeType === 'new' }" @click="switchType('new')">补充新地点</view>
			<view class="tab" :class="{ 'tab-active': activeType === 'update' }" @click="switchType('update')">地点更新</view>
		</view>

		<view v-if="loading" class="hint">加载中...</view>
		<view v-else-if="!list.length" class="hint">还没有贡献记录</view>
		<view v-else class="list">
			<view v-for="item in list" :key="item._id" class="item">
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
			submit: '提交地点'
		}
		return map[action] || '贡献'
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
</style>
