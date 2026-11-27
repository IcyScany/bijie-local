<template>
	<view class="gm-page" :style="pageStyle">
		<!-- 地图 + 列表 -->
		<MapExplorer
			ref="explorerRef"
			:center="center"
			:scale="scale"
			:markers="markers"
			:list="spots"
			:loading="loading"
			:loading-more="loadingMore"
			:has-more="hasMore"
			:image-map="imageMap"
			:category-label="categoryLabel"
			:user-location="userLocation"
			:hide-sheet="detailVisible || searchActive"
			:detail-active="detailVisible"
			:detail-height="detailCoverVh"
			:search-active="searchActive"
			v-model:sort-by="sortBy"
			:default-collapsed="true"
			:show-locate="!searchActive"
			:external-touching="mapTouching"
			:network-error="loadError"
			@select="focusSpot"
			@loadmore="loadMore"
			@retry="reloadSpots"
			@map-tap="closeDetail"
			@locate="locateMe"
		/>

		<!-- 搜索 + 分类 -->
		<MapSearchBar
			ref="searchBarRef"
			:categories="categories"
			v-model:category="category"
			v-model:keyword="searchKeyword"
			:spots="spots"
			:user-location="userLocation"
			@select-spot="onSelectSpotFromSearch"
			@search-state="onSearchState"
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
			:favorite="isFavorite"
			:full="detailFull"
			@close="closeDetail"
			@preview="previewImage"
			@route="goHere"
			@comment-added="onCommentAdded"
			@comment-removed="onCommentRemoved"
			@favorite="toggleFavorite"
			@add-image="chooseSpotImages"
			@sheet-touching="mapTouching = $event"
			@cover-height="detailCoverVh = $event"
		/>
	</view>
</template>

