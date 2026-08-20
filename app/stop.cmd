@echo off
rem Homeroom Workbench - stop the local service (console variant)
cd /d "%~dp0"
node wb.js stop
pause
