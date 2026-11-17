// 本文件中的内容将在云对象【运行】时解析为运行参数
// 配置教程参考：https://uniapp.dcloud.net.cn/uniCloud/rundebug.html#run-obj-param

const clientInfo = {
	uniPlatform: 'web',
	source: 'client',
	clientIP: '127.0.0.1'
}

getList({ status: 'approved', page: 1, pageSize: 20 })
