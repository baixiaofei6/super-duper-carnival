const state = {
  lastId: 0,
  username: "",
  loggedIn: false,
  rooms: [],
  users: [],
  files: [],
  conversations: {},
  conversationMeta: {},
  messageStore: {},
  unread: {},
  deletedDms: {},
  activeKey: "",
  settings: {
    autoScroll: true,
    showTime: true,
    compact: false,
    notify: false,
  },
  windowFocused: true,
  initialPollDone: false,
  serverIp: "127.0.0.1", // 新增：存储服务器IP
  serverPort: 8000       // 新增：存储服务器端口
};

const admin = {
  token: "",
  name: "",
  loggedIn: false,
  bot: {
    name: "小欧",
    enabled: false,
    ready: false,
  },
};

const elements = {
  avatar: document.getElementById("avatar"),
  profileName: document.getElementById("profileName"),
  profileStatus: document.getElementById("profileStatus"),
  editName: document.getElementById("editName"),
  globalSearch: document.getElementById("globalSearch"),
  navTabs: document.querySelectorAll(".nav-tabs button"),
  viewChats: document.getElementById("viewChats"),
  viewContacts: document.getElementById("viewContacts"),
  viewSettings: document.getElementById("viewSettings"),
  viewAdmin: document.getElementById("viewAdmin"),
  roomList: document.getElementById("roomList"),
  dmList: document.getElementById("dmList"),
  contactList: document.getElementById("contactList"),
  createRoom: document.getElementById("createRoom"),
  startDm: document.getElementById("startDm"),
  settingAutoScroll: document.getElementById("settingAutoScroll"),
  settingShowTime: document.getElementById("settingShowTime"),
  settingCompact: document.getElementById("settingCompact"),
  settingNotify: document.getElementById("settingNotify"),
  adminUser: document.getElementById("adminUser"),
  adminPass: document.getElementById("adminPass"),
  adminLoginBtn: document.getElementById("adminLoginBtn"),
  adminStatus: document.getElementById("adminStatus"),
  adminLogin: document.getElementById("adminLogin"),
  adminName: document.getElementById("adminName"),
  adminLogout: document.getElementById("adminLogout"),
  adminClearHistory: document.getElementById("adminClearHistory"),
  adminBotConfig: document.getElementById("adminBotConfig"),
  botEnabled: document.getElementById("botEnabled"),
  botName: document.getElementById("botName"), // 新增
  botApiUrl: document.getElementById("botApiUrl"),
  botApiKey: document.getElementById("botApiKey"),
  botModel: document.getElementById("botModel"),
  botProactiveEnabled: document.getElementById("botProactiveEnabled"),
  botReplyProbability: document.getElementById("botReplyProbability"),
  botProactiveProbability: document.getElementById("botProactiveProbability"),
  botSystemPrompt: document.getElementById("botSystemPrompt"),
  botSaveBtn: document.getElementById("botSaveBtn"),
  botStatusText: document.getElementById("botStatusText"),
  activeTitle: document.getElementById("activeTitle"),
  activeMeta: document.getElementById("activeMeta"),
  messageSearch: document.getElementById("messageSearch"),
  searchBtn: document.getElementById("searchBtn"),
  exportChat: document.getElementById("exportChat"),
  clearChat: document.getElementById("clearChat"),
  messages: document.getElementById("messages"),
  chatForm: document.getElementById("chatForm"),
  chatInput: document.getElementById("chatInput"),
  fileInput: document.getElementById("fileInput"),
  sendBtn: document.getElementById("sendBtn"),
  uploadProgress: document.getElementById("uploadProgress"),
  uploadBar: document.getElementById("uploadBar"),
  uploadLabel: document.getElementById("uploadLabel"),
  composerTip: document.getElementById("composerTip"),
  conversationInfo: document.getElementById("conversationInfo"),
  memberList: document.getElementById("memberList"),
  sharedFiles: document.getElementById("sharedFiles"),
  searchResults: document.getElementById("searchResults"),
  loginOverlay: document.getElementById("loginOverlay"),
  loginTitle: document.getElementById("loginTitle"),
  loginDesc: document.getElementById("loginDesc"),
  loginName: document.getElementById("loginName"),
  loginButton: document.getElementById("loginButton"),
  toast: document.getElementById("toast"),
  dropOverlay: document.getElementById("dropOverlay"),
  modal: document.getElementById("modal"),
  modalTitle: document.getElementById("modalTitle"),
  modalDesc: document.getElementById("modalDesc"),
  modalInput: document.getElementById("modalInput"),
  modalCancel: document.getElementById("modalCancel"),
  modalConfirm: document.getElementById("modalConfirm"),
  emojiBar: document.getElementById("emojiBar"),
  imageViewer: document.getElementById("imageViewer"),
  imageViewerImg: document.getElementById("imageViewerImg"),
  imageViewerOpen: document.getElementById("imageViewerOpen"),
  imageViewerClose: document.getElementById("imageViewerClose"),
};

let fileRefreshTimer = null;
let modalHandler = null;

function setStatus(text, ok = true) {
  elements.profileStatus.textContent = text;
  elements.profileStatus.dataset.ok = ok ? "1" : "0";
}

function showToast(message, isError = false) {
  elements.toast.textContent = message;
  elements.toast.dataset.error = isError ? "1" : "0";
  elements.toast.classList.add("show");
  setTimeout(() => elements.toast.classList.remove("show"), 2500);
}

function normalizeName(value) {
  return (value || "").trim();
}

function normalizeBotApiUrl(value, model = "") {
  const raw = normalizeName(value);
  if (!raw) return "";
  if (raw.includes("?") || raw.includes("#")) return raw;
  const url = raw.replace(/\/+$/, "");
  const lowered = url.toLowerCase();
  const modelLower = normalizeName(model).toLowerCase();
  const preferResponses = modelLower.includes("codex");
  if (lowered.endsWith("/responses")) {
    return url;
  }
  if (lowered.endsWith("/chat/completions")) {
    return preferResponses ? `${url.slice(0, -"/chat/completions".length)}/responses` : url;
  }
  if (lowered.endsWith("/v1")) {
    return preferResponses ? `${url}/responses` : `${url}/chat/completions`;
  }
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      if (!parsed.pathname || parsed.pathname === "/") {
        return preferResponses ? `${url}/v1/responses` : `${url}/v1/chat/completions`;
      }
    } catch (err) {
      return raw;
    }
  }
  return url;
}

function isValidName(name) {
  if (!name) return false;
  if (name.length > 24) return false;
  if (name.includes(":")) return false;
  if (name === "匿名" || name.toLowerCase() === "anonymous") return false;
  return true;
}

function isValidRoomName(name) {
  if (!name) return false;
  if (name.length > 24) return false;
  if (name.includes(":")) return false;
  return true;
}

