/**
 * 图标管理系统
 * 集中定义所有应用图标，便于维护和扩展
 */

// 图标映射表 - 添加新图标时只需在这里新增一行
export const ICONS = {
	// 通用操作
	search: '/static/icons/search.svg',
	call: '/static/icons/call.svg',
	directions: '/static/icons/directions.svg',
	nearMe: '/static/icons/near_me.svg',
	myLocation: '/static/icons/my_location.svg',
	photoCamera: '/static/icons/photo_camera.svg',
	locationOn: '/static/icons/location_on.svg',
	arrowInsert: '/static/icons/arrow_insert.svg',
	schedule: '/static/icons/schedule.svg',
	arrowBack: '/static/icons/arrow_back.svg',
	exploreNearby: '/static/icons/explore_nearby.svg',
	cancel: '/static/icons/cancel.svg',
	person: '/static/icons/person.svg',
	bookmarkStar: '/static/icons/bookmark_star.svg',
	rateReview: '/static/icons/rate_review.svg',
	delete: '/static/icons/delete.svg',
	
	// 分类图标
	restaurant: '/static/icons/restaurant.svg',
	storefront: '/static/icons/storefront.svg',
	forest: '/static/icons/forest.svg',
	wc: '/static/icons/wc.svg',
	hotel: '/static/icons/hotel.svg',
	gasStation: '/static/icons/gas-station.svg',
	
	// Tabbar 图标
	tabLocation: '/static/tabbar/location.svg',
	tabBookmark: '/static/tabbar/bookmark.svg',
	tabAdd: '/static/tabbar/add-fab.svg',
	tabUser: '/static/tabbar/user.svg',
	
	// 类型别名 - 便于按分类查询
	food: '/static/icons/restaurant.svg',
	shop: '/static/icons/storefront.svg',
	view: '/static/icons/forest.svg',
	toilet: '/static/icons/wc.svg',
	location: '/static/icons/near_me.svg'
}

/**
 * 获取图标路径
 * @param {string} iconName - 图标名称
 * @returns {string} 图标路径
 */
export function getIcon(iconName) {
	return ICONS[iconName] || ''
}

/**
 * 获取分类对应的图标
 * @param {string} type - 分类类型 (food, view, toilet, shop, other)
 * @returns {string} 图标路径
 */
export function getCategoryIcon(type) {
	const iconMap = {
		food: ICONS.restaurant,
		view: ICONS.forest,
		toilet: ICONS.wc,
		shop: ICONS.storefront,
		other: ICONS.location
	}
	return iconMap[type] || ICONS.location
}

/**
 * 获取操作按钮的图标
 * @param {string} action - 操作类型 (navigate, call, share, camera)
 * @returns {string} 图标路径
 */
export function getActionIcon(action) {
	const actionMap = {
		navigate: ICONS.directions,
		call: ICONS.call,
		share: ICONS.nearMe,
		camera: ICONS.photoCamera
	}
	return actionMap[action] || ''
}
