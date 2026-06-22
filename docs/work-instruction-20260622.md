# 작업지시서 — Barcode Scanner Chrome/Edge Extension

- **작성일**: 2026-06-22
- **작성자**: Claude (재희님 요청)
- **프로젝트 위치**: `~/Claude/barcode-scanner-extension/`
- **연관 프로젝트**: 없음 (o4o-qa-automation과 완전 독립)

---

## 1. 배경 및 목적

셀포스(Self-POS) 테스트 시 바코드를 직접 타이핑하는 작업이 반복적으로 발생한다.  
현재 자동화 코드(`scanBarcodeByKeyboard`)는 Playwright를 통해 키보드 이벤트를 시뮬레이션하지만,  
**수동 테스트 환경에서는 동일한 방법을 사용할 수 없다.**

크롬/엣지 확장 프로그램 팝업에 바코드를 붙여넣으면 → 현재 탭에 키보드 이벤트로 자동 입력되어 상품 스캔이 완료되도록 한다.

---

## 2. 기술 스택

| 항목 | 내용 |
|------|------|
| 확장 표준 | Manifest V3 (Chrome / Edge 공통) |
| 언어 | Vanilla JS (의존성 없음) |
| 권한 | `activeTab`, `scripting` |
| 구동 브라우저 | Google Chrome, Microsoft Edge (Chromium 기반) |

---

## 3. 파일 구조

```
barcode-scanner-extension/
├── manifest.json              # 확장 프로그램 설정 (Manifest V3)
├── popup/
│   ├── popup.html             # 팝업 UI
│   ├── popup.css              # 팝업 스타일
│   └── popup.js               # 입력 처리 → content script 메시지 전송
├── content/
│   └── content.js             # 키보드 이벤트 dispatch (페이지에 주입)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── docs/
    └── work-instruction-20260622.md  # 이 파일
```

---

## 4. 구현 상세

### 4-1. manifest.json (완료)
- Manifest V3
- `content_scripts`: 모든 URL에 content.js 주입
- `action`: 툴바 버튼 클릭 시 popup.html 열기

### 4-2. content/content.js (완료)
- `chrome.runtime.onMessage` 리스너 등록
- `SCAN_BARCODE` 메시지 수신 시 `typeBarcode()` 실행
- 각 문자 → `keydown` → `keypress` → `keyup` (30ms 간격)
- 마지막 → `Enter` 이벤트
- `document.activeElement || document.body` 에 이벤트 dispatch

### 4-3. popup/popup.html (TODO)
- 바코드 입력 `<textarea>` (붙여넣기 지원)
- "스캔" 버튼
- 상태 메시지 표시 영역 (성공/실패)
- 딜레이 설정 슬라이더 (기본 30ms)

### 4-4. popup/popup.css (TODO)
- 깔끔한 미니멀 UI
- 너비 320px 팝업

### 4-5. popup/popup.js (TODO)
- 입력값 trim 후 빈값 체크
- `chrome.tabs.sendMessage(tabId, { type: 'SCAN_BARCODE', barcode, delay })`
- 성공/실패 피드백 표시

### 4-6. icons/ (TODO)
- Canvas API로 프로그래매틱 생성 (16×16, 48×48, 128×128)
- 바코드 심볼 아이콘

---

## 5. 동작 흐름

```
[사용자]
  바코드 복사 → 확장 아이콘 클릭 → 팝업 열림
  → textarea에 붙여넣기 → "스캔" 버튼 클릭 (또는 Enter)

[popup.js]
  → chrome.tabs.query({ active: true }) 로 현재 탭 ID 조회
  → chrome.tabs.sendMessage(tabId, { type: 'SCAN_BARCODE', barcode, delay })

[content.js — 셀포스 페이지에 주입됨]
  → 메시지 수신
  → document.activeElement || document.body 에 키보드 이벤트 dispatch
  → 각 문자 30ms 간격으로 keydown/keypress/keyup
  → 마지막 Enter 이벤트

[셀포스 앱]
  → 바코드 인식 → 상품 스캔 완료
```

---

## 6. 설치 방법 (완료 후)

### Chrome
1. `chrome://extensions` 접속
2. 우측 상단 "개발자 모드" 활성화
3. "압축 해제된 확장 프로그램 로드" 클릭
4. `~/Claude/barcode-scanner-extension/` 폴더 선택

### Edge
1. `edge://extensions` 접속
2. 좌측 하단 "개발자 모드" 활성화
3. "압축을 푼 항목 로드" 클릭
4. `~/Claude/barcode-scanner-extension/` 폴더 선택

---

## 7. 작업 순서

- [x] Task 1: 디렉토리 구조 생성
- [x] Task 2: `manifest.json` 작성
- [x] Task 3: `content/content.js` 작성
- [x] Task 4: `popup/popup.html` 작성
- [x] Task 5: `popup/popup.css` 작성
- [x] Task 6: `popup/popup.js` 작성
- [x] Task 7: `icons/` 아이콘 생성 (Python으로 프로그래매틱 생성)
- [ ] Task 8: 브라우저에 설치 후 동작 확인 (사용자 직접 진행)

---

## 8. 주의사항

- 이 프로젝트는 o4o-qa-automation과 완전히 독립된 프로젝트이다.
- git 저장소를 별도로 초기화하지 않아도 되지만, 필요 시 생성 가능.
- 아이콘 파일이 없으면 확장 프로그램 로드 시 경고가 발생할 수 있으므로 반드시 포함한다.