function adminHeaders() {
  if (!admin.token) return {};
  return { "X-Admin-Token": admin.token };
}

function updateAvatar(name) {
  const letter = name ? name.slice(0, 1).toUpperCase() : "U";
  elements.avatar.textContent = letter;
}

function setControlsEnabled(enabled) {
  elements.chatInput.disabled = !enabled;
  elements.sendBtn.disabled = !enabled;
  elements.fileInput.disabled = !enabled;
}

function showOverlay(visible) {
  elements.loginOverlay.classList.toggle("hidden", !visible);
}

function showOverlayMessage(title, desc, allowLogin) {
  elements.loginTitle.textContent = title;
  elements.loginDesc.textContent = desc;
  elements.loginButton.style.display = allowLogin ? "inline-flex" : "none";
  showOverlay(true);
}

function applySettings() {
  document.body.classList.toggle("compact", state.settings.compact);
  document.body.classList.toggle("hide-time", !state.settings.showTime);
  elements.settingAutoScroll.checked = state.settings.autoScroll;
  elements.settingShowTime.checked = state.settings.showTime;
  elements.settingCompact.checked = state.settings.compact;
  elements.settingNotify.checked = state.settings.notify;
}

function saveSettings() {
  localStorage.setItem("lanchat_settings", JSON.stringify(state.settings));
  applySettings();
}

function loadSettings() {
  const raw = localStorage.getItem("lanchat_settings");
  if (!raw) {
    applySettings();
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    state.settings = { ...state.settings, ...parsed };
  } catch (err) {
    state.settings = { ...state.settings };
  }
  applySettings();
}

function convKey(type, id) {
  return `${type}:${id}`;
}

function parseConvKey(key) {
  const [type, id] = key.split(":");
  return { type, id };
}

function ensureConversation(type, id) {
  const key = convKey(type, id);
  if (!state.conversations[key]) {
    state.conversations[key] = {
      key,
      type,
      id,
      title: id,
      lastText: "",
      lastTs: 0,
    };
  }
  if (!state.messageStore[key]) {
    state.messageStore[key] = [];
  }
  if (!state.unread[key]) {
    state.unread[key] = 0;
  }
  return state.conversations[key];
}

function getConversationFromMessage(msg) {
  const scope = msg.scope || "room";
  if (scope === "dm") {
    const peer = msg.user === state.username ? msg.to : msg.user;
    return ensureConversation("dm", peer || "未知");
  }
  return ensureConversation("room", msg.room || "大厅");
}

function formatTime(ts) {
  const date = new Date(ts * 1000);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function draftStorageKey(key) {
  return `lanchat_draft_${key}`;
}

function deletedDmStorageKey() {
  return `lanchat_deleted_dms_${state.username || "guest"}`;
}

function loadDeletedDms() {
  if (!state.username) {
    state.deletedDms = {};
    return;
  }
  const raw = localStorage.getItem(deletedDmStorageKey());
  if (!raw) {
    state.deletedDms = {};
    return;
  }
  try {
    state.deletedDms = JSON.parse(raw) || {};
  } catch (err) {
    state.deletedDms = {};
  }
}

function saveDeletedDms() {
  if (!state.username) return;
  localStorage.setItem(deletedDmStorageKey(), JSON.stringify(state.deletedDms));
}

function getDeletedDmId(peer) {
  return Number(state.deletedDms[peer] || 0);
}

function isDmDeleted(peer) {
  return getDeletedDmId(peer) > 0;
}

function clearDeletedDm(peer, persist = true) {
  if (!peer || !state.deletedDms[peer]) return;
  delete state.deletedDms[peer];
  if (persist) {
    saveDeletedDms();
  }
}

function getActiveConversationLabel() {
  if (!state.activeKey) return "当前会话";
  const { type, id } = parseConvKey(state.activeKey);
  return type === "dm" ? `与 ${id} 的私聊` : `房间 ${id}`;
}

function renderComposerTip(extra = "") {
  const parts = [];
  if (state.activeKey) {
    const draftLength = (elements.chatInput.value || "").trim().length;
    parts.push(`${getActiveConversationLabel()}草稿${draftLength ? `已保存 ${draftLength} 字` : "为空"}`);
  } else {
    parts.push("消息草稿会自动保存在当前设备");
  }
  // 修改：动态读取机器人名称
  parts.push(`群聊中 @${admin.bot.name || "小欧"} 可触发机器人`);
  parts.push("支持 Ctrl+V 粘贴截图发送");
  if (extra) {
    parts.push(extra);
  }
  elements.composerTip.textContent = parts.join(" · ");
}

function restoreDraft() {
  if (!state.activeKey) return;
  elements.chatInput.value = localStorage.getItem(draftStorageKey(state.activeKey)) || "";
  renderComposerTip();
}

function persistDraft() {
  if (!state.activeKey) return;
  const value = elements.chatInput.value || "";
  const key = draftStorageKey(state.activeKey);
  if (value.trim()) {
    localStorage.setItem(key, value);
  } else {
    localStorage.removeItem(key);
  }
  renderComposerTip();
}

function clearDraft(key) {
  if (!key) return;
  localStorage.removeItem(draftStorageKey(key));
  if (state.activeKey === key) {
    renderComposerTip();
  }
}

function buildClipboardFilename(type = "") {
  const date = new Date();
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    "-",
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join("");
  const mimeExt = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
  };
  const ext = mimeExt[type] || (type.split("/")[1] || "bin");
  return `paste-${stamp}.${ext}`;
}

function getClipboardFiles(clipboardData) {
  if (!clipboardData) return [];
  const collected = [];

  if (clipboardData.items && clipboardData.items.length) {
    Array.from(clipboardData.items).forEach((item) => {
      if (item.kind !== "file") return;
      const file = item.getAsFile();
      if (!file) return;
      const name = file.name || buildClipboardFilename(file.type);
      collected.push({ file, name });
    });
  }

  if (!collected.length && clipboardData.files && clipboardData.files.length) {
    Array.from(clipboardData.files).forEach((file) => {
      const name = file.name || buildClipboardFilename(file.type);
      collected.push({ file, name });
    });
  }

  return collected;
}

function highlightMessage(messageId) {
  if (!messageId) return false;
  const selector = `.message[data-message-id="${messageId}"]`;
  const target = elements.messages.querySelector(selector);
  if (!target) return false;
  target.classList.add("highlight");
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => target.classList.remove("highlight"), 1600);
  return true;
}

function openImageViewer(url, name = "") {
  elements.imageViewerImg.src = url;
  elements.imageViewerImg.alt = name || "图片预览";
  elements.imageViewerOpen.href = url;
  elements.imageViewer.classList.remove("hidden");
}

function closeImageViewer() {
  elements.imageViewer.classList.add("hidden");
  elements.imageViewerImg.removeAttribute("src");
  elements.imageViewerOpen.removeAttribute("href");
}

