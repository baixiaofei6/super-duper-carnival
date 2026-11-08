'use strict';

const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const U = require('./lib/util');
const A = require('./lib/auth');
const Store = require('./lib/store');

const DIR = __dirname;
const configPath = process.env.CONFIG_PATH || path.join(DIR, 'config.json');
const fallbackPath = path.join(DIR, 'config.example.json');
const chosenPath = fs.existsSync(configPath) ? configPath : fallbackPath;
const config = JSON.parse(fs.readFileSync(chosenPath, 'utf8'));

const PORT = Number(process.env.PORT || config.port || 8787);
let ADMIN_PORT = Number(process.env.ADMIN_PORT || config.adminPort || 8788);
if (ADMIN_PORT === PORT) ADMIN_PORT = PORT + 1;
const HOST = process.env.HOST || '127.0.0.1';
const DATA_DIR = process.env.DATA_DIR || path.join(DIR, 'data');
const PUBLIC_DIR = path.join(DIR, 'public');
const store = new Store(DATA_DIR);
const adminAccount = config.adminAccount || { username: '白小飞', password: '13135566867.' };
store.ensureAdminSync(adminAccount.username, adminAccount.password);

const ALLOWED_ERRORS = new Set([
  'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'BAD_REQUEST', 'BAD_JSON',
  'EXPECT_JSON', 'BODY_TOO_LARGE', 'PROVIDER_DISABLED', 'INVALID_STATE', 'UPLOAD_REJECTED'
]);

function corsHeaders() {
  if (!config.cors) return {};
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  };
}

function ok(res, status, data) {
  U.json(res, status, Object.assign({ ok: true }, data || {}), corsHeaders());
}

function fail(res, status, code, message) {
  const body = { ok: false, error: ALLOWED_ERRORS.has(code) ? code : 'BAD_REQUEST' };
  if (message) body.message = String(message).slice(0, 300);
  U.json(res, status, body, corsHeaders());
}

function publicUser(u) {
  if (!u) return null;
  return { id: u.id, nickname: u.nickname, avatar: u.avatar || '' };
}

function sessionId(req) {
  const auth = String(req.headers.authorization || '');
  const m = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (m) return m[1].trim();
  return U.parseCookies(req).sid || '';
}

function currentUser(req) {
  const s = store.session(sessionId(req));
  return s ? store.getUser(s.userId) : null;
}

function isAdmin(user) {
  return !!(user && user.role === 'admin');
}

function requireUser(req, res) {
  const u = currentUser(req);
  if (!u) { fail(res, 401, 'UNAUTHORIZED', '请先登录'); return null; }
  return u;
}

function requireAdmin(req, res) {
  const u = requireUser(req, res);
  if (!u) return null;
  if (!isAdmin(u)) { fail(res, 403, 'FORBIDDEN', '需要管理员权限'); return null; }
  return u;
}

function setSessionCookie(res, session) {
  return {
    'Set-Cookie': U.cookie('sid', session.id, {
      maxAge: (config.sessionDays || 30) * 24 * 3600,
      secure: !!config.secureCookies
    })
  };
}

async function issueSession(res, user, status) {
  const session = await store.createSession(user.id, config.sessionDays || 30);
  const headers = Object.assign(setSessionCookie(res, session), corsHeaders());
  U.json(res, status || 200, {
    ok: true, user: publicUser(user), sessionId: session.id, expiresAt: session.expiresAt
  }, headers);
}

function safeRedirect(v) {
  const s = String(v || '/');
  return s.charAt(0) === '/' && s.slice(0, 2) !== '//' ? s : '/';
}

function xmlEscape(s) { return U.escapeHtml(s == null ? '' : s); }

function rssXml() {
  const site = config.site || {};
  const base = String(config.baseUrl || '').replace(/\/$/, '');
  const items = store.posts().map(p => {
    const link = base + '/#/notes/' + encodeURIComponent(p.slug);
    return '    <item>\n' +
      '      <title>' + xmlEscape(p.title) + '</title>\n' +
      '      <link>' + xmlEscape(link) + '</link>\n' +
      '      <guid isPermaLink="false">' + xmlEscape(p.slug) + '</guid>\n' +
      '      <pubDate>' + xmlEscape(p.date) + '</pubDate>\n' +
      '      <description>' + xmlEscape(p.excerpt || '') + '</description>\n' +
      '    </item>';
  }).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0"><channel>\n' +
    '  <title>' + xmlEscape(site.name || 'Blog') + '</title>\n' +
    '  <link>' + xmlEscape(base + '/') + '</link>\n' +
    '  <description>' + xmlEscape(site.about || site.tagline || '') + '</description>\n' +
    items + '\n</channel></rss>\n';
}

