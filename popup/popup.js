/**
 * Barcode Scanner Extension — Popup Script v3
 *
 * 데이터 소스:
 *   STORES (data/stores.js) — 하드코딩된 기본 PROD 매장
 *   chrome.storage.local.customStores — 사용자가 추가한 커스텀 매장
 */

// ── 상태 ──────────────────────────────────────────────
let currentStore = null;      // 현재 선택된 매장 객체 (STORES | customStore)
let currentIsCustom = false;  // 커스텀 매장 여부

// ── 탭 전환 ──────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tabId = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');
    if (tabId === 'fav') renderFavTab();
  });
});

// ── 매장 드롭다운 ──────────────────────────────────────

const storeSelect    = document.getElementById('store-select');
const defaultOptgroup = document.getElementById('default-optgroup');
const customOptgroup  = document.getElementById('custom-optgroup');
const customEditRow  = document.getElementById('custom-edit-row');
const customNameInput = document.getElementById('custom-name-input');
const customNameSave  = document.getElementById('custom-name-save');
const customDeleteBtn = document.getElementById('custom-delete-btn');
const posInfo        = document.getElementById('pos-info');
const posIdValue     = document.getElementById('pos-id-value');
const posStatus      = document.getElementById('pos-status');
const setPosBtn      = document.getElementById('set-pos-btn');
const productList    = document.getElementById('product-list');
const productItems   = document.getElementById('product-items');
const addBarcodeArea = document.getElementById('add-barcode-area');
const showAddFormBtn = document.getElementById('show-add-form-btn');
const addBarcodeForm = document.getElementById('add-barcode-form');
const newProductName = document.getElementById('new-product-name');
const newBarcode     = document.getElementById('new-barcode');
const confirmAddBtn  = document.getElementById('confirm-add-btn');
const cancelAddBtn   = document.getElementById('cancel-add-btn');
const storeStatus    = document.getElementById('store-status');

async function initStoreSelect() {
  const customStores = await loadCustomStores();
  const prevVal = storeSelect.value;

  // select 전체 재구성 (optgroup에 동적 appendChild가 일부 환경에서 동작 안 함)
  storeSelect.innerHTML = '<option value="">-- 매장을 선택하세요 --</option>';

  const defaultGroup = document.createElement('optgroup');
  defaultGroup.label = '기본 매장';
  STORES.forEach((store) => {
    const opt = document.createElement('option');
    opt.value = `default:${store.id}`;
    opt.textContent = `${store.name} (shopNo: ${store.shopNo}) — ${store.description}`;
    defaultGroup.appendChild(opt);
  });
  storeSelect.appendChild(defaultGroup);

  if (customStores.length > 0) {
    const customGroup = document.createElement('optgroup');
    customGroup.label = '내 매장';
    customStores.forEach((store) => {
      const opt = document.createElement('option');
      opt.value = `custom:${store.id}`;
      opt.textContent = `⭐ ${store.name} (${store.localPosId})`;
      customGroup.appendChild(opt);
    });
    storeSelect.appendChild(customGroup);
  }

  // 이전 선택값 복원
  if (prevVal) storeSelect.value = prevVal;
}

