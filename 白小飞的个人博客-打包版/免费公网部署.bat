@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==========================================
echo  免费公网部署助手 · Cloudflare Quick Tunnel
echo ==========================================
if not exist "tools\cloudflared.exe" (
  echo [错误] 缺少 tools\cloudflared.exe
  echo 请到 https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
  echo 下载完整文件，放到 tools 文件夹并改名为 cloudflared.exe
  echo tools\cloudflared.exe.incomplete 是下载残片，不能运行，请删除。
  pause & exit /b 1
)
echo 请先双击「白小飞的个人博客.exe」并保持控制台开着。
echo 本脚本会打开两个窗口：第一个是主站隧道，第二个是后台隧道。
echo 每个窗口里出现的 https://xxx.trycloudflare.com 就是公网地址。
echo.
set /p P=主站端口（默认 8787，按控制台实际显示填写）:
if "%P%"=="" set P=8787
set /p A=后台端口（默认 8788，按控制台实际显示填写）:
if "%A%"=="" set A=8788
start "主站公网隧道" cmd /k "tools\cloudflared.exe tunnel --url http://127.0.0.1:%P%"
start "后台公网隧道" cmd /k "tools\cloudflared.exe tunnel --url http://127.0.0.1:%A%"
echo.
echo 已打开两个隧道窗口。复制每个窗口里的 https 地址即可分享。
echo 关闭这两个窗口或本机启动器，公网地址即失效。
pause
