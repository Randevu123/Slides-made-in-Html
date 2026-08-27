/* ==========================================================================
   lists.js — 프로젝트·글 목록 그리기

   <ul data-list="projects" data-limit="4" data-base=".."></ul>
   처럼 두면 data/projects.json 을 읽어 채운다. 홈·프로젝트 목록·글 목록이
   같은 코드를 쓴다.

   data-base 는 저장소 뿌리까지의 상대 경로다 ("." = 뿌리, ".." = 한 칸 안).
   ========================================================================== */
(function () {
  'use strict';

  var boxes = Array.prototype.slice.call(document.querySelectorAll('[data-list]'));
  if (!boxes.length) return;

  function esc(s) { return window.Util.esc(s); }

  function href(kind, it, base) {
    if (kind === 'projects') {
      return it.page ? base + '/projects/' + it.page
                     : base + '/projects/detail.html?slug=' + encodeURIComponent(it.slug);
    }
    return base + '/blog/post.html?slug=' + encodeURIComponent(it.slug);
  }

  function row(kind, it, base) {
    var tags = (it.tags || []).map(function (t) { return '<li class="tag">' + esc(t) + '</li>'; }).join('');
    var right = it.status ? esc(it.status) : window.Util.date(it.date);
    return '<li><a class="item" href="' + esc(href(kind, it, base)) + '">' +
             '<div class="item-top">' +
               '<span class="item-t">' + esc(it.title) + '</span>' +
               '<span class="meta">' + right + '</span>' +
             '</div>' +
             (it.summary ? '<p class="item-d">' + esc(it.summary) + '</p>' : '') +
             (tags ? '<ul class="item-tags">' + tags + '</ul>' : '') +
           '</a></li>';
  }

  boxes.forEach(function (box) {
    var kind = box.getAttribute('data-list');
    var base = box.getAttribute('data-base') || '.';
    var limit = parseInt(box.getAttribute('data-limit'), 10) || 0;
    var url = base + '/data/' + kind + '.json';

    window.Util.json(url).then(function (data) {
      var items = (data && data.items ? data.items : []).slice();
      /* 최신이 위로 */
      items.sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
      if (limit) items = items.slice(0, limit);

      if (!items.length) {
        box.outerHTML = '<div class="empty">' +
          (kind === 'projects' ? '아직 올린 프로젝트가 없습니다.' : '아직 쓴 글이 없습니다.') +
          '</div>';
        return;
      }
      box.innerHTML = items.map(function (it) { return row(kind, it, base); }).join('');
      var live = document.querySelector('[data-list-count="' + kind + '"]');
      if (live) live.textContent = (data.items || []).length + '개';
      if (window.watchReveal) window.watchReveal(box);
    }).catch(function (e) {
      box.outerHTML = '<div class="empty">목록을 읽지 못했습니다. (' + esc(e.message) + ')</div>';
    });
  });
})();