async function serveStatic(req, res, pathname, surface) {
  let rel;
  if (pathname === '/' || pathname === '/index.html') rel = surface === 'admin' ? 'admin.html' : 'index.html';
  else if (pathname === '/admin' || pathname === '/admin/' || pathname === '/admin.html') {
    if (surface !== 'admin') { U.text(res, 404, 'Not Found'); return; }
    rel = 'admin.html';
  }
  else if (pathname.indexOf('/assets/') === 0) rel = path.join('assets', pathname.slice('/assets/'.length));
  else { U.text(res, 404, 'Not Found'); return; }
  try { rel = decodeURIComponent(rel); } catch (e) { U.text(res, 400, 'Bad Request'); return; }
  const file = path.resolve(PUBLIC_DIR, rel);
  if (file !== path.resolve(PUBLIC_DIR) && !file.startsWith(path.resolve(PUBLIC_DIR) + path.sep)) {
    U.text(res, 403, 'Forbidden'); return;
  }
  if (rel.indexOf('..') >= 0) { U.text(res, 403, 'Forbidden'); return; }
  try {
    const buf = await fsp.readFile(file);
    const headers = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' };
    Object.assign(headers, corsHeaders());
    res.writeHead(200, Object.assign({ 'Content-Type': U.mimeOf(file), 'Content-Length': buf.length }, headers));
    res.end(buf);
  } catch (e) {
    if (pathname === '/' || pathname === '/index.html') {
      U.text(res, 200, '页面尚未生成：public/' + (surface === 'admin' ? 'admin.html' : 'index.html'));
    } else {
      U.text(res, 404, 'Not Found');
    }
  }
}

async function serveUpload(res, name) {
  if (!/^[A-Za-z0-9._-]+$/.test(name) || !store.uploadByName(name)) {
    U.text(res, 404, 'Not Found'); return;
  }
  try {
    const buf = await fsp.readFile(store.uploadsPath(name));
    const headers = { 'X-Content-Type-Options': 'nosniff' };
    Object.assign(headers, corsHeaders());
    res.writeHead(200, Object.assign({ 'Content-Type': U.mimeOf(name), 'Content-Length': buf.length }, headers));
    res.end(buf);
  } catch (e) { U.text(res, 404, 'Not Found'); }
}

function errorCode(e) {
  if (e && e.code) return e.code;
  if (e && e.message === 'BODY_TOO_LARGE') return 'BODY_TOO_LARGE';
  return 'BAD_REQUEST';
}

function errorStatus(code) {
  if (code === 'UNAUTHORIZED') return 401;
  if (code === 'FORBIDDEN') return 403;
  if (code === 'NOT_FOUND') return 404;
  if (code === 'BODY_TOO_LARGE') return 413;
  if (code === 'BAD_JSON' || code === 'EXPECT_JSON' || code === 'BAD_REQUEST' ||
      code === 'PROVIDER_DISABLED' || code === 'INVALID_STATE' || code === 'UPLOAD_REJECTED') return 400;
  return 500;
}

function handleApiError(res, e, fallback) {
  let code = errorCode(e);
  if (code === 'BAD_REQUEST' && fallback) code = fallback;
  if (!ALLOWED_ERRORS.has(code)) code = 'BAD_REQUEST';
  fail(res, errorStatus(code), code, e && e.message ? e.message : undefined);
}

