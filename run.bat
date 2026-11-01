@echo off
cd /d "%~dp0"
if not exist .venv (
  echo Please run setup.bat first.
  pause
  exit /b 1
)
call .venv\Scripts\activate.bat
echo Starting server... your browser will open in a few seconds.
start "" cmd /c "timeout /t 8 /nobreak >nul & start http://127.0.0.1:8000"
python -m uvicorn api:app --reload
pause
