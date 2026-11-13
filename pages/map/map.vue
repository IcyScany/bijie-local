<template>
	<view class="gm-page">
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

		<!-- 顶部搜索栏和分类 -->
		<view style="position: absolute; top: 0; left: 0; right: 0; z-index: 10; padding: 16rpx;">
			<!-- 搜索框 -->
			<view class="gm-search" style="margin-bottom: 12rpx; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.15);">
				<app-icon icon="search" size="md" style="margin-right: 12rpx;" />
				<input class="gm-search-input" placeholder="在此处搜索" value="餐馆" />
				<app-icon icon="photoCamera" size="sm" />
			</view>

			<!-- 分类过滤 -->
			<scroll-view scroll-x :show-scrollbar="false" style="white-space: nowrap;">
				<view class="gm-flex" style="gap: 8rpx; padding-right: 16rpx;">
					<view
						v-for="item in categories"
						:key="item.value"
						class="gm-chip gm-chip-map"
						:class="{ 'gm-chip-selected': category === item.value }"
						@click="switchCategory(item.value)"
					>
						<app-icon 
							v-if="item.icon" 
							:icon="item.icon" 
							size="sm"
							:color="category === item.value ? 'inherit' : 'primary'"
							:custom-style="category === item.value ? { opacity: 1, filter: 'brightness(2)' } : {}"
						/>
						{{ item.label }}
					</view>
				</view>
			</scroll-view>
		</view>

		<!-- 底部列表面板 - 固定定位容器 -->
		<view 
			class="gm-bottom-sheet-wrapper" 
			:style="{ height: bottomSheetHeight + 'vh' }"
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

			<AppSkeleton v-if="loading" :count="3" />
			<view v-else-if="!filteredSpots.length" class="gm-empty" style="padding-bottom: 60rpx;">
				<text style="font-size: 56rpx; opacity: 0.3; margin-bottom: 24rpx;">📭</text>
				<text class="gm-empty-title">暂无地点</text>
				<text class="gm-empty-subtitle">请到地点管理添加</text>
			</view>
			<scroll-view v-else style="flex: 1; height: 0; min-height: 0;" scroll-y :lower-threshold="80" @scrolltolower="loadMore">
				<view class="gm-place-list">
					<view
						v-for="(spot, index) in filteredSpots"
						:key="spot._id"
						class="gm-place-item-card"
						@click="focusSpot(index)"
					>
						<!-- 左侧：信息区 -->
						<view class="gm-place-card-content">
							<!-- 地点名称 -->
							<text class="gm-place-name">{{ spot.name }}</text>

							<!-- 地点信息：无评价/评分 · 分类 · 距离 -->
							<view class="gm-place-info-row" style="margin-bottom: 8rpx;">
								<template v-if="ratingOf(spot).count">
									<text class="gm-place-dim">{{ ratingOf(spot).avg }}★</text>
									<text class="gm-place-dim" style="margin: 0 4rpx;">·</text>
								</template>
								<text v-else class="gm-place-dim">无评价</text>
								<text class="gm-place-dim" style="margin: 0 4rpx;">·</text>
								<text class="gm-place-dim">{{ typeText(spot.type) }}</text>
								<text class="gm-place-dim" style="margin: 0 4rpx;">·</text>
								<text class="gm-place-dim">140米</text>
							</view>

							<!-- 地址 -->
							<text class="gm-place-address" v-if="spot.address">{{ spot.address }}</text>
						</view>

						<!-- 右侧：图片区 -->
						<view class="gm-place-card-image">
							<image 
								:src="thumbUrl(spot) || '/static/img/default.png'"
								mode="aspectFill"
								style="width: 100%; height: 100%; border-radius: 12rpx;"
							></image>
						</view>
					</view>

					<view class="gm-text-center gm-py-sm">
						<AppLoading v-if="loadingMore" compact text="加载中..." />
						<text v-else-if="!hasMore" class="gm-font-sm gm-text-tertiary">没有更多了</text>
					</view>
				</view>
			</scroll-view>
			</view>
		</view>

		<!-- 详情模态框 -->
		<view v-if="detailVisible" class="gm-overlay" @click="closeDetail">
			<view class="gm-bottom-sheet" style="width: 100%; max-height: 90vh; animation: gm-slide-up 0.25s cubic-bezier(0.4, 0, 0.2, 1); display: flex; flex-direction: column;" @click.stop>
				<!-- 拖动条 -->
				<view class="gm-bottom-sheet-handle">
					<view class="gm-bottom-sheet-bar"></view>
				</view>

				<!-- 滚动内容区 -->
				<scroll-view style="flex: 1; overflow-y: auto;" scroll-y :show-scrollbar="false">
					<!-- 图片轮播区 -->
					<scroll-view v-if="currentImages.length" style="width: 100%; height: 300rpx; white-space: nowrap;" scroll-x :show-scrollbar="false">
						<image
							v-for="(img, i) in currentImages"
							:key="i"
							style="width: 100%; height: 300rpx; display: inline-block; background-color: #F1F3F4;"
							:src="img"
							mode="aspectFill"
							@click="previewImage(i)"
						></image>
					</scroll-view>
					<view v-else style="width: 100%; height: 300rpx; background-color: #F1F3F4; display: flex; align-items: center; justify-content: center;">
						<text style="font-size: 80rpx; opacity: 0.3; color: #202124;">🖼️</text>
					</view>

					<!-- 内容区 -->
					<view style="padding: 24rpx 24rpx;">
						<!-- 头部：名称 + 关闭按钮 -->
						<view class="gm-flex" style="justify-content: space-between; align-items: flex-start; margin-bottom: 16rpx;">
							<view style="flex: 1; overflow: hidden;">
								<text style="font-size: 36rpx; font-weight: 700; color: #202124; line-height: 1.3; display: block; word-break: break-all;">{{ currentSpot.name }}</text>
								<!-- 无评价提示 -->
								<text v-if="!currentRating.count" class="gm-font-sm gm-text-secondary" style="display: block; margin-top: 8rpx;">暂无评价</text>
								<!-- 有评价的显示 -->
								<view v-else class="gm-flex gm-mt-sm" style="align-items: center;">
									<view class="gm-stars gm-stars-sm">
										<text v-for="n in 5" :key="n" class="gm-star" :class="{ 'gm-star-filled': n <= Math.round(currentRating.avg) }">★</text>
									</view>
									<text class="gm-font-md gm-font-bold gm-ml-xs" style="color: #FBBC04;">{{ currentRating.avg }}</text>
									<text class="gm-font-sm gm-text-secondary gm-ml-xs">({{ currentRating.count }})</text>
								</view>
							</view>
							<button class="gm-btn gm-btn-text" style="height: 64rpx; line-height: 64rpx; padding: 0 16rpx; font-size: 36rpx; margin: -16rpx -16rpx 0 0;" @click="closeDetail">✕</button>
						</view>

						<!-- 分类标签 -->
						<view class="gm-tag" :style="{ color: typeColor(currentSpot.type), backgroundColor: typeBg(currentSpot.type), fontSize: '22rpx', padding: '8rpx 16rpx', marginBottom: '24rpx' }">{{ typeText(currentSpot.type) }}</view>

						<!-- 快速操作按钮 -->
						<view class="gm-flex" style="gap: 12rpx; margin-bottom: 24rpx; flex-wrap: wrap;">
							<button class="gm-btn gm-btn-filled" style="flex: 1; min-width: 150rpx; height: 72rpx; line-height: 72rpx; font-size: 26rpx; padding: 0 24rpx;" :disabled="!hasCoord" @click="goHere">
								<app-icon icon="directions" size="sm" style="margin-right: 8rpx; vertical-align: -2rpx;" />路线
							</button>
							<button class="gm-btn gm-btn-tonal" style="flex: 1; min-width: 150rpx; height: 72rpx; line-height: 72rpx; font-size: 26rpx; padding: 0 24rpx;">
								<app-icon icon="call" size="sm" style="margin-right: 8rpx; vertical-align: -2rpx;" />致电
							</button>
							<button class="gm-btn gm-btn-tonal" style="flex: 1; min-width: 150rpx; height: 72rpx; line-height: 72rpx; font-size: 26rpx; padding: 0 24rpx;">
								<app-icon icon="nearMe" size="sm" style="margin-right: 8rpx; vertical-align: -2rpx;" />分享
							</button>
						</view>

						<!-- 标签页 -->
						<view class="gm-tabs" style="margin-bottom: 24rpx;">
							<view class="gm-tab gm-tab-active">概览</view>
							<view class="gm-tab">简介</view>
						</view>

						<!-- 信息行 -->
						<view v-if="currentSpot.address" class="gm-flex" style="align-items: flex-start; margin-bottom: 20rpx;">
							<app-icon icon="location" size="md" style="margin-right: 16rpx; flex-shrink: 0; margin-top: 2rpx;" />
							<view style="flex: 1;">
								<text class="gm-font-sm gm-text-secondary" style="display: block;">地址</text>
								<text class="gm-font-md gm-text-primary" style="display: block; margin-top: 6rpx; line-height: 1.4; word-break: break-all;">{{ currentSpot.address }}</text>
							</view>
						</view>

						<view v-if="currentSpot.remark" class="gm-flex" style="align-items: flex-start; margin-bottom: 20rpx;">
							<app-icon icon="locationOn" size="md" style="margin-right: 16rpx; flex-shrink: 0; margin-top: 2rpx;" />
							<view style="flex: 1;">
								<text class="gm-font-sm gm-text-secondary" style="display: block;">备注</text>
								<text class="gm-font-md gm-text-primary" style="display: block; margin-top: 6rpx; line-height: 1.4;">{{ currentSpot.remark }}</text>
							</view>
						</view>

						<view v-if="currentSpot.contributor_name" class="gm-flex" style="align-items: center; margin-bottom: 20rpx; padding-bottom: 20rpx; border-bottom: 1rpx solid #E8EAED;">
							<app-icon icon="photoCamera" size="md" style="margin-right: 16rpx; flex-shrink: 0;" />
							<text class="gm-font-md gm-text-primary gm-flex-1">{{ currentSpot.contributor_name }} 贡献</text>
							<text style="font-size: 24rpx; color: #9AA0A6;">›</text>
						</view>

						<!-- 评价区域 -->
						<view style="margin-top: 24rpx;">
							<text class="gm-font-lg gm-font-bold gm-text-primary" style="display: block; margin-bottom: 20rpx;">评价</text>

							<!-- 无评价提示 -->
							<view v-if="!commentsLoading && !comments.length" style="text-align: center; padding: 40rpx 0;">
								<text class="gm-text-secondary" style="display: block; margin-bottom: 20rpx;">还没有评价，来抢沙发</text>
								<button class="gm-btn gm-btn-outlined" style="width: 100%; height: 72rpx; line-height: 72rpx; font-size: 26rpx; border: 2rpx solid #1A73E8; color: #1A73E8; background-color: transparent;" @click="openComposer">写评价</button>
							</view>

							<!-- 加载状态 -->
							<view v-else-if="commentsLoading" class="gm-text-secondary gm-py-md gm-font-sm">加载中...</view>

							<!-- 评价列表 -->
							<view v-else>
								<view v-for="(c, idx) in comments" :key="c._id" style="padding-bottom: 20rpx; border-bottom: 1rpx solid #E8EAED;" :style="{ marginBottom: idx < comments.length - 1 ? '20rpx' : '20rpx' }">
									<!-- 评论头部：头像 + 用户名 + 星级 -->
									<view class="gm-flex" style="align-items: center; margin-bottom: 12rpx;">
										<image v-if="commentAvatar(c)" class="gm-avatar gm-avatar-sm" :src="commentAvatar(c)" mode="aspectFill" style="margin-right: 12rpx;" />
										<view v-else class="gm-avatar gm-avatar-sm gm-avatar-text" style="margin-right: 12rpx; font-size: 20rpx;">{{ commentAvatarText(c.nickname) }}</view>
										<view style="flex: 1;">
											<text class="gm-font-md gm-font-bold gm-text-primary">{{ c.nickname || '匿名用户' }}</text>
										</view>
										<view class="gm-stars gm-stars-sm">
											<text v-for="n in 5" :key="n" class="gm-star" :class="{ 'gm-star-filled': n <= c.rating }">★</text>
										</view>
									</view>
									<!-- 评论内容 -->
									<text class="gm-font-sm gm-text-regular" style="display: block; line-height: 1.5; word-break: break-all;">{{ c.content }}</text>
								</view>

								<!-- 写评价按钮 -->
								<button class="gm-btn gm-btn-outlined" style="width: 100%; height: 72rpx; line-height: 72rpx; font-size: 26rpx; border: 2rpx solid #1A73E8; color: #1A73E8; background-color: transparent; margin-top: 20rpx;" @click="openComposer">写评价</button>
							</view>
						</view>

						<!-- 底部间距 -->
						<view style="height: 40rpx;"></view>
					</view>
				</scroll-view>
			</view>
		</view>

		<view v-if="composerVisible" class="gm-overlay gm-overlay-center" @click="closeComposer">
			<view class="gm-dialog" @click.stop>
				<text class="gm-dialog-title">评价「{{ currentSpot.name }}」</text>
				<view class="gm-flex gm-flex-center gm-py-lg">
					<text
						v-for="n in 5"
						:key="n"
						style="font-size: 56rpx; line-height: 1; margin: 0 6rpx; cursor: pointer;"
						:style="{ color: n <= commentRating ? '#FBBC04' : '#DADCE0' }"
						@click="commentRating = n"
					>★</text>
					<text class="gm-font-md gm-font-bold gm-ml-md" style="color: #FBBC04;">{{ ratingText(commentRating) }}</text>
				</view>
				<textarea class="gm-textarea" v-model="commentContent" placeholder="说说你的体验吧～" maxlength="500" />
				<view class="gm-flex gm-mt-lg" style="gap: 12rpx;">
					<button class="gm-btn gm-btn-text gm-flex-1" style="font-size: 26rpx; padding: 0 16rpx; height: 80rpx; line-height: 80rpx;" @click="closeComposer">取消</button>
					<button class="gm-btn gm-btn-filled gm-flex-1" style="font-size: 26rpx; padding: 0 16rpx; height: 80rpx; line-height: 80rpx;" :disabled="submittingComment" @click="submitComment">{{ submittingComment ? '发布中...' : '发布' }}</button>
				</view>
			</view>
		</view>

		<view v-if="feedbackVisible" class="gm-overlay gm-overlay-center" @click="closeFeedback">
			<view class="gm-dialog" @click.stop>
				<text class="gm-dialog-title">反馈问题</text>
				<textarea class="gm-textarea gm-mt-md" v-model="feedbackText" placeholder="如：摊位已搬迁到对面 / 信息有误…" maxlength="300" />
				<view class="gm-flex gm-mt-lg" style="gap: 12rpx;">
					<button class="gm-btn gm-btn-text gm-flex-1" style="font-size: 26rpx; padding: 0 16rpx; height: 80rpx; line-height: 80rpx;" @click="closeFeedback">取消</button>
					<button class="gm-btn gm-btn-filled gm-flex-1" style="font-size: 26rpx; padding: 0 16rpx; height: 80rpx; line-height: 80rpx;" :disabled="submittingFeedback" @click="submitFeedback">{{ submittingFeedback ? '提交中...' : '提交反馈' }}</button>
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
	import { getCategoryIcon, getActionIcon, getIcon } from '@/utils/icons.js'
	import AppLoading from '@/components/AppLoading.vue'
	import AppSkeleton from '@/components/AppSkeleton.vue'
	import AppIcon from '@/components/AppIcon.vue'

	const favoriteObj = uniCloud.importObject('favorite-spots', {
		customUI: true
	})

	const commentObj = uniCloud.importObject('spot-comments', {
		customUI: true
	})

	const categories = [{
		label: '设置住地',
		value: 'all',
		icon: 'location'
	}, {
		label: '餐馆',
		value: 'food',
		icon: 'restaurant'
	}, {
		label: '酒店',
		value: 'view',
		icon: 'hotel'
	}, {
		label: '加油站',
		value: 'toilet',
		icon: 'gasStation'
	}, {
		label: '便民商店',
		value: 'shop',
		icon: 'storefront'
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

	// 底部面板拖动功能
	const bottomSheetHeight = ref(50)
	const dragStartY = ref(0)
	const dragStartHeight = ref(50)
	const isDragging = ref(false)

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

	// 列表：导航到该地点
	function navigateSpot(spot) {
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

	// 列表：致电地点
	function callSpot(spot) {
		if (!spot.phone) {
			uni.showToast({
				title: '暂无电话号码',
				icon: 'none'
			})
			return
		}
		uni.makePhoneCall({
			phoneNumber: spot.phone
		})
	}

	// 列表：分享（复制地点信息）
	function shareSpot(spot) {
		const text = spot.name + (spot.address ? '：' + spot.address : '')
		uni.setClipboardData({
			data: text,
			success: () => {
				uni.showToast({
					title: '已复制地点信息',
					icon: 'none'
				})
			}
		})
	}

	// 列表：保存地点
	function saveSpot(spot) {
		uni.showToast({
			title: '已保存',
			icon: 'success'
		})
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

	// 底部面板拖动功能
	function onDragStart(e) {
		isDragging.value = true
		dragStartY.value = e.touches[0].clientY
		dragStartHeight.value = bottomSheetHeight.value
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
		
		// 获取窗口高度用于计算比例
		const windowInfo = uni.getWindowInfo()
		const screenHeight = windowInfo.windowHeight
		
		// 转换像素差值为vh单位的变化
		// screenHeight = 100vh，所以 1vh = screenHeight/100 像素
		const deltaVh = (deltaY / screenHeight) * 100
		
		// 计算新高度
		let newHeight = dragStartHeight.value + deltaVh
		
		// 限制范围：20vh - 90vh
		newHeight = Math.max(20, Math.min(90, newHeight))
		
		bottomSheetHeight.value = newHeight
	}

	function onDragEnd(e) {
		if (!isDragging.value) return
		isDragging.value = false
		
		e.stopPropagation()
		
		// 吸附到标准高度 (30%, 50%, 70%)
		const height = bottomSheetHeight.value
		if (height < 35) {
			bottomSheetHeight.value = 30
		} else if (height < 60) {
			bottomSheetHeight.value = 50
		} else {
			bottomSheetHeight.value = 70
		}
	}
</script>

<style lang="scss">
	.map {
		width: 100%;
		flex: 1;
		pointer-events: auto;
		z-index: 1;
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

	/* 底部面板 */
	.gm-bottom-sheet {
		background-color: #FFFFFF;
		border-radius: 28rpx 28rpx 0 0;
		box-shadow: 0 -4rpx 16rpx rgba(60, 64, 67, 0.15);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		height: 100%;
		position: relative;
		z-index: 100;
		pointer-events: auto;
		touch-action: manipulation;
	}

	/* 地图列表卡片样式 */
	.gm-place-item-card {
		display: flex;
		align-items: stretch;
		padding: 16rpx 16rpx;
		margin-bottom: 12rpx;
		border-radius: 16rpx;
		background-color: #FFFFFF;
		box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.1);
		transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
		cursor: pointer;
	}

	.gm-place-item-card:active {
		background-color: #F8F9FA;
		box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.15);
		transform: scale(0.98);
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
</style>
