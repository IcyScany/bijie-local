const TOKEN_KEY = 'uni_token'
const OPENID_KEY = 'uni_openid'
const ADMIN_KEY = 'is_admin'
const SUPER_KEY = 'is_super_admin'
const USER_KEY = 'user_info'

// token 校验间隔：距上次校验超过该时间则重新向服务端确认有效性
const TOKEN_CHECK_INTERVAL = 10 * 60 * 1000

let loginPromise = null
let verifyPromise = null
let lastCheckAt = 0

// 获取当前运行平台标识（微信小程序为 'mp-weixin'）
function getPlatform() {
	try {
		const sysInfo = uni.getSystemInfoSync()
		return sysInfo.uniPlatform || ''
	} catch (e) {
		return ''
	}
}

// 读取本地缓存的登录态
function readCache() {
	return {
		token: uni.getStorageSync(TOKEN_KEY) || '',
		openid: uni.getStorageSync(OPENID_KEY) || '',
		isAdmin: !!uni.getStorageSync(ADMIN_KEY),
		isSuperAdmin: !!uni.getStorageSync(SUPER_KEY),
		userInfo: uni.getStorageSync(USER_KEY) || {}
	}
}

// 清空本地登录态
function clearAuth() {
	uni.removeStorageSync(TOKEN_KEY)
	uni.removeStorageSync(OPENID_KEY)
	uni.removeStorageSync(ADMIN_KEY)
	uni.removeStorageSync(SUPER_KEY)
	uni.removeStorageSync(USER_KEY)
	lastCheckAt = 0
}

// 发起登录并保存 token、openid、管理员标记到本地
function requestLogin() {
	const payload = {
		action: 'login'
	}

	const platform = getPlatform()
	const loginTask = platform === 'mp-weixin' ?
		new Promise((resolve, reject) => {
			uni.login({
				provider: 'weixin',
				success: resolve,
				fail: reject
			})
		}).then((loginRes) => {
			payload.code = loginRes.code
		}) :
		Promise.resolve().then(() => {
			let openid = uni.getStorageSync(OPENID_KEY)
			if (!openid) {
				openid = 'dev-' + Math.random().toString(36).slice(2, 10)
			}
			payload.openid = openid
		})

	return loginTask.then(() => {
		return uniCloud.callFunction({
			name: 'user-auth',
			data: payload
		})
	}).then((res) => {
		const result = res.result || {}
		if (result.code !== 0) {
			throw new Error(result.message || '登录失败')
		}
		const data = result.data || {}
		uni.setStorageSync(TOKEN_KEY, data.token || '')
		uni.setStorageSync(OPENID_KEY, data.openid || '')
		uni.setStorageSync(ADMIN_KEY, !!data.isAdmin)
		uni.setStorageSync(SUPER_KEY, !!data.isSuperAdmin)
		uni.setStorageSync(USER_KEY, data.userInfo || {})
		// 刚登录成功，短期内无需再次校验
		lastCheckAt = Date.now()
		return data
	})
}

// 发起登录（并发去重）
function startLogin() {
	if (loginPromise) {
		return loginPromise
	}
	loginPromise = requestLogin()
	loginPromise.then(() => {
		loginPromise = null
	}, () => {
		loginPromise = null
	})
	return loginPromise
}

// 向服务端校验 token 是否仍然有效，有效则同步 openid / 管理员标记
function verifyToken(token) {
	return uniCloud.callFunction({
		name: 'user-auth',
		data: {
			action: 'check',
			token
		}
	}).then((res) => {
		const result = res.result || {}
		const data = result.data || {}
		if (!data.openid) {
			return false
		}
		uni.setStorageSync(OPENID_KEY, data.openid)
		uni.setStorageSync(ADMIN_KEY, !!data.isAdmin)
		uni.setStorageSync(SUPER_KEY, !!data.isSuperAdmin)
		return true
	})
}

// 确保已登录：无 token 直接登录；有 token 则定期校验，失效自动重新登录
export function ensureLogin() {
	const cache = readCache()

	if (!cache.token) {
		return startLogin()
	}

	const now = Date.now()
	if (now - lastCheckAt < TOKEN_CHECK_INTERVAL) {
		return Promise.resolve(cache)
	}

	// 距上次校验超过间隔：校验 token，失效则清除缓存并重新登录
	if (!verifyPromise) {
		lastCheckAt = now
		verifyPromise = verifyToken(cache.token).then((valid) => {
			verifyPromise = null
			if (!valid) {
				clearAuth()
				return startLogin()
			}
			return readCache()
		}).catch(() => {
			// 网络异常时不清除登录态，返回本地缓存
			verifyPromise = null
			return cache
		})
	}
	return verifyPromise
}

// 读取本地保存的登录 token
export function getToken() {
	return uni.getStorageSync(TOKEN_KEY) || ''
}

// 读取本地保存的 openid（当前登录用户）
export function getOpenid() {
	return uni.getStorageSync(OPENID_KEY) || ''
}

// 判断当前用户是否为管理员
export function isAdmin() {
	return !!uni.getStorageSync(ADMIN_KEY)
}

// 判断当前用户是否为超级管理员
export function isSuperAdmin() {
	return !!uni.getStorageSync(SUPER_KEY)
}

// 读取本地缓存的用户信息
export function getUserInfo() {
	return uni.getStorageSync(USER_KEY) || {}
}

// 强制清除登录态，用于服务端返回登录失效时手动触发重新登录
export function resetAuth() {
	clearAuth()
}

// 判断错误是否为登录态失效
export function isAuthError(err) {
	const msg = (err && (err.errMsg || err.message)) || ''
	return msg.indexOf('登录状态失效') > -1 || msg.indexOf('请重新登录') > -1 || msg.indexOf('请重新进入') > -1
}

// 清除登录态并重新登录
export function relogin() {
	clearAuth()
	return startLogin()
}
