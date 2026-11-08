# 白小飞的个人博客 · 打包交付说明

## 顶层内容

| 名称 | 作用 |
|---|---|
| `白小飞的个人博客.exe` | 双击启动：内置 Node 起服务 + 自动打开主站 |
| `使用说明.txt` | 网址、管理员账号、功能、备份与免费公网部署步骤 |
| `免费公网部署.bat` | 检测 cloudflared 后开两条 Quick Tunnel 的辅助脚本 |
| `启动器源码.cs` | C# 启动器源码（`csc.exe /target:exe` 编译，非第三方打包器） |
| `runtime\node.exe` | 内置 Node v24.14.1（91426304 B），目标机器无需安装 Node |
| `app\` | 零依赖网站程序：server.js / lib / public / test / 文档 |
| `docs\` | blog-design.md、particle-demo.html 与 `.verify` 验收证据 |
| `tools\` | 预留放官方 `cloudflared.exe`；当前为空 |

## 本机实测

- `白小飞的个人博客.exe` 无浏览器模式启动：`READY 8787` + `ADMIN READY 8788`，中文控制台 UTF-8 正常。
- 主站 `GET /api/health` 200、`GET /` 200 HTML；独立后台 `GET /` 200 返回 `白小飞的个人博客 · 后台`；主站 `GET /admin` 404。
- 内置 `runtime\node.exe --check app\server.js` 通过；打包目录不含 `config.json` 与 `data`，首次双击会自动从 `config.example.json` 创建。
- 源项目 `npm test` **88 passed / 0 failed**；6 个 JS `node --check` 全 OK（见 `docs\blog-design.md` §15）。

## 诚实边界

- `白小飞的个人博客.exe` 是 C# 写的**启动器**，不是把 Node 与网站编译成单个原生二进制；`runtime`、`app` 必须和 exe 放一起。
- 本机下载 cloudflared 官方 exe 时网络中断，只得到 9424576 字节残片，已删除，**没有在本机实测跑通 Quick Tunnel**；`使用说明.txt` 里的隧道命令来自 Cloudflare Quick Tunnel 的公开用法，需用户下载完整官方 exe 后使用。
- 免费方案是临时随机 `https://xxx.trycloudflare.com`，关机/断网/关窗口即失效；没有域名、备案、长期 SLA，也不适合生产数据。
- GitHub Pages / Vercel / Netlify 免费静态托管跑不了这个带登录、留言、上传、后台的 Node 服务端，所以不列为可行免费公网方案。
- 公网暴露前请改初始密码、关闭 `providers.dev.enabled`；后台地址不要公开分享。

## 免费公网方案（详细步骤见 使用说明.txt）

1. 双击 exe，保持控制台开着。
2. 下载 `https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe` 到 `tools\cloudflared.exe`。
3. 运行 `免费公网部署.bat`，或手写 `tools\cloudflared.exe tunnel --url http://127.0.0.1:8787` 与 `--url http://127.0.0.1:8788`。
4. 两个窗口各给一个 https 地址，分别是主站与后台；本机 exe 与两隧道窗口都不能关。