function forgetConversation(key) {
  delete state.messageStore[key];
  delete state.conversations[key];
  delete state.unread[key];
  delete state.conversationMeta[key];
  clearDraft(key);
}

function shouldStickToBottom() {
  if (!state.settings.autoScroll) return false;
  const box = elements.messages;
  return box.scrollTop + box.clientHeight >= box.scrollHeight - 80;
}

function scheduleRefreshFiles() {
  if (fileRefreshTimer) return;
  fileRefreshTimer = setTimeout(() => {
    fileRefreshTimer = null;
    refreshFiles().catch(() => {});
  }, 600);
}

function appendMessage(msg, stick) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${msg.type || "chat"}`;
  if (msg.id) {
    wrapper.dataset.messageId = String(msg.id);
  }

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `${msg.user || "系统"} · ${formatTime(msg.ts)}`;

  const body = document.createElement("div");
  body.className = "body";

  if (msg.type === "file" && msg.file) {
    const info = document.createElement("div");
    info.textContent = msg.text || "分享了文件";
    const link = document.createElement("a");
    link.href = msg.file.url;
    link.textContent = msg.file.name;
    link.target = "_blank";
    link.rel = "noopener";
    const size = document.createElement("span");
    size.className = "file-size";
    size.textContent = `(${formatBytes(msg.file.size || 0)})`;
    body.appendChild(info);
    body.appendChild(link);
    body.appendChild(size);
    if (msg.file.mime && msg.file.mime.startsWith("image/")) {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        openImageViewer(msg.file.url, msg.file.name);
      });
      const preview = document.createElement("img");
      preview.className = "preview";
      preview.src = msg.file.url;
      preview.alt = msg.file.name;
      preview.addEventListener("click", () => openImageViewer(msg.file.url, msg.file.name));
      body.appendChild(preview);
    }
    scheduleRefreshFiles();
  } else {
    body.textContent = msg.text || "";
  }

  wrapper.appendChild(meta);
  wrapper.appendChild(body);
  elements.messages.appendChild(wrapper);

  if (stick) {
    elements.messages.scrollTop = elements.messages.scrollHeight;
  }
}

function storeMessage(msg, notify = true) {
  const convo = getConversationFromMessage(msg);
  if (convo.type === "dm") {
    const deletedUpTo = getDeletedDmId(convo.id);
    const messageId = Number(msg.id || 0);
    if (deletedUpTo && messageId && messageId <= deletedUpTo) {
      return;
    }
    if (deletedUpTo && messageId > deletedUpTo) {
      clearDeletedDm(convo.id);
    }
  }
  const list = state.messageStore[convo.key];
  list.push(msg);
  if (list.length > 300) {
    list.shift();
  }
  convo.lastText = msg.text || "";
  convo.lastTs = msg.ts || 0;
  
  // --- 新增：检测管理员改名系统消息 ---
  if (msg.type === "system" && msg.text && state.username) {
    // 正则匹配：管理员将 旧名字 改名为 新名字
    const match = msg.text.match(/管理员将 (.+?) 改名为 (.+)/);
    if (match && match[1] === state.username) {
      const newName = match[2];
      if (newName && newName !== state.username) {
        // 自动更新本地状态
        const oldName = state.username;
        state.username = newName;
        localStorage.setItem("lanchat_name", newName);
        elements.profileName.textContent = newName;
        updateAvatar(newName);
        showToast(`管理员将你的昵称改为了 ${newName}`);
        // 发送一个带有 previous 参数的心跳包，通知服务器更新（双保险）
        sendPresence(oldName).catch(() => {});
      }
    }
  }
  // --- 新增结束 ---

  if (convo.key !== state.activeKey) {
    state.unread[convo.key] = (state.unread[convo.key] || 0) + 1;
  }
  if (notify) {
    sendNotification(msg);
  }
}

function renderMessages() {
  elements.messages.innerHTML = "";
  const list = state.messageStore[state.activeKey] || [];
  const stick = shouldStickToBottom();
  list.forEach((msg) => appendMessage(msg, false));
  if (stick) {
    elements.messages.scrollTop = elements.messages.scrollHeight;
  }
}

// 新增：复制到剪贴板
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast("链接已复制");
  }).catch(err => {
    showToast("复制失败", true);
  });
}

// 修改：渲染会话信息，增加局域网地址显示
function renderConversationInfo() {
  if (!state.activeKey) {
    elements.conversationInfo.textContent = "请选择一个会话。";
    return;
  }
  const { type, id } = parseConvKey(state.activeKey);
  const meta = state.conversationMeta[state.activeKey];
  const lines = [
    type === "dm" ? `私聊对象：${id}` : `群聊房间：${id}`,
  ];
  if (meta) {
    lines.push(`消息数：${meta.messageCount || 0}`);
    lines.push(`文件数：${meta.fileCount || 0}`);
    lines.push(`参与者：${meta.participantCount || 0}`);
    if (meta.latest && meta.latest.ts) {
      lines.push(`最近活动：${formatTime(meta.latest.ts)}`);
    }
  } else {
    lines.push("正在加载会话统计...");
  }
  
  // 新增：显示局域网地址
  if (type === "room") {
    const lanUrl = `http://${state.serverIp}:${state.serverPort}`;
    lines.push(`\n分享地址：${lanUrl}`);
    // 更新显示框内容
    elements.conversationInfo.innerHTML = lines.join("<br>") + 
      `<br><button onclick="copyToClipboard('${lanUrl}')" style="margin-top:8px; font-size:12px; padding:4px 8px; border-radius:6px; border:none; background:var(--accent-2); color:white; cursor:pointer;">复制链接</button>`;
    return; // 提前返回，因为使用了 innerHTML
  }
  elements.conversationInfo.textContent = lines.join("\n");
}

function renderMembers() {
  elements.memberList.innerHTML = "";
  const { type, id } = parseConvKey(state.activeKey || "room:大厅");
  if (type === "dm") {
    const peers = [state.username, id].filter(Boolean);
    peers.forEach((name) => {
      const item = document.createElement("div");
      item.className = "info-item";
      item.textContent = name;
      elements.memberList.appendChild(item);
    });
    elements.activeMeta.textContent = "私聊";
    return;
  }
  const online = state.users.map((user) => user.name);
  if (!online.length) {
    const empty = document.createElement("div");
    empty.className = "info-item";
    empty.textContent = "暂无在线成员";
    elements.memberList.appendChild(empty);
    elements.activeMeta.textContent = "群聊 · 在线 0";
    return;
  }
  online.forEach((name) => {
    const item = document.createElement("div");
    item.className = "info-item";
    item.textContent = name;
    elements.memberList.appendChild(item);
  });
  elements.activeMeta.textContent = `群聊 · 在线 ${online.length}`;
}

