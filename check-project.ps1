$env:PATH = "C:\Program Files\nodejs;$env:PATH"
& "C:\Program Files\nodejs\npm.cmd" run typecheck
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

& "C:\Program Files\nodejs\npm.cmd" run build
