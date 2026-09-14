/*==================== 中英双语切换（原生实现，替代 jQuery + jquery.i18n）====================*/
/**
 * 原实现依赖 jQuery(84KB) + jquery.i18n 插件，仅为切换 30 余条文案。
 * 这里用 fetch + querySelectorAll 等价重写，体积从 85KB 降到 2KB 以内。
 *
 * 注意：
 * - i18n JSON 的值里含 HTML（如 "Years of <br /> experience"），因此必须用 innerHTML。
 * - 通过 file:// 直接双击打开时 fetch 会被浏览器拦截，此时保留 HTML 内的默认英文，不抛错。
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'lang';
  var DEFAULT_LANG = 'en';
  var FILE_PATH = 'assets/i18n/';
  var cache = Object.create(null);

  function getLang() {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
    } catch (e) {
      return DEFAULT_LANG;
    }
  }

  function saveLang(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  }

  function syncHtmlLang(lang) {
    document.documentElement.lang = lang === 'cn' ? 'zh-CN' : 'en';
  }

  function syncButtonLabel(lang) {
    var btn = document.getElementById('nav__translate');
    if (btn) btn.textContent = lang === 'cn' ? '中/En' : 'En/中';
  }

  function loadDict(lang) {
    if (cache[lang]) return Promise.resolve(cache[lang]);
    return fetch(FILE_PATH + 'i18n_' + lang + '.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (dict) {
        cache[lang] = dict;
        return dict;
      });
  }

  function apply(dict) {
    var nodes = document.querySelectorAll('[i18n]');
    Array.prototype.forEach.call(nodes, function (el) {
      var value = dict[el.getAttribute('i18n')];
      if (typeof value === 'string') el.innerHTML = value;
    });
  }

  function switchTo(lang) {
    syncHtmlLang(lang);
    syncButtonLabel(lang);
    loadDict(lang)
      .then(apply)
      .catch(function (err) {
        // 离线 / file:// 场景：保留页面自带的默认文案
        if (window.console && console.info) {
          console.info('[i18n] 语言包读取失败，保持默认文案：' + err.message);
        }
      });
  }

  var button = document.getElementById('translate');
  if (button) {
    button.addEventListener('click', function () {
      var next = getLang() === 'cn' ? 'en' : 'cn';
      saveLang(next);
      switchTo(next);
    });
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.setAttribute('aria-label', 'Switch language / 切换语言');
    button.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        button.click();
      }
    });
  }

  switchTo(getLang());
})();
