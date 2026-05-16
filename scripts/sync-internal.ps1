param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("pull", "push", "init")]
    $Action,

    [Parameter(Mandatory=$false)]
    $Url
)

$InternalDir = ".internal-repo"
$FilesToSync = @("AGENTS.md", ".env", ".aiignore")
$ProjectRoot = Get-Location

function Initialize-Repo {
    param($RemoteUrl)
    if (-not (Test-Path $InternalDir)) {
        New-Item -ItemType Directory -Path $InternalDir | Out-Null
    }
    
    Push-Location $InternalDir
    if (-not (Test-Path ".git")) {
        git init
        git remote add origin $RemoteUrl
        Write-Host "Initialized local mirror for $RemoteUrl"
    } else {
        git remote set-url origin $RemoteUrl
        Write-Host "Updated remote URL to $RemoteUrl"
    }
    Pop-Location
}

function Sync-Pull {
    if (-not (Test-Path $InternalDir)) {
        Write-Error "Internal repo not initialized. Run init first."
        return
    }

    Push-Location $InternalDir
    git fetch origin
    
    # Try main, then master
    $success = $false
    git checkout main 2>$null
    if ($LASTEXITCODE -eq 0) { $success = $true }
    else {
        git checkout master 2>$null
        if ($LASTEXITCODE -eq 0) { $success = $true }
    }

    if (-not $success) {
        git checkout -b main
    }

    git pull origin main --rebase 2>$null
    if ($LASTEXITCODE -ne 0) {
        git pull origin master --rebase 2>$null
    }
    
    foreach ($file in $FilesToSync) {
        if (Test-Path $file) {
            Copy-Item $file "$ProjectRoot\$file" -Force
            Write-Host "Pulled $file"
        }
    }
    Pop-Location
    Write-Host "Pull complete."
}

function Sync-Push {
    if (-not (Test-Path $InternalDir)) {
        Write-Error "Internal repo not initialized. Run init first."
        return
    }

    foreach ($file in $FilesToSync) {
        if (Test-Path "$ProjectRoot\$file") {
            Copy-Item "$ProjectRoot\$file" "$InternalDir\$file" -Force
            Write-Host "Staged $file for push"
        }
    }

    Push-Location $InternalDir
    git add .
    $status = git status --porcelain
    if ($status) {
        git commit -m "Update internal files: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        git push origin HEAD
        Write-Host "Push complete."
    } else {
        Write-Host "No changes to push."
    }
    Pop-Location
}

switch ($Action) {
    "init" { 
        if (-not $Url) { Write-Error "URL is required for init."; return }
        Initialize-Repo $Url 
    }
    "pull" { Sync-Pull }
    "push" { Sync-Push }
}
