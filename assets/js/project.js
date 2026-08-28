/* ==========================================================================
   project.js — 프로젝트 상세 페이지(직접 쓴 것)의 두 가지 동작
     1 변화 이력 필터
     2 덱 지연 로딩 — 172KB 짜리 발표 자료는 누르기 전까지 불러오지 않는다
   ========================================================================== */
(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- 1. 변화 이력 필터 ---------- */
  (function () {
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
  })();

  /* ---------- 2. 덱 지연 로딩 ---------- */
  (function () {
    // 페이지 내의 모든 .deck-frame 요소를 찾습니다.
    var frames = $$('.deck-frame');
    if (!frames.length) return;

    frames.forEach(function (box) {
      // 현재 프레임 안의 재생 버튼만 찾습니다.
      var btn = box.querySelector('.deck-play');
      if (!btn) return;

      btn.addEventListener('click', function () {
        var f = document.createElement('iframe');
        f.src = box.getAttribute('data-src');
        f.title = box.getAttribute('data-title') || '발표 자료';
        f.setAttribute('loading', 'lazy');
        f.setAttribute('allowfullscreen', '');
        box.innerHTML = '';
        box.appendChild(f);
        f.focus();
      });
    });
  })();
})();
