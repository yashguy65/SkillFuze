@echo off
setlocal enabledelayedexpansion

:: =========================================
:: SkillFuze Local CI — Pre-commit Checks
:: =========================================
:: Usage:
::   test.bat           Fast mode (lint + typecheck + Python checks)   ~30s
::   test.bat --full    Full mode  (+ Next.js build + Maven tests)     ~90s
:: =========================================

set FULL_MODE=0
if "%1"=="--full" set FULL_MODE=1

:: ── Step 1: Environment Check ────────────────────────────────────────────
echo.
echo [1/8] Checking environment...

if not exist ".env" (
    echo ERROR: .env file not found in project root.
    goto :error
)

:: Check critical env vars
for %%V in (SUPABASE_URL SUPABASE_KEY GITHUB_TOKEN) do (
    findstr /B /C:"%%V=" .env >nul 2>&1
    if !ERRORLEVEL! neq 0 (
        echo WARNING: %%V not found in .env — some features may fail at runtime.
    )
)
echo    Environment OK.

:: ── Step 2: Install Web Dependencies ─────────────────────────────────────
echo.
echo [2/8] Installing Web Dependencies...
call pnpm install --frozen-lockfile >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo    Frozen lockfile failed, falling back to regular install...
    call pnpm install
    if !ERRORLEVEL! neq 0 goto :error
)
echo    Dependencies installed.

:: ── Step 3: Lint Web ─────────────────────────────────────────────────────
echo.
echo [3/8] Linting Web (ESLint)...
call pnpm --filter web lint
if !ERRORLEVEL! neq 0 goto :error
echo    Lint passed.

:: ── Step 4: TypeScript Type Check ────────────────────────────────────────
echo.
echo [4/8] TypeScript Type Check...
call pnpm --filter web typecheck
if !ERRORLEVEL! neq 0 goto :error
echo    Types OK.

:: ── Step 5: Python Lint + Import Check ───────────────────────────────────
echo.
echo [5/8] Python AI Service — Syntax + Import Check...

:: Check if Python is available
py --version >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo    SKIP: Python not found. Install Python 3.11+ to enable AI service checks.
    goto :step7
)

:: Validate all Python source files compile (catches syntax errors)
py -m py_compile services\ai-service\main.py
if !ERRORLEVEL! neq 0 (
    echo    ERROR: main.py has syntax errors.
    goto :error
)

for %%F in (services\ai-service\routers\*.py) do (
    py -m py_compile "%%F"
    if !ERRORLEVEL! neq 0 (
        echo    ERROR: %%F has syntax errors.
        goto :error
    )
)

for %%F in (services\ai-service\parsers\*.py) do (
    py -m py_compile "%%F"
    if !ERRORLEVEL! neq 0 (
        echo    ERROR: %%F has syntax errors.
        goto :error
    )
)

for %%F in (services\ai-service\pipelines\*.py) do (
    py -m py_compile "%%F"
    if !ERRORLEVEL! neq 0 (
        echo    ERROR: %%F has syntax errors.
        goto :error
    )
)

for %%F in (services\ai-service\schemas\*.py) do (
    py -m py_compile "%%F"
    if !ERRORLEVEL! neq 0 (
        echo    ERROR: %%F has syntax errors.
        goto :error
    )
)

echo    All Python files compile OK.

:: ── Step 6: Python Unit Tests ────────────────────────────────────────────
echo.
echo [6/8] Python Unit Tests (pytest)...

py -m pytest --version >nul 2>&1
if !ERRORLEVEL! neq 0 (
    echo    SKIP: pytest not installed. Run: pip install pytest
    goto :step7
)

py -m pytest services\ai-service\tests\ -v --tb=short
if !ERRORLEVEL! neq 0 goto :error
echo    Python tests passed.

:: ── Step 7: Next.js Build (full mode only) ───────────────────────────────
:step7
if "!FULL_MODE!"=="1" (
    echo.
    echo [7/8] Building Web - Next.js production build...
    call pnpm --filter web build
    if !ERRORLEVEL! neq 0 goto :error
    echo    Build succeeded.
) else (
    echo.
    echo [7/8] SKIP: Next.js build - use --full to enable
)

:: ── Step 8: Backend Tests (full mode only) ───────────────────────────────
if "!FULL_MODE!"=="1" (
    echo.
    echo [8/8] Testing Backend - Spring Boot...
    pushd apps\backend\skillfuze
    call mvnw.cmd test
    if !ERRORLEVEL! neq 0 (
        popd
        goto :error
    )
    popd
    echo    Backend tests passed.
) else (
    echo.
    echo [8/8] SKIP: Spring Boot tests - use --full to enable
)

:: ── Success ──────────────────────────────────────────────────────────────
echo.
echo =========================================
if "!FULL_MODE!"=="1" (
    echo SUCCESS: All CI checks passed! - FULL MODE
) else (
    echo SUCCESS: Fast checks passed!
    echo Run 'test.bat --full' for complete CI including build + backend tests.
)
echo =========================================
exit /b 0

:error
echo.
echo =========================================
echo ERROR: A CI check failed. See the output above for details.
echo =========================================
exit /b 1
