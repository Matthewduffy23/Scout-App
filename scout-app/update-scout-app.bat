@echo off
title Scout App Updater
color 0A
echo.
echo  ================================
echo   Scout Index - Auto Updater
echo  ================================
echo.

set APPDIR=%USERPROFILE%\Downloads\scout-app

:: Check the folder exists
if not exist "%APPDIR%" (
    echo  ERROR: scout-app folder not found at %APPDIR%
    echo  Move your scout-app folder to Downloads first.
    pause
    exit /b 1
)

cd /d "%APPDIR%"

echo  [1/3] Building app...
call npm run build --silent
if errorlevel 1 (
    echo  ERROR: Build failed. Check your src files.
    pause
    exit /b 1
)
echo  Build complete.
echo.

echo  [2/3] Committing to GitHub...
git add .
git commit -m "update" >nul 2>&1
if errorlevel 1 (
    echo  Nothing new to commit - already up to date.
) else (
    echo  Committed.
)
echo.

echo  [3/3] Pushing to Vercel...
git push origin HEAD:main
if errorlevel 1 (
    echo  ERROR: Push failed. Check your internet connection.
    pause
    exit /b 1
)

echo.
echo  ================================
echo   Done! Vercel deploying now.
echo   Check scout-app-ruby.vercel.app
echo   in about 60 seconds.
echo  ================================
echo.
pause
