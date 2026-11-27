'use strict'

const db = uniCloud.database()
const dbCmd = db.command
const collection = db.collection('spots')
const { requireAdmin, requireSuperAdmin, isSuperAdmin, resolveContributorName } = require('cloud-auth')
const { TYPE_LIST, REPORT_TYPE_LIST } = require('./constants')
const { buildUpdateData, normalizeImages } = require('./helpers')
const { recordContribution, syncSpotContributions, revokeSpotContributions } = require('./contributions')
const { notifyPendingReview } = require('./notify')

// 管理员为已通过审核的地点补充图片：生成待审核投稿（审核通过后再合并到目标地点）
async function addImages(id, images, token) {
	const openid = await requireAdmin(token, {
		message: '仅管理员可补充图片'
	})
	if (!id) {
		throw new Error('缺少地点ID')
	}
	const list = normalizeImages(images) || []
	if (!list.length) {
		throw new Error('请选择图片')
	}
	if (list.length > 5) {
		throw new Error('一次最多上传 5 张')
	}
	const docRes = await collection.doc(id).get()
	if (!docRes.data || !docRes.data.length) {
		throw new Error('地点不存在')
	}
	const spot = docRes.data[0]
	const now = Date.now()
	const contributorName = await resolveContributorName(openid)

	// 超级管理员补图：直接合并到目标地点并生效，无需审核
	if (await isSuperAdmin(openid)) {
		const merged = Array.isArray(spot.images) ? spot.images.slice() : []
		list.forEach(img => {
			if (img && merged.indexOf(img) === -1 && merged.length < 9) {
				merged.push(img)
			}
		})
		await collection.doc(id).update({
			images: merged,
			update_date: Date.now()
		})
		await recordContribution(openid, 'image', {
			spotId: id,
			spotName: spot.name || '',
			reportType: 'image',
			imageCount: list.length
		}, 'approved')
		return {
			id,
			pending: false
		}
	}

	// 普通管理员：复用 spots 记录作为待审核投稿：report_type=image，target_id 指向目标地点
	const addRes = await collection.add({
		name: spot.name || '图片补充',
		type: spot.type || 'other',
		address: spot.address || '',
		longitude: spot.longitude,
		latitude: spot.latitude,
		images: list,
		status: 'pending',
		source: 'user',
		report_type: 'image',
		target_id: id,
		contributor_openid: openid,
		contributor_name: contributorName,
		create_date: now,
		update_date: now
	})

	await recordContribution(openid, 'image', {
		spotId: addRes.id,
		spotName: spot.name || '',
		reportType: 'image',
		imageCount: list.length
	}, 'pending')

	// 通知所有超级管理员：有新的待审核数据
	await notifyPendingReview({
		applicantName: contributorName,
		reportType: 'image',
		time: now
	})

	return {
		id: addRes.id,
		pending: true
	}
}

// 管理员新增地点（默认已通过）
async function add(data = {}, token) {
	const openid = await requireSuperAdmin(token, {
		message: '仅超级管理员可管理地点'
	})
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
	const openid = await requireSuperAdmin(token, {
		message: '仅超级管理员可管理地点'
	})
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
	// 管理员在地点管理中直接修改，不计入个人贡献
	return {
		updated: res.updated
	}
}

// 删除地点，支持传入单个ID或ID数组
async function remove(id, token) {
	await requireSuperAdmin(token, {
		message: '仅超级管理员可管理地点'
	})
	if (!id) {
		throw new Error('缺少地点ID')
	}
	const ids = Array.isArray(id) ? id : [id]
	// 删除地点前撤销相关已计分贡献
	await revokeSpotContributions(ids)
	const res = await collection.where({
		_id: dbCmd.in(ids)
	}).remove()
	return {
		removed: res.deleted
	}
}

