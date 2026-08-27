/**
 * ============================================================================
 * 수정 제안 → 구글 스프레드시트 (Google Apps Script)
 *
 * 사이트의 제안 폼이 보낸 내용을 시트에 한 줄씩 쌓는다.
 *
 * ── 설치 (한 번만, 5분) ────────────────────────────────────────────────
 *  1. 구글 드라이브에서 새 **스프레드시트**를 만든다. 이름은 아무거나
 *     (예: "사이트 수정 제안"). 시트 탭 이름은 건드리지 않아도 된다.
 *  2. 그 스프레드시트에서  확장 프로그램 → Apps Script  를 연다.
 *  3. 열린 편집기의 코드를 **전부 지우고 이 파일 내용을 통째로 붙여넣는다.**
 *  4. 저장(💾)한 뒤  배포 → 새 배포  를 누른다.
 *       · 유형 선택(톱니바퀴) → **웹 앱**
 *       · 설명: 아무거나
 *       · 다음 사용자로 실행: **나**
 *       · 액세스 권한이 있는 사용자: **모든 사용자**
 *     → 배포를 누르면 권한 승인 창이 뜬다. 승인한다.
 *       ("이 앱은 확인되지 않았습니다" 가 뜨면 고급 → 안전하지 않은 페이지로 이동)
 *  5. 나온 **웹 앱 URL** (https://script.google.com/macros/s/……/exec) 을 복사해
 *     저장소의  assets/js/config.js  의  suggestEndpoint  에 붙여넣고 커밋한다.
 *
 *  ※ 코드를 고친 뒤에는 반드시 **배포 → 배포 관리 → 편집(연필) → 새 버전 → 배포**
 *     를 해야 반영된다. 저장만 해서는 웹 앱이 안 바뀐다.
 *
 * ── 확인 ──────────────────────────────────────────────────────────────
 *  웹 앱 URL 을 브라우저 주소창에 그냥 붙여넣어 열어 보면 "ok" 가 나온다.
 *  그다음 사이트 제안 폼에서 한 번 보내 보고 시트에 줄이 생기는지 본다.
 *
 * ── 알아 둘 것 ────────────────────────────────────────────────────────
 *  · 브라우저는 응답을 읽지 못한다(no-cors). 그래서 사이트는 "보냈습니다"까지만
 *    말한다. 실제로 쌓였는지는 시트를 보면 된다.
 *  · 누구나 보낼 수 있는 주소다. 장난이 많아지면 아래 DAILY_LIMIT 을 줄이거나
 *    시트를 비공개로 두고 필요할 때만 본다.
 * ============================================================================
 */

/** 하루에 받을 최대 건수 — 넘으면 조용히 버린다 */
var DAILY_LIMIT = 200;

/** 시트 첫 줄 머리글 */
var HEADERS = ['받은 시각', '프로젝트', '종류', '내용', '이름', '연락처', '페이지', '보낸 시각(브라우저)'];

function doPost(e) {
  try {
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try { data = JSON.parse(e.postData.contents) || {}; } catch (err) { data = {}; }
    }
    /* 폼 인코딩으로 온 경우도 받아 준다 */
    if (e && e.parameter && !data.body && e.parameter.body) data = e.parameter;

    var body = String(data.body || '').trim();
    if (!body) return out('empty');
    if (body.length > 4000) body = body.slice(0, 4000) + '…(잘림)';

    var sheet = getSheet();
    if (sheet.getLastRow() > DAILY_LIMIT * 30) return out('full');

    sheet.appendRow([
      new Date(),
      String(data.project || '').slice(0, 200),
      String(data.kind || '기타').slice(0, 40),
      body,
      String(data.name || '').slice(0, 100),
      String(data.contact || '').slice(0, 200),
      String(data.page || '').slice(0, 400),
      String(data.at || '')
    ]);
    return out('ok');
  } catch (err) {
    return out('error: ' + err);
  }
}

function doGet() {
  return out('ok');
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(4, 480);          // 내용 칸을 넓게
    sheet.getRange('D:D').setWrap(true);
  }
  return sheet;
}

function out(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.TEXT);
}
