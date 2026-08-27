/* ==========================================================================
   home.js — 홈 무대의 커서 반응 격자

   화면 전체에 눈금(점)을 깔고, 커서 가까운 눈금만 밝아진다.
   색을 새로 지어내지 않고 글자색(--field) 하나의 투명도만 움직이므로
   무채색 규칙을 그대로 지킨다.

   · 마우스가 움직이기 전에는 초점이 스스로 천천히 떠다닌다
   · 커서가 멈추면 rAF 를 멈춘다 (배터리)
   · 손가락 기기·모션 최소화 설정에서는 정지된 격자 한 장만 그린다
   ========================================================================== */
(function () {
  'use strict';

  var cv = document.getElementById('field');
  if (!cv || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var hero = cv.closest('.hero') || cv.parentElement;

  var GAP = 30;          /* 눈금 간격 */
  var R = 210;           /* 커서가 밝히는 반경 */
  var A_BASE = 0.055;    /* 평소 눈금 밝기 */
  var A_NEAR = 0.62;     /* 커서 바로 밑 눈금 밝기 */

  var w = 0, h = 0, dpr = 1;
  var rgb = '242,243,245';
  var tx = -9999, ty = -9999;   /* 목표 초점 */
  var x = -9999, y = -9999;     /* 따라오는 초점 */
  var raf = 0, auto = true, t0 = performance.now();

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches;

  function readColor() {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--field').trim();
    if (v) rgb = v;
  }

  function size() {
    var r = hero.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, Math.round(r.width));
    h = Math.max(1, Math.round(r.height));
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px';
    cv.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    var cols = Math.ceil(w / GAP), rows = Math.ceil(h / GAP);
    var ox = (w - (cols - 1) * GAP) / 2, oy = (h - (rows - 1) * GAP) / 2;

    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {
        var px = ox + i * GAP, py = oy + j * GAP;
        var dx = px - x, dy = py - y;
        var d = Math.sqrt(dx * dx + dy * dy);
        var k = d < R ? 1 - d / R : 0;
        k = k * k;                                  /* 가운데로 갈수록 급하게 밝아진다 */
        var a = A_BASE + (A_NEAR - A_BASE) * k;
        var s = 1 + 1.9 * k;                        /* 밝은 눈금은 조금 커진다 */
        ctx.fillStyle = 'rgba(' + rgb + ',' + a.toFixed(3) + ')';
        ctx.fillRect(px - s / 2, py - s / 2, s, s);
      }
    }

    /* 초점 둘레에 아주 옅은 원 하나 — 눈금만 있으면 '어디가 중심인지' 가 약하다 */
    if (x > -9000) {
      ctx.beginPath();
      ctx.arc(x, y, R * 0.42, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(' + rgb + ',.05)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function loop() {
    if (auto) {
      /* 아직 마우스가 안 움직였다 — 초점이 스스로 떠다닌다 */
      var t = (performance.now() - t0) / 1000;
      tx = w * (0.5 + 0.3 * Math.sin(t * 0.31));
      ty = h * (0.5 + 0.26 * Math.sin(t * 0.23 + 1.2));
    }
    if (x < -9000) { x = tx; y = ty; }
    x += (tx - x) * 0.09;
    y += (ty - y) * 0.09;
    draw();
    var moving = auto || Math.abs(tx - x) > 0.5 || Math.abs(ty - y) > 0.5;
    raf = moving ? requestAnimationFrame(loop) : 0;
  }

  function kick() { if (!raf) raf = requestAnimationFrame(loop); }

  readColor();
  size();

  /* 첫 한 장은 rAF 를 기다리지 않고 바로 그린다.
     탭이 아직 안 그려지는 상태(백그라운드 등)에서도 격자가 비어 보이지 않는다. */
  x = tx = w * 0.5; y = ty = h * 0.42;
  draw();

  if (!(reduce || !fine)) {
    kick();
    hero.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      var r = hero.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
      if (auto) { auto = false; hero.classList.add('touched'); }
      kick();
    }, { passive: true });

    hero.addEventListener('pointerleave', function () {
      /* 나가면 가운데로 조용히 돌아온다 */
      tx = w * 0.5; ty = h * 0.45; kick();
    });
  }

  var rt;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { size(); if (raf) draw(); else { draw(); } }, 120);
  }, { passive: true });

  document.addEventListener('themechange', function () { readColor(); draw(); });
})();
