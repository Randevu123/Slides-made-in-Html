/* ==========================================================================
   Slides-in-Html 아카이브 사이트 — main.js

   원칙: 내용은 전부 HTML 에 있다. 이 파일은 '없어도 읽히는' 것만 담당한다.
     1 테마      2 절 표시(레일·목차)   3 등장 애니메이션
     4 변화 이력 필터                   5 덱 지연 로딩
     6 발표 모드                        7 자기 검사(대비 계산)
   ========================================================================== */
(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var secs = $$('.sec');
  var root = document.documentElement;

  /* ---------- 1. 테마 ---------------------------------------------------
     저장된 선택 > 시스템 설정 > 다크. 스킬이 '라이트/다크를 고정하지 않는다'고
     정해 뒀으므로 사이트도 고르게 둔다. */
  var THEME_KEY = 'sih-theme';

  function readTheme() {
    try {
      var v = localStorage.getItem(THEME_KEY);
      if (v === 'light' || v === 'dark') return v;
    } catch (e) { /* 사생활 보호 모드 등 — 조용히 넘어간다 */ }
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    return 'dark';
  }

  function applyTheme(t) {
    root.setAttribute('data-theme', t);
    var label = t === 'dark' ? '라이트' : '다크';
    var pressed = String(t === 'dark');
    var full = $('#theme-rail'), top = $('#theme-top');
    if (full) { full.textContent = label + '로 보기'; full.setAttribute('aria-pressed', pressed); }
    if (top)  { top.textContent  = label;             top.setAttribute('aria-pressed', pressed); }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#101114' : '#ffffff');
    /* 색 전이(.2s)가 끝난 뒤에 재야 '지금 화면의 색'이 나온다.
       전이 도중에 재면 중간값이 잡혀 없는 미달이 뜬다. */
    selfCheck();
    setTimeout(selfCheck, 300);
  }

  function toggleTheme() {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    applyTheme(next);
  }

  /* ---------- 2. 절 표시 — 레일과 좁은 화면 목차 ---------- */
  var railLinks = $$('.rail-list a');

  function buildSheet() {
    var btn = $('#toc-btn'), sheet = $('#toc-sheet');
    if (!btn || !sheet) return;
    var ol = document.createElement('ol');
    railLinks.forEach(function (a) {
      var li = document.createElement('li');
      li.innerHTML = a.innerHTML;
      var link = document.createElement('a');
      link.href = a.getAttribute('href');
      link.innerHTML = a.innerHTML;
      li.innerHTML = '';
      li.appendChild(link);
      ol.appendChild(li);
    });
    sheet.appendChild(ol);
    function close() { sheet.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    btn.addEventListener('click', function () {
      var open = sheet.hidden;
      sheet.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    });
    sheet.addEventListener('click', function (e) { if (e.target.closest('a')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  var current = -1;   /* -1 로 시작해야 첫 markCurrent(0) 이 실제로 표시를 건다 */

  function markCurrent(i) {
    if (i === current) return;
    current = i;
    railLinks.forEach(function (a, n) {
      if (n === i) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    updatePresent();
  }

  /* ---------- 3. 등장 애니메이션 + 절 추적 ---------- */
  if ('IntersectionObserver' in window) {
    var reveal = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); reveal.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.06 });
    secs.forEach(function (s) { reveal.observe(s); });

    /* 화면 한가운데를 지나는 절을 '지금 절'로 본다 */
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) markCurrent(secs.indexOf(en.target));
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    secs.forEach(function (s) { spy.observe(s); });
  } else {
    secs.forEach(function (s) { s.classList.add('in'); });
  }

  /* ---------- 4. 변화 이력 필터 ---------- */
  function initFilter() {
    var chips = $$('.filters .chip');
    var rows = $$('#ledger .ledger-row');
    var live = $('#filter-live');
    if (!chips.length || !rows.length) return;

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var kind = chip.getAttribute('data-filter');
        chips.forEach(function (c) {
          var on = c === chip;
          c.classList.toggle('is-on', on);
          c.setAttribute('aria-pressed', String(on));
        });
        var shown = 0;
        rows.forEach(function (r) {
          var ok = kind === 'all' || r.getAttribute('data-kind') === kind;
          r.hidden = !ok;
          if (ok) shown++;
        });
        if (live) {
          var name = chip.textContent.replace(/\d+/g, '').trim();
          live.textContent = kind === 'all'
            ? shown + '건을 모두 보고 있습니다.'
            : name + ' ' + shown + '건만 보고 있습니다.';
        }
      });
    });
  }

  /* ---------- 5. 덱 지연 로딩 ----------
     172KB 짜리 덱을 처음부터 붙이면 첫 화면이 그만큼 늦어진다.
     누르기 전까지는 iframe 을 만들지 않는다. */
  function initDeck() {
    var btn = $('#deck-play'), box = $('#deck-frame');
    if (!btn || !box) return;
    btn.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.src = 'deck/slides-in-html-deck.html';
      f.title = 'Slides-in-Html 스킬 제작 결과 — 발표 자료';
      f.setAttribute('loading', 'lazy');
      f.setAttribute('allowfullscreen', '');
      box.innerHTML = '';
      box.appendChild(f);
      f.focus();
    });
  }

  /* ---------- 6. 발표 모드 ----------
     스크롤을 막지 않는다. ← → 로 절을 넘기고, 어디쯤인지 위에 띄운다. */
  var presenting = false;

  function updatePresent() {
    if (!presenting) return;
    var fill = $('#present-fill'), count = $('#present-count');
    var i = Math.max(0, current);
    var pct = secs.length > 1 ? (i / (secs.length - 1)) * 100 : 100;
    if (fill) fill.style.width = pct.toFixed(1) + '%';
    if (count) {
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      count.textContent = pad(i) + ' / ' + pad(secs.length - 1);
    }
  }

  function setPresent(on) {
    presenting = on;
    document.body.classList.toggle('presenting', on);
    var bar = $('#present-bar');
    if (bar) bar.hidden = !on;
    updatePresent();
  }

  function goSection(delta) {
    var i = Math.min(secs.length - 1, Math.max(0, Math.max(0, current) + delta));
    if (i === current && delta !== 0) return;
    secs[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
    markCurrent(i);
  }

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (t && t.tagName === 'IFRAME') return;

    if (e.key === 'p' || e.key === 'P' || e.key === 'ㅔ') { setPresent(!presenting); e.preventDefault(); return; }
    if (!presenting) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { goSection(1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { goSection(-1); e.preventDefault(); }
    else if (e.key === 'Escape') { setPresent(false); }
  });

  /* ---------- 7. 자기 검사 ----------
     check.mjs 가 슬라이드에 하던 명도 대비 계산을, 이 페이지 자신에게 돌린다.
     화면에 실제로 그려진 색을 읽어 오므로 테마를 바꾸면 결과도 바뀐다. */
  function srgb(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function lum(rgb) { return 0.2126 * srgb(rgb[0]) + 0.7152 * srgb(rgb[1]) + 0.0722 * srgb(rgb[2]); }
  function ratio(a, b) {
    var la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  /* 브라우저는 색을 rgb() 로만 돌려주지 않는다. color-mix() 를 쓴 자리는
     color(srgb 1 1 1 / .82) 같은 형태로 온다 — 숫자만 긁으면 1,1,1 을 색으로 읽어
     검사 결과가 통째로 틀어진다. 캔버스에 한 점 찍어 실제 rgba 로 환산한다. */
  var _cv = null;
  function toRGBA(c) {
    var s = String(c).trim();
    var m = s.match(/^rgba?\(([^)]+)\)$/i);
    if (m) {
      var n = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
      if (n.length >= 3) return [n[0], n[1], n[2], n.length > 3 ? n[3] : 1];
    }
    try {
      if (!_cv) _cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      _cv.clearRect(0, 0, 1, 1);
      _cv.fillStyle = s;
      _cv.fillRect(0, 0, 1, 1);
      var d = _cv.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    } catch (e) { return null; }
  }
  function parse(c) { return toRGBA(c); }
  /* 투명한 색은 뒤에 깔린 색과 섞어 '실제로 보이는 색'으로 만든다 */
  function over(fg, bg) {
    var a = fg[3];
    return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
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
    ['본문 17px',            '.body'],
    ['절 설명 19px',         '.sec-sub'],
    ['줄 설명 15.5px',       '.row-d'],
    ['라벨 13px',            '.cap'],
    ['면 위 본문 15.5px',    '.panel .tick li'],
    ['반전 면 위 본문',      '.vs-hi p:not(.vs-h)'],
    ['1차 버튼',             '.btn-1'],
    ['보조 버튼',            '.btn:not(.btn-1)'],
    ['원장 이유 14.5px',     '.ledger-why'],
    ['뱃지',                 '.badge'],
    ['키 표시',              'kbd'],
    ['코드 블록',            '.code code'],
    ['덱 안내 14px',         '.deck-play-d'],
    ['푸터 14px',            '.foot-meta']
  ];

  function selfCheck() {
    var out = $('#selfcheck');
    if (!out) return;
    var lines = [], fails = [];

    /* 색 전이가 도는 중에 재면 '지금 지나가는 중간색'이 잡힌다.
       재는 동안만 전이를 끄고, 강제로 한 번 계산시켜 최종 색을 읽는다. */
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
      var large = size >= 24 || (size >= 18.66 && weight >= 700);
      var need = large ? 3 : 4.5;
      var r = ratio(fg, bg);
      var ok = r >= need;
      if (!ok) fails.push(s[0]);
      lines.push(
        '  ' + pad(s[0], 18) +
        pad(r.toFixed(2) + ':1', 10) +
        '기준 ' + need.toFixed(1) + '  ' +
        '<span class="' + (ok ? 'ok' : 'ng') + '">' + (ok ? '통과' : '미달') + '</span>'
      );
    });

    var esc = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
    var theme = root.getAttribute('data-theme') === 'dark' ? '다크' : '라이트';
    root.classList.remove('measuring');

    out.innerHTML = '<code>' +
      '$ 이 페이지에서 대비 계산 실행 — 테마: ' + theme + '\n\n' +
      lines.join('\n') + '\n\n' +
      'contrast(글자 대비 미달): ' +
      (fails.length ? esc(JSON.stringify(fails)) : '<span class="ok">[]</span>') +
      '</code>';
  }

  function pad(s, n) {
    s = String(s);
    var w = 0;
    for (var i = 0; i < s.length; i++) w += s.charCodeAt(i) > 0x2000 ? 2 : 1;
    while (w < n) { s += ' '; w++; }
    return s;
  }

  /* ---------- 시작 ---------- */
  applyTheme(readTheme());
  buildSheet();
  initFilter();
  initDeck();
  markCurrent(0);
  railLinks.forEach(function (a, i) {
    a.addEventListener('click', function () { markCurrent(i); });
  });
  var t1 = $('#theme-rail'), t2 = $('#theme-top');
  if (t1) t1.addEventListener('click', toggleTheme);
  if (t2) t2.addEventListener('click', toggleTheme);

  /* 폰트가 늦게 와서 색·크기가 바뀌면 검사도 다시 돌린다 */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(selfCheck);
})();
