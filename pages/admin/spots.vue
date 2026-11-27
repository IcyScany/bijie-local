<template>
	<view class="page">
		<view class="toolbar">
			<input class="search" v-model="keyword" placeholder="搜索地点名称" confirm-type="search" @confirm="loadList" />
			<view class="add-btn" @click="openCreate">新增</view>
		</view>

		<scroll-view class="filter-scroll" scroll-x :show-scrollbar="false">
			<view class="filter">
				<view
					v-for="item in typeFilters"
					:key="item.value"
					class="filter-item"
					:class="{ active: filterType === item.value }"
					@click="switchType(item.value)"
				>{{ item.label }}</view>
			</view>
		</scroll-view>

		<view class="status-bar">
			<view
				v-for="item in statusFilters"
				:key="item.value"
				class="status-item"
				:class="{ active: filterStatus === item.value }"
				@click="switchStatus(item.value)"
			>{{ item.label }}</view>
		</view>

		<AppSkeleton v-if="loading" :count="3" />
		<view v-else-if="!list.length" class="empty">暂无数据</view>
		<scroll-view v-else class="list" scroll-y>
			<view v-for="item in list" :key="item._id" class="card">
				<view class="card-head">
					<text class="card-name">{{ item.name }}</text>
					<view class="card-tags">
						<text v-if="item.status === 'pending'" class="tag pending">待审核</text>
						<text v-else-if="item.status === 'rejected'" class="tag rejected">已驳回</text>
						<text v-if="item.source === 'user'" class="tag user">用户提交</text>
						<text class="card-tag" :style="{ backgroundColor: typeColor(item.type) }">{{ typeText(item.type) }}</text>
					</view>
				</view>

				<scroll-view v-if="displayImages(item).length" class="card-images" scroll-x :show-scrollbar="false">
					<image v-for="(url, i) in displayImages(item)" :key="i" class="card-image" :src="url" mode="aspectFill" @click="previewImages(displayImages(item), i)"></image>
				</scroll-view>

				<text v-if="item.address" class="card-line">地址：{{ item.address }}</text>
				<text v-if="item.remark" class="card-line">备注：{{ item.remark }}</text>
				<text v-if="item.contributor_name" class="card-line">共创者：{{ item.contributor_name }}</text>

				<view class="card-actions">
					<view class="action-btn edit" @click="openEdit(item)">编辑</view>
					<view class="action-btn delete" @click="onDelete(item)">删除</view>
				</view>
			</view>
		</scroll-view>

		<view class="footer">共 {{ total }} 条</view>

		<!-- 地点编辑 / 新增弹窗（管理员直接修改，不计入个人贡献） -->
		<view v-if="showForm" class="mask" @click="closeForm">
			<view class="form" @click.stop>
				<text class="form-title">{{ form.id ? '编辑地点' : '新增地点' }}</text>

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

				<view class="field">
					<text class="label">现场图片（可选，最多9张）</text>
					<view class="image-list">
						<view v-for="(img, i) in form.images" :key="i" class="image-item">
							<image class="image-thumb" :src="imgUrl(img)" mode="aspectFill" @click="previewImages(form.images, i)"></image>
							<text class="image-remove" @click="removeImage(i)">×</text>
						</view>
						<view v-if="form.images.length < 9" class="image-add" @click="chooseImages">
							<text class="image-add-icon">+</text>
							<text class="image-add-text">上传</text>
						</view>
					</view>
				</view>

				<view class="form-actions">
					<button class="cancel" @click="closeForm">取消</button>
					<button class="confirm" :disabled="submitting" @click="submitForm">{{ submitting ? '保存中...' : '保存' }}</button>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup>
	import { ref, computed } from 'vue'
	import { onLoad, onShow } from '@dcloudio/uni-app'
	import { ensureLogin, isSuperAdmin, getToken, isAuthError, relogin, refreshAuthFlags } from '@/utils/auth.js'
	import { resolveCloudFiles } from '@/utils/cloudFile.js'
	import { PLACE_TYPES, getTypeLabel, getTypeColor } from '@/utils/placeTypes.js'
	import { compressImage, filterOversizeImages } from '@/utils/image.js'
	import AppSkeleton from '@/components/AppSkeleton.vue'

	const spotsObj = uniCloud.importObject('spots', {
		customUI: true
	})

	// 类型选项统一来自 utils/place-types.json
	const typeFilters = [{
		label: '全部',
		value: ''
	}, ...PLACE_TYPES]

	const statusFilters = [{
		label: '已通过',
		value: 'approved'
	}, {
		label: '待审核',
		value: 'pending'
	}, {
		label: '已驳回',
		value: 'rejected'
	}, {
		label: '全部',
		value: ''
	}]

	const typeOptions = PLACE_TYPES

	function emptyForm() {
		return {
			id: '',
			name: '',
			type: 'food',
			address: '',
			longitude: '',
			latitude: '',
			remark: '',
			images: []
		}
	}

	const keyword = ref('')
	const filterType = ref('')
	const filterStatus = ref('approved')
	const list = ref([])
	const total = ref(0)
	const loading = ref(false)
	const showForm = ref(false)
	const submitting = ref(false)
	const uploading = ref(false)
	const form = ref(emptyForm())
	const imageMap = ref({})

	// 是否已通过地图选点确定坐标
	const hasLocation = computed(() => {
		return form.value.longitude !== '' && form.value.latitude !== ''
	})

	// 云存储 fileID 需转换为临时链接后才能显示
	function imgUrl(id) {
		return id ? (imageMap.value[id] || '') : ''
	}

	// 优先使用服务端解析好的图片链接，回退到客户端解析结果
	function displayImages(item) {
		if (item && Array.isArray(item.image_urls) && item.image_urls.length) {
			return item.image_urls
		}
		return (item && Array.isArray(item.images) ? item.images : []).map(imgUrl).filter(url => !!url)
	}

	async function resolveImages(ids) {
		const pending = (ids || []).filter(id => typeof id === 'string' && id && !imageMap.value[id])
		if (!pending.length) return
		const map = await resolveCloudFiles(pending)
		imageMap.value = Object.assign({}, imageMap.value, map)
	}

	onLoad(async () => {
		try {
			await ensureLogin()
		} catch (e) {}
		// 强制刷新超管标记，避免本地缓存过期导致其他超管被误判
		await refreshAuthFlags().catch(() => {})
		if (!isSuperAdmin()) {
			uni.showToast({
				title: '仅超级管理员可访问',
				icon: 'none'
			})
			setTimeout(() => {
				uni.switchTab({
					url: '/pages/map/map'
				})
			}, 800)
		}
	})

	onShow(() => {
		loadList()
	})

	function showError(err) {
		const msg = (err && (err.errMsg || err.message)) || '操作失败'
		uni.showToast({
			title: msg,
			icon: 'none'
		})
	}

	// 执行需鉴权的管理操作：登录态失效时自动重新登录并重试一次
	async function runAdmin(action) {
		await ensureLogin()
		try {
			return await action(getToken())
		} catch (err) {
			if (!isAuthError(err)) {
				throw err
			}
			await relogin()
			return await action(getToken())
		}
	}

	function typeText(type) {
		return getTypeLabel(type)
	}

	function typeColor(type) {
		return getTypeColor(type)
	}

	// 按关键词、类型、审核状态分页查询地点列表
	async function loadList() {
		loading.value = true
		try {
			const res = await spotsObj.getList({
				keyword: keyword.value,
				type: filterType.value,
				status: filterStatus.value,
				withImages: true,
				page: 1,
				pageSize: 100
			})
			list.value = res.list
			total.value = res.total
			const ids = []
			res.list.forEach(it => (it.images || []).forEach(id => ids.push(id)))
			resolveImages(ids)
		} catch (err) {
			showError(err)
		} finally {
			loading.value = false
		}
	}

	function switchType(value) {
		filterType.value = value
		loadList()
	}

	function switchStatus(value) {
		filterStatus.value = value
		loadList()
	}

	async function previewImages(images, index) {
		const ids = Array.isArray(images) ? images : []
		const map = await resolveCloudFiles(ids)
		const urls = ids.map(id => map[id] || id)
		uni.previewImage({
			urls,
			current: index
		})
	}

	function openCreate() {
		form.value = emptyForm()
		showForm.value = true
	}

	function openEdit(item) {
		form.value = {
			id: item._id,
			name: item.name || '',
			type: item.type || 'other',
			address: item.address || '',
			longitude: item.longitude === undefined ? '' : String(item.longitude),
			latitude: item.latitude === undefined ? '' : String(item.latitude),
			remark: item.remark || '',
			images: Array.isArray(item.images) ? item.images.slice() : []
		}
		resolveImages(form.value.images)
		showForm.value = true
	}

	function closeForm() {
		showForm.value = false
	}

	function chooseLocation() {
		openPickerPage()
	}

	// 打开自建地图选点页并接收回填
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

	// 将本地图片上传到云存储并收集 fileID
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

	function removeImage(index) {
		form.value.images.splice(index, 1)
	}

	function onTypeChange(e) {
		form.value.type = typeOptions[e.detail.value].value
	}

	// 提交新增或编辑表单
	async function submitForm() {
		if (!form.value.name.trim()) {
			uni.showToast({
				title: '请输入地点名称',
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

		submitting.value = true
		const payload = {
			name: form.value.name,
			type: form.value.type,
			address: form.value.address,
			longitude: form.value.longitude,
			latitude: form.value.latitude,
			remark: form.value.remark,
			images: form.value.images
		}

		try {
			await runAdmin((token) => {
				if (form.value.id) {
					return spotsObj.update(form.value.id, payload, token)
				}
				return spotsObj.add(payload, token)
			})
			uni.showToast({
				title: '保存成功',
				icon: 'success'
			})
			showForm.value = false
			loadList()
		} catch (err) {
			showError(err)
		} finally {
			submitting.value = false
		}
	}

	// 删除地点（二次确认）
	function onDelete(item) {
		uni.showModal({
			title: '删除确认',
			content: '确定删除「' + item.name + '」吗？',
			success: async (res) => {
				if (!res.confirm) return
				try {
					await runAdmin((token) => spotsObj.remove(item._id, token))
					uni.showToast({
						title: '已删除',
						icon: 'success'
					})
					loadList()
				} catch (err) {
					showError(err)
				}
			}
		})
	}
</script>

<style lang="scss">
	.page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		background-color: $bg-page;
	}

	.toolbar {
		display: flex;
		align-items: center;
		flex-shrink: 0;
		padding: 12rpx $space-md;
		background-color: $bg-card;
		box-shadow: $shadow-sm;
	}

	.search {
		flex: 1;
		height: 80rpx;
		padding: 0 $space-md;
		font-size: $fs-md;
		color: $text-main;
		background-color: $bg-fill;
		border-radius: $radius-pill;
		margin-right: 20rpx;
		transition: all $duration-fast ease;

		&:focus {
			background-color: $bg-fill-hover;
		}
	}

	.add-btn {
		padding: 0 32rpx;
		height: 80rpx;
		line-height: 80rpx;
		background-image: $brand-gradient;
		color: $text-inverse;
		font-size: $fs-md;
		font-weight: 500;
		box-shadow: $shadow-sm;
		border-radius: $radius-pill;
		transition: all $duration-fast ease;

		&:active {
			transform: scale(0.95);
		}
	}

	.filter-scroll {
		width: 100%;
		flex-shrink: 0;
		white-space: nowrap;
		background-color: $bg-card;
	}

	.filter {
		display: inline-block;
		padding: 10rpx $space-md;
	}

	.filter-item {
		display: inline-block;
		vertical-align: top;
		padding: 6rpx 20rpx;
		margin-right: 12rpx;
		font-size: $fs-sm;
		font-weight: 500;
		color: $text-main;
		background-color: $bg-card;
		border: 1rpx solid $border-strong;
		border-radius: $radius-pill;
		transition: background-color $duration-fast ease;
	}

	.filter-item.active {
		color: $brand;
		font-weight: 600;
		background-color: $brand-soft;
		border-color: $brand-soft;
	}

	.status-bar {
		display: flex;
		flex-shrink: 0;
		padding: 10rpx $space-md 0;
	}

	.status-item {
		padding: 6rpx 20rpx;
		margin-right: 12rpx;
		font-size: $fs-sm;
		font-weight: 500;
		color: $text-regular;
		background-color: $bg-card;
		border-radius: $radius-pill;
		transition: all $duration-fast ease;

		&:active {
			transform: scale(0.96);
		}
	}

	.status-item.active {
		color: $brand;
		font-weight: 600;
		background-color: $brand-soft;
	}

	.list {
		flex: 1;
		padding: 8rpx 0;
	}

	.card {
		background-color: $bg-card;
		border-radius: $radius-md;
		padding: 16rpx;
		margin: 0 $space-md 10rpx;
		box-shadow: $shadow-card;
		transition: all $duration-fast ease;

		&:active {
			transform: translateY(2rpx);
			box-shadow: $shadow-sm;
		}
	}

	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.card-name {
		font-size: 30rpx;
		font-weight: 600;
		color: $text-main;
	}

	.card-tags {
		display: flex;
		align-items: center;
	}

	.tag {
		font-size: $fs-xs;
		color: #ffffff;
		padding: 4rpx 14rpx;
		border-radius: $radius-pill;
		margin-right: 8rpx;
		font-weight: 500;
	}

	.tag.pending {
		background-color: $warning;
	}

	.tag.rejected {
		background-color: $danger;
	}

	.tag.user {
		background-color: $purple;
	}

	.card-tag {
		font-size: $fs-xs;
		color: #ffffff;
		padding: 4rpx 14rpx;
		border-radius: $radius-pill;
		font-weight: 500;
	}

	.card-images {
		width: 100%;
		white-space: nowrap;
		margin-top: 8rpx;
	}

	.card-image {
		display: inline-block;
		width: 120rpx;
		height: 90rpx;
		margin-right: 12rpx;
		border-radius: $radius-sm;
		background-color: $bg-fill;
	}

	.card-line {
		display: block;
		margin-top: 4rpx;
		font-size: $fs-sm;
		color: $text-secondary;
		line-height: 1.4;
	}

	.card-actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 8rpx;
	}

	.action-btn {
		font-size: $fs-sm;
		font-weight: 500;
		padding: 8rpx 24rpx;
		border-radius: $radius-pill;
		margin-left: 16rpx;
		transition: all $duration-fast ease;

		&:active {
			transform: scale(0.95);
		}
	}

	.action-btn.edit {
		color: $brand;
		background-color: $brand-soft;
	}

	.action-btn.delete {
		color: $danger;
		background-color: $danger-soft;
	}

	.empty {
		flex: 1;
		text-align: center;
		padding-top: 160rpx;
		font-size: $fs-md;
		color: $text-secondary;
	}

	.footer {
		flex-shrink: 0;
		text-align: center;
		padding: 8rpx;
		font-size: $fs-sm;
		color: $text-secondary;
	}

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

	.form {
		width: 100%;
		max-height: 88vh;
		overflow-y: auto;
		background-color: $bg-card;
		border-radius: $radius-xl $radius-xl 0 0;
		padding: $space-lg $space-lg 48rpx;
		box-sizing: border-box;
		animation: fadeIn 0.3s ease;
	}

	.form-title {
		display: block;
		font-size: $fs-lg;
		font-weight: 700;
		color: $text-main;
		margin-bottom: $space-md;
		text-align: center;
	}

	.field {
		margin-bottom: 20rpx;
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
		height: 148rpx;
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
		margin-top: 10rpx;
		font-size: 24rpx;
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

	.form-actions {
		display: flex;
		margin-top: $space-lg;
	}

	.form-actions .cancel {
		flex: 1;
		margin-right: 20rpx;
		font-size: 30rpx;
		font-weight: 500;
		color: $text-regular;
		background-color: $bg-fill;
		border-radius: $radius-pill;
	}

	.form-actions .confirm {
		flex: 1;
		font-size: 30rpx;
		font-weight: 600;
		color: $text-inverse;
		background-image: $brand-gradient;
		box-shadow: $brand-shadow;
		border-radius: $radius-pill;
	}
</style>
