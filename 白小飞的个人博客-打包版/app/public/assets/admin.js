(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var state = { user: null, admin: false, settings: {}, layout: null, content: null };
  function say(msg) { var t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(say.tid); say.tid = setTimeout(function () { t.classList.remove('show'); }, 2600); }
  function api(url, opts) {
    return fetch(url, Object.assign({ credentials: 'same-origin' }, opts || {})).then(function (r) {
      return r.json().then(function (j) { if (!r.ok || !j.ok) throw new Error(j.message || j.error || ('HTTP ' + r.status)); return j; });
    });
  }
  function json(url, body) { return api(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
  function val(id) { return $(id).value; }
  function set(id, v) { if ($(id)) $(id).value = v == null ? '' : String(v); }
  function checked(id, v) { if ($(id)) $(id).checked = !!v; }

  function status() {
    return api('/api/bootstrap').then(function (r) {
      state.user = r.user; state.admin = r.admin; state.urls = r.urls || {};
      if ($('back-main')) $('back-main').href = (r.urls && r.urls.main) || '/';
      if (r.site) applyTheme(Object.assign({}, r.site.theme || {}));
      var n = $('nav-user'); n.textContent = '';
      if (r.user) {
        if (r.user.avatar) { var im = el('img'); im.src = r.user.avatar; im.alt = ''; n.appendChild(im); }
        n.appendChild(el('span', '', r.user.nickname));
      }
      $('admin-status').textContent = r.user ? (r.admin ? '已登录：' + r.user.nickname + '（管理员）· 全部自定义功能已解锁' : '已登录：' + r.user.nickname + '（非管理员）') : '尚未登录。请用管理员账号密码登录。';
      $('admin-username').disabled = !!r.user; $('admin-password').disabled = !!r.user; $('admin-login').disabled = !!r.user;
      $('login-panel').hidden = !!r.admin;
      $('work-panel').hidden = !r.admin;
      if (r.admin) return Promise.all([loadSettings(), loadLayout(), loadContent(), refresh()]);
    }, function (e) { $('admin-status').textContent = e.message; });
  }

  function refresh() {
    return api('/api/admin/overview').then(function (r) {
      var box = $('overview'); box.textContent = '';
      var labels = { posts: '文章', projects: '项目', comments: '留言', uploads: '上传', users: '用户', sessions: '有效会话' };
      Object.keys(labels).forEach(function (k) { var d = el('div'); d.appendChild(el('strong', '', String(r.counts[k]))); d.appendChild(el('span', '', labels[k])); box.appendChild(d); });
    });
  }

  function loadSettings() {
    return api('/api/admin/settings').then(function (r) {
      var s = Object.assign({}, r.defaults || {}, r.settings || {});
      state.settings = s;
      ['name','hero','sub','tagline','announcement','footer','icp','about'].forEach(function (k) { set('set-' + k, s[k]); });
      var t = Object.assign({}, r.defaults && r.defaults.theme || {}, r.settings && r.settings.theme || {});
      set('set-accent', t.accent || '#49b1f5'); set('set-orbA', t.orbA || '#cfebf3');
      set('set-orbB', t.orbB || '#faeeff'); set('set-orbC', t.orbC || '#e8e5d8');
      ['glow','glass','grid'].forEach(function (k) { checked('set-' + k, t[k] !== false); });
      checked('set-halo', (r.defaults && r.defaults.heroFx && r.defaults.heroFx.halo) !== false);
      set('set-density', t.density || 'compact');
      set('set-mode', t.mode || 'auto');
      set('set-bgColor', t.bgColor || '#fcfaf8'); set('set-textColor', t.textColor || '#1f2329'); set('set-cardColor', t.cardColor || '#f3ede8');
      set('set-bgImage', t.bgImage || '');
      if ($('bg-preview')) $('bg-preview').style.backgroundImage = t.bgImage ? 'url("' + String(t.bgImage).replace(/"/g,'%22') + '")' : '';
      var fx = Object.assign({}, r.defaults && r.defaults.heroFx || {}, r.settings && r.settings.heroFx || {});
      set('set-radius', fx.radius || 170); set('set-strength', fx.strength || 96); set('set-trail', fx.trail || 0.42);
      checked('set-halo', fx.halo !== false);
      set('set-links', (s.links || []).map(function (l) { return l.label + ' | ' + l.url; }).join('\n'));
      applyTheme(t);
    });
  }
  function applyTheme(t) {
    var st = document.documentElement.style, b = document.body;
    if (t.accent) st.setProperty('--accent', t.accent);
    ['orbA','orbB','orbC'].forEach(function (k) { if (t[k]) st.setProperty('--' + k, t[k]); });
    if (t.bgColor) st.setProperty('--bg', t.bgColor);
    if (t.textColor) st.setProperty('--ink', t.textColor);
    if (t.cardColor) st.setProperty('--card', t.cardColor);
    var m = t.mode || 'auto';
    b.setAttribute('data-theme', m === 'auto' ? ((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light') : m);
    b.setAttribute('data-glow', t.glow === false ? 'off' : 'on');
    b.setAttribute('data-glass', t.glass === false ? 'off' : 'on');
    b.setAttribute('data-grid', t.grid === false ? 'off' : 'on');
    b.setAttribute('data-density', t.density || 'compact');
    var bg = $('bg-image'); if (bg) bg.style.backgroundImage = t.bgImage ? 'url("' + String(t.bgImage).replace(/"/g,'%22') + '")' : '';
  }
  function saveSettings() {
    var links = val('set-links').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var i = l.indexOf('|'); return i < 0 ? null : { label: l.slice(0, i).trim(), url: l.slice(i + 1).trim() };
    });
    if (links.some(function (l) { return !l || !l.label || !l.url; })) { say('链接每行需写成 标签 | URL'); return; }
    var body = {
      name: val('set-name'), hero: val('set-hero'), sub: val('set-sub'), tagline: val('set-tagline'),
      announcement: val('set-announcement'), footer: val('set-footer'), icp: val('set-icp'), about: val('set-about'),
      links: links,
      theme: {
        accent: val('set-accent'), orbA: val('set-orbA'), orbB: val('set-orbB'), orbC: val('set-orbC'),
        bgColor: val('set-bgColor'), textColor: val('set-textColor'), cardColor: val('set-cardColor'),
        bgImage: val('set-bgImage').trim(), mode: val('set-mode'),
        glow: $('set-glow').checked, glass: $('set-glass').checked, grid: $('set-grid').checked,
        density: val('set-density')
      },
      heroFx: { radius: Number(val('set-radius')), strength: Number(val('set-strength')), trail: Number(val('set-trail')), halo: $('set-halo').checked }
    };
    json('/api/admin/settings', body).then(function (r) {
      state.settings = r.settings; applyTheme(Object.assign({}, body.theme, r.settings.theme || {}));
      $('settings-msg').textContent = '已保存 · ' + new Date().toLocaleTimeString('zh-CN'); say('站点设置已保存，刷新前台即可看到');
    }, function (e) { say(e.message); $('settings-msg').textContent = e.message; });
  }

  function loadLayout() {
    return api('/api/admin/layout').then(function (r) { state.layout = r.layout; renderLayout(); });
  }
  function renderLayout() {
    var box = $('layout-list'); box.textContent = '';
    state.layout.modules.forEach(function (m, i) {
      var row = el('div', 'layout-row');
      row.appendChild(el('span', 'order', String(i + 1).padStart(2, '0')));
      var label = el('label'); var cb = el('input'); cb.type = 'checkbox'; cb.checked = m.visible !== false;
      cb.addEventListener('change', function () { m.visible = cb.checked; });
      label.appendChild(cb); label.appendChild(el('span', '', m.label + '  ·  ' + m.id)); row.appendChild(label);
      var up = el('button', '', '↑'); up.type = 'button'; up.title = '上移';
      up.addEventListener('click', function () { if (i > 0) { var a = state.layout.modules; [a[i - 1], a[i]] = [a[i], a[i - 1]]; renderLayout(); } });
      var down = el('button', '', '↓'); down.type = 'button'; down.title = '下移';
      down.addEventListener('click', function () { if (i < state.layout.modules.length - 1) { var a = state.layout.modules; [a[i + 1], a[i]] = [a[i], a[i + 1]]; renderLayout(); } });
      row.appendChild(up); row.appendChild(down); box.appendChild(row);
    });
  }
  function saveLayout() {
    json('/api/admin/layout', { modules: state.layout.modules }).then(function () {
      $('layout-msg').textContent = '已保存 · ' + new Date().toLocaleTimeString('zh-CN'); say('首页编排已保存');
    }, function (e) { say(e.message); $('layout-msg').textContent = e.message; });
  }

  function loadContent() {
    return api('/api/admin/content').then(function (r) { state.content = r; renderContent(); });
  }
  function manageRow(title, sub, actions) {
    var row = el('div', 'manage-row'); var g = el('div', 'grow');
    g.appendChild(el('b', '', title)); g.appendChild(el('small', '', sub)); row.appendChild(g);
    actions.forEach(function (a) { row.appendChild(a); }); return row;
  }
  function btn(text, fn) { var b = el('button', '', text); b.type = 'button'; b.addEventListener('click', fn); return b; }
  function del(url, body, after) { json(url, body).then(after, function (e) { say(e.message); }); }
  function renderContent() {
    var c = state.content; if (!c) return;
    var posts = $('admin-posts'); posts.textContent = '';
    c.posts.forEach(function (p) {
      posts.appendChild(manageRow(p.title + '  ·  ' + p.date, p.slug + '  ·  ' + (p.tags || []).join('/'), [
        btn('编辑', function () { set('post-title', p.title); set('post-slug', p.slug); set('post-date', p.date); set('post-tags', (p.tags || []).join(',')); set('post-excerpt', p.excerpt); set('post-cover', p.cover); set('post-body', p.body); say('已载入到上方表单，改完点发布即更新'); }),
        btn('删除', function () { del('/api/admin/posts/delete', { slug: p.slug }, loadContent); })
      ]));
    });
    var projects = $('admin-projects'); projects.textContent = '';
    c.projects.forEach(function (p) {
      projects.appendChild(manageRow(p.title, (p.tag || '') + '  ·  ' + (p.desc || ''), [btn('删除', function () { del('/api/admin/projects/delete', { id: p.id }, loadContent); })]));
    });
    var uploads = $('admin-uploads'); uploads.textContent = '';
    c.uploads.slice(0, 20).forEach(function (f) {
      var a = el('a', '', '打开'); a.href = f.url; a.target = '_blank'; a.rel = 'noopener'; a.style.cssText = 'color:var(--accent);font-size:12px';
      uploads.appendChild(manageRow(f.original || f.name, f.url + '  ·  ' + Math.round(f.size / 1024) + ' KB', [a, btn('删除', function () { del('/api/admin/uploads/delete', { name: f.name }, loadContent); })]));
    });
    var gb = $('admin-guestbook'); gb.textContent = '';
    (c.guestbook || []).forEach(function (g) {
      gb.appendChild(manageRow(g.nickname + '  ·  ' + g.date, g.text.slice(0, 120), [
        btn('删除这条', function () { del('/api/admin/guestbook/delete', { id: g.id }, loadContent); })
      ]));
    });
    if (!(c.guestbook || []).length) gb.appendChild(el('div', 'sec-sub', '暂无访客留言'));
    var comments = $('admin-comments'); comments.textContent = '';
    c.comments.slice(0, 30).forEach(function (m) {
      comments.appendChild(manageRow((m.user && m.user.nickname || '匿名') + '  ·  ' + m.post, m.text.slice(0, 100), [btn('删除', function () { del('/api/admin/comments/delete', { id: m.id }, loadContent); })]));
    });
    if (!c.comments.length) comments.appendChild(el('div', 'sec-sub', '暂无评论'));
    var users = $('admin-users'); users.textContent = '';
    c.users.forEach(function (u) {
      var sel = el('select'); ['user','admin'].forEach(function (r) { var o = el('option', '', r); o.value = r; if (u.role === r) o.selected = true; sel.appendChild(o); });
      sel.addEventListener('change', function () { json('/api/admin/users/role', { id: u.id, role: sel.value }).then(function () { say('角色已更新'); loadContent(); }, function (e) { say(e.message); }); });
      users.appendChild(manageRow(u.nickname + (u.id === (state.user && state.user.id) ? '（我）' : ''), u.id + '  ·  ' + (u.providers || []).join('/'), [sel]));
    });
  }

  function upload(files, afterUrl) {
    Array.prototype.forEach.call(files, function (f) {
      var fd = new FormData(); fd.append('file', f, f.name);
      fetch('/api/upload', { method: 'POST', body: fd, credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.ok) throw new Error(j.message || j.error);
        say('已上传：' + j.file.url);
        if (afterUrl) afterUrl(j.file.url); else loadContent();
      }, function (e) { say('上传失败：' + e.message); });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    $('admin-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-tab]'); if (!b) return;
      Array.prototype.forEach.call($('admin-tabs').children, function (x) { x.classList.toggle('active', x === b); });
      Array.prototype.forEach.call(document.querySelectorAll('.tab-panel'), function (p) { p.hidden = p.dataset.panel !== b.dataset.tab; });
    });
    status();
    $('admin-login').addEventListener('click', function () {
      json('/api/login/admin', { username: val('admin-username').trim(), password: val('admin-password') }).then(function () {
        $('login-msg').textContent = '登录成功'; say('已登录'); status();
      }, function (e) { $('login-msg').textContent = e.message; say(e.message); });
    });
    $('admin-password').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('admin-login').click(); });
    $('admin-logout').addEventListener('click', function () {
      json('/api/logout', {}).then(function () { say('已退出'); status(); }, function (e) { say(e.message); });
    });
    $('settings-save').addEventListener('click', saveSettings);
    $('settings-reset').addEventListener('click', function () { loadSettings().then(function () { say('已重新载入'); }); });
    $('layout-save').addEventListener('click', saveLayout);
    $('bg-file').addEventListener('change', function (e) {
      upload(e.target.files, function (url) {
        set('set-bgImage', url);
        if ($('bg-preview')) $('bg-preview').style.backgroundImage = 'url("' + url + '")';
        say('背景图已上传，点「保存全部设置」生效');
      });
      e.target.value = '';
    });
    $('bg-clear').addEventListener('click', function () {
      set('set-bgImage', ''); if ($('bg-preview')) $('bg-preview').style.backgroundImage = ''; say('已清除背景图，保存后生效');
    });
    $('guestbook-clear').addEventListener('click', function () {
      if (!confirm('确定清空全部访客留言？此操作不可撤销。')) return;
      json('/api/admin/guestbook/clear', {}).then(function (r) {
        $('guestbook-msg').textContent = '已清空 ' + r.cleared + ' 条'; say('留言已清空'); loadContent();
      }, function (e) { say(e.message); });
    });
    $('pw-save').addEventListener('click', function () {
      var o = val('pw-old'), n = val('pw-new'), n2 = val('pw-new2');
      if (n !== n2) { $('pw-msg').textContent = '两次新密码不一致'; return; }
      json('/api/admin/password', { oldPassword: o, newPassword: n }).then(function () {
        $('pw-msg').textContent = '密码已修改'; set('pw-old', ''); set('pw-new', ''); set('pw-new2', ''); say('管理员密码已修改');
      }, function (e) { $('pw-msg').textContent = e.message; say(e.message); });
    });
    $('post-create').addEventListener('click', function () {
      var body = { title: val('post-title').trim(), slug: val('post-slug').trim(), date: val('post-date'), excerpt: val('post-excerpt'), cover: val('post-cover'), tags: val('post-tags').split(/[,，]/).map(function (x) { return x.trim(); }).filter(Boolean), body: val('post-body') };
      if (!body.title) { say('标题必填'); return; }
      json('/api/admin/posts', body).then(function (r) { say('已发布：' + r.post.slug); loadContent(); refresh(); }, function (e) { say(e.message); });
    });
    $('project-create').addEventListener('click', function () {
      var body = { title: val('project-title').trim(), tag: val('project-tag').trim(), desc: val('project-desc').trim(), cover: val('project-cover').trim() };
      if (!body.title) { say('项目名必填'); return; }
      json('/api/admin/projects', body).then(function () { say('项目已添加'); ['project-title','project-tag','project-desc','project-cover'].forEach(function (id) { set(id, ''); }); loadContent(); refresh(); }, function (e) { say(e.message); });
    });
    $('admin-file').addEventListener('change', function (e) { upload(e.target.files); e.target.value = ''; });
  });
})();
