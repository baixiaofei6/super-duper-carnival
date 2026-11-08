# 白小飞的个人博客（本地可运行版）

零 npm 依赖，只用 Node 内置模块。启动前不需要 `npm install`。

## 启动

```bash
cd blog-site
cp config.example.json config.json   # Windows PowerShell: Copy-Item config.example.json config.json
npm start                            # 或 node server.js
```

默认 <http://127.0.0.1:8787/>，后台在 <http://127.0.0.1:8787/admin>。启动成功会打印一行 `READY 8787`。
可用环境变量覆盖：`PORT`、`HOST`、`DATA_DIR`（默认 `blog-site/data`）、`CONFIG_PATH`（默认 `blog-site/config.json`，缺失时回落 `config.example.json`）。

## 这一轮真的做了什么

- `server.js`：HTTP 服务、静态资源、全部 `/api/*` JSON 接口、RSS、只读 `/uploads`、multipart 上传、Cookie 与 Bearer 会话、CORS 开关。
- `public/`：门户前台（暖白底 + 冷蓝科技层；公告、粒子 Hero、1 大 3 小动态、FieldCard 专栏、项目矩阵、状态/链接/关于；文章列表与内页、评论、登录、上传）与 `/admin` 控制台（站点文案/配色/光晕/粒子参数、首页模块显隐与排序、文章/项目/评论/上传/用户角色管理）。
- `lib/{util,store,auth}.js`：沿用工作区里已有的零依赖工具集、JSON 文件存储、身份适配器；身份层把 dev / 小程序 / 微信网页 / QQ 网页换成同一个 `(provider, openid)` 三元组。
- `test/smoke.js`：独立进程冒烟测试，覆盖 health、bootstrap、文章、RSS、dev 登录、me、评论、上传回读、非管理员 403、管理员发文、logout、未知 API 404。

运行自检：`npm test`（或 `node test/smoke.js`）。完整接口见 [API.md](API.md)。

## 配置与本地开发便利规则

- `config.example.json` 里 `providers.dev.enabled=true`：任意昵称即可登录，方便本地体验；**仅第一个用 dev 登录的账号在本地会被当作管理员**（后续 dev 账号是普通用户），因为 `admin.openid` 为空且 dev 开启。这是本地便利规则，不是权限设计。
- `config.json` 不进 Git；`data/`（`data.json` 与上传文件）也不进 Git。
- 微信网页 / QQ 网页 / 小程序登录默认关闭；未配置时前端按钮显示「未配置」并禁用。
- `upload.maxBytes` 默认 20971520 字节，扩展名白名单见 `config.example.json`。

## 面向公网与小程序端：本轮没做到的事

用户后续想要「公网可访问 + 微信小程序端」。本轮**只交付本地可跑通的地基**，没有部署、没有 HTTPS/域名/备案、没有真实微信或 QQ 的 AppID/AppSecret、没有写小程序端代码。不夸大，逐条列清：

| 目标 | 本轮状态 | 还差什么 |
|---|---|---|
| 公网访问 | 未实现 | 域名、（国内）ICP 备案、HTTPS 证书、反向代理、`baseUrl` 改公网地址、`secureCookies:true` |
| 微信小程序端 | 未实现 | 小程序工程、`code2Session` 凭据、头像昵称填写能力、后台配置 request 合法域名（必须 HTTPS） |
| 真实微信/QQ 登录 | 未实现 | 已审核网站应用、回调域名、AppID/AppSecret；`lib/auth.js` 已写好适配器但没有凭据可跑 |
| 会话可用于多端 | **已预留** | `/api/login/dev` 与 `/api/login/mini` 都返回 `sessionId`，服务端接受 `Authorization: Bearer <sessionId>`；浏览器仍用 HttpOnly Cookie |
| 数据持久化 | 仅单进程 | JSON 文件 + 本地磁盘上传；多实例或容器无持久卷会丢数据，公网前建议换数据库与对象存储 |

公网部署前**必须**做：`providers.dev.enabled=false`；把 `config.admin.provider` / `config.admin.openid` 绑定到真实身份（否则 dev 规则失效后没有管理员）；设置 `cors` 为实际需要的值（`true` 时允许任意来源，但跨域不能用 Cookie，只能用 Bearer）；确认 `baseUrl` 与备案信息。

## 诚信边界

- 视觉色板与粒子参数来自 `blog-design.md` 记录的 mimo.mi.com 官网 CSS / JS 字面量核实结果；`particle-demo.html` 是同一套实现的单文件原型。
- 本轮没有 clone / 运行 Fuwari、AstroPaper 等任何开源主题，也没有接入它们的模板；前台是照已核实色板手写的 HTML/CSS/JS。
- `dsh-image-gen/*.png` 是 AI 生成的风格示意图，不是官网截图；本站点页面不含这些图。
- 页面里「登录与上传」已接真实本地接口，**不再是占位示意**；但未配置的第三方登录按钮绝不会假装可用。

