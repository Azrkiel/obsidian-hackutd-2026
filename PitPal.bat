@echo off
rem Pit Pal one-click start (the desktop shortcut points here).
rem Starts the coach, the phone receiver and Rev, the overlay. Start Assetto Corsa first and get on track.
rem Rev shows a QR code: scan it with the Pit Pal app and he is ready.
rem Nemotron: if the Brev tunnel answers on localhost:8000 (brev port-forward nomadsim-h100 -p 8000:8000),
rem it is used automatically; otherwise NVIDIA_API_KEY / your own settings; with none the rules coach runs.
cd /d "%~dp0"
rem Game PC: uv's cache lives next to the repo (D:\uvcache is not writable for a normal account there).
if exist "%~dp0..\uv-cache\" set "UV_CACHE_DIR=%~dp0..\uv-cache"
rem A previous session still running (Rev quit, or a window left open) would block the ports: close it.
rem (the dashboard on TCP 8020, or a half-closed session still holding the phone port UDP 5005)
for /f "tokens=5" %%p in ('netstat -ano -p TCP ^| findstr /r /c:":8020 .*LISTENING"') do (
  echo Closing the previous Pit Pal session...
  taskkill /PID %%p /T /F >nul 2>&1
)
for /f "tokens=4" %%p in ('netstat -ano -p UDP ^| findstr /r /c:":5005 "') do (
  echo Closing the previous phone receiver...
  taskkill /PID %%p /T /F >nul 2>&1
)
set VOICE=auto
if defined NVIDIA_API_KEY set VOICE=nvidia
if not defined NEMOTRON_BASE_URL (
  curl.exe -s -m 3 -o nul http://localhost:8000/v1/models && (
    echo Nemotron tunnel found on localhost:8000: using the Brev H100.
    set NEMOTRON_BASE_URL=http://localhost:8000/v1
  )
)
if defined NEMOTRON_BASE_URL (
  if not defined NEMOTRON_BREV_MODEL set NEMOTRON_BREV_MODEL=nemotron
  if not defined NEMOTRON_MAX_TOKENS_THINK set NEMOTRON_MAX_TOKENS_THINK=3000
  if not defined ENGINE_THINK_DEADLINE_S set ENGINE_THINK_DEADLINE_S=15
  if not defined ENGINE_TOTAL_DEADLINE_S set ENGINE_TOTAL_DEADLINE_S=22
)
set "CLOUD_ARGS="
if exist "data\cloud\config.json" set "CLOUD_ARGS=--extra cloud"
if defined SPACETIMEDB_URL set "CLOUD_ARGS=--extra cloud"
uv run %CLOUD_ARGS% --with vgamepad --with pyserial python -m coach --telemetry ac --reset udp --inputs --track fixtures/track_monza.json --voice %VOICE% --overlay %*
if errorlevel 1 pause
