@echo off
setlocal
cd /d "%~dp0.."

set LOADTEST_VERSION=1.0.0
set RELEASE_TAG=v1.0.0
set RELEASE_BASE=https://github.com/Baraulia/pingTO/releases/download/v1.0.0

echo Building load agent binaries...
node scripts\build-loadtest.mjs
if errorlevel 1 exit /b 1

where gh >nul 2>&1
if errorlevel 1 (
  echo Install GitHub CLI: https://cli.github.com/
  echo Binaries are in dist\loadtest\ — upload them to the v1.0.0 release manually.
  exit /b 1
)

gh release view v1.0.0 >nul 2>&1
if errorlevel 1 (
  echo Creating GitHub release v1.0.0...
  gh release create v1.0.0 ^
    dist\loadtest\pingto-loadtest-windows-amd64.exe ^
    dist\loadtest\pingto-loadtest-windows-arm64.exe ^
    dist\loadtest\pingto-loadtest-macos-amd64 ^
    dist\loadtest\pingto-loadtest-macos-arm64 ^
    dist\loadtest\pingto-loadtest-linux-amd64 ^
    dist\loadtest\pingto-loadtest-linux-arm64 ^
    dist\loadtest\latest.json ^
    --title "Load agent 1.0.0" ^
    --notes "PingTo load agent. Run locally; listens on http://127.0.0.1:8788 only. Download from the PingTo Load test tab."
) else (
  echo Updating assets on existing release v1.0.0...
  gh release upload v1.0.0 --clobber ^
    dist\loadtest\pingto-loadtest-windows-amd64.exe ^
    dist\loadtest\pingto-loadtest-windows-arm64.exe ^
    dist\loadtest\pingto-loadtest-macos-amd64 ^
    dist\loadtest\pingto-loadtest-macos-arm64 ^
    dist\loadtest\pingto-loadtest-linux-amd64 ^
    dist\loadtest\pingto-loadtest-linux-arm64 ^
    dist\loadtest\latest.json
)

echo.
echo Release: https://github.com/Baraulia/pingTO/releases/tag/v1.0.0
echo Catalog: https://github.com/Baraulia/pingTO/releases/latest/download/latest.json
endlocal
