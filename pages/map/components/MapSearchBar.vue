<template>
	<view class="gm-map-topbar-host">
		<!-- 搜索框 -->
		<view class="gm-search-wrap">
			<view class="gm-search" @click="enterSearch">
				<app-icon class="gm-search-leading" icon="exploreNearby" color="inherit" width="44rpx" height="44rpx" :custom-style="{ display: 'block', alignSelf: 'center', marginLeft: '-4rpx', filter: 'brightness(0.4)' }" />
				<input
					class="gm-search-input"
					placeholder="在此处搜索"
					:value="keyword"
					:focus="mainFocus"
					@input="onInput"
					@focus="enterSearch"
					@confirm="onConfirm"
				/>
				<app-icon class="gm-search-trailing" icon="search" color="inherit" width="40rpx" height="40rpx" :custom-style="{ display: 'block', alignSelf: 'center', filter: 'brightness(0.4)' }" />
			</view>
		</view>

		<!-- 分类过滤（横向滚动、区域 100% 宽、仅左侧留一点 padding） -->
		<scroll-view scroll-x :show-scrollbar="false" style="white-space: nowrap;">
			<view class="gm-flex" style="gap: 12rpx; padding: 6rpx 0 12rpx 16rpx;">
				<view
					v-for="item in categories"
					:key="item.value"
					class="gm-chip gm-chip-map"
					:class="{ 'gm-chip-selected': category === item.value }"
					@click="emit('update:category', item.value)"
				>
					<view v-if="item.icon" class="gm-chip-icon">
						<app-icon
							:icon="item.icon"
							width="32rpx"
							height="32rpx"
							:color="category === item.value ? 'inherit' : 'primary'"
							:custom-style="category === item.value ? { opacity: 1, filter: 'brightness(2)' } : { opacity: 1, filter: 'brightness(0.12) hue-rotate(210deg) saturate(2)' }"
						/>
					</view>
					{{ item.label }}
				</view>
			</view>
		</scroll-view>

		<!-- 搜索状态（全屏） -->
		<view v-if="searching" class="gm-search-page">
			<view class="gm-search-page-bar">
				<view class="gm-search gm-search-page-box">
					<app-icon class="gm-search-leading" icon="arrowBack" color="inherit" width="40rpx" height="40rpx" :custom-style="{ display: 'block', alignSelf: 'center', filter: 'brightness(0.4)' }" clickable @click="exitSearch" />
					<input
						class="gm-search-input"
						:value="keyword"
						:focus="searchFocus"
						placeholder="在此处搜索"
						confirm-type="search"
						@input="onInput"
						@confirm="onSearchConfirm"
					/>
					<app-icon v-if="trimmedKeyword" class="gm-search-trailing" icon="cancel" color="inherit" width="40rpx" height="40rpx" :custom-style="{ display: 'block', alignSelf: 'center', filter: 'brightness(0.4)' }" clickable @click="clearKeyword" />
				</view>
			</view>

			<scroll-view class="gm-search-page-list" scroll-y>
				<!-- 最近（搜索历史） -->
				<view v-if="!trimmedKeyword && searchHistory.length" class="gm-search-recent">
					<view class="gm-search-recent-head">
						<text class="gm-search-recent-title">最近</text>
						<text class="gm-search-recent-clear" @click="clearHistory">清空</text>
					</view>
					<view
						v-for="kw in searchHistory"
						:key="'his-' + kw"
						class="gm-search-row gm-search-row-plain"
						@click="fillKeyword(kw)"
					>
						<view class="gm-search-icon gm-search-icon-gray gm-search-recent-icon">
							<app-icon icon="schedule" size="lg" color="inherit" :custom-style="{ display: 'block', filter: 'brightness(0.35)' }" />
						</view>
						<view class="gm-search-row-main">
							<text class="gm-search-row-title">{{ kw }}</text>
						</view>
					</view>
				</view>

				<!-- 匹配的地点 -->
				<view
					v-for="item in matchedSpots"
					:key="item._id"
					class="gm-search-row"
					@click="pickSpot(item)"
				>
					<view class="gm-search-pin">
						<view class="gm-search-pin-circle">
							<app-icon icon="locationOn" size="lg" color="inherit" :custom-style="{ display: 'block', filter: 'brightness(0)' }" />
						</view>
						<text v-if="item.distanceText" class="gm-search-pin-dist">{{ item.distanceText }}</text>
					</view>
					<view class="gm-search-row-main">
						<text class="gm-search-row-title">{{ item.name }}</text>
						<text v-if="item.address" class="gm-search-row-sub">{{ item.address }}</text>
					</view>
					<app-icon class="gm-search-row-fill" icon="arrowInsert" size="lg" color="inherit" :custom-style="{ opacity: 1, filter: 'brightness(0.35)' }" clickable @click.stop="fillKeyword(item.name)" />
				</view>

				<!-- 无结果 -->
				<view v-if="trimmedKeyword && !searchLoading && !matchedSpots.length" class="gm-search-empty">暂无结果</view>
			</scroll-view>
		</view>
	</view>
