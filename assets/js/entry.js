/* ==========================================================================
   entry.js — 글 한 편 / 프로젝트 한 개를 읽어 화면에 올린다

   <main data-entry="posts" data-base="..">  또는 data-entry="projects"
   주소는 post.html?slug=어쩌구 형식이다.
   (정적 호스팅에서는 글마다 폴더를 미리 만들 수 없으므로 물음표 주소를 쓴다)
   ========================================================================== */
(function () {
  'use strict';

  var main = document.querySelector('[data-entry]');
  if (!main) return;

  var kind = main.getAttribute('data-entry');
  var base = main.getAttribute('data-base') || '..';
  var slug = window.Util.param('slug');
  var esc = window.Util.esc;

  var elTitle = document.getElementById('e-title');
  var elDate  = document.getElementById('e-date');
  var elTags  = document.getElementById('e-tags');
  var elBody  = document.getElementById('e-body');
  var elSum   = document.getElementById('e-summary');
  var elKicker = document.getElementById('e-kicker');

  function fail(msg) {
    elTitle.textContent = '찾지 못했습니다';
    if (elSum) elSum.textContent = msg;
    elBody.innerHTML = '<p><a class="link" href="index.html">목록으로 돌아가기 →</a></p>';
  }

  if (!/^[a-z0-9가-힣-]{1,80}$/i.test(slug)) { fail('주소에 글 이름이 없습니다.'); return; }

  window.Util.json(base + '/data/' + kind + '.json')
    .then(function (data) {
      var it = (data.items || []).filter(function (x) { return x.slug === slug; })[0];
      if (!it) throw new Error('목록에 없는 이름입니다: ' + slug);

      document.title = it.title + (kind === 'posts' ? ' — 문혁재' : ' — 프로젝트 · 문혁재');
      var md = document.querySelector('meta[name="description"]');
      if (md && it.summary) md.setAttribute('content', it.summary);

      elTitle.textContent = it.title;
      if (elDate) elDate.textContent = window.Util.date(it.date);
      if (elKicker && it.status) elKicker.textContent = it.status;
      if (elSum && it.summary) elSum.textContent = it.summary;
      if (elTags) {
        elTags.innerHTML = (it.tags || []).map(function (t) {
          return '<li class="tag">' + esc(t) + '</li>';
        }).join('');
      }
      var box = document.getElementById('e-suggest-name');
      if (box) box.textContent = it.title;
      document.body.setAttribute('data-project', slug);

      return window.Util.text(base + '/content/' + kind + '/' + slug + '.md');
    })
    .then(function (src) {
      elBody.innerHTML = window.MD.render(src);
      if (window.selfCheck) window.selfCheck();
      var s = document.getElementById('suggest-block');
      if (s) s.hidden = false;
    })
    .catch(function (e) { fail(e.message); });
})();
