// 图片工具：压缩 + 大小校验

// 单张图片大小上限：6MB
export const MAX_IMAGE_SIZE = 6 * 1024 * 1024

// 图片压缩：优先使用 uni.compressImage（微信小程序支持），不可用或失败时回退原图
export function compressImage(src, quality = 80) {
	return new Promise((resolve) => {
		if (!src || typeof uni.compressImage !== 'function') {
			resolve(src)
			return
		}
		uni.compressImage({
			src,
			quality,
			success: (res) => {
				resolve((res && res.tempFilePath) || src)
			},
			fail: () => resolve(src)
		})
	})
}

// 获取文件大小（字节）
export function getFileSize(filePath) {
	return new Promise((resolve) => {
		try {
			const fs = uni.getFileSystemManager ? uni.getFileSystemManager() : null
			if (fs && fs.getFileInfo) {
				fs.getFileInfo({
					filePath,
					success: (res) => resolve(Number(res.size) || 0),
					fail: () => resolve(0)
				})
				return
			}
		} catch (e) {}
		try {
			uni.getFileInfo({
				filePath,
				success: (res) => resolve(Number(res.size) || 0),
				fail: () => resolve(0)
			})
		} catch (e) {
			resolve(0)
		}
	})
}

// 过滤超限图片：返回 { ok: 可上传的, oversize: 超限数量 }
export async function filterOversizeImages(filePaths, maxSize = MAX_IMAGE_SIZE) {
	const ok = []
	let oversize = 0
	for (const p of (filePaths || [])) {
		const size = await getFileSize(p)
		if (size && size > maxSize) {
			oversize++
		} else {
			ok.push(p)
		}
	}
	return {
		ok,
		oversize
	}
}
