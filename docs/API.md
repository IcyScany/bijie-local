# API 接口文档

## 概述

项目采用 uniCloud 云开发架构，包含云对象与云函数两种调用方式。

- **云对象**（Object）：面向对象风格，推荐用于复杂业务逻辑
- **云函数**（Function）：函数式风格，推荐用于简单业务或工具函数

---

## 1. 云对象 - spots（地点业务）

**文件位置**：`uniCloud-alipay/cloudfunctions/spots/index.obj.js`

### 1.1 getList - 获取地点列表

获取分页、筛选、排序后的地点列表。

```javascript
// 请求
uni.cloud.callFunction({
  name: 'spots',
  data: {
    action: 'getList',
    params: {
      keyword: '美食',           // [可选] 关键字搜索
      type: 'food',            // [可选] 地点类型：food/view/toilet/shop/other
      status: 'approved',      // [可选] 审核状态：pending/approved/rejected
      source: 'user',          // [可选] 投稿来源：admin/user
      page: 1,                 // [可选] 页码，默认 1
      pageSize: 20,            // [可选] 每页记录数，默认 20
      sortBy: 'distance',      // [可选] 排序字段：distance/rating/create_date
      order: 'asc',            // [可选] 排序方向：asc/desc
      longitude: 105.2844,     // [可选] 用户经度（用于距离计算）
      latitude: 27.2987        // [可选] 用户纬度（用于距离计算）
    }
  }
})

// 响应
{
  code: 0,                     // 状态码：0 成功
  data: {
    list: [
      {
        _id: '...',
        name: '张家麻辣烫',
        type: 'food',
        address: '毕节市七星关区...',
        longitude: 105.28,
        latitude: 27.29,
        remark: '本地特色美食',
        images: ['cloud://...'],
        status: 'approved',
        contributor_name: '用户1234',
        rating_count: 15,
        average_rating: 4.5,
        distance: 1250         // 距离（米），仅排序时计算
      }
    ],
    total: 100,                // 总记录数
    page: 1,
    pageSize: 20
  }
}
```

**权限**：公开

---

### 1.2 getDetail - 获取地点详情

获取单个地点的完整信息。

```javascript
// 请求
uni.cloud.callFunction({
  name: 'spots',
  data: {
    action: 'getDetail',
    params: { id: '地点ID' }
  }
})

// 响应
{
  code: 0,
  data: {
    _id: '...',
    name: '张家麻辣烫',
    type: 'food',
    address: '毕节市七星关区...',
    longitude: 105.28,
    latitude: 27.29,
    remark: '本地特色美食',
    images: ['cloud://...'],
    status: 'approved',
    source: 'user',
    contact: '13812345678',
    contributor_openid: 'oWGN...',
    contributor_name: '用户1234',
    updater_name: '管理员',
    create_date: 1700000000000,
    update_date: 1700000000000,
    rating_count: 15,
    average_rating: 4.5
  }
}
```

**权限**：公开

---

### 1.3 add - 新增地点

管理员新增地点（直接发布，status=approved）。

```javascript
// 请求
uni.cloud.callFunction({
  name: 'spots',
  data: {
    action: 'add',
    params: {
      token: 'JWT_TOKEN',      // [必填] 管理员 token
      data: {
        name: '张家麻辣烫',
        type: 'food',
        address: '毕节市七星关区...',
        longitude: 105.28,
        latitude: 27.29,
        remark: '本地特色美食',
        images: ['cloud://...'],
        contact: '13812345678'
      }
    }
  }
})

// 响应
{
  code: 0,                     // 0 成功，1 权限错误，2 参数错误
  data: {
    _id: '新增地点ID'
  },
  msg: 'success'
}
```

**权限**：管理员

---

### 1.4 update - 编辑地点

修改地点信息（仅管理员）。

```javascript
// 请求
uni.cloud.callFunction({
  name: 'spots',
  data: {
    action: 'update',
    params: {
      token: 'JWT_TOKEN',
      id: '地点ID',
      data: {
        name: '新名称',        // [可选] 支持修改任何字段
        address: '新地址',
        remark: '新备注'
        // ...
      }
    }
  }
})

// 响应
{
  code: 0,
  msg: 'success'
}
```

**权限**：管理员

---

### 1.5 remove - 删除地点

删除单个或多个地点（仅管理员）。

```javascript
// 请求 - 删除单个
uni.cloud.callFunction({
  name: 'spots',
  data: {
    action: 'remove',
    params: {
      token: 'JWT_TOKEN',
      id: '地点ID'           // 字符串
    }
  }
})

// 请求 - 批量删除
uni.cloud.callFunction({
  name: 'spots',
  data: {
    action: 'remove',
    params: {
      token: 'JWT_TOKEN',
      id: ['ID1', 'ID2', 'ID3']  // 数组
    }
  }
})

// 响应
{
  code: 0,
  msg: 'success'
}
```

