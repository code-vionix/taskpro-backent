# Task Activity Monitoring System - Implementation Summary

## Overview
Implemented a comprehensive activity monitoring system that tracks user behavior during tasks, including tab switches, window focus changes, and URL visits.

## Features Implemented

### 1. Backend Changes

#### Database Schema (`prisma/schema.prisma`)
- Changed `violationLogs` to `activityLogs` with enhanced structure
- Now stores: `{ type, timestamp, url?, duration? }`
- Supports tracking URLs and duration of away time

#### API Endpoints (`tasks.controller.ts`)
- Updated endpoint: `PATCH /tasks/:id/activity`
- Accepts: `{ type: string, url?: string, duration?: number }`
- Logs all user activity during task execution

#### Service Layer (`tasks.service.ts`)
- New method: `logActivity(taskId, userId, type, url?, duration?)`
- Tracks focus losses only for BLUR/SWITCH events
- Stores detailed activity logs with URLs and durations

### 2. Frontend Changes

#### Enhanced Monitoring Hook (`useTaskMonitor.js`)
- Tracks window blur/focus events
- Tracks tab visibility changes
- Logs current page URL
- Calculates and logs duration of away time
- Cooldown mechanism to prevent spam

#### Admin Activity Monitor Component (`TaskActivityMonitor.jsx`)
- Real-time activity log viewer
- Auto-refreshes every 5 seconds
- Shows:
  - Activity type (TAB_SWITCH, WINDOW_BLUR, URL_VISIT, etc.)
  - Timestamp
  - URL visited (clickable link)
  - Duration away (formatted as minutes/seconds)
- Color-coded events:
  - Red: Distractions (BLUR, SWITCH)
  - Green: Returns (FOCUS, RETURN)
  - Blue: URL visits

#### Task Detail Page (`TaskDetail.jsx`)
- Integrated TaskActivityMonitor for admin users
- Shows in sidebar for easy monitoring
- Only visible to users with ADMIN role

### 3. Chrome Extension

Created a complete Chrome extension for advanced URL tracking:

#### Files Created:
1. **manifest.json** - Extension configuration
2. **background.js** - Service worker for tab monitoring
3. **popup.html** - User interface
4. **popup.js** - Control logic
5. **content.js** - Page interaction
6. **README.md** - Installation instructions

#### Extension Features:
- Tracks all tab switches
- Logs every URL visit
- Works in background
- Automatically sends data to backend
- Start/Stop monitoring control
- Persistent state across browser restarts

#### How to Install:
1. Open Chrome: `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `chrome-extension` folder
5. Extension is ready to use

#### How to Use:
1. Log in to task platform
2. Open a task detail page
3. Click extension icon
4. Click "Start Monitoring"
5. Extension tracks all activity
6. Click "Stop Monitoring" when done

## Activity Types Logged

1. **WINDOW_BLUR** - User clicked outside browser window
2. **WINDOW_FOCUS** - User returned to browser window
3. **TAB_SWITCH** - User switched to different tab
4. **TAB_RETURN** - User returned to task tab
5. **URL_VISIT** - User navigated to new URL (extension only)
6. **TAB_ACTIVATED** - User activated a tab (extension only)

## Data Structure

```json
{
  "type": "TAB_SWITCH",
  "timestamp": "2026-02-06T11:15:30.123Z",
  "url": "https://example.com/page",
  "duration": 45
}
```

## Admin View

Admins can now see:
- Real-time activity feed
- Exact URLs visited
- Time spent away from task
- Pattern of distractions
- Complete audit trail

## Privacy & Security

- Only tracks when task is IN_PROGRESS
- Requires user authentication
- Extension requires explicit user activation
- All data sent to secure backend
- URLs only logged when extension is active

## Testing

1. Start a task as a user
2. Switch tabs or minimize window
3. Return to task
4. Admin can view activity in real-time
5. Install extension for URL tracking
6. Visit different websites
7. Admin sees complete browsing history

## Future Enhancements

Possible additions:
- Screenshot capture on tab switch
- Keystroke logging (if required)
- Application usage tracking (desktop app needed)
- AI-based distraction analysis
- Productivity scoring
- Automated alerts for excessive distractions

## Notes

- Chrome Extension is optional but provides most detailed tracking
- Basic monitoring works without extension
- Extension requires manual installation by each user
- Icons for extension need to be created (see ICONS_README.md)
