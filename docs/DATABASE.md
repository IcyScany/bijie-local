# 数据库设计文档

## 数据表结构

### 1. spots（地点数据表）

地点信息的核心表，存储所有地点数据及投稿审核状态。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `_id` | string | 主键 | MongoDB ObjectID |
| `name` | string | 必填、索引 | 地点名称 |
| `type` | enum | 必填 | `food` 美食 / `view` 景点 / `toilet` 便民厕所 / `shop` 便民商店 / `other` 其他 |
| `address` | string | 必填 | 详细地址 |
| `longitude` | double | 必填 | 经度 |
| `latitude` | double | 必填 | 纬度 |
| `remark` | string | 可选 | 备注/描述 |
| `images` | array | 可选 | 实拍图片数组，存储云存储 fileID，最多 9 张 |
| `status` | enum | 必填、索引 | `approved`（已通过）/ `pending`（待审核）/ `rejected`（已驳回），默认 `approved` |
| `source` | enum | 必填 | `admin`（管理员新增）/ `user`（用户提交） |
| `report_type` | enum | 可选 | `new`（新增）/ `correction`（纠错），用户投稿时使用 |
| `report_reason` | string | 可选 | 纠错说明（纠错投稿时填写） |
| `reject_reason` | string | 可选 | 驳回原因（管理员驳回时填写） |
| `target_id` | string | 可选 | 纠错目标地点 ID（纠错投稿时指向原地点） |
| `contact` | string | 可选 | 联系方式（电话/微信等） |
| `contributor_openid` | string | 可选、索引 | 贡献者 OpenID |
| `contributor_name` | string | 可选 | 贡献者昵称 |
| `updater_openid` | string | 可选 | 最近修改者 OpenID |
| `updater_name` | string | 可选 | 最近修改者昵称 |
| `create_date` | timestamp | 必填、索引 | 创建时间 |
| `update_date` | timestamp | 必填 | 修改时间 |
| `rating_count` | int | 默认 0 | 评论总数 |
| `average_rating` | double | 默认 0 | 平均评分（1-5） |

**索引**
- `name`：支持模糊搜索
- `status`：快速过滤已通过的地点
- `type`：按分类筛选
- `create_date`：时间排序
- `contributor_openid`：查询用户贡献

---

### 2. users（用户信息表）

存储登录用户信息与积分数据。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `_id` | string | 主键 | MongoDB ObjectID |
| `openid` | string | 唯一、索引 | 微信 OpenID |
| `nickname` | string | 必填 | 用户昵称，默认为"用户" + OpenID 后 4 位 |
| `avatar` | string | 可选 | 头像 URL（微信头像或自定义） |
| `is_admin` | bool | 默认 false | 是否管理员 |
| `points` | int | 默认 0 | 总积分（新增/纠错分别计分） |
| `last_login_date` | timestamp | 必填 | 最近登录时间 |
| `create_date` | timestamp | 必填、索引 | 创建时间 |
| `update_date` | timestamp | 必填 | 修改时间 |

**索引**
- `openid`：快速查询用户信息

**积分规则**
- 新增地点通过：+10 分
- 纠错反馈通过：+5 分

---

### 3. admin-whitelist（管理员白名单表）

管理员身份白名单，仅云函数可直连此表。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `_id` | string | 主键 | MongoDB ObjectID |
| `openid` | string | 唯一、索引 | 管理员 OpenID |
| `name` | string | 可选 | 管理员备注名称 |
| `create_date` | timestamp | 必填 | 添加时间 |

**说明**
- 白名单为空时，首个登录用户自动成为管理员（bootstrap）
- 后续管理员需由现有管理员手动添加

---

### 4. spot-comments（地点评论表）

地点评论与评分数据。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `_id` | string | 主键 | MongoDB ObjectID |
| `spot_id` | string | 必填、索引 | 地点 ID（关联 spots 表） |
| `user_openid` | string | 必填、索引 | 评论者 OpenID（关联 users 表） |
| `user_name` | string | 必填 | 评论者昵称 |
| `user_avatar` | string | 可选 | 评论者头像 URL |
| `rating` | int | 必填 | 评分（1-5 星），用于计算平均评分 |
| `content` | string | 必填 | 评论内容 |
| `images` | array | 可选 | 配图数组，存储云存储 fileID，最多 3 张 |
| `status` | enum | 必填、索引 | `approved`（已通过）/ `pending`（待审核），默认 `pending` |
| `create_date` | timestamp | 必填、索引 | 创建时间 |
| `update_date` | timestamp | 必填 | 修改时间 |

**索引**
- `spot_id`：快速查询地点的所有评论
- `user_openid`：查询用户的评论
- `status`：快速过滤已通过的评论

**说明**
- 默认审核状态为 `pending`，管理员需审核后才会展示
- 地点详情页仅展示 `status = approved` 的评论
- 删除评论时需级联删除

---

### 5. spot-favorites（用户收藏表）

