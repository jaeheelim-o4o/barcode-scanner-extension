/**
 * Barcode Scanner Extension — Popup Script
 *
 * 사용자 입력 처리 → content script에 SCAN_BARCODE 메시지 전송
 */

const barcodeInput = document.getElementById('barcode-input');
const delaySlider = document.getElementById('delay-slider');
const delayValue = document.getElementById('delay-value');
const scanBtn = document.getElementById('scan-btn');
const statusEl = document.getElementById('status');

// 딜레이 슬라이더 표시 업데이트
delaySlider.addEventListener('input', () => {
  delayValue.textContent = `${delaySlider.value}ms`;
});

// textarea에서 Enter 키 → 스캔 실행 (Shift+Enter는 줄바꿈)
barcodeInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    triggerScan();
  }
});

// 스캔 버튼 클릭
scanBtn.addEventListener('click', () => {
  triggerScan();
});

async function triggerScan() {
  const rawValue = barcodeInput.value;
  // 첫 번째 줄만 사용 (여러 줄 붙여넣기 방어)
  const barcode = rawValue.split('\n')[0].trim();

  if (!barcode) {
    showStatus('바코드를 입력해주세요.', 'warning');
    return;
  }

  setLoading(true);
  clearStatus();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      showStatus('❌ 활성 탭을 찾을 수 없습니다.', 'error');
      return;
    }

    const delay = parseInt(delaySlider.value, 10);

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'SCAN_BARCODE',
      barcode,
      delay,
    });

    if (response?.success) {
      showStatus(`✅ 스캔 완료! (${barcode})`, 'success');
      barcodeInput.value = '';
      // 1.5초 후 상태 초기화
      setTimeout(() => {
        clearStatus();
        barcodeInput.focus();
      }, 1500);
    } else {
      showStatus(`❌ 실패: ${response?.error ?? '알 수 없는 오류'}`, 'error');
    }
  } catch (err) {
    // content script가 아직 로드되지 않은 경우 등
    const msg = err.message?.includes('Could not establish connection')
      ? '페이지를 새로고침 후 다시 시도해주세요.'
      : err.message ?? '알 수 없는 오류';
    showStatus(`❌ ${msg}`, 'error');
  } finally {
    setLoading(false);
  }
}

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
}

function clearStatus() {
  statusEl.textContent = '';
  statusEl.className = 'status hidden';
}

function setLoading(isLoading) {
  scanBtn.disabled = isLoading;
  scanBtn.textContent = isLoading ? '전송 중...' : '스캔';
}
