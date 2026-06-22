/**
 * Barcode Scanner Extension — Popup Script v2
 */

// ── 상태 ──────────────────────────────────────────────
let currentStore = null;

// ── 탭 전환 ──────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tabId = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${tabId}`).classList.add('active');

    if (tabId === 'fav') renderFavorites();
  });
});

// ── 탭 1: 매장 선택 ──────────────────────────────────

const storeSelect = document.getElementById('store-select');
const posInfo = document.getElementById('pos-info');
const posIdValue = document.getElementById('pos-id-value');
const posStatus = document.getElementById('pos-status');
const setPosBtn = document.getElementById('set-pos-btn');
const productList = document.getElementById('product-list');
const productItems = document.getElementById('product-items');
const storeStatus = document.getElementById('store-status');

// 매장 드롭다운 초기화
STORES.forEach((store) => {
  const opt = document.createElement('option');
  opt.value = store.id;
  opt.textContent = `${store.name} (shopNo: ${store.shopNo}) — ${store.description}`;
  storeSelect.appendChild(opt);
});

storeSelect.addEventListener('change', () => {
  const storeId = storeSelect.value;
  currentStore = STORES.find((s) => s.id === storeId) ?? null;

  clearStatus(storeStatus);
  posStatus.className = 'pos-status hidden';

  if (!currentStore) {
    posInfo.classList.add('hidden');
    productList.classList.add('hidden');
    return;
  }

  // local-pos-id 표시
  posIdValue.textContent = currentStore.localPosId;
  posInfo.classList.remove('hidden');

  // 현재 설정값 조회하여 표시
  sendToTab({ type: 'GET_LOCAL_STORAGE', key: 'local-pos-id' }).then((res) => {
    if (res?.success && res.value) {
      showPosStatus(`현재 설정값: ${res.value}`, res.value === currentStore.localPosId ? 'success' : 'warning');
    }
  });

  // 상품 목록 렌더링
  renderProducts(currentStore.products);
  productList.classList.remove('hidden');
});

// local-pos-id 설정 버튼
setPosBtn.addEventListener('click', async () => {
  if (!currentStore) return;
  setPosBtn.disabled = true;
  try {
    const res = await sendToTab({
      type: 'SET_LOCAL_STORAGE',
      key: 'local-pos-id',
      value: currentStore.localPosId,
    });
    if (res?.success) {
      showPosStatus(`✅ 설정 완료 (local-pos-id = ${currentStore.localPosId})`, 'success');
    } else {
      showPosStatus(`❌ 설정 실패: ${res?.error ?? '알 수 없는 오류'}`, 'error');
    }
  } catch (err) {
    showPosStatus(`❌ ${friendlyError(err)}`, 'error');
  } finally {
    setPosBtn.disabled = false;
  }
});

function renderProducts(products) {
  productItems.innerHTML = '';
  products.forEach((product) => {
    const item = document.createElement('div');
    item.className = 'product-item';

    const header = document.createElement('div');
    header.className = 'product-header';
    header.innerHTML = `
      <span class="product-chevron">▶</span>
      <span class="product-name">${product.name}</span>
      <span class="product-uid">#${product.uid}</span>
    `;
    header.addEventListener('click', () => item.classList.toggle('open'));

    const barcodeContainer = document.createElement('div');
    barcodeContainer.className = 'product-barcodes';
    product.barcodes.forEach((bc) => {
      const row = createBarcodeRow(bc);
      barcodeContainer.appendChild(row);
    });

    item.appendChild(header);
    item.appendChild(barcodeContainer);
    productItems.appendChild(item);
  });
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

function showPosStatus(msg, type) {
  posStatus.textContent = msg;
  posStatus.className = `pos-status ${type}`;
}

// ── 탭 2: 직접 입력 ──────────────────────────────────

const barcodeInput = document.getElementById('barcode-input');
const delaySlider = document.getElementById('delay-slider');
const delayValue = document.getElementById('delay-value');
const scanBtn = document.getElementById('scan-btn');
const scanStatus = document.getElementById('scan-status');

delaySlider.addEventListener('input', () => {
  delayValue.textContent = `${delaySlider.value}ms`;
});

barcodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const barcode = barcodeInput.value.split('\n')[0].trim();
    if (!barcode) { showStatus(scanStatus, '바코드를 입력해주세요.', 'warning'); return; }
    triggerScan(barcode, scanBtn, scanStatus, parseInt(delaySlider.value), () => { barcodeInput.value = ''; });
  }
});

scanBtn.addEventListener('click', () => {
  const barcode = barcodeInput.value.split('\n')[0].trim();
  if (!barcode) { showStatus(scanStatus, '바코드를 입력해주세요.', 'warning'); return; }
  triggerScan(barcode, scanBtn, scanStatus, parseInt(delaySlider.value), () => { barcodeInput.value = ''; });
});

// ── 탭 3: 즐겨찾기 ──────────────────────────────────

const addFavBtn = document.getElementById('add-fav-btn');
const favList = document.getElementById('fav-list');
const favEmpty = document.getElementById('fav-empty');
const favStatus = document.getElementById('fav-status');

