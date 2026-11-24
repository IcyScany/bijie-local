'use strict'

const db = uniCloud.database()
const { isWhitelisted } = require('cloud-auth')

// 白名单为空时，首个登录用户自动成为管理员
async function ensureAdmin(openid) {
	const whitelist = db.collection('admin-whitelist')
	if (await isWhitelisted(openid)) {
		return true
	}
	const countRes = await whitelist.count()
	if (countRes.total === 0) {
		await whitelist.add({
			openid,
			name: '超级管理员',
			is_super: true,
			create_date: Date.now()
		})
		return true
	}
	return false
}

module.exports = {
	ensureAdmin
}
