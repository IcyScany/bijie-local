<template>
	<view class="gm-page">
		<!-- 地图 + 列表 -->
		<MapExplorer
			:center="center"
			:scale="scale"
			:markers="markers"
			:list="filteredSpots"
			:loading="loading"
			:loading-more="loadingMore"
			:has-more="hasMore"
			:image-map="imageMap"
			:category-label="categoryLabel"
			:user-location="userLocation"
			v-model:sort-by="sortBy"
			:disabled="detailVisible"
			@select="focusSpot"
			@loadmore="loadMore"
		/>

		<!-- 搜索 + 分类 -->
		<MapSearchBar
			:categories="categories"
			v-model:category="category"
			v-model:keyword="searchKeyword"
		/>

		<!-- 地点详情（含写评价、反馈） -->
		<SpotDetailSheet
			:visible="detailVisible"
			:spot="currentSpot"
			:rating="currentRating"
			:images="currentImages"
			:comments="comments"
			:comments-loading="commentsLoading"
			:has-coord="hasCoord"
			:avatar-map="commentAvatarMap"
			@close="closeDetail"
			@preview="previewImage"
			@route="goHere"
			@comment-added="onCommentAdded"
		/>
	</view>
</template>

<script setup>
	import { ref, computed } from 'vue'
	import { onShow } from '@dcloudio/uni-app'
	import { ensureLogin, getUserInfo, getToken, isAuthError, relogin } from '@/utils/auth.js'
	import { resolveCloudFiles } from '@/utils/cloudFile.js'
	import { getMapCategories } from '@/utils/placeTypes.js'
	import MapExplorer from './components/MapExplorer.vue'
	import MapSearchBar from './components/MapSearchBar.vue'
	import SpotDetailSheet from './components/SpotDetailSheet.vue'

	const favoriteObj = uniCloud.importObject('favorite-spots', {
		customUI: true
	})

	const commentObj = uniCloud.importObject('spot-comments', {
		customUI: true
	})

	// 顶部筛选：全部 + 由 place-types.json 控制的类型（map !== false 才会显示）
	const categories = [{
		label: '全部',
		value: 'all'
	}, ...getMapCategories()]

	const category = ref('all')
	const searchKeyword = ref('')

	// 当前分类标题
	const categoryLabel = computed(() => {
		const found = categories.find(c => c.value === category.value)
		return found ? found.label : '全部'
	})

	// 列表排序：default | rating | distance
	const sortBy = ref('default')
	// 用户当前位置（用于距离排序/展示）
	const userLocation = ref(null)

	const scale = ref(13)
	const center = ref({
		longitude: 105.2844,
		latitude: 27.2987
	})
	const centerName = ref('贵州省毕节市七星关区')
	const loading = ref(false)
	const loadingMore = ref(false)
	const detailVisible = ref(false)
	const currentSpot = ref({})
	const spots = ref([])
	const imageMap = ref({})
	const pageSize = 50
	const page = ref(1)
	const hasMore = ref(true)
	const SPOTS_CACHE_KEY = 'spots_cache'

	// 评价
	const comments = ref([])
	const commentsTotal = ref(0)
	const commentsAvg = ref(0)
	const commentsLoaded = ref(false)
	const commentsLoading = ref(false)
	const commentAvatarMap = ref({})

	const uploadingImage = ref(false)

	const filteredSpots = computed(() => {
		const kw = searchKeyword.value.trim().toLowerCase()
		const list = spots.value.filter(item => {
			if (category.value !== 'all' && item.type !== category.value) return false
			if (!kw) return true
			const text = `${item.name || ''} ${item.address || ''} ${item.remark || ''}`.toLowerCase()
			return text.indexOf(kw) !== -1
		})
		if (sortBy.value === 'rating') {
			return list.slice().sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0))
		}
		if (sortBy.value === 'distance') {
			return list.slice().sort((a, b) => {
				const da = distanceOf(a)
				const db = distanceOf(b)
				if (da == null && db == null) return 0
				if (da == null) return 1
				if (db == null) return -1
				return da - db
			})
		}
		return list
	})

	// 两点球面距离（米）
	function haversine(lat1, lon1, lat2, lon2) {
		const R = 6371000
		const toRad = d => (d * Math.PI) / 180
		const dLat = toRad(lat2 - lat1)
		const dLon = toRad(lon2 - lon1)
		const a = Math.sin(dLat / 2) ** 2 +
			Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
		return 2 * R * Math.asin(Math.sqrt(a))
	}

	// 地点到当前位置的距离（米），无定位或无坐标返回 null
	function distanceOf(spot) {
		const loc = userLocation.value
		if (!loc || !spot) return null
		const lat = Number(spot.latitude)
		const lon = Number(spot.longitude)
		if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
		return haversine(loc.latitude, loc.longitude, lat, lon)
	}

	// 获取用户当前位置
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

	const currentImages = computed(() => {
		const imgs = Array.isArray(currentSpot.value.images) ? currentSpot.value.images : []
		return imgs.map(id => imageMap.value[id] || '').filter(url => !!url)
	})

	const hasCoord = computed(() => {
		const longitude = Number(currentSpot.value.longitude)
		const latitude = Number(currentSpot.value.latitude)
		return Number.isFinite(longitude) && Number.isFinite(latitude)
	})

	const markers = computed(() => {
		const result = []
		filteredSpots.value.forEach((spot, index) => {
			const longitude = Number(spot.longitude)
			const latitude = Number(spot.latitude)
			if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
				return
			}
			result.push({
				id: index,
				longitude,
				latitude,
				title: spot.name,
				width: 26,
				height: 26,
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
		fetchUserLocation()
		loadSpots()
		checkProfile()
	})

	// 首次进入提示完善头像昵称（仅提示一次）
	async function checkProfile() {
		try {
			await ensureLogin()
		} catch (e) {
			return
		}
		if (uni.getStorageSync('profile_prompted')) return
		const info = getUserInfo()
		const name = String(info.nickname || '')
		if (name && !/^用户.{4}$/.test(name)) return
		uni.setStorageSync('profile_prompted', true)
		uni.showModal({
			title: '完善资料',
			content: '设置头像和昵称，让贡献记录更清晰',
			confirmText: '去设置',
			success: (res) => {
				if (res.confirm) {
					uni.switchTab({
						url: '/pages/mine/mine'
					})
				}
			}
		})
	}

	// 批量把地点图片的 fileID 转成可访问链接
	async function resolveSpotImages(list) {
		const ids = []
		;(list || []).forEach(spot => {
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

	// 评分（已随地点列表一起返回）
	function ratingOf(spot) {
		return {
			avg: spot && spot.rating ? spot.rating : 0,
			count: spot && spot.rating_count ? spot.rating_count : 0
		}
	}

	const currentRating = computed(() => {
		if (commentsLoaded.value) {
			return {
				avg: commentsAvg.value,
				count: commentsTotal.value
			}
		}
		return ratingOf(currentSpot.value)
	})

	function readCache() {
		try {
			const cache = uni.getStorageSync(SPOTS_CACHE_KEY)
			if (cache && Array.isArray(cache.list)) {
				return cache.list
			}
		} catch (e) {}
		return []
	}

	function writeCache(list) {
		try {
			uni.setStorageSync(SPOTS_CACHE_KEY, {
				ts: Date.now(),
				list
			})
		} catch (e) {}
	}

	function fetchSpots(pageNo) {
		return favoriteObj.getList({
			status: 'approved',
			withRating: true,
			page: pageNo,
			pageSize
		})
	}

	// 拉取已通过审核的地点：先用缓存秒出，再拉首屏
	async function loadSpots() {
		if (!spots.value.length) {
			const cached = readCache()
			if (cached.length) {
				spots.value = cached
				resolveSpotImages(cached)
			}
		}
		loading.value = !spots.value.length
		try {
			const res = await fetchSpots(1)
			const list = res.list || []
			spots.value = list
			page.value = 1
			hasMore.value = list.length < (res.total || 0)
			resolveSpotImages(list)
			writeCache(list)
		} catch (err) {
			if (!spots.value.length) {
				const msg = (err && (err.errMsg || err.message)) || '地点加载失败'
				uni.showToast({
					title: msg,
					icon: 'none'
				})
			}
		} finally {
			loading.value = false
		}
	}

	// 列表滚动到底部加载下一页
	async function loadMore() {
		if (loading.value || loadingMore.value || !hasMore.value) return
		loadingMore.value = true
		try {
			const next = page.value + 1
			const res = await fetchSpots(next)
			const list = res.list || []
			if (list.length) {
				spots.value = spots.value.concat(list)
				page.value = next
				resolveSpotImages(list)
			}
			hasMore.value = spots.value.length < (res.total || 0)
		} catch (e) {
		} finally {
			loadingMore.value = false
		}
	}

	// 定位到选中地点并弹出详情
	function focusSpot(index) {
		const spot = filteredSpots.value[index]
		if (!spot) return
		const longitude = Number(spot.longitude)
		const latitude = Number(spot.latitude)
		if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
			center.value = {
				longitude,
				latitude
			}
			centerName.value = spot.name
			scale.value = 16
		}
		const missing = (spot.images || []).some(id => id && !imageMap.value[id])
		if (missing) {
			resolveSpotImages([spot])
		}
		currentSpot.value = spot
		detailVisible.value = true
		comments.value = []
		commentsTotal.value = 0
		commentsAvg.value = 0
		commentsLoaded.value = false
		loadComments()
	}

	function closeDetail() {
		detailVisible.value = false
	}

	function previewImage(index) {
		uni.previewImage({
			urls: currentImages.value,
			current: index
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

	// 在当前页为地点补充图片
	function chooseSpotImages() {
		const spot = currentSpot.value
		if (!spot || !spot._id) return
		const count = Math.max(1, 9 - ((spot.images && spot.images.length) || 0))
		uni.chooseImage({
			count,
			sizeType: ['compressed'],
			sourceType: ['album', 'camera'],
			success: (res) => {
				uploadSpotImages(res.tempFilePaths)
			}
		})
	}

	async function uploadSpotImages(filePaths) {
		if (uploadingImage.value) return
		const spot = currentSpot.value
		if (!spot || !spot._id) return
		try {
			await ensureLogin()
		} catch (e) {
			uni.showToast({
				title: (e && e.message) || '登录失败',
				icon: 'none'
			})
			return
		}
		const spotId = spot._id
		uploadingImage.value = true
		uni.showLoading({
			title: '上传中...'
		})
		try {
			const ids = []
			for (let i = 0; i < filePaths.length; i++) {
				const filePath = filePaths[i]
				const ext = (filePath.split('.').pop() || 'jpg').toLowerCase()
				const cloudPath = 'spots/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext
				const up = await uniCloud.uploadFile({
					filePath,
					cloudPath
				})
				ids.push(up.fileID)
			}
			let res
			try {
				res = await favoriteObj.addImages(spotId, ids, getToken())
			} catch (err) {
				if (!isAuthError(err)) throw err
				await relogin()
				res = await favoriteObj.addImages(spotId, ids, getToken())
			}
			const merged = (res && res.images) || ids
			if (currentSpot.value && currentSpot.value._id === spotId) {
				currentSpot.value.images = merged
			}
			const inList = spots.value.find(s => s._id === spotId)
			if (inList) {
				inList.images = merged
			}
			await resolveSpotImages([{
				images: merged
			}])
			uni.showToast({
				title: '已添加图片',
				icon: 'success'
			})
		} catch (err) {
			uni.showToast({
				title: (err && (err.errMsg || err.message)) || '上传失败',
				icon: 'none'
			})
		} finally {
			uploadingImage.value = false
			uni.hideLoading()
		}
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
</script>
