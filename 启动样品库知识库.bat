@echo off
setlocal
set "ROOT=%~dp0"
cd /d "%ROOT%"
set "LOGDIR=%ROOT%logs"
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
set "BOOTLOG=%LOGDIR%\launcher.log"
echo [%date% %time%] launcher start > "%BOOTLOG%"

REM Prefer bundled executable if present (PyInstaller build)
if exist "%ROOT%kitchen-lab-kb.exe" (
  echo Starting bundled executable... >> "%BOOTLOG%"
  start "" "%ROOT%kitchen-lab-kb.exe"
  exit /b 0
)

REM Fallback to Python runtime (development / source deployment)
python -c "import fastapi, uvicorn, webview, openpyxl" >nul 2>>"%BOOTLOG%"
if errorlevel 1 (
  echo Installing dependencies from local folder... >> "%BOOTLOG%"
  python -m pip install --no-index --find-links "%ROOT%dependencies" -r "%ROOT%requirements.txt" >> "%BOOTLOG%" 2>&1
  if errorlevel 1 (
    echo Dependency install failed. See logs\launcher.log.
    pause
    exit /b 1
  )
)

where pythonw >nul 2>nul
if errorlevel 1 (
  echo Starting with python.exe >> "%BOOTLOG%"
  start "" python "%ROOT%startup.py"
) else (
  echo Starting with pythonw.exe >> "%BOOTLOG%"
  start "" pythonw "%ROOT%startup.py"
)
endlocal
