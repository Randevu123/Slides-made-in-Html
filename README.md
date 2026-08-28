# 문혁재 — 만든 것과 생각

개인 사이트. 만든 것(프로젝트)과 쓴 것(글)을 모아 두고, 발표할 때는 그대로 화면에 띄운다.
서버도 빌드도 프레임워크도 없는 **정적 사이트**다.

> 더큰내일교육센터 · AI 취업역량강화 과정 과제

## 무엇이 들어 있나

```
.
├── index.html              홈 — 커서에 반응하는 무대
├── about.html              소개
├── admin.html              관리 (나만 씀 — 글·프로젝트 쓰기)
├── 404.html
├── projects/
│   ├── index.html          프로젝트 목록
│   ├── slides-in-html.html 프로젝트 상세 (직접 쓴 것)
│   └── detail.html         프로젝트 상세 (관리 화면에서 올린 것) ?slug=…
├── blog/
│   ├── index.html          글 목록
│   └── post.html           글 한 편 ?slug=…
├── assets/
│   ├── css/site.css        디자인 구현 — 기준은 DESIGN.md
│   └── js/
│       ├── config.js       ★ 저장소·제안 폼 주소 설정
│       ├── site.js         테마·등장·커서 점·자기 검사·발표 모드
│       ├── content.js      마크다운 변환기(직접 만듦) + 공용 도구
│       ├── lists.js        프로젝트·글 목록 그리기
│       ├── entry.js        글/프로젝트 한 편 그리기
│       ├── home.js         홈 격자 (커서 반응)
│       ├── project.js      원장 필터 · 덱 지연 로딩
│       ├── suggest.js      수정 제안 폼
│       └── admin.js        관리 화면 (GitHub 커밋)
├── data/
│   ├── projects.json       프로젝트 목록
│   └── posts.json          글 목록
├── content/
│   ├── projects/*.md       프로젝트 본문
│   └── posts/*.md          글 본문
├── deck/                   Slides-in-Html 로 만든 발표 자료
├── docs/                   스킬 본체(.skill) · SKILL.md · RULES.md · 남은 문제
├── google-apps-script.gs   ★ 제안 폼을 받을 구글 스크립트
├── DESIGN.md               ★ 이 사이트의 디자인 규칙 원본
├── SETUP.md                ★ 처음 설정 순서 (저장소·토큰·구글 시트)
└── README.md
```

> **처음 설정하는 중이라면 [SETUP.md](SETUP.md) 를 보세요.**
> 저장소 만들기 → `config.js` 채우기 → GitHub 토큰 발급 → 구글 시트 연결까지
> 클릭 경로와 함께 순서대로 적어 뒀습니다.

## 1. 로컬에서 보기

빌드가 없다. 다만 `fetch` 로 JSON·마크다운을 읽으므로 `file://` 로 열면 목록이 비어 보인다.
간단한 서버를 띄운다.

```bash
python -m http.server 8080
```

그다음 <http://localhost:8080> 을 연다.

## 2. GitHub Pages 로 배포하기

이 폴더의 **내용을** 저장소 루트에 올린다 (`index.html` 이 최상단에 있어야 한다).

```bash
git init
git add .
git commit -m "개인 사이트"
git branch -M main
git remote add origin https://github.com/<계정>/<저장소>.git
git push -u origin main
```

저장소 → **Settings → Pages** → Source `Deploy from a branch`, Branch `main` / `(root)`.
1~2분 뒤 `https://<계정>.github.io/<저장소>/` 에서 열린다.
`.nojekyll` 이 들어 있어 Jekyll 전처리를 건너뛴다.

## 3. 설정 두 가지 (`assets/js/config.js`)

```js
window.SITE = {
  repo: '계정명/저장소이름',   // 관리 화면이 커밋할 곳
  branch: 'main',
  suggestEndpoint: '',        // 아래 4번에서 받은 주소
  ...
};
```

## 4. 수정 제안 → 구글 스프레드시트 연결

