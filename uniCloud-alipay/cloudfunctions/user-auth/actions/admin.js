'use strict'

const db = uniCloud.database()
const { requireSuperAdmin, isSuperAdmin, getUserByOpenid } = require('cloud-auth')

// 管理员列表（仅超级管理员）
async function listAdmins(event) {
	await requireSuperAdmin(event.token, { message: '仅超级管理员可查看' })
	const res = await db.collection('admin-whitelist').orderBy('create_date', 'asc').get()
	const rows = res.data || []
	// 超级管理员集合：有 is_super 标记的（可多个）；若无标记（旧数据），最早加入的视为超管
	const superSet = {}
	rows.forEach(r => {
		if (r.is_super) superSet[r.openid] = true
	})
	if (!Object.keys(superSet).length && rows.length) {
		superSet[rows[0].openid] = true
	}
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
		return {
			openid: item.openid,
			name: (u && u.nickname) || item.name || ('用户' + String(item.openid).slice(-4)),
			remark: item.name || '',
			avatar: (u && u.avatar) || '',
			is_super: !!superSet[item.openid],
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
	if (await isSuperAdmin(openid)) {
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

// 搜索用户（仅超级管理员）：按昵称或 openid 模糊匹配，便于直接选中添加管理员
async function searchUsers(event) {
	await requireSuperAdmin(event.token, { message: '仅超级管理员可操作' })
	const keyword = String(event.keyword || '').trim()
	if (!keyword) {
		return {
			code: 0,
			data: {
				list: []
			}
		}
	}
	const reg = db.RegExp({
		regexp: keyword,
		options: 'i'
	})
	const res = await db.collection('users').where(db.command.or({
		nickname: reg
	}, {
		openid: reg
	})).orderBy('last_login_date', 'desc').limit(20).get()
	const list = (res.data || []).map(u => ({
		openid: u.openid,
		nickname: u.nickname || ('用户' + String(u.openid).slice(-4)),
		avatar: u.avatar || ''
	}))
	return {
		code: 0,
		data: {
			list
		}
	}
}

// 设置 / 取消超级管理员（仅超级管理员；不能取消自己的超管身份）
async function setAdminSuper(event) {
	const currentOpenid = await requireSuperAdmin(event.token, { message: '仅超级管理员可操作' })
	const openid = String(event.openid || '').trim()
	if (!openid) {
		throw new Error('缺少 openid')
	}
	const isSuper = !!event.is_super
	if (openid === currentOpenid && !isSuper) {
		throw new Error('不能取消自己的超级管理员')
	}
	const exist = await db.collection('admin-whitelist').where({
		openid
	}).limit(1).get()
	if (!exist.data || !exist.data.length) {
		throw new Error('该用户不是管理员')
	}
	await db.collection('admin-whitelist').where({
		openid
	}).update({
		is_super: isSuper
	})
	return {
		code: 0,
		data: {
			openid,
			is_super: isSuper
		}
	}
}

module.exports = {
	listAdmins,
	addAdmin,
	removeAdmin,
	setAdminSuper,
	searchUsers
}