addFavBtn.addEventListener('click', async () => {
  clearStatus(favStatus);
  addFavBtn.disabled = true;
  try {
    // 1순위: 현재 탭 localStorage의 local-pos-id
    let detectedPosId = null;
    let targetStore = currentStore;

    const res = await sendToTab({ type: 'GET_LOCAL_STORAGE', key: 'local-pos-id' });
    if (res?.success && res.value) {
      detectedPosId = res.value;
      const matched = STORES.find((s) => s.localPosId === res.value);
      if (matched) targetStore = matched;
    }

    // localStorage 값도 없고 매장 탭에서 선택한 매장도 없는 경우
    if (!detectedPosId && !targetStore) {
      showStatus(favStatus, '설정된 local-pos-id가 없고 매장도 선택되지 않았습니다.', 'warning');
      return;
    }

    const favs = await loadFavorites();

    if (targetStore) {
      // STORES에 있는 매장 — 상품 목록 포함
      const exists = favs.find((f) => f.storeId === targetStore.id);
      if (exists) {
        showStatus(favStatus, `이미 즐겨찾기에 있습니다: ${targetStore.name}`, 'warning');
        return;
      }
      favs.push({
        id: `fav_${Date.now()}`,
        storeId: targetStore.id,
        label: targetStore.name,
        localPosId: targetStore.localPosId,
        barcodes: targetStore.products.flatMap((p) =>
          p.barcodes.map((bc) => ({ name: p.name, barcode: bc }))
        ),
      });
      await saveFavorites(favs);
      await renderFavorites();
      showStatus(favStatus, `✅ 즐겨찾기 추가: ${targetStore.name} (${targetStore.localPosId})`, 'success');
    } else {
      // STORES에 없는 local-pos-id — ID만 저장 (local-pos-id 빠른 설정 용도)
      const exists = favs.find((f) => f.localPosId === detectedPosId);
      if (exists) {
        showStatus(favStatus, `이미 즐겨찾기에 있습니다: ${detectedPosId}`, 'warning');
        return;
      }
      favs.push({
        id: `fav_${Date.now()}`,
        storeId: null,
        label: detectedPosId,
        localPosId: detectedPosId,
        barcodes: [],
      });
      await saveFavorites(favs);
      await renderFavorites();
      showStatus(favStatus, `✅ 즐겨찾기 추가: ${detectedPosId}`, 'success');
    }
  } catch (err) {
    showStatus(favStatus, `❌ ${friendlyError(err)}`, 'error');
  } finally {
    addFavBtn.disabled = false;
  }
});

async function renderFavorites() {
  const favs = await loadFavorites();
  favList.innerHTML = '';
  if (favs.length === 0) {
    favEmpty.classList.remove('hidden');
    return;
  }
  favEmpty.classList.add('hidden');
  favs.forEach((fav) => {
    const card = document.createElement('div');
    card.className = 'fav-card';

    card.innerHTML = `
      <div class="fav-card-header">
        <span class="fav-name">${fav.label}</span>
        <span class="fav-pos-id">${fav.localPosId}</span>
        <button class="btn-sm btn-primary set-pos-fav" data-pos="${fav.localPosId}">설정</button>
        <button class="btn-delete-fav" data-id="${fav.id}">✕</button>
      </div>
      <div class="fav-barcodes"></div>
    `;

    const barcodesEl = card.querySelector('.fav-barcodes');
    fav.barcodes.forEach(({ name, barcode }) => {
      const row = document.createElement('div');
      row.className = 'barcode-row';
      row.innerHTML = `
        <span class="barcode-text" title="${name}">${barcode}</span>
      `;
      const btn = document.createElement('button');
      btn.className = 'btn-scan-barcode';
      btn.textContent = '입력';
      btn.addEventListener('click', () => triggerScan(barcode, btn, favStatus));
      row.appendChild(btn);
      barcodesEl.appendChild(row);
    });

    // local-pos-id 설정
    card.querySelector('.set-pos-fav').addEventListener('click', async (e) => {
      const posId = e.target.dataset.pos;
      try {
        const res = await sendToTab({ type: 'SET_LOCAL_STORAGE', key: 'local-pos-id', value: posId });
        if (res?.success) showStatus(favStatus, `✅ local-pos-id = ${posId} 설정 완료`, 'success');
        else showStatus(favStatus, `❌ 설정 실패`, 'error');
      } catch (err) { showStatus(favStatus, `❌ ${friendlyError(err)}`, 'error'); }
    });

    // 삭제
    card.querySelector('.btn-delete-fav').addEventListener('click', async (e) => {
      const id = e.target.dataset.id;
      const updated = (await loadFavorites()).filter((f) => f.id !== id);
      await saveFavorites(updated);
      renderFavorites();
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

  // localStorage 관련은 scripting.executeScript로 직접 실행 (content script 불필요)
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

  // SCAN_BARCODE는 content script 메시지 방식 유지
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

async function loadFavorites() {
  return new Promise((resolve) => {
    chrome.storage.local.get('favorites', (data) => resolve(data.favorites ?? []));
  });
}
async function saveFavorites(favs) {
  return new Promise((resolve) => chrome.storage.local.set({ favorites: favs }, resolve));
}