1. 구글 드라이브에서 **새 스프레드시트**를 만든다.
2. 확장 프로그램 → **Apps Script** 를 열고, 코드를 전부 지운 뒤
   저장소의 [`google-apps-script.gs`](google-apps-script.gs) 내용을 붙여넣는다.
3. **배포 → 새 배포 → 웹 앱**, 실행: **나**, 액세스: **모든 사용자** → 배포 → 권한 승인.
4. 나온 웹 앱 주소를 `config.js` 의 `suggestEndpoint` 에 붙여넣고 커밋한다.

연결 전에는 폼이 "아직 연결 전"이라고 말하고 **내용 복사** 버튼을 띄운다 (쓴 글이 안 사라진다).

## 5. 글·프로젝트 쓰기 (`/admin.html`)

서버가 없어서 로그인을 만들 수 없다. 대신 **GitHub 개인 토큰**으로 저장소에 직접 쓴다.

**토큰 만들기** — GitHub → Settings → Developer settings → **Fine-grained tokens** →
Repository access 에서 **이 저장소 하나만** 고르고, Permissions 에서
**Contents: Read and write** 만 켠다. 만료일은 짧게.

**쓰는 법**

| 하는 일 | 결과 |
|---|---|
| 새 글 (공개) | `content/posts/<이름>.md` + `data/posts.json` 에 커밋 → 1~2분 뒤 사이트에 뜸 |
| 새 글 (비공개) | **저장소로 안 감.** 이 브라우저에만 저장 → "비공개 일기" 탭에서만 보임 |
| 새 프로젝트 | `content/projects/<이름>.md` + `data/projects.json` 에 커밋 |
| 같은 이름으로 다시 저장 | 덮어쓰기(= 수정) |
| 지우기 | 아직 관리 화면에 없음. 저장소에서 `.md` 를 지우고 json 에서 그 줄을 뺀다 |

**주의**

- 토큰은 이 브라우저에만 있고 GitHub 외에는 어디로도 안 간다. **공용 컴퓨터에서 쓰지 말 것.**
- 다 쓰면 **토큰 지우기**를 누른다.
- 비공개 글은 브라우저 저장 공간을 비우면 사라진다. 오래 둘 글은 **`.md` 로 내려받아** 보관한다.

## 6. 사이트 조작

| 키 · 버튼 | 동작 |
|---|---|
| <kbd>P</kbd> | 발표 모드 (프로젝트 상세) — 진행 막대와 `03 / 09` 표시 |
| <kbd>←</kbd> <kbd>→</kbd> | 발표 모드에서 절 단위 이동 |
| <kbd>Esc</kbd> | 발표 모드 끄기 |
| 라이트 / 다크 버튼 | 테마 전환 (선택이 저장된다) |
| 06절 필터 칩 | 변화 이력을 유형별로 추림 |

## 7. 만들 때 지킨 것

- **외부 스크립트 0개.** 마크다운 변환기까지 직접 만들었다 (웹폰트 CSS 하나만 CDN)
- **JS 없이도 읽힌다.** 직접 쓴 페이지의 본문은 HTML 에 그대로 있다
- **172KB 덱은 누르기 전까지 안 불러온다**
- **색을 지어내지 않았다.** 무채색 — Slides-in-Html 스킬이 정한 규칙을 사이트에도 적용했다.
  프로젝트 페이지 푸터에서 **이 페이지 자신의 명도 대비를 계산해 보여 준다**

근거는 [DESIGN.md](DESIGN.md) 에 전부 적혀 있다.

## 8. 참고 · 출처

이 사이트의 시각 언어(무채색 · 머리카락 선 · 좁은 본문 단 · 짧은 전이 · 커서에 반응하는 첫 화면)는
[nafisazizir.com](https://www.nafisazizir.com/) 의 **설계 원리**를 참고해 다시 구성했다.
문구 · 이미지 · 화면 구성은 옮기지 않았고, 첫 화면 그림도 방식이 다르다(저쪽은 WebGL 셰이더,
이쪽은 2D 점 격자). 무엇을 가져오고 무엇을 가져오지 않았는지는 DESIGN.md 1장에 적어 뒀다.
