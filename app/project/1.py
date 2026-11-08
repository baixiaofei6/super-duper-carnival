import os
import sys
import subprocess

work_dir = os.getcwd()

# 检查主文件是否存在
if not os.path.exists(os.path.join(work_dir, "app.py")):
    raise FileNotFoundError("❌ app.py 未找到！")

# 检查 web 文件夹及关键文件是否存在
web_dir = os.path.join(work_dir, "web")
required_files = ["app.js", "index.html", "styles.css"]

if not os.path.isdir(web_dir):
    raise FileNotFoundError("❌ web 文件夹不存在！")

for file in required_files:
    if not os.path.exists(os.path.join(web_dir, file)):
        raise FileNotFoundError(f"❌ web/{file} 未找到！")

# 打包命令：只需添加整个 web 文件夹一次
cmd = [
    sys.executable, "-m", "PyInstaller",
    "--onefile",
    "--console",               # 若为 GUI 程序（如 tkinter、PyQt），改为 "--windowed"
    "--add-data", "web;web",   # ← 关键：把整个 web 目录打包进去
    "app.py"
]

print("📦 正在打包 app.py + web/ (含 app.js, index.html, styles.css) 为 .exe...")
print("工作目录:", work_dir)
print("执行命令:", " ".join(cmd))

# 执行打包
result = subprocess.run(cmd, cwd=work_dir, capture_output=True, text=True)

if result.returncode == 0:
    print("\n✅ 打包成功！")
    print(f"生成的 exe 路径: {os.path.join(work_dir, 'dist', 'app.exe')}")
else:
    print("\n❌ 打包失败！详细错误如下：")
    print("=" * 60)
    print(result.stderr)
    print("=" * 60)