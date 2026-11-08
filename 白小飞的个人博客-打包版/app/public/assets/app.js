(function () {
  'use strict';

  var state = { site: {}, providers: {}, user: null, admin: false, posts: [], projects: [], layout: null, guestbook: [], userMode: null };
  var $ = function (id) { return document.getElementById(id); };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function say(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(say.tid); say.tid = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function api(url, opts) {
    return fetch(url, Object.assign({ credentials: 'same-origin' }, opts || {})).then(function (r) {
      return r.json().then(function (j) { if (!r.ok || !j.ok) throw new Error(j.message || j.error || ('HTTP ' + r.status)); return j; });
    });
  }
  function json(url, method, body) { return api(url, { method: method || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  function href(slug) { return '#/notes/' + encodeURIComponent(slug); }

  // ---- 白天 / 黑夜 / 自动跟随 ----
  function systemDark() { return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
  function modeKey() { return state.userMode || (state.site.theme && state.site.theme.mode) || 'auto'; }
  function applyTheme() {
    var t = state.site.theme || {}, root = document.documentElement.style, b = document.body;
    if (t.accent) root.setProperty('--accent', t.accent);
    if (t.orbA) root.setProperty('--orbA', t.orbA);
    if (t.orbB) root.setProperty('--orbB', t.orbB);
    if (t.orbC) root.setProperty('--orbC', t.orbC);
    if (t.bgColor) root.setProperty('--bg', t.bgColor);
    if (t.textColor) root.setProperty('--ink', t.textColor);
    if (t.cardColor) root.setProperty('--card', t.cardColor);
    var mode = modeKey();
    b.setAttribute('data-theme', mode === 'auto' ? (systemDark() ? 'dark' : 'light') : mode);
    b.setAttribute('data-glow', t.glow === false ? 'off' : 'on');
    b.setAttribute('data-glass', t.glass === false ? 'off' : 'on');
    b.setAttribute('data-grid', t.grid === false ? 'off' : 'on');
    b.setAttribute('data-density', t.density === 'comfortable' ? 'comfortable' : 'compact');
    var bg = $('bg-image');
    if (bg) bg.style.backgroundImage = t.bgImage ? 'url("' + String(t.bgImage).replace(/"/g, '%22') + '")' : '';
    Array.prototype.forEach.call(document.querySelectorAll('#theme-switch button'), function (x) {
      x.classList.toggle('active', x.dataset.mode === mode);
    });
    if (bootstrap.particle && bootstrap.particle.setTheme) bootstrap.particle.setTheme();
  }
  function setMode(mode) {
    if (['light', 'dark', 'auto'].indexOf(mode) < 0) return;
    state.userMode = mode;
    try { localStorage.setItem('blog-theme-mode', mode); } catch (e) {}
    applyTheme();
  }

  // ---- 首页编排 ----
  function visible(id) {
    if (!state.layout || !state.layout.modules) return true;
    var m = state.layout.modules.filter(function (x) { return x.id === id; })[0];
    return m ? m.visible !== false : true;
  }
  function applyLayout() {
    var order = ['updates', 'series', 'projects', 'stats', 'links', 'guestbook', 'about'];
    var modules = (state.layout && state.layout.modules) || [];
    var seq = modules.filter(function (m) { return order.indexOf(m.id) >= 0; }).map(function (m) { return m.id; });
    order.forEach(function (id) { if (seq.indexOf(id) < 0) seq.push(id); });
    var home = $('home-view'), groups = {};
    Array.prototype.forEach.call(home.children, function (n) {
      if (/^(updates|series|projects|stats|links|guestbook|about)-group$/.test(n.id)) groups[n.id.slice(0, -6)] = n;
    });
    seq.forEach(function (id) {
      var n = groups[id]; if (!n) return;
      n.hidden = !visible(id); n.style.display = visible(id) ? '' : 'none';
      home.appendChild(n);
    });
    var hero = $('hero'), strip = $('signal-strip');
    if (hero) hero.style.display = visible('hero') ? '' : 'none';
    if (strip) strip.style.display = visible('notice') ? '' : 'none';
  }

  function renderNav() {
    var n = $('nav-user'); n.textContent = ''; n.hidden = true;
    try {
      var m = localStorage.getItem('blog-theme-mode');
      state.userMode = ['light', 'dark', 'auto'].indexOf(m) >= 0 ? m : null;
    } catch (e) {}
  }

  // ---- 首页内容 ----
  function renderHome() {
    ['updates-grid', 'field-grid', 'project-matrix', 'stats', 'post-list', 'all-projects', 'site-links', 'about-links'].forEach(function (id) { $(id).textContent = ''; });
    var posts = state.posts, first = posts[0];
    if (first) {
      var f = el('a', 'featured'); f.href = href(first.slug);
      f.appendChild(el('span', 'tag', (first.tags && first.tags[0]) || 'FEATURED'));
      f.appendChild(el('h3', '', first.title)); f.appendChild(el('p', '', first.excerpt || ''));
      f.appendChild(el('time', '', first.date || ''));
      $('updates-grid').appendChild(f);
    }
    posts.slice(1, 4).forEach(function (p, i) {
      var a = el('a', 'mini'); a.href = href(p.slug);
      a.appendChild(el('span', 'num', '0' + (i + 1)));
      var box = el('div'); box.appendChild(el('h3', '', p.title)); box.appendChild(el('p', '', p.excerpt || ''));
      a.appendChild(box); $('updates-grid').appendChild(a);
    });
    var tagCount = {};
    posts.forEach(function (p) { (p.tags || []).forEach(function (t) { tagCount[t] = (tagCount[t] || 0) + 1; }); });
    Object.keys(tagCount).slice(0, 3).forEach(function (tag) {
      var c = el('a', 'card field-card'); c.href = '#/notes';
      c.appendChild(el('span', 'tag', 'SERIES')); c.appendChild(el('h3', '', tag));
      c.appendChild(el('p', '', '这个标签下写过的一些东西。'));
      var fields = el('div', 'fields');
      var latest = posts.find(function (p) { return (p.tags || []).indexOf(tag) >= 0; });
      [['篇数', tagCount[tag]], ['最近更新', latest ? latest.date : ''], ['状态', '持续更新']].forEach(function (kv) {
        var d = el('div'); d.appendChild(el('span', '', kv[0])); d.appendChild(el('b', '', kv[1])); fields.appendChild(d);
      });
      c.appendChild(fields); $('field-grid').appendChild(c);
    });
    $('series-note').textContent = Object.keys(tagCount).length + ' 个标签 · 三行字段卡';
    state.projects.forEach(function (p, i) {
      var row = el('div', 'project-row'); row.appendChild(el('span', 'idx', String(i + 1).padStart(2, '0')));
      var box = el('div'); box.appendChild(el('h3', '', p.title)); box.appendChild(el('p', '', p.desc || ''));
      row.appendChild(box); row.appendChild(el('span', 'tag', p.tag || 'PROJECT')); $('project-matrix').appendChild(row);
    });
    $('project-note').textContent = state.projects.length + ' 个项目';
    [['文章', posts.length], ['项目', state.projects.length], ['标签', Object.keys(tagCount).length], ['状态', 'ONLINE']].forEach(function (kv) {
      var d = el('div', 'stat'); d.appendChild(el('b', '', kv[1])); d.appendChild(el('span', '', kv[0])); $('stats').appendChild(d);
    });
    ['site-links', 'about-links'].forEach(function (id) {
      (state.site.links || []).forEach(function (l) {
        var a = el('a', '', l.label); a.href = l.url;
        if (/^https?:/.test(l.url)) a.target = '_blank', a.rel = 'noopener';
        $(id).appendChild(a);
      });
    });
    posts.forEach(function (p) {
      var a = el('a', 'list-item'); a.href = href(p.slug);
      var box = el('div'); box.appendChild(el('h3', '', p.title)); box.appendChild(el('p', '', p.excerpt || ''));
      a.appendChild(box); a.appendChild(el('time', '', p.date || '')); $('post-list').appendChild(a);
    });
    state.projects.forEach(function (p) {
      var c = el('div', 'card'); c.appendChild(el('span', 'tag', p.tag || 'PROJECT'));
      c.appendChild(el('h3', '', p.title)); c.appendChild(el('p', '', p.desc || '')); $('all-projects').appendChild(c);
    });
    $('notes-sub').textContent = '共 ' + posts.length + ' 篇';
    $('about-text').textContent = state.site.about || '';
    $('about-full').textContent = state.site.about || '';
    $('signal-text').textContent = state.site.announcement || state.site.tagline || '站点运行中';
    $('signal-meta').textContent = 'API v1 · ' + posts.length + ' POSTS · ' + state.projects.length + ' PROJECTS';
  }

  // ---- 文章评论（匿名可发） ----
  function renderComments(slug) {
    var box = $('comment-list'); box.textContent = '';
    if ($('comment-nickname')) $('comment-nickname').hidden = !!state.user;
    api('/api/comments?post=' + encodeURIComponent(slug)).then(function (r) {
      r.comments.forEach(function (c) {
        var d = el('div', 'comment'), who = el('div', 'who');
        if (c.user && c.user.avatar) { var im = el('img'); im.src = c.user.avatar; im.alt = ''; who.appendChild(im); }
        who.appendChild(el('span', '', (c.user ? c.user.nickname : '匿名') + ' · ' + c.date));
        d.appendChild(who); d.appendChild(el('div', 'text', c.text)); box.appendChild(d);
      });
      if (!r.comments.length) box.appendChild(el('p', 'sec-sub', '还没有留言。'));
    }, function (e) { box.textContent = e.message; });
  }
  function showPost(slug) {
    api('/api/posts/' + encodeURIComponent(slug)).then(function (r) {
      var p = r.post;
      $('post-title').textContent = p.title;
      $('post-meta').textContent = (p.date || '') + (p.tags && p.tags.length ? ' · ' + p.tags.join(' / ') : '');
      $('post-body').innerHTML = p.body || '';
      renderComments(slug);
    }, function (e) { say(e.message); location.hash = '#/notes'; });
  }

  // ---- 访客留言板：全员可见 ----
  function guestbookItem(g) {
    var d = el('div', 'guestbook-item'), who = el('div', 'who');
    who.appendChild(el('b', '', g.nickname || '匿名'));
    who.appendChild(el('time', '', g.date || ''));
    d.appendChild(who); d.appendChild(el('div', 'text', g.text)); return d;
  }
  function renderGuestbook() {
    return api('/api/guestbook').then(function (r) {
      state.guestbook = r.guestbook;
      ['guestbook-list', 'guestbook-list-view'].forEach(function (id) {
        var box = $(id); if (!box) return;
        box.textContent = '';
        r.guestbook.forEach(function (g) { box.appendChild(guestbookItem(g)); });
        if (!r.guestbook.length) box.appendChild(el('p', 'sec-sub', '还没有留言，来写第一条吧。'));
      });
      ['guestbook-count', 'guestbook-view-count'].forEach(function (id) { if ($(id)) $(id).textContent = '共 ' + r.guestbook.length + ' 条 · 全员可见'; });
    }, function (e) { say(e.message); });
  }
  function submitGuestbook(nickId, textId) {
    var nickname = $(nickId) ? $(nickId).value.trim() : '';
    var text = $(textId) ? $(textId).value.trim() : '';
    if (!state.user && !nickname) { say('请填写昵称'); return; }
    if (!text) { say('请写点内容'); return; }
    json('/api/guestbook', 'POST', { nickname: nickname, text: text }).then(function () {
      if ($(textId)) $(textId).value = '';
      renderGuestbook().then(function () { say('留言已发表，所有人可见'); });
    }, function (e) { say(e.message); });
  }

  // ---- 路由与粒子 ----
  var particleStopped = false;
  function suspendParticle() { if (bootstrap.particle && !particleStopped) { bootstrap.particle.destroy(); particleStopped = true; } }
  function resumeParticle() {
    if (particleStopped && window.BlogParticle) {
      bootstrap.particle = window.BlogParticle.init(state.site.hero || '你好，我是白小飞', state.site.sub || '写代码，做东西，记录一点想法', state.site.heroFx || {});
      particleStopped = false;
    }
  }
  function route() {
    var h = location.hash || '#/', v = 'home-view';
    if (h.indexOf('#/notes/') === 0) { v = 'post-view'; showPost(decodeURIComponent(h.slice('#/notes/'.length))); }
    else if (h === '#/notes') v = 'notes-view';
    else if (h === '#/projects') v = 'projects-view';
    else if (h === '#/guestbook') v = 'guestbook-view';
    else if (h === '#/about') v = 'about-view';
    ['home-view', 'notes-view', 'post-view', 'projects-view', 'about-view', 'guestbook-view'].forEach(function (id) { $(id).hidden = id !== v; });
    var portal = v === 'home-view';
    ['hero', 'signal-strip'].forEach(function (id) {
      var n = $(id); if (n) n.style.display = (portal && visible(id === 'hero' ? 'hero' : 'notice')) ? '' : 'none';
    });
    if (portal) { applyLayout(); resumeParticle(); } else suspendParticle();
    if (v === 'guestbook-view') renderGuestbook();
    initReveal();
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }
  function initReveal() {
    if (reduced) { document.querySelectorAll('.reveal').forEach(function (n) { n.classList.add('visible'); }); return; }
    document.querySelectorAll('.reveal').forEach(function (n) { n.classList.add('visible'); });
  }

  function bootstrap() {
    return api('/api/bootstrap').then(function (r) {
      state.site = r.site; state.providers = r.providers; state.user = r.user; state.admin = r.admin; state.layout = r.layout;
      document.title = r.site.name || '白小飞的个人博客';
      $('notice').textContent = r.site.announcement || r.site.tagline || '白小飞的个人博客';
      $('footer-text').textContent = r.site.footer || '';
      $('footer-icp').textContent = r.site.icp || '';
      renderNav(); applyTheme();
      if (window.BlogParticle && !bootstrap.particle) {
        bootstrap.particle = window.BlogParticle.init(r.site.hero || '你好，我是白小飞', r.site.sub || '写代码，做东西，记录一点想法', r.site.heroFx || {});
      }
    }).then(function () { return Promise.all([api('/api/posts'), api('/api/projects')]); }).then(function (rs) {
      state.posts = rs[0].posts; state.projects = rs[1].projects;
      renderHome(); route(); renderGuestbook();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    window.addEventListener('hashchange', route);
    $('cta1').addEventListener('click', function () { location.hash = '#/notes'; });
    $('cta2').addEventListener('click', function () { location.hash = '#/projects'; });
    $('theme-switch').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-mode]'); if (b) setMode(b.dataset.mode);
    });
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      var onMq = function () {
        if (modeKey() !== 'auto') return;
        applyTheme();
      };
      if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
    }
    $('comment-submit').addEventListener('click', function () {
      var slug = decodeURIComponent((location.hash || '').slice('#/notes/'.length));
      var text = $('comment-text').value.trim();
      if (!slug || !text) { say('请先写点什么'); return; }
      json('/api/comments', 'POST', { post: slug, text: text, nickname: $('comment-nickname') ? $('comment-nickname').value.trim() : '' }).then(function () {
        $('comment-text').value = ''; renderComments(slug); say('留言已发表');
      }, function (e) { say(e.message); });
    });
    [['gb-submit', 'gb-nickname', 'gb-text'], ['gb-submit-view', 'gb-nickname-view', 'gb-text-view']].forEach(function (t) {
      var b = $(t[0]); if (b) b.addEventListener('click', function () { submitGuestbook(t[1], t[2]); });
    });
    var ring = $('ring');
    if (!reduced) window.addEventListener('pointermove', function (e) { ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px'; });
    else ring.style.display = 'none';
    bootstrap().catch(function (e) { say('初始化失败：' + e.message); });
  });
})();
