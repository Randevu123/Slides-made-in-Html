/* ==========================================================================
   suggest.js — 수정 제안 폼 → Google 스프레드시트

   보내는 곳은 config.js 의 SITE.suggestEndpoint (Google Apps Script 웹앱)다.
   만드는 방법은 저장소 뿌리의 google-apps-script.gs 맨 위 주석에 있다.

   Apps Script 웹앱은 브라우저가 요구하는 CORS 머리글을 붙여 주지 않는다.
   그래서 mode:'no-cors' 로 보내고 본문을 text/plain 으로 싣는다 —
   이러면 사전 요청(preflight)이 없어 그냥 통과한다. 대신 **응답을 읽을 수 없다.**
   그래서 '보냈습니다'까지만 말하고, 실패로 잡히는 것은 네트워크 오류뿐이다.

   주소를 아직 안 넣었으면 폼이 스스로 '연결 전'이라고 말하고
   적은 내용을 복사할 수 있게 해 준다 — 쓴 글이 그냥 사라지지 않도록.
   ========================================================================== */
(function () {
  'use strict';

  var form = document.getElementById('suggest-form');
  if (!form) return;

  var status = document.getElementById('suggest-status');
  var btn = document.getElementById('suggest-send');
  var copy = document.getElementById('suggest-copy');

  function say(msg, kind) {
    status.textContent = msg;
    status.className = 'status' + (kind ? ' ' + kind : '');
  }

  function payload() {
    var fd = new FormData(form);
    return {
      project: document.body.getAttribute('data-project') || document.title,
      kind: fd.get('kind') || '기타',
      body: (fd.get('body') || '').toString().trim(),
      name: (fd.get('name') || '').toString().trim(),
      contact: (fd.get('contact') || '').toString().trim(),
      page: location.href,
      at: new Date().toISOString()
    };
  }

  function asText(p) {
    return [
      '프로젝트: ' + p.project,
      '종류: ' + p.kind,
      '내용: ' + p.body,
      '이름: ' + (p.name || '(없음)'),
      '연락처: ' + (p.contact || '(없음)'),
      '페이지: ' + p.page
    ].join('\n');
  }

  if (copy) {
    copy.addEventListener('click', function () {
      var t = asText(payload());
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(function () { say('내용을 복사했습니다. 메일로 보내 주셔도 됩니다.', 'ok'); },
                                              function () { say('복사가 안 됩니다. 직접 선택해 복사해 주세요.', 'ng'); });
      } else {
        say('복사가 안 되는 브라우저입니다. 직접 선택해 복사해 주세요.', 'ng');
      }
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    /* 사람이 아닌 것이 채우는 칸 — 채워져 있으면 조용히 무시한다 */
    if (form.querySelector('[name="website"]').value) { say('보냈습니다. 고맙습니다.', 'ok'); form.reset(); return; }

    var p = payload();
    if (p.body.length < 5) { say('내용을 조금만 더 적어 주세요.', 'ng'); return; }
    if (p.body.length > 4000) { say('내용이 너무 깁니다 (4000자까지).', 'ng'); return; }

    var url = (window.SITE && window.SITE.suggestEndpoint) || '';
    if (!url) {
      say('아직 스프레드시트에 연결하지 않았습니다. 아래 "내용 복사"를 눌러 메일로 보내 주세요.', 'ng');
      if (copy) copy.hidden = false;
      return;
    }

    btn.disabled = true;
    say('보내는 중…');

    fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(p)
    }).then(function () {
      say('보냈습니다. 읽고 반영하겠습니다. 고맙습니다.', 'ok');
      form.reset();
    }).catch(function () {
      say('보내지 못했습니다. "내용 복사"를 눌러 메일로 보내 주세요.', 'ng');
      if (copy) copy.hidden = false;
    }).then(function () { btn.disabled = false; });
  });
})();
