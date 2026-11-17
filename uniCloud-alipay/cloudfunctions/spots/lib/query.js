'use strict'

const db = uniCloud.database()
const dbCmd = db.command
const collection = db.collection('spots')
const { parseToken } = require('cloud-auth')
const { TYPE_LIST, STATUS_LIST, SOURCE_LIST } = require('./constants')
const { attachRating, distanceMeters } = require('./helpers')

// 分页查询地点列表，支持关键词、类型、审核状态、来源筛选与排序（rating/distance）
async function getList(params = {}) {
	const keyword = String(params.keyword || '').trim()
	const type = params.type
	const status = params.status
	const source = params.source
	const sort = params.sort
	const lat = Number(params.latitude)
	const lng = Number(params.longitude)
	const page = Math.max(1, parseInt(params.page, 10) || 1)
	const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize, 10) || 20))

	const where = {}
	if (type && TYPE_LIST.includes(type)) {
		where.type = type
	}
	if (status && STATUS_LIST.includes(status)) {
		if (status === 'approved') {
			where.status = dbCmd.or(dbCmd.exists(false), dbCmd.eq('approved'))
		} else {
			where.status = status
		}
	}
	if (source && SOURCE_LIST.includes(source)) {
		where.source = source
	}
	if (keyword) {
		where.name = db.RegExp({
			regexp: keyword,
			options: 'i'
		})
	}

	const countRes = await collection.where(where).count()

	const needSort = sort === 'rating' || (sort === 'distance' && Number.isFinite(lat) && Number.isFinite(lng))

	// 不需要排序：直接按创建时间分页
	if (!needSort) {
		const listRes = await collection
			.where(where)
			.orderBy('create_date', 'desc')
			.skip((page - 1) * pageSize)
			.limit(pageSize)
			.get()
		const list = listRes.data || []
		if (params.withRating && list.length) {
			await attachRating(list)
		}
		return {
			list,
			total: countRes.total,
			page,
			pageSize
		}
	}

	// 需要排序：取全量后排序再分页
	const MAX = 1000
	const allRes = await collection
		.where(where)
		.orderBy('create_date', 'desc')
		.limit(MAX)
		.get()
	const list = allRes.data || []
	if (params.withRating && list.length) {
		await attachRating(list)
	}
	if (sort === 'rating') {
		list.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0))
	} else {
		list.forEach(item => {
			item._distance = distanceMeters(lat, lng, Number(item.latitude), Number(item.longitude))
		})
		list.sort((a, b) => {
			const da = a._distance
			const db2 = b._distance
			if (da == null && db2 == null) return 0
			if (da == null) return 1
			if (db2 == null) return -1
			return da - db2
		})
	}
	const start = (page - 1) * pageSize
	return {
		list: list.slice(start, start + pageSize),
		total: countRes.total,
		page,
		pageSize
	}
}

// 查询单个地点详情
async function getDetail(id) {
	if (!id) {
		throw new Error('缺少地点ID')
	}
	const res = await collection.doc(id).get()
	return {
		data: res.data && res.data[0] ? res.data[0] : null
	}
}

// 当前用户自己的贡献记录（无论是否通过）；options.type: all|new|update
async function listMyContributions(token, options = {}) {
	const payload = parseToken(token)
	if (!payload) {
		throw new Error('登录状态失效，请重新登录')
	}
	const type = options && options.type
	const p = Math.max(1, parseInt(options && options.page, 10) || 1)
	const size = Math.min(50, Math.max(1, parseInt(options && options.pageSize, 10) || 50))
	const where = {
		openid: payload.openid
	}
	if (type === 'new') {
		where.report_type = 'new'
	} else if (type === 'update') {
		where.report_type = 'update'
	}
	const countRes = await db.collection('contributions').where(where).count()
	const listRes = await db.collection('contributions')
		.where(where)
		.orderBy('create_date', 'desc')
		.skip((p - 1) * size)
		.limit(size)
		.get()
	return {
		list: listRes.data || [],
		total: countRes.total || 0
	}
}

module.exports = {
	getList,
	getDetail,
	listMyContributions
}
