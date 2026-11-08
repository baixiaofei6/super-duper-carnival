#!/usr/bin/env python3
import argparse
import json
import mimetypes
import os
import re
import secrets
import shutil
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request
import urllib.error
import random
import socket
import webbrowser
import ctypes

from http.server import BaseHTTPRequestHandler
import socketserver
import http.server

try:
    from http.server import ThreadingHTTPServer
except ImportError:
    class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
        daemon_threads = True

# ================= 配置区域 =================
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = getattr(sys, "_MEIPASS", ROOT_DIR)
RUNTIME_DIR = os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else ROOT_DIR

# --- 统一生成到 liaotian 文件夹 ---
ROOT_DATA_DIR = os.path.join(RUNTIME_DIR, "liaotian")
WEB_DIR = os.path.join(BASE_DIR, "web")
UPLOAD_DIR = os.path.join(ROOT_DATA_DIR, "uploads")
DATA_DIR = os.path.join(ROOT_DATA_DIR, "data")

LOG_PATH = os.path.join(DATA_DIR, "messages.jsonl")
ERROR_LOG = os.path.join(DATA_DIR, "server.log")
ROOMS_PATH = os.path.join(DATA_DIR, "rooms.json")
BOT_CONFIG_PATH = os.path.join(DATA_DIR, "bot_config.json")
BOT_API_LOG = os.path.join(DATA_DIR, "bot_api.log")
BOT_LOG_TAIL_SCRIPT = os.path.join(DATA_DIR, "bot_log_tail.ps1")

# --- 管理员配置 (已固定) ---
ADMIN_USERNAME = "JH"
ADMIN_PASSWORD = "6692"
ADMIN_TOKEN_TTL = 12 * 60 * 60
SERVER_PORT = 8000  # 新增：用于前端显示端口

# --- 默认机器人名称 (可在后台修改) ---
DEFAULT_BOT_NAME = "群机器人"

BOT_HISTORY_LIMIT = 5
BOT_PROACTIVE_DELAY_RANGE = (8, 18)
BOT_FAILURE_COOLDOWN_SECONDS = 180
BOT_SEVERE_BLOCK_COOLDOWN_SECONDS = 600
BOT_FAILURE_STREAK_THRESHOLD = 3
BOT_COOLDOWN_LOG_INTERVAL = 30
BOT_BUSY_LOG_INTERVAL = 15

DEFAULT_ROOMS = ["大厅", "项目", "闲聊"]
MAX_MESSAGES = 8000
PRESENCE_TTL = 90

# 全局状态
LOCK = threading.Lock()
MESSAGES = []
NEXT_ID = 1
ROOMS = []
USERS = {}  
# 修改：MUTED_IPS 结构调整为支持过期时间 {ip: {"name": str, "ts": float, "until": float}}
MUTED_IPS = {} 
KICKED_IPS = {} 
ADMIN_TOKENS = {} 
BACKED_UP_FILES = set()
BOT_CONFIG = {}
BOT_THREADS_STARTED = False
BOT_LOG_WINDOW_STARTED = False
BOT_STATE = {
    "last_user_room_ts": 0.0,
    "last_bot_room_ts": 0.0,
    "last_trigger_ts": 0.0,
    "failure_streak": 0,
    "cooldown_until": 0.0,
    "last_cooldown_log_ts": 0.0,
    "api_inflight": False,
    "last_busy_log_ts": 0.0,
}

TEXT_FIXUPS = {}

# ================= 功能函数区域 =================

def hide_console_window():
    """隐藏命令行窗口 (仅限 Windows)"""
    if os.name == 'nt':
        ctypes.windll.user32.ShowWindow(ctypes.windll.kernel32.GetConsoleWindow(), 0)

def configure_firewall():
    """尝试自动添加防火墙规则 (仅 Windows)"""
    if os.name != 'nt':
        return

    print("\n[信息] 正在尝试自动配置防火墙...")
    try:
        cmd = [
            "netsh", "advfirewall", "firewall", "add", "rule",
            f"name=LanChat_Auto_{random.randint(1000,9999)}",
            "dir=in", "action=allow", "protocol=TCP", "localport=8000"
        ]
        
        creation_flags = subprocess.CREATE_NO_WINDOW if hasattr(subprocess, 'CREATE_NO_WINDOW') else 0
        
        # 注意这里加上了 encoding='utf-8', errors='ignore'
        result = subprocess.run(cmd, capture_output=True, text=True, creationflags=creation_flags, encoding='utf-8', errors='ignore')
        
        if result.returncode == 0:
            print("[成功] 防火墙规则已自动添加，端口 8000 已开放。")
        else:
            print("[警告] 自动配置失败 (可能不是管理员身份运行)。")
            
    except Exception:
        pass

