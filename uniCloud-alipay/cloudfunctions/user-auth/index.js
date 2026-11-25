'use strict'

const auth = require('./actions/auth')
const admin = require('./actions/admin')
const contributors = require('./actions/contributors')

const ACTIONS = Object.assign(Object.create(null), {
	login: auth.login,
	updateProfile: auth.updateProfile,
	check: auth.check,
	contributors: contributors.getContributors,
	profile: auth.getProfile,
	listAdmins: admin.listAdmins,
	addAdmin: admin.addAdmin,
	removeAdmin: admin.removeAdmin,
	searchUsers: admin.searchUsers
})

// 云函数入口：按 action 分发到对应业务处理器
exports.main = async (event) => {
	try {
		const action = event.action || 'login'
		const handler = ACTIONS[action]
		if (!handler) {
			return {
				code: -1,
				message: '未知操作'
			}
		}
		return await handler(event)
	} catch (err) {
		return {
			code: -1,
			message: (err && err.message) || '操作失败'
		}
	}
}
