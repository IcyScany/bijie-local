# Google Maps 设计系统使用指南

这是一套完全按照 Google Maps 风格设计的 CSS 工具类库。所有页面都可以直接使用这些类名，无需重复编写样式。

## 快速开始

```vue
<template>
  <!-- 使用 gm- 前缀的类名 -->
  <view class="gm-page">
    <view class="gm-card">
      <view class="gm-list-item">
        <view class="gm-list-item-icon">🏪</view>
        <view class="gm-list-item-content">
          <text class="gm-list-item-title">地点名称</text>
          <text class="gm-list-item-subtitle">地点描述</text>
        </view>
        <text class="gm-list-item-arrow">›</text>
      </view>
    </view>
  </view>
</template>
```

## 组件类名

### 1. 按钮 Button

Material Design 3 强调级别（从高到低）：

#### 强调级别 1 - 填充按钮（主要操作）
```vue
<button class="gm-btn gm-btn-filled">确认</button>
<button class="gm-btn gm-btn-filled-danger">删除</button>
```

#### 强调级别 2 - 淡色按钮（次要操作）
```vue
<button class="gm-btn gm-btn-tonal">取消</button>
```

#### 强调级别 3 - 外框按钮（支持操作）
```vue
<button class="gm-btn gm-btn-outlined">选择</button>
```

#### 强调级别 4 - 文字按钮（轻操作）
```vue
<button class="gm-btn gm-btn-text">了解更多</button>
```

#### 按钮尺寸
```vue
<button class="gm-btn gm-btn-filled gm-btn-sm">小按钮</button>
<button class="gm-btn gm-btn-filled">标准按钮</button>
<button class="gm-btn gm-btn-filled gm-btn-lg">大按钮</button>
<button class="gm-btn gm-btn-filled gm-btn-block">全宽按钮</button>
```

### 2. 卡片 Card

```vue
<!-- 标准卡片 -->
<view class="gm-card">
  <view class="gm-p-md">卡片内容</view>
</view>

<!-- 扁平卡片（带边框，无阴影）-->
<view class="gm-card-flat">
  <view class="gm-p-md">卡片内容</view>
</view>

<!-- 可点击卡片 -->
<view class="gm-card gm-card-hover" @click="handleClick">
  <view class="gm-p-md">点击我</view>
</view>
```

### 3. 列表项 List Item

```vue
<view class="gm-card">
  <!-- 基础列表项 -->
  <view class="gm-list-item" @click="handleClick">
    <view class="gm-list-item-icon">🍜</view>
    <view class="gm-list-item-content">
      <text class="gm-list-item-title">标题</text>
      <text class="gm-list-item-subtitle">副标题或描述</text>
    </view>
    <text class="gm-list-item-arrow">›</text>
  </view>
  
  <!-- 多个列表项会自动添加分割线 -->
  <view class="gm-list-item">
    <view class="gm-list-item-icon">🌳</view>
    <view class="gm-list-item-content">
      <text class="gm-list-item-title">另一个项目</text>
      <text class="gm-list-item-subtitle">说明文字</text>
    </view>
  </view>
</view>
```

### 4. Chip 筛选标签

```vue
<view class="gm-flex">
  <view class="gm-chip" @click="selectChip('all')">
    全部
  </view>
  <view class="gm-chip gm-chip-selected">
    <text class="gm-chip-icon">🍜</text>
    美食
  </view>
  <view class="gm-chip">
    <text class="gm-chip-icon">🌳</text>
    景点
  </view>
</view>
```

### 5. 输入框 Input

```vue
<!-- 标准输入框 -->
<input class="gm-input" placeholder="请输入内容" />

<!-- 文本域 -->
<textarea class="gm-textarea" placeholder="请输入描述..." />

<!-- 搜索框 -->
<view class="gm-search">
  <view class="gm-search-icon">🔍</view>
  <input class="gm-search-input" placeholder="搜索地点" />
</view>
```

### 6. 头像 Avatar

