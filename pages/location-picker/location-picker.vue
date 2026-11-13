<template>
	<view class="page">
		<map
			id="pickerMap"
			class="map"
			:longitude="longitude"
			:latitude="latitude"
			:scale="scale"
			show-location
			@tap="onMapTap"
			@regionchange="onRegionChange"
		></map>

		<cover-view class="pin-head"></cover-view>
		<cover-view class="pin-hole"></cover-view>
		<cover-view class="pin-stick"></cover-view>

		<view class="panel">
			<view class="search-bar">
				<input
					class="search-input"
					v-model="keyword"
					placeholder="搜索你想标记的位置"
					confirm-type="search"
					@confirm="searchPlace"
				/>
				<view class="search-btn" @click="searchPlace">{{ searching ? '搜索中' : '搜索' }}</view>
			</view>

			<scroll-view class="list" scroll-y>
				<view class="center-item">
					<view class="item-info">
						<text class="item-title">[位置]</text>
						<text class="item-addr">{{ centerAddress || (locating ? '正在定位...' : '正在获取位置信息...') }}</text>
					</view>
					<view class="confirm-btn" @click="confirm">确认选点</view>
				</view>

				<view
					v-for="(item, i) in nearbyList"
					:key="i"
					class="item"
					@click="pickNearby(item)"
				>
					<text class="item-pin">📍</text>
					<view class="item-info">
						<text class="item-title">{{ item.title }}</text>
						<text class="item-addr">{{ item.address }}</text>
					</view>
				</view>

				<view v-if="!nearbyList.length" class="empty">暂无附近地点</view>
			</scroll-view>
		</view>
	</view>
</template>

