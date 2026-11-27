<template>
	<view class="gm-explorer">
		<map
			id="localMap"
			class="map"
			:style="{ width: '100%', height: mapHeightVh + 'vh', zIndex: 1, pointerEvents: 'auto', transition: sheetTouching ? 'none' : 'height 150ms cubic-bezier(0.4, 0, 0.2, 1)' }"
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
			@callouttap="onMarkerTap"
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
			:content-at-top="listAtTop"
			@sheet-touchstart="onSheetTouchStart"
			@sheet-touchend="onSheetTouchEnd"
		>
			<template #header>
				<!-- 列表标题 + 排序 -->
				<view class="gm-list-header" :class="{ 'gm-list-header-bordered': !listAtTop }">
					<text class="gm-list-title">{{ categoryLabel }}</text>
					<view class="gm-list-sort">
						<text class="gm-sort-item" :class="{ 'gm-sort-active': sortBy === 'rating' }" @click.stop="toggleSort('rating')">评分</text>
						<text class="gm-sort-item" :class="{ 'gm-sort-active': sortBy === 'distance' }" @click.stop="toggleSort('distance')">距离</text>
					</view>
				</view>
			</template>

			<view v-if="networkError" class="gm-net-error" @click="emit('retry')">
				<text class="gm-net-error-text">网络异常，显示的是上次数据</text>
				<text class="gm-net-error-retry">点击重试</text>
			</view>

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
			</view>
			<scroll-view v-else style="flex: 1; height: 0; min-height: 0;" :scroll-y="sheetExpanded" :lower-threshold="80" 			@scrolltolower="emit('loadmore')" @scroll="onSheetScroll" @touchstart="onSheetTouchStart" @touchend="onSheetTouchEnd" @touchcancel="onSheetTouchEnd">
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
									style="width: 120rpx; height: 120rpx; border-radius: 12rpx;"
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
	import { distanceMeters, formatDistance } from '@/utils/geo.js'
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
		// 详情面板是否打开（打开时地图按其高度收缩，且地图仍可拖动）
		detailActive: {
			type: Boolean,
			default: false
		},
		// 详情面板高度（vh）
		detailHeight: {
			type: Number,
			default: 0
		},
		// 是否处于搜索状态（搜索时地图铺满并锁死）
		searchActive: {
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
		},
		// 云端加载失败：展示重试提示条
		networkError: {
			type: Boolean,
			default: false
		}
	})

	const emit = defineEmits(['select', 'loadmore', 'update:sortBy', 'mapTap', 'locate', 'retry'])

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

	// 卡片是否正在滚动：scroll-view 的 @scroll 是自身触发的，比触摸事件更可靠。
	// 滚动期间连同触摸标志一起关闭地图手势，避免卡片滚动带偏地图。
	const sheetScrolling = ref(false)
	// 列表内容是否已滚到顶部（决定向下拖动是滚动列表还是收起面板）
	const listAtTop = ref(true)
	let scrollTimer = null
	function onSheetScroll(e) {
		const top = (e && e.detail && Number(e.detail.scrollTop)) || 0
		listAtTop.value = top <= 1
		sheetScrolling.value = true
		if (scrollTimer) clearTimeout(scrollTimer)
		scrollTimer = setTimeout(() => {
			sheetScrolling.value = false
		}, 200)
	}

	// 地图高度（vh）：保证地图底部 = 当前底层面板的顶部（两者不重叠）。
	// - 详情打开：按详情高度收缩（地图在详情上方，仍可拖动）
	// - 搜索打开：铺满（地图锁死）
	// - 否则：按列表高度收缩
	const mapHeightVh = computed(() => {
		if (props.detailActive) return 100 - props.detailHeight
		if (props.searchActive) return 100
		return 100 - bottomSheetHeight.value
	})

	// 地图手势是否可用：地图与卡片物理不重叠，卡片触摸落不到地图上，
	// 所以地图可以一直开着（拖动跟手、快划即时响应）。仅搜索时锁死。
	const interactive = computed(() => !props.searchActive)

	// 点击标记时会连带触发地图 tap，记录时间避免刚选中就被关闭
	let markerTappedAt = 0

	function onMarkerTap(e) {
		markerTappedAt = Date.now()
		emit('select', e.detail.markerId, 'map')
	}

	// 点击地图空白处：
	// - 列表展开时：先把面板收起（地图手势与面板互斥，收起后地图才可操作）
	// - 其余情况：视为关闭详情弹层
	function onMapTap() {
		if (Date.now() - markerTappedAt < 350) return
		if (!props.hideSheet && bottomSheetHeight.value > sheetRange.value.min + 0.5) {
			bottomSheetHeight.value = sheetRange.value.min
			return
		}
		emit('mapTap')
	}

	const currentScale = ref(props.scale || 13)

	// 按当前缩放级别计算去重网格步长（度）：缩小时网格大、更多点合并
	function gridStep(scale) {
		const s = Number.isFinite(scale) && scale > 0 ? scale : 13
		return (40 * 360) / (256 * Math.pow(2, s))
	}

	// 放大到该缩放级别后，代表点才附带名称
	const CLUSTER_MAX_SCALE = 15
	// 标签网格比图标网格更粗的倍数：越大标签越稀疏
	const LABEL_GRID_FACTOR = 3

	// marker 到用户位置的距离（米）
	function markerDistance(m) {
		const loc = props.userLocation
		if (!loc || !m) return null
		const d = distanceMeters(loc.latitude, loc.longitude, m.latitude, m.longitude)
		return Number.isFinite(d) ? d : null
	}

	// a 是否比 b 更适合当网格的「代表」，固定优先级：
	// 评分高 > 距离近 > 评论数多 > 名称首字母（保证同一区域内结果稳定、不随缩放跳变）
	function isBetterMarker(a, b) {
		if (!b) return true
		// 1. 评分高优先
		const ar = Number(a && a.rating) || 0
		const br = Number(b && b.rating) || 0
		if (ar !== br) return ar > br
		// 2. 距离近优先（无定位时该项跳过）
		const ad = markerDistance(a)
		const bd = markerDistance(b)
		if (ad == null && bd != null) return false
		if (ad != null && bd == null) return true
		if (ad != null && bd != null && ad !== bd) return ad < bd
		// 3. 评论数多优先
		const ac = Number(a && a.rating_count) || 0
		const bc = Number(b && b.rating_count) || 0
		if (ac !== bc) return ac > bc
		// 4. 名称排序
		return String((a && a.title) || '') < String((b && b.title) || '')
	}

	// 按网格抽稀：每个网格单元只保留一个代表点（完整图标/名称），其余为圆点。
	// 用 floor 生成「嵌套网格」：缩放时单元只细分、不平移，代表点保持稳定
	// （只会随放大越来越多，不会先显示后消失）。
	// candidates：可选的候选下标数组（用于在"已是完整图标"的点里再抽一层）
	function pickGridRepresentatives(list, step, candidates) {
		const groups = {}
		const indexes = candidates || list.map((_, i) => i)
		indexes.forEach(i => {
			const m = list[i]
			if (!m) return
			const key = Math.floor(m.longitude / step) + ',' + Math.floor(m.latitude / step)
			if (!groups[key]) groups[key] = []
			groups[key].push(i)
		})
		const result = {}
		Object.keys(groups).forEach(key => {
			const arr = groups[key]
			let best = -1
			arr.forEach(i => {
				if (best === -1) {
					best = i
					return
				}
				if (isBetterMarker(list[i], list[best])) best = i
			})
			if (best !== -1) result[best] = true
		})
		return result
	}

	// 常显名称气泡对象
	function nameCallout(title) {
		return {
			content: title,
			color: '#202124',
			fontSize: 13,
			borderRadius: 8,
			bgColor: '#FFFFFF',
			padding: 4,
			textAlign: 'center',
			display: 'ALWAYS'
		}
	}

	const displayMarkers = computed(() => {
		const list = props.markers || []
		const scale = currentScale.value
		// 放大到该阈值后，代表点才附带名称
		const showLabel = scale >= CLUSTER_MAX_SCALE
		// 图标：按网格分组，每格只保留一个「代表点」为完整图标，其余为圆点。
		// 放大 → 网格变细 → 完整图标逐渐增多，直到最大级别。
		const step = gridStep(scale)
		const repIndexes = pickGridRepresentatives(list, step)
		// 标签：用更粗的网格（比图标更稀疏），且只在完整图标（代表点）上再抽一层
		let labelIndexes = null
		if (showLabel) {
			const iconRepIndexes = Object.keys(repIndexes).map(Number)
			labelIndexes = pickGridRepresentatives(list, step * LABEL_GRID_FACTOR, iconRepIndexes)
		}
		return list.map((m, i) => {
			if (!m) return m
			// 选中地点：无论是否达到阈值，都显示完整图标 + 名称
			if (m.selected) {
				const copy = Object.assign({}, m, {
					zIndex: 1000
				})
				delete copy.label
				if (m.title) {
					copy.callout = nameCallout(m.title)
				}
				return copy
			}
			if (repIndexes[i]) {
				// 代表点：完整图标（放大到阈值后附带名称）
				const copy = Object.assign({}, m, {
					zIndex: 999
				})
				delete copy.callout
				delete copy.label
				if (labelIndexes && labelIndexes[i] && m.title) {
					// 用常显气泡展示地点名称：气泡绘制在 marker 图层之上，
					// 避免被相邻 marker 遮挡（marker.label 会随 markers 数组顺序被压盖）
					copy.callout = nameCallout(m.title)
				}
				return copy
			}
			// 非代表点：圆点
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
		})
	})

	// 初始 scale 变化（如定位到地点）时同步
	watch(() => props.scale, (v) => {
		if (Number.isFinite(v)) currentScale.value = v
	})

	function onRegionChange(e) {
		const detail = e && e.detail
		const type = detail && detail.type
		// 开始拖动/缩放地图 → 自动收起面板
		// （手指落在卡片上时会关闭地图手势，这里的 begin 只可能来自真正的地图操作）
		if (type === 'begin') {
			const interacting = sheetTouching.value || props.externalTouching || sheetScrolling.value
			if (!interacting && bottomSheetHeight.value > sheetRange.value.min + 0.5) {
				bottomSheetHeight.value = sheetRange.value.min
			}
			return
		}
		// 仅在地图移动/缩放结束时读取（begin 时 scale 尚未更新）
		if (type && type !== 'end') return
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

	// 强制把地图移动/居中到指定坐标。
	// 仅改 center 属性并不可靠：用户手动拖动地图后，center 的绑定值可能未变，
	// 属性不变化原生地图就不会重新居中，表现为「点了回到当前位置没反应」。
	// 用 MapContext.moveToLocation 可无视当前状态强制移动。
	function moveToLocation(longitude, latitude) {
		if (!instance) return
		const ctx = uni.createMapContext('localMap', instance.proxy)
		if (!ctx || typeof ctx.moveToLocation !== 'function') return
		ctx.moveToLocation({
			longitude: Number(longitude),
			latitude: Number(latitude),
			success: () => {},
			fail: () => {}
		})
	}

	defineExpose({
		moveToLocation
	})

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
		const dist = distanceMeters(loc.latitude, loc.longitude, spot.latitude, spot.longitude)
		return formatDistance(dist)
	}

	// 排序切换（再次点击取消排序）
	function toggleSort(key) {
		emit('update:sortBy', props.sortBy === key ? 'default' : key)
	}

	function thumbUrl(spot) {
		if (spot && Array.isArray(spot.image_urls) && spot.image_urls.length) {
			return spot.image_urls[0]
		}
		if (spot && spot.thumb) {
			return spot.thumb
		}
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

	/* 网络异常重试提示 */
	.gm-net-error {
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 24rpx 12rpx;
		padding: 14rpx 20rpx;
		background-color: #FEF1E6;
		border-radius: 12rpx;
	}

	.gm-net-error-text {
		font-size: 24rpx;
		color: #B26A00;
	}

	.gm-net-error-retry {
		margin-left: 12rpx;
		font-size: 24rpx;
		font-weight: 600;
		color: #1A73E8;
	}

	/* 列表标题 + 排序 */
	.gm-list-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 4rpx 24rpx 16rpx;
		/* 预留 1rpx 边框，滚动时显示，避免出现时跳动 */
		border-bottom: 1rpx solid transparent;
		transition: border-color 150ms ease;
	}

	.gm-list-header-bordered {
		border-bottom-color: #E8EAED;
	}

	.gm-list-title {
		font-size: 38rpx;
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
		border-radius: 0;
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
