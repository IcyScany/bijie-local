<template>
	<view class="page">
		<view class="switch">
			<view class="switch-item" :class="{ active: reportType === 'new' }" @click="switchReportType('new')">补充新地点</view>
			<view class="switch-item" :class="{ active: reportType === 'update' }" @click="switchReportType('update')">更新反馈</view>
		</view>

		<scroll-view class="form-scroll" scroll-y>
			<view class="form">
				<view v-if="reportType === 'new'">
					<view class="field">
						<view class="locate-btn" @click="chooseLocation">
							<text class="locate-icon">📍</text>
							<text>地图选点</text>
						</view>
						<text v-if="hasLocation" class="locate-tip">已选择位置{{ form.address ? '：' + form.address : '' }}</text>
						<text v-else class="locate-tip">点击地图搜索并选择位置</text>
					</view>

					<view class="field">
						<text class="label">地点名称（必填）</text>
						<input class="input" v-model="form.name" placeholder="如：某某烙锅摊" />
					</view>

					<view class="field">
						<text class="label">类型（必填）</text>
						<picker :range="typeOptions" range-key="label" @change="onTypeChange">
							<view class="picker">{{ typeText(form.type) }}</view>
						</picker>
					</view>

					<view class="field">
						<text class="label">地址（必填）</text>
						<input class="input" v-model="form.address" placeholder="请输入详细地址" />
					</view>

					<view class="field">
						<text class="label">描述</text>
						<textarea class="textarea" v-model="form.remark" placeholder="简单描述（特色、营业时间等）" />
					</view>
				</view>

				<view v-else>
					<view class="field">
						<text class="label">要更新的地点（必填）</text>
						<view class="picker picker-select" @click="openSpotPicker">
							<text :class="{ 'picker-placeholder': targetIndex < 0 }">{{ targetIndex > -1 ? spotNames[targetIndex] : '请选择地点' }}</text>
							<text class="picker-arrow">›</text>
						</view>
					</view>

					<view class="field">
						<text class="label">更新说明（必填）</text>
						<textarea class="textarea" v-model="form.report_reason" placeholder="如：摊位已搬迁到对面" />
					</view>
				</view>

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

				<text class="tips">提交后需管理员审核通过才会展示在地图上，感谢你的共创！</text>
			</view>
		</scroll-view>

		<view class="submit-bar">
			<button class="submit" :disabled="submitting" @click="submit">{{ submitting ? '提交中...' : '提交审核' }}</button>
		</view>

		<!-- 选择地点弹窗（带搜索） -->
		<view v-if="spotPickerVisible" class="spot-mask" @click="closeSpotPicker">
			<view class="spot-panel" @click.stop>
				<view class="spot-panel-head">
					<text class="spot-panel-title">选择要更新的地点</text>
					<text class="spot-panel-close" @click="closeSpotPicker">✕</text>
				</view>
				<input class="spot-search" v-model="spotKeyword" placeholder="搜索地点名称或地址" confirm-type="search" />
				<scroll-view class="spot-list" scroll-y>
					<view
						v-for="item in filteredSpots"
						:key="item._id"
						class="spot-option"
						:class="{ 'spot-option-active': targetIndex > -1 && spots[targetIndex] && spots[targetIndex]._id === item._id }"
						@click="selectSpot(item)"
					>
						<text class="spot-option-name">{{ item.name }}</text>
						<text v-if="item.address" class="spot-option-addr">{{ item.address }}</text>
					</view>
					<view v-if="!filteredSpots.length" class="spot-empty">未找到地点</view>
				</scroll-view>
			</view>
		</view>
	</view>
</template>

