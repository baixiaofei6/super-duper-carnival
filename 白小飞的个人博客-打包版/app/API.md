# blog-site API 契约 v1（Lead 冻结，子代理按此实现）

本文件是 `blog-site/` 的服务端／前端／测试三方唯一接口契约。实现不得改动此文件；如契约与 `lib/*.js` 现有能力冲突，报 hand_back，不要改 `lib/`。

## 0. 运行与环境

- 运行时：Node >= 18，零 npm 依赖（仅 Node 内置模块）。已实测 `node -v` = v24.14.1。
- 入口：`blog-site/server.js`，`node server.js` 启动；启动时向 stdout 打印一行 `READY <port>` 供 smoke test 探测。
- 环境变量覆盖（必须实现）：`PORT`（默认读 config.port=8787）、`HOST`（默认 127.0.0.1）、`DATA_DIR`（默认 `blog-site/data`）、`CONFIG_PATH`（默认 `blog-site/config.json`；不存在则回落 `blog-site/config.example.json`）。
- 配置读取不得把任何 secret 暴露给前端；`config.example.json` 保持原样（README 会说明复制成 `config.json`）。
- `Store` 实例：`new Store(DATA_DIR)`；`lib/store.js` 现有方法一律复用，不新增、不修改。
- 进程内每 10 分钟 `store.gc()` 清理过期 session / oauth state。

## 1. 通用约定（面向未来小程序端）

- `/api/*` **只返回 JSON**；统一 envelope `{ok:true, ...}` / `{ok:false, error:'CODE', message?}`；HTTP 状态码 200/201/400/401/403/404/413/500。
- 会话：浏览器用 HttpOnly Cookie `sid`；**非浏览器端（小程序）可用 `Authorization: Bearer <sessionId>`**。服务端按 `Bearer` 优先、Cookie 兜底解析。所有登录接口都返回 `sessionId`，供小程序本地持久化。
- `config.cors=true` 时：`OPTIONS` 预检返回 204，并给所有响应加 `Access-Control-Allow-Origin: *`、`Access-Control-Allow-Headers: Content-Type, Authorization`、`Access-Control-Allow-Methods: GET,POST,OPTIONS`。注意 `*` 不能带 Cookie，跨域端必须用 Bearer；README 要写明。
- 登录判定：`requireUser` 失败返回 401 `UNAUTHORIZED`；管理员判定 `isAdmin(user)`：
  - 若 `config.admin.provider` 与 `config.admin.openid` 都非空 → `store.getIdentity(provider, openid)` 的 `userId` 等于 `user.id` 才是管理员；
  - 否则（本地开发态，admin.openid 为空且 `providers.dev.enabled` 为真）→ **仅第一个 dev 身份用户**是管理员（按 `store.data.users` 创建顺序）。后续 dev 登录者一律是普通用户。**这是本地便利规则，README 必须写明公网部署前要关闭 dev 并绑定真实 admin identity。**
- 所有请求体上限 `config.upload.maxBytes`（20 MB），JSON 体用 `U.readJson`，超限返回 413 `BODY_TOO_LARGE`。
- 错误码集合：`UNAUTHORIZED / FORBIDDEN / NOT_FOUND / BAD_REQUEST / BAD_JSON / EXPECT_JSON / BODY_TOO_LARGE / PROVIDER_DISABLED / INVALID_STATE / UPLOAD_REJECTED / POST_EXISTS?` （无则省略，禁止自造大写之外的码）。

## 2. 公开接口

