/* ==========================================================================
   admin.js — 사이트 안에서 글·프로젝트를 쓰고 저장소에 바로 커밋한다

   서버가 없으므로 '로그인' 은 GitHub 개인 토큰으로 대신한다.
   토큰은 이 브라우저(localStorage)에만 있고, GitHub 말고는 어디로도 가지 않는다.

   저장 절차 (공개 글 기준)
     1) PUT content/posts/<slug>.md          — 본문
     2) GET data/posts.json → 목록 합치기 → PUT  — 목록 한 줄
   둘 다 GitHub Contents API 한 개만 쓴다.

   비공개 글은 **아무 데도 올리지 않는다.** 정적 사이트에 올린 파일은 주소만 알면
   누구나 볼 수 있으므로, 진짜 비공개는 '올리지 않는 것' 뿐이다.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = window.Util.esc;

  var K_AUTH = 'sih-gh';
  var K_PRIV = 'sih-private';
  var K_DRAFT = 'sih-draft-';
  var API = 'https://api.github.com';

  var auth = null;

  /* ---------- 저장 공간 ---------- */
  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }

  /* ---------- GitHub ---------- */
  function b64(str) {
    /* 한글이 든 문자열을 base64 로. btoa 는 바이트만 받으므로 UTF-8 로 먼저 편다. */
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function unb64(s) {
    var bin = atob(String(s).replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  function gh(path, opts) {
    opts = opts || {};
    return fetch(API + path, {
      method: opts.method || 'GET',
      headers: {
        'Authorization': 'Bearer ' + auth.token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      if (r.status === 404 && opts.allow404) return null;
      return r.json().then(function (j) {
        if (!r.ok) {
          var msg = (j && j.message) || ('HTTP ' + r.status);
          if (r.status === 401) msg = '토큰이 거부됐습니다 (401). 만료됐거나 권한이 없습니다.';
          if (r.status === 403) msg = '권한이 없습니다 (403). 토큰에 Contents: Read and write 를 주세요.';
          if (r.status === 409) msg = '충돌이 났습니다 (409). 잠시 뒤 다시 시도해 주세요.';
          throw new Error(msg);
        }
        return j;
      });
    });
  }

  function getFile(path) {
    return gh('/repos/' + auth.repo + '/contents/' + encodeURI(path) +
              '?ref=' + encodeURIComponent(auth.branch), { allow404: true });
  }

  function putFile(path, text, message, sha) {
    var body = { message: message, content: b64(text), branch: auth.branch };
    if (sha) body.sha = sha;
    return gh('/repos/' + auth.repo + '/contents/' + encodeURI(path), { method: 'PUT', body: body });
  }

  /* 본문 파일 + 목록 json 을 차례로 커밋한다 */
  function publish(kind, meta, bodyText) {
    var mdPath = 'content/' + kind + '/' + meta.slug + '.md';
    var jsonPath = 'data/' + kind + '.json';

    return getFile(mdPath)
      .then(function (cur) {
        return putFile(mdPath, bodyText,
          (cur ? '고침' : '새로 씀') + ': ' + meta.title, cur && cur.sha);
      })
      .then(function () { return getFile(jsonPath); })
      .then(function (cur) {
        var data = { items: [] };
        if (cur && cur.content) {
          try { data = JSON.parse(unb64(cur.content)) || data; } catch (e) {}
        }
        if (!Array.isArray(data.items)) data.items = [];
        var next = data.items.filter(function (x) { return x.slug !== meta.slug; });
        next.push(meta);
        next.sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
        data.items = next;
        return putFile(jsonPath, JSON.stringify(data, null, 2) + '\n',
          '목록 갱신: ' + meta.title, cur && cur.sha);
      });
  }

  /* 글이 아닌 파일(.skill, 이미지 등)도 올릴 수 있게 바이트를 그대로 base64 로.
     btoa 에 한 번에 다 넘기면 파일이 클 때 터지므로 조각내서 넘긴다. */
  function b64bytes(buf) {
    var bytes = new Uint8Array(buf), bin = '', CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    }
    return btoa(bin);
  }

  function putRaw(path, base64, message, sha) {
    var body = { message: message, content: base64, branch: auth.branch };
    if (sha) body.sha = sha;
    return gh('/repos/' + auth.repo + '/contents/' + encodeURI(path), { method: 'PUT', body: body });
  }

  function delFile(path, message, sha) {
    return gh('/repos/' + auth.repo + '/contents/' + encodeURI(path), {
      method: 'DELETE',
      body: { message: message, sha: sha, branch: auth.branch }
    });
  }

  /* 목록 json 을 읽어 { sha, items } 로 준다 (파일이 없으면 빈 배열) */
  function readList(kind) {
    return getFile('data/' + kind + '.json').then(function (cur) {
      var data = { items: [] };
      if (cur && cur.content) {
        try { data = JSON.parse(unb64(cur.content)) || data; } catch (e) {}
      }
      return { sha: cur && cur.sha, items: Array.isArray(data.items) ? data.items : [] };
    });
  }

  /* 사이트에서 내리기 — 목록에서 빼고 본문 파일을 지운다

     순서가 중요하다. 목록을 **먼저** 고친다. 본문을 먼저 지우면 그 사이에 실패했을 때
     목록에는 있는데 본문이 없는 줄이 남아 사이트에 '찾지 못했습니다' 가 뜬다.
     반대로 하면 최악의 경우 아무도 안 읽는 파일 하나가 남을 뿐이다. */
  function unpublish(kind, item) {
    var jsonPath = 'data/' + kind + '.json';
    var mdPath = 'content/' + kind + '/' + item.slug + '.md';

    return readList(kind)
      .then(function (cur) {
        var next = cur.items.filter(function (x) { return x.slug !== item.slug; });
        return putFile(jsonPath, JSON.stringify({ items: next }, null, 2) + '\n',
          '목록에서 뺌: ' + item.title, cur.sha);
      })
      .then(function () { return getFile(mdPath); })
      .then(function (cur) {
        /* 직접 만든 페이지(page 항목)를 쓰는 프로젝트는 .md 가 없다 — 그냥 넘어간다 */
        if (!cur || !cur.sha) return null;
        return delFile(mdPath, '지움: ' + item.title, cur.sha);
      });
  }

  /* ---------- 잠금 화면 ---------- */
  var gate = $('#gate'), work = $('#work');

  function showWork() {
    gate.hidden = true;
    work.hidden = false;
    $('#who').textContent = auth.repo + ' · ' + auth.branch + ' 브랜치에 씁니다';
    renderPrivate();
  }

  function initGate() {
    var saved = load(K_AUTH, null);
    if (window.SITE && window.SITE.repo && !$('#g-repo').value) $('#g-repo').value = window.SITE.repo;
    if (window.SITE && window.SITE.branch) $('#g-branch').value = window.SITE.branch;
    if (saved && saved.token && saved.repo) {
      auth = saved;
      showWork();
      return;
    }
    $('#gate-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var st = $('#g-status');
      var repo = $('#g-repo').value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/+$/, '');
      var branch = $('#g-branch').value.trim() || 'main';
      var token = $('#g-token').value.trim();
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { st.textContent = '저장소는 "계정명/저장소이름" 형식입니다.'; st.className = 'status ng'; return; }
      if (!token) { st.textContent = '토큰을 넣어 주세요.'; st.className = 'status ng'; return; }

      auth = { repo: repo, branch: branch, token: token };
      st.textContent = '확인하는 중…'; st.className = 'status';
      $('#g-send').disabled = true;

      gh('/repos/' + repo).then(function (r) {
        if (r.permissions && r.permissions.push === false) {
          throw new Error('이 토큰으로는 쓰기가 안 됩니다. Contents: Read and write 권한을 주세요.');
        }
        save(K_AUTH, auth);
        st.textContent = ''; st.className = 'status';
        showWork();
      }).catch(function (err) {
        auth = null;
        st.textContent = err.message;
        st.className = 'status ng';
      }).then(function () { $('#g-send').disabled = false; });
    });
  }

  $('#btn-logout') && $('#btn-logout').addEventListener('click', function () {
    if (!confirm('이 브라우저에서 토큰을 지웁니다. 비공개 일기는 그대로 남습니다. 계속할까요?')) return;
    try { localStorage.removeItem(K_AUTH); } catch (e) {}
    location.reload();
  });

  /* ---------- 탭 ---------- */
  $$('.tabs [role=tab]').forEach(function (tab) {
    tab.addEventListener('click', function () {
      $$('.tabs [role=tab]').forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        $('#' + t.getAttribute('aria-controls')).hidden = !on;
      });
    });
  });

  /* ---------- 공통 폼 도구 ---------- */
  function slugify(s) {
    return String(s).trim().toLowerCase()
      .replace(/[^\w가-힣\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
  }
  function today() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function tags(s) {
    return String(s || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 8);
  }
  function download(name, text) {
    var blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function say(el, msg, kind) { el.textContent = msg; el.className = 'status' + (kind ? ' ' + kind : ''); }

  /* 제목을 치면 주소 이름을 따라 만든다 (직접 고치면 그때부터 안 따라간다) */
  function linkSlug(titleEl, slugEl) {
    var touched = false;
    slugEl.addEventListener('input', function () { touched = true; });
    titleEl.addEventListener('input', function () {
      if (!touched) slugEl.value = slugify(titleEl.value);
    });
  }

  /* 쓰다 만 것을 잃지 않게 30초마다, 그리고 칸을 벗어날 때 저장해 둔다 */
  function autosave(form, key) {
    var k = K_DRAFT + key;
    var saved = load(k, null);
    if (saved && confirm('저장하지 않은 ' + (key === 'post' ? '글' : '프로젝트') + '이 있습니다. 이어서 쓸까요?')) {
      Object.keys(saved).forEach(function (n) {
        var el = form.elements[n];
        if (el && el.type !== 'radio') el.value = saved[n];
      });
    } else if (saved) {
      try { localStorage.removeItem(k); } catch (e) {}
    }
    var timer = setInterval(dump, 30000);
    form.addEventListener('change', dump);
    function dump() {
      var o = {};
      $$('input[type=text],input[type=date],textarea', form).forEach(function (el) {
        if (el.name) o[el.name] = el.value;
      });
      if (Object.keys(o).some(function (n) { return o[n]; })) save(k, o);
    }
    return {
      clear: function () { clearInterval(timer); try { localStorage.removeItem(k); } catch (e) {} }
    };
  }

  /* ---------- 새 글 ---------- */
  (function () {
    var form = $('#post-form');
    if (!form) return;
    $('#p-date').value = today();
    linkSlug($('#p-title'), $('#p-slug'));
    var draft = autosave(form, 'post');
    var st = $('#p-status');

    $('#p-preview').addEventListener('click', function () {
      $('#p-preview-box').hidden = false;
      $('#p-preview-out').innerHTML = window.MD.render($('#p-body').value);
      $('#p-preview-box').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('#p-download').addEventListener('click', function () {
      var m = read();
      if (!m) return;
      download(m.meta.slug + '.md', m.body);
      say(st, '.md 파일을 내려받았습니다.', 'ok');
    });

    function read() {
      var f = form.elements;
      var slug = slugify(f.slug.value);
      if (!f.title.value.trim()) { say(st, '제목을 적어 주세요.', 'ng'); return null; }
      if (!slug) { say(st, '주소에 쓸 이름이 필요합니다.', 'ng'); return null; }
      if (!f.body.value.trim()) { say(st, '본문이 비어 있습니다.', 'ng'); return null; }
      f.slug.value = slug;
      return {
        meta: {
          slug: slug,
          title: f.title.value.trim(),
          date: f.date.value || today(),
          summary: f.summary.value.trim(),
          tags: tags(f.tags.value)
        },
        body: f.body.value,
        vis: (form.querySelector('input[name=vis]:checked') || {}).value || 'public'
      };
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var m = read();
      if (!m) return;

      if (m.vis === 'private') {
        var list = load(K_PRIV, []);
        var rest = list.filter(function (x) { return x.slug !== m.meta.slug; });
        rest.unshift({
          slug: m.meta.slug, title: m.meta.title, date: m.meta.date,
          summary: m.meta.summary, tags: m.meta.tags, body: m.body,
          updated: new Date().toISOString()
        });
        if (!save(K_PRIV, rest)) { say(st, '브라우저 저장 공간이 가득 찼습니다. .md 로 내려받아 두세요.', 'ng'); return; }
        say(st, '이 브라우저에만 저장했습니다. 사이트에는 올라가지 않습니다.', 'ok');
        renderPrivate();
        draft.clear();
        form.reset(); $('#p-date').value = today();
        return;
      }

      if (!auth) { say(st, '먼저 토큰을 넣어 주세요.', 'ng'); return; }
      $('#p-save').disabled = true;
      say(st, '저장소에 올리는 중…');
      publish('posts', m.meta, m.body).then(function () {
        say(st, '올렸습니다. GitHub Pages 반영까지 1~2분 걸립니다.', 'ok');
        draft.clear();
        form.reset(); $('#p-date').value = today();
      }).catch(function (err) {
        say(st, '실패: ' + err.message, 'ng');
      }).then(function () { $('#p-save').disabled = false; });
    });
  })();

  /* ---------- 새 프로젝트 ---------- */
  (function () {
    var form = $('#proj-form');
    if (!form) return;
    $('#j-date').value = today();
    linkSlug($('#j-title'), $('#j-slug'));
    var draft = autosave(form, 'project');
    var st = $('#j-status-msg');

    $('#j-preview').addEventListener('click', function () {
      $('#j-preview-box').hidden = false;
      $('#j-preview-out').innerHTML = window.MD.render($('#j-body').value);
      $('#j-preview-box').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    $('#j-template').addEventListener('click', function () {
      if ($('#j-body').value.trim() && !confirm('본문을 뼈대로 바꿉니다. 계속할까요?')) return;
      $('#j-body').value = [
        '## 무엇을 하는 것인가', '', '한 문단으로.', '',
        '## 언제 쓰고, 언제 쓰지 않나', '',
        '- 이럴 때 쓴다', '- 이럴 때는 쓰지 않는다', '',
        '## 어떻게 만들었나', '', '',
        '## 어떤 결정을 왜 그렇게 했나', '',
        '- 정한 것 — 그렇게 정한 이유', '',
        '## 아직 못 고친 것', '',
        '- 무엇이 / 왜 문제이고 / 어떻게 고치면 되는지', ''
      ].join('\n');
    });

    function read() {
      var f = form.elements;
      var slug = slugify(f.slug.value);
      if (!f.title.value.trim()) { say(st, '제목을 적어 주세요.', 'ng'); return null; }
      if (!slug) { say(st, '주소에 쓸 이름이 필요합니다.', 'ng'); return null; }
      if (!f.body.value.trim()) { say(st, '본문이 비어 있습니다.', 'ng'); return null; }
      f.slug.value = slug;
      var meta = {
        slug: slug,
        title: f.title.value.trim(),
        date: f.date.value || today(),
        summary: f.summary.value.trim(),
        tags: tags(f.tags.value)
      };
      if (f.status.value.trim()) meta.status = f.status.value.trim();
      return { meta: meta, body: f.body.value };
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var m = read();
      if (!m) return;
      if (!auth) { say(st, '먼저 토큰을 넣어 주세요.', 'ng'); return; }
      $('#j-save').disabled = true;
      say(st, '저장소에 올리는 중…');
      publish('projects', m.meta, m.body).then(function () {
        say(st, '올렸습니다. 프로젝트 목록에 곧 나타납니다 (1~2분).', 'ok');
        draft.clear();
        form.reset(); $('#j-date').value = today();
      }).catch(function (err) {
        say(st, '실패: ' + err.message, 'ng');
      }).then(function () { $('#j-save').disabled = false; });
    });
  })();

  /* ---------- 비공개 일기 ---------- */
  function renderPrivate() {
    var box = $('#private-list');
    if (!box) return;
    var list = load(K_PRIV, []);
    $('#private-empty').hidden = list.length > 0;
    box.innerHTML = list.map(function (it, i) {
      return '<div class="draft-row">' +
        '<span class="badge b-lock">비공개</span>' +
        '<span class="draft-t">' + esc(it.title) + '<small>' + esc(it.date) + ' · ' + esc(it.slug) + '</small></span>' +
        '<button type="button" class="mini" data-priv="open" data-i="' + i + '">열기</button>' +
        '<button type="button" class="mini" data-priv="down" data-i="' + i + '">내려받기</button>' +
        '<button type="button" class="mini" data-priv="del" data-i="' + i + '">지우기</button>' +
        '</div>';
    }).join('');
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-priv]');
    if (!b) return;
    var list = load(K_PRIV, []);
    var i = +b.getAttribute('data-i');
    var it = list[i];
    if (!it) return;

    if (b.getAttribute('data-priv') === 'open') {
      $('#tab-post').click();
      var f = $('#post-form').elements;
      f.title.value = it.title; f.slug.value = it.slug; f.date.value = it.date;
      f.summary.value = it.summary || ''; f.tags.value = (it.tags || []).join(', ');
      f.body.value = it.body;
      $('#post-form').querySelector('input[name=vis][value=private]').checked = true;
      $('#p-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (b.getAttribute('data-priv') === 'down') {
      download(it.slug + '.md', it.body);
    } else if (b.getAttribute('data-priv') === 'del') {
      if (!confirm('"' + it.title + '" 을 이 브라우저에서 지웁니다. 되돌릴 수 없습니다.')) return;
      list.splice(i, 1);
      save(K_PRIV, list);
      renderPrivate();
    }
  });

  /* ---------- 파일 올리기 (스킬 파일·설명서) ---------- */
  (function () {
    var input = $('#u-file');
    if (!input) return;
    var st = $('#u-status');
    var listBox = $('#u-list');
    var MAX = 1024 * 1024;   /* 1MB — 이보다 크면 이 방식으로는 못 올린다 */
    var picked = [];

    function human(n) {
      return n < 1024 ? n + 'B'
           : n < 1024 * 1024 ? (n / 1024).toFixed(1) + 'KB'
           : (n / 1024 / 1024).toFixed(2) + 'MB';
    }
    function folder() {
      return $('#u-dir').value.trim().replace(/^\/+|\/+$/g, '') || 'docs';
    }
    function draw() {
      $('#u-empty').hidden = picked.length > 0;
      listBox.innerHTML = picked.map(function (f, i) {
        var big = f.size > MAX;
        return '<div class="draft-row">' +
          '<span class="badge' + (big ? ' b-lock' : '') + '">' +
            (big ? '너무 큼 · ' + human(f.size) : human(f.size)) + '</span>' +
          '<span class="draft-t">' + esc(f.name) +
            '<small>' + esc(folder() + '/' + f.name) + '</small></span>' +
          '<button type="button" class="mini" data-up="rm" data-i="' + i + '">빼기</button>' +
          '</div>';
      }).join('');
    }

    input.addEventListener('change', function () {
      picked = picked.concat(Array.prototype.slice.call(input.files || []));
      input.value = '';   /* 같은 파일을 다시 고를 수 있게 비운다 */
      draw();
      say(st, picked.length ? picked.length + '개를 골랐습니다.' : '');
    });
    $('#u-dir').addEventListener('input', draw);

    listBox.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-up="rm"]');
      if (!b) return;
      picked.splice(+b.getAttribute('data-i'), 1);
      draw();
    });

    function readFile(f) {
      return new Promise(function (ok, no) {
        var r = new FileReader();
        r.onload = function () { ok(b64bytes(r.result)); };
        r.onerror = function () { no(new Error(f.name + ' 을 읽지 못했습니다.')); };
        r.readAsArrayBuffer(f);
      });
    }

    function one(f) {
      var path = folder() + '/' + f.name;
      if (f.size > MAX) {
        return Promise.reject(new Error(f.name + ' 은 1MB 가 넘습니다. GitHub 웹에서 올려 주세요.'));
      }
      return readFile(f).then(function (content) {
        return getFile(path).then(function (cur) {
          if (cur && cur.sha && !confirm(path + ' 이 이미 있습니다.\n덮어쓸까요?')) {
            return { skipped: true, path: path };
          }
          return putRaw(path, content, (cur ? '고침' : '올림') + ': ' + path, cur && cur.sha)
            .then(function () { return { path: path }; });
        });
      });
    }

    $('#u-send').addEventListener('click', function () {
      if (!auth) { say(st, '먼저 토큰을 넣어 주세요.', 'ng'); return; }
      if (!picked.length) { say(st, '올릴 파일을 골라 주세요.', 'ng'); return; }
      var btn = $('#u-send');
      btn.disabled = true;
      var done = [], skipped = [];

      picked.reduce(function (p, f) {
        return p.then(function () {
          say(st, f.name + ' 올리는 중…');
          return one(f).then(function (r) { (r.skipped ? skipped : done).push(r.path); });
        });
      }, Promise.resolve()).then(function () {
        picked = []; draw();
        say(st, '올렸습니다: ' + (done.join(', ') || '없음') +
          (skipped.length ? ' · 건너뜀: ' + skipped.join(', ') : ''), 'ok');
      }).catch(function (err) {
        say(st, '실패: ' + err.message, 'ng');
      }).then(function () { btn.disabled = false; });
    });

    draw();
  })();

  /* ---------- 올린 것 관리 (내리기) ---------- */
  (function () {
    var box = $('#pub-list');
    if (!box) return;
    var st = $('#pub-status');
    var cache = { posts: [], projects: [] };
    var loaded = false;

    function row(kind, it) {
      var label = kind === 'posts' ? '글' : '프로젝트';
      var where = kind === 'posts'
        ? 'blog/post.html?slug=' + encodeURIComponent(it.slug)
        : (it.page ? 'projects/' + it.page
                   : 'projects/detail.html?slug=' + encodeURIComponent(it.slug));
      return '<div class="draft-row">' +
        '<span class="badge">' + label + '</span>' +
        '<span class="draft-t">' + esc(it.title) +
          '<small>' + esc(it.date || '') + ' · ' + esc(it.slug) +
          (it.page ? ' · 직접 만든 페이지' : '') + '</small>' +
        '</span>' +
        '<a class="mini" href="' + esc(where) + '" target="_blank" rel="noopener">보기</a>' +
        '<button type="button" class="mini" data-pub="del" data-kind="' + kind +
          '" data-slug="' + esc(it.slug) + '">내리기</button>' +
        '</div>';
    }

    function draw() {
      var all = cache.posts.map(function (it) { return row('posts', it); })
        .concat(cache.projects.map(function (it) { return row('projects', it); }));
      box.innerHTML = all.join('');
      $('#pub-empty').hidden = all.length > 0;
    }

    function reload() {
      if (!auth) { say(st, '먼저 토큰을 넣어 주세요.', 'ng'); return; }
      say(st, '저장소에서 목록을 읽는 중…');
      Promise.all([readList('posts'), readList('projects')])
        .then(function (r) {
          cache.posts = r[0].items;
          cache.projects = r[1].items;
          loaded = true;
          draw();
          say(st, '저장소의 지금 상태입니다.', 'ok');
        })
        .catch(function (err) { say(st, '읽지 못했습니다: ' + err.message, 'ng'); });
    }

    $('#pub-reload').addEventListener('click', reload);
    $('#tab-manage') && $('#tab-manage').addEventListener('click', function () {
      if (!loaded) reload();
    });

    box.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-pub="del"]');
      if (!b) return;
      var kind = b.getAttribute('data-kind');
      var slug = b.getAttribute('data-slug');
      var it = cache[kind].filter(function (x) { return x.slug === slug; })[0];
      if (!it) return;

      if (!confirm(
        '"' + it.title + '" 을 사이트에서 내립니다.\n\n' +
        '목록에서 빼고 본문 파일을 지웁니다.\n' +
        'GitHub 기록에는 남아 있어 나중에 되살릴 수 있습니다.\n\n계속할까요?'
      )) return;

      b.disabled = true;
      say(st, '내리는 중…');
      unpublish(kind, it).then(function () {
        cache[kind] = cache[kind].filter(function (x) { return x.slug !== slug; });
        draw();
        say(st, '내렸습니다. 사이트 반영까지 1~2분 걸립니다.' +
          (it.page ? ' 직접 만든 페이지 projects/' + it.page +
                     ' 는 남아 있습니다. 필요하면 저장소에서 지우세요.' : ''), 'ok');
      }).catch(function (err) {
        b.disabled = false;
        say(st, '실패: ' + err.message, 'ng');
      });
    });
  })();

  /* ---------- 시작 ---------- */
  initGate();
})();
