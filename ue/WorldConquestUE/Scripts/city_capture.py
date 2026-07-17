# 도시 화면을 사용자 실해상도(1600x1000, 다운스케일 없음)로 캡처 — 글자 짤림 정밀 진단용.
# QA 오프스크린 샷은 1280x720 로 다운스케일돼 1~2px 짤림을 가린다. 여기선 창 클라이언트를 그대로 grab.
import ctypes, subprocess, sys, time
from ctypes import wintypes
from PIL import ImageGrab

user32 = ctypes.windll.user32
user32.SetProcessDPIAware()
UE = r"C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
UPROJ = r"C:\Users\Public\wc-game\ue\WorldConquestUE\WorldConquestUE.uproject"
OUT = r"C:\Users\서현범\AppData\Local\Temp\claude\C--Users-----Documents-Obsidian-Vault\0b9e29a1-ff26-417b-8533-611f1edc91ca\scratchpad"
W, H = 1600, 1000
CITY = sys.argv[1] if len(sys.argv) > 1 else "hanseong"
NAME = sys.argv[2] if len(sys.argv) > 2 else "city_native"


def find():
    out = []
    @ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    def cb(h, l):
        n = user32.GetWindowTextLengthW(h)
        if n and user32.IsWindowVisible(h):
            b = ctypes.create_unicode_buffer(n + 1); user32.GetWindowTextW(h, b, n + 1)
            if "Conquest" in b.value: out.append(h)
        return True
    user32.EnumWindows(cb, 0)
    return out


def force_fg(h):
    k = ctypes.windll.kernel32
    if user32.GetForegroundWindow() == h: return
    cur = k.GetCurrentThreadId()
    a = user32.GetWindowThreadProcessId(user32.GetForegroundWindow(), None)
    b = user32.GetWindowThreadProcessId(h, None)
    for t in (a, b):
        if t and t != cur: user32.AttachThreadInput(cur, t, True)
    user32.ShowWindow(h, 5); user32.BringWindowToTop(h); user32.SetForegroundWindow(h); user32.SetFocus(h)
    for t in (a, b):
        if t and t != cur: user32.AttachThreadInput(cur, t, False)
    time.sleep(0.5)


p = subprocess.Popen([UE, UPROJ, "-game", "-WINDOWED", f"-ResX={W}", f"-ResY={H}",
                      "-WCTurns=0", f"-WCCity={CITY}", "-nosplash", "-nosound"])
hwnd = None
for _ in range(60):
    time.sleep(1)
    w = find()
    if w: hwnd = w[0]; break
if not hwnd:
    p.kill(); sys.exit("no window")
time.sleep(28)   # 디오라마 스트리밍·셰이더
import os
if os.environ.get("WC_MAXIMIZE") == "1":
    user32.ShowWindow(hwnd, 3)   # SW_MAXIMIZE — 사용자가 창을 최대화한 상태(높은 DPI 스케일) 재현
else:
    user32.MoveWindow(hwnd, 0, 0, W + 20, H + 60, True)   # 화면 밖으로 안 나가게 좌상단 고정
time.sleep(1.0)
force_fg(hwnd)
r = wintypes.RECT(); user32.GetClientRect(hwnd, ctypes.byref(r))
pt = wintypes.POINT(0, 0); user32.ClientToScreen(hwnd, ctypes.byref(pt))
im = ImageGrab.grab(bbox=(pt.x, pt.y, pt.x + r.right, pt.y + r.bottom), all_screens=True)
path = f"{OUT}\\{NAME}.png"
im.save(path)
print(f"saved {path} {im.size}")
p.kill()
