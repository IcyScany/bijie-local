<template>
	<view class="gm-explorer">
		<map
			id="localMap"
			class="map"
			style="width: 100%; height: 100%; z-index: 1; pointer-events: auto;"
			:longitude="center.longitude"
			:latitude="center.latitude"
			:scale="scale"
			:markers="displayMarkers"
			:enable-scroll="interactive"
			:enable-zoom="interactive"
			:enable-rotate="false"
			:enable-overlooking="false"
			show-location
			@markertap="onMarkerTap"
			@tap="onMapTap"
			@regionchange="onRegionChange"
		></map>

		<!-- 底部列表面板 -->
		<DragSheet
			:visible="!hideSheet"
			v-model:height="bottomSheetHeight"
			v-model:expanded="sheetExpanded"
			:min-height="sheetRange.min"
			:max-height="sheetRange.max"
			@sheet-touchstart="onSheetTouchStart"
			@sheet-touchend="onSheetTouchEnd"
		>
			<template #header>
				<!-- 列表标题 + 排序 -->
				<view class="gm-list-header">
					<text class="gm-list-title">{{ categoryLabel }}</text>
					<view class="gm-list-sort">
						<text class="gm-sort-item" :class="{ 'gm-sort-active': sortBy === 'rating' }" @click.stop="toggleSort('rating')">评分</text>
						<text class="gm-sort-item" :class="{ 'gm-sort-active': sortBy === 'distance' }" @click.stop="toggleSort('distance')">距离</text>
					</view>
				</view>
			</template>

			<view v-if="loading" class="gm-skeleton">
				<view v-for="n in 3" :key="n" class="gm-place-item-card">
					<view class="gm-place-card-main">
						<view class="gm-place-card-content">
							<view class="gm-sk-line" style="width: 55%; height: 32rpx;"></view>
							<view class="gm-sk-line" style="width: 45%; height: 22rpx; margin-top: 16rpx;"></view>
							<view class="gm-sk-line" style="width: 85%; height: 24rpx; margin-top: 12rpx;"></view>
						</view>
						<view class="gm-place-card-image gm-sk-thumb"></view>
					</view>
				</view>
			</view>
			<view v-else-if="!list.length" class="gm-empty" style="padding-bottom: 60rpx;">
				<text style="font-size: 56rpx; opacity: 0.3; margin-bottom: 24rpx;">📭</text>
				<text class="gm-empty-title">暂无地点</text>
				<text class="gm-empty-subtitle">请到地点管理添加</text>
			</view>
			<scroll-view v-else style="flex: 1; height: 0; min-height: 0;" :scroll-y="sheetExpanded" :lower-threshold="80" @scrolltolower="emit('loadmore')">
				<view class="gm-place-list">
					<view
						v-for="(spot, index) in list"
						:key="spot._id"
						class="gm-place-item-card"
						@click="emit('select', index, 'list')"
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
		</DragSheet>

		<!-- 回到我的位置：跟随面板上移，最高停在 80vh，之后被面板遮住 -->
		<view
			v-if="showLocate"
			class="gm-locate-btn"
			:style="{ bottom: locateBottom, zIndex: 100 }"
			@click="emit('locate')"
		>
			<app-icon icon="myLocation" :width="38" :height="38" color="inherit" :custom-style="{ display: 'block' }" />
		</view>
	</view>
</template>

