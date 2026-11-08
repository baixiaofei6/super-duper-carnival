/* 粒子文字 Hero：采样/入场基数来自 mimo.mi.com 主 JS chunk 核实结果；
   window 级指针追踪、可配置力场、自动回位、暗色发光、合帧绘制与测试钩子
   是本轮增强，不是官网原值。 */
window.BlogParticle = { init: function (text, subtitle, opts) { return new ParticleHero(text, subtitle, opts); } };

function ParticleHero(text, subtitle, opts) {
  'use strict';
  var TEXT = text || '你好，我是白小飞';
  var FONT = '"LXGW WenKai TC","KaiTi","STKaiti",Georgia,serif';
  var INK = '#1f2329', ACCENT = '#fb8147';
  var CFG = Object.assign({ radius: 170, strength: 96, trail: 0.42, halo: true }, opts || {});
  var RADIUS = CFG.radius, STRENGTH = CFG.strength, TRAIL = CFG.trail;
  var IMPULSE_MS = 110, TICK_MS = 32, RETURN_LERP = 0.22, PUSH_LERP = 0.55;

  var SURFACE = { dark: false };
  var PAL = { ink: INK, accent: ACCENT, glow: 'rgba(0,0,0,0)', blur: 0, size: 1.8 };
  var lastDraw = { groups: 0, rects: 0, fills: 0 };
  function surfaceIsDark() {
    var t = document.body.getAttribute('data-theme');
    if (t === 'dark') return true;
    if (t === 'light') return false;
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(getComputedStyle(document.body).backgroundColor);
    if (m) return (.2126 * (+m[1]) + .7152 * (+m[2]) + .0722 * (+m[3])) / 255 < .45;
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function refreshPalette() {
    SURFACE.dark = surfaceIsDark();
    PAL = SURFACE.dark
      ? { ink: '#e8f7ff', accent: '#7dd8ff', glow: 'rgba(73,177,245,.95)', blur: 12, size: 2.35 }
      : { ink: INK, accent: ACCENT, glow: 'rgba(0,0,0,0)', blur: 0, size: 1.8 };
    for (var i = 0; i < parts.length; i++) {
      parts[i].color = (i % 17 === 0 ? PAL.accent : PAL.ink);
      parts[i].size = PAL.size;
    }
  }

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hero = document.getElementById('hero');
  var cvs = document.getElementById('pt'), ctx = cvs.getContext('2d');
  var fieldCvs = document.getElementById('field'), fieldCtx = fieldCvs.getContext('2d');
  var W = 0, H = 0, DPR = 1, parts = [], animTimer = null, start = 0, entering = false;
  var rt, typeTimer, dead = false;
  var ptr = { active: false, x: 0, y: 0, sx: 0, sy: 0, vx: 0, vy: 0, px: 0, py: 0, has: false, hit: 0, avg: 0, impulseUntil: 0 };
  window.__particleLastPush = null;

  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function forceActive() { return ptr.active && now() < ptr.impulseUntil; }
  function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }
  function maxDisp() {
    var m = 0;
    for (var i = 0; i < parts.length; i++) {
      var d = Math.hypot(parts[i].x - parts[i].tx, parts[i].y - parts[i].ty);
      if (d > m) m = d;
    }
    return m;
  }

  window.__particleProbe = function () {
    return {
      active: ptr.active, forceActive: forceActive(), x: ptr.x, y: ptr.y, sx: ptr.sx, sy: ptr.sy,
      radius: RADIUS, strength: STRENGTH, trail: TRAIL, count: parts.length,
      hit: ptr.hit, avg: +ptr.avg.toFixed(2), lastPush: window.__particleLastPush,
      dark: SURFACE.dark, glow: PAL.blur, color: parts.length ? parts[0].color : null,
      animating: !!animTimer, maxDisp: +maxDisp().toFixed(2), impulseMsLeft: Math.max(0, Math.round(ptr.impulseUntil - now())),
      lastDraw: { groups: lastDraw.groups, rects: lastDraw.rects, fills: lastDraw.fills }
    };
  };
  window.__particlePositions = function () {
    return parts.slice(0, 120).map(function (p) { return { x: p.x, y: p.y, tx: p.tx, ty: p.ty }; });
  };

  function sample() {
    refreshPalette();
    var off = document.createElement('canvas'), o = off.getContext('2d');
    var fs = clamp(Math.floor(W * 0.072), 52, 150);
    o.font = '500 ' + fs + 'px ' + FONT;
    var m = o.measureText(TEXT);
    var w = Math.ceil(m.width) + 48, h = Math.ceil(fs * 1.5) + 48;
    off.width = w; off.height = h;
    o.font = '500 ' + fs + 'px ' + FONT;
    o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = '#fff';
    o.fillText(TEXT, w / 2, h / 2);
    var d = o.getImageData(0, 0, w, h).data, pts = [], step = 3;
    for (var y = 0; y < h; y += step) for (var x = 0; x < w; x += step) {
      var a = d[(y * w + x) * 4 + 3];
      if (a > 40) pts.push({ x: x - w / 2 + W / 2, y: y - h / 2 + H * 0.42, a: a / 255 });
    }
    var L = Math.max(900, Math.min(5200, Math.floor(W * H / 90)));
    var E = Math.max(1, Math.ceil(pts.length / L));
    var sub = pts.filter(function (_, i) { return i % E === 0; });
    parts = sub.map(function (p, i) {
      var n = (9301 * i + 49297) % 233280 / 233280;
      var dep = .45 + (233 * i + 97) % 1e3 / 1e3 * .9;
      var ang = n * Math.PI * 2, rad = 180 * (.35 + .75 * dep);
      var sx = p.x + Math.cos(ang) * rad + (n - .5) * 81;
      var sy = p.y + Math.sin(ang) * rad + (dep - .9) * 81;
      return {
        x: sx, y: sy, sx: sx, sy: sy, tx: p.x, ty: p.y, size: PAL.size,
        color: (i % 17 === 0 ? PAL.accent : PAL.ink), seed: n, depth: dep, delay: 420 * n, alpha: p.a
      };
    });
    ptr.x = ptr.sx = W / 2; ptr.y = ptr.sy = H / 2;
    ptr.px = ptr.x; ptr.py = ptr.y; ptr.vx = ptr.vy = 0;
  }

  function resize() {
    if (dead) return;
    var r = hero.getBoundingClientRect();
    W = Math.floor(r.width); H = Math.floor(r.height);
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    [cvs, fieldCvs].forEach(function (c) {
      c.width = Math.floor(W * DPR); c.height = Math.floor(H * DPR);
      c.style.width = W + 'px'; c.style.height = H + 'px';
    });
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fieldCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
    sample();
    document.getElementById('fallback').hidden = true;
    cvs.style.display = 'block';
    start = now(); entering = !reduced;
    if (reduced) parts.forEach(function (p) { p.x = p.tx; p.y = p.ty; });
    ensureAnim(16);
  }

  // 合帧绘制：按颜色 + 4 档 alpha 分组，整组只 fill 一次；
  // 暗色 shadowBlur 也只作用于每组一次，而不是每个粒子一次。
  function drawStatic() {
    ctx.clearRect(0, 0, W, H);
    var groups = {};
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      var a = clamp(Math.round(p.alpha * 4) / 4, .25, 1);
      var key = (p.color === PAL.accent ? 'a' : 'i') + ':' + a;
      if (!groups[key]) groups[key] = { color: p.color, alpha: a, rects: [] };
      groups[key].rects.push(p);
    }
    ctx.save();
    if (SURFACE.dark) ctx.globalCompositeOperation = 'lighter';
    var fills = 0, groupCount = 0;
    // 暗色双层合帧：底层放大 + shadowBlur 做辉光，顶层清晰粒子；
    // 每层按颜色/alpha 分组只 fill 一次，不做 1136 次逐粒子滤镜。
    if (SURFACE.dark) {
      ctx.shadowColor = PAL.glow; ctx.shadowBlur = 18 * DPR;
      for (var gk in groups) {
        var gg = groups[gk];
        ctx.globalAlpha = gg.alpha * .8; ctx.fillStyle = gg.color;
        ctx.beginPath();
        for (var gj = 0; gj < gg.rects.length; gj++) {
          var gq = gg.rects[gj], gs = gq.size * 2.5;
          ctx.rect(gq.x - gs / 2, gq.y - gs / 2, gs, gs);
        }
        ctx.fill(); fills++;
      }
      ctx.shadowBlur = 0;
    }
    for (var k in groups) {
      var g = groups[k];
      ctx.globalAlpha = g.alpha; ctx.fillStyle = g.color;
      ctx.beginPath();
      for (var j = 0; j < g.rects.length; j++) {
        var q = g.rects[j];
        ctx.rect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
      }
      ctx.fill();
      fills++; groupCount++;
    }
    ctx.restore();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    lastDraw = { groups: groupCount, rects: parts.length, fills: fills };
  }

  // 一帧最多施力一次；pointermove 只更新指针，不再触发整幅重绘。
  function applyForce() {
    var hit = 0, sum = 0;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], dx = p.x - ptr.x, dy = p.y - ptr.y, dd = Math.hypot(dx, dy);
      if (dd >= RADIUS) continue;
      var safe = Math.max(dd, 2), force = (1 - dd / RADIUS) * STRENGTH;
      var gx = p.tx + dx / safe * force + ptr.vx * force / RADIUS * 1.6;
      var gy = p.ty + dy / safe * force + ptr.vy * force / RADIUS * 1.6;
      p.x += (gx - p.x) * PUSH_LERP; p.y += (gy - p.y) * PUSH_LERP;
      hit++; sum += Math.hypot(p.x - p.tx, p.y - p.ty);
    }
    ptr.hit = hit; ptr.avg = hit ? sum / hit : 0;
    window.__particleLastPush = { hit: hit, avg: +ptr.avg.toFixed(2), x: ptr.x, y: ptr.y, at: now() };
  }

  function tick() {
    animTimer = null;
    if (dead) return;
    var t = now(), pushing = forceActive();
    if (!pushing) ptr.active = false;
    ptr.sx += (ptr.x - ptr.sx) * .18; ptr.sy += (ptr.y - ptr.sy) * .18;
    ptr.vx *= TRAIL; ptr.vy *= TRAIL;

    if (pushing) {
      entering = false;
      applyForce();
    } else {
      var allDone = true;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i], nx = p.tx, ny = p.ty;
        if (entering) {
          var a = clamp((t - start - p.delay) / 1600, 0, 1);
          var e = 1 - Math.pow(1 - a, 3);
          nx = p.sx + (p.tx - p.sx) * e; ny = p.sy + (p.ty - p.sy) * e;
          if (a < 1) allDone = false;
        } else if (!reduced) {
          var tt = .001 * t;
          nx += .15 * Math.sin(.9 * tt + 10 * p.seed) * p.depth;
          ny += .15 * Math.cos(.75 * tt + 10 * p.depth) * p.depth;
        }
        p.x += (nx - p.x) * RETURN_LERP; p.y += (ny - p.y) * RETURN_LERP;
      }
      if (entering && allDone) entering = false;
      ptr.hit = 0;
    }

    drawStatic();
    if (document.getElementById('showField').checked) {
      fieldCtx.clearRect(0, 0, W, H);
      fieldCtx.beginPath(); fieldCtx.arc(ptr.sx, ptr.sy, RADIUS, 0, 2 * Math.PI);
      fieldCtx.strokeStyle = pushing ? 'rgba(73,177,245,.75)' : 'rgba(153,153,153,.3)';
      fieldCtx.lineWidth = 2; fieldCtx.stroke();
      if (CFG.halo && pushing) {
        fieldCtx.beginPath(); fieldCtx.arc(ptr.sx, ptr.sy, RADIUS * 1.35, 0, 2 * Math.PI);
        fieldCtx.strokeStyle = 'rgba(73,177,245,.16)'; fieldCtx.lineWidth = 14; fieldCtx.stroke();
      }
    } else fieldCtx.clearRect(0, 0, W, H);

    var settled = maxDisp() <= (reduced ? .4 : 1.2);
    var keepGoing = !reduced || pushing || entering || !settled;
    if (keepGoing) animTimer = setTimeout(tick, pushing ? 16 : TICK_MS);
  }
  function ensureAnim(delay) {
    if (dead || animTimer) return;
    animTimer = setTimeout(tick, delay || TICK_MS);
  }

  function setXY(e) {
    var r = hero.getBoundingClientRect(), nx = e.clientX - r.left, ny = e.clientY - r.top;
    if (!ptr.has) { ptr.px = nx; ptr.py = ny; ptr.sx = nx; ptr.sy = ny; ptr.has = true; }
    ptr.vx = nx - ptr.px; ptr.vy = ny - ptr.py;
    ptr.px = nx; ptr.py = ny; ptr.x = nx; ptr.y = ny;
  }
  function inHero(e) {
    var r = hero.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }
  function onMove(e) {
    if (e.pointerType === 'touch' && !ptr.active) return;
    if (!inHero(e)) { ptr.active = false; ensureAnim(TICK_MS); return; }
    setXY(e); ptr.active = true; ptr.impulseUntil = now() + IMPULSE_MS;
    ensureAnim(16);
  }
  function onDown(e) {
    if (e.pointerType === 'mouse') return;
    setXY(e); ptr.active = true; ptr.impulseUntil = now() + IMPULSE_MS;
    ensureAnim(16);
  }
  function onWindowOut(e) { if (!e.relatedTarget) { ptr.active = false; ensureAnim(TICK_MS); } }
  function onUp(e) { if (e.pointerType !== 'mouse') { ptr.active = false; ensureAnim(TICK_MS); } }
  function onCancel() { ptr.active = false; ensureAnim(TICK_MS); }
  function onField() { fieldCvs.style.display = this.checked ? 'block' : 'none'; }
  window.addEventListener('pointermove', onMove, { passive: true });
  hero.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerout', onWindowOut);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  document.getElementById('showField').addEventListener('change', onField);

  var subEl = document.getElementById('typing'), subText = subtitle || '写代码，做东西，记录一点想法';
  if (reduced) subEl.textContent = subText;
  else {
    var k = 0;
    (function type() {
      if (dead) return;
      subEl.innerHTML = subText.slice(0, k) + '<span class="cursor"></span>';
      k++; if (k <= subText.length) typeTimer = setTimeout(type, 110);
    })();
  }

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () { if (!dead) resize(); });
  function onResize() { if (dead) return; clearTimeout(rt); rt = setTimeout(resize, 180); }
  window.addEventListener('resize', onResize);

  this.setTheme = function () { if (dead) return; refreshPalette(); drawStatic(); ensureAnim(TICK_MS); };
  this.destroy = function () {
    dead = true;
    clearTimeout(animTimer); animTimer = null;
    clearTimeout(rt); clearTimeout(typeTimer);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onMove);
    hero.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerout', onWindowOut);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    document.getElementById('showField').removeEventListener('change', onField);
    ctx.clearRect(0, 0, W, H); fieldCtx.clearRect(0, 0, W, H);
  };
}