# 新增：获取局域网 IP
def get_local_ip():
    """获取局域网 IP 地址"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def default_bot_config():
    return {
        "name": DEFAULT_BOT_NAME,
        "enabled": False,
        "api_url": "",
        "api_key": "",
        "model": "",
        "system_prompt": "你是局域网群聊里的内置聊天机器人。回答自然、友好、简洁。",
        "proactive_enabled": True,
        "reply_probability": 0.7,
        "proactive_probability": 0.3,
    }

def get_bot_name():
    """获取当前的机器人名称"""
    return str(BOT_CONFIG.get("name") or DEFAULT_BOT_NAME).strip() or DEFAULT_BOT_NAME

def normalize_bot_api_url(value, model=""):
    raw = str(value or "").strip()
    if not raw: return ""
    if "?" in raw or "#" in raw: return raw
    url = raw.rstrip("/")
    lowered = url.lower()
    model_lower = str(model or "").strip().lower()
    prefer_responses = "codex" in model_lower
    if lowered.endswith("/responses"): return url
    if lowered.endswith("/chat/completions"):
        if prefer_responses: return f"{url[: -len('/chat/completions')]}/responses"
        return url
    if lowered.endswith("/v1"):
        return f"{url}/responses" if prefer_responses else f"{url}/chat/completions"
    parsed = urllib.parse.urlparse(url)
    if parsed.path in ("", "/"):
        return f"{url}/v1/responses" if prefer_responses else f"{url}/v1/chat/completions"
    return url

def merge_bot_config(payload=None):
    config = default_bot_config()
    source = payload or {}
    if not isinstance(source, dict): return config
    # 支持自定义名称
    if source.get("name"):
        config["name"] = str(source.get("name")).strip() or DEFAULT_BOT_NAME
    
    config["enabled"] = bool(source.get("enabled", config["enabled"]))
    config["api_key"] = str(source.get("api_key", config["api_key"])).strip()
    config["model"] = str(source.get("model", config["model"])).strip()
    config["api_url"] = normalize_bot_api_url(source.get("api_url", config["api_url"]), model=config["model"])
    config["system_prompt"] = str(source.get("system_prompt", config["system_prompt"])).strip() or config["system_prompt"]
    config["proactive_enabled"] = bool(source.get("proactive_enabled", config["proactive_enabled"]))
    
    try: 
        config["reply_probability"] = max(0.0, min(1.0, float(source.get("reply_probability", config["reply_probability"]))))
    except (TypeError, ValueError): 
        pass
        
    try: 
        config["proactive_probability"] = max(0.0, min(1.0, float(source.get("proactive_probability", config["proactive_probability"]))))
    except (TypeError, ValueError): 
        pass
        
    return config

def load_bot_config():
    global BOT_CONFIG
    if os.path.exists(BOT_CONFIG_PATH):
        try:
            with open(BOT_CONFIG_PATH, "r", encoding="utf-8") as handle:
                BOT_CONFIG = merge_bot_config(json.load(handle))
                return
        except (OSError, json.JSONDecodeError): pass
    BOT_CONFIG = default_bot_config()

def save_bot_config():
    try:
        with open(BOT_CONFIG_PATH, "w", encoding="utf-8") as handle:
            json.dump(BOT_CONFIG, handle, ensure_ascii=False, indent=2)
    except OSError: pass

def bot_enabled():
    return bool(BOT_CONFIG.get("enabled") and BOT_CONFIG.get("api_url") and BOT_CONFIG.get("api_key") and BOT_CONFIG.get("model"))

def bot_public_config():
    return {
        "name": get_bot_name(),
        "enabled": bool(BOT_CONFIG.get("enabled")),
        "api_url": BOT_CONFIG.get("api_url", ""),
        "api_key": BOT_CONFIG.get("api_key", ""),
        "model": BOT_CONFIG.get("model", ""),
        "system_prompt": BOT_CONFIG.get("system_prompt", ""),
        "proactive_enabled": bool(BOT_CONFIG.get("proactive_enabled", True)),
        "reply_probability": BOT_CONFIG.get("reply_probability", 0.7),
        "proactive_probability": BOT_CONFIG.get("proactive_probability", 0.3),
        "ready": bot_enabled(),
        "cooldown_seconds": bot_cooldown_remaining(),
    }

def bot_log(message, level="INFO"):
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] [{level}] {str(message)}"
    try:
        with open(BOT_API_LOG, "a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    except OSError: pass

def bot_cooldown_remaining():
    with LOCK:
        until = float(BOT_STATE.get("cooldown_until") or 0.0)
    return max(0, int(until - time.time()))

def bot_in_cooldown(): return bot_cooldown_remaining() > 0

def bot_log_cooldown_skip(source):
    remaining = bot_cooldown_remaining()
    if remaining <= 0: return
    now = time.time()
    should_log = False
    with LOCK:
        last = float(BOT_STATE.get("last_cooldown_log_ts") or 0.0)
        if now - last >= BOT_COOLDOWN_LOG_INTERVAL:
            BOT_STATE["last_cooldown_log_ts"] = now
            should_log = True
    if should_log: bot_log(f"Bot cooldown active ({remaining}s left), skip {source}", "WARN")

def bot_try_acquire_api_slot():
    with LOCK:
        if BOT_STATE.get("api_inflight"): return False
        BOT_STATE["api_inflight"] = True
        return True

def bot_release_api_slot():
    with LOCK: BOT_STATE["api_inflight"] = False

def bot_log_busy_skip(source):
    now = time.time()
    should_log = False
    with LOCK:
        last = float(BOT_STATE.get("last_busy_log_ts") or 0.0)
        if now - last >= BOT_BUSY_LOG_INTERVAL:
            BOT_STATE["last_busy_log_ts"] = now
            should_log = True
    if should_log: bot_log(f"Bot request busy, skip {source}", "WARN")

def bot_record_failure(reason, status_code=None):
    now = time.time()
    reason_text = str(reason or "")
    severe_block = (status_code == 403 and "1010" in reason_text)
    cooldown_seconds = BOT_FAILURE_COOLDOWN_SECONDS
    if severe_block: cooldown_seconds = max(BOT_FAILURE_COOLDOWN_SECONDS, BOT_SEVERE_BLOCK_COOLDOWN_SECONDS)
    with LOCK:
        streak = int(BOT_STATE.get("failure_streak") or 0) + 1
        BOT_STATE["failure_streak"] = streak
        cooldown_set = False
        cooldown_until = float(BOT_STATE.get("cooldown_until") or 0.0)
        cooldown_was_active = cooldown_until > now
        if severe_block or streak >= BOT_FAILURE_STREAK_THRESHOLD:
            new_until = now + cooldown_seconds
            if new_until > cooldown_until:
                BOT_STATE["cooldown_until"] = new_until
                cooldown_until = new_until
            cooldown_set = not cooldown_was_active
    if cooldown_set:
        remain = max(0, int(cooldown_until - now))
        bot_log(f"Bot entered cooldown for {remain}s (streak={streak}, reason={reason_text[:120]})", "WARN")

def bot_record_success():
    with LOCK:
        prev_streak = int(BOT_STATE.get("failure_streak") or 0)
        had_cooldown = float(BOT_STATE.get("cooldown_until") or 0.0) > time.time()
        BOT_STATE["failure_streak"] = 0
        BOT_STATE["cooldown_until"] = 0.0
    if prev_streak or had_cooldown: bot_log("Bot recovered from previous failures", "INFO")

def start_bot_log_window():
    global BOT_LOG_WINDOW_STARTED
    if BOT_LOG_WINDOW_STARTED: return
    BOT_LOG_WINDOW_STARTED = True
    if os.name != "nt": return
    try:
        if not os.path.exists(BOT_API_LOG):
            with open(BOT_API_LOG, "a", encoding="utf-8"): pass
    except OSError: pass

def bot_contains_mention(text):
    value = str(text or "")
    if not value: return False
    bot_name = get_bot_name()
    pattern = r"@\s*" + re.escape(bot_name)
    return re.search(pattern, value) is not None

def bot_recent_room_messages(room, limit=BOT_HISTORY_LIMIT):
    room_key = normalize_room(room).lower()
    if not room_key: return []
    picked = []
    with LOCK:
        for msg in reversed(MESSAGES):
            if (msg.get("scope") or "room") != "room": continue
            if normalize_room(msg.get("room", "")).lower() != room_key: continue
            if msg.get("type") not in ("chat", "file"): continue
            if normalize_username(msg.get("user", "")) == get_bot_name(): continue
            picked.append(msg)
            if len(picked) >= limit: break
    picked.reverse()
    return picked

def bot_extract_tokens(text): return set(re.findall(r"[\u4e00-\u9fffA-Za-z0-9_]{2,}", str(text or "").lower()))

def bot_history_related(history_lines, text):
    query_tokens = bot_extract_tokens(text)
    if not query_tokens: return False
    history_tokens = bot_extract_tokens(" ".join(history_lines))
    if not history_tokens: return False
    return len(query_tokens.intersection(history_tokens)) > 0

def bot_format_history(messages):
    lines = []
    for msg in messages:
        sender = normalize_username(msg.get("user", "")) or "用户"
        if msg.get("type") == "file":
            file_name = str((msg.get("file") or {}).get("name", "")).strip()
            lines.append(f"{sender}: 分享了文件 {file_name}" if file_name else f"{sender}: 分享了文件")
        else:
            lines.append(f"{sender}: {str(msg.get('text', '')).strip()}")
    return [line for line in lines if line]

def bot_extract_text_from_response(payload):
    if not isinstance(payload, dict): return ""
    output_text = payload.get("output_text")
    if isinstance(output_text, str) and output_text.strip(): return output_text.strip()
    output = payload.get("output")
    if isinstance(output, list):
        parts = []
        for item in output:
            if not isinstance(item, dict): continue
            content = item.get("content")
            if not isinstance(content, list): continue
            for chunk in content:
                if not isinstance(chunk, dict): continue
                chunk_text = chunk.get("text")
                chunk_type = str(chunk.get("type", "")).strip().lower()
                if chunk_type in ("output_text", "text") and isinstance(chunk_text, str) and chunk_text.strip():
                    parts.append(chunk_text.strip())
        if parts: return "\n".join(parts).strip()
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices: return ""
    first = choices[0] or {}
    message = first.get("message") or {}
    content = message.get("content")
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(str(item.get("text", "")))
        content = "\n".join(parts).strip()
    if isinstance(content, str) and content.strip(): return content.strip()
    text = first.get("text")
    if isinstance(text, str): return text.strip()
    return ""

def bot_call_api(messages):
    if bot_in_cooldown():
        bot_log_cooldown_skip("api_request")
        return None, f"bot_cooldown:{bot_cooldown_remaining()}"
    api_url = str(BOT_CONFIG.get("api_url", "")).strip()
    api_key = str(BOT_CONFIG.get("api_key", "")).strip()
    model = str(BOT_CONFIG.get("model", "")).strip()
    if not (api_url and api_key and model):
        return None, "机器人配置不完整"
    
    lower_url = api_url.lower()
    use_responses = lower_url.endswith("/responses")
    if (not use_responses) and lower_url.endswith("/chat/completions") and ("codex" in model.lower()):
        api_url = api_url[: -len("/chat/completions")] + "/responses"
        use_responses = True

    if use_responses:
        payload = {"model": model, "input": messages, "store": False}
        if "codex" in model.lower(): payload["reasoning"] = {"effort": "high"}
    else:
        payload = {"model": model, "messages": messages, "temperature": 0.8}
    
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(api_url, data=data, method="POST", headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}", "User-Agent": "LanChatBot/1.0"})
    
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as err:
        detail = ""
        try: detail = err.read().decode("utf-8", errors="replace")
        except Exception: pass
        bot_record_failure(detail or f"http_{err.code}", status_code=err.code)
        return None, f"HTTP {err.code}"
    except Exception as err:
        bot_record_failure(str(err))
        return None, str(err)

    try: parsed = json.loads(body)
    except json.JSONDecodeError: return None, "API 返回无效 JSON"
    
    text = bot_extract_text_from_response(parsed)
    if not text: return None, "API did not return usable content"
    bot_record_success()
    return text, None

def bot_build_messages(room, trigger_text="", proactive=False):
    room_name = normalize_room(room) or DEFAULT_ROOMS[0]
    history_msgs = bot_recent_room_messages(room_name, BOT_HISTORY_LIMIT)
    history_lines = bot_format_history(history_msgs)
    related = bot_history_related(history_lines, trigger_text)
    prompt_parts = []
    if proactive: prompt_parts.append("你准备在群聊里主动说一句自然的话。")
    else: prompt_parts.append("请回复用户在群聊中的消息。")
    if trigger_text: prompt_parts.append(f"用户消息：{trigger_text}")
    prompt_parts.append("语气自然，1-4句，尽量不超过120字。")
    if history_lines and related: prompt_parts.extend(["最近聊天记录："] + history_lines)
    prompt_parts.append(f"当前房间：{room_name}")
    system_prompt = str(BOT_CONFIG.get("system_prompt", "")).strip() or default_bot_config()["system_prompt"]
    return [{"role": "system", "content": system_prompt}, {"role": "user", "content": "\n".join(prompt_parts)}]

def bot_add_message(room, text):
    cleaned = str(text or "").strip()
    if not cleaned: return False
    if len(cleaned) > 800: cleaned = cleaned[:800]
    payload_msg = {"type": "chat", "user": get_bot_name(), "text": cleaned, "scope": "room", "room": normalize_room(room) or DEFAULT_ROOMS[0]}
    add_message(payload_msg)
    return True

def bot_reply_worker(room, trigger_text="", proactive=False, delay_s=0):
    if delay_s > 0: time.sleep(delay_s)
    if not bot_enabled(): return
    if bot_in_cooldown(): return
    if not bot_try_acquire_api_slot(): return
    try:
        messages = bot_build_messages(room, trigger_text=trigger_text, proactive=proactive)
        reply, err = bot_call_api(messages)
        if err: return
        bot_add_message(room, reply)
    except Exception: pass
    finally: bot_release_api_slot()

def bot_spawn_reply(room, trigger_text="", proactive=False, delay_range=(2, 6)):
    if not bot_enabled(): return
    if bot_in_cooldown(): return
    delay_s = random.randint(delay_range[0], delay_range[1]) if delay_range else 0
    threading.Thread(target=bot_reply_worker, args=(room, trigger_text, proactive, delay_s), daemon=True).start()

def bot_proactive_loop():
    while True:
        try:
            time.sleep(random.randint(BOT_PROACTIVE_DELAY_RANGE[0], BOT_PROACTIVE_DELAY_RANGE[1]))
            if not bot_enabled() or bot_in_cooldown() or not bool(BOT_CONFIG.get("proactive_enabled", True)): continue
            if random.random() > float(BOT_CONFIG.get("proactive_probability", 0.3) or 0.0): continue
            room = DEFAULT_ROOMS[0]
            if time.time() - float(BOT_STATE.get("last_bot_room_ts") or 0.0) < 10: continue
            bot_spawn_reply(room, proactive=True, delay_range=(2, 5))
        except Exception: pass

def bot_on_new_message(msg):
    if not bot_enabled() or bot_in_cooldown(): return
    if (msg.get("scope") or "room") != "room" or msg.get("type") not in ("chat", "file"): return
    user = normalize_username(msg.get("user", ""))
    if user == get_bot_name(): return
    room = normalize_room(msg.get("room", ""))
    if not room: return
    text = str(msg.get("text", "")).strip()
    mentioned = bot_contains_mention(text)
    if mentioned:
        bot_spawn_reply(room, trigger_text=text, proactive=False, delay_range=(2, 5))
        return
    if random.random() < float(BOT_CONFIG.get("reply_probability", 0.7) or 0.0) * 0.25:
        bot_spawn_reply(room, trigger_text=text, proactive=False, delay_range=(4, 10))

def start_bot_threads():
    global BOT_THREADS_STARTED
    if BOT_THREADS_STARTED: return
    BOT_THREADS_STARTED = True
    threading.Thread(target=bot_proactive_loop, daemon=True).start()

def now_ts(): return int(time.time())

def ensure_dirs():
    if not getattr(sys, "frozen", False): os.makedirs(WEB_DIR, exist_ok=True)
    os.makedirs(ROOT_DATA_DIR, exist_ok=True)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)

def backup_file_once(path):
    if path in BACKED_UP_FILES or not os.path.isfile(path): return
    stamp = time.strftime("%Y%m%d-%H%M%S")
    backup_path = f"{path}.{stamp}.bak"
    try:
        shutil.copy2(path, backup_path)
        BACKED_UP_FILES.add(path)
    except OSError: pass

def repair_known_text(value):
    text = str(value or "")
    if not text: return text
    return text

def repair_message_record(message):
    if not isinstance(message, dict): return message, False
    repaired = dict(message)
    changed = False
    for field in ("user", "to", "room"):
        original = repaired.get(field)
        if isinstance(original, str):
            fixed = repair_known_text(original)
            if fixed != original: repaired[field] = fixed; changed = True
    text_value = repaired.get("text")
    if isinstance(text_value, str):
        fixed_text = repair_known_text(text_value)
        if fixed_text != text_value: repaired["text"] = fixed_text; changed = True
    file_info = repaired.get("file")
    if isinstance(file_info, dict):
        fixed_file = dict(file_info)
        mime = fixed_file.get("mime")
        if not mime and fixed_file.get("name"):
            guessed, _ = mimetypes.guess_type(fixed_file["name"])
            fixed_file["mime"] = guessed or "application/octet-stream"
            changed = True
        repaired["file"] = fixed_file
    return repaired, changed

def safe_filename(name):
    name = os.path.basename(name or "")
    base, ext = os.path.splitext(name)
    def clean(text, allow_dot=False):
        cleaned = []
        for ch in text:
            is_ascii = ch.isascii() if hasattr(str, "isascii") else ord(ch) < 128
            if is_ascii and (ch.isalnum() or ch in ("-", "_") or (allow_dot and ch == ".")): cleaned.append(ch)
            else: cleaned.append("_")
        return "".join(cleaned)
    base_clean = clean(base, allow_dot=True).strip("_")
    if not base_clean: base_clean = "file"
    ext_clean = clean(ext.lstrip("."), allow_dot=False).strip("_")
    max_len = 120
    if ext_clean:
        max_base = max_len - len(ext_clean) - 1
        if max_base < 1: base_clean = base_clean[:1]
        else: base_clean = base_clean[:max_base]
        return f"{base_clean}.{ext_clean}"
    return base_clean[:max_len]

def unique_name(directory, filename):
    base, ext = os.path.splitext(filename)
    candidate = filename
    counter = 1
    while os.path.exists(os.path.join(directory, candidate)):
        candidate = f"{base}_{counter}{ext}"
        counter += 1
    return candidate

def log_exception(context, err):
    try:
        with open(ERROR_LOG, "a", encoding="utf-8") as handle:
            handle.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {context}: {err}\n")
    except OSError: pass

def normalize_username(value):
    name = str(value or "").strip()
    if not name: return ""
    if len(name) > 24: name = name[:24]
    return name

def is_valid_username(name):
    if not name or len(name) > 24 or ":" in name or name in ("匿名", "anonymous"): return False
    return True

def normalize_room(value):
    name = str(value or "").strip()
    if not name: return ""
    if len(name) > 24: name = name[:24]
    return name

def is_valid_room(name):
    if not name or len(name) > 24 or ":" in name: return False
    return True

def load_rooms():
    global ROOMS
    rooms = []
    repaired = False
    if os.path.exists(ROOMS_PATH):
        try:
            with open(ROOMS_PATH, "r", encoding="utf-8") as handle: raw = json.load(handle)
            if isinstance(raw, list):
                for item in raw:
                    normalized = normalize_room(repair_known_text(item))
                    if normalized: rooms.append(normalized)
                    if normalized != item: repaired = True
        except (OSError, json.JSONDecodeError): rooms = []
    if not rooms: rooms = DEFAULT_ROOMS[:]
    seen = set(); cleaned = []
    for item in rooms:
        key = item.lower()
        if key not in seen: seen.add(key); cleaned.append(item)
    ROOMS = cleaned
    if repaired: backup_file_once(ROOMS_PATH)
    save_rooms()

def save_rooms():
    try:
        with open(ROOMS_PATH, "w", encoding="utf-8") as handle: json.dump(ROOMS, handle, ensure_ascii=False, indent=2)
    except OSError: pass

def list_rooms(): return ROOMS[:]

def add_room(name):
    name = normalize_room(name)
    if not is_valid_room(name): return False, "房间名称不合法"
    with LOCK:
        if name.lower() in [room.lower() for room in ROOMS]: return False, "房间已存在"
        ROOMS.append(name); save_rooms()
    return True, None

def is_default_room(name): return normalize_room(name).lower() in [room.lower() for room in DEFAULT_ROOMS]

def rewrite_messages():
    backup_file_once(LOG_PATH)
    try:
        with open(LOG_PATH, "w", encoding="utf-8") as handle:
            for msg in MESSAGES: handle.write(json.dumps(msg, ensure_ascii=False) + "\n")
    except OSError: pass

def clear_server_history(clear_files=True):
    removed_messages, removed_files, removed_bytes = 0, 0, 0
    with LOCK:
        removed_messages = len(MESSAGES)
        MESSAGES[:] = []
    backup_file_once(LOG_PATH)
    try:
        with open(LOG_PATH, "w", encoding="utf-8"): pass
    except OSError: pass
    if clear_files:
        try:
            for name in os.listdir(UPLOAD_DIR):
                file_path = os.path.join(UPLOAD_DIR, name)
                if not os.path.isfile(file_path): continue
                try: removed_bytes += os.path.getsize(file_path)
                except OSError: pass
                try: os.remove(file_path); removed_files += 1
                except OSError: continue
        except OSError: pass
    return {"removed_messages": removed_messages, "removed_files": removed_files, "removed_file_bytes": removed_bytes}

def delete_room(name):
    room = normalize_room(name)
    if not is_valid_room(room): return False, "房间名称不合法", 0
    if is_default_room(room): return False, "默认房间不能删除", 0
    with LOCK:
        existing = None
        for item in ROOMS:
            if item.lower() == room.lower(): existing = item; break
        if not existing: return False, "房间不存在", 0
        ROOMS[:] = [item for item in ROOMS if item.lower() != room.lower()]
        removed = [msg for msg in MESSAGES if (msg.get("scope") or "room") == "room" and str(msg.get("room", "")).lower() == room.lower()]
        MESSAGES[:] = [msg for msg in MESSAGES if not ((msg.get("scope") or "room") == "room" and str(msg.get("room", "")).lower() == room.lower())]
        if removed: rewrite_messages()
        backup_file_once(ROOMS_PATH); save_rooms()
    return True, None, len(removed)

def load_messages():
    global NEXT_ID
    if not os.path.exists(LOG_PATH): return
    repaired_messages = []; changed = False
    try:
        with open(LOG_PATH, "r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line: continue
                try: msg = json.loads(line)
                except json.JSONDecodeError: continue
                if "id" in msg:
                    repaired, was_changed = repair_message_record(msg)
                    MESSAGES.append(repaired)
                    repaired_messages.append(repaired)
                    NEXT_ID = max(NEXT_ID, int(repaired["id"]) + 1)
                    changed = changed or was_changed
    except OSError: return
    if len(MESSAGES) > MAX_MESSAGES: MESSAGES[:] = MESSAGES[-MAX_MESSAGES:]; repaired_messages = repaired_messages[-MAX_MESSAGES:]
    if changed:
        backup_file_once(LOG_PATH)
        try:
            with open(LOG_PATH, "w", encoding="utf-8") as handle:
                for msg in repaired_messages: handle.write(json.dumps(msg, ensure_ascii=False) + "\n")
        except OSError: pass

def persist_message(msg):
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as handle: handle.write(json.dumps(msg, ensure_ascii=False) + "\n")
    except OSError: pass

def add_message(msg):
    global NEXT_ID
    with LOCK:
        msg["id"] = NEXT_ID; NEXT_ID += 1
        msg["ts"] = now_ts()
        MESSAGES.append(msg)
        if len(MESSAGES) > MAX_MESSAGES: MESSAGES.pop(0)
        persist_message(msg)
        if (msg.get("scope") or "room") == "room":
            user = normalize_username(msg.get("user", ""))
            if user == get_bot_name(): BOT_STATE["last_bot_room_ts"] = time.time()
            elif msg.get("type") != "system": BOT_STATE["last_user_room_ts"] = time.time()
        latest = msg["id"]
    return latest

def prune_users(current_time):
    stale = [name for name, info in USERS.items() if current_time - info["last"] > PRESENCE_TTL]
    for name in stale: USERS.pop(name, None)

def update_presence(username, ip, previous=None):
    current_time = time.time()
    with LOCK:
        # 1. 检查该 IP 是否已经以其他名字存在（防止改名后出现重复用户）
        existing_name = None
        for name, info in USERS.items():
            if info.get("ip") == ip:
                existing_name = name
                break
        
        # 如果该 IP 已经在线，且请求的用户名和服务器记录的不一致
        if existing_name and existing_name != username:
            # 强制使用服务器已有的名字（即管理员改后的名字），忽略客户端传来的旧名字
            # 只更新心跳时间，不创建新用户
            USERS[existing_name]["last"] = current_time
            # 如果客户端传来的 previous 和 existing_name 也不一样，清理掉
            if previous and previous != existing_name:
                USERS.pop(previous, None)
            return

        # 2. 正常更新逻辑
        if previous and previous != username: USERS.pop(previous, None)
        USERS[username] = {"last": current_time, "ip": ip}
        prune_users(current_time)

def list_users(include_ip=False):
    with LOCK:
        prune_users(time.time())
        entries = []
        for name, info in USERS.items():
            entry = {"name": name, "muted": info["ip"] in MUTED_IPS}
            if include_ip: entry["ip"] = info["ip"]
            entries.append(entry)
        entries.sort(key=lambda x: x["name"].lower())
    return entries

def get_messages_since(since_id):
    with LOCK:
        if not MESSAGES: return [], 0
        selected = [m for m in MESSAGES if m["id"] > since_id]
        latest = MESSAGES[-1]["id"]
    return selected, latest

def message_visible(msg, username):
    scope = msg.get("scope") or "room"
    if scope == "dm":
        if not username: return False
        return msg.get("user") == username or msg.get("to") == username
    return True

def filter_messages(messages, username, scope=None, room=None, peer=None):
    results = []
    for msg in messages:
        if not message_visible(msg, username): continue
        msg_scope = msg.get("scope") or "room"
        if scope and msg_scope != scope: continue
        if msg_scope == "room" and room and msg.get("room") != room: continue
        if msg_scope == "dm" and peer:
            if not ((msg.get("user") == username and msg.get("to") == peer) or (msg.get("user") == peer and msg.get("to") == username)): continue
        results.append(msg)
    return results

def list_uploads():
    files = []
    try:
        with os.scandir(UPLOAD_DIR) as entries:
            for entry in entries:
                if not entry.is_file(): continue
                stat = entry.stat()
                files.append({"name": entry.name, "size": stat.st_size, "mtime": int(stat.st_mtime), "url": f"/files/{urllib.parse.quote(entry.name)}", "mime": mimetypes.guess_type(entry.name)[0] or "application/octet-stream"})
    except OSError: return []
    files.sort(key=lambda f: f["mtime"], reverse=True)
    return files

def get_conversation_stats(username, scope=None, room=None, peer=None):
    with LOCK: pool = MESSAGES[:]
    visible = filter_messages(pool, username, scope=scope, room=room, peer=peer)
    file_count = 0; participants = set(); latest = None
    for msg in visible:
        latest = msg
        if msg.get("type") == "file" and msg.get("file"): file_count += 1
        user = normalize_username(msg.get("user", ""))
        if user and msg.get("type") != "system": participants.add(user)
        target = normalize_username(msg.get("to", ""))
        if target: participants.add(target)
    latest_summary = None
    if latest: latest_summary = {"id": latest.get("id"), "ts": latest.get("ts"), "user": latest.get("user"), "text": latest.get("text"), "type": latest.get("type")}
    return {"messageCount": len(visible), "fileCount": file_count, "participantCount": len(participants), "latest": latest_summary}

def prune_kicked(current_time):
    expired = [ip for ip, until in KICKED_IPS.items() if current_time >= until]
    for ip in expired: KICKED_IPS.pop(ip, None)

def is_kicked(ip):
    with LOCK: prune_kicked(time.time()); return ip in KICKED_IPS

def is_muted(ip):
    with LOCK:
        if ip in MUTED_IPS:
            until = MUTED_IPS[ip].get("until", 0)
            if time.time() < until:
                return True
            else:
                # 已过期，移除禁言状态
                del MUTED_IPS[ip]
    return False

def kick_user(name, duration):
    with LOCK:
        info = USERS.get(name)
        if not info: return False, "用户不在线"
        ip = info["ip"]
        KICKED_IPS[ip] = time.time() + duration
        USERS.pop(name, None)
    return True, None

# 修改：mute_user 支持自定义时长
def mute_user(name, duration_minutes):
    with LOCK:
        info = USERS.get(name)
        if not info: return False, "用户不在线"
        ip = info["ip"]
        # 0 分钟视为永久 (100年)
        if duration_minutes == 0:
            duration_seconds = 100 * 365 * 24 * 60 * 60
        else:
            duration_seconds = duration_minutes * 60
        
        until_ts = time.time() + duration_seconds
        MUTED_IPS[ip] = {"name": name, "ts": time.time(), "until": until_ts}
    return True, None

def unmute_user(name):
    with LOCK:
        info = USERS.get(name)
        if info:
            if info["ip"] in MUTED_IPS:
                del MUTED_IPS[info["ip"]]
                return True, None
        # 处理离线用户解禁
        removed = False
        for ip, data in list(MUTED_IPS.items()):
            if data.get("name") == name: 
                del MUTED_IPS[ip]
                removed = True
        if removed: return True, None
    return False, "用户不在线"

def issue_admin_token():
    token = secrets.token_hex(16)
    ADMIN_TOKENS[token] = time.time()
    return token

def is_admin_token(token):
    if not token: return False
    now = time.time()
    expired = [t for t, ts in ADMIN_TOKENS.items() if now - ts > ADMIN_TOKEN_TTL]
    for t in expired: ADMIN_TOKENS.pop(t, None)
    if token in ADMIN_TOKENS:
        ADMIN_TOKENS[token] = now
        return True
    return False

# ================= HTTP 服务类 =================

class ChatHandler(BaseHTTPRequestHandler):
    server_version = "LanChat/2.0"

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path == "/": return self.serve_index()
        if path.startswith("/static/"): return self.serve_static(path[len("/static/"):])
        if path == "/api/poll": return self.handle_poll(parsed.query)
        if path == "/api/users": return self.handle_users()
        if path == "/api/rooms": return self.handle_rooms()
        if path == "/api/files": return self.handle_files()
        if path == "/api/conversation": return self.handle_conversation(parsed.query)
        if path == "/api/search": return self.handle_search(parsed.query)
        if path.startswith("/files/"): return self.handle_download(path[len("/files/"):])
        if path == "/api/admin/status": return self.handle_admin_status()
        if path == "/api/admin/bot": return self.handle_admin_bot_get()
        return self.send_text(404, "Not Found")

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path == "/api/send": return self.handle_send()
        if path == "/api/presence": return self.handle_presence()
        if path == "/api/upload": return self.handle_upload()
        if path == "/api/rooms": return self.handle_room_create()
        if path == "/api/admin/login": return self.handle_admin_login()
        if path == "/api/admin/logout": return self.handle_admin_logout()
        if path == "/api/admin/bot": return self.handle_admin_bot_set()
        if path == "/api/admin/history/clear": return self.handle_admin_history_clear()
        if path == "/api/admin/rooms/delete": return self.handle_admin_room_delete()
        if path == "/api/admin/mute": return self.handle_admin_mute()
        if path == "/api/admin/kick": return self.handle_admin_kick()
        if path == "/api/admin/rename": return self.handle_admin_rename() # 新增
        return self.send_text(404, "Not Found")

    def client_ip(self): return self.client_address[0]
    def is_admin(self): return is_admin_token(self.headers.get("X-Admin-Token", ""))

    def serve_index(self):
        index_path = os.path.join(WEB_DIR, "index.html")
        return self.send_file(index_path, "text/html; charset=utf-8")

    def serve_static(self, rel_path):
        rel_path = rel_path.lstrip("/")
        safe_path = os.path.normpath(rel_path)
        if safe_path.startswith("..") or os.path.isabs(safe_path): return self.send_text(400, "Bad Request")
        file_path = os.path.join(WEB_DIR, safe_path)
        if not os.path.isfile(file_path): return self.send_text(404, "Not Found")
        content_type, _ = mimetypes.guess_type(file_path)
        return self.send_file(file_path, content_type or "application/octet-stream")

    def handle_upload(self):
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            return self.send_json(400, {"error": "请求格式错误"})

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return self.send_json(400, {"error": "长度无效"})

        body = self.rfile.read(length)
        
        boundary = None
        for item in content_type.split(';'):
            item = item.strip()
            if item.startswith("boundary="):
                boundary = item[len("boundary="):].strip('"')
                break
        
        if not boundary:
            return self.send_json(400, {"error": "无法解析分界符"})

        delimiter = (b"--" + boundary.encode('utf-8'))
        form_data = {}
        files = []
        
        parts = body.split(delimiter)
        
        for part in parts:
            if not part or part.strip() == b"" or part.strip() == b"--":
                continue
            
            part = part.strip(b'\r\n')
            header_end = part.find(b'\r\n\r\n')
            if header_end == -1:
                continue
            
            headers_raw = part[:header_end].decode('utf-8', errors='ignore')
            content_data = part[header_end + 4:]
            
            if content_data.endswith(b'\r\n'):
                content_data = content_data[:-2]

            cd_line = ""
            for line in headers_raw.split('\r\n'):
                if line.lower().startswith("content-disposition:"):
                    cd_line = line
                    break
            
            if not cd_line: continue

            name = None
            filename = None
            
            name_match = re.search(r'name="([^"]+)"', cd_line)
            if name_match: name = name_match.group(1)
            
            filename_match = re.search(r'filename="([^"]+)"', cd_line)
            if filename_match: filename = filename_match.group(1)

            if filename:
                files.append({"name": name, "filename": filename, "data": content_data})
            elif name:
                form_data[name] = content_data.decode('utf-8', errors='ignore')

        username = normalize_username(form_data.get("username", ""))
        if not is_valid_username(username):
            return self.send_json(400, {"error": "请先设置用户名"})
        
        ip = self.client_ip()
        if is_kicked(ip):
            return self.send_json(403, {"error": "你已被管理员踢出", "code": "kicked"})
        if is_muted(ip):
            return self.send_json(403, {"error": "你已被管理员禁言", "code": "muted"})

        if not files:
            return self.send_json(400, {"error": "未选择文件或文件内容为空"})

        file_item = files[0]
        if not file_item['data']:
             return self.send_json(400, {"error": "文件内容读取失败，请重试"})

        safe_name = safe_filename(file_item['filename'])
        safe_name = unique_name(UPLOAD_DIR, safe_name)
        file_path = os.path.join(UPLOAD_DIR, safe_name)

        try:
            with open(file_path, "wb") as f:
                f.write(file_item['data'])
        except OSError as e:
            log_exception("file_write", e)
            return self.send_json(500, {"error": "保存文件失败"})

        scope = str(form_data.get("scope", "room")).strip().lower()
        room = normalize_room(form_data.get("room", ""))
        peer = normalize_username(form_data.get("to", ""))
        
        if scope not in ("room", "dm"): scope = "room"
        if scope == "dm":
            if not peer or peer == username:
                return self.send_json(400, {"error": "私聊对象无效"})
        else:
            if not room: room = DEFAULT_ROOMS[0]

        file_info = {
            "name": safe_name,
            "size": len(file_item['data']),
            "url": f"/files/{urllib.parse.quote(safe_name)}",
            "mime": mimetypes.guess_type(file_path)[0] or "application/octet-stream",
        }
        
        update_presence(username, ip)
        payload_msg = {
            "type": "file",
            "user": username,
            "text": f"上传了 {safe_name}",
            "file": file_info,
            "scope": scope,
        }
        if scope == "room":
            payload_msg["room"] = room
        else:
            payload_msg["to"] = peer
        
        add_message(payload_msg)
        if scope == "room":
            bot_on_new_message(payload_msg)
            
        return self.send_json(200, {"ok": True, "file": file_info})

    # 修改：handle_poll 返回服务器 IP
    def handle_poll(self, query):
        params = urllib.parse.parse_qs(query)
        try: since_id = int(params.get("since", ["0"])[0])
        except ValueError: since_id = 0
        username = normalize_username(params.get("user", [""])[0])
        ip = self.client_ip()
        if username and is_valid_username(username):
            if is_kicked(ip): return self.send_json(403, {"error": "你已被管理员踢出", "code": "kicked"})
            update_presence(username, ip)
        messages, latest = get_messages_since(since_id)
        visible = filter_messages(messages, username)
        users = list_users(include_ip=self.is_admin())
        rooms = list_rooms()
        
        # 新增：返回服务器 IP 信息
        server_ip = get_local_ip()
        
        return self.send_json(200, {
            "messages": visible, 
            "latest": latest, 
            "users": users, 
            "rooms": rooms,
            "serverIp": server_ip,
            "serverPort": SERVER_PORT
        })

    def handle_files(self): return self.send_json(200, {"files": list_uploads()})
    def handle_users(self): return self.send_json(200, {"users": list_users(include_ip=self.is_admin())})
    def handle_rooms(self): return self.send_json(200, {"rooms": list_rooms()})
    
    def handle_search(self, query):
        params = urllib.parse.parse_qs(query)
        username = normalize_username(params.get("user", [""])[0])
        if not is_valid_username(username): return self.send_json(400, {"error": "请先设置用户名"})
        keyword = str(params.get("q", [""])[0]).strip()
        if not keyword: return self.send_json(400, {"error": "请输入搜索关键字"})
        scope = str(params.get("scope", [""])[0]).strip().lower() or None
        if scope not in (None, "", "room", "dm"): scope = None
        room = normalize_room(params.get("room", [""])[0]) or None
        peer = normalize_username(params.get("peer", [""])[0]) or None
        try: limit = int(params.get("limit", ["100"])[0])
        except ValueError: limit = 100
        limit = max(10, min(limit, 200))
        with LOCK: pool = MESSAGES[:]
        visible = filter_messages(pool, username, scope=scope, room=room, peer=peer)
        keyword_lower = keyword.lower()
        results = []
        for msg in reversed(visible):
            text = str(msg.get("text", "")).lower()
            file_info = msg.get("file") or {}
            file_name = str(file_info.get("name", "")).lower()
            if keyword_lower in text or (file_name and keyword_lower in file_name):
                results.append(msg)
                if len(results) >= limit: break
        return self.send_json(200, {"results": results, "count": len(results)})

    def handle_conversation(self, query):
        params = urllib.parse.parse_qs(query)
        username = normalize_username(params.get("user", [""])[0])
        if not is_valid_username(username): return self.send_json(400, {"error": "请先设置用户名"})
        scope = str(params.get("scope", ["room"])[0]).strip().lower()
        if scope not in ("room", "dm"): scope = "room"
        room = normalize_room(params.get("room", [""])[0]) or None
        peer = normalize_username(params.get("peer", [""])[0]) or None
        if scope == "dm":
            if not peer or peer == username: return self.send_json(400, {"error": "私聊对象无效"})
            room = None
        else:
            if not room: room = DEFAULT_ROOMS[0]
            if room.lower() not in [item.lower() for item in list_rooms()]: return self.send_json(404, {"error": "房间不存在"})
            peer = None
        stats = get_conversation_stats(username, scope=scope, room=room, peer=peer)
        return self.send_json(200, stats)

    def handle_admin_status(self):
        return self.send_json(200, {"admin": self.is_admin(), "name": ADMIN_USERNAME, "botReady": bot_enabled(), "botName": get_bot_name()})

    def handle_admin_bot_get(self):
        if not self.is_admin(): return self.send_json(403, {"error": "需要管理员权限"})
        return self.send_json(200, bot_public_config())

    def handle_admin_bot_set(self):
        if not self.is_admin(): return self.send_json(403, {"error": "需要管理员权限"})
        try: length = int(self.headers.get("Content-Length", "0"))
        except ValueError: length = 0
        if length <= 0: return self.send_json(400, {"error": "请求内容为空"})
        try: raw = self.rfile.read(length).decode("utf-8"); payload = json.loads(raw)
        except (UnicodeDecodeError, json.JSONDecodeError): return self.send_json(400, {"error": "JSON 格式无效"})
        global BOT_CONFIG
        BOT_CONFIG = merge_bot_config(payload)
        save_bot_config()
        with LOCK:
            BOT_STATE["failure_streak"] = 0; BOT_STATE["cooldown_until"] = 0.0
        return self.send_json(200, {"ok": True, "config": bot_public_config()})

    def handle_download(self, raw_name):
        name = os.path.basename(urllib.parse.unquote(raw_name or ""))
        if not name: return self.send_text(404, "Not Found")
        file_path = os.path.join(UPLOAD_DIR, name)
        if not os.path.isfile(file_path): return self.send_text(404, "Not Found")
        content_type, _ = mimetypes.guess_type(file_path)
        headers = {}
        if not (content_type or "").startswith("image/"): headers["Content-Disposition"] = f'attachment; filename="{name}"'
        return self.send_file(file_path, content_type or "application/octet-stream", headers=headers)

    def handle_send(self):
        try: length = int(self.headers.get("Content-Length", "0"))
        except ValueError: length = 0
        if length <= 0: return self.send_json(400, {"error": "请求内容为空"})
        try: raw = self.rfile.read(length).decode("utf-8"); payload = json.loads(raw)
        except (UnicodeDecodeError, json.JSONDecodeError): return self.send_json(400, {"error": "JSON 格式无效"})
        username = normalize_username(payload.get("username", ""))
        if not is_valid_username(username): return self.send_json(400, {"error": "请先设置用户名"})
        ip = self.client_ip()
        if is_kicked(ip): return self.send_json(403, {"error": "你已被管理员踢出", "code": "kicked"})
        if is_muted(ip): return self.send_json(403, {"error": "你已被管理员禁言", "code": "muted"})
        text = str(payload.get("text", "")).strip()
        if not text: return self.send_json(400, {"error": "消息不能为空"})
        if len(text) > 2000: return self.send_json(400, {"error": "消息过长"})
        msg_type = str(payload.get("type", "chat")).strip().lower()
        if msg_type not in ("chat", "system"): msg_type = "chat"
        scope = str(payload.get("scope", "room")).strip().lower()
        if scope not in ("room", "dm"): scope = "room"
        room = normalize_room(payload.get("room", ""))
        peer = normalize_username(payload.get("to", ""))
        if scope == "dm":
            if not peer or peer == username: return self.send_json(400, {"error": "私聊对象无效"})
        else:
            if not room: room = DEFAULT_ROOMS[0]
            if not is_valid_room(room): return self.send_json(400, {"error": "房间名称不合法"})
            if room.lower() not in [item.lower() for item in list_rooms()]: return self.send_json(404, {"error": "房间不存在"})
        if msg_type == "system": username = "系统"
        if msg_type != "system": update_presence(username, ip)
        payload_msg = {"type": msg_type, "user": username, "text": text, "scope": scope}
        if scope == "room": payload_msg["room"] = room
        else: payload_msg["to"] = peer
        add_message(payload_msg)
        if msg_type != "system" and scope == "room": bot_on_new_message(payload_msg)
        return self.send_json(200, {"ok": True})

    def handle_presence(self):
        try: length = int(self.headers.get("Content-Length", "0"))
        except ValueError: length = 0
        if length <= 0: return self.send_json(400, {"error": "请求内容为空"})
        try: raw = self.rfile.read(length).decode("utf-8"); payload = json.loads(raw)
        except (UnicodeDecodeError, json.JSONDecodeError): return self.send_json(400, {"error": "JSON 格式无效"})
        username = normalize_username(payload.get("username", ""))
        if not is_valid_username(username): return self.send_json(400, {"error": "请先设置用户名"})
        ip = self.client_ip()
        if is_kicked(ip): return self.send_json(403, {"error": "你已被管理员踢出", "code": "kicked"})
        previous = normalize_username(payload.get("previous", ""))
        update_presence(username, ip, previous=previous)
        return self.send_json(200, {"ok": True, "users": list_users(include_ip=self.is_admin())})

    def handle_room_create(self):
        try: length = int(self.headers.get("Content-Length", "0"))
        except ValueError: length = 0
        if length <= 0: return self.send_json(400, {"error": "请求内容为空"})
        try: raw = self.rfile.read(length).decode("utf-8"); payload = json.loads(raw)
        except (UnicodeDecodeError, json.JSONDecodeError): return self.send_json(400, {"error": "JSON 格式无效"})
        username = normalize_username(payload.get("username", ""))
        if not is_valid_username(username): return self.send_json(400, {"error": "请先设置用户名"})
        ip = self.client_ip()
        if is_kicked(ip): return self.send_json(403, {"error": "你已被管理员踢出", "code": "kicked"})
        room = normalize_room(payload.get("room", ""))
        ok, reason = add_room(room)
        if not ok: return self.send_json(400, {"error": reason or "创建失败"})
        add_message({"type": "system", "user": "系统", "text": f"{username} 创建了房间 {room}", "scope": "room", "room": room})
        return self.send_json(200, {"ok": True, "rooms": list_rooms()})

    def handle_admin_room_delete(self):
        # 补全被截断的代码
        if not self.is_admin(): return self.send_json(403, {"error": "需要管理员权限"})
        try: length = int(self.headers.get("Content-Length", "0"))
        except ValueError: length = 0
        if length <= 0: return self.send_json(400, {"error": "请求内容为空"})
        try: raw = self.rfile.read(length).decode("utf-8"); payload = json.loads(raw)
        except (UnicodeDecodeError, json.JSONDecodeError): return self.send_json(400, {"error": "JSON 格式无效"})
        
        room_name = normalize_room(payload.get("room", ""))
        if not room_name: return self.send_json(400, {"error": "房间名无效"})
        
        ok, err, count = delete_room(room_name)
        if not ok: return self.send_json(400, {"error": err or "删除失败"})
        
        return self.send_json(200, {"ok": True, "removed": count, "rooms": list_rooms()})

    def handle_admin_mute(self):
        # 修改：支持自定义时间
        if not self.is_admin(): return self.send_json(403, {"error": "需要管理员权限"})
        try: length = int(self.headers.get("Content-Length", "0"))
        except ValueError: length = 0
        if length <= 0: return self.send_json(400, {"error": "请求内容为空"})
        try: raw = self.rfile.read(length).decode("utf-8"); payload = json.loads(raw)
        except (UnicodeDecodeError, json.JSONDecodeError): return self.send_json(400, {"error": "JSON 格式无效"})
        
        user = normalize_username(payload.get("user", ""))
        mute = bool(payload.get("mute", True))
        duration = int(payload.get("duration", 0)) # 分钟
        
        if not user: return self.send_json(400, {"error": "用户名无效"})
        
        if mute:
            ok, err = mute_user(user, duration)
        else:
            ok, err = unmute_user(user)
            
        if not ok: return self.send_json(400, {"error": err or "操作失败"})
        return self.send_json(200, {"ok": True, "users": list_users(include_ip=True)})

    def handle_admin_kick(self):
        if not self.is_admin(): return self.send_json(403, {"error": "需要管理员权限"})
        try: length = int(self.headers.get("Content-Length", "0"))
        except ValueError: length = 0
        if length <= 0: return self.send_json(400, {"error": "请求内容为空"})
        try: raw = self.rfile.read(length).decode("utf-8"); payload = json.loads(raw)
        except (UnicodeDecodeError, json.JSONDecodeError): return self.send_json(400, {"error": "JSON 格式无效"})
        user = normalize_username(payload.get("user", ""))
        if not user: return self.send_json(400, {"error": "用户名无效"})
        ok, err = kick_user(user, 300) # 默认踢出 5 分钟
        if not ok: return self.send_json(400, {"error": err or "操作失败"})
        return self.send_json(200, {"ok": True, "users": list_users(include_ip=True)})

    # 新增：管理员改名接口
    def handle_admin_rename(self):
        if not self.is_admin(): return self.send_json(403, {"error": "需要管理员权限"})
        try: length = int(self.headers.get("Content-Length", "0"))
        except ValueError: length = 0
        if length <= 0: return self.send_json(400, {"error": "请求内容为空"})
        try: raw = self.rfile.read(length).decode("utf-8"); payload = json.loads(raw)
        except (UnicodeDecodeError, json.JSONDecodeError): return self.send_json(400, {"error": "JSON 格式无效"})
        
        old_name = normalize_username(payload.get("old_name", ""))
        new_name = normalize_username(payload.get("new_name", ""))
        
        if not old_name or not new_name: return self.send_json(400, {"error": "用户名无效"})
        if old_name == new_name: return self.send_json(400, {"error": "新旧名称相同"})
        
        with LOCK:
            if old_name not in USERS: return self.send_json(404, {"error": "用户不在线"})
            if new_name in USERS: return self.send_json(400, {"error": "新名称已被占用"})
            
            info = USERS.pop(old_name)
            USERS[new_name] = info
        
        add_message({"type": "system", "user": "系统", "text": f"管理员将 {old_name} 改名为 {new_name}", "scope": "room", "room": DEFAULT_ROOMS[0]})
        return self.send_json(200, {"ok": True, "users": list_users(include_ip=True)})

    def handle_admin_login(self):
        try: length = int(self.headers.get("Content-Length", "0"))
        except ValueError: length = 0
        if length <= 0: return self.send_json(400, {"error": "请求内容为空"})
        try: raw = self.rfile.read(length).decode("utf-8"); payload = json.loads(raw)
        except (UnicodeDecodeError, json.JSONDecodeError): return self.send_json(400, {"error": "JSON 格式无效"})
        username = normalize_username(payload.get("username", ""))
        password = payload.get("password", "")
        if username != ADMIN_USERNAME or password != ADMIN_PASSWORD:
            return self.send_json(403, {"error": "用户名或密码错误"})
        token = issue_admin_token()
        return self.send_json(200, {"ok": True, "token": token, "name": ADMIN_USERNAME})

    def handle_admin_logout(self):
        # 简单移除 token 逻辑可以是客户端清除，服务端也可以不做处理因为是无状态的简单列表
        return self.send_json(200, {"ok": True})

    def handle_admin_history_clear(self):
        if not self.is_admin(): return self.send_json(403, {"error": "需要管理员权限"})
        try: length = int(self.headers.get("Content-Length", "0"))
        except ValueError: length = 0
        if length <= 0: return self.send_json(400, {"error": "请求内容为空"})
        try: raw = self.rfile.read(length).decode("utf-8"); payload = json.loads(raw)
        except (UnicodeDecodeError, json.JSONDecodeError): return self.send_json(400, {"error": "JSON 格式无效"})
        
        clear_files = bool(payload.get("clear_files", True))
        result = clear_server_history(clear_files=clear_files)
        return self.send_json(200, {"ok": True, **result})

    # 基础响应方法 (补全以使代码完整可运行)
    def send_json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def send_text(self, code, text):
        body = text.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, path, content_type, headers=None):
        try:
            with open(path, "rb") as f:
                data = f.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            if headers:
                for k, v in headers.items():
                    self.send_header(k, v)
            self.end_headers()
            self.wfile.write(data)
        except OSError:
            self.send_text(404, "File Not Found")

    def log_message(self, format, *args):
        # 静默日志，避免刷屏
        return

def main():
    ensure_dirs()
    load_rooms()
    load_messages()
    load_bot_config()
    start_bot_threads()
    configure_firewall()
    
    # 获取实际端口
    global SERVER_PORT
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000, help="监听端口")
    args = parser.parse_args()
    SERVER_PORT = args.port

    try:
        server = ThreadingHTTPServer(("0.0.0.0", SERVER_PORT), ChatHandler)
        print(f"服务已启动: http://{get_local_ip()}:{SERVER_PORT}")
        print(f"本机访问: http://127.0.0.1:{SERVER_PORT}")
        
        # 尝试打开浏览器
        if not os.environ.get("NO_BROWSER"):
             webbrowser.open(f"http://127.0.0.1:{SERVER_PORT}")
        
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止")
    except OSError as e:
        print(f"启动失败: {e}")
        print("可能是端口被占用，请尝试使用 --port 8001 指定其他端口")

if __name__ == "__main__":
    main()