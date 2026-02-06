// Background service worker for monitoring tab activity
let activeTaskId = null;
let monitoringEnabled = false;
let apiUrl = 'http://localhost:5000';
let authToken = null;

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_MONITORING') {
    activeTaskId = message.taskId;
    authToken = message.token;
    apiUrl = message.apiUrl || apiUrl;
    monitoringEnabled = true;
    chrome.storage.local.set({ activeTaskId, authToken, apiUrl, monitoringEnabled });
    sendResponse({ success: true });
  } else if (message.type === 'STOP_MONITORING') {
    activeTaskId = null;
    monitoringEnabled = false;
    chrome.storage.local.set({ monitoringEnabled: false });
    sendResponse({ success: true });
  } else if (message.type === 'GET_STATUS') {
    sendResponse({ monitoringEnabled, activeTaskId });
  }
  return true;
});

// Load saved state on startup
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(['activeTaskId', 'authToken', 'apiUrl', 'monitoringEnabled'], (result) => {
    if (result.monitoringEnabled) {
      activeTaskId = result.activeTaskId;
      authToken = result.authToken;
      apiUrl = result.apiUrl || apiUrl;
      monitoringEnabled = true;
    }
  });
});

// Track tab navigation
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (!monitoringEnabled || !activeTaskId || details.frameId !== 0) return;

  const tab = await chrome.tabs.get(details.tabId);
  
  // Log the URL visit
  logActivity('URL_VISIT', tab.url, 0);
});

// Track tab switches
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  if (!monitoringEnabled || !activeTaskId) return;

  const tab = await chrome.tabs.get(activeInfo.tabId);
  logActivity('TAB_ACTIVATED', tab.url, 0);
});

// Function to log activity to backend
async function logActivity(type, url, duration) {
  if (!activeTaskId || !authToken) return;

  try {
    await fetch(`${apiUrl}/tasks/${activeTaskId}/activity`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ type, url, duration })
    });
    console.log('[EXTENSION] Activity logged:', type, url);
  } catch (error) {
    console.error('[EXTENSION] Failed to log activity:', error);
  }
}