```vue
<!-- 图片头像 -->
<image class="gm-avatar" src="/path/to/avatar.jpg" mode="aspectFill" />

<!-- 文字头像 -->
<view class="gm-avatar gm-avatar-text">李</view>

<!-- 不同尺寸 -->
<view class="gm-avatar gm-avatar-sm gm-avatar-text">小</view>
<view class="gm-avatar gm-avatar-text">中</view>
<view class="gm-avatar gm-avatar-lg gm-avatar-text">大</view>
```

### 7. 评分 Stars

```vue
<view class="gm-stars">
  <text class="gm-star gm-star-filled">★</text>
  <text class="gm-star gm-star-filled">★</text>
  <text class="gm-star gm-star-filled">★</text>
  <text class="gm-star gm-star-filled">★</text>
  <text class="gm-star">★</text>
</view>

<!-- 小号星星 -->
<view class="gm-stars gm-stars-sm">
  <text class="gm-star gm-star-filled">★</text>
  <text class="gm-star gm-star-filled">★</text>
  <text class="gm-star">★</text>
  <text class="gm-star">★</text>
  <text class="gm-star">★</text>
</view>
```

### 8. 标签 Tag

```vue
<view class="gm-tag gm-tag-primary">美食</view>
<view class="gm-tag gm-tag-success">已通过</view>
<view class="gm-tag gm-tag-warning">待审核</view>
<view class="gm-tag gm-tag-danger">已驳回</view>
<view class="gm-tag gm-tag-teal">其他</view>
```

### 9. 底部面板 Bottom Sheet

```vue
<view class="gm-bottom-sheet">
  <view class="gm-bottom-sheet-handle">
    <view class="gm-bottom-sheet-bar"></view>
  </view>
  <view class="gm-p-md">
    <!-- 面板内容 -->
  </view>
</view>
```

### 10. FAB 浮动按钮

```vue
<view class="gm-fab" style="right: 32rpx; bottom: 120rpx;" @click="handleAdd">
  <text class="gm-fab-icon">+</text>
</view>
```

### 11. 空状态 Empty

```vue
<view class="gm-empty">
  <text class="gm-empty-icon">📭</text>
  <text class="gm-empty-title">暂无数据</text>
  <text class="gm-empty-subtitle">快来添加第一条记录吧</text>
</view>
```

### 12. 加载状态 Loading

```vue
<view class="gm-loading">
  <view class="gm-loading-spinner"></view>
  <text class="gm-loading-text">加载中...</text>
</view>
```

### 13. 遮罩层 Overlay

```vue
<!-- 底部弹出遮罩 -->
<view class="gm-overlay" @click="closeModal">
  <view class="gm-bottom-sheet" @click.stop>
    <!-- 内容 -->
  </view>
</view>

<!-- 居中遮罩 -->
<view class="gm-overlay gm-overlay-center" @click="closeDialog">
  <view class="gm-dialog" @click.stop>
    <text class="gm-dialog-title">标题</text>
    <text class="gm-dialog-content">内容描述</text>
    <view class="gm-dialog-actions">
      <button class="gm-btn gm-btn-text" @click="closeDialog">取消</button>
      <button class="gm-btn gm-btn-filled" @click="confirm">确认</button>
    </view>
  </view>
</view>
```

## 工具类

### 布局

```vue
<!-- Flex 布局 -->
<view class="gm-flex">左右排列</view>
<view class="gm-flex gm-flex-column">上下排列</view>
<view class="gm-flex gm-flex-center">居中</view>
<view class="gm-flex gm-flex-between">两端对齐</view>
<view class="gm-flex-1">占满剩余空间</view>
```

### 文本

```vue
<!-- 文本颜色 -->
<text class="gm-text-primary">主要文本</text>
<text class="gm-text-secondary">次要文本</text>
<text class="gm-text-tertiary">辅助文本</text>
<text class="gm-text-brand">品牌色文本</text>
<text class="gm-text-danger">危险色文本</text>

<!-- 文本对齐 -->
<text class="gm-text-center">居中</text>

<!-- 文本溢出 -->
<text class="gm-text-ellipsis">超长文本会被省略号...</text>

<!-- 字体大小 -->
<text class="gm-font-sm">小号字体</text>
<text class="gm-font-md">标准字体</text>
<text class="gm-font-lg">大号字体</text>

<!-- 字重 -->
<text class="gm-font-bold">加粗文本</text>
```