| 方法 | 路径 | 响应 |
|---|---|---|
| GET | `/api/health` | `{ok:true, uptime:<秒>}` |
| GET | `/api/bootstrap` | `{ok:true, site:{name,hero,sub,tagline,about,footer,icp,links,announcement,theme,heroFx}, layout:{modules:[{id,label,visible}]}, providers:{dev,wechat,qq,mini}, user:<公开用户对象或null>, admin:<bool>, api:1}`；site 为 config.site 叠加 store.settings() 的结果（不含任何 secret） |
| GET | `/api/posts` | `{ok:true, posts:[{slug,title,date,excerpt,tags,cover}]}` 按 date 倒序；**不返回 body** |
| GET | `/api/posts/:slug` | `{ok:true, post}` 含 `body`（管理员写入的 HTML）；不存在 404 `NOT_FOUND` |
| GET | `/api/projects` | `{ok:true, projects:[{id,title,desc,tag,cover}]}` |
| GET | `/api/comments?post=<slug>` | `{ok:true, comments:[{id,user:{nickname,avatar},text,date}]}`；缺 post 参数 400 `BAD_REQUEST` |
| GET | `/api/rss` | RSS 2.0 XML，`Content-Type: application/rss+xml; charset=utf-8`；由 `store.posts()` 生成，链接用 `config.baseUrl + '/#/notes/'+slug`（本轮前台是单页 hash 路由） |
| GET | `/uploads/:name` | 仅当 `store.uploadByName(name)` 存在且 name 匹配 `^[A-Za-z0-9._-]+$` 时读 `store.uploadsPath(name)`；`Content-Type` 用 `U.mimeOf`，加 `X-Content-Type-Options: nosniff`；否则 404 |

公开用户对象：`{id,nickname,avatar}`（绝不返回 openid / unionid / session 列表）。

## 3. 登录与资料

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/login/dev` | body `{nickname}`；仅 `providers.dev.enabled` 时可用，否则 400 `PROVIDER_DISABLED`；调 `A.devLogin(store,nickname)` → `store.createSession(user.id, config.sessionDays)` → `Set-Cookie: sid=...; Path=/; HttpOnly; SameSite=Lax`（`secureCookies` 为真时加 Secure），返回 `{ok:true,user,sessionId,expiresAt}` |
| POST | `/api/login/mini` | body `{code}`；仅 `providers.mini.enabled` 时可用；调 `A.miniByCode(config,code,store)`；同上发会话，返回 `{ok:true,user,sessionId}`。**这是小程序端登录入口**：code2Session 只给 openid，昵称头像由下一步 `/api/profile` 补写 |
| GET | `/api/auth/wechat/start?redirect=<path>` | 生成 `state=U.rand(16)`，`store.pushState(state,'wechat',redirect)`，302 到 `A.wechatAuthorizeURL(config,state,config.baseUrl+'/api/auth/wechat/callback')`；provider 未启用返回 400 `PROVIDER_DISABLED` |
| GET | `/api/auth/qq/start?redirect=<path>` | 同上，用 `A.qqAuthorizeURL` |
| GET | `/api/auth/wechat/callback?code=&state=` | `store.takeState(state,'wechat')` 为空 → 400 `INVALID_STATE`；`A.wechatByCode` → 发会话 → 302 回 state.redirect 或 `/` |
| GET | `/api/auth/qq/callback?code=&state=` | 同上，`A.qqByCode(config,code,config.baseUrl+'/api/auth/qq/callback',store)` |
| GET | `/api/me` | 未登录 401；返回 `{ok:true,user,providers:<string[]>,admin:<bool>}` |
| POST | `/api/profile` | 需登录；body `{nickname?,avatar?}`；`avatar` 必须经 `U.normalizeAvatar` 过滤（只接受 `/uploads/xxx` 或图片 data URL）；`store.updateProfile` → `{ok:true,user}` |
| POST | `/api/logout` | 清 session + `Max-Age=0` Cookie → `{ok:true}` |

## 4. 登录用户接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/comments` | 需登录；body `{post,text}`；校验 `store.post(post)` 存在、text 去空白后 1..1000 字；`store.addComment` → 201 `{ok:true,comment}` |
| POST | `/api/upload` | 需登录；`multipart/form-data`，字段名 `file`；用 `U.boundaryFrom` + `U.parseMultipart` 解析；校验 `config.upload.maxBytes` 与 `config.upload.extensions` 白名单（按小写扩展名），失败 400 `UPLOAD_REJECTED`；文件名 `U.rand(12)+ext`，写 `store.uploadsPath(name)`，`store.addUpload({name,url:'/uploads/'+name,size,type,owner:user.id,source:'user',original:U.safeFilename(filename)})` → 201 `{ok:true,file:{name,url,size,type}}` |
| GET | `/api/uploads` | 需登录；`{ok:true,uploads}`；普通用户只看自己 `owner`，管理员看全部 |

