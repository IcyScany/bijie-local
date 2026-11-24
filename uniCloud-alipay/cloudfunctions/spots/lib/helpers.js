'use strict'

const db = uniCloud.database()
const dbCmd = db.command
const { TYPE_LIST } = require('./constants')

// 转为合法数字，非法值返回 null
function toNumber(value) {
	const num = Number(value)
	return Number.isFinite(num) ? num : null
}

// 规范化图片列表：过滤空值，最多保留 9 张
function normalizeImages(images) {
	if (!Array.isArray(images)) {
		return null
	}
	return images
		.filter(item => typeof item === 'string' && item)
		.slice(0, 9)
}

// 按传入字段构造可更新的地点数据，未传的字段不覆盖
function buildUpdateData(data = {}) {
	const updateData = {}

	if (data.name !== undefined) {
		const name = String(data.name).trim()
		if (!name) {
			throw new Error('地点名称不能为空')
		}
		updateData.name = name
	}

	if (data.type !== undefined) {
		updateData.type = TYPE_LIST.includes(data.type) ? data.type : 'other'
	}

	if (data.address !== undefined) {
		updateData.address = String(data.address).trim()
	}

	if (data.remark !== undefined) {
		updateData.remark = String(data.remark).trim()
	}

	if (data.contact !== undefined) {
		updateData.contact = String(data.contact).trim()
	}

	if (data.longitude !== undefined) {
		const longitude = toNumber(data.longitude)
		if (longitude !== null) {
			updateData.longitude = longitude
		}
	}

	if (data.latitude !== undefined) {
		const latitude = toNumber(data.latitude)
		if (latitude !== null) {
			updateData.latitude = latitude
		}
	}

	if (data.images !== undefined) {
		const images = normalizeImages(data.images)
		if (images !== null) {
			updateData.images = images
		}
	}

	return updateData
}

// 批量附加评分汇总与最新评论
async function attachRating(list) {
	if (!list || !list.length) return
	const $ = dbCmd.aggregate
	const ids = list.map(item => item._id)
	const agg = await db.collection('spot-comments')
		.aggregate()
		.match({ spot_id: dbCmd.in(ids) })
		.group({ _id: '$spot_id', avg: $.avg('$rating'), count: $.sum(1) })
		.end()
	const ratingMap = {}
	;(agg.data || []).forEach(row => {
		ratingMap[row._id] = {
			rating: row.avg ? Math.round(row.avg * 10) / 10 : 0,
			rating_count: row.count || 0
		}
	})
	const latestAgg = await db.collection('spot-comments')
		.aggregate()
		.match({ spot_id: dbCmd.in(ids) })
		.sort({ create_date: -1 })
		.group({
			_id: '$spot_id',
			content: $.first('$content'),
			nickname: $.first('$nickname'),
			rating: $.first('$rating')
		})
		.end()
	const latestMap = {}
	;(latestAgg.data || []).forEach(row => {
		latestMap[row._id] = {
			content: row.content || '',
			nickname: row.nickname || '',
			rating: row.rating || 0
		}
	})
	list.forEach(item => {
		const r = ratingMap[item._id]
		item.rating = r ? r.rating : 0
		item.rating_count = r ? r.rating_count : 0
		item.latest_comment = latestMap[item._id] || null
	})
}

// fileID -> { url, expire } 的实例级缓存，减少 getTempFileURL 调用并保持链接稳定
// 说明：TTL 必须明显小于临时链接有效期；缓存失效只影响性能，不影响正确性
const imageUrlCache = new Map()
const IMAGE_URL_TTL = 30 * 60 * 1000
const IMAGE_URL_CACHE_MAX = 5000

// 批量解析 fileID -> 临时链接：命中缓存直接用，只请求未命中的部分
async function resolveImageUrls(ids) {
	const now = Date.now()
	const result = {}
	const pending = []
	ids.forEach(id => {
		const hit = imageUrlCache.get(id)
		if (hit && hit.expire > now) {
			result[id] = hit.url
			return
		}
		pending.push(id)
	})
	if (pending.length) {
		try {
			const res = await uniCloud.getTempFileURL({
				fileList: pending
			})
			;(res.fileList || []).forEach(f => {
				if (f && f.fileID && f.tempFileURL) {
					result[f.fileID] = f.tempFileURL
					imageUrlCache.set(f.fileID, {
						url: f.tempFileURL,
						expire: now + IMAGE_URL_TTL
					})
				}
			})
		} catch (e) {}
		// 超出上限时淘汰最旧的一批，避免实例内存无界增长
		if (imageUrlCache.size > IMAGE_URL_CACHE_MAX) {
			const overflow = imageUrlCache.size - IMAGE_URL_CACHE_MAX
			let i = 0
			for (const key of imageUrlCache.keys()) {
				imageUrlCache.delete(key)
				if (++i >= overflow) break
			}
		}
	}
	return result
}

// 批量把地点图片 fileID 解析为可访问的临时链接（带缓存）
// onlyFirst 为 true 时只解析每处地点的首图（写入 spot.thumb），用于列表，降低解析量
// onlyFirst 为 false 时解析全部图片（写入 spot.image_urls，同时给出 thumb），用于详情
// 客户端 uniCloud.getTempFileURL 在部分真机上不可靠，统一改由云端解析后下发给前端
async function attachImageUrls(list, onlyFirst) {
	if (!list || !list.length) return
	const ids = []
	list.forEach(spot => {
		const images = Array.isArray(spot.images) ? spot.images : []
		const picked = onlyFirst ? images.slice(0, 1) : images
		picked.forEach(id => {
			if (id && ids.indexOf(id) === -1) ids.push(id)
		})
	})
	const map = ids.length ? await resolveImageUrls(ids) : {}
	list.forEach(spot => {
		const images = Array.isArray(spot.images) ? spot.images : []
		const first = images[0]
		spot.thumb = first ? (map[first] || '') : ''
		if (onlyFirst) {
			delete spot.image_urls
		} else {
			spot.image_urls = images.map(id => map[id]).filter(u => !!u)
		}
	})
}

// 两点球面距离（米）
function distanceMeters(lat1, lng1, lat2, lng2) {
	if (![lat1, lng1, lat2, lng2].every(n => Number.isFinite(n))) return null
	const R = 6371000
	const toRad = d => (d * Math.PI) / 180
	const dLat = toRad(lat2 - lat1)
	const dLng = toRad(lng2 - lng1)
	const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
	return 2 * R * Math.asin(Math.sqrt(a))
}

module.exports = {
	toNumber,
	normalizeImages,
	buildUpdateData,
	attachRating,
	attachImageUrls,
	distanceMeters
}