### 间距

```vue
<!-- Margin -->
<view class="gm-mt-xs">上边距 8rpx</view>
<view class="gm-mt-sm">上边距 16rpx</view>
<view class="gm-mt-md">上边距 24rpx</view>
<view class="gm-mt-lg">上边距 32rpx</view>

<view class="gm-mb-md">下边距 24rpx</view>
<view class="gm-ml-md">左边距 24rpx</view>
<view class="gm-mr-md">右边距 24rpx</view>

<!-- Padding -->
<view class="gm-p-xs">内边距 8rpx</view>
<view class="gm-p-sm">内边距 16rpx</view>
<view class="gm-p-md">内边距 24rpx</view>
<view class="gm-p-lg">内边距 32rpx</view>

<view class="gm-px-md">左右内边距 24rpx</view>
<view class="gm-py-md">上下内边距 24rpx</view>
```

## 完整页面示例

```vue
<template>
  <view class="gm-page">
    <!-- 搜索栏 -->
    <view class="gm-p-md">
      <view class="gm-search">
        <view class="gm-search-icon">🔍</view>
        <input class="gm-search-input" placeholder="搜索地点" />
      </view>
    </view>
    
    <!-- 筛选 Chip -->
    <scroll-view scroll-x class="gm-px-md gm-mb-md">
      <view class="gm-flex">
        <view class="gm-chip gm-chip-selected gm-mr-sm">
          <text class="gm-chip-icon">🍜</text>
          美食
        </view>
        <view class="gm-chip gm-mr-sm">
          <text class="gm-chip-icon">🌳</text>
          景点
        </view>
        <view class="gm-chip">
          <text class="gm-chip-icon">🚻</text>
          便民厕所
        </view>
      </view>
    </scroll-view>
    
    <!-- 列表 -->
    <view class="gm-card">
      <view class="gm-list-item" @click="viewDetail">
        <view class="gm-list-item-icon" style="background-color: #FEF1E6;">
          🍲
        </view>
        <view class="gm-list-item-content">
          <text class="gm-list-item-title">塔尔海鲜肥牛</text>
          <text class="gm-list-item-subtitle">贵州省毕节市七星关区</text>
          <view class="gm-flex gm-mt-xs">
            <view class="gm-stars gm-stars-sm">
              <text class="gm-star gm-star-filled">★</text>
              <text class="gm-star gm-star-filled">★</text>
              <text class="gm-star gm-star-filled">★</text>
              <text class="gm-star gm-star-filled">★</text>
              <text class="gm-star">★</text>
            </view>
            <text class="gm-font-sm gm-text-secondary gm-ml-xs">4.5</text>
          </view>
        </view>
        <text class="gm-list-item-arrow">›</text>
      </view>
    </view>
    
    <!-- FAB -->
    <view class="gm-fab" style="right: 32rpx; bottom: 120rpx;" @click="addNew">
      <text class="gm-fab-icon">+</text>
    </view>
  </view>
</template>
```

## 颜色系统

所有颜色已在 `uni.scss` 中定义：

- **品牌色**: `$brand` (#1A73E8 Google Blue)
- **成功**: `$success` (#34A853 Google Green)  
- **警告**: `$warning` (#FBBC04 Google Yellow)
- **危险**: `$danger` (#EA4335 Google Red)
- **青色**: `$teal` (#24796C)

## 注意事项

1. 所有类名都以 `gm-` 开头，避免与其他样式冲突
2. 优先使用工具类组合，而非自定义样式
3. 保持 Material Design 设计原则：简洁、清晰、有层次
4. 按钮、卡片等交互元素使用标准的过渡动画
5. 遵循 8dp 间距系统（8rpx, 16rpx, 24rpx, 32rpx）

## 支持

如需自定义样式，可以基于这些类进行扩展，或直接在 `styles/google-maps.scss` 中添加新的工具类。
