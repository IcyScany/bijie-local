'use strict';

const crypto = require('crypto')
const { TENCENT_MAP_KEY, TENCENT_MAP_SK } = require('app-config')

// 生成腾讯地图签名：参数按 key 排序后拼接并 md5
function buildSig(path, params, sk) {
	const keys = Object.keys(params).sort()
	const query = keys.map(key => key + '=' + params[key]).join('&')
	return crypto.createHash('md5').update(path + '?' + query + sk, 'utf8').digest('hex')
}

// 逆地址解析：经纬度转推荐地址与周边 POI
async function reverseGeocode(event) {
	const latitude = Number(event.latitude)
	const longitude = Number(event.longitude)
	if (!TENCENT_MAP_KEY || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
		return {
			address: ''
		}
	}
	const path = '/ws/geocoder/v1/'
	const params = {
		location: latitude + ',' + longitude,
		get_poi: 1,
		key: TENCENT_MAP_KEY
	}
	if (TENCENT_MAP_SK) {
		params.sig = buildSig(path, params, TENCENT_MAP_SK)
	}
	const res = await uniCloud.httpclient.request('https://apis.map.qq.com' + path, {
		method: 'GET',
		data: params,
		dataType: 'json',
		timeout: 10000
	})
	const data = res.data || {}
	if (data.status !== 0) {
		return {
			address: ''
		}
	}
	const result = data.result || {}
	const recommend = result.formatted_addresses && result.formatted_addresses.recommend
	const list = (result.pois || []).map(item => ({
		title: item.title,
		address: item.address || '',
		longitude: item.location && item.location.lng,
		latitude: item.location && item.location.lat
	}))
	return {
		address: recommend || result.address || '',
		list
	}
}

// 云函数入口：type=reverse 时逆地址解析，否则按关键词搜索地点
exports.main = async (event) => {
	if (event.type === 'reverse') {
		return await reverseGeocode(event)
	}

	const keyword = String(event.keyword || '').trim()
	const region = String(event.region || '毕节').trim()
	const page = Math.max(1, parseInt(event.page, 10) || 1)
	const pageSize = Math.min(20, Math.max(1, parseInt(event.pageSize, 10) || 10))

	if (!keyword) {
		return {
			list: [],
			total: 0
		}
	}

	if (!TENCENT_MAP_KEY) {
		return {
			list: [],
			total: 0,
			error: '未配置腾讯地图Key'
		}
	}

	const path = '/ws/place/v1/search'
	const params = {
		keyword,
		boundary: 'region(' + region + ',0)',
		page_index: page,
		page_size: pageSize,
		key: TENCENT_MAP_KEY
	}

	if (TENCENT_MAP_SK) {
		params.sig = buildSig(path, params, TENCENT_MAP_SK)
	}

	const res = await uniCloud.httpclient.request('https://apis.map.qq.com' + path, {
		method: 'GET',
		data: params,
		dataType: 'json',
		timeout: 10000
	})

	const data = res.data || {}
	if (data.status !== 0) {
		return {
			list: [],
			total: 0,
			error: data.message || '搜索失败'
		}
	}

	const list = (data.data || []).map(item => ({
		title: item.title,
		address: item.address || (item.ad_info && item.ad_info.name) || '',
		longitude: item.location && item.location.lng,
		latitude: item.location && item.location.lat
	}))

	return {
		list,
		total: data.count || list.length
	}
}