function renderSharedFiles() {
  elements.sharedFiles.innerHTML = "";
  const list = state.messageStore[state.activeKey] || [];
  const displayFiles = list.filter((msg) => msg.type === "file" && msg.file).slice(-8).reverse();
  if (displayFiles.length === 0) {
    const empty = document.createElement("div");
    empty.className = "info-item";
    empty.textContent = "当前会话暂无文件";
    elements.sharedFiles.appendChild(empty);
    return;
  }
  displayFiles.forEach((msg) => {
    const item = document.createElement("div");
    item.className = "info-item";
    const link = document.createElement("a");
    const fileData = msg.file ? msg.file : msg;
    link.href = fileData.url;
    link.textContent = fileData.name;
    link.target = "_blank";
    link.rel = "noopener";
    const size = document.createElement("span");
    size.textContent = formatBytes(fileData.size || 0);
    item.appendChild(link);
    item.appendChild(size);
    elements.sharedFiles.appendChild(item);
  });
}

function renderSearchResults(results) {
  elements.searchResults.innerHTML = "";
  if (!results || results.length === 0) {
    const empty = document.createElement("div");
    empty.className = "info-item";
    empty.textContent = "暂无结果";
    elements.searchResults.appendChild(empty);
    return;
  }
  results.forEach((msg) => {
    const item = document.createElement("div");
    item.className = "info-item search-hit";
    const label = document.createElement("div");
    label.textContent = `${msg.user || "系统"}：${msg.text || ""}`;
    const time = document.createElement("span");
    time.textContent = formatTime(msg.ts);
    item.appendChild(label);
    item.appendChild(time);
    item.addEventListener("click", () => {
      if (!highlightMessage(msg.id)) {
        showToast("这条结果较早，当前窗口未加载到该消息");
      }
    });
    elements.searchResults.appendChild(item);
  });
}
function switchConversation(type, id) {
  const convo = ensureConversation(type, id);
  state.activeKey = convo.key;
  state.unread[convo.key] = 0;
  elements.activeTitle.textContent = convo.title;
  elements.activeMeta.textContent = type === "dm" ? "私聊" : "群聊";
  renderConversationList();
  renderMessages();
  restoreDraft();
  renderConversationInfo();
  renderMembers();
  renderSharedFiles();
  refreshConversationMeta().catch(() => {});
}

function ensureActiveConversationAvailable() {
  if (!state.activeKey) return;
  const convo = parseConvKey(state.activeKey);
  if (convo.type === "room" && !state.rooms.includes(convo.id)) {
    forgetConversation(state.activeKey);
    switchConversation("room", state.rooms[0] || "大厅");
  }
}

function renderConversationList() {
  elements.roomList.innerHTML = "";
  elements.dmList.innerHTML = "";
  const rooms = state.rooms.slice();
  rooms.forEach((room) => {
    const convo = ensureConversation("room", room);
    const item = document.createElement("div");
    item.className = "conversation-item";
    if (convo.key === state.activeKey) {
      item.classList.add("active");
    }
    const main = document.createElement("div");
    main.textContent = convo.title;
    const meta = document.createElement("div");
    meta.className = "conversation-meta";
    meta.textContent = convo.lastText ? convo.lastText.slice(0, 18) : "暂无消息";
    item.appendChild(main);
    item.appendChild(meta);
    const unread = state.unread[convo.key];
    if (unread) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = unread;
      item.appendChild(badge);
    }
    if (admin.loggedIn && !["大厅", "项目", "闲聊"].includes(room)) {
      const removeBtn = document.createElement("button");
      removeBtn.className = "conversation-remove";
      removeBtn.type = "button";
      removeBtn.textContent = "删除";
      removeBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteRoom(room);
      });
      item.appendChild(removeBtn);
    }
    item.addEventListener("click", () => switchConversation("room", room));
    elements.roomList.appendChild(item);
  });

  const dms = Object.values(state.conversations)
    .filter((convo) => convo.type === "dm" && !isDmDeleted(convo.id))
    .sort((a, b) => b.lastTs - a.lastTs);
  if (dms.length === 0) {
    const empty = document.createElement("div");
    empty.className = "conversation-item";
    empty.textContent = "暂无私聊";
    elements.dmList.appendChild(empty);
  } else {
    dms.forEach((convo) => {
      const item = document.createElement("div");
      item.className = "conversation-item";
      if (convo.key === state.activeKey) {
        item.classList.add("active");
      }
      const main = document.createElement("div");
      main.textContent = convo.title;
      const meta = document.createElement("div");
      meta.className = "conversation-meta";
      meta.textContent = convo.lastText ? convo.lastText.slice(0, 18) : "暂无消息";
      item.appendChild(main);
      item.appendChild(meta);
      const unread = state.unread[convo.key];
      if (unread) {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = unread;
        item.appendChild(badge);
      }
      const removeBtn = document.createElement("button");
      removeBtn.className = "conversation-remove";
      removeBtn.type = "button";
      removeBtn.textContent = "删除";
      removeBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteDm(convo.id);
      });
      item.appendChild(removeBtn);
      item.addEventListener("click", () => switchConversation("dm", convo.id));
      elements.dmList.appendChild(item);
    });
  }
}

// 修改：渲染联系人，增加改名按钮
function renderContacts() {
  elements.contactList.innerHTML = "";
  if (!state.users.length) {
    const empty = document.createElement("div");
    empty.className = "contact-item";
    empty.textContent = "暂无在线用户";
    elements.contactList.appendChild(empty);
    return;
  }
  state.users.forEach((user) => {
    const item = document.createElement("div");
    item.className = "contact-item";
    const name = document.createElement("div");
    name.textContent = user.name;
    item.appendChild(name);
    const actions = document.createElement("div");
    if (admin.loggedIn && user.name !== state.username) {
      // 新增：改名按钮
      const renameBtn = document.createElement("button");
      renameBtn.textContent = "改名";
      renameBtn.style.marginRight = "4px";
      renameBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        openModal("修改成员昵称", `将 ${user.name} 修改为：`, "", (value) => {
          if (value && value.trim()) {
            adminRename(user.name, value.trim());
          }
        });
      });
      actions.appendChild(renameBtn);

      const muteBtn = document.createElement("button");
      muteBtn.textContent = user.muted ? "解禁" : "禁言";
      muteBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        if (user.muted) {
          adminMute(user.name, false); // 解禁
        } else {
          // 弹窗询问时间
          openModal("禁言用户", "请输入禁言时长（分钟，0为永久）：", "0", (value) => {
            const duration = parseInt(value, 10);
            if (!isNaN(duration) && duration >= 0) {
              adminMute(user.name, true, duration);
            } else {
              showToast("请输入有效的数字", true);
            }
          });
        }
      });
      
      const kickBtn = document.createElement("button");
      kickBtn.className = "kick";
      kickBtn.textContent = "踢出";
      kickBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        adminKick(user.name);
      });
      
      actions.appendChild(renameBtn); // 新增
      actions.appendChild(muteBtn);
      actions.appendChild(kickBtn);
    } else {
      const badge = document.createElement("span");
      badge.textContent = user.name === state.username ? "我" : (user.muted ? "已禁言" : "在线");
      actions.appendChild(badge);
    }
    item.appendChild(actions);
    item.addEventListener("click", () => {
      if (user.name === state.username) return;
      switchConversation("dm", user.name);
    });
    elements.contactList.appendChild(item);
  });
}

