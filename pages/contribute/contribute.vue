<template>
	<view class="page">
		<view class="switch">
			<view class="switch-item" :class="{ active: reportType === 'new' }" @click="switchReportType('new')">补充新地点</view>
			<view class="switch-item" :class="{ active: reportType === 'correction' }" @click="switchReportType('correction')">纠错反馈</view>
		</view>

		<scroll-view class="form-scroll" scroll-y>
			<view class="form">
				<template v-if="reportType === 'new'">
					<view class="field">
						<view class="locate-btn" @click="chooseLocation">
							<text class="locate-icon">📍</text>
							<text>地图选点</text>
						</view>
						<text v-if="hasLocation" class="locate-tip">已选择位置{{ form.address ? '：' + form.address : '' }}</text>
						<text v-else class="locate-tip">点击地图搜索并选择位置</text>
					</view>

					<view class="field">
						<text class="label">地点名称 *</text>
						<input class="input" v-model="form.name" placeholder="如：某某烙锅摊" />
					</view>

					<view class="field">
						<text class="label">类型 *</text>
						<picker :range="typeOptions" range-key="label" @change="onTypeChange">
							<view class="picker">{{ typeText(form.type) }}</view>
						</picker>
					</view>

					<view class="field">
						<text class="label">地址 *</text>
						<input class="input" v-model="form.address" placeholder="请输入详细地址" />
					</view>

					<view class="field">
						<text class="label">描述</text>
						<textarea class="textarea" v-model="form.remark" placeholder="简单描述（特色、营业时间等）" />
					</view>
				</template>

				<template v-else>
					<view class="field">
						<text class="label">要纠错的地点 *</text>
						<picker :range="spotNames" @change="onTargetChange">
							<view class="picker">{{ targetIndex > -1 ? spotNames[targetIndex] : '请选择地点' }}</view>
						</picker>
					</view>

					<view class="field">
						<text class="label">纠错说明 *</text>
						<textarea class="textarea" v-model="form.report_reason" placeholder="如：摊位已搬迁到对面" />
					</view>
				</template>

				<view class="field">
					<text class="label">现场图片（可选，最多9张）</text>
					<view class="image-list">
						<view v-for="(img, i) in form.images" :key="i" class="image-item">
							<image class="image-thumb" :src="imgUrl(img)" mode="aspectFill" @click="previewImages(i)"></image>
							<text class="image-remove" @click="removeImage(i)">×</text>
						</view>
						<view v-if="form.images.length < 9" class="image-add" @click="chooseImages">
							<text class="image-add-icon">+</text>
							<text class="image-add-text">上传</text>
						</view>
					</view>
				</view>

				<view class="field">
					<text class="label">联系方式（可选）</text>
					<input class="input" v-model="form.contact" placeholder="便于核实问题" />
				</view>

				<text class="tips">提交后需管理员审核通过才会展示在地图上，感谢你的贡献！</text>
			</view>
		</scroll-view>

		<view class="submit-bar">
			<button class="submit" :disabled="submitting" @click="submit">{{ submitting ? '提交中...' : '提交审核' }}</button>
		</view>
	</view>
</template>