</template>

<script setup>
	import { ref, computed, watch, onMounted } from 'vue'
	import { formatDistance } from '@/utils/geo.js'
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
		},
		// 当前地图地点列表（用于搜索建议与匹配）
		spots: {
			type: Array,
			default: () => []
		},
		// 用户当前位置（用于计算距离）
		userLocation: {
			type: Object,
			default: null
		}
	})

	const emit = defineEmits(['update:category', 'update:keyword', 'select-spot', 'search-state'])

	// 搜索历史（本地存储）
	const SEARCH_HISTORY_KEY = 'map_search_history'
	const SEARCH_HISTORY_MAX = 20
	const searchHistory = ref([])

	// 搜索状态
	const searching = ref(false)
	const mainFocus = ref(false)
	const searchFocus = ref(false)

	const trimmedKeyword = computed(() => String(props.keyword || '').trim())

	const spotsObj = uniCloud.importObject('spots', {
		customUI: true
	})

	// 搜索结果（后端返回）
	const searchResults = ref([])
	const searchLoading = ref(false)
	let searchTimer = null

	// 关键词变化时防抖请求后端
	watch(trimmedKeyword, () => {
		if (searchTimer) clearTimeout(searchTimer)
		searchTimer = setTimeout(fetchSearch, 300)
	})

	// 请求后端按关键词搜索已通过审核的地点（有定位时按距离排序）
	async function fetchSearch() {
		const kw = trimmedKeyword.value
		if (!kw) {
			searchResults.value = []
			return
		}
		searchLoading.value = true
		try {
			const loc = props.userLocation
			const res = await spotsObj.getList({
				status: 'approved',
				keyword: kw,
				withRating: true,
				page: 1,
				pageSize: 20,
				sort: loc ? 'distance' : undefined,
				latitude: loc ? loc.latitude : undefined,
				longitude: loc ? loc.longitude : undefined
			})
			searchResults.value = (res.list || []).map(s => ({
				_id: s._id,
				name: s.name || '',
				address: s.address || '',
				distanceText: formatDistance(s._distance, { meterUnit: 'm', kmUnit: 'km', unitSpace: ' ' }),
				spot: s
			}))
			// 开发期排查：确认关键词与返回数量
			console.log('[search] keyword=', kw, 'total=', res.total, 'list=', searchResults.value.length)
		} catch (e) {
			searchResults.value = []
		} finally {
			searchLoading.value = false
		}
	}

	// 供父页面在离开时收起搜索状态
	defineExpose({
		closeSearch: () => closeSearch()
	})

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

	function clearHistory() {
		if (!searchHistory.value.length) return
		uni.showModal({
			title: '清空搜索记录',
			content: '确定清空全部搜索记录吗？',
			success: (res) => {
				if (!res.confirm) return
				searchHistory.value = []
				persistHistory()
			}
		})
	}

	// 进入搜索状态：原输入框失焦、搜索页输入框聚焦，并通知父级隐藏地点列表
	function enterSearch() {
		searching.value = true
		mainFocus.value = false
		searchFocus.value = true
		emit('search-state', true)
		if (trimmedKeyword.value) {
			fetchSearch()
		}
	}

	// 关闭搜索状态
	function closeSearch() {
		searching.value = false
		searchFocus.value = false
		emit('search-state', false)
	}

	function exitSearch() {
		closeSearch()
	}

	function onInput(e) {
		emit('update:keyword', e.detail.value)
	}

	function clearKeyword() {
		emit('update:keyword', '')
	}

	function onConfirm() {
		const kw = trimmedKeyword.value
		if (!kw) return
		saveHistory(kw)
	}

	// 确认搜索：保存历史、关闭搜索状态并触发地图列表筛选
	function onSearchConfirm() {
		const kw = trimmedKeyword.value
		if (!kw) return
		saveHistory(kw)
		closeSearch()
		emit('update:keyword', kw)
	}

	// 把建议文本回填到输入框
	function fillKeyword(text) {
		emit('update:keyword', text)
	}

	// 选中某个地点：关闭搜索并通知地图定位到该地点
	function pickSpot(item) {
		if (!item) return
		saveHistory(item.name)
		closeSearch()
		emit('select-spot', item.spot)
	}

	// 匹配的地点（后端搜索结果；名称/地址包含关键词）
	const matchedSpots = computed(() => {
		return searchResults.value
	})

	// 关键词建议：搜索历史 + 地点名称片段