<script setup>
	import { ref, computed, watch, nextTick } from 'vue'
	import { onShow, onHide } from '@dcloudio/uni-app'
	import { ensureLogin, getToken, isAuthError, relogin, isAdmin } from '@/utils/auth.js'
	import { getMapCategories } from '@/utils/placeTypes.js'
	import { distanceMeters } from '@/utils/geo.js'
	import { useSpotExplorer } from '@/utils/useSpotExplorer.js'
	import { compressImage, filterOversizeImages } from '@/utils/image.js'
	import MapExplorer from './components/MapExplorer.vue'
	import MapSearchBar from './components/MapSearchBar.vue'
	import SpotDetailSheet from './components/SpotDetailSheet.vue'

	const spotsObj = uniCloud.importObject('spots', {
		customUI: true
	})

	const spotFavObj = uniCloud.importObject('spot-favorites', {
		customUI: true
	})

	// 顶部筛选：全部 + 由 place-types.json 控制的类型（map !== false 才会显示）
	const categories = [{
		label: '全部',
		value: 'all'
	}, ...getMapCategories()]

	const category = ref('all')
	const searchKeyword = ref('')

	// 容器高度取窗口可视高度，避免 100vh 偏差在底部露出地图
	const pageHeight = ref(0)
	const pageStyle = computed(() => pageHeight.value ? { height: pageHeight.value + 'px' } : {})

	// 当前分类标题：全部时展示「本地生活」
	const categoryLabel = computed(() => {
		if (category.value === 'all') return '本地生活'
		const found = categories.find(c => c.value === category.value)
		return found ? found.label : '本地生活'
	})

	// 列表排序：default | rating | distance（默认按距离）
	const sortBy = ref('distance')
	// 用户当前位置（用于距离排序/展示）
	const userLocation = ref(null)
	// 首次进入是否已把地图中心定位到用户位置（仅首次，避免从其他页返回时打断浏览）
	const centeredToUser = ref(false)
	// 详情面板拖动中：临时禁用地图手势，避免触摸穿透
	const mapTouching = ref(false)
	// 地图容器引用：用于强制重新居中（回到当前位置）
	const explorerRef = ref(null)
	// 详情面板高度（vh）：详情打开时地图据此收缩，避免重叠、保证地图仍可拖动
	const detailCoverVh = ref(0)

	const loading = ref(false)
	const loadingMore = ref(false)
	// 云端加载失败标记（用于展示重试提示）
	const loadError = ref(false)

	// 收藏（云端存储）
	const favoriteIds = ref([])

	const spots = ref([])
	const pageSize = 50
	const page = ref(1)
	const hasMore = ref(true)
	const SPOTS_CACHE_KEY = 'spots_cache'
	// 缓存有效期：超过则不再作为“秒出”数据展示，避免过旧数据掩盖故障
	const CACHE_TTL = 30 * 60 * 1000

	const uploadingImage = ref(false)

	// 地图浏览通用逻辑：选中/详情/评价/图片/收藏状态/标记
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
		isFavorite,
		markers,
		resolveSpotImages,
		loadComments,
		onCommentAdded,
		onCommentRemoved,
		previewImage,
		closeDetail,
		focusSpot,
		goHere
	} = useSpotExplorer({
		list: spots,
		favoriteIds
	})

	// 毕节（七星关区）中心与判定半径：定位超出该半径视为非毕节地区（可调整）
	const BIJIE_CENTER = { longitude: 105.2844, latitude: 27.2987 }
	const BIJIE_RADIUS_M = 80000
	let offBijiePrompted = false

	function inBijie(lat, lng) {
		const d = distanceMeters(BIJIE_CENTER.latitude, BIJIE_CENTER.longitude, lat, lng)
		return d == null ? true : d <= BIJIE_RADIUS_M
	}

	// 一键回到毕节
	function goToBijie() {
		center.value = {
			longitude: BIJIE_CENTER.longitude,
			latitude: BIJIE_CENTER.latitude
		}
		scale.value = 12
	}

	// 告知用户定位不在毕节，并提供一键跳转
	function promptOffBijie() {
		uni.showModal({
			title: '当前不在毕节',
			content: '没有定位到毕节地区，已为你展示毕节的地点。是否切换到毕节？',
			confirmText: '去毕节',
			cancelText: '取消',
			success: (res) => {
				if (res.confirm) goToBijie()
			}
		})
	}

	// 搜索结果中选中地点：定位并打开详情（结果可能不在当前列表，需先并入）
	function onSelectSpotFromSearch(spot) {
		if (!spot || !spot._id) return
		let index = spots.value.findIndex(s => s._id === spot._id)
		if (index === -1) {
			spots.value = spots.value.concat([spot])
			index = spots.value.length - 1
		}
		focusSpot(index, 'list')
	}

	// 搜索栏引用：离开页面时收起搜索
	const searchBarRef = ref(null)
	// 是否处于搜索状态（搜索时隐藏地点列表面板）
	const searchActive = ref(false)

	// 搜索状态变化：进入搜索时先收起已打开的地点详情
	function onSearchState(active) {
		searchActive.value = active
		if (active) {
			closeDetail()
		}
	}

	// 回到我的位置：定位并平移到当前位置
	const locateMe = () => {		uni.getLocation({
			type: 'gcj02',
			success: (res) => {
				userLocation.value = {
					latitude: res.latitude,
					longitude: res.longitude
				}
				// 定位不在毕节：不跳转到外地，改为提示并可一键回毕节
				if (!inBijie(res.latitude, res.longitude)) {
					promptOffBijie()
					return
				}
				center.value = {
					longitude: res.longitude,
					latitude: res.latitude
				}
				scale.value = 16
				// 强制重新居中：用户拖动过地图后仅改 center 可能不生效，会导致「点了没反应」
				nextTick(() => {
					if (explorerRef.value && explorerRef.value.moveToLocation) {
						explorerRef.value.moveToLocation(res.longitude, res.latitude)
					}
				})
			},
			fail: () => {
				uni.showToast({
					title: '定位失败，请检查定位权限',
					icon: 'none'
				})
			}
		})
	}

	// 获取用户当前位置：定位结束后统一拉取一次数据（距离排序依赖定位）
	function fetchUserLocation() {
		let settled = false
		const finish = () => {
			if (settled) return
			settled = true
			loadSpots()
		}
		// 兜底：定位长期无回调时仍能加载一次
		const timer = setTimeout(finish, 8000)
		uni.getLocation({
			type: 'gcj02',
			success: (res) => {
				userLocation.value = {
					latitude: res.latitude,
					longitude: res.longitude
				}
				if (!inBijie(res.latitude, res.longitude)) {
					// 定位不在毕节：地图保持在毕节，并提示一次一键跳转
					if (!centeredToUser.value) {
						centeredToUser.value = true
						goToBijie()
					}
					if (!offBijiePrompted) {
						offBijiePrompted = true
						promptOffBijie()
					}
				} else if (!centeredToUser.value) {
					// 首次进入时把地图中心定位到用户当前位置
					centeredToUser.value = true
					center.value = {
						longitude: res.longitude,
						latitude: res.latitude
					}
					scale.value = 16
				}
				clearTimeout(timer)
				finish()
			},
			fail: () => {
				userLocation.value = null
				clearTimeout(timer)
				finish()
			}
		})
	}

	onShow(() => {
		try {
			const info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()
			pageHeight.value = info.windowHeight || 0
		} catch (e) {}
		loadFavorites()
		fetchUserLocation()
		// 返回页面时若详情仍打开，重新拉取该地点评价，保证数据最新
		if (detailVisible.value) {
			loadComments()
		}
	})

	// 离开页面时收起搜索状态，恢复 tabbar
	onHide(() => {
		if (searchBarRef.value && searchBarRef.value.closeSearch) {
			searchBarRef.value.closeSearch()
		}
	})

	// 排序变化时按新排序重新拉取（显示骨架屏）
	watch(sortBy, () => {
		reloadSpots()
	})

	// 分类切换：先关闭详情，再重新拉取
	watch(category, () => {
		closeDetail()
		reloadSpots()
	})

	// 关键词搜索防抖后重新拉取
	let searchTimer = null
	watch(searchKeyword, () => {
		closeDetail()
		if (searchTimer) clearTimeout(searchTimer)
		searchTimer = setTimeout(() => {
			searchTimer = null
			reloadSpots()
		}, 300)
	})

	// 重置到首屏并按当前筛选重新拉取（强制显示加载动效）
	function reloadSpots() {
		page.value = 1
		hasMore.value = true
		loadSpots(true)
	}

	// 是否处于默认筛选（全部 + 无关键词），仅此时使用缓存
	function isDefaultFilter() {
		return category.value === 'all' && !searchKeyword.value.trim()
	}

	async function loadFavorites() {
		try {
			await ensureLogin()
			const res = await spotFavObj.ids(getToken())
			favoriteIds.value = (res && res.data) || []
		} catch (e) {
			favoriteIds.value = []
		}
	}

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
			const list = favoriteIds.value.slice()
			const idx = list.indexOf(id)
			if (filled) {
				if (idx === -1) list.unshift(id)
				uni.showToast({
					title: '已收藏',
					icon: 'success'
				})
			} else {
				if (idx !== -1) list.splice(idx, 1)
				uni.showToast({
					title: '已取消收藏',
					icon: 'none'
				})
			}
			favoriteIds.value = list
		} catch (err) {
			uni.showToast({
				title: (err && (err.errMsg || err.message)) || '操作失败',
				icon: 'none'
			})
		}
	}

	function readCache() {
		try {
			const cache = uni.getStorageSync(SPOTS_CACHE_KEY)
			if (cache && Array.isArray(cache.list)) {
				const ts = Number(cache.ts) || 0
				const fresh = !!ts && (Date.now() - ts) <= CACHE_TTL
				return {
					list: cache.list,
					fresh
				}
			}
		} catch (e) {}
		return {
			list: [],
			fresh: false
		}
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
		const loc = userLocation.value
		const keyword = searchKeyword.value.trim()
		return spotsObj.getList({
			status: 'approved',
			withRating: true,
			page: pageNo,
			pageSize,
			sort: sortBy.value,
			type: category.value !== 'all' ? category.value : undefined,
			keyword: keyword || undefined,
			latitude: loc ? loc.latitude : undefined,
			longitude: loc ? loc.longitude : undefined
		})
	}

	// 拉取已通过审核的地点：先用缓存秒出，再拉首屏
	async function loadSpots(forceLoading) {
		let usedCache = false
		if (!spots.value.length) {
			const cached = isDefaultFilter() ? readCache() : { list: [], fresh: false }
			// 仅用未过期的缓存秒出；过旧缓存不再展示，避免掩盖真实故障
			if (cached.list.length && cached.fresh) {
				spots.value = cached.list
				usedCache = true
				resolveSpotImages(cached.list)
			}
		}
		loading.value = forceLoading ? true : !spots.value.length
		try {
			const res = await fetchSpots(1)
			const list = res.list || []
			spots.value = list
			page.value = 1
			hasMore.value = list.length < (res.total || 0)
			resolveSpotImages(list)
			loadError.value = false
			if (isDefaultFilter()) writeCache(list)
		} catch (err) {
			loadError.value = true
			const msg = (err && (err.errMsg || err.message)) || '地点加载失败'
			uni.showToast({
				title: (usedCache || spots.value.length) ? '网络异常，显示的是上次数据' : msg,
				icon: 'none'
			})
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

	// 在当前页为地点补充图片（仅管理员，一次最多 5 张，需审核）
	function chooseSpotImages() {
		const spot = currentSpot.value
		if (!spot || !spot._id) return
		if (!isAdmin()) {
			uni.showToast({
				title: '仅管理员可补充图片',
				icon: 'none'
			})
			return
		}
		const count = Math.max(1, Math.min(5, 9 - ((spot.images && spot.images.length) || 0)))
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
			const { ok, oversize } = await filterOversizeImages(filePaths)
			if (oversize) {
				uni.showToast({
					title: '有 ' + oversize + ' 张图片超过 6MB，已跳过',
					icon: 'none'
				})
			}
			if (!ok.length) return
			const ids = []
			for (let i = 0; i < ok.length; i++) {
				const filePath = await compressImage(ok[i])
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
				res = await spotsObj.addImages(spotId, ids, getToken())
			} catch (err) {
				if (!isAuthError(err)) throw err
				await relogin()
				res = await spotsObj.addImages(spotId, ids, getToken())
			}
			// 普通管理员：提交后进入待审核；超级管理员：直接生效
			const pending = !(res && res.pending === false)
			if (!pending) {
				try {
					const d = await spotsObj.getDetail(spotId)
					if (d && d.data && currentSpot.value) {
						currentSpot.value = Object.assign({}, currentSpot.value, d.data)
					}
				} catch (e) {}
			}
			uni.showToast({
				title: pending ? '已提交，等待审核' : '已添加图片',
				icon: 'none'
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
</script>
