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
# Content 하위는 **자동 열거**한다 — 고정 목록은 새 폴더(Icons 등)가 생기면 조용히 누락된다(실측 사고).
# 대용량 Fab 팩만 예외로 "없을 때만" 복사(매번 1GB 복사 회피).
CONTENT_LAZY = ["Asian_Village"]


def kill_ue() -> None:
    """DLL·에셋 덮어쓰기용 잠금 해제. ⚠ 실행 중인 게임이 있으면 강제 종료된다 —
    가족이 플레이 중일 때 배포하면 게임이 갑자기 꺼진다. 플레이 중 배포 금지."""
    for exe in ("UnrealEditor.exe", "UnrealEditor-Cmd.exe", "WorldConquest.ConsoleHost.exe"):
        r = subprocess.run(["taskkill", "/F", "/IM", exe], capture_output=True, text=True)
        if r.returncode == 0:   # 실제로 죽인 경우만 경고
            print(f"  ⚠ 실행 중이던 {exe} 를 종료했습니다 (플레이 중이었다면 그래서 꺼진 것)")


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

    # 2) Config — ini 도 실행본에 반영 [MUST]. DefaultInput.ini(런치 마우스 캡처 차단)가 누락되면
    #    뷰포트가 마우스를 캡처해 UI 버튼이 전부 죽는다 (2026-07-17 실측).
    mirror_dir(SRC / "Config", DST / "Config")

    # 3) Content — 하위 폴더 자동 열거 미러 (신규 폴더 누락 방지)
    subdirs = sorted(p.name for p in (SRC / "Content").iterdir() if p.is_dir())
    for name in subdirs:
        if name in CONTENT_LAZY:
            continue
        mirror_dir(SRC / "Content" / name, DST / "Content" / name)

    # 3) Content — 대용량 팩은 없을 때만
    for name in CONTENT_LAZY:
        d = DST / "Content" / name
        if d.is_dir():
            print(f"  (유지 — 이미 있음: {name})")
        else:
            mirror_dir(SRC / "Content" / name, d)

    # 4) 누락 검증 — 원본에 있는데 대상에 없는 Content 하위가 있으면 실패로 알린다
    missing = [n for n in subdirs if not (DST / "Content" / n).is_dir()]
    if missing:
        sys.exit(f"배포 누락: {missing} — 확인 필요")

    print("\n배포 완료 — 바탕화면 [세계정복 3D] 로 확인하십시오.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
