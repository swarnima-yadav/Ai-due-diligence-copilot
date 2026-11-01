@echo off
cd /d "%~dp0"
echo ===== Diligence AI - one-time setup =====
where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found. Install Python 3.10 or newer from python.org and tick "Add Python to PATH", then run this again.
  pause
  exit /b 1
)
if not exist .venv python -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
if not exist .env copy .env.example .env
echo.
echo Setup finished. Notepad will open your .env file.
echo Replace paste_your_key_here with your Gemini key, save the file, then double-click run.bat
notepad .env
pause
