'use strict'

// 配置示例（模板文件，不会被云函数入口使用）
// 使用方法：
//   1. 复制本文件为 index.js（覆盖），并把下面的占位值替换成你自己的配置；
//   2. 或（推荐）在云函数/云对象的环境变量里配置同名变量，index.js 会优先读取环境变量。
// 注意：index.js 中含真实密钥，请勿把真实密钥提交到公开仓库。
module.exports = {
	WX_APPID: process.env.WX_APPID || '请填写你的微信小程序 AppID',
	WX_SECRET: process.env.WX_SECRET || '请填写你的微信小程序 AppSecret',
	TOKEN_SECRET: process.env.TOKEN_SECRET || '请填写一个足够随机的 Token 签名密钥',
	TENCENT_MAP_KEY: process.env.TENCENT_MAP_KEY || '请填写腾讯地图 Key',
	TENCENT_MAP_SK: process.env.TENCENT_MAP_SK || '请填写腾讯地图 SK'
}
