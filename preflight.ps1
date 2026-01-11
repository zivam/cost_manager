param(
  [string]$Root = (Get-Location).Path
)

$services = @(
  @{ Name = "users-service";  RequiredModels = @("models/user.model.js", "models/log.model.js") },
  @{ Name = "costs-service";  RequiredModels = @("models/cost.model.js", "models/report.model.js", "models/log.model.js") },
  @{ Name = "logs-service";   RequiredModels = @("models/log.model.js") },
  @{ Name = "admin-service";  RequiredModels = @("models/log.model.js") }
)

function Ok($msg)   { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red }

function Check-File($path) {
  return (Test-Path -Path $path -PathType Leaf)
}

function Check-Dir($path) {
  return (Test-Path -Path $path -PathType Container)
}

function Read-Env($envPath) {
  $map = @{}
  $lines = Get-Content $envPath -ErrorAction Stop
  foreach ($line in $lines) {
    $t = $line.Trim()
    if ($t.Length -eq 0) { continue }
    if ($t.StartsWith("#")) { continue }
    $idx = $t.IndexOf("=")
    if ($idx -lt 1) { continue }
    $k = $t.Substring(0, $idx).Trim()
    $v = $t.Substring($idx + 1).Trim()
    $map[$k] = $v
  }
  return $map
}

$overallFail = $false

Write-Host "=== Cost Manager Preflight (Root: $Root) ===" -ForegroundColor Cyan

foreach ($svc in $services) {
  $name = $svc.Name
  $svcPath = Join-Path $Root $name

  Write-Host ""
  Write-Host "---- $name ----" -ForegroundColor Cyan

  if (-not (Check-Dir $svcPath)) {
    Fail "Missing folder: $svcPath"
    $overallFail = $true
    continue
  } else {
    Ok "Folder exists"
  }

  $pkg = Join-Path $svcPath "package.json"
  $app = Join-Path $svcPath "app.js"
  $server = Join-Path $svcPath "server.js"
  $env = Join-Path $svcPath ".env"

  if (Check-File $pkg) { Ok "package.json exists" } else { Fail "Missing package.json"; $overallFail = $true }
  if (Check-File $app) { Ok "app.js exists" } else { Fail "Missing app.js"; $overallFail = $true }
  if (Check-File $server) { Ok "server.js exists" } else { Warn "Missing server.js (recommended for tests + deployment)" }
  if (Check-File $env) { Ok ".env exists" } else { Fail "Missing .env"; $overallFail = $true }

  # Check env vars
  if (Check-File $env) {
    try {
      $envMap = Read-Env $env
      foreach ($k in @("PORT","SERVICE_NAME","MONGO_URI")) {
        if ($envMap.ContainsKey($k) -and $envMap[$k].Length -gt 0) {
          Ok ".env has $k"
        } else {
          Fail ".env missing $k"
          $overallFail = $true
        }
      }

      if ($envMap.ContainsKey("MONGO_URI")) {
        $uri = $envMap["MONGO_URI"]
        if ($uri.StartsWith("mongodb://") -or $uri.StartsWith("mongodb+srv://")) {
          Ok "MONGO_URI scheme looks valid"
        } else {
          Fail "MONGO_URI invalid scheme (must start mongodb:// or mongodb+srv://)"
          $overallFail = $true
        }

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

  # Required models
  foreach ($m in $svc.RequiredModels) {
    $mp = Join-Path $svcPath $m
    if (Check-File $mp) { Ok "Model exists: $m" } else { Fail "Missing model: $m"; $overallFail = $true }
  }

  # Check app.js for testing-friendly pattern
  if (Check-File $app) {
    $appContent = Get-Content $app -Raw

    if ($appContent -match "app\.listen\s*\(") {
      Warn "app.js contains app.listen(...) — move listen to server.js for tests"
    } else {
      Ok "app.js has no app.listen (good for tests)"
    }

    if ($appContent -match "module\.exports\s*=\s*app") {
      Ok "app.js exports app (module.exports = app)"
    } else {
      Warn "app.js does NOT export app — add: module.exports = app"
    }
  }

  # package.json checks
  if (Check-File $pkg) {
    try {
      $pj = Get-Content $pkg -Raw | ConvertFrom-Json
      if ($pj.scripts -and $pj.scripts.start) { Ok "script start exists" } else { Warn "Missing script: start" }
      if ($pj.scripts -and $pj.scripts.dev)   { Ok "script dev exists" } else { Warn "Missing script: dev" }
      if ($pj.scripts -and $pj.scripts.test)  { Ok "script test exists" } else { Warn "Missing script: test (jest)" }

      $devDeps = $pj.devDependencies
      if ($devDeps -and $devDeps.jest)      { Ok "devDependency jest exists" } else { Warn "Missing devDependency jest" }
      if ($devDeps -and $devDeps.supertest) { Ok "devDependency supertest exists" } else { Warn "Missing devDependency supertest" }

    } catch {
      Fail "Failed to parse package.json JSON: $($_.Exception.Message)"
      $overallFail = $true
    }
  }
}

Write-Host ""
if ($overallFail) {
  Fail "Preflight FAILED. Fix the FAIL items above before running tests/deploy."
  exit 1
} else {
  Ok "Preflight PASSED (warnings are OK but recommended to fix)."
  exit 0
}
