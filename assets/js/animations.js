/*==================================================================
  PREMIUM 动效层（依赖 premium.css）
  1. 顶部滚动进度条
  2. 滚动进场（IntersectionObserver + 同层级 stagger）
  3. 章节标题下划线展开
  4. 技能条滚动增长（含手风琴展开时补触发）
  5. 数字 count-up（[data-count]）
  6. 首屏副标题打字机（监听 i18n 文本变化自动重跑）
  7. 移动端菜单遮罩 / Esc 关闭
==================================================================*/
(function () {
  'use strict';

  var reduceMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  /*==================== 1. 滚动进度条 ====================*/
  var progress = document.createElement('div');
  progress.className = 'scroll-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.appendChild(progress);

  var pTicking = false;
  function updateProgress() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var ratio = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
    progress.style.transform = 'scaleX(' + ratio + ')';
  }
  window.addEventListener('scroll', function () {
    if (pTicking) return;
    pTicking = true;
    requestAnimationFrame(function () {
      updateProgress();
      pTicking = false;
    });
  }, { passive: true });
  updateProgress();

  /*==================== 2. 滚动进场 ====================*/
  // 首屏（.home）用自己的加载动画，不参与滚动进场，避免动画打架
  var REVEAL_SELECTOR = [
    '.section__title',
    '.section__subtitle',
    '.about__img',
    '.about__data',
    '.skills__content',
    '.qualification__data',
    '.portfolio__content',
    '.contact__information',
    '.footer__container > div'
  ].join(',');

  var targets = [];
  Array.prototype.forEach.call(
    document.querySelectorAll(REVEAL_SELECTOR),
    function (el) {
      if (el.closest('.home')) return;
      targets.push(el);
    }
  );

  // 同父级内按顺序错开，形成 stagger
  // 注意：必须用 Map —— 用普通对象做键会把 DOM 元素 stringify 成同一个 key
  var staggerIdx = new Map();
  targets.forEach(function (el) {
    var parent = el.parentNode;
    var idx = staggerIdx.get(parent) || 0;
    staggerIdx.set(parent, idx + 1);
    el.classList.add('reveal');
    if (!reduceMotion) {
      el.style.transitionDelay = Math.min(idx * 90, 420) + 'ms';
    }
  });

  /*==================== 3/4/5. 进场时触发的各类效果 ====================*/
  var sectionTitles = document.querySelectorAll('.section__title');

  // 技能条：目标宽度取自 .skills__number，避免硬编码
  var bars = [];
  Array.prototype.forEach.call(document.querySelectorAll('.skills__percentage'), function (bar) {
    var row = bar.closest('.skills__data');
    var numEl = row && row.querySelector('.skills__number');
    var target = numEl ? numEl.textContent.trim() : '';
    if (target && target.indexOf('%') > -1) {
      bar.style.width = '0%';
      bars.push({ el: bar, target: target, done: false });
    }
  });

  function fillBar(item) {
    if (item.done) return;
    item.done = true;
    // 下一帧再赋值，确保 0% 已经上屏，transition 才会生效
    requestAnimationFrame(function () {
      item.el.style.width = item.target;
    });
  }

  function fillBarsIn(container) {
    bars.forEach(function (item) {
      if (container.contains(item.el)) fillBar(item);
    });
  }

  // 数字 count-up
  function countUp(el) {
    var target = parseInt(el.getAttribute('data-count'), 10);
    if (isNaN(target)) return;
    var suffix = el.getAttribute('data-count-suffix') || '';
    var duration = 1200;
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    if (reduceMotion) {
      el.textContent = target + suffix;
    } else {
      requestAnimationFrame(step);
    }
  }

  var counted = new WeakSet();

  /* 滚动方向：向下滚时元素从下方进场，向上滚时从上方进场（配合 CSS 的 --reveal-y） */
  var lastY = window.scrollY || 0;
  var scrollDir = 1;
  window.addEventListener('scroll', function () {
    var y = window.scrollY || 0;
    if (y !== lastY) scrollDir = y > lastY ? 1 : -1;
    lastY = y;
  }, { passive: true });

  function revealWithDirection(el) {
    if (el.classList && el.classList.contains('reveal')) {
      el.style.setProperty('--reveal-y', (scrollDir > 0 ? 28 : -28) + 'px');
    }
    el.classList.add('is-visible');
  }

  if (!('IntersectionObserver' in window)) {
    // 老浏览器兜底：直接全部显示，保证内容可见
    targets.forEach(function (el) { el.classList.add('is-visible'); });
    Array.prototype.forEach.call(sectionTitles, function (t) { t.classList.add('is-visible'); });
    bars.forEach(fillBar);
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;

        if (el.classList.contains('reveal')) {
          revealWithDirection(el);
        }
        if (el.classList.contains('section__title')) {
          el.classList.add('is-visible');
        }
        // 技能条
        bars.forEach(function (item) {
          if (el.contains(item.el)) fillBar(item);
        });
        // 数字
        var nums = el.querySelectorAll('[data-count]');
        Array.prototype.forEach.call(nums, function (c) {
          if (!counted.has(c)) { counted.add(c); countUp(c); }
        });
        if (el.hasAttribute && el.hasAttribute('data-count')) {
          if (!counted.has(el)) { counted.add(el); countUp(el); }
        }

        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    targets.forEach(function (el) { io.observe(el); });
    Array.prototype.forEach.call(sectionTitles, function (t) { io.observe(t); });
    // 技能条所在的整块也要被观察（条本身高度为 0 时无法触发）
    Array.prototype.forEach.call(document.querySelectorAll('.skills__content'), function (c) {
      io.observe(c);
    });
  }

  // 手风琴展开时补一次技能条动画（折叠状态下高度为 0，IO 不会触发）
  Array.prototype.forEach.call(document.querySelectorAll('.skills__header'), function (header) {
    header.addEventListener('click', function () {
      setTimeout(function () {
        fillBarsIn(header.parentNode);
      }, 320);
    });
  });

  /*==================== 6. 首屏副标题打字机 ====================*/
  var subtitle = document.querySelector('.home__subtitle');
  if (subtitle && !reduceMotion) {
    var fullText = subtitle.textContent.trim();
    var typing = false;

    function type(text) {
      if (typing) return;
      typing = true;
      if (observer) observer.disconnect();      // 打字期间停掉监听，避免自我触发
      subtitle.textContent = '';
      subtitle.classList.add('is-typing');
      var i = 0;
      var timer = setInterval(function () {
        subtitle.textContent = text.slice(0, ++i);
        if (i >= text.length) {
          clearInterval(timer);
          subtitle.classList.remove('is-typing');
          typing = false;
          if (observer) observer.observe(subtitle, OBS_CFG);
        }
      }, 70);
    }

    var OBS_CFG = { characterData: true, childList: true, subtree: true };
    // i18n 切换语言后文本会变，自动用新文本重跑打字机
    var observer = new MutationObserver(function () {
      var next = subtitle.textContent.trim();
      if (!next || next === fullText) return;
      fullText = next;
      type(next);
    });

    // 等 i18n 跑完再启动，避免把翻译前/后的文本打两遍
    setTimeout(function () {
      fullText = subtitle.textContent.trim();
      observer.observe(subtitle, OBS_CFG);
      type(fullText);
    }, 900);
  }

  /*==================== 7. 移动端菜单：遮罩 + Esc ====================*/
  var navMenu = document.getElementById('nav-menu');
  var navToggle = document.getElementById('nav-toggle');
  if (navMenu) {
    var overlay = document.createElement('div');
    overlay.className = 'nav__overlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);

    function syncMenuState() {
      var open = navMenu.classList.contains('show-menu');
      overlay.classList.toggle('is-active', open);
      document.body.style.overflow = open ? 'hidden' : '';
      if (navToggle) navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    new MutationObserver(syncMenuState)
      .observe(navMenu, { attributes: true, attributeFilter: ['class'] });

    overlay.addEventListener('click', function () {
      navMenu.classList.remove('show-menu');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') navMenu.classList.remove('show-menu');
    });
    syncMenuState();
  }
})();