<script setup>
	import { ref, computed } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'
	import { getToken } from '@/utils/auth.js'
	import { resolveCloudFiles } from '@/utils/cloudFile.js'

	const favoriteObj = uniCloud.importObject('favorite-spots', {
		customUI: true
	})

	const typeOptions = [{
		label: '美食',
		value: 'food'
	}, {
		label: '景点',
		value: 'view'
	}, {
		label: '便民厕所',
		value: 'toilet'
	}, {
		label: '便民商店',
		value: 'shop'
	}, {
		label: '其他',
		value: 'other'
	}]

	const reportType = ref('new')
	const form = ref({
		name: '',
		type: 'food',
		address: '',
		longitude: '',
		latitude: '',
		remark: '',
		report_reason: '',
		contact: '',
		images: []
	})
	const spots = ref([])
	const targetIndex = ref(-1)
	const submitting = ref(false)
	const uploading = ref(false)
	const imageMap = ref({})

	// 云存储 fileID 需转换为临时链接后才能显示
	function imgUrl(id) {
		return id ? (imageMap.value[id] || '') : ''
	}

	async function resolveImages(ids) {
		const pending = (ids || []).filter(id => typeof id === 'string' && id && !imageMap.value[id])
		if (!pending.length) return
		const map = await resolveCloudFiles(pending)
		imageMap.value = Object.assign({}, imageMap.value, map)
	}

	const hasLocation = computed(() => {
		return form.value.longitude !== '' && form.value.latitude !== ''
	})

	const spotNames = computed(() => {
		return spots.value.map(item => item.name)
	})

	onLoad(() => {
		loadSpots()
	})

	function showError(err) {
		const msg = (err && (err.errMsg || err.message)) || '操作失败'
		uni.showToast({
			title: msg,
			icon: 'none'
		})
	}

	function typeText(type) {
		const item = typeOptions.find(opt => opt.value === type)
		return item ? item.label : '其他'
	}

	// 加载已通过审核的地点，供纠错时选择
	async function loadSpots() {
		try {
			const res = await favoriteObj.getList({
				status: 'approved',
				page: 1,
				pageSize: 200
			})
			spots.value = res.list
		} catch (err) {
			showError(err)
		}
	}

	// 切换地点类型
	function onTypeChange(e) {
		form.value.type = typeOptions[e.detail.value].value
	}

	function switchReportType(value) {
		reportType.value = value
	}

	function onTargetChange(e) {
		targetIndex.value = Number(e.detail.value)
	}

	// 跳转地图选点页并将结果回填到表单
	function chooseLocation() {
		openPickerPage()
	}

	function openPickerPage() {
		uni.navigateTo({
			url: '/pages/location-picker/location-picker?longitude=' + encodeURIComponent(form.value.longitude) + '&latitude=' + encodeURIComponent(form.value.latitude),
			events: {
				selectLocation: (data) => {
					form.value.longitude = String(data.longitude)
					form.value.latitude = String(data.latitude)
					if (data.name) {
						form.value.name = data.name
					}
					if (data.address) {
						form.value.address = data.address
					}
				}
			}
		})
	}

	function chooseImages() {
		const remain = 9 - form.value.images.length
		if (remain <= 0) return

		uni.chooseImage({
			count: remain,
			sizeType: ['compressed'],
			sourceType: ['album', 'camera'],
			success: (res) => {
				uploadImages(res.tempFilePaths)
			}
		})
	}

	// 上传现场图片到云存储
	async function uploadImages(filePaths) {
		if (uploading.value) return
		uploading.value = true
		uni.showLoading({
			title: '上传中...'
		})
		try {
			for (let i = 0; i < filePaths.length; i++) {
				const filePath = filePaths[i]
				const ext = (filePath.split('.').pop() || 'jpg').toLowerCase()
				const cloudPath = 'spots/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext
				const uploadRes = await uniCloud.uploadFile({
					filePath,
					cloudPath
				})
				form.value.images.push(uploadRes.fileID)
			}
			await resolveImages(form.value.images)
		} catch (err) {
			showError(err)
		} finally {
			uploading.value = false
			uni.hideLoading()
		}
	}

	async function previewImages(index) {
		const ids = form.value.images
		const map = await resolveCloudFiles(ids)
		const urls = ids.map(id => map[id] || id)
		uni.previewImage({
			urls,
			current: index
		})
	}

	function removeImage(index) {
		form.value.images.splice(index, 1)
	}

	// 提交补充或纠错信息，进入待审核
	async function submit() {
		const payload = {
			report_type: reportType.value,
			contact: form.value.contact,
			images: form.value.images
		}

		if (reportType.value === 'new') {
			if (!form.value.name.trim()) {
				uni.showToast({
					title: '请填写地点名称',
					icon: 'none'
				})
				return
			}
			if (!form.value.type) {
				uni.showToast({
					title: '请选择地点类型',
					icon: 'none'
				})
				return
			}
			if (!form.value.address.trim()) {
				uni.showToast({
					title: '请输入或选择地址',
					icon: 'none'
				})
				return
			}
			payload.name = form.value.name
			payload.type = form.value.type
			payload.address = form.value.address
			payload.longitude = form.value.longitude
			payload.latitude = form.value.latitude
			payload.remark = form.value.remark
		} else {
			if (targetIndex.value < 0) {
				uni.showToast({
					title: '请选择要纠错的地点',
					icon: 'none'
				})
				return
			}
			if (!form.value.report_reason.trim()) {
				uni.showToast({
					title: '请填写纠错说明',
					icon: 'none'
				})
				return
			}
			const target = spots.value[targetIndex.value]
			payload.name = target.name
			payload.type = target.type
			payload.address = target.address
			payload.longitude = target.longitude
			payload.latitude = target.latitude
			payload.target_id = target._id
			payload.report_reason = form.value.report_reason
		}

		submitting.value = true
		try {
			await favoriteObj.submit(payload, getToken())
			uni.showToast({
				title: '已提交，等待审核',
				icon: 'success'
			})
			setTimeout(() => {
				form.value = {
					name: '',
					type: 'food',
					address: '',
					longitude: '',
					latitude: '',
					remark: '',
					report_reason: '',
					contact: '',
					images: []
				}
				reportType.value = 'new'
				targetIndex.value = -1
			}, 1200)
		} catch (err) {
			showError(err)
		} finally {
			submitting.value = false
		}
	}
</script>

