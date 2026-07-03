@echo off
setlocal

cd /d "%~dp0"
set PYTHONUTF8=1
set FLASK_ENV=development

echo ============================================
echo   Banana Slides backend starting...
echo   URL: http://localhost:5011
echo   Close this window to stop the backend.
echo ============================================
echo.

where uv >nul 2>nul
if errorlevel 1 (
    echo uv was not found. Please install uv first:
    echo https://docs.astral.sh/uv/getting-started/installation/
    pause
    exit /b 1
)

echo Syncing Python dependencies with the pinned Python version...
call uv sync
if errorlevel 1 (
    echo Failed to sync backend dependencies.
    echo If the error mentions Python 3.14, run: uv python install 3.12
    pause
    exit /b 1
)

cd backend

echo Applying database migrations...
call uv run alembic upgrade head
if errorlevel 1 (
    echo Failed to apply database migrations.
    pause
    exit /b 1
)

echo Starting backend server...
call uv run python app.py
echo.
echo Backend server exited.
pause