</script>

<style lang="scss" scoped>
	.gm-map-topbar-host {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 10;
		/* 左右内边距交给搜索框自己（margin），分类滚动区才能占满 100% 宽 */
		padding: 16rpx 0;
	}

	.gm-search-wrap {
		position: relative;
		z-index: 12;
		margin: 0 16rpx 12rpx;
	}

	/* 搜索状态页（全屏，层级最高，覆盖地图/列表/tabbar 之上） */
	.gm-search-page {
		position: fixed;
		left: 0;
		right: 0;
		top: 0;
		bottom: 0;
		z-index: 9999;
		display: flex;
		flex-direction: column;
		background-color: #FFFFFF;
	}

	.gm-search-page-bar {
		padding: 16rpx;
	}

	.gm-search-page-box {
		width: 100%;
		box-sizing: border-box;
		background-color: #F1F3F4;
		box-shadow: none;
	}

	.gm-search-leading {
		flex-shrink: 0;
		margin-right: 12rpx;
	}

	.gm-search-trailing {
		flex-shrink: 0;
		margin-left: 12rpx;
	}

	.gm-search-clear {
		font-size: 36rpx;
		line-height: 1;
		color: #5F6368;
		padding: 0 8rpx;
	}

	.gm-search-page-list {
		flex: 1;
		height: 0;
		min-height: 0;
	}

	.gm-search-row {
		display: flex;
		align-items: center;
		padding: 20rpx 28rpx;
		border-bottom: 1rpx solid #E8EAED;
	}

	.gm-search-row:active {
		background-color: #F8F9FA;
	}

	/* 最近（搜索历史） */
	.gm-search-recent-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16rpx 28rpx 8rpx;
	}

	.gm-search-recent-title {
		font-size: 24rpx;
		color: #5F6368;
	}

	.gm-search-recent-clear {
		font-size: 24rpx;
		color: #007B8B;
	}

	.gm-search-row-plain {
		border-bottom: none;
		padding: 18rpx 28rpx;
	}

	.gm-search-recent-icon {
		flex-shrink: 0;
		margin-right: 24rpx;
	}

	/* 无结果 */
	.gm-search-empty {
		padding: 120rpx 0;
		text-align: center;
		font-size: 28rpx;
		color: #80868B;
	}

	.gm-search-icon {
		width: 48rpx;
		height: 48rpx;
		border-radius: 50%;
		flex-shrink: 0;
		margin-right: 24rpx;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.gm-search-icon-accent {
		background-color: #FCE8E6;
	}

	.gm-search-icon-gray {
		background-color: #F1F3F4;
	}

	/* 地点行：图钉 + 下方距离 */
	.gm-search-pin {
		width: 72rpx;
		flex-shrink: 0;
		margin-right: 12rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.gm-search-pin-circle {
		width: 48rpx;
		height: 48rpx;
		border-radius: 50%;
		background-color: #F1F3F4;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.gm-search-pin-dist {
		margin-top: 4rpx;
		font-size: 20rpx;
		color: #5F6368;
		white-space: nowrap;
	}

	.gm-search-row-main {
		flex: 1;
		min-width: 0;
	}

	.gm-search-row-title {
		display: block;
		font-size: 30rpx;
		color: #202124;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.gm-search-row-sub {
		display: block;
		margin-top: 6rpx;
		font-size: 24rpx;
		color: #5F6368;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.gm-search-row-fill {
		flex-shrink: 0;
		margin-left: 12rpx;
		padding: 6rpx;
	}
</style>
