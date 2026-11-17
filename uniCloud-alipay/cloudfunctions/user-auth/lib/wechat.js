'use strict'

const { WX_APPID, WX_SECRET } = require('app-config')

// 昵称缺省时用 openid 后四位兜底
function buildNickname(openid, nickname) {
	if (nickname) return nickname
	return '用户' + String(openid).slice(-4)
}

// code 换 openid；未提供 code 时按 openid 直传处理（本地调试用）
async function resolveOpenid(event) {
	if (event.code) {
		if (!WX_SECRET) {
			throw new Error('未配置微信 WX_SECRET')
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

module.exports = {
	buildNickname,
	resolveOpenid
}
