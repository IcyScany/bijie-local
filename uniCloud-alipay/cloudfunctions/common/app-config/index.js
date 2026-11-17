'use strict'

// 统一配置：优先读取环境变量，缺省时回退到内置默认值
// 各云函数/云对象通过 require('app-config') 引用，避免配置分散
module.exports = {
	WX_APPID: process.env.WX_APPID || 'wxbcdf8a5b47b37852',
	WX_SECRET: process.env.WX_SECRET || '8ec410bc985359e8da8e45051bd4e8b2',
	TOKEN_SECRET: process.env.TOKEN_SECRET || '45be635c5c2aab238f2e67e4406657b5f3b599d7910981abdc6795ec1dd20633',
	TENCENT_MAP_KEY: process.env.TENCENT_MAP_KEY || 'P5RBZ-REHL7-37BXR-PYFUL-VNK4T-ODB75',
	TENCENT_MAP_SK: process.env.TENCENT_MAP_SK || 'bwOY5bi38Go6J1IaOAn7nJBp5gFooeEO'
}
