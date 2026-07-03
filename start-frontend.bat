@echo off
setlocal

cd /d "%~dp0frontend"

echo ============================================
echo   Banana Slides frontend starting...
echo   URL: http://localhost:3011
echo   Backend should be running at http://localhost:5011
echo   Close this window to stop the frontend.
echo ============================================
echo.

if exist "C:\Program Files\nodejs\npm.cmd" (
    set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"
) else (
    where npm.cmd >nul 2>nul
    if errorlevel 1 (
        echo npm.cmd was not found. Please install Node.js first.
        echo Download: https://nodejs.org/
        pause
        exit /b 1
    ) else (
        set "NPM_CMD=npm.cmd"
    )
)

if not exist "node_modules\" (
    echo Installing frontend dependencies...
    call "%NPM_CMD%" install
    if errorlevel 1 (
        echo Failed to install frontend dependencies.
        pause
        exit /b 1
    )
)

call "%NPM_CMD%" run dev
echo.
echo Frontend server exited.
pause
