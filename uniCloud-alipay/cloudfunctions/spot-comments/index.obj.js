// 云对象教程: https://uniapp.dcloud.net.cn/uniCloud/cloud-obj
// 地点评价：列表查询、评分汇总、新增评价、删除评价
'use strict';

const db = uniCloud.database()
const dbCmd = db.command
const collection = db.collection('spot-comments')

const { parseToken, isWhitelisted, getUserByOpenid } = require('cloud-auth')

// 评分取整并限制在 1~5，非法值返回 0
function clampRating(value) {
	const n = Math.round(Number(value))
	if (!Number.isFinite(n)) {
		return 0
	}
	if (n < 1) return 1
	if (n > 5) return 5
	return n
}

module.exports = {
	// 通用预处理器
	_before: function() {},

	// 某地点的评价列表 + 评分汇总
	async getList(params = {}) {
		const spotId = params.spot_id
		if (!spotId) {
			throw new Error('缺少地点标识')
		}
		const page = Math.max(1, Number(params.page) || 1)
		const pageSize = Math.min(50, Math.max(1, Number(params.pageSize) || 20))

		const where = {
			spot_id: spotId
		}

		const countRes = await collection.where(where).count()
		const total = countRes.total || 0

		const listRes = await collection
			.where(where)
			.orderBy('create_date', 'desc')
			.skip((page - 1) * pageSize)
			.limit(pageSize)
			.get()

		let avg = 0
		if (total > 0) {
			const $ = dbCmd.aggregate
			const agg = await collection
				.aggregate()
				.match(where)
				.group({
					_id: null,
					avg: $.avg('$rating')
				})
				.end()
			const row = (agg.data && agg.data[0]) || null
			if (row && row.avg) {
				avg = Math.round(row.avg * 10) / 10
			}
		}

		return {
			code: 0,
			data: {
				list: listRes.data,
				total,
				avg
			}
		}
	},

	// 批量获取多个地点的评分汇总 { spot_id: { avg, count } }
	async getSummaries(params = {}) {
		const ids = Array.isArray(params.spot_ids) ? params.spot_ids.filter(id => typeof id === 'string' && id) : []
		if (!ids.length) {
			return {
				code: 0,
				data: {}
			}
		}
		const $ = dbCmd.aggregate
		const agg = await collection
			.aggregate()
			.match({
				spot_id: dbCmd.in(ids)
			})
			.group({
				_id: '$spot_id',
				avg: $.avg('$rating'),
				count: $.sum(1)
			})
			.end()

		const map = {}
		;(agg.data || []).forEach(item => {
			map[item._id] = {
				avg: item.avg ? Math.round(item.avg * 10) / 10 : 0,
				count: item.count || 0
			}
		})
		return {
			code: 0,
			data: map
		}
	},

	// 新增评价（需登录）
	async addComment(data = {}, token) {
		const payload = parseToken(token)
		if (!payload) {
			throw new Error('登录状态失效，请重新登录')
		}
		const spotId = data.spot_id
		if (!spotId) {
			throw new Error('缺少地点标识')
		}
		const rating = clampRating(data.rating)
		if (rating < 1) {
			throw new Error('请选择评分')
		}
		const content = String(data.content || '').trim().slice(0, 500)
		if (!content) {
			throw new Error('请输入评价内容')
		}

		const user = await getUserByOpenid(payload.openid)
		const nickname = (user && user.nickname) || ('用户' + String(payload.openid).slice(-4))
		const avatar = (user && user.avatar) || ''
		const now = Date.now()

		const addRes = await collection.add({
			spot_id: spotId,
			openid: payload.openid,
			nickname,
			avatar,
			rating,
			content,
			create_date: now
		})

		return {
			code: 0,
			data: {
				_id: addRes.id,
				spot_id: spotId,
				openid: payload.openid,
				nickname,
				avatar,
				rating,
				content,
				create_date: now
			}
		}
	},

	// 删除评价（本人或管理员）
	async remove(id, token) {
		const payload = parseToken(token)
		if (!payload) {
			throw new Error('登录状态失效，请重新登录')
		}
		if (!id) {
			throw new Error('缺少评价标识')
		}
		const res = await collection.doc(id).get()
		if (!res.data || !res.data.length) {
			throw new Error('评价不存在')
		}
		const comment = res.data[0]
		const isOwner = comment.openid === payload.openid
		if (!isOwner && !(await isWhitelisted(payload.openid))) {
			throw new Error('无权限删除')
		}
		await collection.doc(id).remove()
		return {
			code: 0,
			data: {
				id
			}
		}
	}
}
