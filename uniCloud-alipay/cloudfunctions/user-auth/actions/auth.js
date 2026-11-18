'use strict'

const db = uniCloud.database()
const { createToken, parseToken, isWhitelisted, getUserByOpenid } = require('cloud-auth')
const { buildNickname, resolveOpenid } = require('../lib/wechat')
const { ensureAdmin } = require('../lib/users')

// 登录：换取 OpenID、写入用户表、判定管理员并签发 Token
async function login(event) {
	const openid = await resolveOpenid(event)
	const now = Date.now()
	const userCol = db.collection('users')
	let user = await getUserByOpenid(openid)

	if (user) {
		await userCol.doc(user._id).update({
			last_login_date: now,
			update_date: now
		})
	} else {
		const nickname = buildNickname(openid, event.nickname)
		const addRes = await userCol.add({
			openid,
			nickname,
			avatar: event.avatar || '',
			is_admin: false,
			contribution_count: 0,
			contribution_points: 0,
			last_login_date: now,
			create_date: now,
			update_date: now
		})
		user = {
			_id: addRes.id,
			openid,
			nickname,
			avatar: event.avatar || ''
		}
	}

	let nickname = user.nickname
	if (!nickname) {
		nickname = buildNickname(openid, '')
		await userCol.doc(user._id).update({
			nickname,
			update_date: Date.now()
		})
	}

	const admin = await ensureAdmin(openid)
	if (admin && !user.is_admin) {
		await userCol.doc(user._id).update({
			is_admin: true,
			update_date: Date.now()
		})
	}

	return {
		code: 0,
		data: {
			token: createToken(openid),
			openid,
			isAdmin: admin,
			userInfo: {
				nickname,
				avatar: user.avatar || ''
			}
		}
	}
}

// 更新用户昵称、头像
async function updateProfile(event) {
	const payload = parseToken(event.token)
	if (!payload) {
		throw new Error('登录状态失效，请重新进入')
	}
	const user = await getUserByOpenid(payload.openid)
	if (!user) {
		throw new Error('用户不存在')
	}
	const updateData = {
		update_date: Date.now()
	}
	if (event.nickname !== undefined) {
		updateData.nickname = String(event.nickname).trim()
	}
	if (event.avatar !== undefined) {
		updateData.avatar = String(event.avatar).trim()
	}
	await db.collection('users').doc(user._id).update(updateData)
	return {
		code: 0,
		data: {
			nickname: updateData.nickname || user.nickname,
			avatar: updateData.avatar || user.avatar
		}
	}
}

// 校验当前 token 对应的用户是否为管理员
async function check(event) {
	const payload = parseToken(event.token)
	if (!payload) {
		return {
			code: 0,
			data: {
				isAdmin: false,
				openid: ''
			}
		}
	}
	const admin = await isWhitelisted(payload.openid)
	return {
		code: 0,
		data: {
			isAdmin: admin,
			openid: payload.openid
		}
	}
}

// 获取当前登录用户资料与贡献统计
async function getProfile(event) {
	const payload = parseToken(event.token)
	if (!payload) {
		return {
			code: 0,
			data: null
		}
	}
	const user = await getUserByOpenid(payload.openid)
	if (!user) {
		return {
			code: 0,
			data: null
		}
	}
	const admin = await isWhitelisted(payload.openid)
	return {
		code: 0,
		data: {
			openid: payload.openid,
			nickname: user.nickname || '',
			avatar: user.avatar || '',
			contributionCount: user.contribution_count || 0,
			contributionPoints: user.contribution_points || 0,
			lastContributionDate: user.last_contribution_date || 0,
			isAdmin: admin
		}
	}
}

module.exports = {
	login,
	updateProfile,
	check,
	getProfile
}