storeSelect.addEventListener('change', async () => {
  const val = storeSelect.value;
  currentStore = null;
  currentIsCustom = false;
  clearStatus(storeStatus);
  posStatus.className = 'pos-status hidden';
  customEditRow.classList.add('hidden');
  addBarcodeArea.classList.add('hidden');
  addBarcodeForm.classList.add('hidden');

  if (!val) {
    posInfo.classList.add('hidden');
    productList.classList.add('hidden');
    return;
  }

  if (val.startsWith('default:')) {
    const storeId = val.replace('default:', '');
    currentStore = STORES.find((s) => s.id === storeId);
    currentIsCustom = false;
  } else if (val.startsWith('custom:')) {
    const storeId = val.replace('custom:', '');
    const customs = await loadCustomStores();
    currentStore = customs.find((s) => s.id === storeId);
    currentIsCustom = true;
    // 이름 편집 행 표시
    customNameInput.value = currentStore.name;
    customEditRow.classList.remove('hidden');
  }

  if (!currentStore) return;

  // local-pos-id 표시
  posIdValue.textContent = currentStore.localPosId;
  // 커스텀 매장만 pos-id 클릭 편집 가능
  if (currentIsCustom) {
    posIdValue.style.cursor = 'text';
    posIdValue.title = '클릭하여 편집';
    posIdValue.onclick = startPosIdEdit;
  } else {
    posIdValue.style.cursor = 'default';
    posIdValue.title = '';
    posIdValue.onclick = null;
  }
  posInfo.classList.remove('hidden');

  // 현재 탭 설정값 조회
  try {
    const res = await sendToTab({ type: 'GET_LOCAL_STORAGE', key: 'local-pos-id' });
    if (res?.success && res.value) {
      const isSame = res.value === currentStore.localPosId;
      showPosStatus(
        isSame ? `✅ 현재 설정값 일치 (${res.value})` : `현재 설정값: ${res.value}`,
        isSame ? 'success' : 'warning'
      );
    }
  } catch (_) {}

  // 상품 목록 렌더링
  renderProducts(currentStore.products ?? []);
  productList.classList.remove('hidden');

  // 커스텀 매장만 바코드 추가 버튼 표시
  if (currentIsCustom) addBarcodeArea.classList.remove('hidden');
});

// 이름 저장
customNameSave.addEventListener('click', async () => {
  if (!currentStore || !currentIsCustom) return;
  const newName = customNameInput.value.trim();
  if (!newName) return;
  const customs = await loadCustomStores();
  const idx = customs.findIndex((s) => s.id === currentStore.id);
  if (idx === -1) return;
  customs[idx].name = newName;
  await saveCustomStores(customs);
  currentStore = customs[idx];
  await initStoreSelect();
  storeSelect.value = `custom:${currentStore.id}`;
  showStatus(storeStatus, `✅ 이름 저장: ${newName}`, 'success');
});

// 커스텀 매장 삭제
customDeleteBtn.addEventListener('click', async () => {
  if (!currentStore || !currentIsCustom) return;
  if (!confirm(`"${currentStore.name}" 매장을 삭제할까요?`)) return;
  const customs = await loadCustomStores();
  await saveCustomStores(customs.filter((s) => s.id !== currentStore.id));
  currentStore = null;
  currentIsCustom = false;
  await initStoreSelect();
  storeSelect.value = '';
  posInfo.classList.add('hidden');
  productList.classList.add('hidden');
  customEditRow.classList.add('hidden');
});

// local-pos-id 설정
setPosBtn.addEventListener('click', async () => {
  if (!currentStore) return;
  setPosBtn.disabled = true;
  try {
    const res = await sendToTab({ type: 'SET_LOCAL_STORAGE', key: 'local-pos-id', value: currentStore.localPosId });
    if (res?.success) {
      showPosStatus(`✅ 설정 완료 (local-pos-id = ${currentStore.localPosId})`, 'success');
    } else {
      showPosStatus(`❌ 설정 실패: ${res?.error ?? '오류'}`, 'error');
    }
  } catch (err) {
    showPosStatus(`❌ ${friendlyError(err)}`, 'error');
  } finally {
    setPosBtn.disabled = false;
  }
});