function handleForbidden(error) {
  if (error.code === "kicked") {
    state.loggedIn = false;
    localStorage.removeItem("lanchat_name");
    setControlsEnabled(false);
    showOverlayMessage("你已被管理员踢出", "请稍后再试或联系管理员。", false);
    showToast("你已被管理员踢出", true);
    return;
  }
  if (error.code === "muted") {
    showToast("你已被管理员禁言", true);
    return;
  }
}

async function sendMessage(text) {
  const convo = parseConvKey(state.activeKey);
  const payload = {
    username: state.username,
    text,
    scope: convo.type === "dm" ? "dm" : "room",
  };
  if (convo.type === "dm") {
    payload.to = convo.id;
  } else {
    payload.room = convo.id;
  }
  const response = await fetch("/api/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (response.status === 403) {
    const error = await response.json().catch(() => ({}));
    handleForbidden(error);
    throw new Error(error.error || "发送失败");
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "发送失败");
  }
}

async function announceSystem(text) {
  try {
    const payload = {
      username: state.username,
      text,
      type: "system",
      scope: "room",
      room: state.rooms[0] || "大厅",
    };
    await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    showToast("系统消息发送失败", true);
  }
}

function loginWithName(name, announce = true) {
  state.username = name;
  state.loggedIn = true;
  loadDeletedDms();
  localStorage.setItem("lanchat_name", name);
  elements.profileName.textContent = name;
  updateAvatar(name);
  setControlsEnabled(true);
  showOverlay(false);
  if (announce) {
    announceSystem(`${name} 加入了聊天`);
  }
  renderComposerTip();
  sendPresence().catch(() => {});
}

function handleLogin() {
  const name = normalizeName(elements.loginName.value);
  if (!isValidName(name)) {
    showToast("请输入 1-24 个字符的用户名", true);
    return;
  }
  loginWithName(name, true);
  elements.loginName.value = "";
}

function handleRename() {
  if (!state.loggedIn) {
    showToast("请先登录", true);
    return;
  }
  openModal("修改昵称", "输入新的昵称", state.username, (value) => {
    const name = normalizeName(value);
    if (!isValidName(name)) {
      showToast("请输入 1-24 个字符的用户名", true);
      return;
    }
    const oldName = state.username;
    if (name === oldName) {
      showToast("昵称未变化");
      return;
    }
    state.username = name;
    loadDeletedDms();
    localStorage.setItem("lanchat_name", name);
    elements.profileName.textContent = name;
    updateAvatar(name);
    announceSystem(`${oldName} 改名为 ${name}`);
    renderComposerTip();
    sendPresence(oldName).catch(() => {});
    showToast("昵称已更新");
    closeModal();
  });
}

function setUploadProgress(visible, percent = 0) {
  elements.uploadProgress.style.display = visible ? "flex" : "none";
  elements.uploadBar.style.width = `${percent}%`;
  elements.uploadLabel.textContent = `上传中 ${percent}%`;
}

function uploadFile(file, filename = "") {
  const convo = parseConvKey(state.activeKey);
  const formData = new FormData();
  formData.append("username", state.username);
  formData.append("scope", convo.type === "dm" ? "dm" : "room");
  if (convo.type === "dm") {
    formData.append("to", convo.id);
  } else {
    formData.append("room", convo.id);
  }
  if (filename) {
    formData.append("file", file, filename);
  } else {
    formData.append("file", file);
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
        setUploadProgress(true, percent);
      }
    };
    xhr.onload = () => {
      setUploadProgress(false, 0);
      if (xhr.status === 403) {
        handleForbidden(xhr.response || {});
        reject(new Error((xhr.response && xhr.response.error) || "上传失败"));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response || {});
        return;
      }
      const error = (xhr.response && xhr.response.error) || "上传失败";
      reject(new Error(error));
    };
    xhr.onerror = () => {
      setUploadProgress(false, 0);
      reject(new Error("网络错误"));
    };
    setUploadProgress(true, 0);
    xhr.send(formData);
  });
}
async function sendPresence(previousName = "") {
  if (!state.loggedIn) return;
  const payload = { username: state.username };
  if (previousName && previousName !== state.username) {
    payload.previous = previousName;
  }
  const response = await fetch("/api/presence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (response.status === 403) {
    const error = await response.json().catch(() => ({}));
    handleForbidden(error);
    return;
  }
  if (!response.ok) {
    throw new Error("更新在线状态失败");
  }
  const data = await response.json();
  state.users = data.users || [];
  renderContacts();
  renderMembers();
}

async function uploadClipboardFiles(entries) {
  for (const entry of entries) {
    await uploadFile(entry.file, entry.name);
  }
}

async function refreshFiles() {
  const response = await fetch("/api/files", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("加载文件失败");
  }
  const data = await response.json();
  state.files = data.files || [];
  renderComposerTip();
  renderSharedFiles();
  renderConversationInfo();
}

async function refreshRooms() {
  const response = await fetch("/api/rooms", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("加载房间失败");
  }
  const data = await response.json();
  state.rooms = data.rooms || [];
  if (!state.rooms.length) {
    state.rooms = ["大厅"];
  }
}

