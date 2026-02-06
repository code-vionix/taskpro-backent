@echo off
echo Creating Chrome Extension Package...
echo.

cd chrome-extension

echo Checking for required files...
if not exist manifest.json (
    echo ERROR: manifest.json not found!
    pause
    exit /b 1
)

if not exist background.js (
    echo ERROR: background.js not found!
    pause
    exit /b 1
)

echo.
echo All files found!
echo.
echo IMPORTANT: Before distributing, make sure you have created the icon files:
echo - icon16.png
echo - icon48.png  
echo - icon128.png
echo.
echo See ICONS_README.md for instructions.
echo.

pause

echo.
echo Extension is ready in the 'chrome-extension' folder!
echo.
echo To install:
echo 1. Open Chrome and go to chrome://extensions/
echo 2. Enable 'Developer mode' (toggle in top right)
echo 3. Click 'Load unpacked'
echo 4. Select the 'chrome-extension' folder
echo.
pause
