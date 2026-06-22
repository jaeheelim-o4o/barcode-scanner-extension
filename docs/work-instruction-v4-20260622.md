# 작업지시서 v4 — local-pos-id 편집 및 활성 표시

- **작성일**: 2026-06-22
- **참조 설계서**: design-v4-20260622.md

---

## Task 1: 커스텀 매장 localPosId 인라인 편집 (popup.js)

### 1-1. pos-info 영역 DOM 구조 변경

기존 `posIdValue`(span)를 클릭하면 편집 모드로 전환.

**편집 전**:
```html
<span id="pos-id-value" class="pos-value" title="클릭하여 편집">66-5</span>
<button id="set-pos-btn" ...>설정하기</button>
```

**편집 중** (커스텀 매장에서 span 클릭 시):
```html
<input id="pos-id-edit" class="input input-sm" value="66-5" />
<button id="pos-id-save">저장</button>
<button id="pos-id-cancel">취소</button>
```

### 1-2. posIdValue 클릭 이벤트

`storeSelect` change 핸들러 내부에서 커스텀 매장 선택 시:
- `posIdValue.style.cursor = 'text'`
- `posIdValue.title = '클릭하여 편집'`
- `posIdValue.addEventListener('click', startPosIdEdit)`

기본 매장 선택 시:
- `posIdValue.style.cursor = 'default'`
- `posIdValue.title = ''`
- 기존 이벤트 리스너 제거 (replaceWith 패턴 사용)

### 1-3. startPosIdEdit 함수

```js
function startPosIdEdit() {
  const original = currentStore.localPosId;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = original;
  input.className = 'input input-sm';
  input.style.flex = '1';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = '저장';
  saveBtn.className = 'btn-sm btn-primary';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '취소';
  cancelBtn.className = 'btn-sm btn-ghost';

  // setPosBtn 숨기고 편집 UI 삽입
  setPosBtn.classList.add('hidden');
  posIdValue.replaceWith(input);

  const posRow = document.querySelector('.pos-row');
  posRow.appendChild(saveBtn);
  posRow.appendChild(cancelBtn);
  input.focus();
  input.select();

  async function save() {
    const newPosId = input.value.trim();
    if (!newPosId) { cancel(); return; }

    // customStores 업데이트
    const customs = await loadCustomStores();
    const idx = customs.findIndex((s) => s.id === currentStore.id);
    if (idx !== -1) {
      customs[idx].localPosId = newPosId;
      await saveCustomStores(customs);
      currentStore = customs[idx];
    }

    // localStorage 즉시 반영
    await sendToTab({ type: 'SET_LOCAL_STORAGE', key: 'local-pos-id', value: newPosId });

    // 드롭다운 갱신
    await initStoreSelect();
    storeSelect.value = `custom:${currentStore.id}`;

    // UI 복원
    input.replaceWith(posIdValue);
    posIdValue.textContent = newPosId;
    saveBtn.remove();
    cancelBtn.remove();
    setPosBtn.classList.remove('hidden');
    showPosStatus(`✅ pos-id 변경 완료 (${newPosId})`, 'success');
  }

  function cancel() {
    input.replaceWith(posIdValue);
    saveBtn.remove();
    cancelBtn.remove();
    setPosBtn.classList.remove('hidden');
  }

  saveBtn.addEventListener('click', save);
  cancelBtn.addEventListener('click', cancel);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') cancel();
  });
}
```

---

## Task 2: 내 매장 탭 활성 하이라이트 (popup.js + popup.css)

### 2-1. renderFavTab 수정

팝업 열릴 때 / [설정] 클릭 후 `local-pos-id` 조회하여 일치하는 카드 하이라이트.

```js
async function renderFavTab() {
  const customs = await loadCustomStores();
  let currentPosId = null;
  try {
    const res = await sendToTab({ type: 'GET_LOCAL_STORAGE', key: 'local-pos-id' });
    if (res?.success) currentPosId = res.value;
  } catch (_) {}

  favList.innerHTML = '';
  if (customs.length === 0) { favEmpty.classList.remove('hidden'); return; }
  favEmpty.classList.add('hidden');

  customs.forEach((store) => {
    const isActive = store.localPosId === currentPosId;
    const card = document.createElement('div');
    card.className = isActive ? 'fav-card active' : 'fav-card';
    // ... (기존 카드 렌더링)
    // 헤더에 활성 배지 추가
    if (isActive) {
      const badge = document.createElement('span');
      badge.className = 'fav-active-badge';
      badge.textContent = '현재 설정 중';
      header.insertBefore(badge, setBtn);
    }
    // 비활성 카드만 [설정] 버튼 표시
    setBtn.classList.toggle('hidden', isActive);
    // ...
  });
}
```

### 2-2. popup.css 추가 스타일

```css
/* 활성 카드 */
.fav-card.active .fav-card-header { background: #f0fdf4; }
.fav-active-badge {
  font-size: 10px; color: #15803d; font-weight: 600;
  background: #dcfce7; padding: 2px 6px; border-radius: 10px;
  white-space: nowrap;
}
```

---

## 변경 파일 요약

| 파일 | Task |
|------|------|
| `popup/popup.js` | Task 1 (pos-id 편집), Task 2 (renderFavTab 활성 표시) |
| `popup/popup.css` | Task 2 (`.fav-card.active`, `.fav-active-badge`) |
