<template>
	<view class="spot-detail-root">
		<!-- 地点详情 -->
		<view v-if="visible" class="gm-overlay" @click="emit('close')">
			<view class="gm-bottom-sheet spot-detail-sheet" @click.stop>
				<!-- 拖动条 -->
				<view class="gm-bottom-sheet-handle">
					<view class="gm-bottom-sheet-bar"></view>
				</view>

				<!-- 滚动内容区 -->
				<scroll-view style="flex: 1; height: 0; min-height: 0;" scroll-y :show-scrollbar="false">
					<!-- 图片轮播区 -->
					<scroll-view v-if="images.length" style="width: 100%; height: 300rpx; white-space: nowrap;" scroll-x :show-scrollbar="false">
						<image
							v-for="(img, i) in images"
							:key="i"
							style="width: 100%; height: 300rpx; display: inline-block; background-color: #F1F3F4;"
							:src="img"
							mode="aspectFill"
							@click="emit('preview', i)"
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
								<text style="font-size: 36rpx; font-weight: 700; color: #202124; line-height: 1.3; display: block; word-break: break-all;">{{ spot.name }}</text>
								<!-- 无评价提示 -->
								<text v-if="!rating.count" class="gm-font-sm gm-text-secondary" style="display: block; margin-top: 8rpx;">暂无评价</text>
								<!-- 有评价的显示 -->
								<view v-else class="gm-flex gm-mt-sm" style="align-items: center;">
									<view class="gm-stars gm-stars-sm">
										<text v-for="n in 5" :key="n" class="gm-star" :class="{ 'gm-star-filled': n <= Math.round(rating.avg) }">★</text>
									</view>
									<text class="gm-font-md gm-font-bold gm-ml-xs" style="color: #FBBC04;">{{ rating.avg }}</text>
									<text class="gm-font-sm gm-text-secondary gm-ml-xs">({{ rating.count }})</text>
								</view>
							</view>
							<button class="gm-btn gm-btn-text" style="height: 64rpx; line-height: 64rpx; padding: 0 16rpx; font-size: 36rpx; margin: -16rpx -16rpx 0 0;" @click="emit('close')">✕</button>
						</view>

						<!-- 分类标签 -->
						<view class="gm-tag" :style="{ color: typeColor(spot.type), backgroundColor: typeBg(spot.type), fontSize: '22rpx', padding: '8rpx 16rpx', marginBottom: '24rpx' }">{{ typeText(spot.type) }}</view>

						<!-- 快速操作按钮 -->
						<view class="gm-flex" style="gap: 12rpx; margin-bottom: 24rpx; flex-wrap: wrap;">
							<button class="gm-btn gm-btn-filled" style="flex: 1; min-width: 150rpx; height: 72rpx; line-height: 72rpx; font-size: 26rpx; padding: 0 24rpx;" :disabled="!hasCoord" @click="emit('route')">
								<app-icon icon="directions" size="sm" style="margin-right: 8rpx; vertical-align: -2rpx;" />路线
							</button>
							<button class="gm-btn gm-btn-tonal" style="flex: 1; min-width: 150rpx; height: 72rpx; line-height: 72rpx; font-size: 26rpx; padding: 0 24rpx;">
								<app-icon icon="call" size="sm" style="margin-right: 8rpx; vertical-align: -2rpx;" />致电
							</button>
							<button class="gm-btn gm-btn-tonal" style="flex: 1; min-width: 150rpx; height: 72rpx; line-height: 72rpx; font-size: 26rpx; padding: 0 24rpx;" @click="openFeedback">
								<app-icon icon="photoCamera" size="sm" style="margin-right: 8rpx; vertical-align: -2rpx;" />纠错
							</button>
						</view>

						<!-- 标签页 -->
						<view class="gm-tabs" style="margin-bottom: 24rpx;">
							<view class="gm-tab gm-tab-active">概览</view>
							<view class="gm-tab">简介</view>
						</view>

						<!-- 信息行 -->
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
							<text class="gm-font-md gm-text-primary gm-flex-1">{{ spot.contributor_name }} 贡献</text>
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
				<view class="gm-flex gm-mt-lg" style="gap: 12rpx;">
					<button class="gm-btn gm-btn-text gm-flex-1" style="font-size: 26rpx; padding: 0 16rpx; height: 80rpx; line-height: 80rpx;" @click="closeFeedback">取消</button>
					<button class="gm-btn gm-btn-filled gm-flex-1" style="font-size: 26rpx; padding: 0 16rpx; height: 80rpx; line-height: 80rpx;" :disabled="submittingFeedback" @click="submitFeedback">{{ submittingFeedback ? '提交中...' : '提交反馈' }}</button>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
	import { ref } from 'vue'
	import { ensureLogin, getToken, isAuthError, relogin } from '@/utils/auth.js'
	import { getTypeLabel, getTypeColor, getTypeBg } from '@/utils/placeTypes.js'
	import AppIcon from '@/components/AppIcon.vue'

	const favoriteObj = uniCloud.importObject('favorite-spots', {
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
		}
	})

	const emit = defineEmits(['close', 'preview', 'route', 'comment-added'])

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

	// 反馈（纠错）
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
</script>

<style lang="scss" scoped>
	.spot-detail-sheet {
		width: 100%;
		height: 90vh;
		display: flex;
		flex-direction: column;
		animation: gm-slide-up 0.25s cubic-bezier(0.4, 0, 0.2, 1);
	}
</style>
