#!/usr/bin/env python3
"""로컬 배포 스크립트 — 게임을 안정 경로에 publish 하고 바탕화면 바로가기를 만든다.

사용: python scripts/deploy-local.py   (repo 루트 어디서든 OK — 스크립트 위치 기준 동작)

산출물 (C:/Users/<user>/WorldConquest/):
  app/                     framework-dependent publish (Release)
  data/                    밸런스·콘텐츠 JSON (§5 SSOT 사본 — 패널 편집 대상)
  WorldConquest.bat        게임 실행 (play)
  BalancePanel.bat         밸런스 패널 실행 (panel → localhost:8377)
바탕화면: "세계정복 게임.lnk" / "세계정복 밸런스관리.lnk"

인코딩 함정 (실측, 2026-07-17):
  - .bat 은 cmd 가 콘솔 코드페이지(CP949)로 파싱 → UTF-8 저장 시 한글 경로 깨짐 → CP949 저장.
  - .vbs 도 cscript 가 ANSI 로 읽음 → CP949 저장.
  - 게임 한글 출력은 exe 가 Console.OutputEncoding=UTF8 을 직접 설정하므로 chcp 불필요.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
HOME = Path.home()
DEPLOY = HOME / "WorldConquest"
DOTNET_ROOT = HOME / "dotnet"  # zip 설치 SDK (winget 설치 불가 PC — AGENTS.md 참조)


def dotnet_exe() -> str:
    """zip 설치 SDK 우선. CreateProcess 는 자식 env 의 PATH 로 탐색하지 않으므로 절대경로 필수."""
    candidate = DOTNET_ROOT / "dotnet.exe"
    if candidate.is_file():
        return str(candidate)
    found = shutil.which("dotnet")
    if found is None:
        sys.exit(f"dotnet SDK 를 찾을 수 없습니다 — {candidate} 또는 PATH 에 필요 (AGENTS.md 참조)")
    return found


def run(cmd: list[str], **kw) -> None:
    print("$", " ".join(cmd))
    env = os.environ.copy()
    if DOTNET_ROOT.is_dir():
        env["DOTNET_ROOT"] = str(DOTNET_ROOT)
    subprocess.run(cmd, check=True, env=env, **kw)


def write_bat(path: Path, mode: str, title: str) -> None:
    lines = [
        "@echo off",
        f"title {title}",
        f"set DOTNET_ROOT={DOTNET_ROOT}",
        "set PATH=%DOTNET_ROOT%;%PATH%",
        'cd /d "%~dp0"',
        f'"app\\WorldConquest.ConsoleHost.exe" {mode}',
        "pause",
    ]
    path.write_text("\n".join(lines) + "\n", encoding="cp949", newline="\r\n")
    print("bat:", path)


def make_shortcuts() -> None:
    vbs_lines = [
        'Set s = CreateObject("WScript.Shell")',
        'desk = s.SpecialFolders("Desktop")',
        'Set l = s.CreateShortcut(desk & "\\세계정복 게임.lnk")',
        f'l.TargetPath = "{DEPLOY}\\WorldConquest.bat"',
        f'l.WorkingDirectory = "{DEPLOY}"',
        'l.Description = "World Conquest - 부자 2인 세계 정복 대전략"',
        "l.Save",
        'Set l2 = s.CreateShortcut(desk & "\\세계정복 밸런스관리.lnk")',
        f'l2.TargetPath = "{DEPLOY}\\BalancePanel.bat"',
        f'l2.WorkingDirectory = "{DEPLOY}"',
        'l2.Description = "World Conquest 밸런스 편집 패널 (localhost:8377)"',
        "l2.Save",
        'WScript.Echo "shortcuts created"',
    ]
    vbs = Path(tempfile.gettempdir()) / "wc_mklnk.vbs"
    vbs.write_text("\n".join(vbs_lines) + "\n", encoding="cp949", newline="\r\n")
    run(["cscript", "//nologo", str(vbs)])


def main() -> int:
    print(f"repo: {REPO}\ndeploy: {DEPLOY}")
    run([dotnet_exe(), "publish", str(REPO / "src" / "WorldConquest.ConsoleHost"),
         "-c", "Release", "-o", str(DEPLOY / "app")])

    # data/ 는 패널이 편집하는 라이브 사본 — 통째 교체(구버전 잔재 방지).
    # 커스텀 밸런스를 지키려면 배포 전 패널 값을 백업하거나 이 단계를 주석 처리.
    dst = DEPLOY / "data"
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(REPO / "data", dst)
    print("data:", dst)

    write_bat(DEPLOY / "WorldConquest.bat", "play", "World Conquest")
    write_bat(DEPLOY / "BalancePanel.bat", "panel", "World Conquest - Balance Panel")
    make_shortcuts()
    print("\n배포 완료 — 바탕화면 [세계정복 게임] / [세계정복 밸런스관리] 로 실행하십시오.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
