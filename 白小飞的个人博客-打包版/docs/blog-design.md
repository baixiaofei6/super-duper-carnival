# 个人博客设计方案 —— MiMo 风格

> 目标：参考网上成熟案例与 GitHub 高星开源作品，构思一个风格与 https://mimo.mi.com/ 相似的个人博客。
> 本文是**构思/设计方案 + 落地记录**：第一至九章是 2026-11-06~07 的设计与核实记录（保持原样，含当时的判断偏差）；**第十章记录 2026-11-07 本轮真实落地的代码**，两者路线不同，请连同第十章一起读。

---

## 0. 本方案的可信度分层（先说清楚，避免夸大）

用户明确要求：不许在没核实来源的情况下声称「参考/借鉴了某模板或案例」。所以全文所有内容都按下面四类标注，请勿混为一谈：

| 标记 | 含义 |
|---|---|
| **【核实·文本】** | 真实抓取过 URL 的 HTML / README 文本，HTTP 200 |
| **【核实·像素】** | 真实下载过图片并用 Pillow 做过主色/冷暖/对比/明度统计 |
| **【核实·CSS】** | 官网 CSS 文件里的字面量（变量值、字号、色值、字体名） |
| **【核实·JS】** | 官网 JS chunk 里按关键字抽出的字面量（粒子参数、事件名、力场公式）；只抽相关片段，未通读全文、未反编译 |
| **【建议】** | 我给博客做的设计判断或迁移映射，**不是官网原值** |

**没做到的**：本机没有可用的 vision provider，子模型路由也被会话策略挡下，因此**没有用眼睛看过任何页面的构图与文字**；Fuwari 的 Vercel 在线 demo 连不上，用的是它 README 里那张 `home.png`。所有 GitHub 项目**只读过 README、查过 star，没有 clone / 跑起来 / 看源码**。

---

## 一、参考来源与核实记录

### 1.1 风格母本：MiMo 官网首页 【核实·文本 / CSS / 像素】

- `web_fetch https://mimo.mi.com/` → HTTP 200，拿到首页真实 HTML 文本结构（存于 `.verify/mimo-home.html`，298965 B）
- 两个 CSS link：`/static/main.7e1bdd7d.chunk.css`（141899 B）、`/static/docs-styles.7dc771de.chunk.css`（38373 B），已下载到 `.verify/`
- 4 张官网图已下载到 `.verify/` 并做过像素统计（详见第四章 4.5）

**首页栏目结构** 【核实·文本】：
1. 导航：研究 / 模型 / 动态 / 价格 / 联系我们 / 中文 / 使用 MiMo
2. Hero：「你好, 我是MiMo」+「与你同行，探索智能的温度」+ CTA「立即体验 / API 接入 / Token Plan」
3. 最新动态：1 张 featured 大卡 + 3 张小卡
4. 旗舰系列，全新升级：模型卡（名称 + 一句定位 + 「输入缓存命中 / 未命中 / 输出」三行价格）
5. MiMo 产品矩阵：5 条目（标签 + 描述 + 截图）
6. 共建 Agent 生态：纯文字链接组
7. 开发者的声音 / 关于我们：品牌长文案
8. 页脚：二维码 + GitHub / HuggingFace / Discord 图标

> 注意：这是**产品官网**，不是博客。本方案借的是它的「版式语言与气质」，栏目要换成个人博客的内容。

### 1.2 GitHub 高星开源作品 【核实·文本 + star】

star 为 2026-11-07 实测（`img.shields.io/github/stars/<repo>.json` 约数；PaperMod 另由 `api.github.com` 拿到精确值 14030；其余 4 个 API 请求遇 `{"message":"API rate limit exceeded..."}` 403，故改用 shields）。README 均真实抓取过（raw.githubusercontent 或 cdn.jsdelivr.net 兜底）。

| 项目 | star | README 自述要点 【核实·文本】 | 许可证 |
|---|---|---|---|
| `adityatelange/hugo-PaperMod` | 14k（精确 14030） | Hugo，fast/clean/responsive；三种首页模式 Regular / Home-Info / Profile；明暗、Fuse.js 搜索、SEO、cover images、多作者、零 JS 构建依赖 | — |
| `cotes2020/jekyll-theme-chirpy` | 10k | Jekyll 技术写作；置顶 / 层级分类 / 热门标签 / TOC / PWA / 多评论 / Mermaid | MIT |
| `jerryc127/hexo-theme-butterfly` | 8.4k | Hexo 5.3.0+ / Node 18+；卡片式、双栏、阅读模式、字数、评论系统多（Disqus/Gitalk/Valine/Waline/Twikoo/Giscus/Artalk）、特效极多、PWA | Apache 2.0 |
| `satnaing/astro-paper` | 5.2k | 极简 / 可访问 / SEO、明暗、Pagefind、TOC、动态 OG（Satori+Sharp）、i18n、MDX；`pnpm create astro@latest --template satnaing/astro-paper`；Astro v6 + Tailwind v4 重写 | MIT |
| `saicaca/fuwari` | 5.1k | Astro + Tailwind；`pnpm create fuwari@latest`；配置 `src/config.ts`，`pnpm new-post <filename>`，`pnpm dev` at localhost:4321；**可自定义主题色与 banner**、平滑页面过渡、明暗、Pagefind、TOC、RSS、Admonitions、GitHub repo cards、Expressive Code；预览图 `.../fuwari/home.png` | MIT |

### 1.3 成熟个人博客首页 【核实·文本】

- `https://sive.rs/`（Derek Sivers）：纯文字链接式个人门户，me in 10 seconds / newest articles / my books / projects / tweets —— 极简「人」中心的反例参照
- `https://www.ruanyifeng.com/blog/index.html`（阮一峰）：标题 + 文章列表 + 最新留言 + 关于 —— 中文技术博客的朴素范式
- `https://astro-paper.pages.dev/`（demo）：Mingalaba + Featured / Recent Posts —— AstroPaper 的真实首页形态

### 1.4 工具与通道教训（过程记录，非方案内容）

- `web_search` 三次全部 `Error: DeepSeek search has no API key for "DEEPSEEK_API_KEY"` → 全程改走 `web_fetch` 直取真实 URL
- `web_fetch` 间歇 `TypeError: fetch failed` / 30s 超时；`https://fuwari.vercel.app/` 无法连接
- `raw.githubusercontent.com` 超时用 `https://cdn.jsdelivr.net/gh/<owner>/<repo>@<branch>/README.md` 兜底（Fuwari / Chirpy / Butterfly 的 README 靠它拿到）
- `read_image` 报 `model "hy4free" does not declare image input`；`modlens` 无 vision provider；`subagent` 选 `workbuddy/workbuddy` 报 `child LLM route ... not allowed for this Session` → 改用 Pillow 像素统计（脚本 `.verify/analyze.py`）

---

## 二、定位与信息架构

**定位** 【建议】：**产品官网式个人门户** —— 不是「文章流博客」，而是「一个人 = 一个产品」的首页：先亮身份，再用卡片陈列「在写的 / 做过的 / 在别处的」，文章列表退到二级页。气质对齐 MiMo 的「温度感 / 人文 / 低对比暖留白」。

**页面地图** 【建议】：

| 路由 | 内容 |
|---|---|
| `/` | 门户首页（下面第三章的 6 屏） |
| `/notes` | 文章列表（按年 / 标签） |
| `/notes/:slug` | 文章内页（衬线正文 + TOC + 代码块） |
| `/projects` | 项目陈列 |
| `/now` | 「此刻」—— 最近在做什么、在读什么（借鉴 sive.rs 的轻量感） |
| `/about` | 关于 + 品牌长文案 |
| `/links` | 在别处 / 友链（对应 MiMo「共建 Agent 生态」的纯文字链接组） |

---

## 三、首页逐屏结构（把 MiMo 栏目换成个人内容）【建议】

| 屏 | 对应 MiMo 栏目 | 个人博客里放什么 | 组件 |
|---|---|---|---|
| 1 | Hero | 「你好，我是 ___」**粒子文字**（持续运动）+ 一句自我定位 + 打字机副标题 + 两个 CTA（读文章 / 看项目） | `HeroBanner` + `ParticleText` |
| 2 | 最新动态 | 1 张 featured 大卡（最新长文）+ 3 张小卡（短 notes） | `FeaturedCard` × 1、`NoteCard` × 3 |
| 3 | 旗舰系列 | 「我在写的」：把模型卡「名称 + 定位 + 三行字段」抽象成 3–5 个专栏 / 系列卡，字段换成「篇数 / 最近更新 / 状态」 | `FieldCard` |
| 4 | 产品矩阵 | 「我做过的东西」：5 条项目行，标签 + 一句描述 + 截图/链接 | `ProjectRow` |
| 5 | 共建 Agent 生态 | 「在别处」：GitHub / 播客 / 邮件 / 社交的纯文字链接组 | `LinkGrid` |
| 6 | 开发者的声音 / 关于 / 页脚 | 一句品牌文案 + 关于入口 + 页脚小字 | 静态区块 |

> 关键抽象 【建议】：MiMo 模型卡那「三行价格字段」是它最有辨识度的版式。把它抽成通用 `FieldCard`（标题 + 一句描述 + 3 行 `key/value` 等宽字段），既能放专栏、也能放项目、也能放「现在状态」，是「像 MiMo」而不「抄 MiMo」的落点。

---

## 四、视觉系统（重写版，基于核实值）

> 本章**核实值**来自官网 `main.7e1bdd7d.chunk.css` 字面量与 4 张官网图的 Pillow 像素统计；标【建议】的是设计判断，不是官网原值。

### 4.1 色彩：暖奶油白，不是中性灰白

| 角色 | 官网核实值 【核实·CSS】 | 博客迁移 【建议】 |
|---|---|---|
| 页面底 | `#fcfaf8`（`--bg`） | 直接沿用 |
| 卡片底 | `#f3ede8`（`--bg-card`） | 沿用 |
| 边框 / 分隔 | `#f0ebe5`（`--border`） | 沿用 |
| 主文字 | `#000`（`--text-primary`） | **建议**放软到 `#1f2329`（官网 CSS 频次最高的深色，20 次），长文不刺眼 |
| 次级 / 弱文字 | `#666` / `#999` | 沿用 |
| 暗色底 / 卡 | `#0a0a0a` / `#1a1a1a`（`body.dark`） | 沿用 |
| 强调色 | `#fb8147` 珊瑚橙（13 处：文字色、hover 边框、focus outline） | 只用在主按钮、链接 hover、卡片角标、focus ring |
| 强调深态 | `#9e4f0a`、`#B26206` | hover / 按下态 |
| 分类标签底 | `#EBE5DC` `#EDE7DD` `#E8E1D8` `#EEE8E2` `#F5F0E9`（5 张模型卡 inline style，共 10 处）【核实·文本】 | 迁移成文章 / 项目标签的 5 档米色，一张卡只用一档 |