async function api(req, res, u, surface) {
  const method = req.method || 'GET';
  const pathname = u.pathname;
  const q = u.searchParams;
  const isPublic = surface === 'public';
  if (isPublic && (pathname.indexOf('/api/admin/') === 0 || pathname === '/api/login/admin' || pathname === '/api/login/dev' || pathname === '/api/login/mini')) {
    return fail(res, 404, 'NOT_FOUND');
  }
  // 只有管理员能调整网站内容：主站写内容类接口一律关闭
  if (isPublic && method === 'POST' && ['/api/comments','/api/guestbook','/api/upload'].indexOf(pathname) >= 0) {
    if (pathname === '/api/upload') return fail(res, 404, 'NOT_FOUND');
  }

  if (pathname === '/api/health') {
    return ok(res, 200, { uptime: Math.floor(process.uptime()) });
  }

  if (pathname === '/api/bootstrap') {
    const base = config.site || {};
    const saved = store.settings();
    const site = Object.assign({}, base, saved);
    return ok(res, 200, {
      site: {
        name: site.name || '', hero: site.hero || '', sub: site.sub || '',
        tagline: site.tagline || '', about: site.about || '', footer: site.footer || '',
        icp: site.icp || '', links: site.links || [],
        announcement: site.announcement || '',
        theme: Object.assign({}, base.theme || {}, site.theme || {}),
        heroFx: Object.assign({}, base.heroFx || {}, site.heroFx || {})
      },
      layout: store.layout() || Store.DEFAULT_LAYOUT,
      providers: A.providersStatus(config),
      user: publicUser(currentUser(req)),
      admin: isPublic ? false : isAdmin(currentUser(req)),
      urls: { main: config.baseUrl || 'http://127.0.0.1:' + PORT },
      api: 1
    });
  }

  if (pathname === '/api/posts') {
    const posts = store.posts().map(p => ({
      slug: p.slug, title: p.title, date: p.date, excerpt: p.excerpt || '',
      tags: p.tags || [], cover: p.cover || ''
    }));
    return ok(res, 200, { posts });
  }

  if (pathname.indexOf('/api/posts/') === 0) {
    const slug = decodeURIComponent(pathname.slice('/api/posts/'.length));
    const post = store.post(slug);
    if (!post) return fail(res, 404, 'NOT_FOUND');
    return ok(res, 200, { post });
  }

  if (pathname === '/api/projects') return ok(res, 200, { projects: store.projects() });

  if (pathname === '/api/comments' && method === 'GET') {
    const slug = q.get('post');
    if (!slug) return fail(res, 400, 'BAD_REQUEST', '缺少 post 参数');
    return ok(res, 200, { comments: store.comments(slug) });
  }

  if (pathname === '/api/rss') {
    res.writeHead(200, Object.assign({
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Content-Length': Buffer.byteLength(rssXml()),
      'X-Content-Type-Options': 'nosniff'
    }, corsHeaders()));
    return res.end(rssXml());
  }

  if (pathname === '/api/login/admin' && method === 'POST') {
    if (isPublic) return fail(res, 404, 'NOT_FOUND');
    const b = await U.readJson(req, config.upload.maxBytes);
    const user = store.checkAdminPassword(String(b.username || ''), String(b.password || ''));
    if (!user) return fail(res, 401, 'UNAUTHORIZED', '账号或密码错误');
    return issueSession(res, user);
  }

  if (pathname === '/api/login/dev' && method === 'POST') {
    if (!A.enabled(config, 'dev')) return fail(res, 400, 'PROVIDER_DISABLED');
    const body = await U.readJson(req, config.upload.maxBytes);
    const user = await A.devLogin(store, body.nickname);
    return issueSession(res, user);
  }

  if (pathname === '/api/login/mini' && method === 'POST') {
    if (!A.enabled(config, 'mini')) return fail(res, 400, 'PROVIDER_DISABLED');
    const body = await U.readJson(req, config.upload.maxBytes);
    if (!body.code) return fail(res, 400, 'BAD_REQUEST', '缺少 code');
    const user = await A.miniByCode(config, body.code, store);
    return issueSession(res, user);
  }

  if (pathname === '/api/auth/wechat/start' || pathname === '/api/auth/qq/start') {
    const provider = pathname.indexOf('wechat') >= 0 ? 'wechat' : 'qq';
    if (!A.enabled(config, provider)) return fail(res, 400, 'PROVIDER_DISABLED');
    const state = U.rand(16);
    await store.pushState(state, provider, safeRedirect(q.get('redirect')));
    const cb = String(config.baseUrl || '').replace(/\/$/, '') + '/api/auth/' + provider + '/callback';
    const url = provider === 'wechat'
      ? A.wechatAuthorizeURL(config, state, cb)
      : A.qqAuthorizeURL(config, state, cb);
    return U.redirect(res, url, corsHeaders());
  }

  if (pathname === '/api/auth/wechat/callback' || pathname === '/api/auth/qq/callback') {
    const provider = pathname.indexOf('wechat') >= 0 ? 'wechat' : 'qq';
    const st = await store.takeState(q.get('state') || '', provider);
    if (!st) return fail(res, 400, 'INVALID_STATE');
    const code = q.get('code') || '';
    if (!code) return fail(res, 400, 'BAD_REQUEST', '缺少 code');
    const cb = String(config.baseUrl || '').replace(/\/$/, '') + '/api/auth/' + provider + '/callback';
    const user = provider === 'wechat'
      ? await A.wechatByCode(config, code, store)
      : await A.qqByCode(config, code, cb, store);
    const session = await store.createSession(user.id, config.sessionDays || 30);
    const headers = Object.assign(setSessionCookie(res, session), {});
    Object.assign(headers, corsHeaders());
    return U.redirect(res, safeRedirect(st.redirect), headers);
  }

  if (pathname === '/api/me') {
    const user = requireUser(req, res); if (!user) return;
    return ok(res, 200, { user: publicUser(user), providers: store.providersOf(user.id), admin: isAdmin(user) });
  }

  if (pathname === '/api/profile' && method === 'POST') {
    const user = requireUser(req, res); if (!user) return;
    const body = await U.readJson(req, config.upload.maxBytes);
    const patch = {};
    if (body.nickname !== undefined) {
      const n = String(body.nickname).trim().slice(0, 40);
      if (!n) return fail(res, 400, 'BAD_REQUEST', '昵称不能为空');
      patch.nickname = n;
    }
    if (body.avatar !== undefined) {
      const raw = String(body.avatar);
      if (raw) {
        const av = U.normalizeAvatar(raw);
        if (!av) return fail(res, 400, 'BAD_REQUEST', '头像只允许 /uploads/ 路径或图片 data URL');
        patch.avatar = av;
      } else patch.avatar = '';
    }
    const updated = await store.updateProfile(user.id, patch);
    return ok(res, 200, { user: publicUser(updated) });
  }

  if (pathname === '/api/logout' && method === 'POST') {
    const sid = sessionId(req);
    if (sid) await store.dropSession(sid);
    const headers = Object.assign({
      'Set-Cookie': U.cookie('sid', '', { maxAge: 0, secure: !!config.secureCookies })
    }, corsHeaders());
    return U.json(res, 200, { ok: true }, headers);
  }

  if (pathname === '/api/comments' && method === 'POST') {
    const user = currentUser(req);
    const body = await U.readJson(req, config.upload.maxBytes);
    const slug = String(body.post || '');
    const text = String(body.text || '').trim();
    const nickname = user ? user.nickname : String(body.nickname || '').trim();
    if (!store.post(slug)) return fail(res, 400, 'BAD_REQUEST', '文章不存在');
    if (!text || text.length > 1000) return fail(res, 400, 'BAD_REQUEST', '评论长度需在 1..1000 字');
    if (!user && (!nickname || nickname.length > 40)) return fail(res, 400, 'BAD_REQUEST', '请填写 1..40 字昵称');
    const comment = await store.addComment(user ? user.id : null, slug, text, nickname);
    return ok(res, 201, { comment });
  }

  if (pathname === '/api/upload' && method === 'POST') {
    if (isPublic) return fail(res, 404, 'NOT_FOUND');
    const user = requireAdmin(req, res); if (!user) return;
    const buf = await U.readBody(req, config.upload.maxBytes);
    const parts = U.parseMultipart(buf, U.boundaryFrom(req.headers['content-type']));
    const part = parts.find(p => p.name === 'file' && p.filename);
    if (!part) return fail(res, 400, 'UPLOAD_REJECTED', '缺少 file 字段');
    const original = U.safeFilename(part.filename);
    const ext = path.extname(original).toLowerCase();
    const allowed = (config.upload.extensions || []).map(x => '.' + String(x).toLowerCase().replace(/^\./, ''));
    if (!ext || allowed.indexOf(ext) < 0) return fail(res, 400, 'UPLOAD_REJECTED', '扩展名不在白名单');
    if (!part.data.length || part.data.length > config.upload.maxBytes) return fail(res, 400, 'UPLOAD_REJECTED', '文件超过大小上限');
    const name = U.rand(12) + ext;
    await fsp.writeFile(store.uploadsPath(name), part.data);
    const meta = {
      name, url: '/uploads/' + name, size: part.data.length,
      type: part.type || U.mimeOf(name), owner: user.id, source: 'user', original
    };
    await store.addUpload(meta);
    return ok(res, 201, { file: { name: meta.name, url: meta.url, size: meta.size, type: meta.type } });
  }

  if (pathname === '/api/uploads' && method === 'GET') {
    const user = requireUser(req, res); if (!user) return;
    const all = store.uploads();
    const uploads = isAdmin(user) ? all : all.filter(f => f.owner === user.id);
    return ok(res, 200, { uploads });
  }

  if (pathname === '/api/admin/overview') {
    if (!requireAdmin(req, res)) return;
    return ok(res, 200, { counts: {
      posts: store.posts().length,
      projects: store.projects().length,
      comments: store.read(d => d.comments.length),
      uploads: store.uploads().length,
      users: store.read(d => d.users.length),
      sessions: store.read(d => d.sessions.filter(s => s.expiresAt > Date.now()).length)
    } });
  }

  if (pathname === '/api/admin/posts' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const b = await U.readJson(req, config.upload.maxBytes);
    const title = String(b.title || '').trim();
    if (!title) return fail(res, 400, 'BAD_REQUEST', '缺少 title');
    if (b.tags !== undefined && (!Array.isArray(b.tags) || b.tags.some(t => typeof t !== 'string'))) {
      return fail(res, 400, 'BAD_REQUEST', 'tags 必须是字符串数组');
    }
    const post = await store.addPost({
      title,
      slug: b.slug ? U.slugify(b.slug) : U.slugify(title),
      date: b.date || U.nowISO().slice(0, 10),
      excerpt: b.excerpt || '', tags: b.tags || [], body: b.body || '', cover: b.cover || ''
    });
    return ok(res, 201, { post });
  }

  if (pathname === '/api/admin/projects' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const b = await U.readJson(req, config.upload.maxBytes);
    const title = String(b.title || '').trim();
    if (!title) return fail(res, 400, 'BAD_REQUEST', '缺少 title');
    const project = await store.addProject({
      title, desc: b.desc || '', tag: b.tag || '', cover: b.cover || ''
    });
    return ok(res, 201, { project });
  }



  // ---- 访客留言板：全员可读，可匿名（填昵称）发表 ----
  if (pathname === '/api/guestbook' && method === 'GET') {
    return ok(res, 200, { guestbook: store.guestbook() });
  }
  if (pathname === '/api/guestbook' && method === 'POST') {
    const b = await U.readJson(req, config.upload.maxBytes);
    const user = currentUser(req);
    const nickname = user ? user.nickname : String(b.nickname || '').trim();
    const text = String(b.text || '').trim();
    if (!nickname || nickname.length > 40) return fail(res, 400, 'BAD_REQUEST', '请填写 1..40 字昵称');
    if (!text || text.length > 1000) return fail(res, 400, 'BAD_REQUEST', '留言需 1..1000 字');
    const entry = await store.addGuestbook({ userId: user ? user.id : null, nickname, text });
    return ok(res, 201, { entry });
  }
  if (pathname === '/api/admin/guestbook/delete' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const b = await U.readJson(req, config.upload.maxBytes);
    const deleted = await store.deleteGuestbook(String(b.id || ''));
    if (!deleted) return fail(res, 404, 'NOT_FOUND');
    return ok(res, 200, { deleted: true });
  }
  if (pathname === '/api/admin/guestbook/clear' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const cleared = await store.clearGuestbook();
    return ok(res, 200, { cleared });
  }
  if (pathname === '/api/admin/password' && method === 'POST') {
    const user = requireAdmin(req, res); if (!user) return;
    const b = await U.readJson(req, config.upload.maxBytes);
    if (!store.checkAdminPassword(user.username, String(b.oldPassword || ''))) {
      return fail(res, 400, 'BAD_REQUEST', '原密码不正确');
    }
    const np = String(b.newPassword || '');
    if (np.length < 6 || np.length > 128) return fail(res, 400, 'BAD_REQUEST', '新密码需 6..128 字符');
    await store.setAdminPassword(user.id, np);
    return ok(res, 200, { changed: true });
  }
  // ---- 站点设置 / 首页编排（管理员） ----
  if (pathname === '/api/admin/settings') {
    if (isPublic) return fail(res, 404, 'NOT_FOUND');
    if (!requireAdmin(req, res)) return;
    if (method === 'GET') return ok(res, 200, { settings: store.settings(), defaults: config.site || {} });
    if (method === 'POST') {
      const b = await U.readJson(req, config.upload.maxBytes);
      const allowed = ['name','hero','sub','tagline','about','footer','icp','announcement'];
      const patch = {};
      for (const k of allowed) if (b[k] !== undefined) patch[k] = String(b[k]).slice(0, 600);
      if (b.links !== undefined) {
        if (!Array.isArray(b.links) || b.links.length > 20 || b.links.some(l => !l || typeof l.label !== 'string' || typeof l.url !== 'string')) {
          return fail(res, 400, 'BAD_REQUEST', 'links 必须是 [{label,url}] 数组，最多 20 条');
        }
        patch.links = b.links.map(l => ({ label: l.label.slice(0, 80), url: l.url.slice(0, 300) }));
      }
      if (b.theme !== undefined) {
        const t = (b.theme && typeof b.theme === 'object' && !Array.isArray(b.theme)) ? b.theme : {};
        const theme = Object.assign({}, (config.site && config.site.theme) || {}, store.settings().theme || {});
        for (const k of ['accent','orbA','orbB','orbC','bgColor','textColor','cardColor']) {
          if (t[k] !== undefined) {
            if (typeof t[k] !== 'string' || !/^#[0-9a-fA-F]{3,8}$/.test(t[k])) return fail(res, 400, 'BAD_REQUEST', 'theme.' + k + ' must be a hex color');
            theme[k] = t[k];
          }
        }
        for (const k of ['glow','glass','grid','halo']) if (t[k] !== undefined) {
          if (typeof t[k] !== 'boolean') return fail(res, 400, 'BAD_REQUEST', 'theme.' + k + ' must be boolean');
          theme[k] = t[k];
        }
        if (t.density !== undefined) {
          if (['compact','comfortable'].indexOf(t.density) < 0) return fail(res, 400, 'BAD_REQUEST', 'theme.density must be compact or comfortable');
          theme.density = t.density;
        }
        if (t.mode !== undefined) {
          if (['light','dark','auto'].indexOf(t.mode) < 0) return fail(res, 400, 'BAD_REQUEST', 'theme.mode must be light, dark or auto');
          theme.mode = t.mode;
        }
        if (t.bgImage !== undefined) {
          const v = String(t.bgImage);
          if (v && (v.length > 300 || (!/^\/uploads\/[A-Za-z0-9._-]+$/.test(v) && !/^https:\/\//.test(v)))) {
            return fail(res, 400, 'BAD_REQUEST', 'theme.bgImage 需为 /uploads/ 文件或 https URL');
          }
          theme.bgImage = v.slice(0, 300);
        }
        patch.theme = theme;
      }
      if (b.heroFx !== undefined) {
        const f = b.heroFx && typeof b.heroFx === 'object' ? b.heroFx : {};
        const fx = Object.assign({}, (config.site && config.site.heroFx) || {}, store.settings().heroFx || {});
        for (const k of ['radius','strength','trail']) {
          if (f[k] === undefined) continue;
          const v = Number(f[k]);
          if (!Number.isFinite(v)) return fail(res, 400, 'BAD_REQUEST', 'heroFx.' + k + ' must be a number');
          fx[k] = k === 'trail' ? Math.max(0.05, Math.min(1, v)) : Math.max(20, Math.min(400, v));
        }
        if (typeof f.halo === 'boolean') fx.halo = f.halo;
        patch.heroFx = fx;
      }
      const settings = await store.setSettings(patch);
      return ok(res, 200, { settings, site: Object.assign({}, config.site || {}, settings) });
    }
  }

  if (pathname === '/api/admin/layout') {
    if (!requireAdmin(req, res)) return;
    if (method === 'GET') return ok(res, 200, { layout: store.layout() || Store.DEFAULT_LAYOUT });
    if (method === 'POST') {
      const b = await U.readJson(req, config.upload.maxBytes);
      const defaults = Store.DEFAULT_LAYOUT.modules;
      if (!Array.isArray(b.modules) || b.modules.length !== defaults.length) {
        return fail(res, 400, 'BAD_REQUEST', 'modules 必须包含全部模块');
      }
      const byId = new Map(defaults.map(m => [m.id, m]));
      const seen = new Set();
      const mods = [];
      for (const m of b.modules) {
        if (!m || !byId.has(m.id) || seen.has(m.id)) return fail(res, 400, 'BAD_REQUEST', '模块 id 重复或无效');
        seen.add(m.id);
        mods.push({ id: m.id, label: byId.get(m.id).label, visible: m.visible !== false });
      }
      const layout = await store.setLayout({ modules: mods });
      return ok(res, 200, { layout });
    }
  }

  // ---- 内容 / 评论 / 上传 / 用户管理 ----
  if (pathname === '/api/admin/content') {
    if (!requireAdmin(req, res)) return;
    return ok(res, 200, { posts: store.allPosts(), projects: store.projects(), comments: store.allComments(), guestbook: store.guestbook(), uploads: store.uploads(), users: store.users() });
  }

  if (pathname === '/api/admin/posts/delete' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const b = await U.readJson(req, config.upload.maxBytes);
    const deleted = await store.deletePost(String(b.slug || ''));
    if (!deleted) return fail(res, 404, 'NOT_FOUND');
    return ok(res, 200, { deleted: true });
  }

  if (pathname === '/api/admin/projects/delete' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const b = await U.readJson(req, config.upload.maxBytes);
    const deleted = await store.deleteProject(String(b.id || ''));
    if (!deleted) return fail(res, 404, 'NOT_FOUND');
    return ok(res, 200, { deleted: true });
  }

  if (pathname === '/api/admin/comments/delete' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const b = await U.readJson(req, config.upload.maxBytes);
    const deleted = await store.deleteComment(String(b.id || ''));
    if (!deleted) return fail(res, 404, 'NOT_FOUND');
    return ok(res, 200, { deleted: true });
  }

  if (pathname === '/api/admin/uploads/delete' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const b = await U.readJson(req, config.upload.maxBytes);
    const name = String(b.name || '');
    if (!/^[A-Za-z0-9._-]+$/.test(name)) return fail(res, 400, 'BAD_REQUEST', '文件名非法');
    const deleted = await store.deleteUpload(name);
    if (!deleted) return fail(res, 404, 'NOT_FOUND');
    try { await fsp.unlink(store.uploadsPath(name)); } catch (e) {}
    return ok(res, 200, { deleted: true });
  }

  if (pathname === '/api/admin/users') {
    if (!requireAdmin(req, res)) return;
    return ok(res, 200, { users: store.users() });
  }

  if (pathname === '/api/admin/users/role' && method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const b = await U.readJson(req, config.upload.maxBytes);
    if (['admin','user'].indexOf(b.role) < 0) return fail(res, 400, 'BAD_REQUEST', 'role 只能是 admin 或 user');
    const user = await store.setUserRole(String(b.id || ''), b.role);
    if (!user) return fail(res, 404, 'NOT_FOUND');
    return ok(res, 200, { user });
  }

  return fail(res, 404, 'NOT_FOUND');
}

function makeHandler(surface) {
  return async function handler(req, res) {
  try {
    const u = new URL(req.url, 'http://localhost');
    const pathname = u.pathname;
    if (req.method === 'OPTIONS') {
      res.writeHead(204, Object.assign({ 'Content-Length': 0 }, corsHeaders()));
      return res.end();
    }
    if (pathname.indexOf('/api/') === 0) {
      try { await api(req, res, u, surface); }
      catch (e) { handleApiError(res, e); }
      return;
    }
    if (pathname.indexOf('/uploads/') === 0 && req.method === 'GET') {
      return serveUpload(res, decodeURIComponent(pathname.slice('/uploads/'.length)));
    }
    if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(req, res, pathname, surface);
    return U.text(res, 404, 'Not Found');
  } catch (e) {
    handleApiError(res, e);
  }
  };
}

const publicServer = http.createServer(makeHandler('public'));
const adminServer = http.createServer(makeHandler('admin'));

const gcTimer = setInterval(() => { store.gc().catch(e => console.error('[gc]', e.message)); }, 10 * 60 * 1000);
gcTimer.unref();

publicServer.listen(PORT, HOST, () => {
  console.log('READY ' + PORT);
});
adminServer.listen(ADMIN_PORT, HOST, () => {
  console.log('ADMIN READY ' + ADMIN_PORT);
  console.log('[blog] config=' + path.basename(chosenPath) + ' data=' + DATA_DIR + ' adminPort=' + ADMIN_PORT);
});
