/*==================== MENU SHOW Y HIDDEN ====================*/
const navMenu = document.getElementById('nav-menu'),
    navToggle = document.getElementById('nav-toggle'),
    navClose = document.getElementById('nav-close');

/*===== MENU SHOW =====*/
/* Validate if constant exists */
if(navToggle){
    navToggle.addEventListener('click',()=>{
        navMenu.classList.add('show-menu')
    })
}

/*===== MENU HIDDEN =====*/
/* Validate if constant exists */
if(navClose){
    navClose.addEventListener('click',()=>{
        navMenu.classList.remove('show-menu')
    })
}

/*==================== REMOVE MENU MOBILE ====================*/
const navLink = document.querySelectorAll('.nav__link')

function linkAction(){
    const navMenu = document.getElementById('nav-menu')
    // 点击每个菜单链接后收起菜单栏
    navMenu.classList.remove('show-menu')
}
navLink.forEach(n => n.addEventListener('click', linkAction))

/*==================== ACCORDION SKILLS ====================*/
const skillsContent = document.getElementsByClassName('skills__content'),
      skillsHeader = document.querySelectorAll('.skills__header')

      function toggleSkills() {
        const isClosed = this.parentNode.classList.contains('skills__close')

        for(let i = 0; i < skillsContent.length; i++) { /* 原实现漏写声明，会泄漏全局变量 i */
          skillsContent[i].classList.add('skills__close')
          skillsContent[i].classList.remove('skills__open')
        }
        if(isClosed){
          this.parentNode.classList.remove('skills__close')
          this.parentNode.classList.add('skills__open')
        }
        this.setAttribute('aria-expanded', isClosed ? 'true' : 'false')
      }

      skillsHeader.forEach((el) => {
        el.setAttribute('role', 'button')
        el.setAttribute('tabindex', '0')
        el.setAttribute('aria-expanded',
          el.parentNode.classList.contains('skills__open') ? 'true' : 'false')
        el.addEventListener('click', toggleSkills)
        el.addEventListener('keydown', (e) => {
          if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggleSkills.call(el) }
        })
      })

/*==================== QUALIFICATION TABS ====================*/
const tabs = document.querySelectorAll('[data-target]'),
      tabContents = document.querySelectorAll('[data-content]')

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = document.querySelector(tab.dataset.target)

    tabContents.forEach(tabContent => {
      tabContent.classList.remove('qualification__active')
    })
    target.classList.add('qualification__active')

    tabs.forEach(tab => {
      tab.classList.remove('qualification__active')
    })
    tab.classList.add('qualification__active')
  })
})


/*==================== PORTFOLIO 轮播 ====================*/
/* 已由 assets/js/carousel.js 用原生 scroll-snap 实现，不再依赖 Swiper */


/*==================== SCROLL（三个监听合并为一个 + rAF 节流） ====================*/
const sections = document.querySelectorAll('section[id]')
const header = document.getElementById('header')
const scrollUpBtn = document.getElementById('scroll-up')

// 缓存导航链接，避免每次滚动都做 querySelector（原实现每帧查询 5×2 次）
const navLinks = {}
sections.forEach(sec => {
  const id = sec.getAttribute('id')
  navLinks[id] = document.querySelector('.nav__menu a[href*=' + id + ']')
})

function scrollActive(){
    const mid = window.innerHeight / 2
    sections.forEach(current =>{
        const sectionHeight = current.clientHeight
        const sectionTop = current.getBoundingClientRect().top
        const link = navLinks[current.getAttribute('id')]
        if(!link) return
        // section 位于视口中间时添加样式 active-link
        if(sectionTop <= mid && sectionTop + sectionHeight >= mid){
            link.classList.add('active-link')
        }else{
            link.classList.remove('active-link')
        }
    })
}

function scrollHeader(y){
    if(y >= 80) header.classList.add('scroll-header'); else header.classList.remove('scroll-header')
}

function scrollUp(y){
    if(y >= 560) scrollUpBtn.classList.add('show-scroll'); else scrollUpBtn.classList.remove('show-scroll')
}

let ticking = false
window.addEventListener('scroll', () => {
    if(ticking) return
    ticking = true
    requestAnimationFrame(() => {
        const y = window.scrollY
        scrollActive(); scrollHeader(y); scrollUp(y)
        ticking = false
    })
}, { passive: true })

/*==================== DARK LIGHT THEME & LANGUAGE====================*/ 

const themeButton = document.getElementById('theme-button')
const darkTheme = 'dark-theme'
const iconTheme = 'uil-sun'
const language = 'cn'

// Previously selected topic (if user selected)
const selectedTheme = localStorage.getItem('selected-theme')
const selectedIcon = localStorage.getItem('selected-icon')

// We obtain the current theme that the interface has by validating the dark-theme class
const getCurrentTheme = () => document.body.classList.contains(darkTheme) ? 'dark' : 'light'
const getCurrentIcon = () => themeButton.classList.contains(iconTheme) ? 'uil-moon' : 'uil-sun'

// We validate if the user previously chose a topic
if (selectedTheme) {
  // If the validation is fulfilled, we ask what the issue was to know if we activated or deactivated the dark
  document.body.classList[selectedTheme === 'dark' ? 'add' : 'remove'](darkTheme)
  themeButton.classList[selectedIcon === 'uil-moon' ? 'add' : 'remove'](iconTheme)
} else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  // 首次访问且系统为深色：body class 已由 index.html 内联脚本设置，这里同步图标状态
  themeButton.classList.add(iconTheme)
}

// Activate / deactivate the theme manually with the button
themeButton.addEventListener('click', () => {
    // Add or remove the dark / icon theme
    document.body.classList.toggle(darkTheme)
    themeButton.classList.toggle(iconTheme)
    // We save the theme and the current icon that the user chose
    localStorage.setItem('selected-theme', getCurrentTheme())
    localStorage.setItem('selected-icon', getCurrentIcon())
})

/*==================== 一键复制（公众号等无主页的账号） ====================*/
function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text)
    }
    // 降级方案：非 HTTPS 或旧浏览器
    return new Promise((resolve, reject) => {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.setAttribute('readonly', '')
        ta.style.cssText = 'position:fixed;top:-9999px;opacity:0'
        document.body.appendChild(ta)
        ta.select()
        try {
            document.execCommand('copy') ? resolve() : reject(new Error('copy failed'))
        } catch (err) {
            reject(err)
        }
        document.body.removeChild(ta)
    })
}

let toastEl = null
let toastTimer = null
function showToast(message) {
    if (!toastEl) {
        toastEl = document.createElement('div')
        toastEl.className = 'copy-toast'
        toastEl.setAttribute('role', 'status')
        toastEl.setAttribute('aria-live', 'polite')
        document.body.appendChild(toastEl)
    }
    toastEl.textContent = message
    toastEl.classList.remove('is-show')
    void toastEl.offsetWidth          // 强制回流，连续点击时动画才会重播
    toastEl.classList.add('is-show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => toastEl.classList.remove('is-show'), 2000)
}

document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
        const value = btn.getAttribute('data-copy')
        copyToClipboard(value)
            .then(() => showToast('已复制：' + value))
            .catch(() => showToast('复制失败，请手动记录：' + value))
    })
})