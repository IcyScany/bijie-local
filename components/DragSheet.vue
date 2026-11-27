<template>
	<view
		v-if="visible"
		class="gm-bottom-sheet gm-drag-sheet"
		:class="{ 'gm-dragging': isDragging }"
		:style="{ height: currentHeight + 'vh' }"
		@click.stop
		@touchstart.capture="onDragStart"
		@touchmove.capture="onDragMove"
		@touchend.capture="onDragEnd"
		@touchcancel.capture="onDragEnd"
	>
		<!-- 顶部区域：把手 + 头部（从这里开始拖动总是移动面板） -->
		<view class="gm-sheet-drag-area" @click="onHeaderClick" @touchstart.capture="onHeaderTouchStart">
			<view class="gm-bottom-sheet-handle">
				<view class="gm-bottom-sheet-bar"></view>
			</view>
			<slot name="header"></slot>
		</view>

		<slot></slot>

		<!-- 拖动时铺满屏幕的透明拦截层：手指移出面板后也不会落到背后的地图上 -->
		<view
			v-if="dragShield"
			class="gm-drag-shield"
			@touchstart.stop
			@touchmove.stop="onDragMove"
			@touchend.stop="onDragEnd"
			@touchcancel.stop="onDragEnd"
		></view>
	</view>
</template>

