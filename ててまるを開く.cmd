@echo off
setlocal
py -3 -V >nul 2>&1
if errorlevel 1 goto python
py -3 -X utf8 "%~dp0start.py"
goto done
:python
python -V >nul 2>&1
if errorlevel 1 goto missing
python -X utf8 "%~dp0start.py"
:done
if errorlevel 1 pause
exit /b
:missing
echo Python 3 is required to start Tetemaru.
pause