async function refreshConversationMeta() {
  if (!state.loggedIn || !state.activeKey) return;
  const convo = parseConvKey(state.activeKey);
  const params = new URLSearchParams({
    user: state.username,
    scope: convo.type === "dm" ? "dm" : "room",
  });
  if (convo.type === "dm") {
    params.set("peer", convo.id);
  } else {
    params.set("room", convo.id);
  }
  const response = await fetch(`/api/conversation?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("加载会话统计失败");
  }
  const data = await response.json();
  state.conversationMeta[state.activeKey] = data;
  renderConversationInfo();
  renderComposerTip();
}

// 修改：poll 函数，获取并保存服务器 IP
async function poll() {
  try {
    const params = new URLSearchParams({ since: state.lastId });
    if (state.loggedIn) {
      params.set("user", state.username);
    }
    const response = await fetch(`/api/poll?${params.toString()}`, {
      cache: "no-store",
      headers: adminHeaders(),
    });
    if (response.status === 403) {
      const error = await response.json().catch(() => ({}));
      handleForbidden(error);
      return;
    }
    if (!response.ok) {
      throw new Error("bad response");
    }
    const data = await response.json();
    
    // 新增：保存服务器IP
    if (data.serverIp) {
      state.serverIp = data.serverIp;
    }
    if (data.serverPort) {
      state.serverPort = data.serverPort;
    }

    let activeConversationChanged = false;
    const allowNotifications = state.initialPollDone;
    if (Array.isArray(data.messages)) {
      data.messages.forEach((msg) => {
        storeMessage(msg, allowNotifications);
        const convo = getConversationFromMessage(msg);
        if (convo.key === state.activeKey) {
          const stick = shouldStickToBottom();
          appendMessage(msg, stick);
          activeConversationChanged = true;
        }
      });
    }
    if (typeof data.latest === "number") {
      state.lastId = Math.max(state.lastId, data.latest);
    }
    if (Array.isArray(data.users)) {
      state.users = data.users;
      renderContacts();
      renderMembers();
    }
    if (Array.isArray(data.rooms)) {
      state.rooms = data.rooms;
    }
    
    // --- 新增：自动进入大厅逻辑 ---
    // 如果用户已登录，且当前没有选中任何会话，则自动切换到大厅（或第一个房间）
    if (state.loggedIn && !state.activeKey) {
       switchConversation("room", state.rooms[0] || "大厅");
    }
    // ------------------------------

    ensureActiveConversationAvailable();
    renderConversationList();
    if (activeConversationChanged) {
      refreshConversationMeta().catch(() => {});
    }
    setStatus("在线", true);
    state.initialPollDone = true;
  } catch (err) {
    setStatus("离线", false);
  } finally {
    setTimeout(poll, 1000);
  }
}

function exportHistory() {
  const list = state.messageStore[state.activeKey] || [];
  if (!list.length) {
    showToast("暂无聊天记录");
    return;
  }
  const lines = list.map((msg) => {
    const time = formatTime(msg.ts);
    if (msg.type === "file" && msg.file) {
      return `[${time}] ${msg.user || "系统"}：${msg.text} (${msg.file.name})`;
    }
    return `[${time}] ${msg.user || "系统"}：${msg.text}`;
  });
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = URL.createObjectURL(blob);
  link.download = `聊天记录_${stamp}.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function clearChat() {
  state.messageStore[state.activeKey] = [];
  renderMessages();
  clearDraft(state.activeKey);
  elements.chatInput.value = "";
  renderComposerTip("仅清除当前设备上的显示与草稿");
  showToast("已清屏，服务端聊天记录未删除");
}

async function deleteRoom(room) {
  if (!admin.loggedIn) {
    showToast("只有管理员可以删除群聊", true);
    return;
  }
  openModal("删除群聊", `输入“${room}”确认删除，该房间消息也会一起移除`, "", async (value) => {
    if (normalizeName(value) !== room) {
      showToast("输入的房间名不匹配", true);
      return;
    }
    const response = await fetch("/api/admin/rooms/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...adminHeaders(),
      },
      body: JSON.stringify({ room }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      showToast(error.error || "删除失败", true);
      return;
    }
    const data = await response.json();
    state.rooms = data.rooms || state.rooms.filter((item) => item !== room);
    forgetConversation(convKey("room", room));
    closeModal();
    if (!state.rooms.length) {
      state.rooms = ["大厅"];
    }
    if (state.activeKey === convKey("room", room)) {
      switchConversation("room", state.rooms[0]);
    } else {
      renderConversationList();
      renderConversationInfo();
      renderSharedFiles();
    }
    showToast(`群聊已删除，清理了 ${data.removed || 0} 条消息`);
  });
}

function deleteDm(peer) {
  openModal("删除私聊", `删除你与 ${peer} 的私聊记录，仅影响你当前设备`, "", (value) => {
    if (normalizeName(value) !== peer) {
      showToast("输入的用户名不匹配", true);
      return;
    }
    const key = convKey("dm", peer);
    const messages = state.messageStore[key] || [];
    const latestSeenId = messages.reduce((maxId, msg) => Math.max(maxId, Number(msg.id || 0)), 0) || state.lastId;
    state.deletedDms[peer] = latestSeenId;
    saveDeletedDms();
    forgetConversation(key);
    closeModal();
    if (state.activeKey === key) {
      const fallbackRoom = state.rooms[0] || "大厅";
      switchConversation("room", fallbackRoom);
    } else {
      renderConversationList();
    }
    showToast("私聊已从你的列表中删除");
  });
}

function openModal(title, desc, value, handler) {
  modalHandler = handler;
  elements.modalTitle.textContent = title;
  elements.modalDesc.textContent = desc;
  elements.modalInput.value = value || "";
  elements.modal.classList.remove("hidden");
  elements.modalInput.focus();
}

function closeModal() {
  elements.modal.classList.add("hidden");
  modalHandler = null;
}

function switchView(view) {
  elements.viewChats.classList.toggle("hidden", view !== "chats");
  elements.viewContacts.classList.toggle("hidden", view !== "contacts");
  elements.viewSettings.classList.toggle("hidden", view !== "settings");
  elements.viewAdmin.classList.toggle("hidden", view !== "admin");
  elements.navTabs.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
}

async function createRoom() {
  openModal("新建房间", "输入群聊名称", "", async (value) => {
    const name = normalizeName(value);
    if (!isValidRoomName(name)) {
      showToast("请输入 1-24 个字符的房间名称", true);
      return;
    }
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: state.username, room: name }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      showToast(error.error || "创建失败", true);
      return;
    }
    const data = await response.json();
    state.rooms = data.rooms || state.rooms;
    renderConversationList();
    switchConversation("room", name);
    closeModal();
    showToast("房间已创建");
  });
}

function startDm() {
  openModal("发起私聊", "输入对方用户名", "", (value) => {
    const name = normalizeName(value);
    if (!isValidName(name)) {
      showToast("请输入有效用户名", true);
      return;
    }
    if (name === state.username) {
      showToast("不能和自己私聊", true);
      return;
    }
    switchConversation("dm", name);
    closeModal();
  });
}

async function performSearch() {
  if (!state.loggedIn) {
    showToast("请先登录", true);
    return;
  }
  const keyword = normalizeName(elements.messageSearch.value);
  if (!keyword) {
    showToast("请输入搜索关键字", true);
    return;
  }
  const convo = parseConvKey(state.activeKey);
  const params = new URLSearchParams({
    user: state.username,
    q: keyword,
    scope: convo.type === "dm" ? "dm" : "room",
  });
  if (convo.type === "dm") {
    params.set("peer", convo.id);
  } else {
    params.set("room", convo.id);
  }
  const response = await fetch(`/api/search?${params.toString()}`, { cache: "no-store" });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    showToast(error.error || "搜索失败", true);
    return;
  }
  const data = await response.json();
  renderSearchResults(data.results || []);
}

function sendNotification(msg) {
  if (!state.settings.notify) return;
  if (state.windowFocused) return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (msg.user === state.username || msg.type === "system") return;
  const title = msg.user || "新消息";
  const body = msg.text || "";
  new Notification(title, { body });
}

