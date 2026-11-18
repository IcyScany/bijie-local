'use strict'

const TYPE_LIST = ['food', 'view', 'toilet', 'shop', 'other']
// 类型中文名称（与前端 utils/place-types.json 保持一致，用于关键词匹配类别）
const TYPE_LABELS = {
	food: '美食',
	view: '景点',
	toilet: '便民厕所',
	shop: '便民商店',
	other: '其他'
}
const STATUS_LIST = ['approved', 'pending', 'rejected']
const SOURCE_LIST = ['admin', 'user']
const REPORT_TYPE_LIST = ['new', 'update']

module.exports = {
	TYPE_LIST,
	TYPE_LABELS,
	STATUS_LIST,
	SOURCE_LIST,
	REPORT_TYPE_LIST
}
