<template>
	<view class="gm-explorer">
		<map
			id="localMap"
			class="map"
			style="width: 100%; height: 100%; z-index: 1; pointer-events: auto;"
			:longitude="center.longitude"
			:latitude="center.latitude"
			:scale="scale"
			:markers="markers"
			:enable-scroll="interactive"
			:enable-zoom="interactive"
			:enable-rotate="interactive"
			:enable-overlooking="interactive"
			show-location
			@markertap="onMarkerTap"
		></map>

		<!-- 底部列表面板 - 固定定位容器 -->
		<view
			class="gm-bottom-sheet-wrapper"
			:class="{ 'gm-dragging': isDragging }"
			:style="{ height: bottomSheetHeight + 'vh', display: hideSheet ? 'none' : 'flex' }"
			@touchstart="onSheetTouchStart"
			@touchend="onSheetTouchEnd"
			@touchcancel="onSheetTouchEnd"
		>
			<view class="gm-bottom-sheet">
				<!-- 可拖动的顶部把手 -->
				<view
					class="gm-bottom-sheet-handle"
					@touchstart="onDragStart"
					@touchmove="onDragMove"
					@touchend="onDragEnd"
				>
					<view class="gm-bottom-sheet-bar"></view>
				</view>

				<!-- 列表标题 + 排序 -->
				<view class="gm-list-header">
					<text class="gm-list-title">{{ categoryLabel }}</text>
					<view class="gm-list-sort">
						<text class="gm-sort-item" :class="{ 'gm-sort-active': sortBy === 'rating' }" @click="toggleSort('rating')">评分</text>
						<text class="gm-sort-item" :class="{ 'gm-sort-active': sortBy === 'distance' }" @click="toggleSort('distance')">距离</text>
					</view>
				</view>

				<AppSkeleton v-if="loading" :count="3" />
				<view v-else-if="!list.length" class="gm-empty" style="padding-bottom: 60rpx;">
					<text style="font-size: 56rpx; opacity: 0.3; margin-bottom: 24rpx;">📭</text>
					<text class="gm-empty-title">暂无地点</text>
					<text class="gm-empty-subtitle">请到地点管理添加</text>
				</view>
				<scroll-view v-else style="flex: 1; height: 0; min-height: 0;" scroll-y :lower-threshold="80" @scrolltolower="emit('loadmore')">
					<view class="gm-place-list">
						<view
							v-for="(spot, index) in list"
							:key="spot._id"
							class="gm-place-item-card"
							@click="emit('select', index)"
						>
							<!-- 主体：信息 + 图片 -->
							<view class="gm-place-card-main">
								<!-- 左侧：信息区 -->
								<view class="gm-place-card-content">
									<!-- 地点名称 -->
									<text class="gm-place-name">{{ spot.name }}</text>

									<!-- 地点信息：评分 · 分类 · 距离 -->
									<view class="gm-place-info-row" style="margin-bottom: 8rpx;">
										<template v-if="ratingOf(spot).count">
											<text class="gm-place-rating-num">{{ ratingOf(spot).avg }}</text>
											<view class="gm-place-rating-stars">
												<view class="gm-place-rating-stars-bg">★★★★★</view>
												<view class="gm-place-rating-stars-fill" :style="{ width: starPercent(ratingOf(spot).avg) }">★★★★★</view>
											</view>
											<text class="gm-place-rating-count">({{ formatCount(ratingOf(spot).count) }})</text>
										</template>
									<text v-else class="gm-place-dim">无评价</text>
									<text class="gm-place-dim" style="margin: 0 4rpx;">·</text>
									<text class="gm-place-dim">{{ typeText(spot.type) }}</text>
									<template v-if="distanceText(spot)">
										<text class="gm-place-dim" style="margin: 0 4rpx;">·</text>
										<text class="gm-place-dim">{{ distanceText(spot) }}</text>
									</template>
									</view>

									<!-- 地址 -->
									<text class="gm-place-address" v-if="spot.address">{{ spot.address }}</text>
								</view>

								<!-- 右侧：图片区 -->
								<view class="gm-place-card-image">
									<image
										:src="thumbUrl(spot) || '/static/img/default_spot.png'"
										mode="aspectFill"
										lazy-load
										style="width: 100%; height: 100%; border-radius: 12rpx;"
									></image>
								</view>
							</view>

							<!-- 最新一条评价（占满卡片宽度） -->
							<view v-if="spot.latest_comment && spot.latest_comment.content" class="gm-place-comment">
								<view class="gm-place-comment-avatar">
									<image src="/static/img/default_user.png" mode="aspectFill" style="width: 100%; height: 100%; border-radius: 50%;" />
								</view>
								<text class="gm-place-comment-text">"{{ spot.latest_comment.content }}"</text>
							</view>
						</view>

						<view class="gm-text-center gm-py-sm">
							<AppLoading v-if="loadingMore" compact text="加载中..." />
							<view v-else-if="!hasMore" class="gm-list-end">
								<view class="gm-list-end-line"></view>
								<text class="gm-list-end-text">已经到底啦</text>
								<view class="gm-list-end-line"></view>
							</view>
						</view>
					</view>
				</scroll-view>
			</view>
		</view>
	</view>