// 상품 목록 렌더링
function renderProducts(products) {
  productItems.innerHTML = '';
  products.forEach((product, productIdx) => {
    const item = document.createElement('div');
    item.className = 'product-item';

    const header = document.createElement('div');
    header.className = 'product-header';

    // 상품명 요소 (커스텀 매장이면 클릭 편집 가능)
    const nameEl = document.createElement('span');
    nameEl.className = 'product-name';
    nameEl.textContent = product.name || '(이름 없음)';
    if (currentIsCustom) {
      nameEl.title = '클릭하여 이름 편집';
      nameEl.style.cursor = 'text';
      nameEl.addEventListener('click', (e) => {
        e.stopPropagation();
        startProductNameEdit(nameEl, productIdx);
      });
    }

    const chevron = document.createElement('span');
    chevron.className = 'product-chevron';
    chevron.textContent = '▶';

    const uidEl = document.createElement('span');
    uidEl.className = 'product-uid';
    uidEl.textContent = product.uid ? '#' + product.uid : '';

    header.appendChild(chevron);
    header.appendChild(nameEl);
    header.appendChild(uidEl);

    if (currentIsCustom) {
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-delete-product';
      delBtn.dataset.idx = productIdx;
      delBtn.textContent = '✕';
      header.appendChild(delBtn);
    }

    chevron.addEventListener('click', (e) => {
      e.stopPropagation();
      item.classList.toggle('open');
    });
    header.addEventListener('click', (e) => {
      if (!e.target.classList.contains('btn-delete-product') &&
          !e.target.classList.contains('product-name')) {
        item.classList.toggle('open');
      }
    });

    // 커스텀 매장 상품 삭제
    header.querySelector('.btn-delete-product')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const idx = parseInt(e.target.dataset.idx);
      const customs = await loadCustomStores();
      const storeIdx = customs.findIndex((s) => s.id === currentStore.id);
      if (storeIdx === -1) return;
      customs[storeIdx].products.splice(idx, 1);
      await saveCustomStores(customs);
      currentStore = customs[storeIdx];
      renderProducts(currentStore.products);
    });

    const barcodeContainer = document.createElement('div');
    barcodeContainer.className = 'product-barcodes';
    (product.barcodes ?? []).forEach((bc) => {
      barcodeContainer.appendChild(createBarcodeRow(bc));
    });

    item.appendChild(header);
    item.appendChild(barcodeContainer);
    productItems.appendChild(item);
  });
}

// 상품명 인라인 편집
function startProductNameEdit(nameEl, productIdx) {
  const original = nameEl.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = original === '(이름 없음)' ? '' : original;
  input.className = 'input input-sm product-name-input';
  input.style.flex = '1';
  nameEl.replaceWith(input);
  input.focus();
  input.select();

  async function save() {
    const newName = input.value.trim() || '(이름 없음)';
    const customs = await loadCustomStores();
    const storeIdx = customs.findIndex((s) => s.id === currentStore.id);
    if (storeIdx !== -1) {
      customs[storeIdx].products[productIdx].name = newName;
      await saveCustomStores(customs);
      currentStore = customs[storeIdx];
    }
    renderProducts(currentStore.products);
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') { input.replaceWith(nameEl); }
  });
  input.addEventListener('blur', save);
}

function createBarcodeRow(barcode) {
  const row = document.createElement('div');
  row.className = 'barcode-row';
  const text = document.createElement('span');
  text.className = 'barcode-text';
  text.textContent = barcode;
  const btn = document.createElement('button');
  btn.className = 'btn-scan-barcode';
  btn.textContent = '입력';
  btn.addEventListener('click', () => triggerScan(barcode, btn, storeStatus));
  row.appendChild(text);
  row.appendChild(btn);
  return row;
}

// 바코드 추가 폼
showAddFormBtn.addEventListener('click', () => {
  addBarcodeForm.classList.remove('hidden');
  showAddFormBtn.classList.add('hidden');
  newBarcode.focus();
});
cancelAddBtn.addEventListener('click', () => {
  addBarcodeForm.classList.add('hidden');
  showAddFormBtn.classList.remove('hidden');
  newProductName.value = '';
  newBarcode.value = '';
});
confirmAddBtn.addEventListener('click', async () => {
  const bc = newBarcode.value.trim();
  if (!bc) { newBarcode.focus(); return; }
  const name = newProductName.value.trim() || '(이름 없음)';

  const customs = await loadCustomStores();
  const storeIdx = customs.findIndex((s) => s.id === currentStore.id);
  if (storeIdx === -1) return;

  // 같은 상품명이 있으면 바코드만 추가, 없으면 새 상품
  const existProduct = customs[storeIdx].products.find((p) => p.name === name);
  if (existProduct) {
    if (!existProduct.barcodes.includes(bc)) existProduct.barcodes.push(bc);
  } else {
    customs[storeIdx].products.push({ name, uid: '', barcodes: [bc] });
  }
  await saveCustomStores(customs);
  currentStore = customs[storeIdx];

  renderProducts(currentStore.products);
  addBarcodeForm.classList.add('hidden');
  showAddFormBtn.classList.remove('hidden');
  newProductName.value = '';
  newBarcode.value = '';
});

