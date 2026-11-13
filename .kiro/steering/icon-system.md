---
inclusion: manual
---

# 图标系统开发指南

## 系统架构

该项目实现了一套集中式的 SVG 图标管理系统。所有图标决策和使用都遵循以下模式：

### 核心组件

1. **图标映射表** (`utils/icons.js`)
   - 单一事实来源，所有图标都在这里定义
   - 支持别名机制，便于分类查询
   - 三个导出函数：`getIcon()`, `getCategoryIcon()`, `getActionIcon()`

2. **AppIcon 组件** (`components/AppIcon.vue`)
   - 全局注册的图标组件
   - 支持预设尺寸和自定义样式
   - 提供点击事件支持

3. **图标资源** (`static/icons/`)
   - 存储所有 SVG 图标文件
   - 现有图标：search, call, directions, nearMe, photoCamera, locationOn, restaurant, storefront, forest, wc

## 最小化维护成本的原则

### 添加新图标（3步流程）

```
1. 放置 SVG 文件到 static/icons/
   ↓
2. 在 utils/icons.js 中添加一行映射
   ↓
3. 在模板中使用 <app-icon icon="name" />
```

**无需修改任何其他文件** — 系统设计消除了重复。

### 修改现有图标

只需替换 `static/icons/` 中的 SVG 文件，引用自动生效。

### 重命名图标

在 `utils/icons.js` 中修改别名，所有使用该别名的地方自动更新。

## 使用约定

### 命名规范

- 图标名称采用驼峰命名：`photoCamera`, `locationOn`
- 文件名采用下划线：`photo_camera.svg`, `location_on.svg`
- 分类别名使用简短的英文：`food`, `view`, `toilet`

### 组件使用模式

```vue
<!-- ✅ 推荐：使用 AppIcon 组件 -->
<app-icon icon="search" size="md" />

<!-- ✅ 推荐：使用分类别名 -->
<app-icon :icon="getCategoryIcon('food')" size="lg" />

<!-- ❌ 避免：硬编码路径 -->
<image src="/static/icons/search.svg" />

<!-- ❌ 避免：混用 emoji -->
<text>🔍</text>
```

## 特殊情况处理

### 装饰性 emoji

对于纯装饰目的的 emoji（如空状态的 📭），保留 emoji 使用。这类 emoji 不属于功能性图标系统。

### 动态图标选择

使用 `getCategoryIcon()` 或 `getActionIcon()` 函数实现动态图标选择：

```javascript
// 按分类获取图标
const iconName = getCategoryIcon(spot.type) // type: 'food', 'view', 'toilet', 'shop'

// 按操作获取图标
const iconPath = getActionIcon('navigate') // action: 'navigate', 'call', 'share', 'camera'
```

## 添加新功能时的检查清单

- [ ] 使用 AppIcon 组件而非直接渲染图标
- [ ] 图标名称已在 `utils/icons.js` 中定义
- [ ] SVG 文件已放在 `static/icons/` 中
- [ ] 考虑是否需要添加别名以便跨页面复用
- [ ] 已测试不同尺寸下的显示效果

## 常见场景的解决方案

### 场景1：在新页面使用已有图标

```javascript
import { getIcon, getCategoryIcon } from '@/utils/icons.js'

// 直接在模板中使用
<app-icon :icon="getCategoryIcon('food')" />
```

### 场景2：实现图标主题切换

由于图标路径在 `ICONS` 中集中定义，切换主题只需：

```javascript
// 未来可以这样实现主题系统
export const ICONS_DARK = { /* 深色主题图标 */ }
export const ICONS_LIGHT = { /* 浅色主题图标 */ }
```

### 场景3：条件性显示图标

```vue
<app-icon
	v-if="item.icon"
	:icon="item.icon"
	:size="item.selected ? 'lg' : 'md'"
/>
```

## 设计决策说明

### 为什么使用 SVG 而不是 emoji？
- 更一致的跨平台渲染
- 更容易的样式控制和主题切换
- 更好的可访问性
- 更小的文件体积

### 为什么集中管理图标映射？
- 单一事实来源，减少错误
- 方便全局查找和修改
- 便于添加别名和扩展
- 易于实现图标 CDN 切换

### 为什么创建 AppIcon 组件？
- 统一的图标使用接口
- 便于未来的功能扩展（如加载状态、动画）
- 更好的类型检查（如果使用 TypeScript）
- 方便的尺寸预设系统

## 未来扩展建议

1. **动态主题支持**：实现亮色/暗色主题的图标颜色自动切换

2. **图标动画库**：为 AppIcon 组件添加内置动画支持

3. **图标预加载**：在应用启动时预加载常用图标

4. **图标字体降级**：添加备选字体图标方案，以防 SVG 加载失败

5. **性能优化**：考虑使用雪碧图或 base64 内联 SVG
