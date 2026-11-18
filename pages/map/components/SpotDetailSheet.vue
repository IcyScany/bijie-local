<template>
	<view class="spot-detail-root">
		<!-- 地点详情 -->
		<DragSheet
			:visible="visible"
			v-model:height="sheetHeight"
			v-model:expanded="sheetExpanded"
			:min-height="sheetMin"
			:max-height="sheetMax"
			@sheet-touchstart="emit('sheet-touching', true)"
			@sheet-touchend="emit('sheet-touching', false)"
		>
			<template #header>
				<!-- 头部：名称 + 关闭 -->
				<view class="gm-flex" style="justify-content: space-between; align-items: flex-start; padding: 0 24rpx 16rpx;">
					<view style="flex: 1; overflow: hidden;">
						<text style="font-size: 36rpx; font-weight: 700; color: #202124; line-height: 1.3; display: block; word-break: break-all;">{{ spot.name }}</text>
						<!-- 分类标签 + 评分（并排） -->
						<view class="gm-flex" style="align-items: center; margin-top: 8rpx; gap: 12rpx; flex-wrap: wrap;">
							<view class="gm-tag" :style="{ color: typeColor(spot.type), backgroundColor: typeBg(spot.type), fontSize: '22rpx', padding: '6rpx 16rpx' }">{{ typeText(spot.type) }}</view>
							<text v-if="!rating.count" class="gm-font-sm gm-text-secondary">暂无评价</text>
							<view v-else class="gm-flex" style="align-items: center;">
								<text class="gm-place-rating-num">{{ rating.avg }}</text>
								<view class="gm-place-rating-stars">
									<view class="gm-place-rating-stars-bg">★★★★★</view>
									<view class="gm-place-rating-stars-fill" :style="{ width: starPercent(rating.avg) }">★★★★★</view>
								</view>
								<text class="gm-place-rating-count">({{ formatCount(rating.count) }})</text>
							</view>
						</view>
					</view>
					<button class="gm-btn" style="width: 56rpx; height: 56rpx; min-width: 0; padding: 0; border-radius: 50%; background-color: #F1F3F4; color: #202124; font-size: 28rpx; line-height: 1; display: flex; align-items: center; justify-content: center;" @click.stop="emit('close')">✕</button>
				</view>
			</template>

			<!-- 滚动内容区 -->
			<scroll-view style="flex: 1; height: 0; min-height: 0;" :scroll-y="sheetExpanded" :show-scrollbar="false">
					<!-- 内容区 -->
					<view style="padding: 0 24rpx 24rpx;">
						<!-- 快速操作按钮 -->
						<view class="gm-flex" style="gap: 12rpx; margin-bottom: 24rpx; flex-wrap: wrap;">
							<button class="gm-btn gm-btn-filled" style="display: flex; align-items: center; justify-content: center; height: 68rpx; line-height: 1; padding: 0 26rpx; font-size: 27rpx;" :disabled="!hasCoord" @click="emit('route')">
								<app-icon icon="directions" width="34rpx" style="margin-right: 8rpx;" />路线
							</button>
							<button class="gm-btn gm-btn-tonal" style="display: flex; align-items: center; justify-content: center; height: 68rpx; line-height: 1; padding: 0 26rpx; font-size: 27rpx;" @click="emit('favorite')">
								<app-icon icon="bookmarkStar" width="34rpx" style="margin-right: 8rpx;" />{{ favorite ? '已收藏' : '收藏' }}
							</button>
							<button class="gm-btn gm-btn-tonal" style="display: flex; align-items: center; justify-content: center; height: 68rpx; line-height: 1; padding: 0 26rpx; font-size: 27rpx;" @click="emit('addImage')">
								<app-icon icon="photoCamera" width="34rpx" style="margin-right: 8rpx;" />添加图片
							</button>
							<button class="gm-btn gm-btn-tonal" style="display: flex; align-items: center; justify-content: center; height: 68rpx; line-height: 1; padding: 0 26rpx; font-size: 27rpx;" @click="openFeedback">
								<app-icon icon="rateReview" width="34rpx" style="margin-right: 8rpx;" />共创
							</button>
						</view>

						<!-- 图片：1 张铺满、2 张并排均分、3 张以上只占一行并横向滚动 -->
						<image
							v-if="images.length === 1"
							class="spot-image-thumb spot-image-single"
							:src="images[0]"
							mode="aspectFill"
							@click="emit('preview', 0)"
						></image>
						<view v-else-if="images.length === 2" class="spot-images-two">
							<image
								v-for="(img, i) in images"
								:key="i"
								class="spot-image-thumb spot-image-half"
								:src="img"
								mode="aspectFill"
								@click="emit('preview', i)"
							></image>
						</view>
						<scroll-view v-else-if="images.length > 2" class="spot-images" scroll-x :show-scrollbar="false">
							<image
								v-for="(img, i) in images"
								:key="i"
								class="spot-image-thumb"
								:src="img"
								mode="aspectFill"
								@click="emit('preview', i)"
							></image>
						</scroll-view>

						<!-- 标签页 -->
						<view class="gm-tabs" style="margin-bottom: 24rpx;">
							<view class="gm-tab" :class="{ 'gm-tab-active': activeTab === 'overview' }" @click="activeTab = 'overview'">概览</view>
							<view class="gm-tab" :class="{ 'gm-tab-active': activeTab === 'reviews' }" @click="activeTab = 'reviews'">评价</view>
						</view>

						<!-- 概览 -->
						<view v-if="activeTab === 'overview'">
							<view v-if="spot.address" class="gm-flex" style="align-items: flex-start; margin-bottom: 20rpx;">
								<app-icon icon="location" size="md" style="margin-right: 16rpx; flex-shrink: 0; margin-top: 2rpx;" />
								<view style="flex: 1;">
									<text class="gm-font-sm gm-text-secondary" style="display: block;">地址</text>
									<text class="gm-font-md gm-text-primary" style="display: block; margin-top: 6rpx; line-height: 1.4; word-break: break-all;">{{ spot.address }}</text>
								</view>
							</view>

							<view v-if="spot.remark" class="gm-flex" style="align-items: flex-start; margin-bottom: 20rpx;">
								<app-icon icon="locationOn" size="md" style="margin-right: 16rpx; flex-shrink: 0; margin-top: 2rpx;" />
								<view style="flex: 1;">
									<text class="gm-font-sm gm-text-secondary" style="display: block;">备注</text>
									<text class="gm-font-md gm-text-primary" style="display: block; margin-top: 6rpx; line-height: 1.4;">{{ spot.remark }}</text>
								</view>
							</view>

							<view v-if="spot.contributor_name" class="gm-flex" style="align-items: center; margin-bottom: 20rpx; padding-bottom: 20rpx; border-bottom: 1rpx solid #E8EAED;">
								<app-icon icon="photoCamera" size="md" style="margin-right: 16rpx; flex-shrink: 0;" />
								<text class="gm-font-md gm-text-primary gm-flex-1">由 {{ spot.contributor_name }} 共创</text>
								<text style="font-size: 24rpx; color: #9AA0A6;">›</text>
							</view>

							<view v-if="spot.create_date" class="gm-flex" style="align-items: center; justify-content: space-between; margin-bottom: 20rpx;">
								<text class="gm-font-sm gm-text-secondary">收录时间</text>
								<text class="gm-font-sm gm-text-primary">{{ formatTime(spot.create_date) }}</text>
							</view>
						</view>

						<!-- 评价 -->
						<view v-if="activeTab === 'reviews'">
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
											<text class="gm-font-sm gm-text-secondary" style="display: block; margin-top: 2rpx;">{{ formatTime(c.create_date) }}</text>
										</view>
										<view class="gm-stars gm-stars-sm">
											<text v-for="n in 5" :key="n" class="gm-star" :class="{ 'gm-star-filled': n <= c.rating }">★</text>
										</view>
										<app-icon v-if="canRemoveComment(c)" class="comment-del" icon="delete" size="lg" color="error" clickable @click="deleteComment(c)" />
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
		</DragSheet>

		<!-- 写评价弹窗 -->
		<view v-if="composerVisible" class="gm-overlay gm-overlay-center" @click="closeComposer">
			<view class="gm-dialog" @click.stop>
				<text class="gm-dialog-title">评价「{{ spot.name }}」</text>
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

		<!-- 反馈弹窗 -->
		<view v-if="feedbackVisible" class="gm-overlay gm-overlay-center" @click="closeFeedback">
			<view class="gm-dialog" @click.stop>
				<text class="gm-dialog-title">反馈问题</text>
				<textarea class="gm-textarea gm-mt-md" v-model="feedbackText" placeholder="如：摊位已搬迁到对面 / 信息有误…" maxlength="300" />
				<view class="feedback-more" @click="goDetailedUpdate">跳转到更新页面，填写更多信息</view>
				<view class="gm-flex gm-mt-lg" style="gap: 12rpx;">
					<button class="gm-btn gm-btn-text gm-flex-1" style="font-size: 26rpx; padding: 0 16rpx; height: 80rpx; line-height: 80rpx;" @click="closeFeedback">取消</button>
					<button class="gm-btn gm-btn-filled gm-flex-1" style="font-size: 26rpx; padding: 0 16rpx; height: 80rpx; line-height: 80rpx;" :disabled="submittingFeedback" @click="submitFeedback">{{ submittingFeedback ? '提交中...' : '提交反馈' }}</button>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
	import { ref, watch, onMounted } from 'vue'
	import { ensureLogin, getToken, isAuthError, relogin, isAdmin, getOpenid } from '@/utils/auth.js'
	import { getTypeLabel, getTypeColor, getTypeBg } from '@/utils/placeTypes.js'
	import AppIcon from '@/components/AppIcon.vue'
	import DragSheet from '@/components/DragSheet.vue'

	const spotsObj = uniCloud.importObject('spots', {
		customUI: true
	})

	const commentObj = uniCloud.importObject('spot-comments', {
		customUI: true
	})

	const props = defineProps({
		visible: {
			type: Boolean,
			default: false
		},
		spot: {
			type: Object,
			default: () => ({})
		},
		rating: {
			type: Object,
			default: () => ({
				avg: 0,
				count: 0
			})
		},
		images: {
			type: Array,
			default: () => []
		},
		comments: {
			type: Array,
			default: () => []
		},
		commentsLoading: {
			type: Boolean,
			default: false
		},
		hasCoord: {
			type: Boolean,
			default: false
		},
		avatarMap: {
			type: Object,
			default: () => ({})
		},
		favorite: {
			type: Boolean,
			default: false
		},
		// 打开时是否直接展开到最大高度（列表进入为 true，地图点选为 false）
		full: {
			type: Boolean,
			default: false
		}
	})

	const emit = defineEmits(['close', 'preview', 'route', 'comment-added', 'comment-removed', 'favorite', 'addImage', 'sheet-touching'])

	// 标签：overview | reviews
	const activeTab = ref('overview')

	// 面板高度：默认半屏，可上滑展开
	// 范围与地图列表一致：最高到筛选栏下方；最低露出到操作按钮
	const sheetHeight = ref(50)
	const sheetExpanded = ref(false)
	const sheetMin = ref(40)
	const sheetMax = ref(90)

	function measureRange() {
		let info = {}
		try {
			info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()
		} catch (e) {
			info = {}
		}
		const winH = info.windowHeight || 667
		const winW = info.windowWidth || 375
		const rpxToPx = winW / 750
		// 最高：到分类筛选栏下方（与列表一致）
		const topbarPx = 210 * rpxToPx
		const maxVh = Math.max(30, ((winH - topbarPx) / winH) * 100)
		// 最低：露出到操作按钮
		const minPx = 330 * rpxToPx
		const minVh = Math.max(16, (minPx / winH) * 100)
		sheetMax.value = Math.round(maxVh * 10) / 10
		sheetMin.value = Math.min(Math.round(minVh * 10) / 10, sheetMax.value - 5)
	}

	onMounted(measureRange)

	watch(() => props.visible, (v) => {
		if (v) {
			measureRange()
			// 列表进入：直接全屏展开；地图点选：半屏
			sheetHeight.value = props.full ?
				sheetMax.value :
				Math.min(sheetMax.value, Math.max(sheetMin.value, 50))
			activeTab.value = 'overview'
		}
	})

	// 写评价
	const composerVisible = ref(false)
	const commentRating = ref(5)
	const commentContent = ref('')
	const submittingComment = ref(false)

	// 反馈
	const feedbackVisible = ref(false)
	const feedbackText = ref('')
	const submittingFeedback = ref(false)

	function typeText(type) {
		return getTypeLabel(type)
	}

	function typeColor(type) {
		return getTypeColor(type)
	}

	function typeBg(type) {
		return getTypeBg(type)
	}

	function commentAvatar(item) {
		return item.avatar ? (props.avatarMap[item.avatar] || '') : ''
	}

	function commentAvatarText(name) {
		return name ? String(name).charAt(0) : '用'
	}

	// 是否可删除该条评价（本人或管理员）
	function canRemoveComment(item) {
		if (!item || !item.openid) return false
		return item.openid === getOpenid() || isAdmin()
	}

	// 删除评价（二次确认，仅本人或管理员）
	function deleteComment(item) {
		if (!item || !item._id) return
		const id = item._id
		uni.showModal({
			title: '删除评价',
			content: '确定删除这条评价吗？',
			success: async (res) => {
				if (!res.confirm) return
				try {
					await ensureLogin()
					try {
						await commentObj.remove(id, getToken())
					} catch (err) {
						if (!isAuthError(err)) throw err
						await relogin()
						await commentObj.remove(id, getToken())
					}
					emit('comment-removed', id)
					uni.showToast({
						title: '已删除',
						icon: 'success'
					})
				} catch (err) {
					uni.showToast({
						title: (err && (err.errMsg || err.message)) || '删除失败',
						icon: 'none'
					})
				}
			}
		})
	}

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

	// 评分占比（用于半星裁剪）
	function starPercent(avg) {
		const v = Number(avg) || 0
		return Math.max(0, Math.min(100, (v / 5) * 100)) + '%'
	}

	// 数量千分位
	function formatCount(n) {
		return String(Number(n) || 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
	}

	// 时间格式化（相对时间 / 日期）
	function formatTime(ts) {
		if (!ts) return ''
		const d = new Date(Number(ts))
		const diff = Date.now() - d.getTime()
		const MIN = 60000
		const HOUR = 3600000
		const DAY = 86400000
		if (diff < MIN) return '刚刚'
		if (diff < HOUR) return Math.floor(diff / MIN) + '分钟前'
		if (diff < DAY) return Math.floor(diff / HOUR) + '小时前'
		if (diff < 7 * DAY) return Math.floor(diff / DAY) + '天前'
		const y = d.getFullYear()
		const m = d.getMonth() + 1
		const day = d.getDate()
		return y + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day)
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
		const spot = props.spot
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
				emit('comment-added', item)
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

	// 反馈（更新）
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
		const spot = props.spot
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
			report_type: 'update',
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
				await spotsObj.submit(payload, getToken())
			} catch (err) {
				if (!isAuthError(err)) throw err
				await relogin()
				await spotsObj.submit(payload, getToken())
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

	// 跳转到「补充/更新」页的详细更新表单，带上当前地点与已填写的反馈
	function goDetailedUpdate() {
		const spot = props.spot
		if (!spot || !spot._id) return
		uni.setStorageSync('contribute_prefill', {
			mode: 'update',
			target_id: spot._id,
			name: spot.name,
			type: spot.type,
			address: spot.address || '',
			longitude: spot.longitude,
			latitude: spot.latitude,
			reason: String(feedbackText.value || '').trim()
		})
		feedbackVisible.value = false
		uni.switchTab({
			url: '/pages/contribute/contribute'
		})
	}
</script>

<style lang="scss" scoped>
	/* 图片：1 张铺满、2 张并排均分、3 张以上只占一行并横向滚动 */
	.spot-images {
		width: 100%;
		white-space: nowrap;
		margin-bottom: 16rpx;
	}

	.spot-image-thumb {
		display: inline-block;
		width: 226rpx;
		height: 226rpx;
		border-radius: 12rpx;
		overflow: hidden;
		background-color: #F1F3F4;
		margin-right: 12rpx;
		vertical-align: top;
	}

	/* 仅一张图：大图铺满内容区 */
	.spot-image-single {
		display: block;
		width: 100%;
		height: 552rpx;
		border-radius: 16rpx;
		margin-right: 0;
	}

	/* 两张图：并排均分 */
	.spot-images-two {
		display: flex;
		width: 100%;
		margin-bottom: 16rpx;
	}

	.spot-image-half {
		flex: 1;
		min-width: 0;
		height: 265rpx;
		margin-right: 12rpx;
	}

	.spot-image-half:last-child {
		margin-right: 0;
	}

	/* 反馈弹窗：跳转详细更新链接 */
	.feedback-more {
		margin-top: 16rpx;
		font-size: 26rpx;
		color: #1A73E8;
	}

	/* 评分（与列表保持一致） */
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
</style>

<style lang="scss">
	/* 自定义组件内的 button 不受全局样式隔离影响，需在本组件内单独去除默认 ::after 边框 */
	button::after {
		border: none;
	}

	/* 评价删除按钮 */
	.comment-del {
		flex-shrink: 0;
		margin-left: 16rpx;
	}
</style>
