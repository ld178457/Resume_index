/*==================== CLICK FIREWORKS ====================*/
/**
 * 点击空白处烟花特效（零依赖 Canvas 2D）
 * - 暗色主题：lighter 叠加发光 + 长残影
 * - 亮色主题：source-over 保对比度 + 短残影
 * - 空闲自动停止 rAF；页面隐藏时暂停；尊重 prefers-reduced-motion
 */
(function () {
  'use strict';

  /* ---------- 配置 ---------- */
  var CONFIG = {
    particles: 84,        // 单次爆炸主粒子数
    gravity: 0.052,       // 重力
    drag: 0.975,          // 空气阻尼
    trailFade: 0.17,      // 残影淡出强度（越大拖尾越短）
    fadeLight: 0.34,      // 亮色主题额外淡出（避免糊屏）
    maxDPR: 2,            // 像素比上限，控制高分屏开销
    maxParticles: 1100,   // 粒子总量硬上限
    maxBursts: 7,         // 同一帧最多并发爆炸数
    clickSlop: 14,        // 按下与抬起位移阈值(px)，避免拖拽选中时误触发
    clickTimeout: 700     // 长按不触发(ms)
  };

  var HUES = [250, 268, 190, 320, 45, 160]; // 主色 250 与站点紫色呼应
  var EXCLUDE = 'a, button, input, textarea, select, label, [role="button"], ' +
    '.carousel__btn, .carousel__dots, ' +
    '.nav__toggle, .change-theme, .nav__link, .qualification__button, .skills__header';

  var reduceMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
  if (reduceMotion) {
    CONFIG.particles = 22;
    CONFIG.trailFade = 0.55;
  }

  /* ---------- 画布 ---------- */
  var canvas = document.createElement('canvas');
  canvas.className = 'fx-fireworks';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var W = 0, H = 0, dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDPR);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      particles.length = 0;
      rings.length = 0;
      flashes.length = 0;
      pending.length = 0;
      resize();
      ctx.clearRect(0, 0, W, H);
    }, 150);
  });

  /* ---------- 主题感知 ---------- */
  function isDark() {
    return document.body.classList.contains('dark-theme');
  }
  var dark = isDark();
  if (window.MutationObserver) {
    new MutationObserver(function () { dark = isDark(); })
      .observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  function palette(hue) {
    return dark
      ? { s: 92, l: 66 }
      : { s: 88, l: 46 };
  }
  function color(hue, alpha, s, l) {
    return 'hsla(' + hue + ',' + s + '%,' + l + '%,' + alpha + ')';
  }

  /* ---------- 数据池 ---------- */
  var particles = [];
  var rings = [];
  var flashes = [];
  var pending = [];   // 延迟爆开的小炸点

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function spawnParticle(x, y, opt) {
    if (particles.length >= CONFIG.maxParticles) return;
    var angle = opt.angle;
    var speed = opt.speed;
    var hue = (opt.hue + rnd(-14, 14) + 360) % 360;
    var p = palette(hue);
    particles.push({
      x: x, y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      hue: hue, s: p.s, l: p.l,
      size: opt.size,
      gravity: opt.gravity,
      drag: opt.drag,
      flicker: opt.flicker,
      seed: Math.random() * 6.283,
      life: 0,
      maxLife: opt.maxLife
    });
  }

  /**
   * 在 (x, y) 处炸开一朵烟花
   * @param {number} x 视口坐标
   * @param {number} y 视口坐标
   * @param {object} [opt] { scale: 整体缩放, hue: 指定色相 }
   */
  function burst(x, y, opt) {
    opt = opt || {};
    var scale = opt.scale || 1;
    var hue = typeof opt.hue === 'number'
      ? opt.hue
      : HUES[(Math.random() * HUES.length) | 0];

    // 中心闪光
    flashes.push({ x: x, y: y, r: 4 * scale, maxR: 68 * scale, life: 0, maxLife: 15, hue: hue });

    // 冲击波光环
    rings.push({
      x: x, y: y, r: 6 * scale, maxR: rnd(78, 108) * scale,
      w: 2.6 * scale, life: 0, maxLife: 26, hue: hue
    });

    // 主爆：环形分布 + 速度抖动，避免规则感
    var count = Math.round(CONFIG.particles * scale);
    var baseSpeed = rnd(3.1, 4.9) * scale;
    var spin = Math.random() * 6.283;
    for (var i = 0; i < count; i++) {
      var angle = spin + (i / count) * 6.283 + rnd(-0.09, 0.09);
      var speed = baseSpeed * Math.pow(Math.random(), 0.42) + 0.6;
      spawnParticle(x, y, {
        angle: angle,
        speed: speed,
        hue: hue,
        size: rnd(1.1, 2.6) * scale,
        gravity: CONFIG.gravity * rnd(0.75, 1.25),
        drag: CONFIG.drag,
        flicker: false,
        maxLife: rnd(46, 86)
      });
    }

    // 星屑：慢速、会闪烁、寿命更长
    var glints = Math.round(count * 0.3);
    for (var j = 0; j < glints; j++) {
      spawnParticle(x, y, {
        angle: Math.random() * 6.283,
        speed: rnd(0.4, 2.0) * scale,
        hue: hue,
        size: rnd(0.8, 1.8) * scale,
        gravity: CONFIG.gravity * 0.28,
        drag: 0.955,
        flicker: true,
        maxLife: rnd(80, 130)
      });
    }

    // 二次小炸：延迟错开，层次更丰富
    if (!reduceMotion && scale >= 0.9) {
      var n = 1 + ((Math.random() * 2) | 0);
      for (var k = 0; k < n; k++) {
        pending.push({
          x: x + rnd(-52, 52) * scale,
          y: y + rnd(-52, 52) * scale,
          delay: rnd(80, 190) + k * 60,
          scale: rnd(0.34, 0.56),
          hue: (hue + rnd(60, 200)) % 360
        });
      }
    }
    start();
  }

  /* ---------- 主循环 ---------- */
  var raf = null, last = 0;

  function loop(ts) {
    raf = requestAnimationFrame(loop);
    // 归一化到 60fps；钳位防负值与掉帧突变
    var dt = Math.min(Math.max((ts - last) / 16.667, 0.2), 3);
    last = ts;

    // 延迟小炸
    for (var q = pending.length - 1; q >= 0; q--) {
      pending[q].delay -= dt * 16.667;
      if (pending[q].delay <= 0) {
        var pd = pending.splice(q, 1)[0];
        burst(pd.x, pd.y, { scale: pd.scale, hue: pd.hue });
      }
    }

    // 残影淡出：destination-out 保持画布透明，不遮挡页面内容
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,' +
      Math.min(0.95, (CONFIG.trailFade + (dark ? 0 : CONFIG.fadeLight)) * dt) + ')';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';

    // 闪光
    for (var i = flashes.length - 1; i >= 0; i--) {
      var f = flashes[i];
      f.life += dt;
      var fp = f.life / f.maxLife;
      if (fp >= 1) { flashes.splice(i, 1); continue; }
      var fr = f.r + (f.maxR - f.r) * (1 - Math.pow(1 - fp, 3));
      var fa = (1 - fp) * (dark ? 0.55 : 0.34);
      var g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, fr);
      var pl = palette(f.hue);
      g.addColorStop(0, color(f.hue, fa, pl.s, dark ? 92 : 70));
      g.addColorStop(0.4, color(f.hue, fa * 0.45, pl.s, pl.l));
      g.addColorStop(1, color(f.hue, 0, pl.s, pl.l));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, fr, 0, 6.283);
      ctx.fill();
    }

    // 冲击波
    for (var r = rings.length - 1; r >= 0; r--) {
      var ring = rings[r];
      ring.life += dt;
      var rp = ring.life / ring.maxLife;
      if (rp >= 1) { rings.splice(r, 1); continue; }
      ring.r += (ring.maxR - ring.r) * 0.14 * dt;
      var ra = (1 - rp) * (1 - rp) * 0.75;
      var rpl = palette(ring.hue);
      ctx.strokeStyle = color(ring.hue, ra, rpl.s, rpl.l);
      ctx.lineWidth = Math.max(0.4, ring.w * (1 - rp));
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.r, 0, 6.283);
      ctx.stroke();
    }

    // 粒子
    for (var p = particles.length - 1; p >= 0; p--) {
      var o = particles[p];
      o.life += dt;
      if (o.life >= o.maxLife) { particles.splice(p, 1); continue; }

      var d = Math.pow(o.drag, dt);
      o.vx *= d;
      o.vy *= d;
      o.vy += o.gravity * dt;
      var nx = o.x + o.vx * dt;
      var ny = o.y + o.vy * dt;

      var t = o.life / o.maxLife;
      var alpha = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88;
      if (o.flicker) alpha *= 0.45 + 0.55 * Math.sin(o.life * 0.34 + o.seed);
      if (alpha <= 0.01) continue;

      var sp = Math.sqrt(o.vx * o.vx + o.vy * o.vy);
      var trail = dark ? Math.min(sp * 1.9, 16) : Math.min(sp * 0.9, 7);

      if (trail > 1.6) {
        ctx.strokeStyle = color(o.hue, alpha, o.s, o.l);
        ctx.lineWidth = o.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(o.x - (o.vx / sp) * trail, o.y - (o.vy / sp) * trail);
        ctx.lineTo(nx, ny);
        ctx.stroke();
      } else {
        ctx.fillStyle = color(o.hue, alpha, o.s, o.l);
        ctx.beginPath();
        ctx.arc(nx, ny, o.size * 0.9, 0, 6.283);
        ctx.fill();
      }

      o.x = nx;
      o.y = ny;
    }

    ctx.globalCompositeOperation = 'source-over';

    if (!particles.length && !rings.length && !flashes.length && !pending.length) stop();
  }

  function start() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    ctx.clearRect(0, 0, W, H);
  }

  /* ---------- 交互 ---------- */
  var enabled = true;
  var downX = 0, downY = 0, downT = 0;

  window.addEventListener('pointerdown', function (e) {
    downX = e.clientX; downY = e.clientY; downT = performance.now();
  }, { passive: true });

  window.addEventListener('pointerup', function (e) {
    if (!enabled) return;
    if (e.button && e.button !== 0) return;                       // 仅左键/触摸
    if (e.target && e.target.closest && e.target.closest(EXCLUDE)) return; // 点控件不炸

    var dx = e.clientX - downX, dy = e.clientY - downY;
    if (dx * dx + dy * dy > CONFIG.clickSlop * CONFIG.clickSlop) return;   // 拖拽
    if (performance.now() - downT > CONFIG.clickTimeout) return;           // 长按
    if (window.getSelection && String(window.getSelection()).length) return; // 选区

    var y = e.clientY, x = e.clientX;
    if (y < 0 || y > H || x < 0 || x > W) return;

    burst(x, y, { scale: rnd(0.85, 1.15) });
  }, { passive: true });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
  });

  /* ---------- 对外 API ---------- */
  window.Fireworks = {
    burst: burst,
    enable: function () { enabled = true; },
    disable: function () { enabled = false; stop(); },
    isEnabled: function () { return enabled; }
  };
})();