配套中性色（CSS 频次较高）【核实·CSS】：`#fafafa` `#f5f5f5` `#f1f0ed` `#f7f3ef` `#e8e6dc`。**全站不出现第二种高饱和色**。

> 对照：被推翻的旧版用 `#FAFAFA` / `#1A1A1A` / `#FF6900` 都得换掉——前者丢了那点暖偏移，后者偏黄偏饱和，不是这个粉调珊瑚橙。hex 频次 top 还有 `#1f2329`(20) `#e5e5e6`(11) `#dee0e3`(10) `#383a42`(10) `#646a73`(7)。

### 4.2 字体：衬线 + 楷体，才是「温度」的来源

| 场景 | 官网核实值 【核实·CSS】 | 迁移 【建议】 |
|---|---|---|
| 英文 / 数字正文 | `Georgia, serif`（`--font-main`） | 沿用。这是与常见无衬线博客主题最大的区别 |
| 中文正文 | `"PingFang SC", -apple-system, "MiSans", sans-serif`（中文态 / 暗色态 `--font-main`） | 沿用；缺字时降级 `Noto Sans SC`（【建议】，非官网） |
| Hero 中文 | `"LXGW WenKai TC"` 霞鹜文楷，`font-weight:500`，`font-size:48px / line-height:49px`（`.Hero_heroLine__nV0pL`） | 首屏「你好，我是 ___」用楷体，自托管 `LXGWWenKaiTC-Light-subset`。这是 MiMo 不像冷冰冰产品官网的关键 |
| 标题 / 引文 | `Huiwen-MinchoGBK` 汇文明朝体，`font-display:block` | 「关于」页大段文案或区块标题可选；因是 `block`，别用在首屏关键文字 |
| 代码 / 字段值 | `Geist Mono`、`Fira Code`、`inter`、`ui-monospace`（@font-face 列表） | 项目卡三行字段值、代码块 |

不装字体也能到八成 【建议】：Georgia 系统自带，楷体降级 `KaiTi` / `STKaiti`。

### 4.3 字号与排版（全节为【建议】，官网只核实到 Hero `48px/49px`）
- Hero：`clamp(2.25rem, 4vw, 3rem)`，行高 1.05–1.1，居中（官网 `text-align:center`）【核实·CSS】
- 区块标题 `1.5rem`；正文 `16–17px` / 行高 `1.8`；字段值 `13px` 等宽
- 正文左对齐、最大约 `68ch`，靠留白分区而不是靠线条

### 4.4 卡片与形状
- 【核实·CSS】banner：`border-radius:24px`、`max-width:1260px`、`width:calc(100% - 56px)`、shader `height:480px`、`object-fit:cover`；边框 `#f0ebe5` 1px；无渐变；共 38 条 `.Hero_*` 规则
- 【建议】大 banner / featured 卡用 `24px`，内容小卡降到 `12–16px` 拉开层级；分隔用 1px 米色线而非阴影；网格 gutter 统一 `24px`

### 4.5 图片质感：低对比暖自然色 【核实·像素】

| 官网图 | 主色 | 明度 | 冷暖(R−B) | 对比(stddev) |
|---|---|---|---|---|
| `mimo-hero.jpg` 1920×1080 | `#e4e4dc` 占 93.0%，mean `#e1e1d9` | 224.7 | +8.0 | 10.3 |
| `hero-banner-v5-last-frame.jpg` 1280×720 | `#b1c2a4` 豆绿 43.6%，mean `#bbc9b0` | 196.9 | +10.9 | 20.2 |
| `updates_featured-v5.png` 2760×1380 | `#fbfbfa` 76.1% + `#e8e5d8` 14.1% | 243.7 | +4.0 | 18.8 |
| `updates_card-1-v4.png` 948×948 | `#c7cbab` 65% + `#e8e5d7` 20.2% | 208.2 | +25.3 | 13.3 |

结论：官网图几乎纯色、极低对比、暖偏米 / 豆绿，上面叠粒子文字 canvas（`.Hero_particleTextCanvas__nV0pL`），不是照片大字报。【建议】banner 别用高饱和摄影图，用低对比米 / 豆绿纯色或极缓渐变 + 一层细颗粒；缩略图统一压进这个色域。

### 4.6 动效系统：暖色科技感的核心（重写版）

> 早期版本写了「不做粒子背景」，这恰恰把官网最有科技感的部分砍掉了。官网的「温度 + 科技」不是靠静态配色，而是靠**首屏持续运动的 canvas 粒子文字**叠在低对比暖留白上。本章按核实到的 CSS **和主 JS chunk** 重排。

**A. 官网真实存在的动态层** 【核实·CSS / 文本 / JS】

| 层 | CSS / HTML 证据 | 效果 |
|---|---|---|
| 粒子文字 canvas | `.Hero_particleTextWrap__nV0pL{z-index:4;touch-action:pan-y;isolation:isolate;...position:absolute;inset:0;overflow:hidden}`；`.Hero_particleTextCanvas__nV0pL{width:100%;height:100%;display:block;position:absolute;inset:0}`；HTML 里 `Hero_particleTextCanvas__nV0pL` 类名 | **首屏主视觉**：文字由粒子构成 / 粒子随交互漂移，铺满 hero 全屏 |
| 全屏 hero 传送层 | `.Home_heroPortal__0iuvX{z-index:1;pointer-events:none;width:100%;height:100vh;position:absolute;top:0;left:0}` | hero-portal 容器，承载上面那层全屏动画 |
| 打字机 | `.Hero_heroTypingCursor__nV0pL{...animation:1s step-end infinite Hero_heroCursorBlink__nV0pL}`；`.Hero_heroBlinkUnderscore__nV0pL` 同动画；`.Hero_heroLineSlot__nV0pL{display:grid}` + sizer/typing 同 `grid-area:1/1` | 逐字出现 + 闪烁光标；用隐藏 sizer 撑住布局，避免跳动 |
| Banner 序列 / 视频 | `.Hero_heroBannerShader__nV0pL{width:100%;height:480px;position:relative;overflow:hidden}`；内含 `picture` 与 `video{object-fit:cover;position:absolute;inset:0}`；HTML 有 `hero-banner-v5-poster.jpg`(静帧) 与 `hero-banner-v5-last-frame.jpg`(末帧) | banner 不是静态图，是**静帧 → 视频 / 帧序列**的动效，响应式高度 480/380/290/240 |
| 滚动显现 | `.reveal{opacity:0;transform:translateY(60px);transition:opacity .8s cubic-bezier(.16,1,.3,1),transform .8s ...}`、`.reveal.visible{opacity:1;transform:translateY(0)}`；首页 HTML 大量 `<div class="reveal">` | 每个 section 进视口时上浮淡入（0.8s 缓出），是全站节奏骨架 |
| 按钮 / 手风琴 / 跑马灯 | `.HeroButtons_heroButtonsFadeIn__nYLVb`、`@keyframes Products_pmDescFadeIn__fNrXd{...}`、`animation:.2s .35s both ...`、`banner_banner-scroll__XHu87` 20s linear infinite、`transition:flex .5s cubic-bezier(.23,1,.32,1)`（手风琴） | 入场错峰、产品矩阵展开、顶部公告无限滚动 |
| 自定义光标 | `.cursor-ring{z-index:99999;pointer-events:none;will-change:left,top;border:1px solid #000;border-radius:50%;width:32px;height:32px;transition:width .5s ...;position:fixed;transform:translate(-50%,-50%)}` | 跟随鼠标的细圆环，hover 可放大 |
| 玻璃拟态点缀 | `.Hero_versionBtn__nV0pL{backdrop-filter:blur(8px);background:rgba(82,110,62,.1);border-radius:999px}` | 豆绿半透明小胶囊按钮 |

11 个 `@keyframes` 里确认：`Hero_heroCursorBlink__nV0pL`、`HeroButtons_heroButtonsFadeIn__nYLVb`、`Products_pmDescFadeIn__fNrXd`、`banner_banner-scroll__XHu87`、`accordion-down/up`、`collapsible-down/up`、`caret-blink`、`enter`、`exit`。

**A2. 鼠标反馈的原始实现（用户明确要的「随鼠标方向改变」）** 【核实·JS】

从官网主 JS chunk `main.4ebebaedca084626.chunk.js`（609383 B，已下载到 `.verify/main.chunk.js`）里按关键字抽出粒子组件 `eZ({text,onLayout})` 的实现。**这是字面量，不是猜测**：

| 项 | 官网 JS 原文 / 值 |
|---|---|
| 粒子文字实际内容 | `(0,n.jsx)(eZ,{text:"V2.6",onLayout:...})` —— 粒子层显示的是版本号 **"V2.6"**（衬线 Amiri），**不是**中文 Hero 标语；中文标语是 DOM 里的打字机文字。这一点我前几版理解错了 |
| 采样字体 / 颜色 | `let eR="#3e4f2a",eQ="Amiri, serif"`；离屏 canvas `fillStyle="#fff";fillText(...)`，再 `getImageData` 取 alpha `i>40` 的点 |
| 粒子数上限 | `L=Math.max(900,Math.min(5200,Math.floor(m*h/90)))`（按画布面积自适应，900–5200），步长 `E=Math.ceil(S.length/L)` 抽样 |
| 每个粒子初始态 | 散点半径 `s=180*(.35+.75*o)`、随机角 `l=n*Math.PI*2`、`delay=420*seed`、`size:1.8`、颜色在 `#2d3a1e` 与 `#3e4f2a` 间插值（豆绿系，非珊瑚橙——珊瑚橙是我给博客的迁移色） |
| 入场缓动 | `r=1-(1-a)**3`（easeOutCubic），`a=clamp((t-p-i.delay)/1600,0,1)`，1600ms 汇聚成字 |
| 空闲呼吸 | `n+=.15*Math.sin(.9*t+10*i.seed)*i.depth`；`o+=.15*Math.cos(.75*t+10*i.depth)*i.depth` |
| **指针平滑跟随** | `g.sx+=(g.x-g.sx)*.18; g.sy+=(g.y-g.sy)*.18`（`g.x/g.y` 由 `pointermove` 的 `clientX-rect.left` 实时写入）——这就是「随鼠标方向改变」的惯性来源 |
| **指针力场（核心）** | `if(g.active){let e=i.x-g.sx,t=i.y-g.sy,a=Math.hypot(e,t);if(a<120&&a>.1){let i=(1-a/120)*40;n+=e/a*i,o+=t/a*i}}` —— 半径 **120px**、强度 `(1-d/120)*40`，沿「粒子−平滑光标」方向推开，越近推力越大 |
| 位置收敛 | `i.x+=(n-i.x)*.55; i.y+=(o-i.y)*.55`；`globalAlpha=.35+.65*a`；`size<=2.1` 用 `fillRect` 否则 `arc` |
| 事件绑定 | `pointerdown/pointermove/pointerleave/pointerup/pointercancel`；`pointermove` 里 `if("mouse"===e.pointerType){b(e),g.active=!0;return}`；`pointerleave` 时 mouse 失活 → 鼠标进入即生效、离开即停 |
| reduced-motion | `let l=...matchMedia("(prefers-reduced-motion: reduce)").matches`；为真则 `c=l?null:requestAnimationFrame(M)` 停掉循环、粒子直接落位。**官网有这个判断，在 JS 里不在 CSS** —— 更正我上一版写的「官网 CSS 里没有」 |

