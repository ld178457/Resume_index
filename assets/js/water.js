/*==================================================================
  3D 水波纹背景（WebGL 着色器）

  设计取舍（遵循 UI 设计系统的"克制"原则）：
  - 水波只在有涟漪的地方显现，不做满屏常驻叠加 —— 不抢内容、不糊文字
  - 高度场求法线 + 漫反射/高光 —— 靠光影出体积感，而不是靠颜色堆砌
  - 无 WebGL 时静默降级为无背景特效，不影响页面任何功能
==================================================================*/
(function () {
  'use strict';

  var reduceMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
  if (reduceMotion) return;

  var MAX_RIPPLES = 16;
  var SPEED = 92;       // 波前扩散速度 px/s（调慢：水面更平静）
  var LIFE = 3.6;       // 单个涟漪寿命 s（SPEED × LIFE ≈ 330px，半径不变但过程更舒缓）
  var TAIL = 86;        // 波包长度 px —— 决定一圈涟漪里能看见几道水纹（荡漾感来源）
  var WLEN = 44;        // 波长 px —— 相邻两道水纹的间距
  var MOVE_STEP = 52;   // 鼠标移动多少像素补一颗涟漪（加大 = 降低跟随密度）
  var IDLE_GAP = 1.25;  // 鼠标停留时每隔多久再发一圈（加大 = 降低荡漾频率）

  var canvas = document.createElement('canvas');
  canvas.className = 'water-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  // 某些环境（老浏览器、jsdom、禁用 WebGL）取上下文会直接抛错，包一层确保不影响页面
  var gl = null;
  try {
    gl = canvas.getContext('webgl', { alpha: true, antialias: false }) ||
         canvas.getContext('experimental-webgl', { alpha: true, antialias: false });
  } catch (err) {
    gl = null;
  }
  if (!gl) return;      // 不支持就什么都不做，页面照常

  document.body.insertBefore(canvas, document.body.firstChild);

  /*==================== 着色器 ====================*/
  var VERT = [
    'attribute vec2 aPos;',
    'void main() { gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    '#define MAX_RIPPLES ' + MAX_RIPPLES,
    'uniform vec2  uResolution;',
    'uniform float uTime;',
    'uniform int   uCount;',
    'uniform vec4  uRipples[MAX_RIPPLES];',   // xy=中心(左上原点) z=起始时间 w=强度
    'uniform vec3  uColorA;',
    'uniform vec3  uColorB;',
    'uniform float uOpacity;',
    'const float SPEED = ' + SPEED.toFixed(1) + ';',
    'const float LIFE  = ' + LIFE.toFixed(1) + ';',
    'const float TAIL  = ' + TAIL.toFixed(1) + ';',
    'const float WLEN  = ' + WLEN.toFixed(1) + ';',
    // 高度场：每个涟漪是一道随时间外扩的"波列"（多道同心水纹），
    // 而不是单独一圈 —— 多道水纹前后相随，才有水面荡漾的感觉
    'float heightAt(vec2 p) {',
    '  float h = 0.0;',
    '  float k = 6.28318 / WLEN;',
    '  for (int i = 0; i < MAX_RIPPLES; i++) {',
    '    if (i < uCount) {',
    '      vec4 r = uRipples[i];',
    '      float age = uTime - r.z;',
    '      if (age > 0.0 && age < LIFE) {',
    '        float d = distance(p, r.xy);',
    '        float front = age * SPEED;',
    '        float dist = d - front;',
    // 波包中心略偏波前内侧：真实水波的纹路是拖在扩散前沿后面的
    '        float t = (dist + TAIL * 0.45) / TAIL;',
    '        float env = exp(-t * t);',
    // 主波 + 一点点二次谐波，避免波形过于机械
    '        float wave = sin(dist * k) * 0.85 + sin(dist * k * 1.7 + 1.1) * 0.15;',
    '        float fade = 1.0 - age / LIFE;',
    '        float spread = 1.0 / (1.0 + front * 0.0028);',
    '        h += wave * env * fade * fade * spread * r.w;',
    '      }',
    '    }',
    '  }',
    '  return h;',
    '}',
    'void main() {',
    // gl_FragCoord 原点在左下，涟漪坐标用左上原点，这里翻转 y
    '  vec2 p = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);',
    '  vec2 uv = gl_FragCoord.xy / uResolution;',
    '  float e = 2.0;',
    // 前向差分：只多采 2 次而不是 4 次，省掉 40% 的着色器开销
    '  float h  = heightAt(p);',
    '  float hx = heightAt(p + vec2(e, 0.0)) - h;',
    '  float hy = heightAt(p + vec2(0.0, e)) - h;',
    // 由高度场求法线，才会有真正的立体光影
    '  vec3 n = normalize(vec3(-hx, -hy, e * 4.0));',
    '  vec3 lightDir = normalize(vec3(0.35, 0.62, 0.70));',
    '  float diff = clamp(dot(n, lightDir), 0.0, 1.0);',
    '  float spec = pow(clamp(dot(reflect(-lightDir, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 28.0);',
    '  vec3 base = mix(uColorA, uColorB, clamp(uv.y + h * 0.03, 0.0, 1.0));',
    '  vec3 col = base + (diff - 0.5) * 0.22 + vec3(1.0) * spec * 0.55;',
    // 透明度只跟波高与高光挂钩：无涟漪处完全透明，不遮挡页面
    '  float a = uOpacity * (abs(h) * 0.8 + spec * 0.55);',
    '  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  // 全屏四边形
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1
  ]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var U = {
    res: gl.getUniformLocation(prog, 'uResolution'),
    time: gl.getUniformLocation(prog, 'uTime'),
    count: gl.getUniformLocation(prog, 'uCount'),
    ripples: gl.getUniformLocation(prog, 'uRipples[0]'),
    colorA: gl.getUniformLocation(prog, 'uColorA'),
    colorB: gl.getUniformLocation(prog, 'uColorB'),
    opacity: gl.getUniformLocation(prog, 'uOpacity')
  };

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  /*==================== 尺寸 ====================*/
  var scale = 1;
  function resize() {
    // 水波是柔和效果，降采样渲染再交给 CSS 拉伸：既省 GPU，边缘也更顺滑
    var d = Math.min(window.devicePixelRatio || 1, 1.25);
    scale = d * 0.72;
    var w = Math.max(1, Math.floor(window.innerWidth * scale));
    var h = Math.max(1, Math.floor(window.innerHeight * scale));
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U.res, w, h);
  }
  resize();
  window.addEventListener('resize', resize);

  /*==================== 涟漪池 ====================*/
  var ripples = [];
  for (var i = 0; i < MAX_RIPPLES; i++) ripples.push({ x: 0, y: 0, t: -999, s: 0 });
  var cursor = 0;
  var flat = new Float32Array(MAX_RIPPLES * 4);

  function spawn(x, y, strength) {
    var r = ripples[cursor];
    r.x = x * scale;
    r.y = y * scale;
    r.t = clock();
    r.s = strength === undefined ? 1 : strength;
    cursor = (cursor + 1) % MAX_RIPPLES;
  }

  /*==================== 指针 ====================*/
  var t0 = 0;
  function clock() { return (performance.now() - t0) / 1000; }

  var pointer = { x: 0, y: 0, has: false };
  var lastSpawnX = 0, lastSpawnY = 0;
  var lastMoveT = -99;
  var nextIdleAt = 0;
  var nextAmbientAt = 1.5;

  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') {          // 触摸：只留一圈涟漪，不做常驻中心
      spawn(e.clientX, e.clientY, 1);
      lastMoveT = clock();
      return;
    }
    var t = clock();
    lastMoveT = t;
    pointer.has = true;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    var dx = e.clientX - lastSpawnX, dy = e.clientY - lastSpawnY;
    if (dx * dx + dy * dy > MOVE_STEP * MOVE_STEP) {   // 沿轨迹补点，形成跟随感
      spawn(e.clientX, e.clientY, 0.85);
      lastSpawnX = e.clientX;
      lastSpawnY = e.clientY;
    }
  }, { passive: true });

  window.addEventListener('pointerleave', function () { pointer.has = false; });
  document.addEventListener('mouseleave', function () { pointer.has = false; });
  window.addEventListener('blur', function () { pointer.has = false; });

  /*==================== 主循环 ====================*/
  var drawnOnce = false;

  function frame() {
    requestAnimationFrame(frame);
    if (document.hidden) return;               // 后台标签页不渲染
    var t = clock();

    // 鼠标停留：以指针为中心持续外扩
    if (pointer.has && t - lastMoveT > 0.28 && t > nextIdleAt) {
      spawn(pointer.x, pointer.y, 1);
      nextIdleAt = t + IDLE_GAP;
    }
    // 没有鼠标（触屏/从未移动）：偶尔来一圈环境涟漪，避免背景死板
    if (!pointer.has && t > nextAmbientAt) {
      spawn(Math.random() * window.innerWidth, Math.random() * window.innerHeight * 0.9, 0.5);
      nextAmbientAt = t + 4.5 + Math.random() * 4.0;
    }

    // 收集仍存活的涟漪
    var n = 0;
    for (var i = 0; i < MAX_RIPPLES; i++) {
      var r = ripples[i];
      if (t - r.t >= 0 && t - r.t < LIFE) {
        flat[n * 4] = r.x; flat[n * 4 + 1] = r.y; flat[n * 4 + 2] = r.t; flat[n * 4 + 3] = r.s;
        n++;
      }
    }

    if (!n) {                                  // 没涟漪时清空一次就歇着，省电
      if (drawnOnce) {
        gl.clear(gl.COLOR_BUFFER_BIT);
        drawnOnce = false;
      }
      return;
    }

    var dark = document.body.classList.contains('dark-theme');
    gl.uniform1f(U.time, t);
    gl.uniform1i(U.count, n);
    gl.uniform4fv(U.ripples, flat);
    gl.uniform1f(U.opacity, dark ? 0.9 : 0.92);   // 用同名数学在 Python 里渲染比对过：低于 0.8 基本看不见
    if (dark) {
      gl.uniform3f(U.colorA, 0.05, 0.12, 0.20);
      gl.uniform3f(U.colorB, 0.12, 0.25, 0.38);
    } else {
      gl.uniform3f(U.colorA, 0.25, 0.55, 0.68);
      gl.uniform3f(U.colorB, 0.60, 0.85, 0.94);
    }
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    drawnOnce = true;
  }

  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); }, false);

  t0 = performance.now();
  requestAnimationFrame(frame);
})();