**权限**：管理员

---

### 1.6 submit - 用户投稿

用户提交新地点或纠错反馈（状态=pending）。

```javascript
// 请求 - 补充新地点
uni.cloud.callFunction({
  name: 'spots',
  data: {
    action: 'submit',
    params: {
      token: 'JWT_TOKEN',     // [可选] 已登录用户填写
      data: {
        report_type: 'new',    // [必填] new 或 correction
        type: 'food',
        name: '新店铺',
        address: '...',
        longitude: 105.28,
        latitude: 27.29,
        remark: '新开的麻辣烫',
        images: ['cloud://...'],
        contact: '13812345678'
      }
    }
  }
})

// 请求 - 纠错反馈
uni.cloud.callFunction({
  name: 'spots',
  data: {
    action: 'submit',
    params: {
      token: 'JWT_TOKEN',
      data: {
        report_type: 'correction',    // [必填]
        target_id: '要纠错的地点ID',   // [必填] 指向原地点
        report_reason: '地址错误，应该在...',
        images: ['cloud://...'],       // [可选] 证明图片
        contact: '13812345678'
      }
    }
  }
})

// 响应
{
  code: 0,
  data: {
    _id: '投稿记录ID'
  },
  msg: 'success'
}
```

**权限**：公开（登录则记录贡献者，未登录为匿名）

---

### 1.7 review - 审核投稿

管理员审核用户投稿（通过/驳回）。

```javascript
// 请求 - 通过审核
uni.cloud.callFunction({
  name: 'spots',
  data: {
    action: 'review',
    params: {
      token: 'JWT_TOKEN',
      id: '投稿记录ID',
      status: 'approved'       // [必填] approved 或 rejected
    }
  }
})

// 请求 - 驳回审核
uni.cloud.callFunction({
  name: 'spots',
  data: {
    action: 'review',
    params: {
      token: 'JWT_TOKEN',
      id: '投稿记录ID',
      status: 'rejected',
      reason: '信息不完整'     // [可选] 驳回原因
    }
  }
})

// 响应
{
  code: 0,
  data: {
    points_awarded: 10        // 通过时返回获得的积分
  },
  msg: 'success'
}
```

**权限**：管理员

**副作用**
- 通过审核：
  - 新增投稿 → 发布为地点（status=approved）
  - 纠错投稿 → 更新原地点信息
  - 贡献者 `points += 积分值`（新增 10，纠错 5）
- 驳回审核：status=rejected，记录驳回原因

---

### 1.8 rejectUndo - 撤销驳回

管理员撤销驳回操作，将状态恢复为 pending。

```javascript
// 请求
uni.cloud.callFunction({
  name: 'spots',
  data: {
    action: 'rejectUndo',
    params: {
      token: 'JWT_TOKEN',
      id: '投稿记录ID'
    }
  }
})

// 响应
{
  code: 0,
  msg: 'success'
}
```

**权限**：管理员

---

### 1.9 addComment - 发表评论

用户对地点发表评论与评分。

```javascript
// 请求
uni.cloud.callFunction({
  name: 'spots',
  data: {
    action: 'addComment',
    params: {
      token: 'JWT_TOKEN',      // [必填] 需登录
      spotId: '地点ID',
      rating: 4,               // [必填] 1-5 星
      content: '很不错的地方',   // [必填] 评论内容
      images: ['cloud://...']  // [可选] 配图，最多 3 张
    }
  }
})

// 响应
{
  code: 0,
  data: {
    _id: '评论ID'
  },
  msg: 'success'
}
```

**权限**：已登录用户

**副作用**
- 创建评论记录（status=pending）
- 自动更新 `spots.rating_count` 和 `average_rating`

---

### 1.10 deleteComment - 删除评论

用户删除自己的评论。

```javascript
// 请求
uni.cloud.callFunction({
  name: 'spots',
  data: {
    action: 'deleteComment',
    params: {
      token: 'JWT_TOKEN',
      commentId: '评论ID'
    }
  }
})

// 响应
{
  code: 0,
  msg: 'success'
}
```

**权限**：评论作者或管理员

---

### 1.11 addFavorite - 收藏地点

用户收藏地点。

```javascript
// 请求
uni.cloud.callFunction({
  name: 'spots',
  data: {
    action: 'addFavorite',
    params: {
      token: 'JWT_TOKEN',
      spotId: '地点ID'
    }
  }
})

// 响应
{
  code: 0,
  data: {
    _id: '收藏记录ID'
  },
  msg: 'success'
}
```

