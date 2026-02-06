// Popup script for extension control
const statusDiv = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');

// Check current monitoring status
chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
  updateUI(response.monitoringEnabled);
});

startBtn.addEventListener('click', async () => {
  // Get active tab to extract task info
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Check if user is on task detail page
  const taskIdMatch = tab.url.match(/\/task\/([a-f0-9-]+)/);
  
  if (!taskIdMatch) {
    alert('Please open a task detail page first!');
    return;
  }

  const taskId = taskIdMatch[1];
  
  // Get auth token from localStorage via content script
  chrome.tabs.sendMessage(tab.id, { type: 'GET_AUTH_TOKEN' }, (response) => {
    if (!response || !response.token) {
      alert('Please log in first!');
      return;
    }

    chrome.runtime.sendMessage({
      type: 'START_MONITORING',
      taskId: taskId,
      token: response.token,
      apiUrl: response.apiUrl
    }, () => {
      updateUI(true);
    });
  });
});

stopBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'STOP_MONITORING' }, () => {
    updateUI(false);
  });
});

function updateUI(isActive) {
  if (isActive) {
    statusDiv.textContent = 'Monitoring: ON';
    statusDiv.className = 'status active';
    startBtn.style.display = 'none';
    stopBtn.style.display = 'block';
  } else {
    statusDiv.textContent = 'Monitoring: OFF';
    statusDiv.className = 'status inactive';
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
  }
}
