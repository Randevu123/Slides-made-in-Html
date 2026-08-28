/* ==========================================================================
   site.js — 모든 페이지가 함께 쓰는 것
     1 테마   2 등장 애니메이션   3 커서 점   4 자기 검사   5 발표 모드
   내용은 전부 HTML/JSON 에 있다. 이 파일이 없어도 사이트는 읽힌다.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  window.$ = window.$ || $;
  window.$$ = window.$$ || $$;

  /* ---------- 1. 테마 ---------- */
  var KEY = 'sih-theme';

  function readTheme() {
    try {
      var v = localStorage.getItem(KEY);
      if (v === 'light' || v === 'dark') return v;
    } catch (e) {}
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    return 'dark';
  }

  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    $$('[data-theme-toggle]').forEach(function (b) {
      b.textContent = t === 'dark' ? '라이트' : '다크';
      b.setAttribute('aria-pressed', String(t === 'dark'));
    });
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#101114' : '#ffffff');
    document.dispatchEvent(new CustomEvent('themechange', { detail: t }));
    selfCheck();
  }

  applyTheme(readTheme());
  $$('[data-theme-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, next); } catch (e) {}
      applyTheme(next);
    });
  });

  /* ---------- 2. 등장 애니메이션 ----------
     '숨겼다가 보이기'가 아니라 '보이는 것을 한 번 띄우기'다.
     JS 가 죽어도 내용은 처음부터 그대로 보인다. */
  var io = null;
  function watchReveal(scope) {
    if (!('IntersectionObserver' in window)) return;
    if (!io) {
      io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    }
    $$('.reveal:not(.in)', scope || document).forEach(function (el) { io.observe(el); });
  }
  window.watchReveal = watchReveal;
  watchReveal();

  /* ---------- 3. 커서를 따라다니는 점 ----------
     마우스가 있는 기기에서만. 손가락으로 쓰는 화면에서는 아예 만들지 않는다. */
  (function () {
    if (!window.matchMedia) return;
    if (!window.matchMedia('(hover:hover) and (pointer:fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var dot = document.createElement('div');
    dot.className = 'dot';
    dot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(dot);

    var tx = 0, ty = 0, x = 0, y = 0, on = false, raf = 0;

    function loop() {
      x += (tx - x) * 0.22;
      y += (ty - y) * 0.22;
      dot.style.transform = 'translate(' + (x - 3) + 'px,' + (y - 3) + 'px)';
      if (Math.abs(tx - x) > 0.4 || Math.abs(ty - y) > 0.4) raf = requestAnimationFrame(loop);
      else raf = 0;
    }

    document.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      tx = e.clientX; ty = e.clientY;
      if (!on) { on = true; x = tx; y = ty; dot.classList.add('on'); }
      if (!raf) raf = requestAnimationFrame(loop);
      var t = e.target;
      dot.classList.toggle('big', !!(t && t.closest && t.closest('a,button,summary,input,textarea,select')));
    }, { passive: true });

    document.addEventListener('pointerleave', function () { dot.classList.remove('on'); });
  })();

  /* ---------- 4. 자기 검사 ----------
     slides-in-html 의 check.mjs 가 슬라이드에 하던 명도 대비 계산을
     이 페이지 자신에게 돌린다. 푸터에 #selfcheck 가 있는 페이지에서만 동작한다. */
  function srgb(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function lum(p) { return 0.2126 * srgb(p[0]) + 0.7152 * srgb(p[1]) + 0.0722 * srgb(p[2]); }
  function ratio(a, b) {
    var la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  /* 브라우저는 색을 rgb() 로만 돌려주지 않는다. color-mix() 를 쓴 자리는
     color(srgb 1 1 1 / .82) 처럼 온다 — 숫자만 긁으면 1,1,1 을 색으로 읽어 결과가 틀어진다.
     캔버스에 한 점 찍어 실제 rgba 로 환산한다. */
  var cv = null;
  function parse(c) {
    var s = String(c).trim();
    var m = s.match(/^rgba?\(([^)]+)\)$/i);
    if (m) {
      var n = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
      if (n.length >= 3) return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1];
    }
    try {
      if (!cv) cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      cv.clearRect(0, 0, 1, 1);
      cv.fillStyle = s;
      cv.fillRect(0, 0, 1, 1);
      var d = cv.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    } catch (e) { return null; }
  }
  function over(f, b) {
    var a = f[3];
    return [f[0] * a + b[0] * (1 - a), f[1] * a + b[1] * (1 - a), f[2] * a + b[2] * (1 - a), 1];
  }
  function bgOf(el) {
    var n = el, stack = [];
    while (n && n.nodeType === 1) {
      var c = parse(getComputedStyle(n).backgroundColor);
      if (c && c[3] > 0) { stack.push(c); if (c[3] === 1) break; }
      n = n.parentElement;
    }
    var base = [255, 255, 255, 1];
    for (var i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
    return base;
  }

  var SAMPLES = [
    ['본문 17px',        '.prose p, .body, .lead'],
    ['설명 19px',        '.sec-sub, .lead'],
    ['줄 설명 15.5px',   '.row-d, .item-d'],
    ['라벨 13px',        '.cap'],
    ['면 위 본문',       '.panel .tick li, .panel p'],
    ['1차 버튼',         '.btn-1'],
    ['보조 버튼',        '.btn:not(.btn-1)'],
    ['뱃지',             '.badge'],
    ['키 표시',          'kbd'],
    ['코드 블록',        '.code code, .prose pre'],
    ['내비 링크',        '.nav-links a'],
    ['푸터 14px',        '.foot-meta']
  ];

  function pad(s, n) {
    s = String(s);
    var w = 0, i;
    for (i = 0; i < s.length; i++) w += s.charCodeAt(i) > 0x2000 ? 2 : 1;
    while (w < n) { s += ' '; w++; }
    return s;
  }

  function selfCheck() {
    var out = $('#selfcheck');
    /* applyTheme() 이 이 함수를 파일 앞쪽에서 한 번 부른다. 그때는 SAMPLES 가
       아직 안 만들어져 있으므로 조용히 건너뛴다 (아래에서 다시 부른다). */
    if (!out || !SAMPLES) return;
    var lines = [], fails = [];

    /* 색 전이가 도는 중에 재면 지나가는 중간색이 잡힌다. 재는 동안만 전이를 끈다. */
    root.classList.add('measuring');
    void root.offsetWidth;

    SAMPLES.forEach(function (s) {
      var el = $(s[1]);
      if (!el) return;
      var cs = getComputedStyle(el);
      var fg = parse(cs.color);
      if (!fg) return;
      var bg = bgOf(el);
      if (fg[3] < 1) fg = over(fg, bg);
      var size = parseFloat(cs.fontSize);
      var weight = parseInt(cs.fontWeight, 10) || 400;
      var need = (size >= 24 || (size >= 18.66 && weight >= 700)) ? 3 : 4.5;
      var r = ratio(fg, bg), ok = r >= need;
      if (!ok) fails.push(s[0]);
      lines.push('  ' + pad(s[0], 16) + pad(r.toFixed(2) + ':1', 10) +
                 '기준 ' + need.toFixed(1) + '  <span class="' + (ok ? 'ok' : 'ng') + '">' +
                 (ok ? '통과' : '미달') + '</span>');
    });

    root.classList.remove('measuring');

    var theme = root.getAttribute('data-theme') === 'dark' ? '다크' : '라이트';
    out.innerHTML = '<code>$ 이 페이지에서 대비 계산 실행 — 테마: ' + theme + '\n\n' +
      lines.join('\n') + '\n\ncontrast(글자 대비 미달): ' +
      (fails.length ? JSON.stringify(fails).replace(/</g, '&lt;') : '<span class="ok">[]</span>') +
      '</code>';
  }
  window.selfCheck = selfCheck;
  selfCheck();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(selfCheck);

  /* ---------- 5. 발표 모드 ----------
     <body data-present="on"> 인 페이지에서만. 스크롤을 막지 않는다. */
  (function () {
    if (document.body.getAttribute('data-present') !== 'on') return;
    var secs = $$('main .sec');
    if (secs.length < 2) return;

    var bar = document.createElement('div');
    bar.className = 'present-bar'; bar.id = 'present-bar'; bar.hidden = true;
    bar.innerHTML = '<div class="present-fill" id="present-fill"></div>';
    var count = document.createElement('span');
    count.className = 'present-count'; count.id = 'present-count'; count.hidden = true;
    document.body.appendChild(bar); document.body.appendChild(count);

    var cur = 0, on = false;
    var links = $$('.toc a');

    function paint() {
      var pct = secs.length > 1 ? (cur / (secs.length - 1)) * 100 : 100;
      $('#present-fill').style.width = pct.toFixed(1) + '%';
      var p = function (n) { return (n < 10 ? '0' : '') + n; };
      count.textContent = p(cur + 1) + ' / ' + p(secs.length);
    }
    function mark(i) {
      if (i === cur) return;
      cur = i;
      links.forEach(function (a, n) {
        if (n === i) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
      if (on) paint();
    }
    function set(v) {
      on = v;
      document.body.classList.toggle('presenting', v);
      bar.hidden = !v; count.hidden = !v;
      if (v) paint();
    }
    function go(d) {
      var i = Math.min(secs.length - 1, Math.max(0, cur + d));
      secs[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
      mark(i);
    }

    if ('IntersectionObserver' in window) {
      var spy = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) mark(secs.indexOf(e.target)); });
      }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
      secs.forEach(function (s) { spy.observe(s); });
    }
    links.forEach(function (a, i) { a.addEventListener('click', function () { mark(i); }); });
    mark(0); links[0] && links[0].setAttribute('aria-current', 'true');

    document.addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable || t.tagName === 'IFRAME')) return;
      if (e.key === 'p' || e.key === 'P' || e.key === 'ㅔ') { set(!on); e.preventDefault(); return; }
      if (!on) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { go(1); e.preventDefault(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { go(-1); e.preventDefault(); }
      else if (e.key === 'Escape') set(false);
    });
  })();
})();
