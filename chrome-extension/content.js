// Content script to communicate with the page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_AUTH_TOKEN') {
    const token = localStorage.getItem('access_token');
    const apiUrl = window.location.origin.replace(/:\d+$/, ':5000');
    sendResponse({ token, apiUrl });
  }
  return true;
});

// Listen for extension check from webpage
window.addEventListener('message', (event) => {
  if (event.data.type === 'CHECK_EXTENSION') {
    window.postMessage({ type: 'EXTENSION_INSTALLED' }, '*');
  }
});

// Announce extension is installed on page load
window.postMessage({ type: 'EXTENSION_INSTALLED' }, '*');
