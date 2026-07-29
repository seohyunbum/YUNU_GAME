$ErrorActionPreference = "Stop"
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 4179
$url = "http://127.0.0.1:$port"
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source

function Test-MafiaServer {
    try {
        $response = Invoke-WebRequest `
            -Uri $url `
            -UseBasicParsing `
            -TimeoutSec 2
        return $response.StatusCode -eq 200 -and $response.Content.Contains("밤의 의회")
    } catch {
        return $false
    }
}

if (-not (Test-Path (Join-Path $projectDir "node_modules"))) {
    & $npm install --prefix $projectDir
}

if (-not (Test-MafiaServer)) {
    $outputLogPath = Join-Path $projectDir "mafia-game.log"
    $errorLogPath = Join-Path $projectDir "mafia-game-error.log"
    Start-Process -FilePath $npm `
        -ArgumentList @("run", "dev", "--", "--hostname", "127.0.0.1", "--port", "$port") `
        -WorkingDirectory $projectDir `
        -RedirectStandardOutput $outputLogPath `
        -RedirectStandardError $errorLogPath `
        -WindowStyle Hidden

    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $deadline -and -not (Test-MafiaServer)) {
        Start-Sleep -Milliseconds 300
    }
}

if (-not (Test-MafiaServer)) {
    throw "마피아게임 서버를 시작하지 못했습니다. mafia-game-error.log를 확인해 주세요."
}

Start-Process $url
