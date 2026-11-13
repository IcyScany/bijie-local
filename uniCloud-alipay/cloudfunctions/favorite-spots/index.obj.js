// 云对象教程: https://uniapp.dcloud.net.cn/uniCloud/cloud-obj
// jsdoc语法提示教程：https://ask.dcloud.net.cn/docs/#//ask.dcloud.net.cn/article/129
const crypto = require('crypto')
const db = uniCloud.database()
const dbCmd = db.command
const collection = db.collection('favorite-spots')

const TOKEN_SECRET = 'bijie-local-token-secret-change-me'
const TYPE_LIST = ['food', 'view', 'toilet', 'shop', 'other']
const STATUS_LIST = ['approved', 'pending', 'rejected']
const SOURCE_LIST = ['admin', 'user']
const REPORT_TYPE_LIST = ['new', 'correction']

function toNumber(value) {
	const num = Number(value)
	return Number.isFinite(num) ? num : null
}

function normalizeImages(images) {
	if (!Array.isArray(images)) {
		return null
	}
	return images
		.filter(item => typeof item === 'string' && item)
		.slice(0, 9)
}

function parseToken(token) {
	if (!token || typeof token !== 'string') {
		return null
	}
	const parts = token.split('.')
	if (parts.length !== 2) {
		return null
	}
	const base = parts[0]
	const sig = parts[1]
	const expect = crypto.createHmac('sha256', TOKEN_SECRET).update(base).digest('hex')
	if (expect !== sig) {
		return null
	}
	try {
		const payload = JSON.parse(Buffer.from(base, 'base64').toString('utf8'))
		if (!payload.openid || !payload.expire || payload.expire < Date.now()) {
			return null
		}
		return payload
	} catch (e) {
		return null
	}
}

async function requireAdmin(token) {
	const payload = parseToken(token)
	if (!payload) {
		throw new Error('登录状态失效，请重新登录')
	}
	const res = await db.collection('admin-whitelist').where({
		openid: payload.openid
	}).limit(1).get()
	if (!res.data.length) {
		throw new Error('无管理权限')
	}
	return payload.openid
}

async function resolveContributorName(openid) {
	const res = await db.collection('users').where({
		openid
	}).limit(1).get()
	if (res.data.length && res.data[0].nickname) {
		return res.data[0].nickname
	}
	return '用户' + String(openid).slice(-4)
}

// 记录贡献明细，并累加用户贡献次数
async function recordContribution(openid, action, spot = {}) {
	if (!openid) return
	try {
		const now = Date.now()
		const name = await resolveContributorName(openid)
		await db.collection('contributions').add({
			openid,
			name,
			action,
			spot_id: spot.spotId || '',
			spot_name: spot.spotName || '',
			create_date: now
		})
		const users = db.collection('users')
		const userRes = await users.where({
			openid
		}).limit(1).get()
		if (userRes.data.length) {
			await users.doc(userRes.data[0]._id).update({
				contribution_count: dbCmd.inc(1),
				last_contribution_date: now,
				update_date: now
			})
		}
	} catch (e) {}
}

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

