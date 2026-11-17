'use strict'

const db = uniCloud.database()
const dbCmd = db.command
const { resolveContributorName } = require('cloud-auth')

// 用户贡献次数 +1，并更新最近贡献时间
async function incUserContribution(openid) {
	if (!openid) return
	const now = Date.now()
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
}

// 记录贡献明细（含内容与状态）；status 为 approved 时才累加贡献次数
async function recordContribution(openid, action, spot = {}, status = 'approved') {
	if (!openid) return ''
	try {
		const now = Date.now()
		const name = await resolveContributorName(openid)
		const addRes = await db.collection('contributions').add({
			openid,
			name,
			action,
			spot_id: spot.spotId || '',
			spot_name: spot.spotName || '',
			report_type: spot.reportType || '',
			report_reason: spot.reportReason || '',
			status,
			create_date: now,
			update_date: now
		})
		if (status === 'approved') {
			await incUserContribution(openid)
		}
		return addRes.id
	} catch (e) {
		return ''
	}
}

// 审核后同步该地点待审核贡献明细的状态；仅通过时累加贡献次数
async function syncPendingContributions(spotId, status) {
	const pendingRes = await db.collection('contributions').where({
		spot_id: spotId,
		action: 'submit',
		status: 'pending'
	}).get()
	for (const item of (pendingRes.data || [])) {
		await db.collection('contributions').doc(item._id).update({
			status,
			update_date: Date.now()
		})
		if (status === 'approved' && item.openid) {
			await incUserContribution(item.openid)
		}
	}
}

module.exports = {
	incUserContribution,
	recordContribution,
	syncPendingContributions
}