## UI 视觉证据

同视口 1440×900、浅色主题下的 Before（`particle-demo.html`）与 After（本站点 `/`、`/#/about`、`/#/notes`、`/admin`）截图在 `.verify/`；打开 `.verify/ui-compare.html` 可并排比较，`.verify/ui-evidence.json` 是 CDP 页面状态、控制台错误与 PNG 像素统计的机器可读记录。注意：它是本地截图，不是公网页面，也不代表小程序端。

## 本轮视觉修订与参照来源（如实说明）

- 用户指定的本地参照 `C:\Users\Administrator\Downloads\小米MiMo Home.html` 已真实读取：484906 B / 245 行，外链 `main.7e1bdd7d.chunk.css`（141899 B）。用到的核实值：`--bg:#fcfaf8`、`--bg-card:#f3ede8`、`max-width:1260px`、Hero `48px/49px`、`border-radius:24px`、`repeat(5,1fr)` / `repeat(3,minmax(0,1fr))` 栅格，以及 CDP 量到的 1260px 主内容宽 / 5909px 密集长页。
- 用户指定的 `http://mrzym.top/#/home` 已真实抓到 HTML（2132 B，标题「小张的个人博客」）、`index-1606a233.css`（886704 B）与 `index-f69c80a8.js`（845804 B）。CSS 核实值：主色 `#49b1f5`、396 处 `linear-gradient`、46 处 `backdrop-filter`、315 处 `box-shadow`、576 处 `animation`。**headless 直开该站返回 chrome-error 错误页**，所以没有它的可用渲染截图；排版/科技感借鉴依据是抓到的 CSS 字面量与 DOM 类名，不是看图猜的。
- 本轮没有 clone / 运行 / 套用 Fuwari、AstroPaper 或 mrzym 的源码；所有 CSS/JS 是照上述核实值手写。站点名已统一为「白小飞的个人博客」。
- 修复「鼠标扫过文字粒子不散开」：原实现把事件绑在 `#hero` 且 canvas `pointer-events:none`，覆盖层会吞事件；改为 window 级 pointermove 命中区域追踪 + 更大的可配置力场（默认半径 170、强度 96）+ 速度拖尾。可在浏览器控制台用 `__particleProbe()` / `__particlePositions()` 复核。
- 后台保存的设置落在 `data/data.json` 的 `settings` / `layout`，重启仍在；`config.example.json` 只是默认值与回退配置。

## 本轮新增：显示模式、独立后台、管理员账号、留言板、背景自定义

- **两个站点**：`npm start` 同时启动主站 `http://127.0.0.1:8787/` 和**独立后台** `http://127.0.0.1:8788/`。主站没有后台入口，`GET /admin` 与所有 `/api/admin/*` 在主站返回 404；后台是单独打开的地址，端口可用 `ADMIN_PORT` 或 `config.adminPort` 改。
- **管理员账号**：首次启动自动创建账号 `白小飞`、密码 `13135566867.`（末尾句点是密码一部分）。密码以 scrypt + 随机 salt 存哈希，不存明文。登录 `POST /api/login/admin`；后台「账号安全」页可改密，旧密码立即失效。**旧的「第一个 dev 用户自动是管理员」规则已废除**；dev 登录只保留在后台站点供未来第三方适配调试，不再是管理员。
- **只有管理员能调整网站内容**：发文、项目、设置、背景、上传、删除、角色、清空留言都要求管理员会话；主站不暴露这些写接口。
- **白天 / 黑夜 / 自动跟随**：主站导航三个按钮。`auto` 跟随系统 `prefers-color-scheme` 并实时响应变化；个人选择存 localStorage；管理员可在后台设置里改站点默认模式 `light|dark|auto`。
- **访客留言板**：`#/guestbook` 与首页留言模块，全员可见；不用登录，填昵称即可发表。管理员可删某条或清空全部。文章评论同样支持匿名昵称。
- **背景自定义与调色**：后台「站点设置」可上传背景图（走 `/api/upload` 得到 `/uploads/xxx`）、填 https 图 URL、清除背景，并调背景色 / 文字色 / 卡片色；主站与后台共用同一套 CSS 变量。
- 启动自检 `npm test`：**79 passed, 0 failed**（临时 DATA_DIR + 随机双端口，覆盖双站点隔离、账号密码、改密、三模式、留言板、背景上传与删除、非管理员 403）。
- **诚实边界**：仍没有公网部署 / HTTPS / ICP 备案 / 真实微信或 QQ OAuth / 小程序端代码；密码与设置存在单进程 `data/data.json`，多实例需数据库。后台是同机不同端口的独立站点，不是独立域名或独立服务器。
