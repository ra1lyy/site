@echo off
REM IP Logger - Quick Start для Windows

echo.
echo ╔════════════════════════════════════════════════════════╗
echo ║          IP LOGGER SERVER - WINDOWS STARTER            ║
echo ╚════════════════════════════════════════════════════════╝
echo.

REM Проверка наличия Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js не установлен!
    echo.
    echo Пожалуйста, установите Node.js с https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js найден: 
node --version
echo.

REM Запуск сервера
echo 🚀 Запуск сервера...
echo.
echo ════════════════════════════════════════════════════════
echo.
node server.js

pause
