'use strict';

const crypto = require('crypto')
const db = uniCloud.database()

const WX_APPID = 'wxbcdf8a5b47b37852'
const WX_SECRET = '8ec410bc985359e8da8e45051bd4e8b2'
const TOKEN_SECRET = 'bijie-local-token-secret-change-me'
const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000

function createToken(openid) {
	const expire = Date.now() + TOKEN_TTL
	const payload = JSON.stringify({
		openid,
		expire
	})
	const base = Buffer.from(payload).toString('base64')
	const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(base).digest('hex')
	return base + '.' + sig
}

function parseToken(token) {
	if (!token || typeof token !== 'string') return null
	const parts = token.split('.')
	if (parts.length !== 2) return null
	const base = parts[0]
	const sig = parts[1]
	const expect = crypto.createHmac('sha256', TOKEN_SECRET).update(base).digest('hex')
	if (expect !== sig) return null
	try {
		const payload = JSON.parse(Buffer.from(base, 'base64').toString('utf8'))
		if (!payload.openid || !payload.expire || payload.expire < Date.now()) return null
		return payload
	} catch (e) {
		return null
	}
}

function buildNickname(openid, nickname) {
	if (nickname) return nickname
	return '用户' + String(openid).slice(-4)
}

async function resolveOpenid(event) {
	if (event.code) {
		if (!WX_SECRET) {
			throw new Error('未配置微信 AppSecret')
		}
		const url = 'https://api.weixin.qq.com/sns/jscode2session?appid=' + WX_APPID + '&secret=' + WX_SECRET + '&js_code=' + event.code + '&grant_type=authorization_code'
		const res = await uniCloud.httpclient.request(url, {
			dataType: 'json',
			timeout: 10000
		})
		const data = res.data || {}
		if (!data.openid) {
			throw new Error(data.errmsg || '微信登录失败')
		}
		return data.openid
	}
	if (event.openid) {
		return String(event.openid)
	}
	throw new Error('缺少登录凭证')
}

async function isWhitelisted(openid) {
	const res = await db.collection('admin-whitelist').where({
		openid
	}).limit(1).get()
	return res.data.length > 0
}

async function ensureAdmin(openid) {
	const whitelist = db.collection('admin-whitelist')
	if (await isWhitelisted(openid)) {
		return true
	}
	const countRes = await whitelist.count()
	if (countRes.total === 0) {
		await whitelist.add({
			openid,
			name: '初始管理员',
			create_date: Date.now()
		})
		return true
	}
	return false
}

async function getUserByOpenid(openid) {
	const res = await db.collection('users').where({
		openid
	}).limit(1).get()
	return res.data.length ? res.data[0] : null
}

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

// 贡献者排行：按贡献明细聚合统计
async function getContributors() {
	const $ = db.command.aggregate
	const res = await db.collection('contributions').aggregate()
		.group({
			_id: '$openid',
			name: $.first('$name'),
			count: $.sum(1),
			lastDate: $.max('$create_date')
		})
		.sort({
			count: -1
		})
		.limit(50)
		.end()

	const list = (res.data || []).map(item => ({
		openid: item._id,
		name: item.name || ('用户' + String(item._id).slice(-4)),
		count: item.count || 0,
		lastDate: item.lastDate || 0
	}))

	return {
		code: 0,
		data: {
			list
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
			lastContributionDate: user.last_contribution_date || 0,
			isAdmin: admin
		}
	}
}

exports.main = async (event) => {
	try {
		const action = event.action || 'login'
		if (action === 'login') return await login(event)
		if (action === 'updateProfile') return await updateProfile(event)
		if (action === 'check') return await check(event)
		if (action === 'contributors') return await getContributors()
		if (action === 'profile') return await getProfile(event)
		return {
			code: -1,
			message: '未知操作'
		}
	} catch (err) {
		return {
			code: -1,
			message: (err && err.message) || '操作失败'
		}
	}
}
