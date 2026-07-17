#!/usr/bin/env python3
"""한글 폰트의 세로 메트릭을 실제 글리프 범위에 맞게 패치한다.

왜 필요한가 (2026-07-17 실측):
  GothicA1-Medium 은 hhea 에 ascent=817 / descent=-207 (합 1.00 em) 을 신고하는데,
  실제 글리프는 yMin=-339 ~ yMax=1155 (1.46 em) 까지 뻗는다. **폰트가 자기 높이를 46% 축소 보고**한다.
  Slate 는 hhea 값으로 텍스트 상자를 잡으므로 글리프 아랫부분이 상자 밖으로 나가 **잘린다**
  (폰트 15px 기준 약 1.9px). 버튼·칸 높이를 아무리 키워도 안 고쳐진다 — 상자 자체가 작기 때문.

조치:
  hhea.ascent/descent 와 OS/2 의 typo·win 메트릭을 실제 글리프 범위(head.yMin/yMax)로 맞춘다.
  lineGap 은 0 으로 — 이미 확보한 여유에 더 얹으면 한 줄 UI 가 불필요하게 두꺼워진다.

실행: python scripts/patch_font_metrics.py
  RawAssets/Fonts/*.ttf (원본, 손대지 않음) → Content/Fonts/*.ttf (런타임이 읽는 것)
"""
import os
import sys

try:
    from fontTools.ttLib import TTFont
except ImportError:
    sys.exit("fontTools 가 필요합니다: pip install fonttools")

SRC = r"C:\Users\Public\WCUE\RawAssets\Fonts"
DST = r"C:\Users\Public\WCUE\Content\Fonts"


def patch(path_in, path_out):
    f = TTFont(path_in)
    head, hhea, os2 = f["head"], f["hhea"], f["OS/2"]
    upm = head.unitsPerEm
    y_max, y_min = head.yMax, head.yMin

    before = (hhea.ascent - hhea.descent) / upm
    after = (y_max - y_min) / upm

    # 실제 글리프가 차지하는 범위를 그대로 신고하게 한다
    hhea.ascent = y_max
    hhea.descent = y_min
    hhea.lineGap = 0
    os2.sTypoAscender = y_max
    os2.sTypoDescender = y_min
    os2.sTypoLineGap = 0
    os2.usWinAscent = y_max
    os2.usWinDescent = abs(y_min)
    # USE_TYPO_METRICS(bit 7) — typo 값을 쓰라고 명시
    os2.fsSelection |= (1 << 7)

    f.save(path_out)
    return before, after


def main():
    if not os.path.isdir(SRC):
        sys.exit(f"원본 폰트 폴더 없음: {SRC}")
    os.makedirs(DST, exist_ok=True)

    for name in sorted(os.listdir(SRC)):
        if not name.lower().endswith(".ttf"):
            continue
        b, a = patch(os.path.join(SRC, name), os.path.join(DST, name))
        flag = " ← 잘림 원인" if a > b + 0.01 else ""
        print(f"  {name:28s} 신고 {b:.2f} em → 실제 {a:.2f} em{flag}")

    print("\n패치 완료 — Content/Fonts 갱신. 런타임(FStandaloneCompositeFont)이 이 파일을 읽는다.")


if __name__ == "__main__":
    main()
