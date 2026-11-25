// 云对象教程: https://uniapp.dcloud.net.cn/uniCloud/cloud-obj
// jsdoc语法提示教程：https://ask.dcloud.net.cn/docs/#//ask.dcloud.net.cn/article/129
'use strict'

const query = require('./lib/query')
const mutation = require('./lib/mutation')

module.exports = {
	_before: function() { // 通用预处理器

	},

	// 分页查询地点列表
	async getList(params = {}) {
		return query.getList(params)
	},

	// 查询单个地点详情
	async getDetail(id) {
		return query.getDetail(id)
	},

	// 管理员为已通过审核的地点补充图片
	async addImages(id, images, token) {
		return mutation.addImages(id, images, token)
	},

	// 管理员新增地点（默认已通过）
	async add(data = {}, token) {
		return mutation.add(data, token)
	},

	// 管理员修改地点
	async update(id, data = {}, token) {
		return mutation.update(id, data, token)
	},

	// 删除地点，支持传入单个ID或ID数组
	async remove(id, token) {
		return mutation.remove(id, token)
	},

	// 管理员提交新地点或更新反馈，进入待审核
	async submit(data = {}, token) {
		return mutation.submit(data, token)
	},

	// 管理员审核：通过 / 驳回（可带原因）/ 撤回驳回
	async review(id, status, token, reason) {
		return mutation.review(id, status, token, reason)
	},

	// 审核通过并发布（可带编辑后的地点信息）
	async publish(id, data = {}, token) {
		return mutation.publish(id, data, token)
	},

	// 当前用户自己的贡献记录；options.type: all|new|update
	async listMyContributions(token, options = {}) {
		return query.listMyContributions(token, options)
	}
}
