/* ==========================================================================
   content.js — 글·프로젝트를 읽어 화면에 올릴 때 쓰는 공용 도구

   · MD.render(markdown)  아주 작은 마크다운 변환기 (외부 라이브러리 없음)
   · Util.json(url)       JSON 읽기
   · Util.text(url)       텍스트 읽기
   · Util.date(iso)       2026-08-27 → 2026년 8월 27일
   · Util.esc(s)          HTML escape

   변환기를 직접 만든 이유: 이 사이트는 외부 스크립트를 하나도 안 부른다는
   규칙(DESIGN.md 9장)을 지키기 위해서다. 지원하는 문법은 아래가 전부다.
     # ## ###   제목
     **굵게**  *기울임*  `코드`  [글자](주소)
     - 목록 / 1. 번호 목록 / > 인용 / --- 구분선 / ``` 코드블록
   ========================================================================== */
(function () {
  'use strict';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* 인라인 — 코드(`)를 먼저 떼어 두고 나머지를 바꾼다.
     그러지 않으면 코드 안의 별표가 굵게로 잡힌다. */
  function inline(s) {
    var codes = [];
    s = String(s).replace(/`([^`]+)`/g, function (m, c) {
      codes.push('<code>' + esc(c) + '</code>');
      return '\u0000' + (codes.length - 1) + '\u0000';
    });
    s = esc(s);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, u) {
      var safe = /^(https?:|mailto:|#|\/|\.\/|\.\.\/)/i.test(u) ? u : '#';
      var ext = /^https?:/i.test(safe) ? ' target="_blank" rel="noopener noreferrer"' : '';
      return '<a href="' + esc(safe) + '"' + ext + '>' + t + '</a>';
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/\u0000(\d+)\u0000/g, function (m, i) { return codes[+i]; });
    return s;
  }

  function render(src) {
    var lines = String(src == null ? '' : src).replace(/\r\n?/g, '\n').split('\n');
    var out = [], i = 0;

    function flushList(tag, items) {
      out.push('<' + tag + '>' + items.map(function (t) { return '<li>' + inline(t) + '</li>'; }).join('') + '</' + tag + '>');
    }

    while (i < lines.length) {
      var ln = lines[i];

      if (/^```/.test(ln)) {                       /* 코드 블록 */
        var buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        out.push('<pre><code>' + esc(buf.join('\n')) + '</code></pre>');
        continue;
      }
      if (/^\s*$/.test(ln)) { i++; continue; }
      if (/^---+\s*$/.test(ln)) { out.push('<hr>'); i++; continue; }

      var hm = ln.match(/^(#{1,4})\s+(.*)$/);
      if (hm) {
        var lv = Math.min(Math.max(hm[1].length, 2), 4);  /* # 도 h2 부터 — h1 은 글 제목이 쓴다 */
        out.push('<h' + lv + '>' + inline(hm[2]) + '</h' + lv + '>');
        i++; continue;
      }
      if (/^>\s?/.test(ln)) {
        var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; }
        out.push('<blockquote><p>' + inline(q.join(' ')) + '</p></blockquote>');
        continue;
      }
      if (/^\s*[-*]\s+/.test(ln)) {
        var ul = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { ul.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++; }
        flushList('ul', ul);
        continue;
      }
      if (/^\s*\d+[.)]\s+/.test(ln)) {
        var ol = [];
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { ol.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++; }
        flushList('ol', ol);
        continue;
      }

      var para = [];                                /* 그 밖엔 문단 */
      while (i < lines.length && !/^\s*$/.test(lines[i]) &&
             !/^(#{1,4}\s|>|\s*[-*]\s|\s*\d+[.)]\s|```|---+\s*$)/.test(lines[i])) {
        para.push(lines[i]); i++;
      }
      if (para.length) out.push('<p>' + inline(para.join(' ')) + '</p>');
    }
    return out.join('\n');
  }

  /* 본문 첫 문단을 미리보기 문구로 (목록에 쓴다) */
  function excerpt(src, n) {
    var t = String(src || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/^#{1,4}\s+/gm, '')
      .replace(/[*`>#\-]/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
    n = n || 110;
    return t.length > n ? t.slice(0, n).trim() + '…' : t;
  }

  function date(iso) {
    var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return String(iso || '');
    return m[1] + '년 ' + (+m[2]) + '월 ' + (+m[3]) + '일';
  }

  function json(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' — ' + r.status);
      return r.json();
    });
  }
  function text(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' — ' + r.status);
      return r.text();
    });
  }
  function param(k) {
    return new URLSearchParams(location.search).get(k) || '';
  }

  window.MD = { render: render, inline: inline, excerpt: excerpt };
  window.Util = { esc: esc, date: date, json: json, text: text, param: param };
})();
