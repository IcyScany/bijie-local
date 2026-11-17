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
			:disabled="detailVisible"
			@select="focusSpot"
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
			@close="closeDetail"
			@preview="previewImage"
			@route="goHere"
			@comment-added="onCommentAdded"
			@favorite="toggleFavorite"
		/>
	</view>
</template>

<script setup>
	import { ref, computed } from 'vue'
	import { onShow } from '@dcloudio/uni-app'
	import { ensureLogin, getToken, isAuthError, relogin } from '@/utils/auth.js'
	import { resolveCloudFiles } from '@/utils/cloudFile.js'
	import { getTypeIcon } from '@/utils/placeTypes.js'
	import MapExplorer from '@/pages/map/components/MapExplorer.vue'
	import SpotDetailSheet from '@/pages/map/components/SpotDetailSheet.vue'

	const spotFavObj = uniCloud.importObject('spot-favorites', {
		customUI: true
	})

	const commentObj = uniCloud.importObject('spot-comments', {
		customUI: true
	})

	const favorites = ref([])
	const imageMap = ref({})
	const loading = ref(false)
	const sortBy = ref('default')
	const userLocation = ref(null)

	// 容器高度取窗口可视高度，避免 100vh 偏差在底部露出地图
	const pageHeight = ref(0)
	const pageStyle = computed(() => pageHeight.value ? { height: pageHeight.value + 'px' } : {})

	const scale = ref(13)
	const center = ref({
		longitude: 105.2844,
		latitude: 27.2987
	})

	const detailVisible = ref(false)
	const currentSpot = ref({})
	const selectedMarkerIndex = ref(-1)

	// 评价
	const comments = ref([])
	const commentsTotal = ref(0)
	const commentsAvg = ref(0)
	const commentsLoaded = ref(false)
	const commentsLoading = ref(false)
	const commentAvatarMap = ref({})

	const currentImages = computed(() => {
		const imgs = Array.isArray(currentSpot.value.images) ? currentSpot.value.images : []
		return imgs.map(id => imageMap.value[id] || '').filter(url => !!url)
	})

	const hasCoord = computed(() => {
		const longitude = Number(currentSpot.value.longitude)
		const latitude = Number(currentSpot.value.latitude)
		return Number.isFinite(longitude) && Number.isFinite(latitude)
	})

	const currentRating = computed(() => {
		if (commentsLoaded.value) {
			return {
				avg: commentsAvg.value,
				count: commentsTotal.value
			}
		}
		return {
			avg: Number(currentSpot.value.rating) || 0,
			count: Number(currentSpot.value.rating_count) || 0
		}
	})

	const markers = computed(() => {
		const result = []
		favorites.value.forEach((spot, index) => {
			const longitude = Number(spot.longitude)
			const latitude = Number(spot.latitude)
			if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
				return
			}
			const active = index === selectedMarkerIndex.value
			result.push({
				id: index,
				longitude,
				latitude,
				title: spot.name,
				iconPath: `/static/markers/${getTypeIcon(spot.type)}.png`,
				width: active ? 48 : 36,
				height: active ? 48 : 36,
				anchor: {
					x: 0.5,
					y: 0.92
				},
				callout: {
					content: spot.name,
					color: '#1f2329',
					fontSize: 12,
					borderRadius: 8,
					borderWidth: 0,
					bgColor: '#ffffff',
					padding: 8,
					display: 'BYCLICK',
					textAlign: 'center'
				}
			})
		})
		return result
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

	async function resolveSpotImages(list) {
		const ids = []
		;(list || []).forEach(spot => {
			;(spot.images || []).forEach(id => {
				if (id && ids.indexOf(id) === -1) {
					ids.push(id)
				}
			})
		})
		if (!ids.length) return
		const map = await resolveCloudFiles(ids)
		imageMap.value = Object.assign({}, imageMap.value, map)
	}

	function focusSpot(index) {
		const spot = favorites.value[index]
		if (!spot) return
		const longitude = Number(spot.longitude)
		const latitude = Number(spot.latitude)
		if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
			center.value = {
				longitude,
				latitude
			}
			scale.value = 16
		}
		const missing = (spot.images || []).some(id => id && !imageMap.value[id])
		if (missing) {
			resolveSpotImages([spot])
		}
		currentSpot.value = spot
		selectedMarkerIndex.value = index
		detailVisible.value = true
		comments.value = []
		commentsTotal.value = 0
		commentsAvg.value = 0
		commentsLoaded.value = false
		loadComments()
	}

	function closeDetail() {
		detailVisible.value = false
		selectedMarkerIndex.value = -1
	}

	function previewImage(index) {
		uni.previewImage({
			urls: currentImages.value,
			current: index
		})
	}

	function goHere() {
		const spot = currentSpot.value
		const longitude = Number(spot.longitude)
		const latitude = Number(spot.latitude)
		if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
			uni.showToast({
				title: '该地点缺少坐标',
				icon: 'none'
			})
			return
		}
		uni.openLocation({
			longitude,
			latitude,
			name: spot.name,
			address: spot.address || spot.remark || '',
			scale: 18
		})
	}

	async function resolveCommentAvatars(items) {
		const ids = []
		;(items || []).forEach(item => {
			if (item.avatar && ids.indexOf(item.avatar) === -1) {
				ids.push(item.avatar)
			}
		})
		if (!ids.length) return
		const map = await resolveCloudFiles(ids)
		commentAvatarMap.value = Object.assign({}, commentAvatarMap.value, map)
	}

	async function loadComments() {
		const spot = currentSpot.value
		if (!spot || !spot._id) return
		const id = spot._id
		commentsLoading.value = true
		try {
			const res = await commentObj.getList({
				spot_id: id,
				page: 1,
				pageSize: 20
			})
			if (!currentSpot.value || currentSpot.value._id !== id) return
			const data = res.data || {}
			comments.value = data.list || []
			commentsTotal.value = data.total || 0
			commentsAvg.value = data.avg || 0
			commentsLoaded.value = true
			resolveCommentAvatars(comments.value)
		} catch (e) {
		} finally {
			commentsLoading.value = false
		}
	}

	function onCommentAdded(item) {
		if (!item) return
		const prevCount = commentsTotal.value
		const prevAvg = commentsAvg.value
		comments.value.unshift(item)
		commentsTotal.value = prevCount + 1
		commentsAvg.value = Math.round(((prevAvg * prevCount + Number(item.rating || 0)) / commentsTotal.value) * 10) / 10
		commentsLoaded.value = true
		const spot = currentSpot.value
		if (spot) {
			spot.rating = commentsAvg.value
			spot.rating_count = commentsTotal.value
		}
		resolveCommentAvatars([item])
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
