# Slides-in-Html — 제작 기록 사이트

PPTX의 폰트 깨짐을 없앤 **단일 HTML 슬라이드 생성 스킬**의 제작 기록을 담은 정적 웹사이트.
스킬이 무엇을 하는지, 어떤 판단을 거쳐 지금 모습이 됐는지(결정 66건),
그리고 아직 못 고친 것(13건)까지 그대로 공개한다.

> 더큰내일교육센터 · AI 취업역량강화 과정 과제 발표용

## 파일 구성

```
.
├── index.html          사이트 전체 (내용이 전부 여기 들어 있다)
├── style.css           디자인 구현 — 기준은 DESIGN.md
├── main.js             테마·필터·발표 모드·자기 검사 (없어도 사이트는 읽힌다)
├── favicon.svg
├── DESIGN.md           이 사이트의 디자인 규칙 원본 ★
├── deck/
│   └── slides-in-html-deck.html    이 스킬로 만든 발표 자료 (10장)
└── docs/
    ├── slides-in-html.skill        스킬 본체 (zip)
    ├── SKILL.md                    AI가 읽고 따르는 작업 절차
    ├── RULES.md                    사람이 읽는 참조서 + 결정 이력 66건 원본
    └── remaining-issues.md         아직 못 고친 13가지
```

## 로컬에서 보기

정적 파일뿐이라 빌드가 없다. `index.html` 을 그대로 열어도 되지만,
덱 iframe 이 `file://` 에서 막히는 브라우저가 있으므로 간단한 서버를 띄우는 쪽이 확실하다.

```bash
python -m http.server 8080
```

그다음 <http://localhost:8080> 을 연다.

## GitHub Pages 로 배포하기

1. 이 폴더의 **내용을** 새 저장소의 루트에 올린다 (`index.html` 이 저장소 최상단에 있어야 한다).

```bash
git init
git add .
git commit -m "Slides-in-Html 제작 기록 사이트"
git branch -M main
git remote add origin https://github.com/<계정>/<저장소>.git
git push -u origin main
```

2. 저장소 → **Settings → Pages** → Source 를 `Deploy from a branch`,
   Branch 를 `main` / `(root)` 로 지정한다.
3. 1~2분 뒤 `https://<계정>.github.io/<저장소>/` 에서 열린다.

`.nojekyll` 이 들어 있어 Jekyll 전처리를 건너뛴다 (밑줄로 시작하는 파일이 사라지는 문제 방지).

## 사이트 조작

| 키 · 버튼 | 동작 |
|---|---|
| <kbd>P</kbd> | 발표 모드 켜기/끄기 — 진행 막대와 `03 / 08` 표시가 뜬다 |
| <kbd>←</kbd> <kbd>→</kbd> | 발표 모드에서 절 단위 이동 |
| <kbd>Esc</kbd> | 발표 모드 끄기 |
| 왼쪽 레일 / 상단 `목차` | 절 이동 |
| `라이트` / `다크` 버튼 | 테마 전환 (선택이 저장된다) |
| 06절 필터 칩 | 변화 이력을 유형별로 추림 |

## 만들 때 지킨 것

- **JS 없이도 전부 읽힌다.** 내용은 HTML 에 그대로 있고, JS 는 필터·발표 모드·자기 검사만 한다
- **요청 수를 줄였다.** CSS 1개 · JS 1개 · 이미지 0개. 프레임워크·아이콘 폰트·분석 스크립트 없음
- **172KB 짜리 덱은 누르기 전까지 불러오지 않는다** (지연 로딩)
- **사이트가 스킬의 규칙을 그대로 지킨다.** 무채색, 웨이트 600, 그림자·아이콘 없음,
  `word-break:keep-all`, WCAG 대비 기준 — 푸터에서 **이 페이지 자신의 대비를 계산해 보여 준다**

자세한 근거는 [DESIGN.md](DESIGN.md) 에 있다.

## 참고 · 출처

이 사이트의 시각 언어(무채색 · 머리카락 선 · 좁은 본문 단 · 짧은 전이)는
[nafisazizir.com](https://www.nafisazizir.com/) 의 설계 원리를 참고해 다시 구성했다.
문구 · 이미지 · 화면 구성은 옮기지 않았다. 무엇을 가져오고 무엇을 가져오지 않았는지는
DESIGN.md 1장에 적혀 있다.
