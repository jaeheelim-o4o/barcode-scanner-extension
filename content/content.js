/**
 * Barcode Scanner Extension — Content Script v2
 *
 * 지원 메시지:
 *   SCAN_BARCODE      — 키보드 이벤트 dispatch (각 문자 keydown→keypress→keyup + Enter)
 *   SET_LOCAL_STORAGE — localStorage.setItem(key, value)
 *   GET_LOCAL_STORAGE — localStorage.getItem(key) 반환
 */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'SCAN_BARCODE':
      typeBarcode(message.barcode, message.delay ?? 30)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true; // 비동기 응답

    case 'SET_LOCAL_STORAGE':
      try {
        localStorage.setItem(message.key, message.value);
        sendResponse({ success: true, value: message.value });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      break;

    case 'GET_LOCAL_STORAGE':
      try {
        const val = localStorage.getItem(message.key);
        sendResponse({ success: true, value: val });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      break;
  }
});

async function typeBarcode(barcode, delay = 30) {
  const target = document.activeElement || document.body;
  for (const char of barcode) {
    dispatchKeyEvents(target, char);
    await sleep(delay);
  }
  await sleep(delay);
  dispatchKeyEvents(target, 'Enter');
}

function dispatchKeyEvents(target, char) {
  const isEnter = char === 'Enter';
  const key = isEnter ? 'Enter' : char;
  const code = isEnter ? 'Enter' : (char.length === 1 ? `Key${char.toUpperCase()}` : char);
  const keyCode = isEnter ? 13 : char.charCodeAt(0);

  const init = {
    key, code, keyCode, which: keyCode,
    charCode: isEnter ? 13 : keyCode,
    bubbles: true, cancelable: true, composed: true,
  };

  target.dispatchEvent(new KeyboardEvent('keydown', init));
  target.dispatchEvent(new KeyboardEvent('keypress', { ...init, charCode: isEnter ? 13 : keyCode }));
  target.dispatchEvent(new KeyboardEvent('keyup', init));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
