'use strict'

const db = uniCloud.database()

// 贡献者排行：按贡献明细聚合统计
async function getContributors() {
	const $ = db.command.aggregate
	const res = await db.collection('contributions').aggregate()
		.group({
			_id: '$openid',
			name: $.first('$name'),
			count: $.sum(1),
			lastDate: $.max('$create_date')
		})
		.sort({
			count: -1
		})
		.limit(50)
		.end()

	const list = (res.data || []).map(item => ({
		openid: item._id,
		name: item.name || ('用户' + String(item._id).slice(-4)),
		count: item.count || 0,
		lastDate: item.lastDate || 0
	}))

	return {
		code: 0,
		data: {
			list
		}
	}
}

module.exports = {
	getContributors
}