</template>

<script setup>
	import { ref, computed, onMounted, watch, nextTick, getCurrentInstance } from 'vue'
	import { getTypeLabel } from '@/utils/placeTypes.js'
	import AppSkeleton from '@/components/AppSkeleton.vue'
	import AppLoading from '@/components/AppLoading.vue'

	const props = defineProps({
		center: {
			type: Object,
			default: () => ({})
		},
		scale: {
			type: Number,
			default: 13
		},
		markers: {
			type: Array,
			default: () => []
		},
		list: {
			type: Array,
			default: () => []
		},
		loading: {
			type: Boolean,
			default: false
		},
		loadingMore: {
			type: Boolean,
			default: false
		},
		hasMore: {
			type: Boolean,
			default: true
		},
		imageMap: {
			type: Object,
			default: () => ({})
		},
		categoryLabel: {
			type: String,
			default: '全部'
		},
		hideSheet: {
			type: Boolean,
			default: false
		},
		sortBy: {
			type: String,
			default: 'default'
		},
		userLocation: {
			type: Object,
			default: null
		},
		// 详情/评价/反馈等弹层打开时禁用地图手势
		disabled: {
			type: Boolean,
			default: false
		}
	})

	const emit = defineEmits(['select', 'loadmore', 'update:sortBy'])

	const instance = getCurrentInstance()

	// 底部面板拖动功能
	const bottomSheetHeight = ref(50)
	const dragStartY = ref(0)
	const dragStartHeight = ref(50)
	const isDragging = ref(false)

	// 面板高度范围（vh）：最低≈一条数据，最高到筛选栏下方
	const sheetRange = { min: 24, max: 88 }

	onMounted(() => {
		measureSheetRange()
		bottomSheetHeight.value = Math.min(sheetRange.max, Math.max(sheetRange.min, bottomSheetHeight.value))
	})

	// 计算可拖范围：最高不超过「筛选栏下方」，且不超过「列表内容本身高度」
	function measureSheetRange() {
		let info = {}
		try {
			info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()
		} catch (e) {
			info = {}
		}
		const winH = info.windowHeight || 667
		const winW = info.windowWidth || 375
		const rpxToPx = winW / 750
		// 顶部搜索框 + 分类筛选（含内边距）估算高度
		const topbarPx = 210 * rpxToPx
		const topbarMaxVh = Math.max(30, ((winH - topbarPx) / winH) * 100)
		// 只露出「把手 + 分类标题」的高度
		const headerPx = 110 * rpxToPx
		const minVh = Math.max(8, (headerPx / winH) * 100)
		sheetRange.max = Math.round(topbarMaxVh * 10) / 10
		sheetRange.min = Math.min(Math.round(minVh * 10) / 10, sheetRange.max - 5)

		// 上限再受「列表内容高度」限制：拖动不超过列表本身高度
		if (!instance) return
		uni.createSelectorQuery().in(instance.proxy)
			.select('.gm-place-list')
			.boundingClientRect(rect => {
				if (rect && rect.height) {
					const contentVh = ((rect.height + headerPx) / winH) * 100
					const capped = Math.max(sheetRange.min + 5, Math.min(sheetRange.max, contentVh))
					sheetRange.max = Math.round(capped * 10) / 10
					bottomSheetHeight.value = Math.min(sheetRange.max, Math.max(sheetRange.min, bottomSheetHeight.value))
				}
			})
			.exec()
	}

	// 列表数据变化后重新测量内容高度
	watch(() => props.list.length, () => {
		nextTick(() => measureSheetRange())
	})

	// App 端 map 是原生组件，层级最高，覆盖其上的列表滑动时手势会穿透到地图
	// 手指落在面板内时关闭地图手势，避免带动地图
	const sheetTouching = ref(false)
	function onSheetTouchStart() {
		sheetTouching.value = true
	}
	function onSheetTouchEnd() {
		sheetTouching.value = false
	}

	const interactive = computed(() => !sheetTouching.value && !props.disabled)

	function onMarkerTap(e) {
		emit('select', e.detail.markerId)
	}

	function typeText(type) {
		return getTypeLabel(type)
	}

	// 评分占比（用于半星裁剪）
	function starPercent(avg) {
		const v = Number(avg) || 0
		return Math.max(0, Math.min(100, (v / 5) * 100)) + '%'
	}

	// 数量千分位
	function formatCount(n) {
		return String(Number(n) || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
	}

	// 距离文案（米/公里）
	function distanceText(spot) {
		const loc = props.userLocation
		if (!loc || !spot) return ''
		const lat = Number(spot.latitude)
		const lon = Number(spot.longitude)
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) return ''
		const R = 6371000
		const toRad = d => (d * Math.PI) / 180
		const dLat = toRad(lat - loc.latitude)
		const dLon = toRad(lon - loc.longitude)
		const a = Math.sin(dLat / 2) ** 2 +
			Math.cos(toRad(loc.latitude)) * Math.cos(toRad(lat)) * Math.sin(dLon / 2) ** 2
		const dist = 2 * R * Math.asin(Math.sqrt(a))
		if (dist < 1000) return Math.round(dist) + '米'
		return (dist / 1000).toFixed(1) + '公里'
	}

	// 排序切换（再次点击取消排序）
	function toggleSort(key) {
		emit('update:sortBy', props.sortBy === key ? 'default' : key)
	}

	function thumbUrl(spot) {
		const first = spot && Array.isArray(spot.images) ? spot.images[0] : ''
		return first ? (props.imageMap[first] || '') : ''
	}

	function ratingOf(spot) {
		return {
			avg: spot && spot.rating ? spot.rating : 0,
			count: spot && spot.rating_count ? spot.rating_count : 0
		}
	}

	// 窗口高度只需取一次，避免拖动时每帧同步调用原生 API 造成卡顿
	let windowHeight = 0
	let viewportMeasured = false
	function devHeight() {
		if (viewportMeasured && windowHeight) return windowHeight
		let h = 0
		try {
			const info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()
			h = info.windowHeight || 0
		} catch (err) {
			h = 0
		}
		if (h) {
			windowHeight = h
			viewportMeasured = true
		}
		return h || 667
	}

	function onDragStart(e) {
		isDragging.value = true
		dragStartY.value = e.touches[0].clientY
		dragStartHeight.value = bottomSheetHeight.value
		devHeight()
		e.stopPropagation()
	}

	function onDragMove(e) {
		if (!isDragging.value) return

		e.preventDefault()
		e.stopPropagation()

		// 只在拖动把手时处理
		const touch = e.touches[0]
		const currentY = touch.clientY
		const deltaY = dragStartY.value - currentY

		// 转换像素差值为vh单位的变化
		// screenHeight = 100vh，所以 1vh = screenHeight/100 像素
		const deltaVh = (deltaY / devHeight()) * 100

		// 计算新高度
		let newHeight = dragStartHeight.value + deltaVh

		// 限制范围：最低一条数据高度，最高到筛选栏下方
		newHeight = Math.max(sheetRange.min, Math.min(sheetRange.max, newHeight))

		bottomSheetHeight.value = newHeight
	}

	function onDragEnd(e) {
		if (!isDragging.value) return
		isDragging.value = false

		e.stopPropagation()

		// 吸附到范围内最近的档位（最低一条 / 中间 / 最高）
		const { min, max } = sheetRange
		const candidates = [min, (min + max) / 2, max]
		const height = bottomSheetHeight.value
		let nearest = candidates[0]
		let best = Infinity
		candidates.forEach(c => {
			const d = Math.abs(c - height)
			if (d < best) {
				best = d
				nearest = c
			}
		})
		bottomSheetHeight.value = Math.round(nearest * 10) / 10
	}
