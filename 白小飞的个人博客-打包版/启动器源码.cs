using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;

class BlogLauncher {
    static string Root;
    static string App;
    static string Runtime;
    static string Data;
    static string NodeExe;
    static int Port = 8787;
    static int AdminPort = 8788;
    static Process Server;

    static int FreePort(int start) {
        for (int p = start; p < start + 100; p++) {
            try {
                TcpListener l = new TcpListener(IPAddress.Loopback, p);
                l.Start(); l.Stop(); return p;
            } catch { }
        }
        return start;
    }

    static void Main() {
        Root = Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location);
        App = Path.Combine(Root, "app");
        Runtime = Path.Combine(Root, "runtime");
        Data = Path.Combine(App, "data");
        NodeExe = Path.Combine(Runtime, "node.exe");
        if (!File.Exists(NodeExe)) NodeExe = "node";
        if (!File.Exists(Path.Combine(App, "server.js"))) {
            Console.WriteLine("缺少 app\\server.js，请保持文件夹完整。");
            Console.WriteLine("按任意键退出..."); Console.ReadKey(); return;
        }
        Directory.CreateDirectory(Data);
        string example = Path.Combine(App, "config.example.json");
        string config = Path.Combine(App, "config.json");
        if (!File.Exists(config)) File.Copy(example, config);
        Port = FreePort(Port);
        AdminPort = FreePort(AdminPort == Port ? Port + 1 : AdminPort);
        if (AdminPort == Port) AdminPort = Port + 1;
        try {
            string cfg = File.ReadAllText(config, System.Text.Encoding.UTF8);
            cfg = System.Text.RegularExpressions.Regex.Replace(cfg, "\"port\"\\s*:\\s*\\d+", "\"port\": " + Port);
            cfg = System.Text.RegularExpressions.Regex.Replace(cfg, "\"adminPort\"\\s*:\\s*\\d+", "\"adminPort\": " + AdminPort);
            cfg = System.Text.RegularExpressions.Regex.Replace(cfg, "\"baseUrl\"\\s*:\\s*\"[^\"]*\"", "\"baseUrl\": \"http://127.0.0.1:" + Port + "\"");
            File.WriteAllText(config, cfg, new System.Text.UTF8Encoding(false));
        } catch (Exception e) { Console.WriteLine("配置写入失败: " + e.Message); }

        Console.OutputEncoding = System.Text.Encoding.UTF8;
        Console.Title = "白小飞的个人博客";
        Console.WriteLine("==============================================");
        Console.WriteLine("  白小飞的个人博客");
        Console.WriteLine("  主站:   http://127.0.0.1:" + Port + "/");
        Console.WriteLine("  后台:   http://127.0.0.1:" + AdminPort + "/");
        Console.WriteLine("  账号:   白小飞   初始密码: 13135566867.");
        Console.WriteLine("==============================================");
        Console.WriteLine("正在启动服务，浏览器将自动打开主站...");

        try {
            ProcessStartInfo psi = new ProcessStartInfo();
            psi.FileName = NodeExe;
            psi.Arguments = "server.js";
            psi.WorkingDirectory = App;
            psi.UseShellExecute = false;
            psi.CreateNoWindow = true;
            psi.RedirectStandardOutput = true;
            psi.RedirectStandardError = true;
            psi.EnvironmentVariables["PORT"] = Port.ToString();
            psi.EnvironmentVariables["ADMIN_PORT"] = AdminPort.ToString();
            psi.EnvironmentVariables["HOST"] = "127.0.0.1";
            psi.EnvironmentVariables["DATA_DIR"] = Data;
            psi.EnvironmentVariables["CONFIG_PATH"] = config;
            Server = new Process(); Server.StartInfo = psi;
            Server.OutputDataReceived += (s, e) => { if (!String.IsNullOrEmpty(e.Data)) Console.WriteLine("[服务] " + e.Data); };
            Server.ErrorDataReceived += (s, e) => { if (!String.IsNullOrEmpty(e.Data)) Console.WriteLine("[错误] " + e.Data); };
            Server.Start(); Server.BeginOutputReadLine(); Server.BeginErrorReadLine();
        } catch (Exception e) {
            Console.WriteLine("启动失败: " + e.Message);
            Console.WriteLine("按任意键退出..."); Console.ReadKey(); return;
        }

        for (int i = 0; i < 40; i++) {
            try {
                WebClient wc = new WebClient();
                string r = wc.DownloadString("http://127.0.0.1:" + Port + "/api/health");
                if (r.IndexOf("\"ok\"") >= 0) break;
            } catch { }
            Thread.Sleep(250);
        }
        if (Environment.GetEnvironmentVariable("BLOG_NO_BROWSER") != "1") {
            try { Process.Start("http://127.0.0.1:" + Port + "/"); } catch { }
        }
        Console.WriteLine();
        Console.WriteLine("服务已运行。关闭本窗口即停止网站。");
        Console.WriteLine("提示: 首次启动会在 app\\data 里创建数据与管理员账号。");
        Console.CancelKeyPress += (s, e) => { Stop(); e.Cancel = true; };
        AppDomain.CurrentDomain.ProcessExit += (s, e) => Stop();
        while (true) {
            if (Server != null && Server.HasExited) { Console.WriteLine("服务已退出，代码 " + Server.ExitCode); break; }
            Thread.Sleep(500);
        }
        Console.WriteLine("按任意键退出..."); Console.ReadKey();
    }
    static void Stop() {
        try { if (Server != null && !Server.HasExited) Server.Kill(); } catch { }
    }
}