function setBotStatusText(text) {
  elements.botStatusText.textContent = text;
}

// 修改：填充机器人配置表单
function fillBotForm(config) {
  admin.bot.name = config.name || admin.bot.name || "小欧";
  admin.bot.enabled = !!config.enabled;
  admin.bot.ready = !!config.ready;
  
  // 新增：填充昵称
  if (elements.botName) {
    elements.botName.value = admin.bot.name;
  }
  
  elements.botEnabled.checked = !!config.enabled;
  elements.botApiUrl.value = config.api_url || "";
  elements.botApiKey.value = config.api_key || "";
  elements.botModel.value = config.model || "";
  elements.botProactiveEnabled.checked = config.proactive_enabled !== false;
  elements.botReplyProbability.value = Number(config.reply_probability ?? 0.7).toFixed(2);
  elements.botProactiveProbability.value = Number(config.proactive_probability ?? 0.3).toFixed(2);
  elements.botSystemPrompt.value = config.system_prompt || "";
  const cooldown = Number(config.cooldown_seconds || 0);
  if (cooldown > 0) {
    setBotStatusText(`机器人冷却中（约 ${cooldown}s），用于保护接口避免连续失败重试`);
  } else {
    setBotStatusText(config.ready ? `机器人已就绪：@${admin.bot.name} 可用` : "机器人已保存，但配置可能未完整生效");
  }
  renderComposerTip();
}

// 修改：获取机器人配置表单数据
function botPayloadFromForm() {
  const toProb = (value, fallback) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return fallback;
    return Math.max(0, Math.min(1, parsed));
  };
  
  // 获取昵称
  let botName = admin.bot.name;
  if (elements.botName) {
    botName = elements.botName.value.trim() || "小欧";
  }

  return {
    name: botName, // 新增
    enabled: elements.botEnabled.checked,
    api_url: normalizeBotApiUrl(elements.botApiUrl.value, elements.botModel.value),
    api_key: elements.botApiKey.value.trim(),
    model: normalizeName(elements.botModel.value),
    proactive_enabled: elements.botProactiveEnabled.checked,
    reply_probability: toProb(elements.botReplyProbability.value, 0.7),
    proactive_probability: toProb(elements.botProactiveProbability.value, 0.3),
    system_prompt: elements.botSystemPrompt.value.trim(),
  };
}

async function loadBotConfig() {
  if (!admin.loggedIn) return;
  const response = await fetch("/api/admin/bot", {
    cache: "no-store",
    headers: adminHeaders(),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "加载机器人配置失败");
  }
  const data = await response.json();
  fillBotForm(data);
}

async function saveBotConfig() {
  if (!admin.loggedIn) {
    showToast("请先登录管理员", true);
    return;
  }
  const payload = botPayloadFromForm();
  elements.botApiUrl.value = payload.api_url || "";
  const response = await fetch("/api/admin/bot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...adminHeaders(),
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    showToast(error.error || "保存机器人配置失败", true);
    return;
  }
  const data = await response.json();
  // 更新本地状态
  if (data.config && data.config.name) {
    admin.bot.name = data.config.name;
  }
  fillBotForm(data.config || payload);
  showToast("机器人配置已保存");
}

function resetLocalHistoryAfterServerClear(latest = 0) {
  const fallbackRoom = state.rooms[0] || "大厅";
  const active = parseConvKey(state.activeKey || `room:${fallbackRoom}`);
  state.messageStore = {};
  state.conversations = {};
  state.conversationMeta = {};
  state.unread = {};
  state.deletedDms = {};
  saveDeletedDms();
  const latestId = Number(latest);
  if (Number.isFinite(latestId) && latestId >= 0) {
    state.lastId = latestId;
  }
  if (active.type === "room" && state.rooms.includes(active.id)) {
    switchConversation("room", active.id);
  } else {
    switchConversation("room", fallbackRoom);
  }
}

function clearServerHistory() {
  if (!admin.loggedIn) {
    showToast("请先登录管理员", true);
    return;
  }
  openModal("清空服务器历史", "输入“清空历史”确认（会删除聊天记录和上传文件）", "", async (value) => {
    if (normalizeName(value) !== "清空历史") {
      showToast("确认词不正确", true);
      return;
    }
    const response = await fetch("/api/admin/history/clear", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...adminHeaders(),
      },
      body: JSON.stringify({ clear_files: true }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      showToast(error.error || "清空失败", true);
      return;
    }
    const data = await response.json();
    resetLocalHistoryAfterServerClear(data.latest || 0);
    closeModal();
    refreshConversationMeta().catch(() => {});
    refreshFiles().catch(() => {});
    showToast(`已清空：${data.removed_messages || 0} 条消息，${data.removed_files || 0} 个文件`);
  });
}

async function adminLogin() {
  const username = normalizeName(elements.adminUser.value);
  const password = elements.adminPass.value || "";
  const response = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    showToast(error.error || "管理员登录失败", true);
    return;
  }
  const data = await response.json();
  admin.token = data.token;
  admin.name = data.name || "管理员";
  admin.loggedIn = true;
  sessionStorage.setItem("admin_token", admin.token);
  sessionStorage.setItem("admin_name", admin.name);
  updateAdminUI();
  try {
    await loadBotConfig();
  } catch (err) {
    showToast(err.message, true);
  }
  renderContacts();
  renderConversationList();
  showToast("管理员已登录");
}

function adminLogoutLocal() {
  admin.token = "";
  admin.name = "";
  admin.loggedIn = false;
  admin.bot.enabled = false;
  admin.bot.ready = false;
  sessionStorage.removeItem("admin_token");
  sessionStorage.removeItem("admin_name");
  updateAdminUI();
  renderContacts();
  renderConversationList();
}

async function adminLogout() {
  if (admin.token) {
    fetch("/api/admin/logout", { method: "POST", headers: adminHeaders() }).catch(() => {});
  }
  adminLogoutLocal();
  showToast("已退出管理员");
}

function updateAdminUI() {
  elements.adminLogin.classList.toggle("hidden", admin.loggedIn);
  elements.adminStatus.classList.toggle("hidden", !admin.loggedIn);
  elements.adminBotConfig.classList.toggle("hidden", !admin.loggedIn);
  elements.adminClearHistory.classList.toggle("hidden", !admin.loggedIn);
  elements.adminName.textContent = admin.name || "管理员";
}

