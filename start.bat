@echo off
chcp 65001 >nul
echo 🚀 Initializing Midjourney Factory Commander...

setlocal EnableDelayedExpansion

REM Find an available port (3001-3010)
set "PORT="
for %%p in (3001 3002 3003 3004 3005 3006 3007 3008 3009 3010) do (
    netstat -ano | findstr ":%%p" >nul 2>&1
    if errorlevel 1 (
        set "PORT=%%p"
        goto :found_port
    )
)

echo ❌ No free port found in 3001-3010
exit /b 1

:found_port
echo 📍 Using port %PORT%

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Python not found. Please install Python 3.9+ from https://python.org
    echo    Architect module (prompt generation) will not work without Python.
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Node.js not found. Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)

REM Ensure architect dependencies are available
set "ARCH_VENV=modules\architect\.venv"
set "ARCH_PY=%ARCH_VENV%\Scripts\python.exe"

if not exist "%ARCH_PY%" (
    echo 📦 Preparing Architect Python environment...
    python -m venv "%ARCH_VENV%"
)

"%ARCH_PY%" -c "import typer, yaml, rich, openai" >nul 2>&1
if errorlevel 1 (
    echo 📦 Installing Architect Python dependencies...
    "%ARCH_PY%" -m pip install -r modules\architect\requirements.txt
)
echo ✅ Architect environment ready

REM Install factory dependencies if not exists
if not exist "modules\factory\node_modules" (
    echo 📦 Installing Factory dependencies...
    cd "modules\factory"
    call npm install
    cd "..\.."
) else (
    echo ✅ Factory dependencies ready
)

REM Install Playwright browser if missing
if not exist "%USERPROFILE%\AppData\Local\ms-playwright" (
    if not exist "%LOCALAPPDATA%\ms-playwright" (
        echo 🌐 Installing Playwright Chromium...
        cd "modules\factory"
        call npx playwright install chromium
        cd "..\.."
    )
) else (
    echo ✅ Playwright browser ready
)

REM Install curator dependencies if not exists
if not exist "modules\curator\node_modules" (
    echo 📦 Installing Curator dependencies...
    cd "modules\curator"
    call npm install
    cd "..\.."
) else (
    echo ✅ Curator dependencies ready
)

REM Install commander dependencies if not exists
if not exist "modules\commander\node_modules" (
    echo 📦 Installing Commander dependencies...
    cd "modules\commander"
    call npm install
    cd "..\.."
) else (
    echo ✅ Commander dependencies ready
)

REM Kill any existing commander instances (best effort)
taskkill /F /FI "WINDOWTITLE eq *server.js*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq *next*" >nul 2>&1

echo.
echo 🕹️  Starting Commander Dashboard on http://localhost:%PORT%
echo    Press Ctrl+C to stop
echo.

REM Open browser
start http://localhost:%PORT%

REM Start Commander
cd "modules\commander"
set "PORT=%PORT%"
call npm run dev

endlocal
