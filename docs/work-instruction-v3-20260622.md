# 작업지시서 v3 — 커스텀 매장 관리 기능

- **작성일**: 2026-06-22
- **참조 설계서**: design-v3-20260622.md

---

## Task 1: customStores 저장소 함수 (popup.js)

기존 `loadFavorites` / `saveFavorites` 제거 → `loadCustomStores` / `saveCustomStores`로 대체.

```js
async function loadCustomStores() {
  return new Promise((resolve) =>
    chrome.storage.local.get('customStores', (d) => resolve(d.customStores ?? []))
  );
}
async function saveCustomStores(stores) {
  return new Promise((resolve) => chrome.storage.local.set({ customStores: stores }, resolve));
}
```

---

## Task 2: 드롭다운 통합 렌더링

`initStoreSelect()` 함수로 분리. 호출 시점: 초기화 + customStores 변경 후.

```
STORES (하드코딩) → 옵션 그룹 또는 상단 목록
<optgroup label="기본 매장">
  <option>무신사 편집샵 ...</option>
  ...
</optgroup>
<optgroup label="내 매장" id="custom-optgroup">
  <option data-custom-id="custom_xxx">⭐ 66-5 매장</option>
  ...
</optgroup>
```

---

## Task 3: "현재 매장 즐겨찾기 추가" → customStores에 저장

`addFavBtn` 클릭 시:
1. 탭 localStorage에서 `local-pos-id` 읽기
2. STORES 매칭 → 없으면 커스텀으로 `customStores`에 push
3. `initStoreSelect()` 재호출로 드롭다운 갱신
4. `즐겨찾기` 탭 UI 갱신

---

## Task 4: 커스텀 매장 이름 인라인 편집

드롭다운 선택 시 커스텀 매장이면 편집 버튼 노출.
편집 버튼 클릭 → `<input>`으로 전환 → 확인 버튼 → `saveCustomStores` → 드롭다운 갱신.

---

## Task 5: 커스텀 매장 바코드 수동 추가/삭제

매장 선택 (커스텀) 시 상품 목록 하단에 `[+ 바코드 추가]` 버튼 노출.
클릭 → 인라인 폼 (상품명 입력, 바코드 입력, 추가/취소 버튼).
추가 → `customStores` 해당 매장의 `products`에 push → 상품 목록 재렌더링.
상품/바코드 `[삭제]` 버튼 → `customStores`에서 제거.

---

## Task 6: 즐겨찾기 탭 → customStores 기반으로 교체

기존 `favorites` 사용 코드 제거.
`즐겨찾기` 탭은 `customStores` 목록을 카드 형태로 보여주는 것으로 교체.
(중복 제거 — 매장 탭과 동일 데이터 소스 사용)

---

## Task 7: 커스텀 매장 삭제

즐겨찾기 탭 카드의 `[✕]` → `customStores`에서 제거 → 드롭다운 갱신.
