/*==================================================================
  作品区轮播 —— 原生实现（替代 Swiper 的 navigation + pagination + loop）
  依赖 carousel.css 的 scroll-snap，本脚本只负责：箭头、分页点、循环、状态同步。
==================================================================*/
(function () {
  'use strict';

  var reduceMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  function initCarousel(root) {
    var track = root.querySelector('.carousel__track');
    if (!track) return;

    var realSlides = Array.prototype.slice.call(track.querySelectorAll('.carousel__slide'));
    var prevBtn = root.querySelector('.carousel__btn--prev');
    var nextBtn = root.querySelector('.carousel__btn--next');
    var dotsWrap = root.querySelector('.carousel__dots');
    var total = realSlides.length;
    if (!total) return;

    /* ---------- 无缝循环：首尾各插一张克隆页 ----------
       轨道实际内容：[末页克隆][1][2][3][首页克隆]
       真实页的下标是 1..total。从最后一页继续"向右"会滑到首页克隆，
       滑动结束后瞬间归位到首页（位置相同，视觉上完全连续）。
       这样最后一页到第一页也是向前滚动，不会出现"突然左滑倒回去"。 */
    var looping = total > 1;
    if (looping) {
      var firstClone = realSlides[0].cloneNode(true);
      var lastClone = realSlides[total - 1].cloneNode(true);
      [firstClone, lastClone].forEach(function (c) {
        c.classList.add('carousel__slide--clone');
        c.setAttribute('aria-hidden', 'true');
      });
      track.insertBefore(lastClone, realSlides[0]);
      track.appendChild(firstClone);
    }

    var dots = [];

    /* ---------- 自动播放状态（data-autoplay="毫秒"，不写则手动模式） ---------- */
    var autoplayMs = parseInt(root.getAttribute('data-autoplay'), 10) || 0;
    var autoOn = autoplayMs > 0 && total > 1 && !reduceMotion;
    var autoTimer = null;
    var autoPaused = false;

    /* ---------- 工具 ---------- */
    function slideWidth() {
      return realSlides[0].getBoundingClientRect().width || track.clientWidth;
    }

    // 轨道内的绝对下标（含两张克隆页）：0 = 末页克隆，1..total = 真实页，total+1 = 首页克隆
    function rawIndex() {
      var w = slideWidth();
      return w ? Math.round(track.scrollLeft / w) : 1;
    }

    // 对外/分页点使用的真实页下标 0..total-1
    function currentIndex() {
      if (!looping) return Math.max(0, rawIndex());
      return ((rawIndex() - 1) % total + total) % total;
    }

    /* ---------- 分页点 ---------- */
    function buildDots() {
      if (!dotsWrap) return;
      dotsWrap.innerHTML = '';
      dots = [];
      // 单页无需分页点
      if (total < 2) {
        dotsWrap.setAttribute('hidden', '');
        return;
      }
      dotsWrap.removeAttribute('hidden');
      for (var i = 0; i < total; i++) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'carousel__dot';
        dot.setAttribute('aria-label', '第 ' + (i + 1) + ' / ' + total + ' 张作品');
        dot.dataset.index = String(i);
        dotsWrap.appendChild(dot);
        dots.push(dot);
      }
    }

    /* ---------- 状态同步 ---------- */
    function sync() {
      var i = currentIndex();
      for (var k = 0; k < dots.length; k++) {
        var on = k === i;
        dots[k].classList.toggle('is-active', on);
        dots[k].setAttribute('aria-current', on ? 'true' : 'false');
      }
      // 单张时隐藏箭头
      var single = total < 2;
      [prevBtn, nextBtn].forEach(function (btn) {
        if (!btn) return;
        if (single) btn.setAttribute('hidden', '');
        else btn.removeAttribute('hidden');
      });
      // 给读屏软件标注当前页（克隆页始终隐藏）
      for (var s = 0; s < total; s++) {
        realSlides[s].setAttribute('aria-hidden', s === i ? 'false' : 'true');
      }
    }

    /* ---------- 滚动 ---------- */
    var ticking = false;
    track.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        sync();
        ticking = false;
      });
    }, { passive: true });

    /* ---------- 跳转 ---------- */
    var normTimer = null;

    // 瞬间落到某个绝对下标（归位用，不带动画，看不见）
    function jumpRaw(raw) {
      track.scrollTo({ left: raw * slideWidth(), behavior: 'auto' });
      sync();
    }

    // 滑到克隆页后归位到等价的真实页：两者位置一模一样，所以视觉上无缝
    function normalize() {
      if (!looping) return;
      var i = rawIndex();
      if (i === total + 1) jumpRaw(1);        // 首页克隆 → 首页
      else if (i === 0) jumpRaw(total);       // 末页克隆 → 末页
    }

    function goRaw(raw, instant) {
      var i = looping ? raw : Math.min(Math.max(raw, 0), total - 1);
      track.scrollTo({
        left: i * slideWidth(),
        behavior: (instant || reduceMotion) ? 'auto' : 'smooth'
      });
      sync();
      if (looping) {
        clearTimeout(normTimer);
        normTimer = setTimeout(normalize, (instant || reduceMotion) ? 0 : 620);
      }
      // 手动操作后重新计时，避免"刚点完就自动跳走"（悬停/聚焦暂停期间不重启）
      if (autoOn && !autoPaused) startAuto();
    }

    // 对外仍用真实页下标 0..total-1
    function goTo(real, instant) { goRaw(looping ? real + 1 : real, instant); }
    function next() { goRaw(rawIndex() + 1); }   // 末页 → 首页克隆（继续向右）
    function prev() { goRaw(rawIndex() - 1); }   // 首页 → 末页克隆（继续向左）

    if ('onscrollend' in window) {
      track.addEventListener('scrollend', normalize);
    }

    if (prevBtn) {
      prevBtn.type = 'button';
      if (!prevBtn.hasAttribute('aria-label')) prevBtn.setAttribute('aria-label', '上一张');
      prevBtn.addEventListener('click', prev);
    }
    if (nextBtn) {
      nextBtn.type = 'button';
      if (!nextBtn.hasAttribute('aria-label')) nextBtn.setAttribute('aria-label', '下一张');
      nextBtn.addEventListener('click', next);
    }
    if (dotsWrap) {
      dotsWrap.addEventListener('click', function (e) {
        var dot = e.target.closest('.carousel__dot');
        if (!dot) return;
        goTo(Number(dot.dataset.index));
      });
    }

    /* ---------- 窗口变化时重新对齐 ---------- */
    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        goTo(currentIndex(), true);
      }, 180);
    });

    /* ---------- 自动播放 ---------- */
    function stopAuto() {
      autoPaused = true;
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    }

    function startAuto() {
      if (!autoOn) return;
      autoPaused = false;
      if (autoTimer) clearInterval(autoTimer);
      autoTimer = setInterval(function () {
        // 后台标签页不推进，省电也避免回来时"连跳"
        if (document.hidden) return;
        // 不在视口里也不推进（下面的区块用户看不到）
        var rect = track.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) return;
        next();
      }, autoplayMs);
    }

    if (autoOn) {
      startAuto();
      // 鼠标悬停 / 键盘聚焦时暂停，离开后继续——也让用户有时间读完文案
      root.addEventListener('pointerenter', stopAuto);
      root.addEventListener('pointerleave', startAuto);
      root.addEventListener('focusin', stopAuto);
      root.addEventListener('focusout', startAuto);
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) stopAuto(); else startAuto();
      });
    }

    buildDots();
    // 起始位置停在第一个「真实页」（跳过前面的末页克隆）
    jumpRaw(looping ? 1 : 0);
    sync();
  }

  Array.prototype.forEach.call(document.querySelectorAll('.carousel'), initCarousel);
})();
