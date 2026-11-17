// 地点收藏云对象
'use strict';

const db = uniCloud.database()
const dbCmd = db.command
const collection = db.collection('spot-favorites')
const spotsCollection = db.collection('spots')

const { parseToken } = require('cloud-auth')

// 批量把地点图片的 fileID 转成可访问链接
async function resolveSpotImages(list) {
	const ids = []
	;(list || []).forEach(spot => {
		(spot.images || []).forEach(id => {
			if (id && ids.indexOf(id) === -1) ids.push(id)
		})
	})
	if (!ids.length) return {}
	try {
		const res = await uniCloud.getTempFileURL({
			fileList: ids
		})
		const map = {}
		;(res.fileList || []).forEach(f => {
			if (f.fileID && f.tempFileURL) map[f.fileID] = f.tempFileURL
		})
		return map
	} catch (e) {
		return {}
	}
}

module.exports = {
	// 通用预处理器
	_before: function() {},

	// 收藏 / 取消收藏，返回最新状态
	async toggle(spot_id, token) {
		const payload = parseToken(token)
		if (!payload) {
			throw new Error('登录状态失效，请重新登录')
		}
		if (!spot_id) {
			throw new Error('缺少地点标识')
		}
		const where = {
			openid: payload.openid,
			spot_id
		}
		const exist = await collection.where(where).limit(1).get()
		if (exist.data && exist.data.length) {
			await collection.where(where).remove()
			return {
				code: 0,
				data: {
					filled: false
				}
			}
		}
		await collection.add({
			openid: payload.openid,
			spot_id,
			create_date: Date.now()
		})
		return {
			code: 0,
			data: {
				filled: true
			}
		}
	},

	// 当前用户收藏的 spot_id 列表
	async ids(token) {
		const payload = parseToken(token)
		if (!payload) {
			throw new Error('登录状态失效，请重新登录')
		}
		const res = await collection
			.where({
				openid: payload.openid
			})
			.orderBy('create_date', 'desc')
			.limit(200)
			.get()
		return {
			code: 0,
			data: (res.data || []).map(item => item.spot_id)
		}
	},

	// 当前用户收藏的地点列表（含地点信息与图片临时链接）
	async list(token) {
		const payload = parseToken(token)
		if (!payload) {
			throw new Error('登录状态失效，请重新登录')
		}
		const favRes = await collection
			.where({
				openid: payload.openid
			})
			.orderBy('create_date', 'desc')
			.limit(200)
			.get()
		const ids = (favRes.data || []).map(item => item.spot_id)
		if (!ids.length) {
			return {
				code: 0,
				data: []
			}
		}
		const spotsRes = await spotsCollection
			.where({
				_id: dbCmd.in(ids)
			})
			.get()
		const map = {}
		;(spotsRes.data || []).forEach(spot => {
			map[spot._id] = spot
		})
		const list = ids.map(id => map[id]).filter(Boolean)
		const imageMap = await resolveSpotImages(list)
		list.forEach(spot => {
			const first = (spot.images || [])[0]
			spot.thumb = first ? (imageMap[first] || '') : ''
		})
		return {
			code: 0,
			data: list
		}
	}
}