<style lang="scss">
	.page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background-color: $bg-page;
	}

	.switch {
		display: flex;
		margin: $space-md $space-md 0;
		padding: 8rpx;
		background-color: $bg-fill;
		border-radius: $radius-pill;
	}

	.switch-item {
		flex: 1;
		text-align: center;
		padding: 18rpx 0;
		font-size: $fs-md;
		font-weight: 500;
		color: $text-regular;
		border-radius: $radius-pill;
		transition: all $duration-fast ease;
		
		&:active {
			opacity: 0.85;
		}
	}

	.switch-item.active {
		color: $text-inverse;
		background-image: $brand-gradient;
		box-shadow: $brand-shadow;
	}

	.form-scroll {
		flex: 1;
	}

	.form {
		background-color: $bg-card;
		margin: $space-md;
		padding: $space-lg;
		border-radius: $radius-lg;
		box-shadow: $shadow-card;
	}

	.field {
		margin-bottom: $space-md;
	}

	.field-row {
		display: flex;
		margin-bottom: $space-md;
	}

	.field-col {
		flex: 1;
	}

	.field-col:first-child {
		margin-right: 20rpx;
	}

	.label {
		display: block;
		font-size: $fs-sm;
		font-weight: 500;
		color: $text-regular;
		margin-bottom: 12rpx;
	}

	.input {
		height: 88rpx;
		padding: 0 $space-md;
		font-size: $fs-md;
		color: $text-main;
		background-color: $bg-fill;
		border-radius: $radius-md;
		transition: all $duration-fast ease;
		
		&:focus {
			background-color: $bg-fill-hover;
		}
	}

	.picker {
		height: 88rpx;
		line-height: 88rpx;
		padding: 0 $space-md;
		font-size: $fs-md;
		color: $text-main;
		background-color: $bg-fill;
		border-radius: $radius-md;
		transition: all $duration-fast ease;
		
		&:active {
			background-color: $bg-fill-hover;
		}
	}

	.textarea {
		width: 100%;
		height: 168rpx;
		padding: 20rpx $space-md;
		font-size: $fs-md;
		color: $text-main;
		background-color: $bg-fill;
		border-radius: $radius-md;
		transition: all $duration-fast ease;
		
		&:focus {
			background-color: $bg-fill-hover;
		}
	}

	.locate-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 88rpx;
		font-size: $fs-md;
		font-weight: 500;
		color: $brand;
		background-color: $brand-soft;
		border-radius: $radius-md;
		transition: all $duration-fast ease;
		
		&:active {
			transform: scale(0.98);
		}
	}

	.locate-icon {
		margin-right: 8rpx;
	}

	.locate-tip {
		display: block;
		margin-top: 12rpx;
		font-size: $fs-sm;
		color: $text-secondary;
		line-height: 1.5;
	}

	.image-list {
		display: flex;
		flex-wrap: wrap;
	}

	.image-item {
		position: relative;
		width: 164rpx;
		height: 164rpx;
		margin: 0 16rpx 16rpx 0;
	}

	.image-thumb {
		width: 164rpx;
		height: 164rpx;
		border-radius: $radius-sm;
		background-color: $bg-fill;
	}

	.image-remove {
		position: absolute;
		top: -12rpx;
		right: -12rpx;
		width: 44rpx;
		height: 44rpx;
		line-height: 38rpx;
		text-align: center;
		font-size: $fs-lg;
		color: #ffffff;
		background-color: rgba(0, 0, 0, 0.65);
		border-radius: 50%;
		transition: all $duration-fast ease;
		
		&:active {
			transform: scale(0.9);
		}
	}

	.image-add {
		width: 164rpx;
		height: 164rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background-color: $bg-fill;
		border: 2rpx dashed $border-strong;
		border-radius: $radius-sm;
		transition: all $duration-fast ease;
		
		&:active {
			background-color: $bg-fill-hover;
		}
	}

	.image-add-icon {
		font-size: 52rpx;
		color: $text-placeholder;
		line-height: 1;
	}

	.image-add-text {
		margin-top: 8rpx;
		font-size: $fs-sm;
		color: $text-secondary;
	}

	.tips {
		display: block;
		margin-top: 16rpx;
		font-size: $fs-sm;
		color: $warning;
		line-height: 1.6;
	}

	.submit-bar {
		padding: $space-md;
		padding-bottom: calc(24rpx + constant(safe-area-inset-bottom));
		padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
		background-color: $bg-card;
		box-shadow: 0 -8rpx 24rpx rgba(29, 33, 41, 0.06);
	}

	.submit {
		font-size: $fs-lg;
		font-weight: 600;
		color: $text-inverse;
		background-image: $brand-gradient;
		box-shadow: $brand-shadow;
		border-radius: $radius-pill;
		transition: all $duration-fast ease;
		
		&:active {
			transform: scale(0.98);
		}
	}
</style>