**权限**：已登录用户

**约束**：重复收藏返回错误

---

### 1.12 removeFavorite - 取消收藏

用户取消收藏地点。

```javascript
// 请求
uni.cloud.callFunction({
  name: 'spots',
  data: {
    action: 'removeFavorite',
    params: {
      token: 'JWT_TOKEN',
      spotId: '地点ID'
    }
  }
})

// 响应
{
  code: 0,
  msg: 'success'
}
```

**权限**：已登录用户

---

### 1.13 isFavorited - 检查是否已收藏

检查用户是否已收藏某个地点。

```javascript
// 请求
uni.cloud.callFunction({
  name: 'spots',
  data: {
    action: 'isFavorited',
    params: {
      token: 'JWT_TOKEN',
      spotId: '地点ID'
    }
  }
})

// 响应
{
  code: 0,
  data: {
    favorited: true          // true 已收藏，false 未收藏
  }
}
```

**权限**：已登录用户

---

### 1.14 getFavorites - 获取用户收藏列表

获取当前用户的所有收藏地点。

```javascript
// 请求
uni.cloud.callFunction({
  name: 'spots',
  data: {
    action: 'getFavorites',
    params: {
      token: 'JWT_TOKEN',
      page: 1,               // [可选] 页码，默认 1
      pageSize: 20           // [可选] 每页记录数，默认 20
    }
  }
})

// 响应
{
  code: 0,
  data: {
    list: [
      { /* 地点对象 */ }
    ],
    total: 10,
    page: 1,
    pageSize: 20
  }
}
```

**权限**：已登录用户

---

### 1.15 getContributions - 获取用户共创记录

获取当前用户的所有共创（投稿）记录。

```javascript
// 请求
uni.cloud.callFunction({
  name: 'spots',
  data: {
    action: 'getContributions',
    params: {
      token: 'JWT_TOKEN',
      page: 1,               // [可选] 页码
      pageSize: 20,          // [可选] 每页记录数
      status: 'approved'     // [可选] 筛选状态：pending/approved/rejected
    }
  }
})

// 响应
{
  code: 0,
  data: {
    list: [
      {
        _id: '投稿ID',
        type: 'new',           // new 或 correction
        name: '新地点名称',
        status: 'approved',
        reason: null,          // 驳回原因（仅驳回时有值）
        points_awarded: 10,    // 获得积分
        create_date: 1700000000000,
        target_spot: { /* 目标地点信息，纠错时有值 */ }
      }
    ],
    total: 5,
    points_total: 50         // 用户总积分
  }
}
```

**权限**：已登录用户

---

## 2. 云函数 - user-auth（用户认证）

**文件位置**：`uniCloud-alipay/cloudfunctions/user-auth/index.js`

### 2.1 login - 用户登录

微信登录或开发模式登录。

```javascript
// 请求 - 微信登录
uni.cloud.callFunction({
  name: 'user-auth',
  data: {
    action: 'login',
    code: 'WEIXIN_CODE'      // [必填] 微信 uni.login 获取的 code
  }
})

// 请求 - 开发模式登录（测试用）
uni.cloud.callFunction({
  name: 'user-auth',
  data: {
    action: 'login',
    openid: 'test_openid_001'  // [必填] 指定 OpenID
  }
})

// 响应
{
  code: 0,
  data: {
    token: 'JWT_TOKEN',         // Token，默认 7 天有效
    openid: 'oWGN...',
    isAdmin: false,             // 是否管理员
    userInfo: {
      nickname: '用户1234',
      avatar: 'https://...',
      is_admin: false,
      points: 15
    }
  }
}
```

**权限**：公开

**说明**
- 首个登录用户自动成为管理员
- Token 采用 HMAC-SHA256 签名，有效期 7 天
- 登录时自动更新用户的 `last_login_date`

---

### 2.2 check - 检查 Token 有效性

验证 Token 是否有效，返回用户信息。

```javascript
// 请求
uni.cloud.callFunction({
  name: 'user-auth',
  data: {
    action: 'check',
    token: 'JWT_TOKEN'
  }
})

// 响应
{
  code: 0,
  data: {
    isAdmin: false,
    openid: 'oWGN...',
    userInfo: {
      nickname: '用户1234',
      avatar: 'https://...',
      points: 15
    }
  }
}

// Token 失效响应
{
  code: 1,
  msg: 'Token expired or invalid'
}
```

**权限**：公开

---

### 2.3 updateProfile - 更新用户信息

修改用户昵称或头像。

```javascript
// 请求
uni.cloud.callFunction({
  name: 'user-auth',
  data: {
    action: 'updateProfile',
    token: 'JWT_TOKEN',
    nickname: '新昵称',       // [可选]
    avatar: 'https://...'     // [可选] 头像 URL
  }
})

// 响应
{
  code: 0,
  data: {
    userInfo: {
      nickname: '新昵称',
      avatar: 'https://...'
    }
  }
}
```

