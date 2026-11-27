// 待审核提醒：微信小程序订阅消息
// 模板「待审核提醒」ID
export const REVIEW_TEMPLATE_ID = 'jm5GWcsLgwpUsmFHwm0klUh6QpXLoFwbyuYltCB4eLM'

// 请求订阅待审核提醒（必须在用户点击事件里调用）
// done：可选回调，订阅流程结束后执行（用于点击后跳转等）
export function requestReviewSubscribe(done) {
	const finish = () => {
		if (typeof done === 'function') done()
	}
	if (typeof uni.requestSubscribeMessage !== 'function') {
		finish()
		return
	}
	uni.requestSubscribeMessage({
		tmplIds: [REVIEW_TEMPLATE_ID],
		success: () => {},
		fail: () => {},
		complete: finish
	})
}
