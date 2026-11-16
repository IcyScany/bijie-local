/**
 * 地点类型统一配置
 * 类型清单维护在 ./place-types.json，新增/修改类型只改该 JSON 即可
 */
import PLACE_TYPES from './place-types.json'

export { PLACE_TYPES }

// 未匹配到类型时的兜底（与 JSON 中 other 保持一致）
const FALLBACK = {
	label: '其他',
	icon: 'location',
	color: '#5F6368',
	bg: '#F1F3F4'
}

// 按 value 查找类型定义
export function findPlaceType(value) {
	return PLACE_TYPES.find(item => item.value === value) || null
}

// 类型显示名
export function getTypeLabel(type) {
	const item = findPlaceType(type)
	return item ? item.label : FALLBACK.label
}

// 类型图标名（供 app-icon 使用）
export function getTypeIcon(type) {
	const item = findPlaceType(type)
	return item ? item.icon : FALLBACK.icon
}

// 类型强调色
export function getTypeColor(type) {
	const item = findPlaceType(type)
	return item ? item.color : FALLBACK.color
}

// 类型浅底色
export function getTypeBg(type) {
	const item = findPlaceType(type)
	return item ? item.bg : FALLBACK.bg
}

// 地图顶部展示的分类 [{ value, label, icon }]，由 JSON 的 map 字段控制显隐
export function getMapCategories() {
	return PLACE_TYPES
		.filter(item => item.map !== false)
		.map(item => ({
			value: item.value,
			label: item.label,
			icon: item.icon
		}))
}