async function validateAdmin() {
  const token = sessionStorage.getItem("admin_token");
  const name = sessionStorage.getItem("admin_name");
  if (!token) {
    updateAdminUI();
    return;
  }
  admin.token = token;
  admin.name = name || "管理员";
  const response = await fetch("/api/admin/status", {
    cache: "no-store",
    headers: adminHeaders(),
  });
  if (!response.ok) {
    adminLogoutLocal();
    return;
  }
  const data = await response.json();
  if (!data.admin) {
    adminLogoutLocal();
    return;
  }
  admin.loggedIn = true;
  admin.name = data.name || admin.name;
  if (data.botName) {
    admin.bot.name = data.botName;
  }
  updateAdminUI();
  try {
    await loadBotConfig();
  } catch (err) {
    showToast(err.message, true);
  }
  renderConversationList();
}

// 修改：管理员禁言函数，支持时间参数
async function adminMute(user, mute, duration = 0) {
  if (!admin.loggedIn) return;
  const response = await fetch("/api/admin/mute", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...adminHeaders(),
    },
    body: JSON.stringify({ user, mute, duration }), // 传递 duration
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    showToast(error.error || "操作失败", true);
    return;
  }
  const data = await response.json();
  state.users = data.users || state.users;
  renderContacts();
  renderMembers();
  closeModal(); // 关闭模态框
  showToast(mute ? "已禁言" : "已解除禁言");
}

// 新增：管理员改名函数
async function adminRename(oldName, newName) {
  if (!admin.loggedIn) return;
  const response = await fetch("/api/admin/rename", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...adminHeaders(),
    },
    body: JSON.stringify({ old_name: oldName, new_name: newName }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    showToast(error.error || "操作失败", true);
    return;
  }
  const data = await response.json();
  state.users = data.users || state.users;
  renderContacts();
  renderMembers();
  closeModal();
  showToast("昵称已修改");
}

async function adminKick(user) {
  if (!admin.loggedIn) return;
  const response = await fetch("/api/admin/kick", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...adminHeaders(),
    },
    body: JSON.stringify({ user }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    showToast(error.error || "操作失败", true);
    return;
  }
  const data = await response.json();
  state.users = data.users || state.users;
  renderContacts();
  renderMembers();
  showToast("已踢出");
}

function initLogin() {
  const stored = localStorage.getItem("lanchat_name");
  if (isValidName(stored)) {
    loginWithName(stored, false);
  } else {
    setControlsEnabled(false);
    showOverlayMessage("请输入用户名", "设置用户名后才能进入聊天并上传文件。", true);
  }
}

// --- 事件监听器保持不变 ---
elements.navTabs.forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

elements.loginButton.addEventListener("click", handleLogin);
elements.loginName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    handleLogin();
  }
});
elements.editName.addEventListener("click", handleRename);

elements.chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.loggedIn) {
    showToast("请先输入用户名", true);
    return;
  }
  const text = elements.chatInput.value.trim();
  if (!text) return;
  elements.chatInput.value = "";
  clearDraft(state.activeKey);
  try {
    await sendMessage(text);
    renderComposerTip();
  } catch (err) {
    elements.chatInput.value = text;
    persistDraft();
    showToast(err.message, true);
  }
});

elements.chatInput.addEventListener("input", persistDraft);
elements.chatInput.addEventListener("paste", async (event) => {
  const entries = getClipboardFiles(event.clipboardData);
  if (!entries.length) return;
  event.preventDefault();
  if (!state.loggedIn) {
    showToast("请先登录再发送截图", true);
    return;
  }
  try {
    await uploadClipboardFiles(entries);
    showToast("截图已发送");
  } catch (err) {
    showToast(err.message, true);
  }
});

elements.fileInput.addEventListener("change", async () => {
  const files = elements.fileInput.files;
  if (!files || !files.length) return;
  if (!state.loggedIn) {
    showToast("请先登录再上传文件", true);
    return;
  }
  try {
    await uploadFile(files[0]);
    showToast("文件已发送");
  } catch (err) {
    showToast(err.message, true);
  }
  elements.fileInput.value = "";
});

elements.emojiBar.addEventListener("click", (event) => {
  if (event.target.tagName !== "BUTTON") return;
  const emoji = event.target.dataset.emoji;
  if (!emoji) return;
  elements.chatInput.value += emoji;
  elements.chatInput.focus();
});

elements.settingAutoScroll.addEventListener("change", () => {
  state.settings.autoScroll = elements.settingAutoScroll.checked;
  saveSettings();
});
elements.settingShowTime.addEventListener("change", () => {
  state.settings.showTime = elements.settingShowTime.checked;
  saveSettings();
});
elements.settingCompact.addEventListener("change", () => {
  state.settings.compact = elements.settingCompact.checked;
  saveSettings();
});
elements.settingNotify.addEventListener("change", () => {
  state.settings.notify = elements.settingNotify.checked;
  if (state.settings.notify && "Notification" in window && Notification.permission !== "granted") {
    Notification.requestPermission();
  }
  saveSettings();
});

elements.adminLoginBtn.addEventListener("click", adminLogin);
elements.adminPass.addEventListener("keydown", (event) => {
  if (event.key === "Enter") adminLogin();
});
elements.adminLogout.addEventListener("click", adminLogout);

elements.botSaveBtn.addEventListener("click", saveBotConfig);
elements.adminClearHistory.addEventListener("click", clearServerHistory);

elements.createRoom.addEventListener("click", createRoom);
elements.startDm.addEventListener("click", startDm);

elements.searchBtn.addEventListener("click", performSearch);
elements.messageSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") performSearch();
});

elements.exportChat.addEventListener("click", exportHistory);
elements.clearChat.addEventListener("click", clearChat);

elements.imageViewerClose.addEventListener("click", closeImageViewer);
elements.imageViewer.addEventListener("click", (event) => {
  if (event.target === elements.imageViewer) closeImageViewer();
});

elements.modalCancel.addEventListener("click", closeModal);
elements.modalConfirm.addEventListener("click", () => {
  if (modalHandler) {
    modalHandler(elements.modalInput.value);
  }
});
elements.modalInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    elements.modalConfirm.click();
  }
});

window.addEventListener("focus", () => {
  state.windowFocused = true;
});
window.addEventListener("blur", () => {
  state.windowFocused = false;
});

document.addEventListener("dragover", (event) => {
  event.preventDefault();
  elements.dropOverlay.classList.remove("hidden");
});
document.addEventListener("dragleave", (event) => {
  if (event.relatedTarget === null || !document.body.contains(event.relatedTarget)) {
    elements.dropOverlay.classList.add("hidden");
  }
});
document.addEventListener("drop", async (event) => {
  event.preventDefault();
  elements.dropOverlay.classList.add("hidden");
  if (!state.loggedIn) {
    showToast("请先登录再上传文件", true);
    return;
  }
  const files = event.dataTransfer && event.dataTransfer.files;
  if (!files || !files.length) return;
  try {
    for (const file of files) {
      await uploadFile(file);
    }
    showToast("文件已发送");
  } catch (err) {
    showToast(err.message, true);
  }
});

// 初始化
loadSettings();
initLogin();
validateAdmin();
poll();