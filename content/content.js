/**
 * Barcode Scanner Extension — Content Script
 *
 * 팝업에서 바코드를 받아 실제 키보드 이벤트로 dispatch합니다.
 * Playwright keyboard.type과 동일하게:
 *   각 문자 → keydown → keypress → keyup (30ms 간격)
 *   마지막 → Enter keydown/keypress/keyup
 */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'SCAN_BARCODE') return;

  const { barcode, delay } = message;
  typeBarcode(barcode, delay)
    .then(() => sendResponse({ success: true }))
    .catch((err) => sendResponse({ success: false, error: err.message }));

  // 비동기 응답을 위해 true 반환
  return true;
});

/**
 * 바코드 문자열을 키보드 이벤트로 순서대로 dispatch
 */
async function typeBarcode(barcode, delay = 30) {
  const target = document.activeElement || document.body;

  for (const char of barcode) {
    dispatchKeyEvents(target, char);
    await sleep(delay);
  }

  // Enter 키
  await sleep(delay);
  dispatchKeyEvents(target, 'Enter');
}

/**
 * 단일 문자에 대해 keydown → keypress → keyup 이벤트 순서대로 dispatch
 */
function dispatchKeyEvents(target, char) {
  const isEnter = char === 'Enter';
  const key = isEnter ? 'Enter' : char;
  const code = isEnter ? 'Enter' : (char.length === 1 ? `Key${char.toUpperCase()}` : char);
  const keyCode = isEnter ? 13 : char.charCodeAt(0);

  const eventInit = {
    key,
    code,
    keyCode,
    which: keyCode,
    charCode: isEnter ? 13 : keyCode,
    bubbles: true,
    cancelable: true,
    composed: true,
  };

  target.dispatchEvent(new KeyboardEvent('keydown', eventInit));
  if (!isEnter) {
    target.dispatchEvent(new KeyboardEvent('keypress', { ...eventInit, charCode: keyCode }));
  } else {
    target.dispatchEvent(new KeyboardEvent('keypress', { ...eventInit, charCode: 13 }));
  }
  target.dispatchEvent(new KeyboardEvent('keyup', eventInit));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