> 结论：所谓「随鼠标方向改变」，官网的真实机制是**平滑光标 (`g.sx/g.sy`) + 120px 半径的径向排斥力场**，粒子沿远离光标的方向被推开，且光标位置带 `.18` 惯性所以会拖出方向感。不是简单的「鼠标划过变色」。可运行原型 [particle-demo.html](<particle-demo.html>) 已按这套参数复刻。

**B. 博客里的迁移清单** 【建议】

1. **粒子文字 Hero（必做，最高优先级）**：把「你好，我是 ___」做成 canvas 粒子文字——离屏 canvas 采样楷体字形像素 → 生成粒子目标坐标 → 粒子从随机散点汇聚成字 → **鼠标扫过时按 A2 的 120px 力场朝远离光标的方向散开，且带 `.18` 惯性拖出方向感**（用户本轮明确要求「随鼠标方向而改变」）→ 空闲时缓慢呼吸漂移。颜色用墨黑 `#1f2329` + 少量珊瑚橙 `#fb8147` 粒子，底色仍是 `#fcfaf8`。这是「暖 + 科技」的关键，不能用一张静态大字图代替。
2. **Banner 动效**：低对比豆绿/米色底上做一层缓慢横向光扫 / 极缓色相流动，或用短循环视频（对应官网 poster→video 序列），保持 4.5 的低对比约束。
3. **滚动显现**：所有 section 套 `.reveal`，`translateY(60px)→0` + `0.8s cubic-bezier(.16,1,.3,1)`；卡片按索引错峰 `0.05s`。
4. **打字机 + 自定义光标环**：Hero 副标题逐字出现；全站细圆环光标，hover 可交互元素时放大。
5. **微交互**：主按钮 hover 位移 + 柔光（官网 `transition:transform .2s,box-shadow .2s`）、项目手风琴展开、顶部可关闭公告条 20s 滚动。

**C. 性能与可访问性护栏** 【建议，部分核实】
- canvas 粒子数按屏宽自适应（官网 `L=clamp(900,5200,W*H/90)` 【核实·JS】），移动端降到 1/3；`requestAnimationFrame` 在页面不可见时暂停
- **官网已有 `prefers-reduced-motion` 判断，在 JS 里**（`matchMedia(...).matches` → 停 rAF、粒子直接落位）【核实·JS】；CSS 里再加 `@media (prefers-reduced-motion: reduce)` 兜住打字机 / 滚动显现 / 光标环 —— 更正我上一版写的「官网没有，我要补」，那句话不准确
- 始终保留一份静态 HTML 文字（官网 `html[data-js] .Hero_heroLineSizer__nV0pL{opacity:0}` 的做法：JS 未执行时内容仍可见），保证 SEO 与无 JS 可读
- 粒子层 `pointer-events:none`，别挡住导航与 CTA（官网 `.Hero_particleTextWrap` 用 `touch-action:pan-y` 保留触屏滚动）

**D. 可运行原型**：[particle-demo.html](<particle-demo.html>) —— 单文件、浏览器直接打开；粒子参数逐条对应 A2 的官网 JS 字面量，`node --check` 通过。勾选「显示 120px 力场」可看到鼠标的排斥范围。**注意**：原型里的登录/上传是前端占位，不是真实功能（见第八章）。

**E. 动态示意图**：`dsh-image-gen/image-4b192fbd.png` 是「粒子文字 + 光弧 + banner 光扫」的**单帧风格示意**（AI 生成，非官网截图）。
### 4.7 明暗双主题
- 【核实·CSS】`--bg #fcfaf8 → #0a0a0a`、`--bg-card #f3ede8 → #1a1a1a`，强调色暗色下仍是 `#fb8147`
- 【建议】暗色下把米色系换成低饱和暖灰，别直接反相

### 4.8 与 Fuwari 骨架的关系（修正早期结论）
Fuwari README 那张 `home.png` 【核实·像素】：2954×1812，`#f5f7f9` 43.3% + 蓝系 `#4c6a96`(15.2%) / `#6f99c7` / `#94b0d3` / `#364e74` / `#21324e` / `#131d30`，mean `#97a7bd`，冷暖 **−37.3**、对比 **86.5** —— 冷蓝高对比，与官网暖低对比相反。

> **Fuwari 只当结构骨架**（README 自述可自定义主题色与 banner、平滑过渡、卡片化），配色与字体按 4.1 / 4.2 整体重做；**不能说「长得像」**。

---

## 五、内容模型与组件 【建议】

```
src/
  config.ts                  # 站点名、Hero 文案、导航、社交链接、主题色
  content/
    posts/*.md               # 文章（frontmatter: title/date/tags/featured）
    projects/*.md            # 项目（frontmatter: name/desc/fields/screenshot）
  pages/
    index.astro  notes/  projects/  now/  about/  links/
  components/
    HeroBanner.astro         # 楷体大字 + CTA + 低对比 banner
    ParticleText.astro       # canvas 粒子文字 Hero（离屏采样字形 → 粒子汇聚/漂移 + 120px 鼠标力场 + reduced-motion 回退）
    Reveal.astro             # IntersectionObserver 滚动显现（translateY(60px)→0, .8s）
    CursorRing.astro         # 跟随鼠标的细圆环光标
    FeaturedCard.astro       # 1 大 + 3 小文章卡
    FieldCard.astro          # 「标题 + 一句描述 + 3 行 key/value」通用卡（核心抽象）
    ProjectRow.astro         # 标签 + 描述 + 截图
    LinkGrid.astro           # 纯文字链接组
    LoginPanel.astro         # 微信 / QQ 登录按钮 + 登录态头像昵称（依赖 BFF，见第八章）
    Uploader.astro           # 拖拽 / 选择上传 + 本地预览 + 接 /api/upload（见 8.6）
  server/ (BFF)
    auth/wechat.ts  auth/qq.ts  upload.ts  db/users.ts
```

---

## 六、技术选型 【建议，依据 1.2 的 README 核实】

| 方案 | 适用 | 做法 |
|---|---|---|
| **主推** | 有 Node、想要现成卡片 / 搜索 / 明暗 | Astro + **Fuwari 骨架**（`pnpm create fuwari@latest`），文章内页参考 **AstroPaper** 的极简排版；按第四章整体重做配色与字体 |
| 备选 A | 想更轻、更少魔法 | 纯 **AstroPaper**（`pnpm create astro@latest --template satnaing/astro-paper`），自己加首页门户屏 |
| 备选 B | 零 Node / 只想静态 | **Hugo + PaperMod** 的 `Profile` 首页模式，手工套暖奶油白色板 |

理由：Fuwari / AstroPaper 都是 Astro，天然静态、SEO / RSS / Pagefind 搜索 / TOC / 明暗齐全（README 自述），改造成本主要在「把冷蓝主题换成暖奶油白 + 衬线楷体」。

> ⚠️ **重要更正（本轮新增需求后）**：上面三套都是**纯静态**方案，能做出粒子文字、卡片、文章，但**做不了微信/QQ 登录与图片/文件上传**——这两件事必须有服务端、用户库、对象存储和 OAuth 回调。所以一旦要落地登录/上传，技术栈要从「纯静态博客」升级成「**静态前台 + 一层服务端能力**」，具体见第八章。这不是换个主题就能解决的，别被前几版的静态选型带偏。

---

## 七、落地路线（原计划，已被第十章的落地路线取代；保留作决策记录）

1. 清掉临时目录 `.verify/`（或保留作核实证据）
2. 定站点名 / Hero 文案 / 社交链接 → 填 `src/config.ts`
3. 起 Astro + Fuwari 骨架，按第四章写一套 `theme.css`（CSS 变量覆盖）
4. 做 `FieldCard` 等组件 + 首页 6 屏；**优先实现 `ParticleText`（粒子文字 Hero，含 A2 鼠标力场），这是「像 MiMo」的决定性一层**
5. 补 `Reveal` 滚动显现、打字机、`CursorRing`、banner 光扫 / 短循环视频
6. 明暗双主题、Pagefind 搜索、RSS、`prefers-reduced-motion` 回退
7. **登记开发者资质**：微信开放平台网站应用 + QQ 互联开发者，备好 ICP 备案域名与官网内容（见 8.7）——这一步周期最长，建议提前并行
8. **搭服务端 BFF**：OAuth 回调、token 交换、拉昵称头像、下载头像入对象存储、用户表、会话、上传接口（见 8.5 / 8.6）
9. 前台接登录态（顶部头像 + 昵称）、上传控件接真实接口
10. 部署：前台静态 + BFF / Serverless；国内域名走备案

---

## 八、登录与上传（本轮新增需求）

### 8.1 先说结论（不夸大）

- **技术上可行**：微信、QQ 官方都提供 OAuth 登录，并且都返回**昵称 + 头像**，你要的「直接用微信/QQ 的头像和名字」有官方接口支撑。
- **但纯静态博客做不到**：登录（AppSecret 换 token、回调、用户库）和上传（对象存储、鉴权）都必须有服务端。第六章三套方案是纯静态，需升级成「静态前台 + 一层服务端」，见 8.5。
- **门槛不低**：两家都要求注册开发者 → 创建**审核通过的网站应用** → 备案域名 / 授权回调域名。微信侧还有个人开发者额外材料与官网内容规范。
- **本轮没实现真实登录/上传**：[particle-demo.html](<particle-demo.html>) 里的登录按钮与上传区是**前端占位**，按钮只弹提示、文件只在浏览器本地预览、刷新即失效。