<script setup>
	import { ref, getCurrentInstance } from 'vue'
	import { onLoad } from '@dcloudio/uni-app'

	const instance = getCurrentInstance()
	const longitude = ref(105.2844)
	const latitude = ref(27.2987)
	const scale = ref(16)
	const locating = ref(false)
	const keyword = ref('')
	const searching = ref(false)
	const centerAddress = ref('')
	const nearbyList = ref([])

	let refreshTimer = null

	onLoad((query) => {
		const hasLongitude = query.longitude !== undefined && query.longitude !== ''
		const hasLatitude = query.latitude !== undefined && query.latitude !== ''
		const lng = Number(query.longitude)
		const lat = Number(query.latitude)
		if (hasLongitude && hasLatitude && Number.isFinite(lng) && Number.isFinite(lat)) {
			longitude.value = lng
			latitude.value = lat
			scheduleRefresh()
			return
		}
		locateCurrent()
	})

	// 防抖刷新：中心地址与附近地点
	function scheduleRefresh() {
		if (refreshTimer) clearTimeout(refreshTimer)
		refreshTimer = setTimeout(() => {
			refreshTimer = null
			refreshCenter()
		}, 300)
	}

	// 以地图中心为准刷新地址与附近地点
	async function refreshCenter() {
		await updateCenter()
		const lng = longitude.value
		const lat = latitude.value
		reverseGeocode(lng, lat)
	}

	// 读取地图当前中心点坐标
	function updateCenter() {
		return new Promise((resolve) => {
			const ctx = uni.createMapContext('pickerMap', instance.proxy)
			ctx.getCenterLocation({
				success: (res) => {
					longitude.value = res.longitude
					latitude.value = res.latitude
					resolve(res)
				},
				fail: () => resolve(null)
			})
		})
	}

	// 解析中心地址，并用返回的周边 POI 作为附近地点
	async function reverseGeocode(lng, lat) {
		try {
			const res = await uniCloud.callFunction({
				name: 'place-search',
				data: {
					type: 'reverse',
					longitude: lng,
					latitude: lat
				}
			})
			const result = res.result || {}
			centerAddress.value = result.address || ''
			const list = result.list || []
			nearbyList.value = list.filter(item => {
				const ilng = Number(item.longitude)
				const ilat = Number(item.latitude)
				if (!Number.isFinite(ilng) || !Number.isFinite(ilat)) return false
				return Math.abs(ilng - lng) > 0.000001 || Math.abs(ilat - lat) > 0.000001
			})
		} catch (e) {
			centerAddress.value = ''
			nearbyList.value = []
		}
	}

	// 定位到用户当前位置
	function locateCurrent() {
		locating.value = true
		uni.getLocation({
			type: 'gcj02',
			success: (res) => {
				longitude.value = res.longitude
				latitude.value = res.latitude
				scheduleRefresh()
			},
			fail: () => {
				uni.showToast({
					title: '定位失败，已使用默认位置',
					icon: 'none'
				})
				scheduleRefresh()
			},
			complete: () => {
				locating.value = false
			}
		})
	}

	// 地图移动结束后刷新中心与附近
	function onRegionChange(e) {
		const detail = e.detail || {}
		const type = e.type || detail.type
		if (type !== 'end') return
		scheduleRefresh()
	}

	// 点击地图：把点击点设为中心
	function onMapTap(e) {
		const detail = e.detail || {}
		if (typeof detail.longitude === 'number' && typeof detail.latitude === 'number') {
			applyTarget(detail.longitude, detail.latitude)
			return
		}
		const touch = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0])
		if (!touch) return
		const x = touch.x !== undefined ? touch.x : touch.clientX
		const y = touch.y !== undefined ? touch.y : touch.clientY
		if (x === undefined || y === undefined) return
		const ctx = uni.createMapContext('pickerMap', instance.proxy)
		if (typeof ctx.fromScreenToLocation !== 'function') return
		ctx.fromScreenToLocation({
			x,
			y,
			success: (res) => {
				applyTarget(res.longitude, res.latitude)
			},
			fail: () => {}
		})
	}

	// 设置新的中心点并刷新列表
	function applyTarget(lng, lat) {
		const lngNum = Number(lng)
		const latNum = Number(lat)
		if (!Number.isFinite(lngNum) || !Number.isFinite(latNum)) return
		longitude.value = lngNum
		latitude.value = latNum
		centerAddress.value = ''
		scheduleRefresh()
	}

	// 点击附近地点，将其移动为地图中心
	function pickNearby(item) {
		const lng = Number(item.longitude)
		const lat = Number(item.latitude)
		if (!Number.isFinite(lng) || !Number.isFinite(lat)) return
		longitude.value = lng
		latitude.value = lat
		centerAddress.value = item.address || item.title || ''
		scheduleRefresh()
	}

	// 关键字搜索，命中后移动地图到第一个结果
	async function searchPlace() {
		const kw = keyword.value.trim()
		if (!kw) return
		searching.value = true
		try {
			const res = await uniCloud.callFunction({
				name: 'place-search',
				data: { keyword: kw }
			})
			const result = res.result || {}
			if (result.error) {
				uni.showToast({
					title: result.error,
					icon: 'none'
				})
			}
			const first = (result.list || [])[0]
			const lng = first ? Number(first.longitude) : NaN
			const lat = first ? Number(first.latitude) : NaN
			if (Number.isFinite(lng) && Number.isFinite(lat)) {
				longitude.value = lng
				latitude.value = lat
				centerAddress.value = first.address || first.title || ''
				scheduleRefresh()
			} else {
				uni.showToast({
					title: '未找到相关地点',
					icon: 'none'
				})
			}
		} catch (e) {
			uni.showToast({
				title: '搜索失败',
				icon: 'none'
			})
		} finally {
			searching.value = false
		}
	}

	// 以地图中心为所选位置回传
	async function confirm() {
		await updateCenter()
		const eventChannel = instance.proxy.getOpenerEventChannel()
		if (eventChannel && typeof eventChannel.emit === 'function') {
			eventChannel.emit('selectLocation', {
				longitude: longitude.value,
				latitude: latitude.value,
				name: centerAddress.value,
				address: centerAddress.value
			})
		}
		uni.navigateBack()
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

	.pin-head {
		position: fixed;
		left: 50%;
		top: 22%;
		width: 44rpx;
		height: 44rpx;
		margin-left: -22rpx;
		margin-top: -72rpx;
		background-color: #fa5151;
		border: 4rpx solid #ffffff;
		border-radius: 50%;
		box-shadow: 0 8rpx 20rpx rgba(250, 81, 81, 0.5);
	}

	.pin-hole {
		position: fixed;
		left: 50%;
		top: 22%;
		width: 16rpx;
		height: 16rpx;
		margin-left: -8rpx;
		margin-top: -54rpx;
		background-color: #ffffff;
		border-radius: 50%;
	}

	.pin-stick {
		position: fixed;
		left: 50%;
		top: 22%;
		width: 4rpx;
		height: 22rpx;
		margin-left: -2rpx;
		margin-top: -22rpx;
		background-color: #fa5151;
	}

	.panel {
		height: 56vh;
		background-color: $bg-card;
		border-radius: $radius-xl $radius-xl 0 0;
		margin-top: -24rpx;
		padding: 24rpx $space-md 0;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		box-shadow: 0 -20rpx 48rpx rgba(29, 33, 41, 0.12);
		animation: fadeIn 0.3s ease;
	}

	.search-bar {
		display: flex;
		align-items: center;
		padding-bottom: 24rpx;
	}

	.search-input {
		flex: 1;
		height: 84rpx;
		padding: 0 $space-md;
		font-size: $fs-md;
		color: $text-main;
		background-color: $bg-fill;
		border-radius: $radius-md;
		margin-right: 16rpx;
		transition: all $duration-fast ease;
		
		&:focus {
			background-color: $bg-fill-hover;
		}
	}

	.search-btn {
		width: 136rpx;
		height: 84rpx;
		line-height: 84rpx;
		text-align: center;
		font-size: $fs-md;
		font-weight: 500;
		color: $text-inverse;
		background-image: $brand-gradient;
		border-radius: $radius-md;
		transition: all $duration-fast ease;
		
		&:active {
			transform: scale(0.96);
		}
	}

	.list {
		flex: 1;
		height: 0;
		min-height: 0;
	}

	.center-item {
		display: flex;
		align-items: center;
		background-color: $brand-soft;
		border-radius: $radius-md;
		padding: $space-md;
		margin-bottom: 16rpx;
		transition: all $duration-fast ease;
		
		&:active {
			transform: scale(0.98);
		}
	}

	.item {
		display: flex;
		align-items: flex-start;
		padding: $space-md 8rpx;
		border-bottom: 1rpx solid $border-color;
		transition: all $duration-fast ease;
		
		&:active {
			background-color: $bg-fill;
		}
	}

	.item-pin {
		font-size: 36rpx;
		margin-right: 16rpx;
		line-height: 1.2;
	}

	.item-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.item-title {
		font-size: 32rpx;
		font-weight: 500;
		color: $text-main;
	}

	.item-addr {
		margin-top: 8rpx;
		font-size: $fs-sm;
		color: $text-secondary;
		line-height: 1.4;
	}

	.confirm-btn {
		margin-left: 16rpx;
		padding: 14rpx 30rpx;
		font-size: $fs-md;
		font-weight: 500;
		color: $brand;
		background-color: #ffffff;
		border: 2rpx solid $brand;
		border-radius: $radius-sm;
		transition: all $duration-fast ease;
		
		&:active {
			transform: scale(0.95);
		}
	}

	.empty {
		text-align: center;
		padding: 64rpx 0;
		font-size: $fs-sm;
		color: $text-secondary;
	}
</style>