// local-pos-id 인라인 편집 (커스텀 매장 전용)
function startPosIdEdit() {
  const original = currentStore.localPosId;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = original;
  input.className = 'input input-sm';
  input.style.cssText = 'flex:1; min-width:60px; max-width:100px;';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = '저장';
  saveBtn.className = 'btn-sm btn-primary';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '취소';
  cancelBtn.className = 'btn-sm btn-ghost';

  setPosBtn.classList.add('hidden');
  posIdValue.replaceWith(input);
  const posRow = posInfo.querySelector('.pos-row');
  posRow.appendChild(saveBtn);
  posRow.appendChild(cancelBtn);
  input.focus();
  input.select();

  function cancel() {
    input.replaceWith(posIdValue);
    saveBtn.remove();
    cancelBtn.remove();
    setPosBtn.classList.remove('hidden');
  }

  async function save() {
    const newPosId = input.value.trim();
    if (!newPosId) { cancel(); return; }

    const customs = await loadCustomStores();
    const idx = customs.findIndex((s) => s.id === currentStore.id);
    if (idx !== -1) {
      customs[idx].localPosId = newPosId;
      await saveCustomStores(customs);
      currentStore = customs[idx];
    }

    try {
      await sendToTab({ type: 'SET_LOCAL_STORAGE', key: 'local-pos-id', value: newPosId });
    } catch (_) {}

    await initStoreSelect();
    storeSelect.value = `custom:${currentStore.id}`;

    input.replaceWith(posIdValue);
    posIdValue.textContent = newPosId;
    saveBtn.remove();
    cancelBtn.remove();
    setPosBtn.classList.remove('hidden');
    showPosStatus(`✅ pos-id 변경 완료 (${newPosId})`, 'success');
  }

  saveBtn.addEventListener('click', save);
  cancelBtn.addEventListener('click', cancel);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') cancel();
  });
}

function showPosStatus(msg, type) {
  posStatus.textContent = msg;
  posStatus.className = `pos-status ${type}`;
}

// ── 탭 2: 직접 입력 ──────────────────────────────────

const barcodeInput = document.getElementById('barcode-input');
const delaySlider  = document.getElementById('delay-slider');
const delayValue   = document.getElementById('delay-value');
const scanBtn      = document.getElementById('scan-btn');
const scanStatus   = document.getElementById('scan-status');

delaySlider.addEventListener('input', () => {
  delayValue.textContent = `${delaySlider.value}ms`;
});
barcodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const bc = barcodeInput.value.split('\n')[0].trim();
    if (!bc) { showStatus(scanStatus, '바코드를 입력해주세요.', 'warning'); return; }
    triggerScan(bc, scanBtn, scanStatus, parseInt(delaySlider.value), () => { barcodeInput.value = ''; });
  }
});
scanBtn.addEventListener('click', () => {
  const bc = barcodeInput.value.split('\n')[0].trim();
  if (!bc) { showStatus(scanStatus, '바코드를 입력해주세요.', 'warning'); return; }
  triggerScan(bc, scanBtn, scanStatus, parseInt(delaySlider.value), () => { barcodeInput.value = ''; });
});

// ── 탭 3: 내 매장 ──────────────────────────────────

const addFavBtn = document.getElementById('add-fav-btn');
const favList   = document.getElementById('fav-list');
const favEmpty  = document.getElementById('fav-empty');
const favStatus = document.getElementById('fav-status');

