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

    var slides = track.querySelectorAll('.carousel__slide');
    var prevBtn = root.querySelector('.carousel__btn--prev');
    var nextBtn = root.querySelector('.carousel__btn--next');
    var dotsWrap = root.querySelector('.carousel__dots');
    var total = slides.length;
    if (!total) return;

    var dots = [];

    /* ---------- 自动播放状态（data-autoplay="毫秒"，不写则手动模式） ---------- */
    var autoplayMs = parseInt(root.getAttribute('data-autoplay'), 10) || 0;
    var autoOn = autoplayMs > 0 && total > 1 && !reduceMotion;
    var autoTimer = null;
    var autoPaused = false;

    /* ---------- 工具 ---------- */
    function slideWidth() {
      return slides[0].getBoundingClientRect().width || track.clientWidth;
    }

    function currentIndex() {
      var w = slideWidth();
      return w ? Math.round(track.scrollLeft / w) : 0;
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
      // 给读屏软件标注当前页
      for (var s = 0; s < total; s++) {
        slides[s].setAttribute('aria-hidden', s === i ? 'false' : 'true');
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
    function goTo(index, instant) {
      var n = total;
      var target = ((index % n) + n) % n;     // 循环：越界回绕
      var wrap = Math.abs(target - currentIndex()) > 1;
      track.scrollTo({
        left: target * slideWidth(),
        // 循环回绕时用瞬时跳转，避免长距离反向滑动
        behavior: (instant || wrap || reduceMotion) ? 'auto' : 'smooth'
      });
      sync();
      // 手动操作后重新计时，避免"刚点完就自动跳走"（悬停/聚焦暂停期间不重启）
      if (autoOn && !autoPaused) startAuto();
    }

    if (prevBtn) {
      prevBtn.type = 'button';
      if (!prevBtn.hasAttribute('aria-label')) prevBtn.setAttribute('aria-label', '上一张');
      prevBtn.addEventListener('click', function () { goTo(currentIndex() - 1); });
    }
    if (nextBtn) {
      nextBtn.type = 'button';
      if (!nextBtn.hasAttribute('aria-label')) nextBtn.setAttribute('aria-label', '下一张');
      nextBtn.addEventListener('click', function () { goTo(currentIndex() + 1); });
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
        goTo(currentIndex() + 1);
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
    sync();
  }

  Array.prototype.forEach.call(document.querySelectorAll('.carousel'), initCarousel);
})();
