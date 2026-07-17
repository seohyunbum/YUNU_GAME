# 세력 영역 원판 텍스처 — 흰색 RGB + 알파(중심 채움 + 테두리 링).
# 머티리얼 노드로 방사 그라데이션을 계산하다 두 번 실패해서, 눈으로 확인 가능한 텍스처로 간다.
from PIL import Image, ImageFilter
import math, os

N = 512
img = Image.new("RGBA", (N, N))
px = img.load()
c = (N - 1) / 2.0

for y in range(N):
    for x in range(N):
        d = math.hypot(x - c, y - c) / c          # 0(중심) ~ 1(가장자리)
        if d > 1.0:
            px[x, y] = (255, 255, 255, 0)
            continue
        # 링을 빼고 부드러운 번짐만 — 링이 있으면 이웃 영역과 겹칠 때 원들이 서로를 뚫고 지나가 지저분하다.
        # 번짐만 있으면 같은 세력 거점끼리는 하나의 영토로 합쳐지고, 다른 세력끼리는 색 경계가 생긴다(영향권 지도).
        a = max(0.0, 1.0 - d) ** 1.35 * 0.80
        px[x, y] = (255, 255, 255, int(a * 255))

img = img.filter(ImageFilter.GaussianBlur(1.2))   # 계단현상 제거
out = r"C:\Users\Public\WCUE\RawAssets\T_zone.png"
os.makedirs(os.path.dirname(out), exist_ok=True)
img.save(out)

# 눈으로 확인할 프리뷰 (알파를 어두운 배경 위에 합성)
bg = Image.new("RGB", (N, N), (30, 60, 40))
bg.paste(Image.new("RGB", (N, N), (90, 170, 255)), (0, 0), img)
bg.save("zone_preview.png")
print("생성:", out)
