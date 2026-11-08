'use strict';
// 身份层：provider-agnostic。每个适配器只负责把「外部身份」换成
// (provider, openid[, unionid]) 三元组，然后交给 store.upsertIdentity。
// 这是「资质依赖解耦」的核心：现在用 dev/mini 把全流程跑通，
// 资质下来后只改这里的适配器，业务代码（会话、评论、上传、后台）一行不用动。
const { rand, fetchJson, extFromContentType, fetchBuffer } = require('./util');

// 微信网页（开放平台「网站应用」）—— 需要已审核网站应用 + 备案域名。
// 官方文档：https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Wechat_Login.html
const WECHAT_AUTHORIZE = 'https://open.weixin.qq.com/connect/qrconnect';
const WECHAT_TOKEN = 'https://api.weixin.qq.com/sns/oauth2/access_token';
const WECHAT_USERINFO = 'https://api.weixin.qq.com/sns/userinfo';

// QQ 互联（网站应用）—— 同样需要审核应用 + 备案回调域名。
// 官方文档：https://wiki.connect.qq.com/网站应用接入流程/
const QQ_AUTHORIZE = 'https://graph.qq.com/oauth2.0/authorize';
const QQ_TOKEN = 'https://graph.qq.com/oauth2.0/token';
const QQ_OPENID = 'https://graph.qq.com/oauth2.0/me';
const QQ_USERINFO = 'https://graph.qq.com/user/get_user_info';

// 小程序 code2Session —— 个人主体可注册，不需要网站应用审核。
// 官方文档：https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html
const MP_CODE2SESSION = 'https://api.weixin.qq.com/sns/jscode2session';

function enabled(config, name) {
  const p = config.providers && config.providers[name];
  return !!(p && p.enabled && (p.appid || name === 'dev'));
}

function providersStatus(config) {
  return {
    dev: enabled(config, 'dev'),
    wechat: enabled(config, 'wechat'),
    qq: enabled(config, 'qq'),
    mini: enabled(config, 'mini')
  };
}

// ---- 微信网页 ----
function wechatAuthorizeURL(config, state, redirectUri) {
  const appid = config.providers.wechat.appid;
  const u = new URL(WECHAT_AUTHORIZE);
  u.searchParams.set('appid', appid);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', 'snsapi_login');
  u.searchParams.set('state', state);
  u.hash = 'wechat_redirect';
  return u.toString();
}

async function wechatByCode(config, code, store) {
  const c = config.providers.wechat;
  const tokenUrl = WECHAT_TOKEN + '?appid=' + encodeURIComponent(c.appid) +
    '&secret=' + encodeURIComponent(c.secret) + '&code=' + encodeURIComponent(code) +
    '&grant_type=authorization_code';
  const tok = await fetchJson(tokenUrl);
  const t = tok.data || {};
  if (!t.access_token || !t.openid) {
    const e = new Error('WECHAT_TOKEN_FAILED:' + (t.errmsg || tok.raw.slice(0, 120)));
    e.code = 'WECHAT_TOKEN_FAILED';
    throw e;
  }
  // sns/userinfo 直接返回 nickname / headimgurl（这正是「直接用头像和名字」的来源）
  const infoUrl = WECHAT_USERINFO + '?access_token=' + encodeURIComponent(t.access_token) +
    '&openid=' + encodeURIComponent(t.openid) + '&lang=zh_CN';
  const info = await fetchJson(infoUrl);
  const p = info.data || {};
  // 头像 URL 会失效 → 服务端下载自存（官方明确要求）
  const avatar = await persistAvatar(store, p.headimgurl);
  const r = await store.upsertIdentity('wechat', t.openid, t.unionid || p.unionid || '', {
    nickname: p.nickname, avatar
  });
  return r.user;
}

// ---- QQ 网页 ----
function qqAuthorizeURL(config, state, redirectUri) {
  const c = config.providers.qq;
  const u = new URL(QQ_AUTHORIZE);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', c.appid);
  u.searchParams.set('redirect_uri', redirectUri);
  u.searchParams.set('state', state);
  u.searchParams.set('scope', 'get_user_info');
  return u.toString();
}

