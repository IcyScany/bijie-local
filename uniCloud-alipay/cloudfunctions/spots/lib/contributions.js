'use strict'

const db = uniCloud.database()
const dbCmd = db.command
const { resolveContributorName } = require('cloud-auth')

// 积分规则（审核通过后计入）：新增地点 10 分、更新反馈 3 分、补充图片每张 2 分（单次最多 5 分）
const POINTS = {
	new: 10,
	update: 3,
	image: 2,
	imageMax: 5
}

// 计算某条共创的积分（按类型：新增地点 / 更新反馈 / 补充图片）
function calcPoints(entry = {}) {
	const type = entry.report_type || entry.action
	if (type === 'image') {
		const count = Math.max(1, Number(entry.imageCount) || 1)
		return Math.min(count * POINTS.image, POINTS.imageMax)
	}
	if (type === 'update') return POINTS.update
	return POINTS.new
}

// 调整用户积分与共创次数（points / countDelta 可为负，用于撤销）
async function incUserContribution(openid, points = 0, countDelta = 1) {
	if (!openid) return
	const now = Date.now()
	const users = db.collection('users')
	const userRes = await users.where({
		openid
	}).limit(1).get()
	if (!userRes.data.length) return
	const updateData = {
		last_contribution_date: now,
		update_date: now
	}
	if (points) {
		updateData.contribution_points = dbCmd.inc(points)
	}
	if (countDelta) {
		updateData.contribution_count = dbCmd.inc(countDelta)
	}
	await users.doc(userRes.data[0]._id).update(updateData)
}

// 记录共创明细（含积分）；status 为 approved 时才计入积分
async function recordContribution(openid, action, spot = {}, status = 'approved') {
	if (!openid) return ''
	try {
		const now = Date.now()
		const name = await resolveContributorName(openid)
		const points = calcPoints({
			action,
			report_type: spot.reportType,
			imageCount: spot.imageCount
		})
		const addRes = await db.collection('contributions').add({
			openid,
			name,
			action,
			spot_id: spot.spotId || '',
			spot_name: spot.spotName || '',
			report_type: spot.reportType || '',
			report_reason: spot.reportReason || '',
			points,
			status,
			create_date: now,
			update_date: now
		})
		if (status === 'approved') {
			await incUserContribution(openid, points, 1)
		}
		return addRes.id
	} catch (e) {
		return ''
	}
}

// 审核状态变化：同步该地点所有投稿明细，并按状态变化增减积分
// approved -> 其他：撤销积分；其他 -> approved：计入积分
async function syncSpotContributions(spotId, status) {
	if (!spotId) return
	const res = await db.collection('contributions').where({
		spot_id: spotId
	}).get()
	for (const item of (res.data || [])) {
		if (item.status === status) continue
		const wasApproved = item.status === 'approved'
		const isApproved = status === 'approved'
		await db.collection('contributions').doc(item._id).update({
			status,
			update_date: Date.now()
		})
		if (!item.openid) continue
		const points = Number(item.points) || calcPoints(item)
		if (isApproved && !wasApproved) {
			await incUserContribution(item.openid, points, 1)
		} else if (!isApproved && wasApproved) {
			await incUserContribution(item.openid, -points, -1)
		}
	}
}

// 删除地点时撤销相关已计分的贡献（明细保留，状态置为 rejected 并扣回积分）
async function revokeSpotContributions(spotIds) {
	const ids = Array.isArray(spotIds) ? spotIds : [spotIds]
	if (!ids.length) return
	const res = await db.collection('contributions').where({
		spot_id: dbCmd.in(ids),
		status: 'approved'
	}).get()
	for (const item of (res.data || [])) {
		if (!item.openid) continue
		const points = Number(item.points) || calcPoints(item)
		await incUserContribution(item.openid, -points, -1)
		await db.collection('contributions').doc(item._id).update({
			status: 'rejected',
			update_date: Date.now()
		})
	}
}

module.exports = {
	POINTS,
	calcPoints,
	incUserContribution,
	recordContribution,
	syncSpotContributions,
	revokeSpotContributions
}
