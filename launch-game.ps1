$ErrorActionPreference = "Stop"

$projectPath = "C:\ai-game-lab"
$nodePath = "C:\Program Files\nodejs"
$url = "http://127.0.0.1:5173"

$env:PATH = "$nodePath;$env:PATH"
Set-Location $projectPath

function Test-GameServer {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
    return [int]$response.StatusCode -eq 200
  } catch {
    return $false
  }
}

if (-not (Test-GameServer)) {
  Start-Process `
    -FilePath "$nodePath\npm.cmd" `
    -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1") `
    -WorkingDirectory $projectPath `
    -WindowStyle Minimized

  $ready = $false
  for ($i = 0; $i -lt 30; $i += 1) {
    Start-Sleep -Milliseconds 500
    if (Test-GameServer) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    Write-Host "게임 서버를 시작하지 못했습니다. C:\ai-game-lab 에서 .\start-dev.ps1 을 직접 실행해보세요."
    Read-Host "Enter 키를 누르면 닫습니다"
    exit 1
  }
}

Start-Process $url