<script setup>
	import { ref, computed, onMounted, watch, nextTick, getCurrentInstance } from 'vue'
	import { getTypeLabel } from '@/utils/placeTypes.js'
	import AppLoading from '@/components/AppLoading.vue'
	import AppIcon from '@/components/AppIcon.vue'
	import DragSheet from '@/components/DragSheet.vue'

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
		// 是否显示「回到我的位置」按钮
		showLocate: {
			type: Boolean,
			default: false
		},
		// 初始是否仅展示头部（收起状态）
		defaultCollapsed: {
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
		// 外部（详情面板）拖动中：临时禁用地图手势，避免触摸穿透到底层地图
		externalTouching: {
			type: Boolean,
			default: false
		}
	})

	const emit = defineEmits(['select', 'loadmore', 'update:sortBy', 'mapTap', 'locate'])

	const instance = getCurrentInstance()

	const bottomSheetHeight = ref(50)
	const sheetExpanded = ref(false)

	// 面板高度范围（vh）：最低≈一条数据，最高到筛选栏下方
	const sheetRange = ref({ min: 24, max: 88 })

	// 定位按钮位置：跟随面板顶部，最多停在 80vh
	const locateBottom = computed(() => Math.min(bottomSheetHeight.value + 2, 70) + 'vh')

	onMounted(() => {
		measureSheetRange()
		// 初始仅展示头部；否则保持半屏并收敛到可拖范围
		bottomSheetHeight.value = props.defaultCollapsed ?
			sheetRange.value.min :
			Math.min(sheetRange.value.max, Math.max(sheetRange.value.min, bottomSheetHeight.value))
	})

	// 计算可拖范围：最高不超过「筛选栏下方」
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
		sheetRange.value.max = Math.round(topbarMaxVh * 10) / 10
		sheetRange.value.min = Math.min(Math.round(minVh * 10) / 10, sheetRange.value.max - 5)
	}

	// 展开到半屏（列表不足半屏时也按半屏展示）
	function expandToHalf() {
		bottomSheetHeight.value = Math.min(sheetRange.value.max, Math.max(sheetRange.value.min, 50))
	}

	// 分类切换（标题变化）时展开到半屏
	watch(() => props.categoryLabel, () => {
		expandToHalf()
	})

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

	const interactive = computed(() => !sheetTouching.value && !props.externalTouching)

	// 点击标记时会连带触发地图 tap，记录时间避免刚选中就被关闭
	let markerTappedAt = 0

	function onMarkerTap(e) {
		markerTappedAt = Date.now()
		emit('select', e.detail.markerId, 'map')
	}

	// 点击地图空白处（用于关闭详情弹层）
	function onMapTap() {
		if (Date.now() - markerTappedAt < 350) return
		emit('mapTap')
	}

	// 放大地图到一定级别时，marker 常显名称
	const NAME_MIN_SCALE = 15
	const currentScale = ref(props.scale || 13)
	const showMarkerName = computed(() => currentScale.value >= NAME_MIN_SCALE)

	// 按当前缩放级别计算去重网格步长（度）：缩小时网格大、更多点合并
	function gridStep(scale) {
		const s = Number.isFinite(scale) && scale > 0 ? scale : 13
		return (40 * 360) / (256 * Math.pow(2, s))
	}

	// 低于该缩放级别时，相近地点中随机一个显示为圆点
	const CLUSTER_MAX_SCALE = 15

	const displayMarkers = computed(() => {
		const list = props.markers || []
		// 放大到阈值以上：完整 marker（名称按缩放级别常显）
		if (currentScale.value >= CLUSTER_MAX_SCALE) {
			const showName = showMarkerName.value
			return list.map(m => {
				if (!m) return m
				const copy = Object.assign({}, m, {
					zIndex: 999
				})
				delete copy.callout
				if (showName && m.title) {
					copy.label = {
						content: m.title,
						color: '#202124',
						fontSize: 13,
						anchorX: 0,
						anchorY: -58,
						borderWidth: 0,
						borderRadius: 8,
						bgColor: 'rgba(255,255,255,0.92)',
						padding: 4,
						textAlign: 'center'
					}
				} else {
					delete copy.label
				}
				return copy
			})
		}
		// 缩小状态：相近地点中随机选一个显示为圆点，其余保持正常 marker
		const step = gridStep(currentScale.value)
		const groups = {}
		list.forEach((m, i) => {
			if (!m) return
			const key = Math.round(m.longitude / step) + ',' + Math.round(m.latitude / step)
			if (!groups[key]) groups[key] = []
			groups[key].push(i)
		})
		const dotIndexes = {}
		Object.keys(groups).forEach(key => {
			const arr = groups[key]
			if (arr.length > 1) {
				dotIndexes[arr[Math.floor(Math.random() * arr.length)]] = true
			}
		})
		return list.map((m, i) => {
			if (!m) return m
			if (dotIndexes[i]) {
				return {
					id: m.id,
					longitude: m.longitude,
					latitude: m.latitude,
					type: m.type,
					iconPath: `/static/markers/dot_${m.type || 'other'}.png`,
					width: 12,
					height: 12,
					zIndex: 0,
					anchor: {
						x: 0.5,
						y: 0.5
					}
				}
			}
			const copy = Object.assign({}, m, {
				zIndex: 999
			})
			delete copy.callout
			return copy
		})
	})

	// 初始 scale 变化（如定位到地点）时同步
	watch(() => props.scale, (v) => {
		if (Number.isFinite(v)) currentScale.value = v
	})

	function onRegionChange(e) {
		const detail = e && e.detail
		// 仅在地图移动/缩放结束时读取（begin 时 scale 尚未更新）
		if (detail && detail.type && detail.type !== 'end') return
		const s = detail && Number(detail.scale)
		if (Number.isFinite(s) && s > 0) {
			currentScale.value = s
			return
		}
		// 兜底：从 MapContext 读取当前缩放级别
		if (!instance) return
		uni.createMapContext('localMap', instance.proxy).getScale({
			success: (res) => {
				const v = res && Number(res.scale)
				if (Number.isFinite(v) && v > 0) currentScale.value = v
			}
		})
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

	/* 回到我的位置：白色圆角方块按钮（层级低于面板，便于被面板遮住） */
	.gm-locate-btn {
		position: fixed;
		right: 24rpx;
		z-index: 100;
		width: 72rpx;
		height: 72rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: #FFFFFF;
		border-radius: 20rpx;
		box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.18);
	}

	/* 列表骨架屏：与真实卡片结构一致 */
	.gm-sk-line,
	.gm-sk-thumb {
		background: linear-gradient(90deg, #F1F3F4 25%, #E8EAED 37%, #F1F3F4 63%);
		background-size: 400% 100%;
		animation: gm-sk-shimmer 1.4s ease infinite;
	}

	.gm-sk-line {
		border-radius: 8rpx;
	}

	@keyframes gm-sk-shimmer {
		0% {
			background-position: 100% 0;
		}

		100% {
			background-position: 0 0;
		}
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
