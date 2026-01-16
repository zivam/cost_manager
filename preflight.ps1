<#
.SYNOPSIS
    Preflight check script for the Cost Manager microservices project.
.DESCRIPTION
    This script validates that all required files, configurations, and dependencies
    are present and correctly configured for each service before running tests or deployment.
.PARAMETER Root
    Root directory path of the project (defaults to current directory)
#>
param(
  [string]$Root = (Get-Location).Path
)

# Define the services and their required model files
$services = @(
  @{ Name = "users-service";  RequiredModels = @("models/user.model.js", "models/log.model.js") },
  @{ Name = "costs-service";  RequiredModels = @("models/cost.model.js", "models/report.model.js", "models/log.model.js") },
  @{ Name = "logs-service";   RequiredModels = @("models/log.model.js") },
  @{ Name = "admin-service";  RequiredModels = @("models/log.model.js") }
)

# Helper functions for colored output
function Ok($msg)   { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }

# Check if a file exists at the given path
function Check-File($path) {
  return (Test-Path -Path $path -PathType Leaf)
}

# Check if a directory exists at the given path
function Check-Dir($path) {
  return (Test-Path -Path $path -PathType Container)
}

# Parse .env file and return a hashtable of key-value pairs
# Skips empty lines, comments (lines starting with #), and invalid entries
function Read-Env($envPath) {
  $map = @{}
  $lines = Get-Content $envPath -ErrorAction Stop
  foreach ($line in $lines) {
    $t = $line.Trim()
    if ($t.Length -eq 0) { continue }           # Skip empty lines
    if ($t.StartsWith("#")) { continue }        # Skip comment lines
    $idx = $t.IndexOf("=")
    if ($idx -lt 1) { continue }                # Skip lines without '=' or with '=' at start
    $k = $t.Substring(0, $idx).Trim()           # Extract key (before '=')
    $v = $t.Substring($idx + 1).Trim()          # Extract value (after '=')
    $map[$k] = $v
  }
  return $map
}

# Track if any critical checks fail
$overallFail = $false

Write-Host "=== Cost Manager Preflight (Root: $Root) ===" -ForegroundColor Cyan

# Check each service in the services array
foreach ($svc in $services) {
  $name = $svc.Name
  $svcPath = Join-Path $Root $name

  Write-Host ""
  Write-Host "---- $name ----" -ForegroundColor Cyan

  # Check if service directory exists
  if (-not (Check-Dir $svcPath)) {
    Fail "Missing folder: $svcPath"
    $overallFail = $true
    continue
  } else {
    Ok "Folder exists"
  }

  # Define paths for required files
  $pkg = Join-Path $svcPath "package.json"
  $app = Join-Path $svcPath "app.js"
  $server = Join-Path $svcPath "server.js"
  $env = Join-Path $svcPath ".env"

  # Check for required files
  if (Check-File $pkg) { Ok "package.json exists" } else { Fail "Missing package.json"; $overallFail = $true }
  if (Check-File $app) { Ok "app.js exists" } else { Fail "Missing app.js"; $overallFail = $true }
  if (Check-File $server) { Ok "server.js exists" } else { Warn "Missing server.js (recommended for tests + deployment)" }
  if (Check-File $env) { Ok ".env exists" } else { Fail "Missing .env"; $overallFail = $true }

  # Check environment variables in .env file
  if (Check-File $env) {
    try {
      $envMap = Read-Env $env
      # Validate required environment variables
      foreach ($k in @("PORT","SERVICE_NAME","MONGO_URI")) {
        if ($envMap.ContainsKey($k) -and $envMap[$k].Length -gt 0) {
          Ok ".env has $k"
        } else {
          Fail ".env missing $k"
          $overallFail = $true
        }
      }

      # Validate MONGO_URI format
      if ($envMap.ContainsKey("MONGO_URI")) {
        $uri = $envMap["MONGO_URI"]
        # Check if URI starts with valid MongoDB scheme
        if ($uri.StartsWith("mongodb://") -or $uri.StartsWith("mongodb+srv://")) {
          Ok "MONGO_URI scheme looks valid"
        } else {
          Fail "MONGO_URI invalid scheme (must start mongodb:// or mongodb+srv://)"
          $overallFail = $true
        }

        # Warn about potential issues with URI format
        if ($uri -match "\s") {
          Warn "MONGO_URI contains whitespace (might break connection)"
        }
        if ($uri -match '"') {
          Warn "MONGO_URI contains quotes (remove quotes in .env)"
        }
      }

    } catch {
      Fail "Failed to parse .env: $($_.Exception.Message)"
      $overallFail = $true
    }
  }

  # Check for required model files
  foreach ($m in $svc.RequiredModels) {
    $mp = Join-Path $svcPath $m
    if (Check-File $mp) { Ok "Model exists: $m" } else { Fail "Missing model: $m"; $overallFail = $true }
  }

  # Check app.js for testing-friendly pattern
  # app.js should export the app but not start the server (server.js should do that)
  if (Check-File $app) {
    $appContent = Get-Content $app -Raw

    # Warn if app.listen is in app.js (should be in server.js for testability)
    if ($appContent -match "app\.listen\s*\(") {
      Warn "app.js contains app.listen(...) — move listen to server.js for tests"
    } else {
      Ok "app.js has no app.listen (good for tests)"
    }

    # Check if app.js exports the app (required for testing)
    if ($appContent -match "module\.exports\s*=\s*app") {
      Ok "app.js exports app (module.exports = app)"
    } else {
      Warn "app.js does NOT export app — add: module.exports = app"
    }
  }

  # Validate package.json structure and required scripts/dependencies
  if (Check-File $pkg) {
    try {
      $pj = Get-Content $pkg -Raw | ConvertFrom-Json
      # Check for required npm scripts
      if ($pj.scripts -and $pj.scripts.start) { Ok "script start exists" } else { Warn "Missing script: start" }
      if ($pj.scripts -and $pj.scripts.dev)   { Ok "script dev exists" } else { Warn "Missing script: dev" }
      if ($pj.scripts -and $pj.scripts.test)  { Ok "script test exists" } else { Warn "Missing script: test (jest)" }

      # Check for required dev dependencies
      $devDeps = $pj.devDependencies
      if ($devDeps -and $devDeps.jest)      { Ok "devDependency jest exists" } else { Warn "Missing devDependency jest" }
      if ($devDeps -and $devDeps.supertest) { Ok "devDependency supertest exists" } else { Warn "Missing devDependency supertest" }

    } catch {
      Fail "Failed to parse package.json JSON: $($_.Exception.Message)"
      $overallFail = $true
    }
  }
}

# Print final result
Write-Host ""
if ($overallFail) {
  Fail "Preflight FAILED. Fix the FAIL items above before running tests/deploy."
  exit 1
} else {
  Ok "Preflight PASSED (warnings are OK but recommended to fix)."
  exit 0
}
