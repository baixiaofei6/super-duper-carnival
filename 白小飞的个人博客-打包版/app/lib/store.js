'use strict';
const crypto = require('crypto');
// 零依赖 JSON 文件存储。所有写操作串行化，避免并发覆盖。
const fs = require('fs');
const path = require('path');
const { nowISO, rand } = require('./util');


// scrypt + 随机 salt；用 timingSafeEqual 比较，避免明文存密码。
function hashPassword(password, salt) {
  const sl = salt || crypto.randomBytes(16).toString('hex');
  return { salt: sl, hash: crypto.scryptSync(String(password), sl, 64).toString('hex') };
}
function verifyPassword(password, salt, hash) {
  try {
    if (!salt || !hash) return false;
    const a = Buffer.from(crypto.scryptSync(String(password), salt, 64).toString('hex'), 'hex');
    const b = Buffer.from(hash, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch (e) { return false; }
}

const DEFAULT = {
  users: [],
  identities: [],   // {provider, openid, unionid, userId, createdAt}
  sessions: [],     // {id, userId, createdAt, expiresAt}
  oauthStates: [],  // {state, provider, redirect, createdAt}
  posts: [],
  projects: [],
  comments: [],
  guestbook: [],
  uploads: [],
  settings: {},
  layout: null
};

class Store {
  constructor(dataDir) {
    this.dir = dataDir;
    this.file = path.join(dataDir, 'data.json');
    this.uploadsDir = path.join(dataDir, 'uploads');
    fs.mkdirSync(this.dir, { recursive: true });
    fs.mkdirSync(this.uploadsDir, { recursive: true });
    this.chain = Promise.resolve();
    this.load();
  }

  load() {
    let d;
    try {
      d = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch (e) {
      d = {};
    }
    this.data = Object.assign({}, JSON.parse(JSON.stringify(DEFAULT)), d);
    for (const k of Object.keys(DEFAULT)) {
      if (k === 'settings') { if (!this.data.settings || typeof this.data.settings !== 'object') this.data.settings = {}; }
      else if (k === 'layout') { if (!this.data.layout || !Array.isArray(this.data.layout.modules)) this.data.layout = null; }
      else if (!Array.isArray(this.data[k])) this.data[k] = [];
    }
    this.seed();
    this.saveSync();
  }

  // 首启灌入示例内容（用户可在后台改/加）。
  seed() {
    if (!this.data.posts.length) {
      this.data.posts = [
        {
          slug: 'hello-world', title: '你好，这里是白小飞', date: '2026-11-01',
          excerpt: '第一篇。把站点搭起来，记一下为什么要做、打算写什么。',
          tags: ['随笔', '建站'], cover: '',
          body: '<p>一直想有一个自己的地方，不像社交平台那样被算法推着走，也不像笔记软件那样只给自己看。</p><p>于是就有了「白小飞」。这里会放技术笔记、做过的东西、还有一些没想清楚的想法。风格上我很喜欢 MiMo 官网那种暖、慢、带一点呼吸感的调子，所以照着那个气质做了这套页面。</p><p>慢慢来。</p>'
        },
        {
          slug: 'particle-hero', title: '粒子文字与鼠标力场', date: '2026-11-03',
          excerpt: '从官网 JS 里抠出来的参数：120px 半径的径向斥力，粒子会顺着光标方向散开再收回来。',
          tags: ['前端', 'Canvas'], cover: '',
          body: '<p>Hero 的大字不是普通文字，是 canvas 上的粒子。离屏采样字形后，把 alpha &gt; 40 的像素变成若干粒子，入场用 easeOutCubic 汇聚。</p><p>鼠标扫过时的反馈是一个 120px 半径的径向斥力场：粒子沿「远离平滑光标」的方向被推开，光标本身带 0.18 的惯性，所以会有拖尾的方向感。</p><p>尊重 prefers-reduced-motion，关掉动效时只画一帧静态字形。</p>'
        },
        {
          slug: 'warm-palette', title: '暖奶油白，不是纯白', date: '2026-10-28',
          excerpt: '配色核实记录：#fcfaf8 / #f3ede8 / #f0ebe5，加一点偏粉的珊瑚橙。',
          tags: ['设计', '配色'], cover: '',
          body: '<p>一开始我把底色猜成近白 #FAFAFA，错了。真实是一整套暖奶油白体系：背景 #fcfaf8、卡片 #f3ede8、描边 #f0ebe5。</p><p>强调色是偏粉的珊瑚橙 #fb8147，只用在文字、hover 边框和 focus outline 上；深一点的橙棕 #9e4f0a 作次级。</p>'
        },
        {
          slug: 'serif-not-sans', title: '衬线、楷体与明朝体', date: '2026-10-25',
          excerpt: '字体气质也猜错过：Georgia serif + 霞鹜文楷 + 汇文明朝体，不是极简无衬线。',
          tags: ['设计', '字体'], cover: '',
          body: '<p>正文是 Georgia serif，Hero 大字用霞鹜文楷（LXGW WenKai TC），另有汇文明朝体 Huiwen-MinchoGBK。</p><p>中文/暗色态回退到 PingFang SC、MiSans 这一组。衬线加楷体，才对得上那种「有温度」的气质。</p>'
        }
      ];
    }
    if (!this.data.projects.length) {
      this.data.projects = [
        { id: 'p1', title: '白小飞 · 博客', desc: '就是本站：静态前台 + 一层 Node BFF，带粒子 Hero、登录、上传、后台。', tag: 'Web', cover: '' },
        { id: 'p2', title: '粒子文字实验', desc: '把 canvas 字形采样、入场动画与鼠标力场单独抽成一个可复用的小组件。', tag: 'Canvas', cover: '' },
        { id: 'p3', title: '暖色主题集', desc: '一套从真实站点 CSS 里核实出来的色板与字体变量，供后续项目复用。', tag: 'Design', cover: '' }
      ];
    }
  }

  saveSync() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }

  // 串行写：所有 mutation 通过这里排队。
  mutate(fn) {
    this.chain = this.chain.then(() => {
      const r = fn(this.data);
      this.saveSync();
      return r;
    }).catch(e => { console.error('[store] mutate error', e); throw e; });
    return this.chain;
  }

  read(fn) { return fn(this.data); }

  gc(now) {
    const t = now || Date.now();
    return this.mutate(d => {
      const before = d.sessions.length + d.oauthStates.length;
      d.sessions = d.sessions.filter(s => s.expiresAt > t);
      d.oauthStates = d.oauthStates.filter(s => t - s.createdAt < 10 * 60 * 1000);
      return before - d.sessions.length - d.oauthStates.length;
    });
  }

  // ---- 用户 / 身份 ----
  // 用 (provider, openid) 找或建用户；unionid 存在时尝试跨 provider 归并到同一用户。
  upsertIdentity(provider, openid, unionid, profileSeed) {
    return this.mutate(d => {
      let ident = d.identities.find(i => i.provider === provider && i.openid === openid);
      let user;
      if (ident) {
        user = d.users.find(u => u.id === ident.userId);
      } else {
        // 若带 unionid，尝试并入已有用户（跨端打通的关键）
        if (unionid) {
          const sibling = d.identities.find(i => i.unionid && i.unionid === unionid);
          if (sibling) user = d.users.find(u => u.id === sibling.userId);
        }
        if (!user) {
          user = { id: rand(8), nickname: '访客', avatar: '', role: 'user', createdAt: nowISO() };
          d.users.push(user);
        }
        ident = { provider, openid: String(openid), unionid: unionid || '', userId: user.id, createdAt: nowISO() };
        d.identities.push(ident);
      }
      if (unionid && !ident.unionid) ident.unionid = unionid;
      // 首次资料填充：仅在用户还是默认「访客」时用平台昵称/头像覆盖
      const p = profileSeed || {};
      if (p.nickname && (user.nickname === '访客' || !user.nickname)) user.nickname = p.nickname;
      if (p.avatar && !user.avatar) user.avatar = p.avatar;
      return { user, ident };
    });
  }

  getUser(id) { return this.read(d => d.users.find(u => u.id === id) || null); }
  getIdentity(provider, openid) { return this.read(d => d.identities.find(i => i.provider === provider && i.openid === openid) || null); }

  updateProfile(userId, patch) {
    return this.mutate(d => {
      const u = d.users.find(x => x.id === userId);
      if (!u) return null;
      if (patch.nickname !== undefined) u.nickname = String(patch.nickname).slice(0, 40);
      if (patch.avatar !== undefined) u.avatar = patch.avatar;
      return u;
    });
  }

  providersOf(userId) {
    return this.read(d => d.identities.filter(i => i.userId === userId).map(i => i.provider));
  }

  // ---- 会话 ----
  createSession(userId, days) {
    const id = rand(24);
    const createdAt = Date.now();
    const expiresAt = createdAt + (days || 30) * 24 * 3600 * 1000;
    return this.mutate(d => {
      d.sessions.push({ id, userId, createdAt, expiresAt });
      return { id, expiresAt };
    });
  }
  session(id) {
    return this.read(d => {
      const s = d.sessions.find(x => x.id === id && x.expiresAt > Date.now());
      return s || null;
    });
  }
  dropSession(id) {
    return this.mutate(d => { d.sessions = d.sessions.filter(s => s.id !== id); });
  }

  // ---- OAuth state（防 CSRF） ----
  pushState(state, provider, redirect) {
    return this.mutate(d => { d.oauthStates.push({ state, provider, redirect, createdAt: Date.now() }); });
  }
  takeState(state, provider) {
    return this.mutate(d => {
      const i = d.oauthStates.findIndex(s => s.state === state && s.provider === provider && Date.now() - s.createdAt < 10 * 60 * 1000);
      if (i < 0) return null;
      const s = d.oauthStates[i];
      d.oauthStates.splice(i, 1);
      return s;
    });
  }

  // ---- 内容 ----
  posts() { return this.read(d => d.posts.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))); }
  post(slug) { return this.read(d => d.posts.find(p => p.slug === slug) || null); }
  projects() { return this.read(d => d.projects.slice()); }

  addPost(p) {
    return this.mutate(d => {
      const post = {
        slug: p.slug, title: p.title, date: p.date, excerpt: p.excerpt || '',
        tags: p.tags || [], body: p.body || '', cover: p.cover || ''
      };
      const i = d.posts.findIndex(x => x.slug === post.slug);
      if (i >= 0) d.posts[i] = post; else d.posts.push(post);
      return post;
    });
  }
  addProject(p) {
    return this.mutate(d => {
      const proj = { id: p.id || rand(6), title: p.title, desc: p.desc || '', tag: p.tag || '', cover: p.cover || '' };
      d.projects.push(proj);
      return proj;
    });
  }

  // ---- 评论 ----
  comments(postSlug) {
    return this.read(d => d.comments
      .filter(c => c.post === postSlug)
      .map(c => {
        const u = d.users.find(x => x.id === c.userId);
        return { id: c.id, user: { nickname: u ? u.nickname : '匿名', avatar: u ? u.avatar : '' }, text: c.text, date: c.date };
      }));
  }
  addComment(userId, postSlug, text, nickname) {
    return this.mutate(d => {
      const c = { id: rand(8), userId: userId || null, nickname: nickname || null, post: postSlug, text, date: nowISO().slice(0, 10) };
      d.comments.push(c);
      const u = userId ? d.users.find(x => x.id === userId) : null;
      return { id: c.id, user: { nickname: u ? u.nickname : (c.nickname || '匿名'), avatar: u ? u.avatar : '' }, text: c.text, date: c.date };
    });
  }

  // ---- 上传 ----
  addUpload(meta) {
    return this.mutate(d => { d.uploads.push(Object.assign({ date: nowISO() }, meta)); return meta; });
  }
  uploads() { return this.read(d => d.uploads.slice().reverse()); }
  uploadByName(name) { return this.read(d => d.uploads.find(u => u.name === name) || null); }

  // ---- 管理员账号（账号 + 密码，不再用 dev 便利规则判管理员） ----
  ensureAdminSync(username, password) {
    const existing = this.data.users.find(u => u.role === 'admin');
    if (existing) return existing;
    const hp = hashPassword(password);
    const u = {
      id: rand(10), nickname: username, username, avatar: '', role: 'admin',
      passwordHash: hp.hash, passwordSalt: hp.salt, createdAt: nowISO()
    };
    this.data.users.push(u);
    this.saveSync();
    return u;
  }
  adminByUsername(username) {
    return this.read(d => d.users.find(u => u.role === 'admin' && u.username === username) || null);
  }
  checkAdminPassword(username, password) {
    const u = this.adminByUsername(username);
    if (!u) return null;
    return verifyPassword(password, u.passwordSalt, u.passwordHash) ? u : null;
  }
  setAdminPassword(userId, password) {
    return this.mutate(d => {
      const u = d.users.find(x => x.id === userId && x.role === 'admin');
      if (!u) return false;
      const hp = hashPassword(password);
      u.passwordHash = hp.hash; u.passwordSalt = hp.salt;
      return true;
    });
  }

  // ---- 访客留言板：全员可见，管理员可删单条 / 清空 ----
  guestbook() {
    return this.read(d => d.guestbook.slice().reverse().map(g => ({
      id: g.id, nickname: g.nickname, text: g.text, date: g.date,
      createdAt: g.createdAt, userId: g.userId || null
    })));
  }
  addGuestbook(entry) {
    return this.mutate(d => {
      const g = {
        id: rand(10), userId: entry.userId || null,
        nickname: String(entry.nickname || '匿名').slice(0, 40),
        text: String(entry.text || '').slice(0, 1000),
        date: nowISO().slice(0, 10), createdAt: nowISO()
      };
      d.guestbook.push(g);
      return { id: g.id, nickname: g.nickname, text: g.text, date: g.date };
    });
  }
  deleteGuestbook(id) {
    return this.mutate(d => {
      const i = d.guestbook.findIndex(g => g.id === id);
      if (i < 0) return false;
      d.guestbook.splice(i, 1); return true;
    });
  }
  clearGuestbook() {
    return this.mutate(d => { const n = d.guestbook.length; d.guestbook = []; return n; });
  }

  uploadsPath(name) { return path.join(this.uploadsDir, name); }

  // ---- 站点设置 / 首页编排（后台可视化自定义） ----
  settings() { return this.read(d => JSON.parse(JSON.stringify(d.settings || {}))); }
  setSettings(patch) {
    return this.mutate(d => {
      d.settings = Object.assign({}, d.settings || {}, patch || {});
      return JSON.parse(JSON.stringify(d.settings));
    });
  }
  layout() {
    return this.read(d => d.layout ? JSON.parse(JSON.stringify(d.layout)) : null);
  }
  setLayout(l) {
    return this.mutate(d => { d.layout = l; return JSON.parse(JSON.stringify(l)); });
  }

  // ---- 内容 / 评论 / 上传 / 用户管理 ----
  allPosts() { return this.posts().slice(); }
  deletePost(slug) {
    return this.mutate(d => {
      const i = d.posts.findIndex(p => p.slug === slug);
      if (i < 0) return false;
      d.posts.splice(i, 1);
      d.comments = d.comments.filter(c => c.post !== slug);
      return true;
    });
  }
  deleteProject(id) {
    return this.mutate(d => {
      const i = d.projects.findIndex(p => p.id === id);
      if (i < 0) return false;
      d.projects.splice(i, 1); return true;
    });
  }
  allComments() {
    return this.read(d => d.comments.slice().reverse().map(c => {
      const u = d.users.find(x => x.id === c.userId);
      return { id: c.id, post: c.post, user: { nickname: u ? u.nickname : '匿名', avatar: u ? u.avatar : '' }, text: c.text, date: c.date, userId: c.userId };
    }));
  }
  deleteComment(id) {
    return this.mutate(d => {
      const i = d.comments.findIndex(c => c.id === id);
      if (i < 0) return false;
      d.comments.splice(i, 1); return true;
    });
  }
  deleteUpload(name) {
    return this.mutate(d => {
      const i = d.uploads.findIndex(u => u.name === name);
      if (i < 0) return false;
      d.uploads.splice(i, 1); return true;
    });
  }
  users() {
    return this.read(d => d.users.slice().map(u => ({
      id: u.id, nickname: u.nickname, avatar: u.avatar || '', role: u.role || 'user',
      createdAt: u.createdAt,
      providers: d.identities.filter(i => i.userId === u.id).map(i => i.provider)
    })));
  }
  setUserRole(id, role) {
    return this.mutate(d => {
      const u = d.users.find(x => x.id === id);
      if (!u) return null;
      u.role = role === 'admin' ? 'admin' : 'user';
      return { id: u.id, nickname: u.nickname, avatar: u.avatar || '', role: u.role, createdAt: u.createdAt };
    });
  }
}

Store.DEFAULT_LAYOUT = {
  modules: [
    { id: 'notice', label: '公告快讯', visible: true },
    { id: 'hero', label: '粒子 Hero', visible: true },
    { id: 'updates', label: '最新动态', visible: true },
    { id: 'series', label: '我在写的', visible: true },
    { id: 'projects', label: '我做的东西', visible: true },
    { id: 'stats', label: '站点状态', visible: true },
    { id: 'links', label: '在别处', visible: true },
    { id: 'about', label: '关于', visible: true }
  ]
};

Store.hashPassword = hashPassword;
Store.verifyPassword = verifyPassword;

module.exports = Store;