<script setup>
	import { ref, computed } from 'vue'
	import { onLoad, onShow } from '@dcloudio/uni-app'
	import { getToken } from '@/utils/auth.js'
	import { resolveCloudFiles } from '@/utils/cloudFile.js'
	import { PLACE_TYPES, getTypeLabel } from '@/utils/placeTypes.js'
	import { compressImage, filterOversizeImages } from '@/utils/image.js'

	const spotsObj = uniCloud.importObject('spots', {
		customUI: true
	})

	// 类型选项统一来自 utils/place-types.json
	const typeOptions = PLACE_TYPES

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
	// 从详情页跳转过来时待选中的地点 id
	const pendingTargetId = ref('')
	// 地点选择弹窗
	const spotPickerVisible = ref(false)
	const spotKeyword = ref('')
	const filteredSpots = computed(() => {
		const list = spots.value || []
		const kw = spotKeyword.value.trim().toLowerCase()
		if (!kw) return list
		return list.filter(item => {
			const text = `${item.name || ''} ${item.address || ''}`.toLowerCase()
			return text.indexOf(kw) !== -1
		})
	})
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
		return (spots.value || []).map(item => item.name)
	})

	onLoad(() => {
		loadSpots()
	})

	// 从地点详情「详细更新」跳转过来时，预填地点与已填写的反馈
	onShow(() => {
		let prefill = null
		try {
			prefill = uni.getStorageSync('contribute_prefill')
		} catch (e) {}
		if (!prefill) return
		uni.removeStorageSync('contribute_prefill')
		reportType.value = 'update'
		if (prefill.reason) {
			form.value.report_reason = prefill.reason
		}
		pendingTargetId.value = prefill.target_id || ''
		applyTarget()
	})

	// 按 pendingTargetId 选中对应地点
	function applyTarget() {
		if (!pendingTargetId.value) return
		const idx = (spots.value || []).findIndex(item => item._id === pendingTargetId.value)
		if (idx >= 0) {
			targetIndex.value = idx
			pendingTargetId.value = ''
		}
	}

	function showError(err) {
		const msg = (err && (err.errMsg || err.message)) || '操作失败'
		uni.showToast({
			title: msg,
			icon: 'none'
		})
	}

	function typeText(type) {
		return getTypeLabel(type)
	}

	// 加载已通过审核的地点，供更新时选择
	async function loadSpots() {
		try {
			const res = await spotsObj.getList({
				status: 'approved',
				page: 1,
				pageSize: 200
			})
			spots.value = (res && res.list) || []
			applyTarget()
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

	// 打开/关闭地点选择弹窗，选中后设置 targetIndex
	function openSpotPicker() {
		spotKeyword.value = ''
		spotPickerVisible.value = true
	}

	function closeSpotPicker() {
		spotPickerVisible.value = false
	}

	function selectSpot(item) {
		const idx = (spots.value || []).findIndex(s => s._id === item._id)
		if (idx >= 0) {
			targetIndex.value = idx
		}
		spotPickerVisible.value = false
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
		const { ok, oversize } = await filterOversizeImages(filePaths)
		if (oversize) {
			uni.showToast({
				title: '有 ' + oversize + ' 张图片超过 6MB，已跳过',
				icon: 'none'
			})
		}
		if (!ok.length) return
		uploading.value = true
		uni.showLoading({
			title: '上传中...'
		})
		try {
			for (let i = 0; i < ok.length; i++) {
				const filePath = await compressImage(ok[i])
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

	// 提交补充或更新信息，进入待审核
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
					title: '请选择要更新的地点',
					icon: 'none'
				})
				return
			}
			if (!form.value.report_reason.trim()) {
				uni.showToast({
					title: '请填写更新说明',
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
			await spotsObj.submit(payload, getToken())
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

	/* 顶部分段切换 */
	.switch {
		display: flex;
		margin: 20rpx 24rpx 0;
		padding: 6rpx;
		background-color: #EDEFF2;
		border-radius: 18rpx;
	}

	.switch-item {
		flex: 1;
		text-align: center;
		padding: 10rpx 0;
		font-size: 26rpx;
		color: $text-secondary;
		border-radius: 14rpx;
		transition: all 0.2s ease;

		&:active {
			opacity: 0.7;
		}
	}

	.switch-item.active {
		color: $text-main;
		font-weight: 600;
		background-color: #FFFFFF;
		box-shadow: 0 2rpx 8rpx rgba(29, 33, 41, 0.08);
	}

	.form-scroll {
		flex: 1;
		height: 0;
		min-height: 0;
	}

	.form {
		margin: 16rpx 24rpx;
		padding: 20rpx;
		background-color: #FFFFFF;
		border-radius: 24rpx;
		box-shadow: 0 4rpx 20rpx rgba(29, 33, 41, 0.04);
	}

	.field {
		margin-bottom: 16rpx;
	}

	.field-row {
		display: flex;
		margin-bottom: 44rpx;
	}

	.field-col {
		flex: 1;
	}

	.field-col:first-child {
		margin-right: 24rpx;
	}

	.label {
		display: block;
		font-size: 24rpx;
		font-weight: 500;
		color: #5F6368;
		letter-spacing: 1rpx;
		margin-bottom: 8rpx;
	}

	.input,
	.picker,
	.textarea {
		color: #202124;
		font-size: 28rpx;
		background-color: #FFFFFF;
		border: 1rpx solid #DADCE0;
		border-radius: 10rpx;
		box-sizing: border-box;
		transition: border-color 0.2s ease;
	}

	.input {
		height: 72rpx;
		padding: 0 20rpx;
	}

	.picker {
		height: 72rpx;
		line-height: 72rpx;
		padding: 0 20rpx;
	}

	.textarea {
		width: 100%;
		height: 128rpx;
		padding: 16rpx 20rpx;
		box-sizing: border-box;
	}

	.input:focus,
	.textarea:focus {
		border-color: #1A73E8;
	}

	/* 地图选点 */
	.locate-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 72rpx;
		font-size: 28rpx;
		font-weight: 500;
		color: #1A73E8;
		background-color: #E8F0FE;
		border-radius: 10rpx;
		transition: opacity 0.2s ease;

		&:active {
			opacity: 0.85;
		}
	}

	.locate-icon {
		margin-right: 10rpx;
	}

	.locate-tip {
		display: block;
		margin-top: 10rpx;
		font-size: 24rpx;
		color: $text-secondary;
		line-height: 1.5;
	}

	/* 图片 */
	.image-list {
		display: flex;
		flex-wrap: wrap;
		margin-bottom: -14rpx;
	}

	.image-item {
		position: relative;
		width: 132rpx;
		height: 132rpx;
		margin: 0 14rpx 14rpx 0;
	}

	.image-thumb {
		width: 132rpx;
		height: 132rpx;
		border-radius: 16rpx;
		background-color: #F5F6F8;
	}

	.image-remove {
		position: absolute;
		top: -12rpx;
		right: -12rpx;
		width: 44rpx;
		height: 44rpx;
		line-height: 44rpx;
		text-align: center;
		font-size: 28rpx;
		color: #FFFFFF;
		background-color: rgba(29, 33, 41, 0.7);
		border-radius: 50%;
	}

	.image-add {
		width: 132rpx;
		height: 132rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background-color: #F5F6F8;
		border-radius: 16rpx;
		transition: background-color 0.2s ease;

		&:active {
			background-color: #EEF0F3;
		}
	}

	.image-add-icon {
		font-size: 48rpx;
		color: #B0B6BF;
		line-height: 1;
	}

	.image-add-text {
		margin-top: 8rpx;
		font-size: 24rpx;
		color: $text-secondary;
	}

	.tips {
		display: block;
		margin-top: 0;
		font-size: 22rpx;
		color: $text-secondary;
		line-height: 1.6;
	}

	/* 底部提交 */
	.submit-bar {
		padding: 10rpx 24rpx;
		padding-bottom: calc(8rpx + constant(safe-area-inset-bottom));
		padding-bottom: calc(8rpx + env(safe-area-inset-bottom));
		background-color: transparent;
	}

	.submit {
		height: 76rpx;
		line-height: 76rpx;
		font-size: 30rpx;
		font-weight: 600;
		color: #FFFFFF;
		background-color: #1A73E8;
		border-radius: 100rpx;
		box-shadow: 0 4rpx 12rpx rgba(26, 115, 232, 0.2);
		transition: opacity 0.2s ease;

		&:active {
			opacity: 0.9;
		}
	}

	/* 地点选择：下拉指示 */
	.picker-select {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.picker-placeholder {
		color: #9AA0A6;
	}

	.picker-arrow {
		color: #9AA0A6;
		font-size: 30rpx;
		line-height: 1;
	}

	/* 地点选择弹窗 */
	.spot-mask {
		position: fixed;
		left: 0;
		top: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(32, 33, 36, 0.45);
		z-index: 999;
		display: flex;
		align-items: flex-end;
	}

	.spot-panel {
		width: 100%;
		height: 72vh;
		background-color: #FFFFFF;
		border-radius: 28rpx 28rpx 0 0;
		padding: 28rpx 28rpx calc(28rpx + env(safe-area-inset-bottom));
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
	}

	.spot-panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 20rpx;
	}

	.spot-panel-title {
		font-size: 30rpx;
		font-weight: 600;
		color: #202124;
	}

	.spot-panel-close {
		font-size: 30rpx;
		color: #5F6368;
		padding: 0 8rpx;
	}

	.spot-search {
		height: 80rpx;
		padding: 0 24rpx;
		font-size: 28rpx;
		color: #202124;
		background-color: #F5F6F8;
		border-radius: 12rpx;
	}

	.spot-list {
		margin-top: 12rpx;
		flex: 1;
		height: 0;
		min-height: 0;
	}

	.spot-option {
		display: flex;
		flex-direction: column;
		padding: 16rpx 8rpx;
		border-bottom: 1rpx solid #F0F1F3;
	}

	.spot-option:active {
		background-color: #F8F9FA;
	}

	.spot-option-active {
		background-color: #E8F0FE;
	}

	.spot-option-name {
		font-size: 28rpx;
		color: #202124;
	}

	.spot-option-addr {
		margin-top: 6rpx;
		font-size: 22rpx;
		color: #5F6368;
	}

	.spot-empty {
		text-align: center;
		padding: 60rpx 0;
		font-size: 26rpx;
		color: #5F6368;
	}
</style>
