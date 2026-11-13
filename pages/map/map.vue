<template>
	<view class="page">
		<map
			id="localMap"
			class="map"
			:longitude="center.longitude"
			:latitude="center.latitude"
			:scale="scale"
			:markers="markers"
			show-location
			@markertap="onMarkerTap"
		></map>

		<view class="panel">
			<view class="panel-top">
				<view class="panel-handle"></view>
			</view>

			<scroll-view class="filter-scroll" scroll-x :show-scrollbar="false">
				<view class="filter">
					<view
						v-for="item in categories"
						:key="item.value"
						class="filter-item"
						:class="{ active: category === item.value }"
						@click="switchCategory(item.value)"
					>
						<text class="filter-emoji" v-if="item.emoji">{{ item.emoji }}</text>
						{{ item.label }}
					</view>
				</view>
			</scroll-view>

			<view class="location-bar">
				<view class="location-left">
					<view class="location-dot"></view>
					<text class="location-name">{{ centerName }}</text>
				</view>
				<view class="location-tip">
					<text class="location-count">{{ filteredSpots.length }}</text>
					<text class="location-unit"> 个地点</text>
				</view>
			</view>

			<AppSkeleton v-if="loading" :count="5" />
			<view v-else-if="!filteredSpots.length" class="empty">
				<view class="empty-icon">📭</view>
				<text class="empty-text">暂无地点</text>
				<text class="empty-sub">请到地点管理添加</text>
			</view>
			<scroll-view v-else class="list" scroll-y :lower-threshold="80" @scrolltolower="loadMore">
				<view
					v-for="(spot, index) in filteredSpots"
					:key="spot._id"
					class="spot"
					@click="focusSpot(index)"
				>
					<image
						v-if="thumbUrl(spot)"
						class="spot-thumb"
						:src="thumbUrl(spot)"
						mode="aspectFill"
					></image>
					<view v-else class="spot-icon" :style="{ backgroundColor: typeBg(spot.type) }">
						<text class="spot-emoji">{{ typeEmoji(spot.type) }}</text>
					</view>

					<view class="spot-info">
						<view class="spot-head">
							<text class="spot-name">{{ spot.name }}</text>
							<view class="spot-tag" :style="{ color: typeColor(spot.type), backgroundColor: typeBg(spot.type) }">{{ typeText(spot.type) }}</view>
						</view>
						<text class="spot-desc">{{ spot.address || spot.remark || '暂无描述' }}</text>
						<view v-if="ratingOf(spot).count" class="spot-rating">
							<view class="stars small">
								<text v-for="n in 5" :key="n" class="star" :class="{ on: n <= Math.round(ratingOf(spot).avg) }">★</text>
							</view>
							<text class="spot-rating-text">{{ ratingOf(spot).avg }}</text>
						</view>
					</view>

					<view class="spot-arrow">
						<text class="arrow-icon-text">›</text>
					</view>
				</view>

				<view class="list-footer">
					<AppLoading v-if="loadingMore" compact text="加载中..." />
					<text v-else-if="!hasMore" class="list-footer-text">没有更多了</text>
				</view>
			</scroll-view>
		</view>

		<view v-if="detailVisible" class="mask" @click="closeDetail">
			<view class="detail" @click.stop>
				<view class="detail-handle-wrap">
					<view class="panel-handle"></view>
				</view>

				<scroll-view class="detail-scroll" scroll-y :show-scrollbar="false">
					<view class="detail-inner">
						<scroll-view v-if="currentImages.length" class="detail-images" scroll-x :show-scrollbar="false">
							<image
								v-for="(img, i) in currentImages"
								:key="i"
								class="detail-image"
								:src="img"
								mode="aspectFill"
								@click="previewImage(i)"
							></image>
							<view class="detail-image-add" @click="chooseSpotImages">
								<text class="detail-add-icon">＋</text>
								<text class="detail-add-text">上传照片</text>
							</view>
						</scroll-view>
						<view v-else class="detail-image-empty" @click="chooseSpotImages">
							<text class="detail-empty-icon">🖼️</text>
							<text class="detail-empty-title">暂无图片</text>
							<text class="detail-empty-sub">上传照片，帮助更多人了解这里</text>
						</view>

						<view class="detail-head">
							<view class="detail-icon" :style="{ backgroundColor: typeBg(currentSpot.type) }">
								<text class="detail-icon-text">{{ typeEmoji(currentSpot.type) }}</text>
							</view>
							<view class="detail-title-wrap">
								<text class="detail-name">{{ currentSpot.name }}</text>
								<view class="detail-tag" :style="{ color: typeColor(currentSpot.type), backgroundColor: typeBg(currentSpot.type) }">{{ typeText(currentSpot.type) }}</view>
							</view>
						</view>

						<view class="detail-rating">
							<view class="stars small">
								<text v-for="n in 5" :key="n" class="star" :class="{ on: n <= Math.round(currentRating.avg) }">★</text>
							</view>
							<text class="detail-rating-text">{{ currentRating.count ? currentRating.avg + ' 分 · ' + currentRating.count + ' 条评价' : '暂无评价' }}</text>
						</view>

						<view class="detail-body">
							<view v-if="currentSpot.address" class="detail-row">
								<text class="detail-row-icon">📍</text>
								<text class="detail-row-text">{{ currentSpot.address }}</text>
							</view>
							<view v-if="currentSpot.remark" class="detail-row">
								<text class="detail-row-icon">📝</text>
								<text class="detail-row-text">{{ currentSpot.remark }}</text>
							</view>
							<view v-if="currentSpot.contributor_name" class="detail-row">
								<text class="detail-row-icon">👤</text>
								<text class="detail-row-text">{{ currentSpot.contributor_name }} 贡献</text>
							</view>
						</view>

						<view class="detail-comments">
							<view class="dc-head">
								<text class="dc-title">评价</text>
								<text class="dc-count">{{ commentsTotal }} 条</text>
							</view>

							<view v-if="commentsLoading" class="dc-tip">加载中...</view>
							<view v-else-if="!comments.length" class="dc-tip">还没有评价，来抢沙发</view>
							<view v-else class="dc-list">
								<view v-for="c in comments" :key="c._id" class="dc-item">
									<image v-if="commentAvatar(c)" class="dc-avatar" :src="commentAvatar(c)" mode="aspectFill" />
									<view v-else class="dc-avatar dc-avatar-text">{{ commentAvatarText(c.nickname) }}</view>
									<view class="dc-body">
										<view class="dc-item-head">
											<text class="dc-name">{{ c.nickname || '匿名用户' }}</text>
											<view class="stars small">
												<text v-for="n in 5" :key="n" class="star" :class="{ on: n <= c.rating }">★</text>
											</view>
										</view>
										<text class="dc-content">{{ c.content }}</text>
									</view>
								</view>
							</view>

							<button class="dc-write" @click="openComposer">写评价</button>
						</view>
					</view>
				</scroll-view>

				<view class="detail-actions">
					<button class="detail-btn close" @click="closeDetail">关闭</button>
					<button class="detail-btn feedback" @click="openFeedback">反馈</button>
					<button class="detail-btn nav" :disabled="!hasCoord" @click="goHere">
						<text class="nav-icon">🧭</text> 导航前往
					</button>
				</view>
			</view>
		</view>

		<view v-if="composerVisible" class="mask" @click="closeComposer">
			<view class="composer" @click.stop>
				<text class="composer-title">评价「{{ currentSpot.name }}」</text>
				<view class="rate-row">
					<text
						v-for="n in 5"
						:key="n"
						class="rate-star"
						:class="{ on: n <= commentRating }"
						@click="commentRating = n"
					>★</text>
					<text class="rate-text">{{ ratingText(commentRating) }}</text>
				</view>
				<textarea class="composer-input" v-model="commentContent" placeholder="说说你的体验吧～" maxlength="500" />
				<view class="composer-actions">
					<button class="c-btn cancel" @click="closeComposer">取消</button>
					<button class="c-btn submit" :disabled="submittingComment" @click="submitComment">{{ submittingComment ? '发布中...' : '发布' }}</button>
				</view>
			</view>
		</view>

		<view v-if="feedbackVisible" class="mask" @click="closeFeedback">
			<view class="composer" @click.stop>
				<text class="composer-title">反馈问题</text>
				<textarea class="composer-input" v-model="feedbackText" placeholder="如：摊位已搬迁到对面 / 信息有误…" maxlength="300" />
				<view class="composer-actions">
					<button class="c-btn cancel" @click="closeFeedback">取消</button>
					<button class="c-btn submit" :disabled="submittingFeedback" @click="submitFeedback">{{ submittingFeedback ? '提交中...' : '提交反馈' }}</button>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
	import { ref, computed } from 'vue'
	import { onShow } from '@dcloudio/uni-app'
	import { ensureLogin, getUserInfo, getToken, isAuthError, relogin } from '@/utils/auth.js'
	import { resolveCloudFiles } from '@/utils/cloudFile.js'
	import AppLoading from '@/components/AppLoading.vue'
	import AppSkeleton from '@/components/AppSkeleton.vue'

	const favoriteObj = uniCloud.importObject('favorite-spots', {
		customUI: true
	})

	const commentObj = uniCloud.importObject('spot-comments', {
		customUI: true
	})

	const categories = [{
		label: '全部',
		value: 'all',
		emoji: ''
	}, {
		label: '美食',
		value: 'food',
		emoji: '🍜'
	}, {
		label: '景点',
		value: 'view',
		emoji: '🌳'
	}, {
		label: '便民厕所',
		value: 'toilet',
		emoji: '🚻'
	}, {
		label: '便民商店',
		value: 'shop',
		emoji: '🏪'
	}, {
		label: '其他',
		value: 'other',
		emoji: '📍'
	}]

	const category = ref('all')
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
	const composerVisible = ref(false)
	const commentRating = ref(5)
	const commentContent = ref('')
	const submittingComment = ref(false)

	// 反馈
	const feedbackVisible = ref(false)
	const feedbackText = ref('')
	const submittingFeedback = ref(false)

	const uploadingImage = ref(false)

	const filteredSpots = computed(() => {
		if (category.value === 'all') {
			return spots.value
		}
		return spots.value.filter(item => item.type === category.value)
	})

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

	function typeText(type) {
		if (type === 'food') return '美食'
		if (type === 'view') return '景点'
		if (type === 'toilet') return '便民厕所'
		if (type === 'shop') return '便民商店'
		return '其他'
	}

	function typeColor(type) {
		if (type === 'food') return '#E8710A'
		if (type === 'view') return '#188038'
		if (type === 'toilet') return '#1A73E8'
		if (type === 'shop') return '#8430CE'
		return '#5F6368'
	}

	function typeBg(type) {
		if (type === 'food') return '#FEF1E6'
		if (type === 'view') return '#E6F4EA'
		if (type === 'toilet') return '#E8F0FE'
		if (type === 'shop') return '#F3E8FD'
		return '#F1F3F4'
	}

	function typeEmoji(type) {
		if (type === 'food') return '🍲'
		if (type === 'view') return '🌳'
		if (type === 'toilet') return '🚻'
		if (type === 'shop') return '🏪'
		return '📍'
	}

	// 地点缩略图 URL（云存储 fileID 需转换成临时链接后才能显示）
	function thumbUrl(spot) {
		const first = spot && Array.isArray(spot.images) ? spot.images[0] : ''
		return first ? (imageMap.value[first] || '') : ''
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

	function ratingText(v) {
		const map = {
			1: '很差',
			2: '较差',
			3: '一般',
			4: '满意',
			5: '很棒'
		}
		return map[v] || ''
	}

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

	function switchCategory(value) {
		category.value = value
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

	function onMarkerTap(e) {
		focusSpot(e.detail.markerId)
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

	// 评价：头像解析
	function commentAvatar(item) {
		return item.avatar ? (commentAvatarMap.value[item.avatar] || '') : ''
	}

	function commentAvatarText(name) {
		return name ? String(name).charAt(0) : '用'
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

	function openComposer() {
		commentRating.value = 5
		commentContent.value = ''
		composerVisible.value = true
	}

	function closeComposer() {
		composerVisible.value = false
	}

	// 提交评价
	async function submitComment() {
		const text = String(commentContent.value).trim()
		if (!text) {
			uni.showToast({
				title: '请输入评价内容',
				icon: 'none'
			})
			return
		}
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
		submittingComment.value = true
		try {
			const body = {
				spot_id: spot._id,
				rating: commentRating.value,
				content: text
			}
			let res
			try {
				res = await commentObj.addComment(body, getToken())
			} catch (err) {
				if (!isAuthError(err)) throw err
				await relogin()
				res = await commentObj.addComment(body, getToken())
			}
			const item = (res && res.data) || null
			if (item) {
				const prevCount = commentsTotal.value
				const prevAvg = commentsAvg.value
				comments.value.unshift(item)
				commentsTotal.value = prevCount + 1
				commentsAvg.value = Math.round(((prevAvg * prevCount + Number(item.rating || 0)) / commentsTotal.value) * 10) / 10
				commentsLoaded.value = true
				spot.rating = commentsAvg.value
				spot.rating_count = commentsTotal.value
				resolveCommentAvatars([item])
			}
			composerVisible.value = false
			uni.showToast({
				title: '已发布',
				icon: 'success'
			})
		} catch (err) {
			uni.showToast({
				title: (err && (err.errMsg || err.message)) || '发布失败',
				icon: 'none'
			})
		} finally {
			submittingComment.value = false
		}
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

	// 直接反馈（纠错）
	function openFeedback() {
		feedbackText.value = ''
		feedbackVisible.value = true
	}

	function closeFeedback() {
		feedbackVisible.value = false
	}

	async function submitFeedback() {
		const text = feedbackText.value.trim()
		if (!text) {
			uni.showToast({
				title: '请填写反馈内容',
				icon: 'none'
			})
			return
		}
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
		const payload = {
			report_type: 'correction',
			target_id: spot._id,
			name: spot.name,
			type: spot.type,
			address: spot.address || '',
			longitude: spot.longitude,
			latitude: spot.latitude,
			report_reason: text
		}
		submittingFeedback.value = true
		try {
			try {
				await favoriteObj.submit(payload, getToken())
			} catch (err) {
				if (!isAuthError(err)) throw err
				await relogin()
				await favoriteObj.submit(payload, getToken())
			}
			feedbackVisible.value = false
			uni.showToast({
				title: '已提交，等待审核',
				icon: 'success'
			})
		} catch (err) {
			uni.showToast({
				title: (err && (err.errMsg || err.message)) || '提交失败',
				icon: 'none'
			})
		} finally {
			submittingFeedback.value = false
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

<style lang="scss">
	.page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
		background-color: $bg-page;
	}

	.map {
		width: 100%;
		flex: 1;
	}

	/* ── 底部面板 ── */
	.panel {
		height: 54vh;
		background-color: $bg-card;
		border-radius: $radius-xl $radius-xl 0 0;
		margin-top: -32rpx;
		box-shadow: 0 -24rpx 56rpx rgba(29, 33, 41, 0.14);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.panel-top {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20rpx 0 8rpx;
		flex-shrink: 0;
	}

	.panel-handle {
		width: 72rpx;
		height: 8rpx;
		background-color: $border-strong;
		border-radius: 4rpx;
	}

	/* ── 分类筛选 ── */
	.filter-scroll {
		width: 100%;
		white-space: nowrap;
		padding: 8rpx 0 20rpx;
		flex-shrink: 0;
	}

	.filter {
		display: inline-flex;
		padding: 0 $space-md;
	}

	.filter-item {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		height: 72rpx;
		padding: 0 28rpx;
		margin-right: $space-sm;
		font-size: $fs-sm;
		font-weight: 500;
		color: $text-main;
		background-color: $bg-card;
		border: 1rpx solid $border-strong;
		border-radius: $radius-pill;
		box-shadow: $shadow-sm;
		transition: background-color $duration-fast ease;
	}

	.filter-emoji {
		margin-right: 8rpx;
		font-size: 26rpx;
	}

	.filter-item.active {
		color: $brand;
		font-weight: 600;
		background-color: $brand-soft;
		border-color: $brand-soft;
	}

	/* ── 位置信息栏 ── */
	.location-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 $space-lg 20rpx;
		flex-shrink: 0;
	}

	.location-left {
		display: flex;
		align-items: center;
		overflow: hidden;
		flex: 1;
		margin-right: $space-sm;
	}

	.location-dot {
		width: 14rpx;
		height: 14rpx;
		background-image: $brand-gradient;
		border-radius: 50%;
		margin-right: 12rpx;
		flex-shrink: 0;
		box-shadow: 0 0 0 4rpx rgba(0, 105, 92, 0.2);
	}

	.location-name {
		font-size: 30rpx;
		font-weight: 600;
		color: $text-main;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.location-tip {
		display: flex;
		align-items: baseline;
		flex-shrink: 0;
		background-color: $brand-soft;
		padding: 6rpx 20rpx;
		border-radius: $radius-pill;
	}

	.location-count {
		font-size: 28rpx;
		font-weight: 700;
		color: $brand;
	}

	.location-unit {
		font-size: $fs-xs;
		color: $brand-light;
	}

	/* ── 地点列表 ── */
	.list {
		flex: 1;
		height: 0;
		min-height: 0;
		background-color: $bg-page;
		padding: 8rpx 0 12rpx;
	}

	.spot {
		display: flex;
		align-items: center;
		background-color: $bg-card;
		border-radius: $radius-lg;
		padding: 20rpx $space-md;
		margin: 0 $space-md $space-sm;
		box-shadow: 0 4rpx 16rpx rgba(29, 33, 41, 0.05);
		transition: all $duration-fast ease;
		
		&:active {
			transform: translateY(2rpx);
			box-shadow: none;
			background-color: $bg-fill;
		}
	}

	.spot-thumb {
		width: 96rpx;
		height: 96rpx;
		border-radius: $radius-md;
		margin-right: $space-md;
		flex-shrink: 0;
		background-color: $bg-fill;
	}

	.spot-icon {
		width: 96rpx;
		height: 96rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: $radius-md;
		margin-right: $space-md;
		flex-shrink: 0;
	}

	.spot-emoji {
		font-size: 44rpx;
		line-height: 1;
	}

	.spot-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.spot-head {
		display: flex;
		align-items: center;
		margin-bottom: 10rpx;
	}

	.spot-name {
		flex: 1;
		font-size: $fs-lg;
		font-weight: 600;
		color: $text-main;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		margin-right: 12rpx;
	}

	.spot-tag {
		flex-shrink: 0;
		font-size: $fs-xs;
		padding: 6rpx 18rpx;
		border-radius: $radius-pill;
		font-weight: 500;
	}

	.spot-desc {
		font-size: $fs-sm;
		color: $text-secondary;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		line-height: 1.4;
	}

	.spot-arrow {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48rpx;
		height: 48rpx;
		background-color: $bg-fill;
		border-radius: 50%;
		flex-shrink: 0;
		margin-left: 12rpx;
	}

	.arrow-icon-text {
		font-size: 32rpx;
		color: $text-disabled;
		line-height: 1;
		margin-top: -4rpx;
	}

	.list-footer {
		padding: 16rpx 0 8rpx;
		text-align: center;
	}

	.list-footer-text {
		font-size: $fs-xs;
		color: $text-placeholder;
	}

	/* ── 空状态 ── */
	.empty {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding-bottom: 60rpx;
	}

	.empty-icon {
		font-size: 80rpx;
		line-height: 1;
		margin-bottom: 20rpx;
		opacity: 0.4;
	}

	.empty-text {
		font-size: $fs-md;
		font-weight: 500;
		color: $text-secondary;
	}

	.empty-sub {
		margin-top: 8rpx;
		font-size: $fs-sm;
		color: $text-placeholder;
	}

	/* ── 详情弹窗 ── */
	.mask {
		position: fixed;
		left: 0;
		top: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(17, 24, 39, 0.6);
		display: flex;
		align-items: flex-end;
		z-index: 99;
		animation: fadeIn 0.2s ease;
	}

	.detail {
		width: 100%;
		background-color: $bg-card;
		border-radius: $radius-xl $radius-xl 0 0;
		box-sizing: border-box;
		overflow: hidden;
		animation: slideUp 0.3s cubic-bezier(0.34, 1.1, 0.64, 1);
	}

	.detail-scroll {
		max-height: 66vh;
	}

	.detail-inner {
		padding: 0 $space-lg $space-md;
	}

	@keyframes slideUp {
		from {
			transform: translateY(100%);
			opacity: 0.6;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.detail-handle-wrap {
		display: flex;
		justify-content: center;
		padding: 20rpx 0 8rpx;
	}

	.detail-head {
		display: flex;
		align-items: center;
		margin-top: 8rpx;
		margin-bottom: 4rpx;
	}

	.detail-icon {
		width: 88rpx;
		height: 88rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: $radius-lg;
		margin-right: $space-md;
		flex-shrink: 0;
	}

	.detail-icon-text {
		font-size: 44rpx;
		line-height: 1;
	}

	.detail-title-wrap {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.detail-name {
		font-size: 40rpx;
		font-weight: 700;
		color: $text-main;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.detail-tag {
		display: inline-block;
		margin-top: 10rpx;
		font-size: $fs-xs;
		padding: 6rpx 20rpx;
		border-radius: $radius-pill;
		font-weight: 500;
		align-self: flex-start;
	}

	/* 评分 */
	.stars {
		display: inline-flex;
		align-items: center;
	}

	.star {
		font-size: 26rpx;
		color: $border-strong;
		line-height: 1;
	}

	.star.on {
		color: $warning;
	}

	.stars.small .star {
		font-size: 22rpx;
	}

	.detail-rating {
		display: flex;
		align-items: center;
		margin-top: $space-md;
		padding: 16rpx 20rpx;
		background-color: $bg-page;
		border-radius: $radius-md;
	}

	.detail-rating-text {
		flex: 1;
		margin-left: 12rpx;
		font-size: $fs-sm;
		color: $text-regular;
	}

	.detail-rating-arrow {
		font-size: 36rpx;
		color: $text-disabled;
	}

	.spot-rating {
		display: flex;
		align-items: center;
		margin-top: 8rpx;
	}

	.spot-rating-text {
		margin-left: 8rpx;
		font-size: $fs-xs;
		font-weight: 600;
		color: $warning;
	}

	.detail-images {
		width: 100%;
		white-space: nowrap;
		margin: 8rpx 0 $space-md;
	}

	.detail-image {
		display: inline-block;
		width: 300rpx;
		height: 210rpx;
		margin-right: $space-sm;
		border-radius: $radius-md;
		background-color: $bg-fill;
	}

	.detail-image-add {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 210rpx;
		height: 210rpx;
		border-radius: $radius-md;
		background-color: $bg-fill;
		border: 2rpx dashed $border-strong;
		vertical-align: top;
	}

	.detail-add-icon {
		font-size: 56rpx;
		color: $text-placeholder;
		line-height: 1;
	}

	.detail-add-text {
		margin-top: 10rpx;
		font-size: $fs-xs;
		color: $text-secondary;
	}

	.detail-image-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 260rpx;
		margin: 8rpx 0 $space-md;
		background-color: $bg-fill;
		border: 2rpx dashed $border-strong;
		border-radius: $radius-lg;
	}

	.detail-empty-icon {
		font-size: 64rpx;
		line-height: 1;
		opacity: 0.5;
	}

	.detail-empty-title {
		margin-top: 16rpx;
		font-size: $fs-md;
		font-weight: 500;
		color: $text-secondary;
	}

	.detail-empty-sub {
		margin-top: 8rpx;
		font-size: $fs-xs;
		color: $text-placeholder;
	}

	.detail-body {
		margin-top: $space-md;
		background-color: $bg-page;
		border-radius: $radius-lg;
		padding: 8rpx $space-md;
	}

	.detail-row {
		display: flex;
		align-items: flex-start;
		padding: 20rpx 0;
		border-bottom: 1rpx solid $border-color;
		
		&:last-child {
			border-bottom: none;
		}
	}

	.detail-row-icon {
		font-size: 28rpx;
		margin-right: 16rpx;
		line-height: 1.5;
		flex-shrink: 0;
	}

	.detail-row-text {
		flex: 1;
		font-size: $fs-sm;
		color: $text-regular;
		line-height: 1.6;
	}

	.detail-actions {
		display: flex;
		gap: 16rpx;
		padding: $space-md $space-lg;
		padding-bottom: calc(20rpx + constant(safe-area-inset-bottom));
		padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
		background-color: $bg-card;
		flex-shrink: 0;
	}

	.detail-btn {
		flex: 1;
		height: 96rpx;
		line-height: 96rpx;
		font-size: $fs-md;
		font-weight: 600;
		border-radius: $radius-pill;
		transition: all $duration-fast ease;
		
		&:active {
			transform: scale(0.97);
		}
	}

	.detail-btn.close {
		color: $text-regular;
		background-color: $bg-fill;
	}

	.detail-btn.feedback {
		color: $brand;
		background-color: $brand-soft;
	}

	.detail-btn.nav {
		color: $text-inverse;
		background-image: $brand-gradient;
		box-shadow: $brand-shadow;
	}

	.nav-icon {
		margin-right: 8rpx;
	}

	.detail-btn.nav[disabled] {
		opacity: 0.45;
		box-shadow: none;
	}

	/* ── 详情内评价 ── */
	.detail-comments {
		margin-top: $space-md;
	}

	.dc-head {
		display: flex;
		align-items: baseline;
		margin-bottom: $space-sm;
	}

	.dc-title {
		font-size: $fs-lg;
		font-weight: 700;
		color: $text-main;
	}

	.dc-count {
		margin-left: 12rpx;
		font-size: $fs-sm;
		color: $text-secondary;
	}

	.dc-tip {
		padding: 24rpx 0;
		font-size: $fs-sm;
		color: $text-secondary;
	}

	.dc-item {
		display: flex;
		padding: $space-md 0;
		border-bottom: 1rpx solid $border-color;
	}

	.dc-avatar {
		width: 64rpx;
		height: 64rpx;
		border-radius: 50%;
		margin-right: $space-md;
		flex-shrink: 0;
		background-color: $bg-fill;
	}

	.dc-avatar-text {
		line-height: 64rpx;
		text-align: center;
		font-size: $fs-md;
		color: $text-inverse;
		background-image: $brand-gradient;
	}

	.dc-body {
		flex: 1;
		overflow: hidden;
	}

	.dc-item-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.dc-name {
		font-size: $fs-md;
		font-weight: 600;
		color: $text-main;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		margin-right: $space-sm;
	}

	.dc-content {
		display: block;
		margin-top: 8rpx;
		font-size: $fs-sm;
		color: $text-regular;
		line-height: 1.6;
		word-break: break-all;
	}

	.dc-write {
		margin-top: $space-md;
		font-size: $fs-md;
		font-weight: 500;
		color: $brand;
		background-color: $brand-soft;
		border-radius: $radius-pill;
	}

	/* ── 评价 / 反馈弹窗 ── */
	.composer {
		width: 100%;
		background-color: $bg-card;
		border-radius: $radius-xl $radius-xl 0 0;
		padding: $space-lg $space-lg 40rpx;
		box-sizing: border-box;
	}

	.composer-title {
		display: block;
		font-size: $fs-lg;
		font-weight: 700;
		color: $text-main;
		text-align: center;
	}

	.rate-row {
		display: flex;
		align-items: center;
		justify-content: center;
		margin: $space-lg 0;
	}

	.rate-star {
		font-size: 60rpx;
		color: $border-strong;
		line-height: 1;
		margin: 0 8rpx;
	}

	.rate-star.on {
		color: $warning;
	}

	.rate-text {
		margin-left: $space-md;
		font-size: $fs-md;
		font-weight: 500;
		color: $warning;
	}

	.composer-input {
		width: 100%;
		height: 220rpx;
		padding: 20rpx $space-md;
		font-size: $fs-md;
		color: $text-main;
		background-color: $bg-fill;
		border-radius: $radius-md;
	}

	.composer-actions {
		display: flex;
		margin-top: $space-lg;
		gap: 20rpx;
	}

	.c-btn {
		flex: 1;
		font-size: $fs-lg;
		font-weight: 600;
		border-radius: $radius-pill;
	}

	.c-btn.cancel {
		color: $text-regular;
		background-color: $bg-fill;
	}

	.c-btn.submit {
		color: $text-inverse;
		background-image: $brand-gradient;
		box-shadow: $brand-shadow;
	}
</style>
