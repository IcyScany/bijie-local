// 球面距离（Haversine）与距离文案格式化

const EARTH_RADIUS = 6371000

function toRad(deg) {
	return (deg * Math.PI) / 180
}

// 两点球面距离（Haversine），单位米；任一坐标非法时返回 null
export function distanceMeters(lat1, lng1, lat2, lng2) {
	const la1 = Number(lat1)
	const lo1 = Number(lng1)
	const la2 = Number(lat2)
	const lo2 = Number(lng2)
	if (![la1, lo1, la2, lo2].every(Number.isFinite)) return null
	const dLat = toRad(la2 - la1)
	const dLng = toRad(lo2 - lo1)
	const a = Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(la1)) * Math.cos(toRad(la2)) * Math.sin(dLng / 2) ** 2
	return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(a))
}

// 距离文案：小于 1000 米按米取整，否则按公里保留一位小数
export function formatDistance(meters, options = {}) {
	if (meters == null || !Number.isFinite(meters)) return ''
	const { meterUnit = '米', kmUnit = '公里', unitSpace = '' } = options
	if (meters < 1000) return Math.round(meters) + unitSpace + meterUnit
	return (meters / 1000).toFixed(1) + unitSpace + kmUnit
}