用户收藏地点的记录表。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `_id` | string | 主键 | MongoDB ObjectID |
| `user_openid` | string | 必填、索引 | 用户 OpenID（关联 users 表） |
| `spot_id` | string | 必填、索引 | 地点 ID（关联 spots 表） |
| `create_date` | timestamp | 必填 | 收藏时间 |

**约束**
- 组合唯一索引：`user_openid` + `spot_id`（一个用户同一个地点只能收藏一次）

**索引**
- `user_openid`：快速查询用户的所有收藏
- `spot_id`：查询地点的收藏数

---

## 数据关系图

```
┌─────────────────────────────────────────────────────┐
│                      users                          │
│  (openid*, nickname, avatar, is_admin, points)      │
└─────────────────────────────────────────────────────┘
            │                           │
            │                           │
    (openid)│                    (user_openid)
            │                           │
            ├─────────────┬─────────────┤
            │             │             │
            │             │             │
            ▼             ▼             ▼
    ┌──────────┐   ┌──────────────┐   ┌─────────────┐
    │ spots    │   │ spot-comments│   │spot-favorites
    │(contributor│  │(spot_id,    │   │(spot_id)
    │_openid)  │   │user_openid)  │   │
    └──────────┘   └──────────────┘   └─────────────┘
            │             │
            └─────┬───────┘
                  │
            ┌─────▼──────┐
            │admin-white│
            │  list     │
            │(openid)   │
            └───────────┘
```

---

## 权限控制

### 数据表权限设置

| 表名 | 客户端读 | 客户端写 | 说明 |
| --- | --- | --- | --- |
| `spots` | ✓ | ✗ | 公开读，仅云函数写 |
| `users` | ✗ | ✗ | 关闭直连，仅云函数访问 |
| `admin-whitelist` | ✗ | ✗ | 关闭直连，仅云函数访问 |
| `spot-comments` | ✓ | ✗ | 公开读，仅云函数写 |
| `spot-favorites` | ✓ | ✗ | 仅权限用户读写（通过云对象） |

### 字段级权限

- `users.is_admin`：客户端不可读（防止用户侦测管理员身份）
- `admin-whitelist`：完全隐藏

---

## 数据流说明

### 用户投稿流程

```
用户提交(submit)
  ↓
spots 表新增记录
  status = pending
  source = user
  report_type = new/correction
  contributor_openid/name = 当前登录用户
  ↓
管理员审核(review)
  ✓ 通过：status = approved → 发布 → users.points += 分值
  ✗ 驳回：status = rejected, reject_reason = 原因
  ↓
用户查看(getContributions)
  → 获取该用户所有共创记录 + 积分统计
```

### 评论流程

```
用户发表评论(addComment)
  ↓
spot-comments 表新增记录
  status = pending
  user_openid/name/avatar = 当前登录用户
  rating = 1-5
  ↓
spots 表字段自动更新
  rating_count ++
  average_rating = (sum(rating) / rating_count)
  ↓
管理员审核
  ✓ 通过：status = approved
  ✗ 驳回：删除记录
```

### 收藏流程

```
用户收藏(addFavorite)
  ↓
spot-favorites 表新增记录 (user_openid, spot_id)
  检查唯一索引：防止重复收藏
  ↓
用户查看收藏(getFavorites)
  → 通过 user_openid 查询 → 关联 spots 表获取完整数据
  ↓
取消收藏(removeFavorite)
  → 删除对应记录
```

---

## 性能考虑

### 索引策略

**必需索引**
- `spots.name`：支持模糊搜索性能
- `spots.status`：快速过滤已通过的地点
- `spots.create_date`：时间排序
- `spot-comments.spot_id`：查询某地点的所有评论
- `spot-favorites.user_openid`：查询用户收藏

**建议索引**
- `spots.type`：分类筛选
- `spot-comments.user_openid`：用户评论统计

### 反范式化字段

为了避免频繁的关联查询，部分字段反范式化存储：

- `spots.rating_count`、`average_rating`：地点的评论统计，写在 spots 表中
- `spot-comments.user_name`、`user_avatar`：用户昵称和头像复制到评论表中

---

## 初始化数据

### Bootstrap 流程

应用首次启动时的数据初始化：

1. **首个登录用户**
   - 自动成为管理员（admin-whitelist 为空）
   - 在 users 表设置 `is_admin = true`

2. **初始化示例数据**（可选）
   - 在 `uniCloud-alipay/cloudfunctions/common/app-config/` 中定义
   - 预置毕节七星关区的常见地点

---

## 备份与恢复

- 定期导出 uniCloud 数据库备份
- 生产环境采取分表策略（按时间/类型分表可选）
- 敏感数据（tokens、密钥）使用环境变量，不存储在数据库

---

## 扩展建议

如需后续扩展功能，可考虑以下新表：

| 表名 | 说明 |
| --- | --- |
| `spot-ratings-history` | 评分历史记录（可选，用于数据分析） |
| `user-points-log` | 用户积分变动日志（可选，用于审计） |
| `spot-edit-history` | 地点编辑历史（可选，用于版本管理） |
| `user-notifications` | 用户通知日志（可选，用于系统消息） |

