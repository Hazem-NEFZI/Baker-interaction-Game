@echo off
chcp 65001 >nul
cd /d "%~dp0"
title OPERATION BAKER - LE CERCLE DES ESPIONS V7 · VRAI MULTIJOUEUR
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js est introuvable. Installez la version LTS depuis https://nodejs.org/
  echo Puis relancez ce fichier.
  pause
  exit /b 1
)
echo.
echo     OPERATION BAKER - LE CERCLE DES ESPIONS V7 · VRAI MULTIJOUEUR
 echo     ------------------------------------------
echo     Ordinateur : http://localhost:3000
echo     Pour les telephones, utilisez l'adresse reseau affichee ci-dessous.
echo     Les appareils doivent etre sur le meme reseau Wi-Fi.
echo     Sur Windows, autorisez Node.js sur le reseau prive si demande.
echo.
node server.js
pause
