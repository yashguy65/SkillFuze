@echo off
echo =========================================
echo Running Local CI Checks...
echo =========================================

echo.
echo [1/4] Installing Web Dependencies...
call pnpm install
if %ERRORLEVEL% neq 0 goto :error

echo.
echo [2/4] Linting Web...
call pnpm --filter web lint
if %ERRORLEVEL% neq 0 goto :error

echo.
echo [3/4] Building Web...
call pnpm --filter web build
if %ERRORLEVEL% neq 0 goto :error

echo.
echo [4/4] Testing Backend...
cd apps\backend\skillfuze
call mvnw.cmd test
if %ERRORLEVEL% neq 0 (
    cd ..\..\..
    goto :error
)
cd ..\..\..

echo.
echo =========================================
echo SUCCESS: All CI checks passed!
echo =========================================
exit /b 0

:error
echo.
echo =========================================
echo ERROR: A CI check failed. See the output above for details.
echo =========================================
exit /b %ERRORLEVEL%
