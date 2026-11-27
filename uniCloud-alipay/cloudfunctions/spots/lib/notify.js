'use strict'

// 待审核提醒：产生待审核数据时，用微信订阅消息通知所有超级管理员
const { WX_APPID, WX_SECRET, WX_REVIEW_TEMPLATE_ID } = require('app-config')
const { getSuperAdminOpenids } = require('cloud-auth')

// 订阅消息模板「待审核提醒」
const TEMPLATE_ID = WX_REVIEW_TEMPLATE_ID
// 点击消息跳转的页面（须为已注册的页面路径）
const REVIEW_PAGE = 'pages/admin/review'

const TYPE_TEXT = {
	new: '新增',
	update: '修改',
	image: '图片'
}

// access_token 模块级缓存，云函数实例内复用
let tokenCache = {
	value: '',
	expire: 0
}

async function getAccessToken() {
	if (tokenCache.value && Date.now() < tokenCache.expire) {
		return tokenCache.value
	}
	const url = 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=' +
		WX_APPID + '&secret=' + WX_SECRET
	const res = await uniCloud.httpclient.request(url, {
		dataType: 'json',
		timeout: 10000
	})
	const data = res.data || {}
	if (!data.access_token) {
		throw new Error(data.errmsg || '获取微信 access_token 失败')
	}
	tokenCache = {
		value: data.access_token,
		expire: Date.now() + (Number(data.expires_in) || 7200) * 1000 - 60000
	}
	return tokenCache.value
}

// 订阅消息字段有长度限制：需裁剪并去除换行
function clip(str, max) {
	const s = String(str || '').replace(/[\r\n]+/g, ' ').trim()
	return s.length > max ? s.slice(0, max) : s
}

function pad(n) {
	return n < 10 ? '0' + n : '' + n
}

function formatTime(ts) {
	const d = new Date(Number(ts) || Date.now())
	return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
		' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

// 通知所有超级管理员：有新的待审核数据
// 说明：微信一次性订阅消息，需管理员在小程序内授权过订阅才能送达；
// 未授权/额度用尽会返回错误，这里静默忽略，不影响主流程。
async function notifyPendingReview({
	applicantName,
	reportType,
	time
} = {}) {
	try {
		const openids = await getSuperAdminOpenids()
		if (!openids.length) return
		const accessToken = await getAccessToken()
		if (!accessToken) return
		const data = {
			thing2: {
				value: clip(applicantName || '某位用户', 20)
			},
			short_thing10: {
				value: clip(TYPE_TEXT[reportType] || '提交', 5)
			},
			time3: {
				value: formatTime(time)
			}
		}
		const url = 'https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=' + accessToken
		await Promise.all(openids.map((openid) => {
			return uniCloud.httpclient.request(url, {
				method: 'POST',
				contentType: 'json',
				dataType: 'json',
				timeout: 10000,
				data: {
					touser: openid,
					template_id: TEMPLATE_ID,
					page: REVIEW_PAGE,
					data
				}
			}).catch(() => {})
		}))
	} catch (e) {
		// 通知失败不影响提交
	}
}

module.exports = {
	notifyPendingReview
}
