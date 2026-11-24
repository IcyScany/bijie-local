import { ref, computed } from 'vue'
import { resolveCloudFiles } from '@/utils/cloudFile.js'
import { getTypeIcon } from '@/utils/placeTypes.js'

const DEFAULT_CENTER = {
	longitude: 105.2844,
	latitude: 27.2987
}

// 地图浏览通用逻辑：选中地点、详情、评价、图片、收藏状态与标记
// options.list: 当前展示的地点列表（Ref）；options.favoriteIds: 收藏 id 列表（Ref，可选）
export function useSpotExplorer(options = {}) {
	const list = options.list
	const favoriteIds = options.favoriteIds || ref([])

	const commentObj = uniCloud.importObject('spot-comments', {
		customUI: true
	})

	const spotsObj = uniCloud.importObject('spots', {
		customUI: true
	})

	const imageMap = ref({})
	const center = ref(Object.assign({}, DEFAULT_CENTER))
	const scale = ref(13)
	const detailVisible = ref(false)
	// 详情打开时是否直接展开到最大（列表进入为 true，地图点选为 false）
	const detailFull = ref(false)
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
		const spot = currentSpot.value
		if (spot && Array.isArray(spot.image_urls) && spot.image_urls.length) {
			return spot.image_urls.slice()
		}
		const imgs = Array.isArray(spot && spot.images) ? spot.images : []
		return imgs.map(id => imageMap.value[id] || '').filter(url => !!url)
	})

	const hasCoord = computed(() => {
		const longitude = Number(currentSpot.value.longitude)
		const latitude = Number(currentSpot.value.latitude)
		return Number.isFinite(longitude) && Number.isFinite(latitude)
	})

	const isFavorite = computed(() => {
		const spot = currentSpot.value
		return !!(spot && spot._id && favoriteIds.value.indexOf(spot._id) !== -1)
	})

	const currentRating = computed(() => {
		if (commentsLoaded.value) {
			return {
				avg: commentsAvg.value,
				count: commentsTotal.value
			}
		}
		const spot = currentSpot.value
		return {
			avg: spot && spot.rating ? spot.rating : 0,
			count: spot && spot.rating_count ? spot.rating_count : 0
		}
	})

	const markers = computed(() => {
		const result = []
		const items = list.value || []
		items.forEach((spot, index) => {
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
				type: spot.type,
				iconPath: `/static/markers/${getTypeIcon(spot.type)}.png`,
				width: active ? 50 : 40,
				height: active ? 50 : 40,
				anchor: {
					x: 0.5,
					y: 0.92
				}
			})
		})
		return result
	})

	// 批量把地点图片的 fileID 转成可访问链接
	async function resolveSpotImages(items) {
		const ids = []
		;(items || []).forEach(spot => {
			(spot.images || []).forEach(id => {
				if (id && ids.indexOf(id) === -1) {
					ids.push(id)
				}
			})
		})
		if (!ids.length) return
		const map = await resolveCloudFiles(ids)
		imageMap.value = Object.assign({}, imageMap.value, map)
	}

	// 批量把评价头像的 fileID 转成可访问链接
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

	// 拉取当前地点的评价
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

	// 详情组件内发布评价后回调，更新列表与评分
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

	// 详情组件内删除评价后回调，移除列表并更新评分
	function onCommentRemoved(id) {
		if (!id) return
		const idx = comments.value.findIndex(c => c._id === id)
		if (idx === -1) return
		const removed = comments.value[idx]
		comments.value.splice(idx, 1)
		const prevTotal = commentsTotal.value
		commentsTotal.value = Math.max(0, prevTotal - 1)
		if (commentsTotal.value > 0) {
			const sum = commentsAvg.value * prevTotal - Number(removed.rating || 0)
			commentsAvg.value = Math.round((sum / commentsTotal.value) * 10) / 10
		} else {
			commentsAvg.value = 0
		}
		const spot = currentSpot.value
		if (spot) {
			spot.rating = commentsAvg.value
			spot.rating_count = commentsTotal.value
		}
	}

	function previewImage(index) {
		uni.previewImage({
			urls: currentImages.value,
			current: index
		})
	}

	function closeDetail() {
		detailVisible.value = false
		selectedMarkerIndex.value = -1
	}

	// 列表只下发了首图，打开详情时按需向云端拉取该地点的全部图片链接
	async function loadSpotImageUrls(spot) {
		if (!spot || !spot._id) return
		const id = spot._id
		try {
			const res = await spotsObj.getDetail(id)
			const data = res && res.data
			if (!data || !Array.isArray(data.image_urls)) return
			spot.image_urls = data.image_urls
			if (currentSpot.value && currentSpot.value._id === id) {
				currentSpot.value = Object.assign({}, currentSpot.value, {
					image_urls: data.image_urls
				})
			}
		} catch (e) {}
	}

	// 定位到选中地点并弹出详情；source 为 'list' 时详情展开到最大
	function focusSpot(index, source) {
		detailFull.value = source === 'list'
		const spot = (list.value || [])[index]
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
		if (!(Array.isArray(spot.image_urls) && spot.image_urls.length)) {
			loadSpotImageUrls(spot)
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

	// 调起系统地图导航到该地点
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

	return {
		imageMap,
		center,
		scale,
		detailVisible,
		detailFull,
		currentSpot,
		selectedMarkerIndex,
		comments,
		commentsTotal,
		commentsAvg,
		commentsLoaded,
		commentsLoading,
		commentAvatarMap,
		currentImages,
		hasCoord,
		currentRating,
		isFavorite,
		markers,
		resolveSpotImages,
		resolveCommentAvatars,
		loadComments,
		onCommentAdded,
		onCommentRemoved,
		previewImage,
		closeDetail,
		focusSpot,
		goHere
	}
}