## 5. 管理员接口（`isAdmin` 为假一律 403 `FORBIDDEN`）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/overview` | `{ok:true, counts:{posts,projects,comments,uploads,users,sessions}}`（sessions 取未过期数量） |
| POST | `/api/admin/posts` | body `{title,slug?,date?,excerpt?,tags?,body?,cover?}`；`slug` 缺省用 `U.slugify(title)`；`date` 缺省 `U.nowISO().slice(0,10)`；`tags` 必须是字符串数组；`store.addPost` → 201 `{ok:true,post}` |
| POST | `/api/admin/projects` | body `{title,desc?,tag?,cover?}`；`store.addProject` → 201 `{ok:true,project}` |

## 5b. 站点自定义与首页编排（本轮新增，管理员）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/settings` | `{ok:true, settings, defaults}`；defaults 为 config.site，settings 为后台已保存的覆盖值 |
| POST | `/api/admin/settings` | 可写：`name/hero/sub/tagline/announcement/footer/icp/about`（字符串，<=600）、`links`（最多 20 条 `{label,url}`）、`theme`（`accent/orbA/orbB/orbC` 为 hex，`glow/glass/grid/halo` 布尔，`density` = compact | comfortable）、`heroFx`（`radius/strength` 20..400，`trail` .05..1，`halo` 布尔）；非法值 400 `BAD_REQUEST`；写后 `/api/bootstrap` 立即生效 |
| GET | `/api/admin/layout` | `{ok:true, layout}`；未保存时返回 `Store.DEFAULT_LAYOUT`（模块 notice/hero/updates/series/projects/stats/links/about） |
| POST | `/api/admin/layout` | body `{modules:[{id,visible}]}`，必须含全部 8 个模块且 id 唯一；顺序即首页编排顺序，`visible:false` 隐藏；非法 400 `BAD_REQUEST` |
| GET | `/api/admin/content` | `{ok:true, posts, projects, comments, uploads, users}`，供后台管理列表 |
| POST | `/api/admin/posts/delete` | body `{slug}`；删文章并连带删该文章评论；不存在 404 |
| POST | `/api/admin/projects/delete` | body `{id}`；不存在 404 |
| POST | `/api/admin/comments/delete` | body `{id}`；不存在 404 |
| POST | `/api/admin/uploads/delete` | body `{name}`；校验 `^[A-Za-z0-9._-]+# blog-site API 契约 v1（Lead 冻结，子代理按此实现）

本文件是 `blog-site/` 的服务端／前端／测试三方唯一接口契约。实现不得改动此文件；如契约与 `lib/*.js` 现有能力冲突，报 hand_back，不要改 `lib/`。

## 0. 运行与环境

- 运行时：Node >= 18，零 npm 依赖（仅 Node 内置模块）。已实测 `node -v` = v24.14.1。
- 入口：`blog-site/server.js`，`node server.js` 启动；启动时向 stdout 打印一行 `READY <port>` 供 smoke test 探测。
- 环境变量覆盖（必须实现）：`PORT`（默认读 config.port=8787）、`HOST`（默认 127.0.0.1）、`DATA_DIR`（默认 `blog-site/data`）、`CONFIG_PATH`（默认 `blog-site/config.json`；不存在则回落 `blog-site/config.example.json`）。
- 配置读取不得把任何 secret 暴露给前端；`config.example.json` 保持原样（README 会说明复制成 `config.json`）。
- `Store` 实例：`new Store(DATA_DIR)`；`lib/store.js` 现有方法一律复用，不新增、不修改。
- 进程内每 10 分钟 `store.gc()` 清理过期 session / oauth state。

## 1. 通用约定（面向未来小程序端）

- `/api/*` **只返回 JSON**；统一 envelope `{ok:true, ...}` / `{ok:false, error:'CODE', message?}`；HTTP 状态码 200/201/400/401/403/404/413/500。
- 会话：浏览器用 HttpOnly Cookie `sid`；**非浏览器端（小程序）可用 `Authorization: Bearer <sessionId>`**。服务端按 `Bearer` 优先、Cookie 兜底解析。所有登录接口都返回 `sessionId`，供小程序本地持久化。
- `config.cors=true` 时：`OPTIONS` 预检返回 204，并给所有响应加 `Access-Control-Allow-Origin: *`、`Access-Control-Allow-Headers: Content-Type, Authorization`、`Access-Control-Allow-Methods: GET,POST,OPTIONS`。注意 `*` 不能带 Cookie，跨域端必须用 Bearer；README 要写明。
- 登录判定：`requireUser` 失败返回 401 `UNAUTHORIZED`；管理员判定 `isAdmin(user)`：
  - 若 `config.admin.provider` 与 `config.admin.openid` 都非空 → `store.getIdentity(provider, openid)` 的 `userId` 等于 `user.id` 才是管理员；
  - 否则（本地开发态，admin.openid 为空且 `providers.dev.enabled` 为真）→ **仅第一个 dev 身份用户**是管理员（按 `store.data.users` 创建顺序）。后续 dev 登录者一律是普通用户。**这是本地便利规则，README 必须写明公网部署前要关闭 dev 并绑定真实 admin identity。**
- 所有请求体上限 `config.upload.maxBytes`（20 MB），JSON 体用 `U.readJson`，超限返回 413 `BODY_TOO_LARGE`。
- 错误码集合：`UNAUTHORIZED / FORBIDDEN / NOT_FOUND / BAD_REQUEST / BAD_JSON / EXPECT_JSON / BODY_TOO_LARGE / PROVIDER_DISABLED / INVALID_STATE / UPLOAD_REJECTED / POST_EXISTS?` （无则省略，禁止自造大写之外的码）。

## 2. 公开接口

| 方法 | 路径 | 响应 |
|---|---|---|
| GET | `/api/health` | `{ok:true, uptime:<秒>}` |
| GET | `/api/bootstrap` | `{ok:true, site:{name,hero,sub,tagline,about,footer,icp,links,announcement,theme,heroFx}, layout:{modules:[{id,label,visible}]}, providers:{dev,wechat,qq,mini}, user:<公开用户对象或null>, admin:<bool>, api:1}`；site 为 config.site 叠加 store.settings() 的结果（不含任何 secret） |
| GET | `/api/posts` | `{ok:true, posts:[{slug,title,date,excerpt,tags,cover}]}` 按 date 倒序；**不返回 body** |
| GET | `/api/posts/:slug` | `{ok:true, post}` 含 `body`（管理员写入的 HTML）；不存在 404 `NOT_FOUND` |
| GET | `/api/projects` | `{ok:true, projects:[{id,title,desc,tag,cover}]}` |
| GET | `/api/comments?post=<slug>` | `{ok:true, comments:[{id,user:{nickname,avatar},text,date}]}`；缺 post 参数 400 `BAD_REQUEST` |
| GET | `/api/rss` | RSS 2.0 XML，`Content-Type: application/rss+xml; charset=utf-8`；由 `store.posts()` 生成，链接用 `config.baseUrl + '/#/notes/'+slug`（本轮前台是单页 hash 路由） |
| GET | `/uploads/:name` | 仅当 `store.uploadByName(name)` 存在且 name 匹配 `^[A-Za-z0-9._-]+$` 时读 `store.uploadsPath(name)`；`Content-Type` 用 `U.mimeOf`，加 `X-Content-Type-Options: nosniff`；否则 404 |

公开用户对象：`{id,nickname,avatar}`（绝不返回 openid / unionid / session 列表）。

## 3. 登录与资料

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/login/dev` | body `{nickname}`；仅 `providers.dev.enabled` 时可用，否则 400 `PROVIDER_DISABLED`；调 `A.devLogin(store,nickname)` → `store.createSession(user.id, config.sessionDays)` → `Set-Cookie: sid=...; Path=/; HttpOnly; SameSite=Lax`（`secureCookies` 为真时加 Secure），返回 `{ok:true,user,sessionId,expiresAt}` |
| POST | `/api/login/mini` | body `{code}`；仅 `providers.mini.enabled` 时可用；调 `A.miniByCode(config,code,store)`；同上发会话，返回 `{ok:true,user,sessionId}`。**这是小程序端登录入口**：code2Session 只给 openid，昵称头像由下一步 `/api/profile` 补写 |
| GET | `/api/auth/wechat/start?redirect=<path>` | 生成 `state=U.rand(16)`，`store.pushState(state,'wechat',redirect)`，302 到 `A.wechatAuthorizeURL(config,state,config.baseUrl+'/api/auth/wechat/callback')`；provider 未启用返回 400 `PROVIDER_DISABLED` |
| GET | `/api/auth/qq/start?redirect=<path>` | 同上，用 `A.qqAuthorizeURL` |
| GET | `/api/auth/wechat/callback?code=&state=` | `store.takeState(state,'wechat')` 为空 → 400 `INVALID_STATE`；`A.wechatByCode` → 发会话 → 302 回 state.redirect 或 `/` |
| GET | `/api/auth/qq/callback?code=&state=` | 同上，`A.qqByCode(config,code,config.baseUrl+'/api/auth/qq/callback',store)` |
| GET | `/api/me` | 未登录 401；返回 `{ok:true,user,providers:<string[]>,admin:<bool>}` |
| POST | `/api/profile` | 需登录；body `{nickname?,avatar?}`；`avatar` 必须经 `U.normalizeAvatar` 过滤（只接受 `/uploads/xxx` 或图片 data URL）；`store.updateProfile` → `{ok:true,user}` |
| POST | `/api/logout` | 清 session + `Max-Age=0` Cookie → `{ok:true}` |

## 4. 登录用户接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/comments` | 需登录；body `{post,text}`；校验 `store.post(post)` 存在、text 去空白后 1..1000 字；`store.addComment` → 201 `{ok:true,comment}` |
| POST | `/api/upload` | 需登录；`multipart/form-data`，字段名 `file`；用 `U.boundaryFrom` + `U.parseMultipart` 解析；校验 `config.upload.maxBytes` 与 `config.upload.extensions` 白名单（按小写扩展名），失败 400 `UPLOAD_REJECTED`；文件名 `U.rand(12)+ext`，写 `store.uploadsPath(name)`，`store.addUpload({name,url:'/uploads/'+name,size,type,owner:user.id,source:'user',original:U.safeFilename(filename)})` → 201 `{ok:true,file:{name,url,size,type}}` |
| GET | `/api/uploads` | 需登录；`{ok:true,uploads}`；普通用户只看自己 `owner`，管理员看全部 |

## 5. 管理员接口（`isAdmin` 为假一律 403 `FORBIDDEN`）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/overview` | `{ok:true, counts:{posts,projects,comments,uploads,users,sessions}}`（sessions 取未过期数量） |
| POST | `/api/admin/posts` | body `{title,slug?,date?,excerpt?,tags?,body?,cover?}`；`slug` 缺省用 `U.slugify(title)`；`date` 缺省 `U.nowISO().slice(0,10)`；`tags` 必须是字符串数组；`store.addPost` → 201 `{ok:true,post}` |
| POST | `/api/admin/projects` | body `{title,desc?,tag?,cover?}`；`store.addProject` → 201 `{ok:true,project}` |
，删元数据与磁盘文件；不存在 404 |
| GET | `/api/admin/users` | `{ok:true, users:[{id,nickname,avatar,role,createdAt,providers}]}` |
| POST | `/api/admin/users/role` | body `{id,role}`，role 为 `admin` 或 `user`；不存在 404 |

所有 `/api/admin/*` 接口对非管理员 403 `FORBIDDEN`、未登录 401 `UNAUTHORIZED`。
`Store.DEFAULT_LAYOUT` 是代码里的默认编排，不是任何外部模板；后台改的设置存在 `data/data.json` 的 `settings`，重启后仍在。

## 5c. 白天 / 黑夜 / 自动、独立后台、管理员账号与访客留言（本轮新增）

- **双站点**：同一进程监听 `PORT`（主站，默认 8787）与 `ADMIN_PORT` / `config.adminPort`（独立后台，默认 8788，冲突时自动 +1）。启动时 stdout 打印 `READY <public>` 和 `ADMIN READY <admin>`。两者共享同一个 `Store` 实例，无多进程写竞争。
- **主站** `/` 只服务 `index.html`；`GET /admin`、所有 `/api/admin/*`、`/api/login/admin`、`/api/login/dev`、`/api/login/mini`、`POST /api/upload` 在主站一律 404 `NOT_FOUND`；主站页面不出现后台链接。`GET /api/bootstrap` 的 `admin` 恒为 `false`。
- **独立后台** `http://127.0.0.1:8788/` 直接打开 `admin.html`，管理员用账号密码登录；`POST /api/login/admin` body `{username,password}`，失败 401 `UNAUTHORIZED`，成功返回 `sessionId` 与 `Set-Cookie`。管理员判定只看 `user.role === 'admin'`，**旧的「第一个 dev 用户自动是管理员」规则已废除**。
- **管理员账号**：首次启动按 `config.adminAccount` 自动创建账号 `白小飞`、密码 `13135566867.`；密码用 `crypto.scryptSync` + 每账号随机 16 字节 salt 存 `passwordHash/passwordSalt`，比较用 `timingSafeEqual`，不存明文。已有 role=admin 时不覆盖。
- **改密**：`POST /api/admin/password` body `{oldPassword,newPassword}`；原密码错 400，新密码需 6..128 字符，成功 `{ok:true,changed:true}`。改密后旧密码立即失效。
- **显示模式**：`site.theme.mode` = `light | dark | auto`，后台设置接口校验枚举；`auto` 由浏览器 `prefers-color-scheme` 决定，`light/dark` 强制。主站导航有「白天 / 黑夜 / 自动」三个按钮，用户选择存 `localStorage['blog-theme-mode']` 并覆盖站点默认值；`matchMedia change` 时自动模式实时切换。
- **背景自定义与调色**：`site.theme` 新增 `bgImage`（`/uploads/xxx` 或 `https://` URL，<=300 字）、`bgColor/textColor/cardColor`（hex）。后台「站点设置」可上传背景图、清除、预览，并调三个颜色；主站 `.bg-image` 固定层叠加、CSS 变量覆盖 `--bg/--ink/--card`。
- **访客留言板**：`GET /api/guestbook` 全员可读；`POST /api/guestbook` body `{nickname?,text}`，未登录必须填 1..40 字昵称，text 1..1000 字，201 `{ok:true,entry}`。主站首页 `#guestbook-group` 与 `#/guestbook` 视图都渲染全员可见留言。管理员可 `POST /api/admin/guestbook/delete {id}`（不存在 404）或 `POST /api/admin/guestbook/clear`（返回 `cleared` 条数）。
- **只有管理员能调整网站内容**：`POST /api/admin/*`、`POST /api/upload` 均 `requireAdmin`；主站完全不暴露这些写接口。文章评论 `POST /api/comments` 与留言板仍对匿名访客开放（这两项是访客交流，不是站点内容调整）。
- `/api/admin/content` 响应新增 `guestbook` 数组；`Store.DEFAULT_LAYOUT` 仍是 8 模块，前台把 `guestbook` 作为第 9 个可选展示块（未在后台编排列表里时可无条件显示）。

## 6. 静态资源与页面路由

- `/` → `public/index.html`；`/admin` → `public/admin.html`；`/assets/*` → `public/assets/*`（`U.mimeOf` 决定 Content-Type）。
- 静态文件只允许 `public/` 目录内，路径需归一化并拒绝 `..`；不存在返回 404 纯文本。
- 若 `public/index.html` 尚不存在（并行开发期），`/` 返回 200 纯文本占位提示而非崩溃；`favicon.ico` 缺失返回 404。
- `/api/*` 未命中路由一律 404 `{ok:false,error:'NOT_FOUND'}`；其他未知路径 404 纯文本。

## 7. 前端必须遵守的渲染约定

- 数据一律来自第 2/3/4 节接口，禁止把 `store.seed()` 的示例文章硬编码进页面。
- 前台用户昵称／评论内容用 `textContent` 或 `U.escapeHtml` 等价的 DOM 转义渲染，防 XSS；只有 `post.body` 是管理员可信 HTML，允许 `innerHTML`。
- 未启用的登录 provider 按钮显示「未配置」并禁用，不得宣称微信/QQ 登录已可用。
- 页面需 `prefers-reduced-motion` 回退与移动端响应式；视觉沿用 `blog-design.md` §4 的暖奶油白色板（`#fcfaf8 / #f3ede8 / #f0ebe5 / #1f2329 / #fb8147`）。
- 粒子 Hero 基于 `particle-demo.html` 的核实采样/入场实现；**本轮增强部分不是官网原值**：window 级 pointermove 追踪（修复覆盖层挡住事件）、可配置 `radius/strength/trail`、速度拖尾力场与冷蓝光环，测试钩子 `window.__particleProbe()` / `window.__particlePositions()`。浏览器用 `/api/bootstrap` 的 `site.heroFx` 初始化。
- 首页六屏（公告 / Hero / 1 大 3 小动态 / FieldCard / 项目矩阵 / 状态 + 链接 + 关于）按 `layout.modules` 显隐与排序；视觉为暖白底 + 冷蓝科技层（渐变光晕、玻璃卡、背景网格），来自本轮对两个参照 CSS 的核实结果。

## 8. 公网 / 小程序愿景的边界（必须如实写进 README，不得夸大）

- 本轮只做到「本地 `127.0.0.1` 可跑通」，**没有公网部署、没有 HTTPS、没有域名、没有备案、没有真实微信/QQ AppID**。
- 小程序端本轮**没有实现**；但 `/api/*` 全部 JSON 化、登录返回 `sessionId`、支持 `Authorization: Bearer`、保留 `/api/login/mini` + `/api/profile`，就是为小程序端预留的契约。
- 公网所需：域名与（国内）ICP 备案、HTTPS 证书、反向代理、`baseUrl` 改公网地址、`secureCookies:true`、`providers.dev.enabled:false`、绑定 `config.admin` 到真实 identity、小程序后台配置 request 合法域名与 `code2Session` 凭据。
- 存储边界：JSON 文件存储 + 本地磁盘上传，**仅适合单进程**；多实例 / 容器无持久卷会丢数据，需要换数据库与对象存储。

## 9. 验收锚点

- `node --check` 对 `server.js` / `public/assets/*.js` / `test/smoke.js` 全部通过。
- `test/smoke.js` 用 `DATA_DIR` 指向临时目录、`PORT` 指向随机空闲端口，启动独立 server 进程，断言 79 项：双站点隔离、管理员账号登录/改密、三模式与背景设置校验、留言板匿名发表/全员可见/删单条/清空、非管理员禁止写内容、上传背景图、原有设置与编排回归
- 前台粒子力场需用 CDP 验证：鼠标经过文字区域时 `__particleProbe().active===true`，且 `__particlePositions()` 中粒子相对目标位置的平均位移显著增大。
- 首页与后台在同一浏览器视口、同一浅色主题下各有 Before/After 截图对比（Before = `particle-demo.html`，After = 新前台）。
