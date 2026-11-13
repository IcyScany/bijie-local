<template>
	<view class="page">
		<view class="toolbar">
			<input class="search" v-model="keyword" placeholder="搜索地点名称" confirm-type="search" @confirm="loadList" />
			<button class="add-btn" size="mini" @click="openCreate">新增</button>
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

				<scroll-view v-if="item.images && item.images.length" class="card-images" scroll-x :show-scrollbar="false">
					<image v-for="(img, i) in item.images" :key="i" class="card-image" :src="imgUrl(img)" mode="aspectFill" @click="previewImages(item.images, i)"></image>
				</scroll-view>

				<text v-if="item.address" class="card-line">地址：{{ item.address }}</text>
				<text v-if="item.report_reason" class="card-line">纠错说明：{{ item.report_reason }}</text>
				<text v-else-if="item.remark" class="card-line">备注：{{ item.remark }}</text>
				<text v-if="item.longitude && item.latitude" class="card-line">坐标：{{ item.longitude }}, {{ item.latitude }}</text>
				<text v-if="item.contributor_name" class="card-line">贡献者：{{ item.contributor_name }}</text>

				<view class="card-actions">
					<view v-if="item.status === 'pending'" class="action-btn approve" @click="onReview(item, 'approved')">通过</view>
					<view v-if="item.status === 'pending'" class="action-btn reject" @click="onReview(item, 'rejected')">驳回</view>
					<view class="action-btn edit" @click="openEdit(item)">编辑</view>
					<view class="action-btn delete" @click="onDelete(item)">删除</view>
				</view>
			</view>
		</scroll-view>

		<view class="footer">共 {{ total }} 条</view>

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
					<text class="label">名称 *</text>
					<input class="input" v-model="form.name" placeholder="请输入地点名称" />
				</view>

				<view class="field">
					<text class="label">类型</text>
					<picker :range="typeOptions" range-key="label" @change="onTypeChange">
						<view class="picker">{{ typeText(form.type) }}</view>
					</picker>
				</view>

				<view class="field">
					<text class="label">地址</text>
					<input class="input" v-model="form.address" placeholder="请输入详细地址" />
				</view>

				<view class="field">
					<text class="label">实拍图片（最多9张）</text>
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

				<view class="field">
					<text class="label">备注</text>
					<textarea class="textarea" v-model="form.remark" placeholder="备注信息" />
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
	import { ensureLogin, isAdmin, getToken, isAuthError, relogin } from '@/utils/auth.js'
	import { resolveCloudFiles } from '@/utils/cloudFile.js'
	import AppSkeleton from '@/components/AppSkeleton.vue'

	const favoriteObj = uniCloud.importObject('favorite-spots', {
		customUI: true
	})

	const typeFilters = [{
		label: '全部',
		value: ''
	}, {
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

	const statusFilters = [{
		label: '全部',
		value: ''
	}, {
		label: '待审核',
		value: 'pending'
	}, {
		label: '已通过',
		value: 'approved'
	}, {
		label: '已驳回',
		value: 'rejected'
	}]

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
	const filterStatus = ref('')
	const list = ref([])
	const total = ref(0)
	const loading = ref(false)
	const showForm = ref(false)
	const submitting = ref(false)
	const uploading = ref(false)
	const form = ref(emptyForm())
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

	onLoad(async () => {
		try {
			await ensureLogin()
		} catch (e) {}
		if (!isAdmin()) {
			uni.showToast({
				title: '仅管理员可访问',
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
		const item = typeOptions.find(opt => opt.value === type)
		return item ? item.label : '其他'
	}

	function typeColor(type) {
		if (type === 'food') return '#E8710A'
		if (type === 'view') return '#188038'
		if (type === 'toilet') return '#1A73E8'
		if (type === 'shop') return '#8430CE'
		return '#5F6368'
	}

	// 按关键词、类型、审核状态分页查询地点列表
	async function loadList() {
		loading.value = true
		try {
			const res = await favoriteObj.getList({
				keyword: keyword.value,
				type: filterType.value,
				status: filterStatus.value,
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
					return favoriteObj.update(form.value.id, payload, token)
				}
				return favoriteObj.add(payload, token)
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

	// 审核用户提交：通过或驳回
	function onReview(item, status) {
		const text = status === 'approved' ? '通过' : '驳回'
		uni.showModal({
			title: '审核确认',
			content: '确定' + text + '「' + item.name + '」吗？',
			success: async (res) => {
				if (!res.confirm) return
				try {
					await runAdmin((token) => favoriteObj.review(item._id, status, token))
					uni.showToast({
						title: '已' + text,
						icon: 'success'
					})
					loadList()
				} catch (err) {
					showError(err)
				}
			}
		})
	}

	// 删除地点（二次确认）
	function onDelete(item) {
		uni.showModal({
			title: '删除确认',
			content: '确定删除「' + item.name + '」吗？',
			success: async (res) => {
				if (!res.confirm) return
				try {
					await runAdmin((token) => favoriteObj.remove(item._id, token))
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
		padding: $space-md;
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
		white-space: nowrap;
		background-color: $bg-card;
		padding: 16rpx 0;
	}

	.filter {
		display: inline-flex;
		padding: 0 $space-md;
	}

	.filter-item {
		flex-shrink: 0;
		padding: 12rpx 30rpx;
		margin-right: 16rpx;
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
		padding: 16rpx $space-md 0;
	}

	.status-item {
		padding: 10rpx 26rpx;
		margin-right: 16rpx;
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
		padding: 20rpx 0;
	}

	.card {
		background-color: $bg-card;
		border-radius: $radius-lg;
		padding: $space-md;
		margin: 0 $space-md 20rpx;
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
		font-size: 32rpx;
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
		padding: 6rpx 18rpx;
		border-radius: $radius-pill;
		margin-right: 12rpx;
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
		padding: 6rpx 18rpx;
		border-radius: $radius-pill;
		font-weight: 500;
	}

	.card-images {
		width: 100%;
		white-space: nowrap;
		margin-top: 16rpx;
	}

	.card-image {
		display: inline-block;
		width: 168rpx;
		height: 126rpx;
		margin-right: 12rpx;
		border-radius: $radius-sm;
		background-color: $bg-fill;
	}

	.card-line {
		display: block;
		margin-top: 12rpx;
		font-size: $fs-sm;
		color: $text-secondary;
		line-height: 1.5;
	}

	.card-actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 20rpx;
	}

	.action-btn {
		font-size: $fs-sm;
		font-weight: 500;
		padding: 10rpx 30rpx;
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

	.action-btn.approve {
		color: #ffffff;
		background-color: $success;
	}

	.action-btn.reject {
		color: #ffffff;
		background-color: $warning;
	}

	.empty {
		flex: 1;
		text-align: center;
		padding-top: 160rpx;
		font-size: $fs-md;
		color: $text-secondary;
	}

	.footer {
		text-align: center;
		padding: 20rpx;
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

	.field-row {
		display: flex;
		margin-bottom: 20rpx;
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
