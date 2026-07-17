#!/usr/bin/env python3
"""UE5 클라이언트 배포 — 빌드본(WCUE)을 바탕화면 아이콘이 실행하는 wc-game 사본에 동기화.

배경: 바탕화면 "세계정복 3D" 아이콘은 아래 wc-game .uproject 를 `UnrealEditor.exe -game`
      으로 실행한다. 개발/QA는 WCUE 에서 하므로, 빌드 후 이 스크립트로 동기화하지 않으면
      아이콘 실행 결과에 변경이 반영되지 않는다(2026-07-17 실측 — "하나도 반영 안됨").

순서 (매 코드/에셋 변경 후):
  1) Build.bat 로 WCUE Editor 타깃 빌드
  2) python scripts/deploy-ue-client.py   ← 이 스크립트
  3) 바탕화면 "세계정복 3D" 실행

동기화 대상: Binaries/Win64(DLL·modules·target) + Content 하위 폴더.
  - Asian_Village(≈1GB Fab 팩)는 거의 안 바뀌므로 대상에 없을 때만 복사(느린 복사 회피).
"""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

SRC = Path(r"C:/Users/Public/WCUE")
DST = Path(r"C:/Users/Public/wc-game/ue/WorldConquestUE")

BIN_FILES = [
    "UnrealEditor-WorldConquestUE.dll",
    "UnrealEditor.modules",
    "WorldConquestUEEditor.target",
]
# 항상 미러링할 Content 하위(코드/생성물이 자주 바뀜). 대용량 Fab 팩은 별도 처리.
CONTENT_MIRROR = ["Fonts", "UI", "Portraits", "WorldMap", "CityBg", "Collections", "Developers"]
CONTENT_LAZY = ["Asian_Village"]  # 없을 때만 복사


def kill_ue() -> None:
    for exe in ("UnrealEditor.exe", "UnrealEditor-Cmd.exe", "WorldConquest.ConsoleHost.exe"):
        subprocess.run(["taskkill", "/F", "/IM", exe], capture_output=True)


def mirror_dir(src: Path, dst: Path) -> None:
    if not src.is_dir():
        print(f"  (건너뜀 — 원본 없음: {src.name})")
        return
    if dst.exists():
        shutil.rmtree(dst)
    shutil.copytree(src, dst)
    print(f"  mirror: {src.name}")


def main() -> int:
    if not SRC.is_dir() or not DST.is_dir():
        sys.exit(f"경로 확인 필요 — SRC={SRC} exists={SRC.is_dir()}  DST={DST} exists={DST.is_dir()}")
    print(f"SRC(빌드본): {SRC}\nDST(실행본): {DST}")
    kill_ue()

    # 1) Binaries
    (DST / "Binaries/Win64").mkdir(parents=True, exist_ok=True)
    for f in BIN_FILES:
        s = SRC / "Binaries/Win64" / f
        if s.is_file():
            shutil.copy2(s, DST / "Binaries/Win64" / f)
            print(f"  bin: {f}")

    # 2) Content — 자주 바뀌는 하위 미러
    for name in CONTENT_MIRROR:
        mirror_dir(SRC / "Content" / name, DST / "Content" / name)

    # 3) Content — 대용량 팩은 없을 때만
    for name in CONTENT_LAZY:
        d = DST / "Content" / name
        if d.is_dir():
            print(f"  (유지 — 이미 있음: {name})")
        else:
            mirror_dir(SRC / "Content" / name, d)

    print("\n배포 완료 — 바탕화면 [세계정복 3D] 로 확인하십시오.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
