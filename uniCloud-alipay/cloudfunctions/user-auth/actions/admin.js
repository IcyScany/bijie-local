'use strict'

const db = uniCloud.database()
const { requireSuperAdmin, getSuperAdminOpenid, getUserByOpenid } = require('cloud-auth')

// 管理员列表（仅超级管理员）
async function listAdmins(event) {
	await requireSuperAdmin(event.token, { message: '仅超级管理员可查看' })
	const superOpenid = await getSuperAdminOpenid()
	const res = await db.collection('admin-whitelist').orderBy('create_date', 'asc').get()
	const rows = res.data || []
	const openids = rows.map(item => item.openid)
	const nameMap = {}
	if (openids.length) {
		const usersRes = await db.collection('users').where({
			openid: db.command.in(openids)
		}).get()
		;(usersRes.data || []).forEach(u => {
			nameMap[u.openid] = u
		})
	}
	const list = rows.map(item => {
		const u = nameMap[item.openid]
		const isSuper = !!superOpenid && item.openid === superOpenid
		return {
			openid: item.openid,
			name: isSuper ? '超级管理员' : ((u && u.nickname) || item.name || ('用户' + String(item.openid).slice(-4))),
			remark: item.name || '',
			avatar: (u && u.avatar) || '',
			is_super: isSuper,
			create_date: item.create_date || 0
		}
	})
	return {
		code: 0,
		data: {
			list
		}
	}
}

// 添加管理员（仅超级管理员）：按 openid 加入白名单
async function addAdmin(event) {
	await requireSuperAdmin(event.token, { message: '仅超级管理员可操作' })
	const openid = String(event.openid || '').trim()
	if (!openid) {
		throw new Error('请输入用户 openid')
	}
	const exist = await db.collection('admin-whitelist').where({
		openid
	}).limit(1).get()
	if (exist.data && exist.data.length) {
		throw new Error('该用户已是管理员')
	}
	const user = await getUserByOpenid(openid)
	const name = (user && user.nickname) || String(event.name || '').trim() || ('用户' + openid.slice(-4))
	await db.collection('admin-whitelist').add({
		openid,
		name,
		create_date: Date.now()
	})
	if (user) {
		await db.collection('users').doc(user._id).update({
			is_admin: true,
			update_date: Date.now()
		})
	}
	return {
		code: 0,
		data: {
			openid,
			name
		}
	}
}

// 移除管理员（仅超级管理员，且不能移除自己或超级管理员）
async function removeAdmin(event) {
	const currentOpenid = await requireSuperAdmin(event.token, { message: '仅超级管理员可操作' })
	const openid = String(event.openid || '').trim()
	if (!openid) {
		throw new Error('缺少 openid')
	}
	if (openid === currentOpenid) {
		throw new Error('不能移除自己')
	}
	if (openid === (await getSuperAdminOpenid())) {
		throw new Error('超级管理员不可移除')
	}
	await db.collection('admin-whitelist').where({
		openid
	}).remove()
	const user = await getUserByOpenid(openid)
	if (user) {
		await db.collection('users').doc(user._id).update({
			is_admin: false,
			update_date: Date.now()
		})
	}
	return {
		code: 0,
		data: {
			openid
		}
	}
}

module.exports = {
	listAdmins,
	addAdmin,
	removeAdmin
}