### 8.2 微信「网站应用」登录 【核实·文本】

来源：[网站应用微信登录开发指南](https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Wechat_Login.html)、[授权后接口调用（UnionID）](https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Authorized_Interface_Calling_UnionID.html)、[应用审核规范](https://developers.weixin.qq.com/doc/oplatform/Website_App/operation.html)（均 HTTP 200）。

| 项 | 官方原文 / 值 |
|---|---|
| 前置条件 | 「在微信开放平台注册开发者账号，并拥有一个**已审核通过的网站应用**，并获得相应的 AppID 和 AppSecret，**申请微信登录且通过审核后**，可开始接入流程」 |
| 协议 | 「网站应用微信登录是基于 OAuth2.0 协议标准构建的微信 OAuth2.0 授权登录系统」 |
| 授权 URL | `https://open.weixin.qq.com/connect/qrconnect?appid=APPID&redirect_uri=REDIRECT_URI&response_type=code&scope=SCOPE&state=STATE#wechat_redirect`；`scope` 目前只填 `snsapi_login` |
| 回调域名 | 「redirect_uri 的域名与审核时填写的授权域名不一致或 scope 不为 snsapi_login」会提示「该链接无法访问」 |
| state | 官方写明「用于保持请求和回调的状态……**可以用于防止 csrf 攻击**」 |
| code | 「code 的超时时间为 10 分钟，一个 code 只能成功换取一次 access_token 即失效」 |
| 换 token | `GET https://api.weixin.qq.com/sns/oauth2/access_token?appid=APPID&secret=SECRET&code=CODE&grant_type=authorization_code`；返回 `access_token` / `expires_in`(7200) / `refresh_token`(30 天) / `openid` / `scope` / `unionid` |
| 拉用户资料 | `GET https://api.weixin.qq.com/sns/userinfo?access_token=ACCESS_TOKEN&openid=OPENID`；返回 `openid`、`nickname`、`sex`、`province`、`city`、`country`、**`headimgurl`**、`privilege`、`unionid` |
| 头像规格 | 「用户头像，最后一个数值代表正方形头像大小（有 0、46、64、96、132 数值可选，0 代表 640×640 正方形头像），用户没有头像时该项为空」 |
| 快速登录 | 微信 3.9.11 for Windows / 4.0.0 for Mac 及以上，若 PC 客户端已登录且未锁定，会优先提示用当前账号快速登录 |

### 8.3 QQ 互联登录 【核实·文本】

来源：[网站应用接入概述](https://wiki.connect.qq.com/%e7%bd%91%e7%ab%99%e5%ba%94%e7%94%a8%e6%8e%a5%e5%85%a5%e6%b5%81%e7%a8%8b/)、[成为开发者](https://wiki.connect.qq.com/%e6%88%90%e4%b8%ba%e5%bc%80%e5%8f%91%e8%80%85/)、[API 列表](https://wiki.connect.qq.com/api%e5%88%97%e8%a1%a8/)、[get_user_info](https://wiki.connect.qq.com/get_user_info)（均 HTTP 200）。

| 项 | 官方原文 / 值 |
|---|---|
| 接入路径 | 「注册开发者 → 创建应用 → **通过审核并获取接口权限**」；「按要求提交**公司或个人**的基本资料……通过审核即可成为开发者」 |
| 网站应用流程 | 准备工作_OAuth2.0 → 放置「QQ登录」按钮 → 获取 Access_Token → 获取用户 OpenID → OpenAPI 调用说明 |
| 用户资料接口 | `GET https://graph.qq.com/user/get_user_info?access_token=***&oauth_consumer_key=12345&openid=***`，JSON，需鉴权 |
| 返回字段 | `ret`、`msg`、`nickname`（QQ 空间昵称）、`figureurl`(30×30)、`figureurl_1`(50×50)、`figureurl_2`(100×100)、`figureurl_qq_1`(40×40)、`figureurl_qq_2`(100×100)、`gender` 等 |
| 头像可用性 | 官方注：「不是所有的用户都拥有 QQ 的 100×100 的头像，但 **40×40 像素则是一定会有**」 |
| 官方预期效果 | 接入概述明确写「用户授权后成功登录网站，在网站上显示**用户登录昵称与 QQ 头像**」「建议网站在首页或顶部显示用户通过 QQ 账号的登录状态，包括用户昵称、QQ 头像」——正是你要的效果 |
| 其它 | 开发者 QQ 号「一旦注册不能变更」；WIKI 有 2026-10-30「QQ互联登录 JS SDK 支持 CDN 接入」更新；另有 2018 头像 URL 域名变更、2023 头像系统架构优化的历史通知 |

### 8.4 「直接用头像和名字」的三个坑 【核实·文本 + 建议】

1. **头像 URL 会失效，必须自己存图片**。微信官方明确写：「在用户修改微信头像后，旧的微信头像 URL 将会失效，因此开发者应该**自己在获取用户信息后，将头像图片保存下来**」；QQ 侧也有头像 URL 域名变更 / 系统架构调整的历史通知。所以不能只把 `headimgurl` / `figureurl_qq_2` 存进数据库了事，要下载到自己存储。
2. **微信不再返回性别与地区**。官方：「Open 平台授权接口将不再返回用户性别及地区信息，能力调整已于 2021 年 10 月 20 日 24 时生效」。昵称和头像仍在，不影响本次需求，但别的地方别指望。
3. **敏感凭据不能进前端**。【建议】`AppSecret` 只放服务端，`code → access_token` 的交换必须在服务端做；`state` 按官方建议用于防 CSRF；会话用 HttpOnly + Secure Cookie。

### 8.5 建议架构 【建议】

```
浏览器 (Astro 静态前台)
   │ 点击「微信登录」/「QQ 登录」
   ▼
跳转官方授权页 (qrconnect / QQ OAuth) ──回调 code──▶ 服务端 BFF
   │                                                   │
   │                                    ├─ code + AppSecret 换 access_token
   │                                    ├─ 拉 nickname / headimgurl
   │                                    ├─ 下载头像 → 对象存储，得到 avatar_key
   │                                    ├─ upsert users(provider, openid, unionid, nickname, avatar_key)
   │                                    └─ 签发会话 Cookie
   ▼
顶部导航显示 头像 + 昵称
```

- 服务端 BFF 可用 Cloudflare Workers / Vercel Serverless / 一台 Node；前台仍保留 Astro 静态输出。
- 用户表用 `(provider, openid)` 作唯一键；微信侧可用 `unionid` 在同一开放平台账号下打通多个应用（官方建议「开发者最好保存用户 unionID 信息」）。
- 上传接口与登录共用同一套会话鉴权。
- **待确认的关键分叉**：登录是给**访客**（评论 / 留言 / 上传）用，还是只给**你自己**（后台发文章）用？这决定要不要做权限分级、要不要公开注册。见 8.8。

### 8.6 图片与文件上传 【建议】

| 层 | 做法 |
|---|---|
| 存储 | 对象存储（Cloudflare R2 / S3 / 腾讯云 COS）或服务器本地磁盘 + 静态目录 |
| 接口 | `POST /api/upload`，要求登录态；校验 MIME / 扩展名 / 大小上限；随机文件名防覆盖；图片生成缩略图与压缩（WebP） |
| 前台 | 拖拽 / 选择 → 本地预览 → 上传 → 拿到 URL → 插入文章 Markdown；失败可重试 |
| 内容模型 | 文章 frontmatter 里存 `images: []` / `attachments: []`，或直接在正文引用返回的 URL |
| 安全 | 限制上传者、扫描文件类型、不允许可执行扩展名、对外只读 URL |

> 原型里的 `<input type="file" multiple>` 只做 `URL.createObjectURL` 本地预览，**没有上传**，面板里已写明。

### 8.7 资质与合规清单 【核实·文本 + 建议】

微信审核规范里跟个人博客直接相关的硬要求：
- 官网需「规范，包括应用提供的服务功能详情、**用户协议**、版权所有者、**网站备案信息**、联系方式」，且「不支持提供手机端小程序、公众号和 H5 等页面类型」
- 「官网不得是无法访问应用详细信息的登录界面」；「官网内容仅是一张图片」会被驳回；官网需含「应用名称字眼及其应用介绍、应用图片、服务功能详情」
- 「服务类目有分**个人类目与非个人类目**」「部分类目需……完成**开发者资质认证**后才可选择」
- 个人开发者未认证主体时申请已上架应用：「附上**软件著作权证书以及手持身份证照片**」
- 《微信开放平台网站信息登记表》：「备案号需填写规范，正确的备案号格式示例：粤ICP备XXX号」
- 【建议】头像 / 昵称属个人信息：需隐私政策、告知并取得同意、提供解绑 / 注销；QQ 侧同样有《QQ互联SDK隐私保护声明》

### 8.8 需要你先定的四件事【第 1、4 项已确认，2、3 项仍未定；见第十章】

1. 登录给**访客**（评论/上传）还是只给**你自己**（后台）？
2. 部署地域：国内域名需 ICP 备案（微信审核明确要求备案号），会直接影响 OAuth 回调能否通过。
3. 是否已有备案域名、微信开放平台账号、QQ 互联开发者账号？
4. 上传的文件是对外公开，还是仅自己后台管理用？

---

## 九、诚信边界小结（仅覆盖第一至八章；第十章另记本轮）

- ✅ 真实抓过：MiMo 首页 HTML / CSS、4 张官网图、5 份 GitHub README + star、3 个成熟博客首页文本、Fuwari `home.png`、**官网主 JS chunk**（609383 B）、**微信开放平台 3 个页面 + QQ 互联 5 个页面**
- ✅ 真实做过：Pillow 像素统计、CSS 字面量提取、官网 CSS 动效规则提取（11 个 `@keyframes`、`.reveal`、粒子/shader/portal/cursor-ring）、**官网 JS 粒子实现与鼠标力场公式提取**、微信/QQ 官方接口与审核条款抽取、原型 `node --check` 语法校验
- ❌ 没做过：用眼睛看构图与文字（无 vision provider）、clone / 运行任何开源项目、访问 Fuwari 在线 demo、**通读官网 JS 源码**（只按关键字抽出相关片段，未反编译）、**真实接入微信/QQ 登录或上传**（无 AppID/AppSecret、无服务端、无备案域名）
- ⚠️ 第四章 4.6 的 A / A2 段是【核实·CSS/JS】，B/C/E 段与其余章节是**设计判断与迁移建议**，不是官网或任何开源项目的原值；第八章的接口与条款是【核实·文本】，架构与清单是【建议】
- ⚠️ 两张示意图 `dsh-image-gen/image-358d7f58.png`（静态版）与 `dsh-image-gen/image-4b192fbd.png`（动态单帧版）都是 AI 生成的**风格示意，不是官网截图**；图里的站点名「林间」与中文文字是占位示例，模型生成的中文可能不准，只用于看配色 / 字体气质 / 动势 / 版式的整体观感
- ⚠️ [particle-demo.html](<particle-demo.html>) 是**单文件可运行原型**：粒子动效是真的（参数对应官网 JS 字面量），登录与上传是**占位示意**，不代表功能已实现


---

## 十、本轮落地记录（2026-11-07，真实执行）

> 用户确认（m00086）：「按推荐，我后续想法是一个能够在公网访问且有微信小程序端的个人博客网站」。
> 按推荐 = 补完 `blog-site/` 为可本地跑通的最小站点；登录 = 访客可登录 + 单一管理员；前台开放评论/上传。
> 「公网 + 小程序端」被明确记为**后续愿景**，本轮未实现，但 API 契约按多端预留。

### 10.1 技术路线的实际偏差（重要）

第七章原计划是「Astro + Fuwari 静态前台 + 一层 BFF」，第六章三套静态方案也是按这个前提选的。**本轮没有走那条路**。工作区在 04:10 之后另起了一套零依赖 Node 自包含应用 `blog-site/`（`config.example.json` + `lib/{util,store,auth}.js`），本轮沿它补完：同一个 Node 进程同时提供前台静态页与全部 `/api/*` JSON 接口，没有 Astro、没有 Fuwari、没有 clone 或运行过任何开源主题。

理由（当时判断）：骨架已存在且把「资质依赖」解耦成 dev / 小程序 / 微信网页 / QQ 网页四种身份适配器，复用成本最低；先做能跑通的闭环比先搭静态站再补 BFF 更直接。**代价**：放弃了 Fuwari/AstroPaper README 自述现成的 Pagefind 搜索、TOC、RSS、Markdown 构建链，本轮 RSS 是自己写的，搜索与 TOC 没有做。这是取舍，不是两边都做了。

### 10.2 真实新增/修改的文件

| 文件 | 内容 | 行数 |
|---|---|---|
| `blog-site/API.md` | Lead 冻结的服务端／前端／测试唯一接口契约 v1 | 97 |
| `blog-site/server.js` | 零依赖 HTTP 服务、静态资源、全部 API、RSS、multipart 上传、Cookie + Bearer 会话、CORS、管理员判定 | 446 |
| `blog-site/public/index.html` | 门户前台单页（hash 路由：首页 / 文章 / 文章内页 / 项目 / 关于） | 97 |
| `blog-site/public/admin.html` | 后台管理页 | 57 |
| `blog-site/public/assets/app.css` | 沿用第四章核实色板的共用样式 | 92 |
| `blog-site/public/assets/app.js` | 前台数据渲染、路由、登录态、评论、上传、reveal | 225 |
| `blog-site/public/assets/admin.js` | 后台登录、概览、发文、项目、上传 | 104 |
| `blog-site/public/assets/particle.js` | 从 `particle-demo.html` 抽出的粒子 Hero（120px 鼠标力场），参数化文案并增加 destroy/resume | 159 |
| `blog-site/test/smoke.js` | 独立进程端到端冒烟测试，临时 DATA_DIR + 随机端口 | 194 |
| `blog-site/package.json` / `README.md` / `.gitignore` | 启动脚本、如实说明、忽略 `data/` 与 `config.json` | — |

`lib/{util,store,auth}.js` 与 `config.example.json` **未改动**，全部复用。`.verify/` 核实证据保留未清理；`particle-demo.html` 与 `dsh-image-gen/*.png` 保留作原型与示意图。

### 10.3 真实跑通的验证

- `node --check` 对 `server.js` / `public/assets/{app,admin,particle}.js` / `test/smoke.js` 全部通过。
- `npm test`（`node test/smoke.js`）：**36 passed, 0 failed**。覆盖 health / bootstrap / 文章列表与详情 / RSS / dev 登录 / Bearer / me / 资料校验 / 评论 / 上传与文件回读 / 管理员发文与建项目 / **第二个 dev 用户被拒 403** / logout / 未知 API 404 / 前后台页面与静态资源 / 路径穿越拒绝。
- 期间修掉七个真实缺陷：`server.js` 漏 `require('fs')` 与 assets 路径映射错误、重复 Location 头；本地管理员规则原本把所有 dev 用户都当管理员，收紧为**仅第一个 dev 用户**，并同步改了 `API.md` 与 `README.md`；`app.js` 的 `showPost()` 完成后又调 `route()` 会无限递归发请求；`reveal()` 每次路由新建 observer 并无条件加 `visible`，让滚动显现动画失效（改为一次性 `initReveal()` + reduced-motion 直接可见）；`particle.destroy` 未解绑事件与定时器；favicon 404；
  - `test/smoke.js` 的 `ROOT` 原为 `__dirname` 导致 `Error: Cannot find module ...\blog-site\test\server.js`，改为 `path.resolve(__dirname,'..')`。

### 10.4 为「公网 + 小程序端」预留了什么、还差什么

**本轮已做**（`API.md` §1、§3、§8）：所有 `/api/*` 只返回 JSON；dev / mini 登录都返回 `sessionId`；服务端接受 `Authorization: Bearer <sessionId>`（浏览器仍用 HttpOnly Cookie）；保留 `/api/login/mini` + `/api/profile` 给小程序补昵称头像；`config.cors` 开关；`config.baseUrl` / `secureCookies` 可切公网。

**本轮没做，不夸大**：没有公网部署、没有域名 / HTTPS / ICP 备案、没有真实微信或 QQ 的 AppID/AppSecret、没有写任何小程序端代码、没有对象存储（上传是本地磁盘 + JSON 文件存储，**仅适合单进程**）。公网前必须 `providers.dev.enabled=false` 并把 `config.admin` 绑定到真实 identity，否则本地便利规则会让权限失守。逐条清单见 `blog-site/README.md`。

### 10.5 本轮未解决的验收缺口

- **Before/After 可视化证据已补齐**（同视口 1440×900、同浅色主题）：browser 插件连不上 `127.0.0.1:9222`、`read_image` 报 `model "hy4free" does not declare image input`、modlens vision bridge 超时，所以改用直连 Edge 的 CDP `Page.captureScreenshot`。截图存 `.verify/{before-home,before-about,after-home,after-about,after-notes,after-admin}.png`，对比页 `.verify/ui-compare.html`，机器可读证据 `.verify/ui-evidence.json`。
  - 同场景对比：首屏 Before `particle-demo.html` vs After `/`；登录/上传面板 Before `particle-demo.html#about` vs After `/#/about`（dev 登录后同页）。另附文章列表与后台截图。
  - 六张截图均为 1440×900，控制台 / 异常 / 资源日志**零 error**；首屏主色 `#fcfaf8` Before 82.9% → After 82.8%、强调色 `#fb8147` 均 0.5%，Hero 区域非底色像素 1.05% → 1.13%（粒子层已渲染），色板与原型一致。
  - "After · /#/about" 显示「截图验收 · 管理员」与真实登录态，不再是「登录与上传为前端占位示意」；后台 `/admin` 显示「已登录：截图验收（管理员）」与可用概览，`work-panel` 可见。**诚实边界**：当前模型不能直接看图像、modlens 超时，所以视觉判断依据是 CDP 页面 DOM/文本快照 + 自写 PNG 解码后的客观像素统计，不是人眼逐像素核对构图。
  - 过程中修掉 favicon 404：两页内联 `<link rel="icon" href="data:,">`。
- 没有真实接入微信/QQ/小程序登录（无凭据与备案域名），前端未配置的 provider 按钮一律显示「未配置」并禁用，不会假装可用。
- 未做搜索、TOC、Markdown 写作链、深色主题（第四章设计了但未落地）。

### 10.6 对用户原始约束的遵守

- 没有声称「参考/借鉴了 Fuwari、AstroPaper 等模板」——本轮没有 clone、没有运行、没有使用它们的任何代码；前台是按第四章已核实的官网 CSS 字面量手写的。
- 色板与粒子参数的来源是 `.verify/` 里真实下载过的官网 CSS / 主 JS chunk 字面量，属于【核实·CSS/JS】；把栏目换成个人博客内容仍是【建议】。
- 以上「做到 / 没做到」逐项如实列出，不含未核实的案例背书。


---

## 十一、视觉与后台自定义修订（2026-11-07 第二轮，真实执行）

> 用户原话（m00379）：「把鼠标扫过文字 → 粒子会朝远离光标的方向散开没有做到，网站背景太素，内容分布太稀散，http://mrzym.top/#/home @"C:\Users\Administrator\Downloads\小米MiMo Home.html" 参照这两个的排版和科技感给我修改一下，同时网站名称改为白小飞的个人博客，后台自定义功能更广阔一点」。

### 11.1 参照来源的真实核实（先抓到才动手）

- 本地 `C:\Users\Administrator\Downloads\小米MiMo Home.html`：484906 B / 245 行，标题「小米MiMo Home」；外链 `小米MiMo Home_files/main.7e1bdd7d.chunk.css`（141899 B）、`docs-styles.7dc771de.chunk.css`（38373 B）；34 个 style 块、2 个 canvas。CSS 实值：`--bg:#fcfaf8`、`--bg-card:#f3ede8`、`--font-main:Georgia, serif`、`.Hero_hero__nV0pL{width:90%;max-width:1260px;text-align:center}`、`.Hero_heroLine{font-size:48px;line-height:49px}`、`.Hero_particleTextCanvas{position:absolute;inset:0}`、`.Models_modelCard{border-radius:24px}`、`grid-template-columns:repeat(5,1fr)` / `repeat(3,minmax(0,1fr))`。CDP 量到 `Home_homePage` 1430×5909、`Hero` section [85,94,1260,303]、`Home_homePageInner` [78,949,1275,5000]、updates section [85,949,1260,1586]，栏目密集纵向排布。
- `http://mrzym.top/#/home`：DNS `47.121.29.8`；首页 HTML 2132 B，title「小张的个人博客」；`static/css/index-1606a233.css` HTTP 200 / 886704 B，`static/js/index-f69c80a8.js` 845804 B。CSS 实值：`--primary:#49b1f5`、`--font-color:#4b4948`、`--border-color:#7ec4f2`、`--hr-border:#a9d5f4`、`--top:#f26c60`；`linear-gradient`×396、`backdrop-filter`×46、`blur(`×43、`box-shadow`×315、`animation`×576、`transform`×1537、`filter`×82；keyframes `steam/aboveEnter/bottomEnter/fadeIn/Up/move`；字体 `Helvetica Neue,Helvetica,PingFang SC,Hiragino Sans GB,Microsoft YaHei,Arial,sans-serif`。**诚实边界**：headless 直开该站返回 `chrome-error://chromewebdata` 错误页，没有拿到可用渲染截图；本轮对它的排版/科技感借鉴只依据真实抓到的 CSS/JS 字面量与 DOM 类名，不是看图猜的，也没有 clone / 运行 / 套用它的源码。
- 三个决策问题（视觉基调 / 首页密度 / 后台范围）经 ask_user_question 超时无回音，按 G8 假设退出：暖白底 + 冷蓝科技叠层、六屏紧凑门户、后台「站点设置 + 内容全管理 + 首页编排」。

### 11.2 实际改动

| 层 | 文件 | 内容 |
|---|---|---|
| 配置 | `blog-site/config.example.json` | 站名「白小飞的个人博客」、Hero「你好，我是白小飞」、公告、`site.theme{accent:#49b1f5,glow,glass,grid,density,orbA:#cfebf3,orbB:#faeeff,orbC:#e8e5d8}`、`site.heroFx{radius:170,strength:96,trail:0.42,halo:true}` |
| 存储 | `blog-site/lib/store.js` | DEFAULT 增 `settings` / `layout`；全部「林间」种子文案改「白小飞」；新增 `settings()/setSettings()/layout()/setLayout()/allPosts()/deletePost()/deleteProject()/allComments()/deleteComment()/deleteUpload()/users()/setUserRole()` 与 `Store.DEFAULT_LAYOUT`（notice/hero/updates/series/projects/stats/links/about） |
| 服务端 | `blog-site/server.js` | bootstrap 合并 config.site + store.settings() 并返回 layout；新增 `/api/admin/settings`、`/api/admin/layout`、`/api/admin/content`、文章/项目/评论/上传删除、用户列表与角色；严格校验 hex/布尔/枚举/数字范围 |
| 前台 | `blog-site/public/index.html` + `app.css` + `app.js` | 1260px 紧凑六屏；1 大 3 小动态、FieldCard 三行字段、项目矩阵、状态四卡、链接、关于；固定渐变光晕 / 网格 / 扫描线 / 玻璃卡 / `#49b1f5` 辉光；按 `layout.modules` 显隐排序；主题色、光晕开关、密度、粒子参数均来自 bootstrap |
| 粒子 | `blog-site/public/assets/particle.js` | **修复鼠标力场失效**：原实现把事件绑 `#hero` 且 canvas `pointer-events:none`，覆盖层吞事件、frame 里半径/强度仍是旧值 120/40；改为 window 级 pointermove 命中区域追踪、可配置 radius/strength/trail、速度拖尾、指针事件内同步 `pushParticles()` + 立即重绘（不依赖 rAF 节流）、冷蓝光环、测试钩子 `window.__particleProbe()` / `window.__particlePositions()`；reduced-motion 下保留 canvas 可见并仍能散开 |
| 后台 | `blog-site/public/admin.html` + `admin.js` | 6 个页签：概览 / 站点设置（文案、公告、链接、accent 与三光晕色、光晕/玻璃/网格/密度、粒子半径强度拖尾）/ 首页编排（↑↓ + 显隐）/ 文章（编辑删除）/ 项目（删除）/ 评论·上传·用户（删除、角色） |
| 契约与说明 | `blog-site/API.md`、`README.md` | 补 §5b 全部新接口、55 项测试锚点、参照来源核实值与诚实边界 |
| 测试 | `blog-site/test/smoke.js` | 从 36 项扩到 **55 项**：设置 GET/POST、非法 theme/heroFx 拒绝、bootstrap 叠加、编排 GET/POST/非法模块、内容列表、用户角色、文章/项目/上传删除与 404、非管理员 403 |

### 11.3 验收证据（同视口 1440×900、同浅色主题）

- `node --check` 对 `server.js` / `public/assets/{app,admin,particle}.js` / `test/smoke.js` 全部 OK；`npm test` = **RESULT 55 passed, 0 failed**。
- CDP 页面状态：前台 `title=白小飞的个人博客`、导航品牌全称、6 个 `.module-group`、17 个富卡片、`--accent:#49b1f5`、`glow/glass/grid=on`；截图采样色数 806 → 2371、主色占比 82.4% → 14%，背景不再是一片素白。
- **粒子散开**：修复前截图字节三张完全相同、Hero 变化像素 0%；修复后 CDP `Input.dispatchMouseEvent` 扫过文字区域，`__particleProbe().active=true`、命中 `535` 个粒子、平均推力位移 `35.48px`、首 80 粒子平均离位 0 → 14.9px，Before/After Hero 区域变化像素 `1.06%`（180000 采样点），截图字节 518577 → 534147。零控制台错误。
- 后台：6 个页签、21 个设置字段、`work-panel` 可见、状态「已登录：视觉验收（管理员）· 全部自定义功能已解锁」；`POST /api/admin/settings` 与 `POST /api/admin/layout` 均成功，bootstrap 回读 `bootName=白小飞的个人博客`、`bootAccent=#49b1f5`、`bootRadius=170`、`firstModule=updates`、8 个模块。
- 对比页 `.verify/ui-compare.html`，机器证据 `.verify/revision-evidence.json`；含 Before 原型 / After 首页 / 鼠标扫过前后 / 后台控制台 / 站点设置 / 首页编排共 7+ 张截图。**诚实边界**：模型不能直读图像、modlens 超时，视觉判断依据是 CDP DOM/文本快照 + 自写 PNG 解码像素统计，不是人眼逐像素核对构图。

### 11.4 仍开放（未冒充完成）

公网部署 / HTTPS / ICP 备案、真实微信与 QQ OAuth、微信小程序端代码、搜索 / TOC / Markdown 写作链、深色主题；§8.8 第 2、3 项仍未定。后台设置存在单进程 `data/data.json`，多实例仍需数据库。


---

## 十二、三模式 · 独立后台 · 管理员账号 · 访客留言 · 背景自定义（2026-11-07 第三轮）

> 用户原话（m00480）：「网站增加黑夜模式，白天模式，自动跟随三个选项和模式，设置管理员账号为白小飞，密码为"13135566867."登录后管理员后台可以修改管理员密码，只有管理员可以调整网站内容，给访客增加留言区域，留言区域全员可见，管理员可以删除其中某条或全部内容，管理员后台设置为另外单独跳转网站，不在主站进入，再在管理员后台增加背景自定义和调色功能，可以自己换背景图片」。
> 本轮 `ask_user_question` 与 `compress` 都被宿主以 `auto-review: a PTC call has no owning step in the session log` 拒绝，按 G8 假设退出：独立端口 8788 + 主站彻底移除后台入口；访客留言可匿名填昵称；密码按引号内字面值 `13135566867.`（含结尾句点）。三项决策都记在 `.verify/pending-questions.json`。

### 12.1 真实改动

| 层 | 文件 | 内容 |
|---|---|---|
| 配置 | `blog-site/config.example.json` | `adminPort:8788`、`adminAccount{username:'白小飞',password:'13135566867.'}`；`site.theme` 增 `mode:'auto'`、`bgImage/bgColor/textColor/cardColor` |
| 存储 | `blog-site/lib/store.js` | 新增 `guestbook:[]`；`crypto.scryptSync` + 每账号随机 salt 的 `hashPassword/verifyPassword`（timingSafeEqual）；`ensureAdminSync` 首次启动建管理员且已有 admin 不覆盖；`adminByUsername/checkAdminPassword/setAdminPassword`；`guestbook()/addGuestbook/deleteGuestbook/clearGuestbook`；文章评论 `addComment` 支持匿名昵称 |
| 服务端 | `blog-site/server.js` | **双站点**：`makeHandler('public')` 与 `makeHandler('admin')` 分别监听 PORT / ADMIN_PORT，同一 `Store` 实例；stdout `READY <public>` + `ADMIN READY <admin>`。主站 `/admin`、`/api/admin/*`、`login/admin`、`login/dev`、`login/mini`、`POST /api/upload` 全 404；bootstrap 主站 `admin:false` 且带 `urls.main`。管理员判定只看 `role==='admin'`，废除「第一个 dev 用户自动管理员」。新增 `POST /api/login/admin`、`POST /api/admin/password`、`GET/POST /api/guestbook`、`POST /api/admin/guestbook/delete`、`POST /api/admin/guestbook/clear`；设置接口校验 `mode:light|dark|auto`、`bgImage` 必须 `/uploads/xxx` 或 https、三个颜色 hex；`POST /api/upload` 与全部 `/api/admin/*` 都 `requireAdmin` |
| 前台 | `public/index.html` / `app.css` / `app.js` | 导航三按钮「☀ 白天 / ☾ 黑夜 / ◐ 自动」，`data-theme=light|dark` + localStorage 个人覆盖 + `matchMedia change` 实时跟随；移除「后台」链接、登录按钮与上传面板；新增首页 `#guestbook-group` 与 `#/guestbook` 视图，匿名填昵称发表、全员可见；文章评论也支持匿名昵称；`.bg-image` 固定层 + CSS 变量 `--bg/--ink/--card` 支持后台换背景图与调色 |
| 后台 | `public/admin.html` / `assets/admin.js` | 独立站点登录页（账号 `白小飞` + 密码），8 个页签：概览 / 站点设置 / 首页编排 / 文章 / 项目 / **访客留言** / 评论·上传·用户 / **账号安全**；站点设置新增显示模式、背景色/文字色/卡片色、背景图上传/URL/清除/预览；留言页删单条与清空全部；账号安全页改管理员密码；`回主站` 用 bootstrap 的 `urls.main` |
| 契约与说明 | `blog-site/API.md` / `README.md` | §5c 双站点隔离、账号哈希、改密、三模式、背景自定义、留言板、权限边界；README 明确独立后台地址与三项未做事项 |
| 测试 | `blog-site/test/smoke.js` | 全量重写为双端口测试：临时 DATA_DIR + 两个随机端口，**RESULT 79 passed, 0 failed**；覆盖主站无后台入口、账号错/对密码、改密后旧密码失效、三模式枚举与背景校验、匿名留言全员可见、管理员删单条/清空、非管理员 403、背景图上传与删除 |

### 12.2 验收证据（CDP 1440×900 浅色/深色同视口）

- 三模式 DOM 实测：白天 `data-theme=light`、`rgb(252,250,248)` / `rgb(31,35,41)`；黑夜 `data-theme=dark`、`rgb(13,20,28)` / `rgb(232,241,248)`；自动 `data-theme=dark`（headless 系统偏好为暗），`Emulation.setEmulatedMedia` 切暗后自动态仍为 `dark`；localStorage 记录 `light/dark/auto`。
- 主站 `adminLinks:0`、3 个模式按钮、留言板链接存在；`GET /admin` 与所有 `/api/admin/*` 在主站 404。独立后台 8 个页签、`work-panel` 可见、`login-panel` 隐藏、登录态「已登录：白小飞（管理员）」。
- 访客留言真实点击：`#/guestbook` 发表前 0 条 → 发表后 **1 条**，文本「鲸鱼访客 2026-11-07 全员可见的第一条留言」，计数「共 1 条 · 全员可见」，零控制台错误；截图 `.verify/guestbook-visible.png`。
- 截图 `.verify/{before-mode-light,mode-light,mode-dark,mode-auto,guestbook-visible,admin-login,admin-logged,admin-settings,admin-guestbook,admin-account}.png` 与对比页 `.verify/ui-compare.html`、机器证据 `.verify/mode-evidence.json`。**诚实边界**：模型不能直读图片、modlens 超时，视觉判定依据是 CDP DOM/计算样式/文本快照，不是人眼逐像素核对。
- 6 个 JS `node --check` 全 OK；`npm test` **79 passed / 0 failed**。发现并修复两个真实缺陷：`POST /api/upload` 里 `user` 未定义（`{"ok":false,"error":"BAD_REQUEST","message":"user is not defined"}`）；`bgImage` 超长 URL 的校验条件写反；主站 `/api/admin/settings` 的重复兜底也补上了 404。

### 12.3 仍开放（未冒充完成）

公网部署 / HTTPS / ICP 备案、真实微信与 QQ OAuth、微信小程序端代码、搜索 / TOC / Markdown 写作链；后台是同机不同端口的独立站点，不是独立域名或独立服务器；密码与设置仍存单进程 `data/data.json`，多实例需数据库。§8.8 第 2、3 项仍未定。


---

## 十三、黑夜模式粒子发光与文字可读性（2026-11-07 第四轮）

> 用户原话（m00570）：「黑夜模式增加一个粒子发光效果，因为我黑夜模式看不清除字体」。

### 13.1 根因（核实到的代码事实）

`public/assets/particle.js` 原来把粒子颜色写死为 `INK='#1f2329'` / `ACCENT='#fb8147'`，`sample()` 里 `parts[i].color=(i%17===0?ACCENT:INK)`；`drawStatic()` 与 `frame(t)` 只用 `fillRect` 无 `shadowBlur`。暗色主题下背景 `--bg:#0d141c`，深色粒子与背景亮度接近，所以 Hero 粒子字确实看不清。这不是 CSS 文案颜色的问题，而是 canvas 粒子本身没随主题换色。

### 13.2 实际改动

| 文件 | 内容 |
|---|---|
| `blog-site/public/assets/particle.js` | 新增 `SURFACE` / `PAL`；`surfaceIsDark()` 先读 `body[data-theme]`，无标记时用 `getComputedStyle(document.body).backgroundColor` 算亮度（`0.2126R+0.7152G+0.0722B` < .45 视为暗，兼容后台自定义背景色）。暗色色板 `ink:'#e8f7ff'`、`accent:'#7dd8ff'`、`glow:'rgba(73,177,245,.95)'`、`shadowBlur=12*DPR`、粒子尺寸 2.35；白天仍是 `#1f2329/#fb8147`、无辉光、尺寸 1.8。`sample()` 按 `PAL` 生成粒子；`drawStatic()` 与 `frame(t)` 在暗色下 `globalCompositeOperation='lighter'` + `shadowColor/shadowBlur`（`ctx.save/restore` 包裹）；新增 `this.setTheme()` 在不重建实例的情况下换色并立即重绘；`window.__particleProbe()` 暴露 `dark/glow/color` |
| `blog-site/public/assets/app.js` | `applyTheme()` 末尾统一调 `bootstrap.particle.setTheme()`，因此手动切白天/黑夜、系统 `matchMedia` 自动跟随、后台改站点默认模式都会实时换色；删掉 `setMode()` / `onMq` 里的重复调用 |
| `blog-site/public/assets/app.css` | 暗色下 `#pt` 叠两层 `drop-shadow`、Hero 副标题/CTA/hint/光标环加亮冷蓝 text-shadow；顺手把暗色 `--sub` 从 `#a9bccd` 提到 `#c5d8e6`、`--muted` 从 `#6f8497` 提到 `#8fa8ba`、`--border` 提到 `#2b3d4e`，改善整体文字对比 |
| `blog-site/test/smoke.js` | 新增 4 项静态资源断言：粒子脚本含暗色色板与 `setTheme`、CSS 含 `#pt{filter:drop-shadow`、app.js 含主题同步、暗色文字对比变量；总数 **RESULT 83 passed, 0 failed** |

### 13.3 验收证据（同页、同视口 1440×900、只切换模式）

- CDP 先强制白天再切黑夜：`data-theme` `light → dark`；`__particleProbe()` 的 `dark` `false → true`、`glow` `0 → 12`、粒子色 `#fb8147 → #7dd8ff`；`#pt` 计算样式 `none → drop-shadow(rgba(125,216,255,.75) 0 0 5px) drop-shadow(rgba(73,177,245,.42) 0 0 14px)`；副标题 text-shadow 实测两层冷蓝光晕。
- 暗色下鼠标力场仍生效：命中 `581` 个粒子、平均推力 `35.23px`、`active:true`；零控制台错误。
- Hero 区域亮像素（自写 PNG 解码，区域 x 250..1190 / y 100..500）白天 `98.12%` → 黑夜 `3.41%`，说明背景确实变暗而发光粒子成为高亮前景；三张截图 `.verify/{before-particle-light,after-particle-dark-glow,after-particle-dark-force}.png`，对比页 `.verify/ui-compare.html`，机器证据 `.verify/glow-evidence.json`。
- **诚实边界**：模型不能直读图片、modlens 超时，所以「看得清」的判据是粒子色值 / shadowBlur / 计算样式 / 亮像素占比 / 前后截图字节差异，不是人眼逐像素核对。发光是本地 canvas 参数，没有声称参考或复用某个未核实的开源特效库。
- 6 个 JS `node --check` 全 OK；`npm test` **83 passed / 0 failed**。

### 13.4 仍开放

公网 / HTTPS / ICP、真实微信与 QQ OAuth、微信小程序端代码、搜索 / TOC / Markdown 写作链；后台只是同机不同端口；密码与设置仍存单进程 `data/data.json`。§8.8 第 2、3 项未定。


---

## 十四、粒子打散后自动回归原位（2026-11-07 第五轮）

> 用户原话（m00606）：「粒子不能够自己回归原位，打散后就打散了，修复一下」。

### 14.1 根因（核实到的代码事实）

旧 `public/assets/particle.js` 有三个叠加问题：
1. `ptr.active` 只在鼠标**离开 Hero 区域**时置 false；鼠标停在文字里不动时力场持续生效，粒子一直被推着，没有「松手」状态。
2. `resize()` 的 `prefers-reduced-motion` 分支只 `drawStatic()` **不启动任何循环**；headless Edge 与系统减少动效都走这条，打散后没有任何后续帧把粒子拉回 `tx/ty`。
3. 非 reduced 分支用 `requestAnimationFrame`，后台标签页会被节流；且 `pushParticles()` 把 `p.x` 直接写偏后，没有统一的「回到目标点」动画状态。

### 14.2 实际改动（只改 `particle.js` / `test/smoke.js`）

- 用 `setTimeout(tick, 32)` 取代 `requestAnimationFrame` 作为唯一动画驱动，减少动效 / 后台标签页也能运行；`ensureAnim()` 在指针事件、主题切换、resize 后唤醒循环。
- 新增力场有效期 `IMPULSE_MS=110`：每次 `pointermove/pointerdown` 只把 `ptr.impulseUntil` 推到 `now()+110`，`forceActive()` 过期即关力场；`tick()` 里力场失活自动 `ptr.active=false`。**鼠标停住也会松手**。
- `tick()` 用 `RETURN_LERP=0.22` 每帧把粒子拉回 `tx/ty`（力场生效时仍用 `.32` 推开）；保留入场 easeOutCubic、轻微漂浮、暗色辉光与力场光环。
- reduced-motion：回位完成（`maxDisp<=0.4`）且力场失活后停表省电，静止画面仍是完整字形；非 reduced 保留常驻轻微漂浮。
- `__particleProbe()` 新增 `forceActive / animating / maxDisp / impulseMsLeft`，让「是否回位」可机器验证；`destroy()` 清理 `animTimer`。
- `test/smoke.js` 增加 2 项静态断言：`RETURN_LERP = 0.22` + `setTimeout(tick, TICK_MS)` + `IMPULSE_MS = 110`、probe 暴露 `maxDisp/forceActive`；修正旧断言里 `ink:'#e8f7ff'` 与重写后带空格的色板字面量不一致。**RESULT 85 passed, 0 failed**。

### 14.3 验收证据（CDP 1440×900、reduced-motion 开启，最容易被节流的情况）

- 静置前 `maxDisp=0 / animating=false`；鼠标扫过文字后 `maxDisp=77.39px`、命中 `579` 个粒子、`forceActive=true`。
- **不移动鼠标、仅等待**：250ms 后 `maxDisp=2.32 / forceActive=false / animating=true`；450ms 后 `maxDisp=0.32 / animating=false`（循环自动停表）；800ms、1200ms 稳定在 `0.32`。`returned=true`，零控制台错误。
- 截图 `.verify/particle-scattered.png`（531160 B）→ `.verify/particle-returned.png`（527967 B），对比页 `.verify/ui-compare.html`，机器证据 `.verify/return-evidence.json`。
- 6 个 JS `node --check` 全 OK；`npm test` **85 passed / 0 failed**。
- **诚实边界**：模型不能直读图片、modlens 超时；回位判定依据是 `__particleProbe().maxDisp` 的数值衰减、动画状态与截图字节差异，不是人眼逐像素核对。

### 14.4 仍开放

公网 / HTTPS / ICP、真实微信与 QQ OAuth、微信小程序端代码、搜索 / TOC / Markdown 写作链；后台只是同机不同端口；密码与设置仍存单进程 `data/data.json`。§8.8 第 2、3 项未定。


---

## 十五、粒子卡顿审查与合帧优化（2026-11-07 第六轮）

> 用户原话（m00630）：「粒子效果部分特别卡顿，你审查一下啥情况」。

### 15.1 审查方法（真实实测，不是猜）

在 1440×900 headless Edge 里用 CDP 注入 `CanvasRenderingContext2D.prototype.fillRect/fill/clearRect` 计数器，分别测「暗色静止 / 暗色鼠标移动 / 亮色静止 / 亮色鼠标移动」四种场景 1 秒窗口内的绘制调用。原始证据 `.verify/perf-before.json`。

| 场景 | 修复前 1 秒绘制调用 | 说明 |
|---|---|---|
| 暗色静止 | 2272 `fillRect` | 无视觉变化却仍在画 |
| 暗色鼠标（30 事件） | **34080 `fillRect` / 37.7ms** | 每个 pointermove 同步整幅重绘 |
| 亮色静止 | **14768 `fillRect`** | 常驻循环空转 |
| 亮色鼠标（30 事件） | **54528 `fillRect` / 14.6ms** | 事件数与帧数叠加 |

### 15.2 根因（三条叠加）

1. `onMove()` 里每个 `pointermove` 都调 `pushParticles() → drawStatic()`，而 `drawStatic()` 逐粒子执行 1136 次 `fillRect`。一次鼠标事件 = 1136 次绘制，事件密集时成倍放大。
2. 暗色模式给**每一次** `fillRect` 挂 `shadowColor/shadowBlur=12*DPR`，又给 `#pt` 整张 canvas 叠两层 CSS `drop-shadow` 滤镜；canvas 每帧变化都会触发两层全屏滤镜重算（暗色单次 fillRect 1.85µs，亮色 0.26µs，约 7×）。
3. 非 reduced 模式常驻循环在静止时也画全部 1136 个粒子，没有「无变化就停表」的短路。

### 15.3 实际改动（`particle.js` / `app.css` / `test/smoke.js`）

- **合帧绘制**：`drawStatic()` 按「颜色 × 4 档量化 alpha」把 1136 个粒子分成 8 组，每组一次 `beginPath()` + 多个 `rect()` + 一次 `fill()`。每帧绘制调用 **1136 → 8**（暗色双层辉光 16）。`__particleProbe().lastDraw={groups,rects,fills}` 可核实。
- **指针事件不再重绘**：`onMove()` 只更新 `ptr` 并 `ensureAnim(16)`；施力 `applyForce()` 每帧最多一次，绘制统一由 `tick()` 合帧完成。
- **去掉全屏 CSS 滤镜**：`body[data-theme="dark"] #pt{filter:none}`；辉光改在 canvas 内按组做「放大矩形 + shadowBlur」底层 + 清晰粒子顶层的双通道，仍是 16 次 fill/帧，不逐粒子滤镜。
- **静止停表**：reduced-motion 下回位完成且力场失活后停表（`animating:false`、0 绘制）；非 reduced 才保留常驻轻微漂浮。保留 §14 的 110ms 力场有效期与 `RETURN_LERP=0.22` 自动回位。
- `test/smoke.js` 从 85 项扩到 **88 项**：新增「无全屏 canvas CSS 滤镜」「合帧 `beginPath/fill/lastDraw`」「onMove 不整幅重绘」断言；修正旧断言里 `setTimeout(tick, TICK_MS)` 与自适应帧间隔不一致的问题。

### 15.4 验收证据（同视口 1440×900、CDP 实测）

- 修复后每帧 `lastDraw={groups:8,rects:1136,fills:16}`（暗色）/ `fills:8`（亮色）；暗色静止 0 绘制调用、亮色静止 0；30 个同步指针事件下暗色 176 / 亮色 192 次合帧 fill，对比修复前 34080 / 54528 次 `fillRect`，**单次绘制调用量降约两个数量级**。
- 真实 CDP 鼠标 14 次移动：打散 `maxDisp=85.57px`、`forceActive=true`、`dark=true/glow=12/color=#7dd8ff`；静置后 `maxDisp=0.32px`、`animating=false`、零控制台错误 —— **§13 的暗色发光与 §14 的自动回位都没坏**。
- 暗色发光像素复核（自写 PNG 解码，Hero 区域 77550 采样点）：修复前亮像素 3.13% / 冷蓝像素 5.32% → 优化后 **亮像素 6.13% / 冷蓝 3.77%**。诚实说明：整体更亮，但冷蓝扩散范围略收窄（合帧辉光与逐粒子滤镜的光晕分布不同），不是「完全一模一样」；副标题/CTA 的 CSS text-shadow 保持不变。
- 截图 `.verify/{perf-scattered,perf-returned,after-particle-dark-batched}.png`、对比页 `.verify/ui-compare.html`、机器证据 `.verify/{perf-before,perf-after,perf-final,glowcheck}.json`。**诚实边界**：模型不能直读图片、modlens 超时，视觉判断依据是像素统计/计算样式/绘制调用计数，不是人眼看图；headless 无 GPU，真机帧率需用户体感确认。
- 6 个 JS `node --check` 全 OK；`npm test` **88 passed / 0 failed**。

### 15.5 仍开放

真机（有 GPU）上的实际帧率未测，本轮证据来自 headless CDP 的绘制调用计数与耗时；公网 / HTTPS / ICP、真实微信与 QQ OAuth、微信小程序端代码、搜索 / TOC / Markdown 写作链；后台只是同机不同端口；密码与设置仍存单进程 `data/data.json`。§8.8 第 2、3 项未定。


---

## 十六、单文件夹打包、EXE 启动器与免费公网方案（2026-11-07 第七轮）

> 用户原话（m00666）：「功能合格，我现在需要你把这个项目的所有文件放在一个文件夹，再告诉我这个文件夹在哪，然后我需要你把这个程序打包为exe，让他可以点开即到主站，同时在文件夹里添加一个txt，里面内容为这个网站的使用方法和网址，以及管理界面的网址，最后告诉我，我该如何将其部署到公网还不需要花一分钱」。

### 16.1 交付文件夹（真实路径）

`E:\文档\deepseek-harness\default-workspace\白小飞的个人博客-打包版`（37 个文件 / 93341776 B，含内置 Node 91426304 B）。顶层：`白小飞的个人博客.exe`、`使用说明.txt`、`免费公网部署.bat`、`启动器源码.cs`、`README-打包说明.md`、`app\`、`runtime\`、`docs\`、`tools\`。复制走 `app\` 时排除了 `config.json` / `data`（运行时私有状态），首次双击由启动器从 `config.example.json` 创建。

### 16.2 EXE 的实现与本机实测（不夸大）

- `白小飞的个人博客.exe` 是 **C# 启动器**：用本机 `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe` 以 `/target:exe /r:System.dll` 编译 `启动器源码.cs`，9216 B。**不是把 Node/网站整体编译成单个原生二进制**；`runtime\node.exe` 与 `app\` 必须同目录。内置运行时是本机真实核实到的 `D:\node\node.exe` / Node v24.14.1 / 91426304 B。
- 启动器逻辑：空闲端口探测 → 首次从 `config.example.json` 生成 `config.json` 并写回 `port/adminPort/baseUrl` → 以 `PORT/ADMIN_PORT/HOST/DATA_DIR/CONFIG_PATH` 起 `runtime\node.exe server.js` → 轮询 `/api/health` → `Process.Start` 打开主站 → 控制台驻留，关窗/退出时 `Kill` 子进程。控制台 `OutputEncoding=UTF8` 修正中文乱码；`BLOG_NO_BROWSER=1` 仅供自动化测试。
- **实测**：`READY 8787` + `ADMIN READY 8788`、主站 `/api/health` 200 / `/` 200 HTML、独立后台 `/` 200（`白小飞的个人博客 · 后台`）、主站 `/admin` 404；内置 `node.exe --check app\server.js` OK；源项目 `npm test` **88 passed / 0 failed**。测试产生的 `app\config.json` 与 `app\data` 已删除，交付目录是干净的首次启动状态。

### 16.3 使用说明 TXT 与公网脚本

- `使用说明.txt`（UTF-8 BOM，6602 B）：文件夹说明、双击步骤、主站 `http://127.0.0.1:8787/`、后台 `http://127.0.0.1:8788/`、留言板、RSS、管理员账号 `白小飞` / 初始密码 `13135566867.`、备份 `app\data`、常见问题、免费公网步骤与安全提醒。
- `免费公网部署.bat`：检查 `tools\cloudflared.exe` 是否存在，提示官方下载地址；询问主站/后台端口后开两个 `cloudflared tunnel --url http://127.0.0.1:<port>` 窗口。
- `README-打包说明.md`：交付清单、实测结果、诚实边界。

### 16.4 免费公网方案（唯一符合「不花一分钱」的可行路径）

Cloudflare **Quick Tunnel**：不用服务器、不用域名、不用备案、不用 Cloudflare 账号；代价是每次随机 `https://xxx.trycloudflare.com`、关机/断网/关窗口即失效，适合临时演示而非长期运营。步骤：双击 exe → 下载官方 `cloudflared-windows-amd64.exe` 到 `tools\cloudflared.exe` → 运行 `免费公网部署.bat`（或分别 `tunnel --url http://127.0.0.1:8787` 与 `--url http://127.0.0.1:8788`）→ 两个窗口各给一个 https 地址。
- 本机核实：官方 `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe` 返回 302 到 `2026.10.7/cloudflared-windows-amd64.exe`；`/releases/expanded_assets` 与本机 PowerShell/HttpWebRequest 下载均因连接中断只拿到 **9424576 B 残片**，`--version` 超时，**没有在本机实际跑通隧道**；残片已从交付目录删除，`tools\` 为空，TXT 与 MD 都明确写了「需下载完整官方 exe」。
- 备选 `localhost.run` 的 `ssh -R 80:localhost:8787 nokey@localhost.run` 只在 TXT 里作为「更折腾、未核实当前可用性」的备选提及，没有声称实测通过。
- Cloudflare 正式 Tunnel 需要账号+域名，GitHub Pages / Vercel / Netlify 免费静态托管跑不了这个带登录/留言/上传/后台的 Node 服务端，均如实排除。
- 公网安全提醒已写入 TXT：先改初始密码、`providers.dev.enabled:false`、后台地址不要公开分享、单进程 JSON 存储不适合生产、临时隧道无 SLA。

### 16.5 仍开放

真机有 GPU 的帧率未测；公网 / 固定域名 / HTTPS 证书 / ICP 备案、真实微信与 QQ OAuth、微信小程序端代码、搜索 / TOC / Markdown 写作链；后台只是同机不同端口；密码与设置仍存单进程 `data/data.json`。§8.8 第 2、3 项未定。
