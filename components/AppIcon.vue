<template>
	<image 
		:src="src"
		:mode="mode"
		:class="[
			'app-icon',
			`app-icon-${size}`,
			`app-icon-${color}`,
			{ 'app-icon-clickable': isClickable }
		]"
		:style="[
			{
				width: sizeValue,
				height: sizeValue,
				...styleObj
			},
			customStyle
		]"
		:alt="alt"
		@click="handleClick"
	/>
</template>

<script setup>
import { computed } from 'vue'
import { getIcon } from '@/utils/icons.js'

const props = defineProps({
	// 图标名称或路径
	icon: {
		type: String,
		default: ''
	},
	// 预设大小: xs | sm | md | lg | xl
	size: {
		type: String,
		default: 'md'
	},
	// 自定义宽度（优先级高于 size）
	width: {
		type: [String, Number],
		default: ''
	},
	// 自定义高度（优先级高于 size）
	height: {
		type: [String, Number],
		default: ''
	},
	// 图片模式
	mode: {
		type: String,
		default: 'aspectFit'
	},
	// 颜色变体: primary | secondary | success | warning | error | disabled | inherit
	color: {
		type: String,
		default: 'primary'
	},
	// 是否可点击
	clickable: {
		type: Boolean,
		default: false
	},
	// 自定义样式
	customStyle: {
		type: [String, Object],
		default: () => ({})
	},
	// 无障碍标签
	alt: {
		type: String,
		default: 'icon'
	}
})

const emit = defineEmits(['click'])

// 将图标名转换为路径，支持直接传入路径
const src = computed(() => {
	if (!props.icon) return ''
	// 如果以 / 开头或包含 . 则认为是路径，否则视为图标名
	if (props.icon.startsWith('/') || props.icon.includes('.')) {
		return props.icon
	}
	return getIcon(props.icon)
})

// 计算实际尺寸
const sizeMap = {
	xs: '16rpx',
	sm: '20rpx',
	md: '24rpx',
	lg: '32rpx',
	xl: '48rpx'
}

const sizeValue = computed(() => {
	if (props.width || props.height) {
		return `${props.width || props.height}`
	}
	return sizeMap[props.size] || sizeMap.md
})

// 样式对象
const styleObj = computed(() => {
	const obj = {}
	if (props.width) obj.width = formatSize(props.width)
	if (props.height) obj.height = formatSize(props.height)
	return obj
})

// 是否可点击
const isClickable = computed(() => props.clickable)

// 处理点击
const handleClick = (e) => {
	if (props.clickable) {
		emit('click', e)
	}
}

// 格式化尺寸值
function formatSize(val) {
	if (typeof val === 'number') return `${val}rpx`
	return val
}
</script>

<style scoped lang="scss">
/* Google 官方颜色系统 */
$google-blue: #1A73E8;        // Google Blue - 主色
$google-blue-dark: #1565C0;   // Deep Blue
$google-green: #0F9D58;       // Google Green
$google-yellow: #FBBC04;      // Google Yellow
$google-red: #E94335;         // Google Red
$google-gray: #80868B;        // Google Gray

.app-icon {
	display: inline-block;
	flex-shrink: 0;
	vertical-align: middle;
	/* 只过渡颜色/透明度/点击缩放，避免 width/height 变化产生"由大变小"的动画 */
	transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1),
		filter 0.2s cubic-bezier(0.4, 0, 0.2, 1),
		transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	
	/* 颜色变体系统 - 使用 Google 官方颜色 */
	
	/* 主色 - Google Blue */
	&.app-icon-primary {
		opacity: 0.87;
		filter: brightness(0.25) hue-rotate(210deg) saturate(1.3);
	}
	
	/* 次色 - 浅蓝色 */
	&.app-icon-secondary {
		opacity: 0.6;
		filter: brightness(0.25) hue-rotate(210deg) saturate(1.1);
	}
	
	/* 成功色 - Google Green */
	&.app-icon-success {
		opacity: 0.87;
		filter: brightness(0.24) hue-rotate(140deg) saturate(1.4);
	}
	
	/* 警告色 - Google Yellow */
	&.app-icon-warning {
		opacity: 0.9;
		filter: brightness(0.35) hue-rotate(45deg) saturate(1.5);
	}
	
	/* 错误色 - Google Red */
	&.app-icon-error {
		opacity: 0.87;
		filter: brightness(0.24) hue-rotate(0deg) saturate(1.4);
	}
	
	/* 禁用色 - 灰色 */
	&.app-icon-disabled {
		opacity: 0.38;
		filter: brightness(0.3) grayscale(100%);
	}
	
	/* 继承色 - 无处理 */
	&.app-icon-inherit {
		opacity: 1;
		filter: none;
	}
	
	/* 可点击状态 */
	&.app-icon-clickable {
		cursor: pointer;
		
		&:active {
			transform: scale(0.92);
			opacity: 0.7;
		}
		
		@media (hover: hover) {
			&:hover {
				opacity: 0.7;
			}
		}
	}
	
	/* 预设尺寸快捷类 */
	&.app-icon-xs {
		width: 16rpx;
		height: 16rpx;
	}
	
	&.app-icon-sm {
		width: 20rpx;
		height: 20rpx;
	}
	
	&.app-icon-md {
		width: 24rpx;
		height: 24rpx;
	}
	
	&.app-icon-lg {
		width: 32rpx;
		height: 32rpx;
	}
	
	&.app-icon-xl {
		width: 48rpx;
		height: 48rpx;
	}
}
</style>
