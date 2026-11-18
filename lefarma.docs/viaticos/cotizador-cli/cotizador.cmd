@echo off
chcp 65001 >nul
title Cotizador Viaticos
cd /d "%~dp0"
node "%~dp0cotizador.mjs" %*
echo.
pause