<script setup>
	import { ref, watch, computed } from 'vue'

	const props = defineProps({
		// 是否显示面板
		visible: {
			type: Boolean,
			default: true
		},
		// 面板高度（vh，支持 v-model:height）
		height: {
			type: Number,
			default: 50
		},
		// 可拖范围（vh）：最低 / 最高
		minHeight: {
			type: Number,
			default: 8
		},
		maxHeight: {
			type: Number,
			default: 88
		},
		// 内容是否已滚动到顶部（用于决定向下拖动是滚动内容还是收起面板）
		contentAtTop: {
			type: Boolean,
			default: true
		}
	})

	const emit = defineEmits(['update:height', 'update:expanded', 'sheet-touchstart', 'sheet-touchend'])

	const currentHeight = ref(props.height)
	const isDragging = ref(false)
	// 拖动拦截层：拖动过程中铺满屏幕，避免触摸穿透到背后地图
	const dragShield = ref(false)
	let dragging = false
	let dragStarted = false
	// 本次拖动是否从「把手/头部」开始
	let fromHeader = false
	let dragStartY = 0
	let dragStartHeight = 0
	// 拖动阈值（px）：移动超过阈值才判定为拖动，避免影响点击与内容滚动
	const DRAG_THRESHOLD = 6

	// 窗口高度只需取一次，避免拖动时每帧调用原生 API
	let viewportHeight = 0
	function getViewportHeight() {
		if (viewportHeight) return viewportHeight
		try {
			const info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()
			viewportHeight = info.windowHeight || 667
		} catch (e) {
			viewportHeight = 667
		}
		return viewportHeight
	}

	function clamp(h) {
		return Math.min(props.maxHeight, Math.max(props.minHeight, h))
	}

	// 是否已展开到最大高度：未展开时拖动只用于放大，展开后交给内容滚动
	const expanded = computed(() => currentHeight.value >= props.maxHeight - 0.1)

	// 展开状态变化时同步给父组件（用于控制内容区滚动）
	watch(expanded, (v) => {
		emit('update:expanded', v)
	}, {
		immediate: true
	})

	// 外部高度变化（非拖动中）时同步
	watch(() => props.height, (v) => {
		if (!isDragging.value) {
			currentHeight.value = clamp(v)
		}
	})

	// 范围变化时收敛当前高度
	watch(() => [props.minHeight, props.maxHeight], () => {
		currentHeight.value = clamp(currentHeight.value)
	})

	function onDragStart(e) {
		dragging = true
		dragStarted = false
		fromHeader = false
		dragStartY = e.touches[0].clientY
		dragStartHeight = currentHeight.value
		getViewportHeight()
		emit('sheet-touchstart')
	}

	// 从把手/头部按下 → 本次拖动始终用于移动面板
	function onHeaderTouchStart() {
		fromHeader = true
	}

	function onDragMove(e) {
		if (!dragging) return
		const dy = dragStartY - e.touches[0].clientY
		if (expanded.value) {
			// 已展开到最大：把这一帧交给内容滚动，并重设基准，
			// 避免之后接管面板时高度从累计位移处跳变。
			const handOffToScroll = dy > 0 || (!fromHeader && !props.contentAtTop)
			if (handOffToScroll) {
				dragStartY = e.touches[0].clientY
				dragStartHeight = currentHeight.value
				return
			}
		}
		if (!dragStarted) {
			if (Math.abs(dy) < DRAG_THRESHOLD) return
			dragStarted = true
			isDragging.value = true
			dragShield.value = true
		}
		const h = dragStartHeight + (dy / getViewportHeight()) * 100
		currentHeight.value = clamp(h)
		emit('update:height', currentHeight.value)
	}

	function onDragEnd() {
		if (!dragging) return
		dragging = false
		dragShield.value = false
		emit('sheet-touchend')
		if (!dragStarted) return
		dragStarted = false
		isDragging.value = false
		// 吸附到范围内最近的档位（最低 / 中间 / 最高）
		const { minHeight, maxHeight } = props
		const candidates = [minHeight, (minHeight + maxHeight) / 2, maxHeight]
		let nearest = candidates[0]
		let best = Infinity
		candidates.forEach(c => {
			const d = Math.abs(c - currentHeight.value)
			if (d < best) {
				best = d
				nearest = c
			}
		})
		currentHeight.value = Math.round(nearest * 10) / 10
		emit('update:height', currentHeight.value)
	}

	// 点击顶部区域：在 最低 / 半屏 / 全屏 三档间切换
	// 最低 → 半屏 → 全屏 → 半屏 → 全屏 …
	function onHeaderClick() {
		if (isDragging.value) return
		const { minHeight, maxHeight } = props
		const min = minHeight
		const mid = (minHeight + maxHeight) / 2
		const max = maxHeight
		// 取当前高度最接近的档位
		const candidates = [min, mid, max]
		let nearest = candidates[0]
		let best = Infinity
		candidates.forEach(c => {
			const d = Math.abs(c - currentHeight.value)
			if (d < best) {
				best = d
				nearest = c
			}
		})
		let target
		if (nearest === min) {
			target = mid // 最低 → 半屏
		} else if (nearest === max) {
			target = mid // 全屏 → 半屏
		} else {
			target = max // 半屏 → 全屏
		}
		currentHeight.value = Math.round(clamp(target) * 10) / 10
		emit('update:height', currentHeight.value)
	}
</script>

<style lang="scss" scoped>
	/* 面板固定在底部：不使用全屏遮罩，避免触摸穿透到底层原生地图 */
	.gm-drag-sheet {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 999;
		width: 100%;
		pointer-events: auto;
		/* 允许拖动拦截层溢出面板铺满屏幕（父级 .gm-bottom-sheet 默认 overflow: hidden 会裁剪） */
		overflow: visible;
		animation: gm-slide-up 0.25s cubic-bezier(0.4, 0, 0.2, 1);
	}

	/* 拖动过程中关闭过渡，避免每帧 height 过渡叠加导致掉帧 */
	.gm-drag-sheet.gm-dragging {
		transition: none;
		will-change: auto;
		/* 去除残留 transform，保证拦截层相对视口定位 */
		animation: none;
		transform: none;
	}

	/* 拖动拦截层：拖动时铺满屏幕，手指移出面板后触摸不再落到背后的原生地图 */
	.gm-drag-shield {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 1000;
		background-color: transparent;
	}
</style>
