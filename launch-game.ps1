# 바탕화면 아이콘이 여는 실행기.
#
# 예전에는 여기서 로컬 vite 개발 서버를 띄웠다. 그러면 node 가 없거나 포트가 막힌 PC 에서
# 아이콘이 조용히 죽고, 무엇보다 '고쳤는데 화면이 그대로'인 상태가 반복됐다.
# 지금은 다른 게임들과 같이 GitHub Pages 배포본을 연다 — main(master) push 가 곧 배포다.
$url = "https://seohyunbum.github.io/YUNU_GAME/"

# Edge 앱 모드로 열어 주소창 없이 게임만 띄운다(형제 게임들과 동일). 없으면 기본 브라우저로.
$edge = @(
  (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"),
  (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
  (Join-Path $env:LOCALAPPDATA "Microsoft\Edge\Application\msedge.exe")
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1

if ($edge) {
  Start-Process -FilePath $edge -ArgumentList "--app=$url", "--start-maximized"
} else {
  Start-Process $url
}
