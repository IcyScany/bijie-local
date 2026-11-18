<template>
	<view class="gm-page" :style="pageStyle">
		<!-- 地图 + 收藏目录 -->
		<MapExplorer
			:center="center"
			:scale="scale"
			:markers="markers"
			:list="favorites"
			:loading="loading"
			:loading-more="false"
			:has-more="false"
			:image-map="imageMap"
			category-label="我的收藏"
			:user-location="userLocation"
			v-model:sort-by="sortBy"
			:hide-sheet="detailVisible"
			:external-touching="mapTouching"
			@select="focusSpot"
			@map-tap="closeDetail"
		/>

		<!-- 地点详情 -->
		<SpotDetailSheet
			:visible="detailVisible"
			:spot="currentSpot"
			:rating="currentRating"
			:images="currentImages"
			:comments="comments"
			:comments-loading="commentsLoading"
			:has-coord="hasCoord"
			:avatar-map="commentAvatarMap"
			:favorite="true"
			:full="detailFull"
			@close="closeDetail"
			@preview="previewImage"
			@route="goHere"
			@comment-added="onCommentAdded"
			@comment-removed="onCommentRemoved"
			@favorite="toggleFavorite"
			@sheet-touching="mapTouching = $event"
		/>
	</view>
</template>

<script setup>
	import { ref, computed } from 'vue'
	import { onShow } from '@dcloudio/uni-app'
	import { ensureLogin, getToken, isAuthError, relogin } from '@/utils/auth.js'
	import { useSpotExplorer } from '@/utils/useSpotExplorer.js'

	// 详情面板拖动中：临时禁用地图手势，避免触摸穿透
	const mapTouching = ref(false)
	import MapExplorer from '@/pages/map/components/MapExplorer.vue'
	import SpotDetailSheet from '@/pages/map/components/SpotDetailSheet.vue'

	const spotFavObj = uniCloud.importObject('spot-favorites', {
		customUI: true
	})

	const favorites = ref([])
	const loading = ref(false)
	const sortBy = ref('default')
	const userLocation = ref(null)

	// 容器高度取窗口可视高度，避免 100vh 偏差在底部露出地图
	const pageHeight = ref(0)
	const pageStyle = computed(() => pageHeight.value ? { height: pageHeight.value + 'px' } : {})

	// 地图浏览通用逻辑：选中/详情/评价/图片/标记
	const {
		imageMap,
		center,
		scale,
		detailVisible,
		detailFull,
		currentSpot,
		comments,
		commentsLoading,
		commentAvatarMap,
		currentImages,
		hasCoord,
		currentRating,
		markers,
		resolveSpotImages,
		onCommentAdded,
		onCommentRemoved,
		previewImage,
		closeDetail,
		focusSpot,
		goHere
	} = useSpotExplorer({
		list: favorites
	})

	onShow(() => {
		try {
			const info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()
			pageHeight.value = info.windowHeight || 0
		} catch (e) {}
		fetchUserLocation()
		loadFavorites()
	})

	function fetchUserLocation() {
		uni.getLocation({
			type: 'gcj02',
			success: (res) => {
				userLocation.value = {
					latitude: res.latitude,
					longitude: res.longitude
				}
			},
			fail: () => {
				userLocation.value = null
			}
		})
	}

	async function loadFavorites() {
		loading.value = !favorites.value.length
		try {
			await ensureLogin()
			const res = await spotFavObj.list(getToken())
			const list = (res && res.data) || []
			favorites.value = list
			resolveSpotImages(list)
		} catch (e) {
			favorites.value = []
		} finally {
			loading.value = false
		}
	}

	// 详情内取消收藏后从目录移除
	async function toggleFavorite() {
		const spot = currentSpot.value
		if (!spot || !spot._id) return
		const id = spot._id
		try {
			await ensureLogin()
		} catch (e) {
			uni.showToast({
				title: (e && e.message) || '登录失败',
				icon: 'none'
			})
			return
		}
		try {
			let res
			try {
				res = await spotFavObj.toggle(id, getToken())
			} catch (err) {
				if (!isAuthError(err)) throw err
				await relogin()
				res = await spotFavObj.toggle(id, getToken())
			}
			const filled = !!(res && res.data && res.data.filled)
			if (!filled) {
				const idx = favorites.value.findIndex(s => s._id === id)
				if (idx !== -1) favorites.value.splice(idx, 1)
				closeDetail()
				uni.showToast({
					title: '已取消收藏',
					icon: 'none'
				})
			}
		} catch (err) {
			uni.showToast({
				title: (err && (err.errMsg || err.message)) || '操作失败',
				icon: 'none'
			})
		}
	}
</script>
