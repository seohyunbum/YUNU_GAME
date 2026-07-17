# 지도 드래그 방향 실측 — 오른쪽으로 드래그했을 때 지도가 어느 쪽으로 가는지 관측.
# "땡긴 쪽으로 끌려와야" 정상(grab-and-pull): 오른쪽 드래그 → 지도 콘텐츠가 오른쪽으로 이동.
import ctypes, subprocess, time
from ctypes import wintypes
from PIL import ImageGrab, ImageChops
import sys
sys.path.insert(0, r"C:\Users\서현범\AppData\Local\Temp\claude\C--Users-----Documents-Obsidian-Vault\0b9e29a1-ff26-417b-8533-611f1edc91ca\scratchpad")
from click_test import find_windows, client_box, force_foreground, UE, UPROJ, OUT

user32 = ctypes.windll.user32

def drag(hwnd, x0, y0, dx, steps=25):
    x, y, w, h = client_box(hwnd)
    force_foreground(hwnd)
    user32.SetCursorPos(x + x0, y + y0); time.sleep(0.5)
    user32.mouse_event(0x0002, 0, 0, 0, 0)          # LEFTDOWN
    time.sleep(0.15)
    step = int(round(dx / steps))
    for i in range(steps):                           # 상대 이동 = UE 가 읽는 raw 델타 생성
        user32.mouse_event(0x0001, step, 0, 0, 0)    # MOUSEEVENTF_MOVE
        time.sleep(0.03)
    time.sleep(0.15)
    user32.mouse_event(0x0004, 0, 0, 0, 0)          # LEFTUP
    time.sleep(0.8)

p = subprocess.Popen([UE, UPROJ, "-game", "-WINDOWED", "-ResX=1280", "-ResY=720",
                      "-WCTurns=0", "-WCInputProbe", "-nosplash", "-nosound"])
hwnd = None
for _ in range(60):
    time.sleep(1)
    ws = find_windows()
    if ws: hwnd = ws[0][0]; break
if not hwnd: p.kill(); sys.exit("창 못 찾음")
time.sleep(10)
force_foreground(hwnd)
x, y, w, h = client_box(hwnd)
before = ImageGrab.grab(bbox=(x, y, x + w, y + h), all_screens=True); before.save(f"{OUT}\drag_before.png")
drag(hwnd, 640, 360, +120, steps=60)   # 120px 드래그 → 1:1 이면 화면도 ~120px 이동
after = ImageGrab.grab(bbox=(x, y, x + w, y + h), all_screens=True); after.save(f"{OUT}\drag_after.png")
p.kill()

# 지도가 어느 쪽으로 갔는지: before 를 좌/우로 시프트해 after 와 가장 잘 맞는 방향 찾기
b = before.convert("L").crop((200, 100, 1080, 620))
best = None
for shift in range(-260, 261, 20):
    a = after.convert("L").crop((200 + shift, 100, 1080 + shift, 620))
    if a.size != b.size: continue
    diff = ImageChops.difference(b, a)
    score = sum(diff.getdata())
    if best is None or score < best[1]: best = (shift, score)
print(f"\n최적 정합 시프트 = {best[0]}px")
print("  양수 → 지도 콘텐츠가 '오른쪽'으로 이동 = 땡긴 방향 = 정상(grab-and-pull)")
print("  음수 → 지도가 '왼쪽'으로 밀림 = 반대 = 수정 필요")