addFavBtn.addEventListener('click', async () => {
  clearStatus(favStatus);
  addFavBtn.disabled = true;
  try {
    let detectedPosId = null;
    let targetStore = currentStore;

    const res = await sendToTab({ type: 'GET_LOCAL_STORAGE', key: 'local-pos-id' });
    if (res?.success && res.value) {
      detectedPosId = res.value;
      const matched = STORES.find((s) => s.localPosId === res.value);
      if (matched) targetStore = matched;
    }

    if (!detectedPosId && !targetStore) {
      showStatus(favStatus, '설정된 local-pos-id가 없고 매장도 선택되지 않았습니다.', 'warning');
      return;
    }

    const customs = await loadCustomStores();

    if (targetStore && !targetStore.isCustom) {
      // STORES에 있는 기본 매장 — 이미 드롭다운에 있으므로 커스텀으로 복사
      const exists = customs.find((s) => s.localPosId === targetStore.localPosId);
      if (exists) {
        showStatus(favStatus, `이미 내 매장에 있습니다: ${targetStore.name}`, 'warning');
        return;
      }
      customs.push({
        id: `custom_${Date.now()}`,
        isCustom: true,
        name: targetStore.name,
        description: targetStore.description ?? '',
        localPosId: targetStore.localPosId,
        products: targetStore.products.map((p) => ({ ...p, barcodes: [...p.barcodes] })),
      });
      await saveCustomStores(customs);
      await initStoreSelect();
      await renderFavTab();
      showStatus(favStatus, `✅ 내 매장 추가: ${targetStore.name} (${targetStore.localPosId})`, 'success');
    } else if (detectedPosId) {
      // 알 수 없는 local-pos-id → 이름만 저장
      const exists = customs.find((s) => s.localPosId === detectedPosId);
      if (exists) {
        showStatus(favStatus, `이미 내 매장에 있습니다: ${detectedPosId}`, 'warning');
        return;
      }
      customs.push({
        id: `custom_${Date.now()}`,
        isCustom: true,
        name: detectedPosId,
        description: '',
        localPosId: detectedPosId,
        products: [],
      });
      await saveCustomStores(customs);
      await initStoreSelect();
      await renderFavTab();
      showStatus(favStatus, `✅ 내 매장 추가: ${detectedPosId}`, 'success');
    }
  } catch (err) {
    showStatus(favStatus, `❌ ${friendlyError(err)}`, 'error');
  } finally {
    addFavBtn.disabled = false;
  }
});

