'use strict'

const db = uniCloud.database()
const dbCmd = db.command
const collection = db.collection('spots')
const { parseToken, requireAdmin, resolveContributorName } = require('cloud-auth')
const { TYPE_LIST, REPORT_TYPE_LIST } = require('./constants')
const { buildUpdateData, normalizeImages } = require('./helpers')
const { recordContribution, syncPendingContributions } = require('./contributions')

// 为已通过审核的地点补充图片（登录用户即可）
async function addImages(id, images, token) {
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
}

// 管理员新增地点（默认已通过）
async function add(data = {}, token) {
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
		spotName: name,
		reportType: 'new'
	}, 'approved')
	return {
		id: res.id
	}
}

// 管理员修改地点
async function update(id, data = {}, token) {
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
	}, 'approved')
	return {
		updated: res.updated
	}
}

// 删除地点，支持传入单个ID或ID数组
async function remove(id, token) {
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
}

// 普通用户匿名提交新地点或更新反馈，进入待审核（登录用户自动记录贡献者）
async function submit(data = {}, token) {
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
		throw new Error('请填写更新说明')
	}

	const record = buildUpdateData(data)
	if (record.type === undefined) {
		record.type = 'other'
	}
	record.name = String(data.name || '').trim() || '更新反馈'
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
	// 提交即记录贡献明细（待审核，不计数），便于用户查看自己的贡献记录
	if (record.contributor_openid) {
		await recordContribution(record.contributor_openid, 'submit', {
			spotId: res.id,
			spotName: record.name,
			reportType: record.report_type,
			reportReason: record.report_reason || ''
		}, 'pending')
	}
	return {
		id: res.id
	}
}

// 管理员审核：通过或驳回
async function review(id, status, token) {
	await requireAdmin(token)
	if (!id) {
		throw new Error('缺少地点ID')
	}
	if (!['approved', 'rejected'].includes(status)) {
		throw new Error('审核状态不合法')
	}
	const docRes = await collection.doc(id).get()
	const spot = (docRes.data && docRes.data[0]) || null
	if (!spot) {
		throw new Error('地点不存在')
	}
	const res = await collection.doc(id).update({
		status,
		update_date: Date.now()
	})
	await syncPendingContributions(id, status)
	return {
		updated: res.updated
	}
}

module.exports = {
	addImages,
	add,
	update,
	remove,
	submit,
	review
}
