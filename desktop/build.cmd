@echo off
rem Builds MyMind.exe: one self-contained exe (Win32 + WebView2 with its static loader, and the static CRT).
rem Run it from an "x64 Native Tools Command Prompt for VS":   build.cmd [version]   (default 0.0.0-dev)
setlocal
cd /d "%~dp0"

set "VERSION=%~1"
if "%VERSION%"=="" set "VERSION=0.0.0-dev"
rem The WebView2 SDK (headers + WebView2LoaderStatic.lib), pinned
set "WV2_VERSION=1.0.3912.50"
set "WV2=build\webview2-%WV2_VERSION%"

where cl.exe >nul 2>nul || (echo cl.exe not found: run this from an x64 Native Tools Command Prompt for VS. & exit /b 1)
if not exist build mkdir build

if not exist "%WV2%\build\native\include\WebView2.h" (
  echo Downloading the Microsoft.Web.WebView2 %WV2_VERSION% NuGet package...
  mkdir "%WV2%" 2>nul
  "%SystemRoot%\System32\curl.exe" -fsSL --retry 3 -o build\webview2.zip "https://www.nuget.org/api/v2/package/Microsoft.Web.WebView2/%WV2_VERSION%" || exit /b 1
  "%SystemRoot%\System32\tar.exe" -xf build\webview2.zip -C "%WV2%" || exit /b 1
)

rem build\app_version.h for main.cpp and app.rc: version 1.2.3-beta gives APP_VERSION "1.2.3-beta" and APP_VERSION_NUM 1,2,3,0
set "V1=0"
set "V2=0"
set "V3=0"
for /f "tokens=1-3 delims=.-+" %%a in ("%VERSION%") do (
  set "V1=%%a"
  if not "%%b"=="" set "V2=%%b"
  if not "%%c"=="" set "V3=%%c"
)
(
  echo #define APP_VERSION "%VERSION%"
  echo #define APP_VERSION_NUM %V1%,%V2%,%V3%,0
) > build\app_version.h

echo Building MyMind.exe %VERSION%...
rc /nologo /i build /fo build\app.res app.rc || exit /b 1
cl /nologo /O1 /MT /EHsc /std:c++17 /W3 /DUNICODE /D_UNICODE /I build /I "%WV2%\build\native\include" ^
  /Fobuild\ /FeMyMind.exe main.cpp build\app.res ^
  /link /SUBSYSTEM:WINDOWS /OPT:REF /OPT:ICF /MANIFEST:NO "%WV2%\build\native\x64\WebView2LoaderStatic.lib" ^
  user32.lib gdi32.lib ole32.lib shell32.lib advapi32.lib dwmapi.lib uuid.lib version.lib || exit /b 1

for %%F in (MyMind.exe) do echo Built %%~fF: %%~zF bytes
exit /b 0
