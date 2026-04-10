# src/dashboard — Browser SPA

## 구조

- `index.html` — 쉘. 탭 패널(`panel-review`, `panel-backend`, `panel-frontend`, `panel-features`, `panel-docs`, `panel-timeline`)
- `app.js` — 전체 SPA 로직 (vanilla JS, ~2100줄)
- `styles.css` — 다크 테마. CSS 변수: `--bg`, `--surface`, `--border`, `--text`, `--text-muted`, `--blue`, `--green`, `--orange`, `--red`

## 이슈 ID 패턴

```js
TAB_ID_PATTERNS = {
  review:   /^[a-z][-a-z0-9]*\d+$/,  // a1, rv-mon1, custom-review-11
  features: /^[a-z][-a-z0-9]*\d+$/,
  backend:  /^[a-z][-a-z0-9]*\d+$/,
  frontend: /^[a-z][-a-z0-9]*\d+$/,
}
```

H3 id 기준으로 이슈 식별. `injectIssueControls()`, `applyFilter()`, `getIssueIds()` 모두 이 패턴 사용.

## 관점 패널

탭 전환 시 `loadPerspectivesPanel(tab)` 자동 호출.
- `GET /perspectives?tab` + `GET /perspectives/active?tab` 병렬 호출
- locked 관점: disabled checkbox + 🔒 아이콘
- optional/custom: 토글 → `PUT /perspectives/:id/toggle`
- 커스텀 추가: `openAddPerspectiveModal(tab)` → `POST /perspectives`
- 삭제: `deleteCustomPerspective(id, tab)` → `DELETE /perspectives/:id`

## 모달/스타일 주입 패턴

diff modal, perspectives modal 모두 `(function injectXxxStyles() { ... })()` IIFE로 `<style>` 태그 동적 주입. 새 모달 추가 시 동일 패턴 사용.

## 분석 실행

`btn-analyze` 클릭 → active perspectives 조회 → `POST /analyze { tab, perspectiveIds }`.
