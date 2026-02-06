# Task Monitor Chrome Extension

This Chrome extension tracks user browsing activity during active tasks.

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder

## Usage

1. Log in to your task management platform
2. Open a task detail page (URL should contain `/task/[task-id]`)
3. Click the extension icon in Chrome toolbar
4. Click "Start Monitoring"
5. The extension will now track all tab switches and URL visits
6. Click "Stop Monitoring" when done

## Features

- Tracks tab switches
- Logs all URL visits
- Automatically sends data to backend
- Works in background even when task page is not active

## Privacy

This extension only works when explicitly enabled by the user and only during active task sessions.