// 管理员提交新地点或更新反馈，进入待审核（自动记录贡献者）
async function submit(data = {}, token) {
	const openid = await requireAdmin(token, {
		message: '仅管理员可提交地点信息'
	})
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
	record.contributor_openid = openid
	record.contributor_name = await resolveContributorName(openid)
	if (data.report_reason !== undefined) {
		record.report_reason = String(data.report_reason).trim()
	}
	if (data.target_id !== undefined) {
		record.target_id = String(data.target_id).trim()
	}
	record.create_date = Date.now()
	record.update_date = Date.now()

	const res = await collection.add(record)
	// 提交即记录贡献明细（待审核，不计数），便于查看贡献记录
	await recordContribution(openid, 'submit', {
		spotId: res.id,
		spotName: record.name,
		reportType: record.report_type,
		reportReason: record.report_reason || ''
	}, 'pending')

	// 通知所有超级管理员：有新的待审核数据
	await notifyPendingReview({
		applicantName: record.contributor_name,
		reportType: record.report_type,
		time: record.create_date
	})

	return {
		id: res.id
	}
}

// 管理员审核：通过 / 驳回（可带原因）/ 撤回驳回（pending）
async function review(id, status, token, reason) {
	await requireSuperAdmin(token, {
		message: '仅超级管理员可审核'
	})
	if (!id) {
		throw new Error('缺少地点ID')
	}
	if (!['approved', 'rejected', 'pending'].includes(status)) {
		throw new Error('审核状态不合法')
	}
	const docRes = await collection.doc(id).get()
	const spot = (docRes.data && docRes.data[0]) || null
	if (!spot) {
		throw new Error('地点不存在')
	}

	// 图片补充投稿：通过时把图片合并到目标地点并删除该投稿记录
	if (spot.report_type === 'image' && spot.target_id) {
		if (status === 'approved') {
			const targetRes = await collection.doc(spot.target_id).get()
			const target = (targetRes.data && targetRes.data[0]) || null
			if (target) {
				const merged = Array.isArray(target.images) ? target.images.slice() : []
				;(spot.images || []).forEach(img => {
					if (img && merged.indexOf(img) === -1 && merged.length < 9) {
						merged.push(img)
					}
				})
				await collection.doc(spot.target_id).update({
					images: merged,
					update_date: Date.now()
				})
			}
			// 计入该条投稿积分，随后移除投稿记录
			await syncSpotContributions(id, 'approved')
			await collection.doc(id).remove()
			return {
				updated: 1
			}
		}
		const imgRes = await collection.doc(id).update({
			status,
			update_date: Date.now(),
			reject_reason: status === 'rejected' ? String(reason || '').trim() : ''
		})
		await syncSpotContributions(id, status)
		return {
			updated: imgRes.updated
		}
	}

	const res = await collection.doc(id).update({
		status,
		update_date: Date.now(),
		// 驳回时记录原因；通过/撤回时清空
		reject_reason: status === 'rejected' ? String(reason || '').trim() : ''
	})
	await syncSpotContributions(id, status)
	return {
		updated: res.updated
	}
}

// 审核通过并发布：管理员可先编辑地点信息再发布（图片补充投稿仍走合并逻辑）
async function publish(id, data = {}, token) {
	const openid = await requireSuperAdmin(token, {
		message: '仅超级管理员可审核'
	})
	if (!id) {
		throw new Error('缺少地点ID')
	}
	const docRes = await collection.doc(id).get()
	const spot = (docRes.data && docRes.data[0]) || null
	if (!spot) {
		throw new Error('地点不存在')
	}
	// 图片补充投稿：通过时把图片并入目标地点
	if (spot.report_type === 'image' && spot.target_id) {
		return review(id, 'approved', token, '')
	}
	if (data.name !== undefined && !String(data.name).trim()) {
		throw new Error('地点名称不能为空')
	}
	if (data.address !== undefined && !String(data.address).trim()) {
		throw new Error('地址不能为空')
	}
	if (data.type !== undefined && !TYPE_LIST.includes(data.type)) {
		throw new Error('请选择地点类型')
	}
	const updateData = buildUpdateData(data)
	updateData.status = 'approved'
	updateData.reject_reason = ''
	updateData.update_date = Date.now()
	updateData.updater_openid = openid
	updateData.updater_name = await resolveContributorName(openid)
	await collection.doc(id).update(updateData)
	await syncSpotContributions(id, 'approved')
	return {
		updated: 1
	}
}

module.exports = {
	addImages,
	add,
	update,
	remove,
	submit,
	review,
	publish
}
