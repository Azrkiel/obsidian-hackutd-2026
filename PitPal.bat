@echo off
rem Pit Pal one-click start (the desktop shortcut points here).
rem Starts the coach, the phone receiver and Rev, the overlay. Start Assetto Corsa first and get on track.
rem Rev shows a QR code: scan it with the Pit Pal app and he is ready.
rem Nemotron / voice settings come from your environment (see PC_SETUP.md); with none set the rules coach runs.
cd /d "%~dp0"
set VOICE=auto
if defined NVIDIA_API_KEY set VOICE=nvidia
uv run --with vgamepad --with pyserial python -m coach --telemetry ac --reset udp --inputs --track fixtures/track_monza.json --voice %VOICE% --overlay %*
if errorlevel 1 pause