**权限**：已登录用户

---

## 3. 云函数 - place-search（地点搜索）

**文件位置**：`uniCloud-alipay/cloudfunctions/place-search/index.js`

### 3.1 search - 腾讯地图 POI 搜索

调用腾讯地图 WebService 进行 POI 搜索。

```javascript
// 请求
uni.cloud.callFunction({
  name: 'place-search',
  data: {
    keyword: '麻辣烫',         // [必填] 搜索关键字
    region: '毕节',            // [可选] 搜索城市，默认毕节
    page: 1,                   // [可选] 页码，默认 1
    pageSize: 10               // [可选] 每页记录数，默认 10
  }
})

// 响应
{
  code: 0,
  data: {
    list: [
      {
        title: '老张麻辣烫',
        address: '贵州省毕节市七星关区xx街道',
        longitude: 105.2844,
        latitude: 27.2987,
        uid: '...'               // POI UID，可用于获取详情
      }
    ],
    total: 25                    // 总结果数
  }
}
```

**权限**：公开

**说明**
- 依赖配置 `TENCENT_MAP_KEY`
- 返回结果包含腾讯地图 POI 数据
- 可用于地点管理页的地点搜索和快速填充

---

## 4. 错误码统一规范

| 错误码 | 说明 |
| --- | --- |
| 0 | 成功 |
| 1 | 权限不足（非管理员） |
| 2 | 参数错误 |
| 3 | Token 失效 |
| 4 | 资源不存在 |
| 5 | 操作冲突（如重复收藏） |
| 99 | 服务器错误 |

---

## 5. 前端调用示例

### 5.1 获取地点列表

```javascript
// pages/map/map.vue
async function fetchSpots() {
  try {
    const res = await uni.cloud.callFunction({
      name: 'spots',
      data: {
        action: 'getList',
        params: {
          type: currentType,
          page: currentPage,
          pageSize: 20,
          longitude: userLocation.longitude,
          latitude: userLocation.latitude,
          sortBy: sortMethod
        }
      }
    })
    
    if (res.result.code === 0) {
      spotList.value = res.result.data.list
      totalCount.value = res.result.data.total
    }
  } catch (err) {
    console.error('获取地点列表失败:', err)
  }
}
```

### 5.2 提交投稿

```javascript
// pages/contribute/contribute.vue
async function submitContribution() {
  try {
    const res = await uni.cloud.callFunction({
      name: 'spots',
      data: {
        action: 'submit',
        params: {
          token: userStore.token,
          data: {
            report_type: 'new',
            type: formData.type,
            name: formData.name,
            address: formData.address,
            longitude: formData.longitude,
            latitude: formData.latitude,
            remark: formData.remark,
            images: uploadedImages,
            contact: formData.contact
          }
        }
      }
    })
    
    if (res.result.code === 0) {
      uni.showToast({ title: '投稿成功，等待审核' })
    }
  } catch (err) {
    uni.showToast({ title: '投稿失败' })
  }
}
```

### 5.3 用户登录

```javascript
// utils/auth.js
export async function login() {
  try {
    const { code } = await uni.login()
    const res = await uni.cloud.callFunction({
      name: 'user-auth',
      data: {
        action: 'login',
        code
      }
    })
    
    if (res.result.code === 0) {
      const { token, isAdmin, userInfo } = res.result.data
      uni.setStorageSync('token', token)
      uni.setStorageSync('isAdmin', isAdmin)
      uni.setStorageSync('userInfo', userInfo)
      return true
    }
  } catch (err) {
    console.error('登录失败:', err)
    return false
  }
}
```

---

## 6. Token 管理

### 6.1 Token 生成与验证

- **生成**：`user-auth` 云函数使用 HMAC-SHA256 签名
- **密钥**：`TOKEN_SECRET`（在 `user-auth` 和 `spots` 中须保持一致）
- **有效期**：7 天
- **刷新**：每次 `check` 或 `login` 时重新签发新 Token

### 6.2 前端 Token 存储

```javascript
// 登录后存储
uni.setStorageSync('token', token)

// 调用管理接口时携带
const token = uni.getStorageSync('token')
```

### 6.3 自动登录

应用启动时自动检查 Token，如有效则跳过登录流程：

```javascript
// App.vue onLaunch
async function checkAuth() {
  const token = uni.getStorageSync('token')
  if (token) {
    const valid = await verifyToken(token)
    if (!valid) {
      // Token 过期，需重新登录
      await login()
    }
  } else {
    await login()
  }
}
```

