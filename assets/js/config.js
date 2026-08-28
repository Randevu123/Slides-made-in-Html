/* ==========================================================================
   config.js — 사이트 설정. 여기만 고치면 된다.
   이 파일은 누구나 볼 수 있으므로 **비밀은 절대 넣지 않는다.**
   (GitHub 토큰은 이 파일이 아니라 관리자 화면에서 내 브라우저에만 저장된다)
   ========================================================================== */
window.SITE = {
  /* 저장소 — 관리자 화면이 글·프로젝트를 커밋할 곳.
     "계정명/저장소이름" 형식. 관리자 화면에서도 바꿀 수 있다. */
  repo: 'Randevu123/Slides-made-in-Html',
  branch: 'main',

  /* 수정 제안 폼이 보낼 곳 — Google Apps Script 웹앱 URL.
     만드는 방법은 /google-apps-script.gs 파일 맨 위 주석에 적어 뒀다.
     비워 두면 폼이 '아직 연결 전' 안내를 띄우고 내용을 복사할 수 있게 한다. */
  suggestEndpoint: 'https://script.google.com/macros/s/AKfycbxF8z0OQbLk_K8RW9jhWn5C9VECQ-9ZaM6LmToLn-2ljaSEf3f_Yc_nLH7B1agUuHel/exec',

  /* 사이트 주인 */
  author: '문혁재',
  email: 'jejuharry123@gmail.com'
};