module.exports = {
	_before: function() { // 通用预处理器

	},

	// 分页查询地点列表，支持关键词、类型、审核状态、来源筛选
	async getList(params = {}) {
		const keyword = String(params.keyword || '').trim()
		const type = params.type
		const status = params.status
		const source = params.source
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
		const listRes = await collection
			.where(where)
			.orderBy('create_date', 'desc')
			.skip((page - 1) * pageSize)
			.limit(pageSize)
			.get()

		const list = listRes.data || []

		// 合并评分汇总，避免前端二次请求
		if (params.withRating && list.length) {
			const $ = dbCmd.aggregate
			const ids = list.map(item => item._id)
			const agg = await db.collection('spot-comments')
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
			const ratingMap = {}
			;(agg.data || []).forEach(row => {
				ratingMap[row._id] = {
					rating: row.avg ? Math.round(row.avg * 10) / 10 : 0,
					rating_count: row.count || 0
				}
			})
			list.forEach(item => {
				const r = ratingMap[item._id]
				item.rating = r ? r.rating : 0
				item.rating_count = r ? r.rating_count : 0
			})
		}

		return {
			list,
			total: countRes.total,
			page,
			pageSize
		}
	},

	// 查询单个地点详情
	async getDetail(id) {
		if (!id) {
			throw new Error('缺少地点ID')
		}
		const res = await collection.doc(id).get()
		return {
			data: res.data && res.data[0] ? res.data[0] : null
		}
	},

	// 为已通过审核的地点补充图片（登录用户即可）
	async addImages(id, images, token) {
		const payload = parseToken(token)
		if (!payload) {
			throw new Error('登录状态失效，请重新登录')
		}
		if (!id) {
			throw new Error('缺少地点ID')
		}
		const list = normalizeImages(images) || []
		if (!list.length) {
			throw new Error('请选择图片')
		}
		const docRes = await collection.doc(id).get()
		if (!docRes.data || !docRes.data.length) {
			throw new Error('地点不存在')
		}
		const spot = docRes.data[0]
		const merged = Array.isArray(spot.images) ? spot.images.slice() : []
		list.forEach(img => {
			if (merged.indexOf(img) === -1 && merged.length < 9) {
				merged.push(img)
			}
		})
		await collection.doc(id).update({
			images: merged,
			updater_openid: payload.openid,
			updater_name: await resolveContributorName(payload.openid),
			update_date: Date.now()
		})
		return {
			images: merged
		}
	},

	// 管理员新增地点（默认已通过）
	async add(data = {}, token) {
		const openid = await requireAdmin(token)
		const name = String(data.name || '').trim()
		if (!name) {
			throw new Error('地点名称不能为空')
		}
		if (!String(data.address || '').trim()) {
			throw new Error('地址不能为空')
		}
		if (!TYPE_LIST.includes(data.type)) {
			throw new Error('请选择地点类型')
		}

		const record = buildUpdateData(data)
		record.name = name
		if (record.type === undefined) {
			record.type = 'other'
		}
		record.status = 'approved'
		record.source = 'admin'
		record.report_type = 'new'
		record.contributor_openid = openid
		record.contributor_name = await resolveContributorName(openid)
		record.create_date = Date.now()
		record.update_date = Date.now()

		const res = await collection.add(record)
		await recordContribution(openid, 'add', {
			spotId: res.id,
			spotName: name
		})
		return {
			id: res.id
		}
	},

	// 管理员修改地点
	async update(id, data = {}, token) {
		const openid = await requireAdmin(token)
		if (!id) {
			throw new Error('缺少地点ID')
		}

		if (data.address !== undefined && !String(data.address).trim()) {
			throw new Error('地址不能为空')
		}
		if (data.type !== undefined && !TYPE_LIST.includes(data.type)) {
			throw new Error('请选择地点类型')
		}

		const updateData = buildUpdateData(data)
		if (!Object.keys(updateData).length) {
			throw new Error('没有需要更新的内容')
		}
		updateData.updater_openid = openid
		updateData.updater_name = await resolveContributorName(openid)
		updateData.update_date = Date.now()

		const res = await collection.doc(id).update(updateData)
		await recordContribution(openid, 'update', {
			spotId: id,
			spotName: updateData.name || ''
		})
		return {
			updated: res.updated
		}
	},

	// 删除地点，支持传入单个ID或ID数组
	async remove(id, token) {
		await requireAdmin(token)
		if (!id) {
			throw new Error('缺少地点ID')
		}
		const ids = Array.isArray(id) ? id : [id]
		const res = await collection.where({
			_id: dbCmd.in(ids)
		}).remove()
		return {
			removed: res.deleted
		}
	},

	// 普通用户匿名提交新地点或纠错反馈，进入待审核（登录用户自动记录贡献者）
	async submit(data = {}, token) {
		const reportType = REPORT_TYPE_LIST.includes(data.report_type) ? data.report_type : 'new'

		if (reportType === 'new') {
			const name = String(data.name || '').trim()
			if (!name) {
				throw new Error('请填写地点名称')
			}
			if (!String(data.address || '').trim()) {
				throw new Error('请填写地址')
			}
			if (!TYPE_LIST.includes(data.type)) {
				throw new Error('请选择地点类型')
			}
		} else if (!String(data.report_reason || '').trim()) {
			throw new Error('请填写纠错说明')
		}

		const record = buildUpdateData(data)
		if (record.type === undefined) {
			record.type = 'other'
		}
		record.name = String(data.name || '').trim() || '纠错反馈'
		record.status = 'pending'
		record.source = 'user'
		record.report_type = reportType
		const payload = parseToken(token)
		if (payload && payload.openid) {
			record.contributor_openid = payload.openid
			record.contributor_name = await resolveContributorName(payload.openid)
		}
		if (data.report_reason !== undefined) {
			record.report_reason = String(data.report_reason).trim()
		}
		if (data.target_id !== undefined) {
			record.target_id = String(data.target_id).trim()
		}
		record.create_date = Date.now()
		record.update_date = Date.now()

		const res = await collection.add(record)
		if (payload && payload.openid) {
			await recordContribution(payload.openid, 'submit', {
				spotId: res.id,
				spotName: record.name
			})
		}
		return {
			id: res.id
		}
	},

	// 管理员审核：通过或驳回
	async review(id, status, token) {
		await requireAdmin(token)
		if (!id) {
			throw new Error('缺少地点ID')
		}
		if (!['approved', 'rejected'].includes(status)) {
			throw new Error('审核状态不合法')
		}
		const res = await collection.doc(id).update({
			status,
			update_date: Date.now()
		})
		return {
			updated: res.updated
		}
	}
}