async function renderFavTab() {
  const customs = await loadCustomStores();

  // 현재 설정된 local-pos-id 조회
  let currentPosId = null;
  try {
    const res = await sendToTab({ type: 'GET_LOCAL_STORAGE', key: 'local-pos-id' });
    if (res?.success) currentPosId = res.value;
  } catch (_) {}

  favList.innerHTML = '';
  if (customs.length === 0) {
    favEmpty.classList.remove('hidden');
    return;
  }
  favEmpty.classList.add('hidden');

  customs.forEach((store) => {
    const isActive = store.localPosId === currentPosId;
    const card = document.createElement('div');
    card.className = isActive ? 'fav-card active' : 'fav-card';

    const allBarcodes = (store.products ?? []).flatMap((p) =>
      (p.barcodes ?? []).map((bc) => ({ name: p.name, barcode: bc }))
    );

    const headerEl = document.createElement('div');
    headerEl.className = 'fav-card-header';
    headerEl.innerHTML = `
      <span class="fav-name">${store.name}</span>
      <span class="fav-pos-id">${store.localPosId}</span>
      ${isActive ? '<span class="fav-active-badge">현재 설정 중</span>' : `<button class="btn-sm btn-primary btn-set-pos-fav" data-pos="${store.localPosId}">설정</button>`}
      <button class="btn-delete-fav" data-id="${store.id}">✕</button>
    `;
    card.appendChild(headerEl);

    const barcodesEl = document.createElement('div');
    barcodesEl.className = 'fav-barcodes';
    if (allBarcodes.length === 0) {
      barcodesEl.innerHTML = '<span class="fav-no-barcode">바코드 없음 — 매장 탭에서 추가하세요</span>';
    } else {
      allBarcodes.forEach(({ name, barcode }) => {
        const row = document.createElement('div');
        row.className = 'barcode-row';
        row.innerHTML = `<span class="barcode-text" title="${name}">${barcode}</span>`;
        const btn = document.createElement('button');
        btn.className = 'btn-scan-barcode';
        btn.textContent = '입력';
        btn.addEventListener('click', () => triggerScan(barcode, btn, favStatus));
        row.appendChild(btn);
        barcodesEl.appendChild(row);
      });
    }
    card.appendChild(barcodesEl);

    headerEl.querySelector('.btn-set-pos-fav')?.addEventListener('click', async (e) => {
      const posId = e.target.dataset.pos;
      try {
        const r = await sendToTab({ type: 'SET_LOCAL_STORAGE', key: 'local-pos-id', value: posId });
        if (r?.success) {
          showStatus(favStatus, `✅ local-pos-id = ${posId} 설정 완료`, 'success');
          renderFavTab(); // 하이라이트 즉시 갱신
        } else {
          showStatus(favStatus, '❌ 설정 실패', 'error');
        }
      } catch (err) { showStatus(favStatus, `❌ ${friendlyError(err)}`, 'error'); }
    });

    headerEl.querySelector('.btn-delete-fav').addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      const updated = (await loadCustomStores()).filter((s) => s.id !== id);
      await saveCustomStores(updated);
      await initStoreSelect();
      renderFavTab();
    });

    favList.appendChild(card);
  });
}

// ── 공통 유틸 ──────────────────────────────────────

async function triggerScan(barcode, btn, statusEl, delay, onSuccess) {
  const d = delay ?? parseInt(delaySlider.value);
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '…';
  clearStatus(statusEl);
  try {
    const res = await sendToTab({ type: 'SCAN_BARCODE', barcode, delay: d });
    if (res?.success) {
      showStatus(statusEl, `✅ 스캔: ${barcode}`, 'success');
      onSuccess?.();
      setTimeout(() => clearStatus(statusEl), 2000);
    } else {
      showStatus(statusEl, `❌ 실패: ${res?.error ?? '오류'}`, 'error');
    }
  } catch (err) {
    showStatus(statusEl, `❌ ${friendlyError(err)}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = origText;
  }
}

async function sendToTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('활성 탭을 찾을 수 없습니다.');

  if (message.type === 'SET_LOCAL_STORAGE') {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (key, value) => { localStorage.setItem(key, value); return localStorage.getItem(key); },
      args: [message.key, message.value],
    });
    return { success: true, value: results[0]?.result };
  }
  if (message.type === 'GET_LOCAL_STORAGE') {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (key) => localStorage.getItem(key),
      args: [message.key],
    });
    return { success: true, value: results[0]?.result };
  }
  return chrome.tabs.sendMessage(tab.id, message);
}

function showStatus(el, msg, type) {
  el.textContent = msg;
  el.className = `status ${type}`;
}
function clearStatus(el) {
  el.textContent = '';
  el.className = 'status hidden';
}
function friendlyError(err) {
  return err.message?.includes('Could not establish connection')
    ? '페이지를 새로고침 후 다시 시도해주세요.'
    : err.message ?? '알 수 없는 오류';
}

async function loadCustomStores() {
  if (!chrome?.storage?.local) return [];
  return new Promise((resolve) =>
    chrome.storage.local.get('customStores', (d) => resolve(d.customStores ?? []))
  );
}
async function saveCustomStores(stores) {
  if (!chrome?.storage?.local) return;
  return new Promise((resolve) => chrome.storage.local.set({ customStores: stores }, resolve));
}

// ── 초기화 ──────────────────────────────────────────
initStoreSelect();
