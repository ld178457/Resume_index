/*==================================================================
  纵深与 3D 交互层（依赖 premium.css）
  1. 卡片跟随光标的 3D 倾斜（作品卡 / 技能卡）
  2. 多层视差背景（远/中/近三层不同速率）+ 首屏头像反向位移
  3. 资格标签页切换的方向性滑入

  注意：本文件只用 transform 做「旋转/视差」，涉及位移的仍交给 CSS translate，
  避免覆盖模板里 .home__social 的 transform: translateX(-6rem) 定位。
==================================================================*/
(function () {
  'use strict';

  var reduceMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
  var coarsePointer = window.matchMedia
    ? window.matchMedia('(pointer: coarse)').matches
    : false;

  /*==================== 1. 卡片 3D 倾斜 ====================*/
  var MAX_DEG = 7; // 最大倾斜角，太大会显得廉价

  function initTilt(el) {
    var raf = null;
    var pending = null;

    function apply() {
      raf = null;
      if (!pending) return;
      var rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var px = (pending.x - rect.left) / rect.width;   // 0 → 1
      var py = (pending.y - rect.top) / rect.height;
      var ry = (px - 0.5) * 2 * MAX_DEG;               // 左右移动 → 绕 Y 轴
      var rx = -(py - 0.5) * 2 * MAX_DEG;              // 上下移动 → 绕 X 轴
      el.style.setProperty('--tilt-y', ry.toFixed(2) + 'deg');
      el.style.setProperty('--tilt-x', rx.toFixed(2) + 'deg');
      el.style.setProperty('--glare-x', (px * 100).toFixed(1) + '%');
      el.style.setProperty('--glare-y', (py * 100).toFixed(1) + '%');
    }

    el.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      pending = { x: e.clientX, y: e.clientY };
      if (!raf) raf = requestAnimationFrame(apply);
    }, { passive: true });

    function reset() {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      pending = null;
      el.style.setProperty('--tilt-x', '0deg');
      el.style.setProperty('--tilt-y', '0deg');
    }
    el.addEventListener('pointerleave', reset);
    el.addEventListener('blur', reset, true);
  }

  if (!reduceMotion && !coarsePointer) {
    Array.prototype.forEach.call(
      document.querySelectorAll('.portfolio__content, .skills__content'),
      initTilt
    );
  }

  /*==================== 2. 多层视差 ====================*/
  if (!reduceMotion) {
    var wrap = document.createElement('div');
    wrap.className = 'parallax';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML =
      '<div class="parallax__layer parallax__layer--dots"   data-speed="0.06"></div>' +
      '<div class="parallax__layer parallax__layer--glow-a" data-speed="0.15"></div>' +
      '<div class="parallax__layer parallax__layer--glow-b" data-speed="0.26"></div>';
    document.body.insertBefore(wrap, document.body.firstChild);

    var layers = Array.prototype.slice.call(wrap.querySelectorAll('.parallax__layer'));
    var foreground = document.querySelector('.home__img'); // 首屏头像：反向、更快
    var ticking = false;

    function updateParallax() {
      ticking = false;
      var y = window.scrollY || 0;
      var limit = window.innerHeight * 0.3;   // 位移上限，避免长页面把图层推出视野
      layers.forEach(function (layer) {
        var speed = parseFloat(layer.getAttribute('data-speed')) || 0;
        var offset = Math.max(-limit, Math.min(limit, -y * speed));
        layer.style.transform = 'translate3d(0,' + offset.toFixed(1) + 'px,0)';
      });
      if (foreground) {
        // 前景反向移动，与背景拉开速度差 → 空间纵深
        var fg = Math.max(-limit, Math.min(limit, y * 0.05));
        foreground.style.transform = 'translate3d(0,' + fg.toFixed(1) + 'px,0)';
      }
    }

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateParallax);
    }, { passive: true });
    updateParallax();
  }

  /*==================== 3. 标签页方向性滑入 ====================*/
  var tabs = document.querySelectorAll('.qualification__button');
  if (tabs.length) {
    // main.js 的 click 处理器先执行并已切好 active 类，
    // 所以这里不能"点的时候再读当前是谁"，必须自己维护上一次的索引。
    var lastIndex = 0;
    Array.prototype.forEach.call(tabs, function (tab, i) {
      if (tab.classList.contains('qualification__active')) lastIndex = i;
    });

    Array.prototype.forEach.call(tabs, function (tab, idx) {
      tab.addEventListener('click', function () {
        var target = document.querySelector(tab.getAttribute('data-target'));
        if (!target) return;

        var from = lastIndex;
        lastIndex = idx;
        if (from === idx) return;   // 重复点击当前项，不做方向动画

        target.classList.remove('is-from-next', 'is-from-prev');
        void target.offsetWidth;    // 强制回流，否则连续点击时动画不会重放
        target.classList.add(idx > from ? 'is-from-next' : 'is-from-prev');
      });
    });
  }
})();
