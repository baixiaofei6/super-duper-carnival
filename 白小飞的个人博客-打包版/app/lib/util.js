'use strict';
// 零依赖工具集：只用 Node 内置模块。
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.xml': 'application/xml; charset=utf-8',
  '.rss': 'application/rss+xml; charset=utf-8'
};

function mimeOf(pathname) {
  const i = pathname.lastIndexOf('.');
  return (i >= 0 && MIME[pathname.slice(i).toLowerCase()]) || 'application/octet-stream';
}

function json(res, status, data, extraHeaders) {
  const body = Buffer.from(JSON.stringify(data), 'utf8');
  const headers = Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }, extraHeaders || {});
  res.writeHead(status, headers);
  res.end(body);
}

function text(res, status, body, type) {
  const buf = Buffer.from(String(body), 'utf8');
  res.writeHead(status, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Content-Length': buf.length,
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(buf);
}

function redirect(res, location, extraHeaders) {
  const headers = Object.assign({ Location: location, 'Cache-Control': 'no-store' }, extraHeaders || {});
  res.writeHead(302, headers);
  res.end();
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) {
        reject(new Error('BODY_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req, limit) {
  const buf = await readBody(req, limit || 12 * 1024 * 1024);
  if (!buf.length) return {};
  const ct = String(req.headers['content-type'] || '');
  if (ct && !/application\/json/i.test(ct)) {
    const e = new Error('EXPECT_JSON');
    e.code = 'EXPECT_JSON';
    throw e;
  }
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch (e) {
    e.code = 'BAD_JSON';
    throw e;
  }
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie;
  if (!raw) return out;
  for (const pair of raw.split(';')) {
    const i = pair.indexOf('=');
    if (i < 0) continue;
    const k = pair.slice(0, i).trim();
    try { out[k] = decodeURIComponent(pair.slice(i + 1).trim()); } catch (e) { out[k] = pair.slice(i + 1).trim(); }
  }
  return out;
}

function cookie(name, value, opts) {
  const o = opts || {};
  let s = name + '=' + encodeURIComponent(value) + '; Path=/; HttpOnly; SameSite=Lax';
  if (o.maxAge !== undefined) s += '; Max-Age=' + Math.max(0, Math.floor(o.maxAge));
  if (o.secure) s += '; Secure';
  return s;
}

function rand(bytes) {
  return crypto.randomBytes(bytes || 32).toString('hex');
}

function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

function nowISO() {
  return new Date().toISOString();
}

function slugify(s) {
  const base = String(s || '').trim().toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || ('post-' + Date.now().toString(36));
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeFilename(s) {
  return String(s || 'file').replace(/[\\/\r\n\u0000-\u001f]/g, '_').slice(0, 180);
}

// 判断一个 avatar 值是否允许写入：仅本地 /uploads 路径或图片 data URL。
function normalizeAvatar(v, maxBytes) {
  if (v == null || v === '') return '';
  const s = String(v);
  if (s.length > (maxBytes || 4 * 1024 * 1024)) return '';
  if (/^\/uploads\/[A-Za-z0-9._-]+$/.test(s)) return s;
  const m = /^data:image\/(png|jpeg|jpg|gif|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(s);
  if (m) return 'data:image/' + m[1].toLowerCase() + ';base64,' + m[2];
  return '';
}

// Buffer 级 multipart/form-data 解析（零依赖）。返回 [{name, filename, type, data:Buffer}]
function parseMultipart(buf, boundary) {
  const parts = [];
  if (!boundary) return parts;
  const delim = Buffer.from('--' + boundary, 'binary');
  let pos = buf.indexOf(delim);
  while (pos >= 0) {
    let start = pos + delim.length;
    const tail = buf.slice(start, start + 2).toString('binary');
    if (tail === '--') break;               // 结束边界
    if (tail === '\r\n') start += 2;
    const next = buf.indexOf(delim, start);
    if (next < 0) break;
    let end = next;
    if (buf.slice(end - 2, end).toString('binary') === '\r\n') end -= 2;
    const chunk = buf.slice(start, end);
    const sep = chunk.indexOf('\r\n\r\n');
    if (sep >= 0) {
      const headerText = chunk.slice(0, sep).toString('utf8');
      const data = chunk.slice(sep + 4);
      const headers = {};
      for (const line of headerText.split('\r\n')) {
        const i = line.indexOf(':');
        if (i > 0) headers[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
      }
      const cd = headers['content-disposition'] || '';
      const nm = /name="([^"]*)"/.exec(cd);
      const fm = /filename="([^"]*)"/.exec(cd);
      parts.push({
        name: nm ? nm[1] : '',
        filename: fm ? fm[1] : '',
        type: headers['content-type'] || '',
        data
      });
    }
    pos = next;
  }
  return parts;
}

function boundaryFrom(contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(String(contentType || ''));
  return m ? (m[1] || m[2]) : '';
}

// HTTP(S) GET，自动跟随少量重定向，返回 Buffer。用于服务端换 token / 下载头像。
function fetchBuffer(urlStr, opts) {
  const o = opts || {};
  const redirects = o._redirects || 0;
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(urlStr); } catch (e) { return reject(e); }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return reject(new Error('UNSUPPORTED_PROTOCOL'));
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.get(u, { timeout: o.timeout || 12000, headers: { 'User-Agent': 'linjian-blog/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects < 5) {
        res.resume();
        const loc = new URL(res.headers.location, u).toString();
        return fetchBuffer(loc, Object.assign({}, o, { _redirects: redirects + 1 })).then(resolve, reject);
      }
      const chunks = [];
      let size = 0;
      const cap = o.maxBytes || 8 * 1024 * 1024;
      res.on('data', c => {
        size += c.length;
        if (size > cap) { res.destroy(); reject(new Error('REMOTE_TOO_LARGE')); return; }
        chunks.push(c);
      });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    });
    req.on('timeout', () => { req.destroy(new Error('REMOTE_TIMEOUT')); });
    req.on('error', reject);
  });
}

async function fetchJson(urlStr, opts) {
  const r = await fetchBuffer(urlStr, opts);
  const s = r.body.toString('utf8');
  return { status: r.status, raw: s, data: tryJson(s), headers: r.headers };
}

function tryJson(s) {
  try { return JSON.parse(s); } catch (e) { return null; }
}

function extFromContentType(ct) {
  const m = /^([a-z0-9.+-]+\/[a-z0-9.+-]+)/i.exec(String(ct || ''));
  const t = m ? m[1].toLowerCase() : '';
  return ({
    'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png',
    'image/gif': '.gif', 'image/webp': '.webp', 'image/svg+xml': '.svg'
  })[t] || '';
}

module.exports = {
  MIME, mimeOf, json, text, redirect, readBody, readJson, parseCookies, cookie,
  rand, sha256, nowISO, slugify, escapeHtml, safeFilename, normalizeAvatar,
  parseMultipart, boundaryFrom, fetchBuffer, fetchJson, tryJson, extFromContentType
};
