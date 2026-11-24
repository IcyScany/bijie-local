'use strict'

// 通用鉴权与用户辅助：Token 签发/校验、管理员判定、用户查询
const crypto = require('crypto')
const db = uniCloud.database()
const { TOKEN_SECRET } = require('app-config')

const TOKEN_TTL = 7 * 24 * 60 * 60 * 1000

// 签发登录 Token（openid + 过期时间，HMAC 签名）
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

// 解析并校验 Token，无效或过期返回 null
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

// 判断 openid 是否在管理员白名单中
async function isWhitelisted(openid) {
	const res = await db.collection('admin-whitelist').where({
		openid
	}).limit(1).get()
	return res.data.length > 0
}

// 校验管理员身份，通过则返回 openid；options.message 可统一自定义错误文案
async function requireAdmin(token, options = {}) {
	const payload = parseToken(token)
	const message = options.message
	if (!payload) {
		throw new Error(message || '登录状态失效，请重新登录')
	}
	if (!(await isWhitelisted(payload.openid))) {
		throw new Error(message || '无管理权限')
	}
	return payload.openid
}

// 超级管理员：优先取标记 is_super 的管理员，否则取最早加入的第一个管理员
async function getSuperAdmin() {
	const col = db.collection('admin-whitelist')
	const marked = await col.where({
		is_super: true
	}).limit(1).get()
	if (marked.data && marked.data.length) {
		return marked.data[0]
	}
	const first = await col.orderBy('create_date', 'asc').limit(1).get()
	return (first.data && first.data[0]) || null
}

// 超级管理员 openid（无管理员时返回空串）
async function getSuperAdminOpenid() {
	const superAdmin = await getSuperAdmin()
	return superAdmin ? superAdmin.openid : ''
}

// 判断某 openid 是否为超级管理员
async function isSuperAdmin(openid) {
	if (!openid) return false
	return (await getSuperAdminOpenid()) === openid
}

// 校验超级管理员身份，通过则返回 openid
async function requireSuperAdmin(token, options = {}) {
	const openid = await requireAdmin(token, options)
	if (!(await isSuperAdmin(openid))) {
		throw new Error(options.message || '仅超级管理员可操作')
	}
	return openid
}

// 按 openid 查询用户记录，不存在返回 null
async function getUserByOpenid(openid) {
	const res = await db.collection('users').where({
		openid
	}).limit(1).get()
	return res.data.length ? res.data[0] : null
}

// 获取贡献者展示名，无昵称时用 openid 后四位兜底
async function resolveContributorName(openid) {
	const user = await getUserByOpenid(openid)
	if (user && user.nickname) {
		return user.nickname
	}
	return '用户' + String(openid).slice(-4)
}

module.exports = {
	TOKEN_TTL,
	createToken,
	parseToken,
	isWhitelisted,
	requireAdmin,
	getSuperAdmin,
	getSuperAdminOpenid,
	isSuperAdmin,
	requireSuperAdmin,
	getUserByOpenid,
	resolveContributorName
}