</script>

<style lang="scss" scoped>
	.gm-explorer {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* 底部面板包装容器 - 固定定位 */
	.gm-bottom-sheet-wrapper {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 100;
		pointer-events: auto;
		touch-action: manipulation;
		transition: height 150ms cubic-bezier(0.4, 0, 0.2, 1);
		will-change: height;
		display: flex;
		flex-direction: column;
	}

	/* 拖动过程中关闭过渡，避免每帧 height 过渡叠加导致掉帧 */
	.gm-bottom-sheet-wrapper.gm-dragging {
		transition: none;
		will-change: auto;
	}

	/* 列表标题 + 排序 */
	.gm-list-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4rpx 24rpx 16rpx;
	}

	.gm-list-title {
		font-size: 34rpx;
		font-weight: 700;
		color: #202124;
	}

	.gm-list-sort {
		display: flex;
		align-items: center;
		gap: 8rpx;
	}

	.gm-sort-item {
		font-size: 24rpx;
		color: #5F6368;
		padding: 6rpx 20rpx;
		border-radius: 100rpx;
		border: 1.5rpx solid #E8EAED;
		background-color: #FFFFFF;
	}

	.gm-sort-active {
		color: #FFFFFF;
		background-color: #1A73E8;
		border-color: #1A73E8;
	}

	/* 地图列表卡片样式 */
	.gm-place-item-card {
		display: flex;
		flex-direction: column;
		padding: 16rpx 16rpx;
		margin-bottom: 12rpx;
		border-radius: 16rpx;
		background-color: #FFFFFF;
		box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.08);
		cursor: pointer;
	}

	/* 卡片主体：信息 + 图片 横排 */
	.gm-place-card-main {
		display: flex;
		align-items: stretch;
	}

	.gm-place-item-card:active {
		background-color: #F8F9FA;
	}

	/* 卡片左侧内容区 */
	.gm-place-card-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		overflow: hidden;
		padding-right: 16rpx;
	}

	/* 卡片右侧图片区 */
	.gm-place-card-image {
		width: 120rpx;
		height: 120rpx;
		flex-shrink: 0;
		border-radius: 12rpx;
		overflow: hidden;
		background-color: #F1F3F4;
	}

	/* 列表评分：数字 + 五星（支持半星）+ 数量 */
	.gm-place-info-row {
		font-size: 22rpx;
	}

	.gm-place-info-row .gm-place-dim {
		font-size: 22rpx;
	}

	.gm-place-rating-num {
		flex-shrink: 0;
		font-size: 22rpx;
		font-weight: 600;
		color: #202124;
		margin-right: 6rpx;
	}

	.gm-place-rating-stars {
		position: relative;
		display: inline-block;
		flex-shrink: 0;
		font-size: 20rpx;
		line-height: 1;
		letter-spacing: 2rpx;
		margin-right: 6rpx;
	}

	.gm-place-rating-stars-bg {
		color: #DADCE0;
	}

	.gm-place-rating-stars-fill {
		position: absolute;
		top: 0;
		left: 0;
		white-space: nowrap;
		overflow: hidden;
		color: #FBBC04;
	}

	.gm-place-rating-count {
		flex-shrink: 0;
		font-size: 22rpx;
		color: #5F6368;
	}

	/* 卡片底部最新评价 */
	.gm-place-comment {
		display: flex;
		align-items: center;
		margin-top: 0rpx;
	}

	.gm-place-comment-avatar {
		width: 42rpx;
		height: 42rpx;
		border-radius: 50%;
		background-color: #1A73E8;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		font-size: 0;
		flex-shrink: 0;
		margin-right: 8rpx;
	}

	.gm-place-comment-text {
		flex: 1;
		font-size: 26rpx;
		color: #5F6368;
		line-height: 1.5;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		overflow: hidden;
	}

	/* 列表到底提示 */
	.gm-list-end {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20rpx 0;
	}

	.gm-list-end-line {
		width: 48rpx;
		height: 1rpx;
		background-color: #E8EAED;
	}

	.gm-list-end-text {
		margin: 0 16rpx;
		font-size: 24rpx;
		color: #9AA0A6;
	}
</style>
