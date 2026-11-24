'use strict'

const db = uniCloud.database()

// 共创者排行：按已通过审核的共创明细聚合积分（新增 5 / 更新、补充图片 2）
async function getContributors() {
	const $ = db.command.aggregate
	const res = await db.collection('contributions').aggregate()
		.match({
			status: 'approved'
		})
		.group({
			_id: '$openid',
			name: $.first('$name'),
			points: $.sum('$points'),
			count: $.sum(1),
			lastDate: $.max('$create_date')
		})
		.sort({
			points: -1
		})
		.limit(50)
		.end()

	const list = (res.data || []).map(item => ({
		openid: item._id,
		name: item.name || ('用户' + String(item._id).slice(-4)),
		points: item.points || 0,
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
