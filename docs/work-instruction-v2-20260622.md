# 작업지시서 v2 — Barcode Scanner Extension 기능 확장

- **작성일**: 2026-06-22
- **참조 설계서**: design-v2-20260622.md

---

## Task 1: manifest.json 수정

`storage` 권한 추가.

```json
"permissions": ["activeTab", "scripting", "storage"]
```

---

## Task 2: data/stores.js 신규 생성

위키 파싱 결과를 JS 상수로 내장.

- PROD 매장 4개 (편집샵 / 스탠다드 / 29CM 판교 / 29CM 성수)
- 각 매장: `id`, `name`, `description`, `shopNo`, `localPosId`, `products[]`
- 각 상품: `name`, `uid`, `barcodes[]`

---

## Task 3: content/content.js 수정

`SET_LOCAL_STORAGE` / `GET_LOCAL_STORAGE` 메시지 처리 추가.

```js
case 'SET_LOCAL_STORAGE':
  localStorage.setItem(message.key, message.value);
  sendResponse({ success: true, value: message.value });
  break;
case 'GET_LOCAL_STORAGE':
  const val = localStorage.getItem(message.key);
  sendResponse({ success: true, value: val });
  break;
```

---

## Task 4: popup/popup.html 전면 개편

탭 3개 구조:
- 탭1 `tab-store`: 매장 선택 + local-pos-id 설정 + 상품 목록
- 탭2 `tab-scan`: 직접 입력 (기존 기능)
- 탭3 `tab-fav`: 즐겨찾기

---

## Task 5: popup/popup.css 업데이트

- 팝업 너비 360px로 확장
- 탭 네비게이션 스타일
- 상품 아코디언 스타일
- 즐겨찾기 카드 스타일
- 바코드 행 (바코드 텍스트 + 입력 버튼) 스타일

---

## Task 6: popup/popup.js 전면 개편

### 매장 탭 로직
1. `STORES` 데이터로 드롭다운 렌더링
2. 매장 선택 → local-pos-id 표시
3. `[설정하기]` 클릭 → `SET_LOCAL_STORAGE('local-pos-id', value)` 전송 → 현재 값 표시
4. 상품 아코디언 렌더링 (클릭으로 열기/닫기)
5. 바코드 `[입력]` 클릭 → `SCAN_BARCODE` 전송

### 즐겨찾기 탭 로직
1. `chrome.storage.local`에서 `favorites` 로드
2. `[+ 현재 매장 즐겨찾기 추가]` → 현재 선택 매장 저장
3. 즐겨찾기 목록 렌더링 (바코드별 `[입력]` 버튼)
4. `[✕]` 삭제 버튼

---

## Task 7: 브라우저 로드 테스트

1. Chrome `chrome://extensions` → 확장 프로그램 새로고침
2. 셀포스 페이지에서 매장 선택 테스트
3. local-pos-id 설정 확인 (DevTools → Application → Local Storage)
4. 바코드 입력 버튼 동작 확인
5. 즐겨찾기 추가/삭제 확인
6. Edge에서도 동일 확인
