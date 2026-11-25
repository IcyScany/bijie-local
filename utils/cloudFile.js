// uniCloud 云存储文件工具
// 说明：支付宝云 / 腾讯云的 fileID（cloud://...）不能直接在 <image> 中显示，
// 需先调用 uniCloud.getTempFileURL 换取临时链接（仅阿里云支持 fileID 直显）。
// 这里做批量转换 + 内存缓存，避免重复请求。

const urlCache = {}
const CACHE_TTL = 50 * 60 * 1000
// 解析失败的负缓存：短时间内不再重复请求同一 fileID（如域名未配置、文件不存在）
const failCache = {}
const FAIL_TTL = 5 * 60 * 1000

// 批量将 fileID 转换为可访问的临时链接，返回 { [fileID]: url }
export async function resolveCloudFiles(fileIDs) {
	const list = (fileIDs || []).filter(id => typeof id === 'string' && id)
	const result = {}
	const pending = []
	const now = Date.now()

	list.forEach(id => {
		if (id.indexOf('cloud://') !== 0) {
			// 已经是普通链接或本地路径
			result[id] = id
			return
		}
		const cached = urlCache[id]
		if (cached && cached.expire > now) {
			result[id] = cached.url
			return
		}
		const failedAt = failCache[id]
		if (failedAt && failedAt > now) {
			// 近期解析失败过，跳过本次请求
			return
		}
		pending.push(id)
	})

	if (pending.length) {
		try {
			const res = await uniCloud.getTempFileURL({ fileList: pending })
			const fileList = (res && res.fileList) || []
			fileList.forEach(item => {
				if (item && item.tempFileURL) {
					result[item.fileID] = item.tempFileURL
					urlCache[item.fileID] = {
						url: item.tempFileURL,
						expire: now + CACHE_TTL
					}
				} else {
					if (item && item.fileID) {
						failCache[item.fileID] = now + FAIL_TTL
					}
					console.warn('[cloudFile] getTempFileURL 未返回临时链接', item)
				}
			})
		} catch (e) {
			// 转换失败时忽略，调用方可回退到占位；失败的 fileID 短时内不再重试
			console.error('[cloudFile] getTempFileURL 失败', e, pending)
			const expire = Date.now() + FAIL_TTL
			pending.forEach(id => {
				failCache[id] = expire
			})
		}
	}

	return result
}

// 单个 fileID 转换
export async function resolveCloudFile(fileID) {
	if (!fileID) return ''
	const map = await resolveCloudFiles([fileID])
	return map[fileID] || ''
}
