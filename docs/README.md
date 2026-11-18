# 毕节生活地图

面向毕节七星关区的生活地图应用，聚合美食、景点、便民设施等地点信息，支持用户共创、地点评论、收藏与管理员审核。

## 项目信息

- **产品名称**：毕节生活地图（bijie-local）
- **应用形态**：微信小程序（uni-app Vue3 + uniCloud）
- **核心功能**：地图展示、地点搜索、用户共创、积分体系、评论评分

## 技术栈

- **前端**：uni-app（Vue3 `<script setup>` 语法）
- **后端**：uniCloud（支付宝云空间 `bijie-local-space`）
- **地图服务**：腾讯地图 WebService + uni-app `<map>` 组件
- **数据存储**：uniCloud 云数据库 + 云存储

## 项目结构

```
├── pages/                      # 页面目录
│   ├── index/                  # 首页
│   ├── map/                    # 地图页（核心页面）
│   ├── admin/                  # 管理页面（仅管理员）
│   ├── contribute/             # 补充/纠错页
│   ├── contributions/          # 我的共创
│   ├── favorites/              # 我的收藏
│   ├── mine/                   # 我的页面
│   ├── location-picker/        # 地图选点工具
│   └── spot-comments/          # 评论详情
├── components/                 # 通用组件
│   ├── AppIcon.vue
│   ├── AppLoading.vue
│   ├── AppSkeleton.vue
│   └── DragSheet.vue           # 拖拽面板组件
├── styles/                     # 全局样式
├── static/                     # 静态资源（图标、图片、标记点等）
├── uniCloud-alipay/            # 云开发目录
│   └── cloudfunctions/         # 云函数与云对象
│       ├── spots/              # 地点业务（云对象）
│       ├── user-auth/          # 用户认证
│       ├── place-search/       # 地点搜索
│       ├── spot-comments/      # 评论业务
│       ├── spot-favorites/     # 收藏业务
│       └── common/             # 公共模块
├── App.vue                     # 根组件
├── main.js                     # 入口文件
├── pages.json                  # 页面配置
├── manifest.json               # 应用配置
└── docs/                       # 文档目录
    ├── README.md               # 项目基础信息（本文件）
    ├── DATABASE.md             # 数据库设计
    ├── API.md                  # 接口文档
    ├── FEATURES.md             # 功能说明
    └── TODO.md                 # 任务清单
```

## 快速开始

### 环境要求
- Node.js 14+
- HBuilderX 最新版或 VS Code + uni-app 插件
- 微信开发者工具（测试小程序）

### 安装依赖
```bash
npm install
```

### 开发运行
```bash
# 微信小程序开发预览
npm run dev:mp-weixin

# 其他平台（需配置对应环境）
npm run dev:h5
npm run dev:app
```

### 构建发布
```bash
# 微信小程序生产打包
npm run build:mp-weixin
```

## 配置说明

项目依赖以下第三方配置：

| 配置项 | 位置 | 说明 |
| --- | --- | --- |
| `WX_SECRET` | `uniCloud-alipay/cloudfunctions/user-auth/index.js` | 微信小程序 AppSecret（用于登录） |
| `TENCENT_MAP_KEY` | `uniCloud-alipay/cloudfunctions/place-search/index.js` | 腾讯地图 WebService Key（用于地点搜索） |
| `TOKEN_SECRET` | `user-auth` / `spots` 云函数 | Token 签名密钥（两处需保持一致） |

## 核心功能

- **地图展示**：按分类展示地点，支持搜索、筛选、排序
- **地点管理**：管理员可新增/编辑/删除地点
- **用户共创**：用户可补充新地点或纠错，管理员审核后发布
- **评论评分**：用户可评论与评分，支持图片上传
- **收藏系统**：用户可收藏喜欢的地点
- **积分体系**：通过审核的贡献获得积分奖励
- **权限管理**：基于管理员白名单的权限控制

## 主要页面

| 页面 | 说明 |
| --- | --- |
| 首页 | 功能入口导航 |
| 生活地图 | 核心功能页，地图 + 列表展示 |
| 地点管理 | 管理员地点 CRUD（仅管理员） |
| 审核管理 | 管理员审核投稿内容（仅管理员） |
| 补充/纠错 | 用户提交新地点或纠错反馈 |
| 我的共创 | 用户查看自己的贡献记录与积分 |
| 我的收藏 | 用户查看收藏的地点 |
| 我的页面 | 用户信息与功能导航 |

## 文档导航

- **[数据库设计](./DATABASE.md)**：完整的数据表结构与字段说明
- **[接口文档](./API.md)**：云对象与云函数的 API 接口定义
- **[功能说明](./FEATURES.md)**：详细的功能模块说明与流程
- **[任务清单](./TODO.md)**：开发任务与优化记录

## 云开发配置

项目使用 uniCloud 支付宝云空间 `bijie-local-space`。

### 云资源清单

| 类型 | 名称 | 说明 |
| --- | --- | --- |
| 云对象 | `spots` | 地点业务逻辑 |
| 云对象 | `spot-comments` | 评论业务逻辑 |
| 云对象 | `spot-favorites` | 收藏业务逻辑 |
| 云函数 | `user-auth` | 用户认证 |
| 云函数 | `place-search` | 地点搜索 |
| 云函数 | `common/app-config` | 应用配置 |
| 云函数 | `common/cloud-auth` | 云端认证工具 |

### 数据表

| 表名 | 说明 |
| --- | --- |
| `spots` | 地点数据 |
| `users` | 用户信息 |
| `admin-whitelist` | 管理员白名单 |
| `spot-comments` | 地点评论 |
| `spot-favorites` | 用户收藏 |

## 权限体系

- **公开权限**：地点查询、搜索、投稿
- **登录权限**：发表评论、收藏、查看共创记录
- **管理员权限**：地点增删改、投稿审核

## 状态管理

项目采用组件本地状态 + 云端数据存储，核心数据状态包括：

- 地点审核状态：`pending`（待审核）、`approved`（已通过）、`rejected`（已驳回）
- 评论审核状态：`pending`、`approved`
- 用户登录态：token 本地存储（7 天有效）

## 常见问题

**Q: 如何添加管理员？**
A: 首个登录用户自动成为管理员。之后可在管理后台维护白名单。

**Q: 如何修改默认地图中心点？**
A: 修改 `pages/map/map.vue` 中的坐标配置或 `uniCloud-alipay/cloudfunctions/common/app-config/index.js`。

**Q: 图片上传大小限制？**
A: 前端自动压缩，云存储配额由 uniCloud 空间决定。

## 许可证

项目内部使用，未公开发布。

---

**文档最后更新**：2026-11-18
