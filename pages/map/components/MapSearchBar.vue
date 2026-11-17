<template>
	<view class="gm-map-topbar-host">
		<!-- 搜索历史遮罩 -->
		<view v-if="historyVisible" class="gm-history-mask" @click="closeHistory"></view>

		<!-- 搜索框 -->
		<view class="gm-search-wrap">
			<view class="gm-search" style="box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.15);">
				<input
					class="gm-search-input"
					placeholder="在此处搜索"
					:value="keyword"
					style="padding-left: 16rpx;"
					@input="onInput"
					@focus="onFocus"
					@confirm="onConfirm"
				/>
				<app-icon icon="search" size="lg" style="margin-left: 12rpx;" />
			</view>

			<!-- 搜索历史 -->
			<view v-if="historyVisible && searchHistory.length" class="gm-search-history">
				<view class="gm-search-history-head">
					<text>搜索历史</text>
					<text class="gm-search-history-clear" @click="clearHistory">清空</text>
				</view>
				<view
					v-for="(kw, index) in searchHistory"
					:key="kw"
					class="gm-search-history-item"
					@click="applyHistory(kw)"
				>
					<app-icon icon="search" size="md" />
					<text class="gm-search-history-text">{{ kw }}</text>
					<text class="gm-search-history-del" @click.stop="removeHistory(index)">✕</text>
				</view>
			</view>
		</view>

		<!-- 分类过滤 -->
		<scroll-view scroll-x :show-scrollbar="false" style="white-space: nowrap;">
			<view class="gm-flex" style="gap: 8rpx; padding-right: 16rpx;">
				<view
					v-for="item in categories"
					:key="item.value"
					class="gm-chip gm-chip-map"
					:class="{ 'gm-chip-selected': category === item.value }"
					@click="emit('update:category', item.value)"
				>
					<app-icon
						v-if="item.icon"
						:icon="item.icon"
						size="md"
						:color="category === item.value ? 'inherit' : 'primary'"
						:custom-style="category === item.value ? { opacity: 1, filter: 'brightness(2)' } : {}"
					/>
					{{ item.label }}
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<script setup>
	import { ref, onMounted } from 'vue'
	import AppIcon from '@/components/AppIcon.vue'

	const props = defineProps({
		categories: {
			type: Array,
			default: () => []
		},
		category: {
			type: String,
			default: 'all'
		},
		keyword: {
			type: String,
			default: ''
		}
	})

	const emit = defineEmits(['update:category', 'update:keyword'])

	// 搜索历史（本地存储）
	const SEARCH_HISTORY_KEY = 'map_search_history'
	const SEARCH_HISTORY_MAX = 20
	const searchHistory = ref([])
	const historyVisible = ref(false)

	onMounted(loadHistory)

	function loadHistory() {
		try {
			const list = uni.getStorageSync(SEARCH_HISTORY_KEY)
			if (Array.isArray(list)) {
				searchHistory.value = list.filter(item => !!item)
			}
		} catch (e) {}
	}

	function persistHistory() {
		try {
			uni.setStorageSync(SEARCH_HISTORY_KEY, searchHistory.value)
		} catch (e) {}
	}

	function saveHistory(keyword) {
		const kw = String(keyword || '').trim()
		if (!kw) return
		const list = searchHistory.value.filter(item => item !== kw)
		list.unshift(kw)
		searchHistory.value = list.slice(0, SEARCH_HISTORY_MAX)
		persistHistory()
	}

	function onInput(e) {
		emit('update:keyword', e.detail.value)
		historyVisible.value = false
	}

	function onFocus() {
		historyVisible.value = searchHistory.value.length > 0
	}

	function onConfirm() {
		const kw = String(props.keyword || '').trim()
		if (!kw) return
		saveHistory(kw)
		historyVisible.value = false
	}

	function applyHistory(keyword) {
		emit('update:keyword', keyword)
		saveHistory(keyword)
		historyVisible.value = false
	}

	function removeHistory(index) {
		searchHistory.value.splice(index, 1)
		persistHistory()
		if (!searchHistory.value.length) {
			historyVisible.value = false
		}
	}

	function clearHistory() {
		searchHistory.value = []
		persistHistory()
		historyVisible.value = false
	}

	function closeHistory() {
		historyVisible.value = false
	}
</script>

<style lang="scss" scoped>
	.gm-map-topbar-host {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 10;
		padding: 16rpx;
	}

	/* 搜索历史遮罩 */
	.gm-history-mask {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 9;
	}

	.gm-search-wrap {
		position: relative;
		z-index: 12;
		margin-bottom: 12rpx;
	}

	/* 搜索历史下拉 */
	.gm-search-history {
		position: absolute;
		top: calc(100% + 4rpx);
		left: 0;
		right: 0;
		background-color: #FFFFFF;
		border-radius: 16rpx;
		box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.15);
		padding: 8rpx 0;
		overflow: hidden;
		z-index: 30;
	}

	.gm-search-history-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12rpx 24rpx;
		font-size: 24rpx;
		color: #80868B;
	}

	.gm-search-history-clear {
		color: #1A73E8;
	}

	.gm-search-history-item {
		display: flex;
		align-items: center;
		padding: 20rpx 24rpx;
	}

	.gm-search-history-item:active {
		background-color: #F1F3F4;
	}

	.gm-search-history-text {
		flex: 1;
		margin-left: 16rpx;
		font-size: 28rpx;
		color: #202124;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.gm-search-history-del {
		padding: 0 8rpx;
		font-size: 28rpx;
		color: #9AA0A6;
		line-height: 1;
	}
</style>
