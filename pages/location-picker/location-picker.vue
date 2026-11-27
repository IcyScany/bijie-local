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

		<cover-image class="pin" src="/static/img/round-pushpin.png"></cover-image>

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
						<text class="item-title">{{ centerName || '[位置]' }}</text>
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
					<app-icon class="item-pin" icon="locationOn" size="lg" color="primary" />
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
	import AppIcon from '@/components/AppIcon.vue'

	const instance = getCurrentInstance()
	const longitude = ref(105.2844)
	const latitude = ref(27.2987)
	const scale = ref(16)
	const locating = ref(false)
	const keyword = ref('')
	const searching = ref(false)
	const centerName = ref('')
	const centerAddress = ref('')
	const nearbyList = ref([])

	let refreshTimer = null
	// 程序主动跳转地图（搜索/点选）期间，抑制 regionchange 触发的反向刷新，避免覆盖结果列表
	let skipRegionUntil = 0

	// 地址去「省/市」：去掉开头的 xxx省 / xxx自治区 / xxx特别行政区，
	// 以及其后的 xxx市 / xxx自治州 / xxx地区 / xxx盟，从区/县开始。
	// 例如「贵州省毕节市七星关区公园路」→「七星关区公园路」。
	function stripProvinceCity(addr) {
		const raw = String(addr || '').trim()
		if (!raw) return ''
		let s = raw
		s = s.replace(/^[^省市区县路街号]{1,10}?(省|自治区|特别行政区)/, '')
		s = s.replace(/^[^省区县路街号]{1,10}?(市|自治州|地区|盟)/, '')
		s = s.trim()
		// 去掉后若为空（如地址本身只有省+市），保底返回原值
		return s || raw
	}

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

	// 解析中心名称/地址，并用返回的周边 POI 作为附近地点
	// keepCenterInfo 为真时（点击列表/搜索选中）保留已设置的中心名称与地址
	async function reverseGeocode(lng, lat, keepCenterInfo) {
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
			const list = result.list || []
			if (!keepCenterInfo) {
				const addr = stripProvinceCity(result.address || '')
				centerAddress.value = addr
				centerName.value = list.length ? (list[0].title || addr || '') : (addr || '')
			}
			nearbyList.value = list.filter(item => {
				const ilng = Number(item.longitude)
				const ilat = Number(item.latitude)
				if (!Number.isFinite(ilng) || !Number.isFinite(ilat)) return false
				return Math.abs(ilng - lng) > 0.000001 || Math.abs(ilat - lat) > 0.000001
			})
		} catch (e) {
			if (!keepCenterInfo) {
				centerAddress.value = ''
				centerName.value = ''
			}
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
		// 程序跳转刚触发的变化不刷新，避免把搜索结果覆盖成周边列表
		if (Date.now() < skipRegionUntil) return
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

	// 点击附近地点：地图中心跳转到该地点
	function pickNearby(item) {
		const lng = Number(item.longitude)
		const lat = Number(item.latitude)
		if (!Number.isFinite(lng) || !Number.isFinite(lat)) return
		longitude.value = lng
		latitude.value = lat
		const addr = stripProvinceCity(item.address || '')
		centerName.value = item.title || addr || ''
		centerAddress.value = addr || item.title || ''
		// 跳转地图到该地点，但保持当前列表不变
		skipRegionUntil = Date.now() + 1500
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
			const list = result.list || []
			const first = list[0]
			const lng = first ? Number(first.longitude) : NaN
			const lat = first ? Number(first.latitude) : NaN
			if (Number.isFinite(lng) && Number.isFinite(lat)) {
				// 展示搜索结果并跳转到第一个结果，跳转期间不刷新列表，避免被反向解析覆盖
				nearbyList.value = list
				longitude.value = lng
				latitude.value = lat
				const addr = stripProvinceCity(first.address || '')
				centerName.value = first.title || addr || ''
				centerAddress.value = addr || first.title || ''
				skipRegionUntil = Date.now() + 1500
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

	// 回传所选位置给上一页并返回
	function selectAndBack(lng, lat, name, address) {
		const lngNum = Number(lng)
		const latNum = Number(lat)
		if (!Number.isFinite(lngNum) || !Number.isFinite(latNum)) return
		const eventChannel = instance.proxy.getOpenerEventChannel()
		if (eventChannel && typeof eventChannel.emit === 'function') {
			eventChannel.emit('selectLocation', {
				longitude: lngNum,
				latitude: latNum,
				name: name || address || '',
				address: address || ''
			})
		}
		uni.navigateBack()
	}

	// 以地图中心为所选位置回传
	async function confirm() {
		await updateCenter()
		selectAndBack(longitude.value, latitude.value, centerName.value || centerAddress.value, centerAddress.value)
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

	/* 中心选点标记（round-pushpin 图钉，底部对准屏幕中心） */
	.pin {
		position: fixed;
		left: 50%;
		top: 22%;
		width: 70rpx;
		height: 70rpx;
		margin-left: -35rpx;
		margin-top: -60rpx;
	}

	.panel {
		height: 56vh;
		background-color: #FFFFFF;
		border-radius: 28rpx 28rpx 0 0;
		margin-top: -24rpx;
		padding: 24rpx 28rpx 0;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		box-shadow: 0 -16rpx 40rpx rgba(29, 33, 41, 0.08);
		animation: fadeIn 0.3s ease;
	}

	.search-bar {
		display: flex;
		align-items: center;
		padding-bottom: 24rpx;
		margin-top: 20rpx;
	}

	.search-input {
		flex: 1;
		height: 76rpx;
		padding: 0 24rpx;
		font-size: 28rpx;
		color: #202124;
		background-color: #FFFFFF;
		border: 1rpx solid #DADCE0;
		border-radius: 10rpx;
		margin-right: 16rpx;
		box-sizing: border-box;
		transition: border-color 0.2s ease;

		&:focus {
			border-color: #1A73E8;
		}
	}

	.search-btn {
		width: 128rpx;
		height: 76rpx;
		line-height: 76rpx;
		text-align: center;
		font-size: 28rpx;
		font-weight: 600;
		color: #FFFFFF;
		background-color: #1A73E8;
		border-radius: 10rpx;
		transition: opacity 0.2s ease;

		&:active {
			opacity: 0.9;
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
		background-color: #E8F0FE;
		border-radius: 10rpx;
		padding: 22rpx;
		margin-bottom: 16rpx;
	}

	.confirm-btn {
		margin-left: 16rpx;
		padding: 12rpx 26rpx;
		font-size: 26rpx;
		font-weight: 600;
		color: #FFFFFF;
		background-color: #1A73E8;
		border-radius: 100rpx;
		transition: opacity 0.2s ease;

		&:active {
			opacity: 0.9;
		}
	}

	.item {
		display: flex;
		align-items: flex-start;
		padding: 22rpx 8rpx;
		border-bottom: 1rpx solid #F0F1F3;
		transition: background-color 0.2s ease;

		&:active {
			background-color: #F8F9FA;
		}
	}

	.item-pin {
		margin-right: 14rpx;
		flex-shrink: 0;
	}

	.item-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.item-title {
		font-size: 28rpx;
		font-weight: 500;
		color: $text-main;
	}

	.item-addr {
		margin-top: 6rpx;
		font-size: 22rpx;
		color: $text-secondary;
		line-height: 1.4;
	}

	.empty {
		text-align: center;
		padding: 72rpx 0;
		font-size: 26rpx;
		color: $text-secondary;
	}
</style>