async function qqByCode(config, code, redirectUri, store) {
  const c = config.providers.qq;
  const tokenUrl = QQ_TOKEN + '?grant_type=authorization_code' +
    '&client_id=' + encodeURIComponent(c.appid) +
    '&client_secret=' + encodeURIComponent(c.appkey) +
    '&code=' + encodeURIComponent(code) +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&fmt=json&need_openid=1';
  const tok = await fetchJson(tokenUrl);
  let t = tok.data || {};
  let accessToken = t.access_token;
  let openid = t.openid;
  if (!accessToken) { // 兼容 x-www-form-urlencoded
    const qs = new URLSearchParams(tok.raw);
    accessToken = qs.get('access_token');
  }
  if (!accessToken) {
    const e = new Error('QQ_TOKEN_FAILED:' + tok.raw.slice(0, 120));
    e.code = 'QQ_TOKEN_FAILED';
    throw e;
  }
  if (!openid) {
    const me = await fetchJson(QQ_OPENID + '?access_token=' + encodeURIComponent(accessToken) + '&fmt=json');
    openid = (me.data && me.data.openid) || null;
    if (!openid) {
      const m = /"openid"\s*:\s*"([^"]+)"/.exec(me.raw);
      openid = m ? m[1] : null;
    }
  }
  if (!openid) { const e = new Error('QQ_OPENID_FAILED'); e.code = 'QQ_OPENID_FAILED'; throw e; }
  const infoUrl = QQ_USERINFO + '?access_token=' + encodeURIComponent(accessToken) +
    '&oauth_consumer_key=' + encodeURIComponent(c.appid) + '&openid=' + encodeURIComponent(openid);
  const info = await fetchJson(infoUrl);
  const p = info.data || {};
  // 优先 figureurl_qq_2(100x100)，回退 40x40（官方保证一定有）
  const avatarUrl = p.figureurl_qq_2 || p.figureurl_qq_1 || p.figureurl_2 || p.figureurl_1 || '';
  const avatar = await persistAvatar(store, avatarUrl);
  const r = await store.upsertIdentity('qq', openid, '', { nickname: p.nickname, avatar });
  return r.user;
}

// ---- 小程序 ----
async function miniByCode(config, code, store) {
  const c = config.providers.mini;
  const url = MP_CODE2SESSION + '?appid=' + encodeURIComponent(c.appid) +
    '&secret=' + encodeURIComponent(c.secret) + '&js_code=' + encodeURIComponent(code) +
    '&grant_type=authorization_code';
  const r = await fetchJson(url);
  const d = r.data || {};
  if (!d.openid) {
    const e = new Error('MINI_CODE2SESSION_FAILED:' + (d.errmsg || r.raw.slice(0, 120)));
    e.code = 'MINI_CODE2SESSION_FAILED';
    throw e;
  }
  // 注意：code2Session 只有 openid/unionid/session_key，没有昵称头像。
  // 昵称头像由小程序端「头像昵称填写能力」(chooseAvatar + nickname) 收集后
  // 调 /api/profile 补写，见 8.x 文档与 admin.html。
  const res = await store.upsertIdentity('mini', d.openid, d.unionid || '', {});
  return res.user;
}

// ---- 开发 / 体验模式 ----
// 零门槛：任意昵称即可登录，生成稳定的 dev openid。仅用于本地开发与体验。
// 生产环境请把 config.providers.dev.enabled 设为 false。
async function devLogin(store, nickname) {
  const name = String(nickname || '访客').trim().slice(0, 40) || '访客';
  const openid = 'dev-' + require('./util').sha256(name).slice(0, 16);
  const r = await store.upsertIdentity('dev', openid, '', { nickname: name });
  return r.user;
}

// 下载远端头像到 /uploads，返回本地 URL；失败返回 ''（不阻断登录）。
async function persistAvatar(store, url) {
  if (!url || !/^https?:\/\//i.test(url)) return '';
  try {
    const r = await fetchBuffer(url, { maxBytes: 2 * 1024 * 1024, timeout: 8000 });
    if (r.status !== 200 || !r.body.length) return '';
    const ext = extFromContentType(r.headers['content-type']) || '.jpg';
    const name = 'avatar-' + rand(10) + ext;
    require('fs').writeFileSync(store.uploadsPath(name), r.body);
    const meta = { name, url: '/uploads/' + name, size: r.body.length, type: r.headers['content-type'] || ('image/' + ext.slice(1)), owner: 'system', source: 'avatar' };
    await store.addUpload(meta);
    return '/uploads/' + name;
  } catch (e) {
    console.warn('[auth] avatar download failed:', e.message);
    return '';
  }
}

module.exports = {
  enabled, providersStatus,
  wechatAuthorizeURL, wechatByCode,
  qqAuthorizeURL, qqByCode,
  miniByCode, devLogin, persistAvatar,
  WECHAT_AUTHORIZE, QQ_AUTHORIZE, MP_CODE2SESSION
};
