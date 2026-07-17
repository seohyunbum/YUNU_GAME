# 세력 선택 화면 전용 실마우스 클릭 QA.
# click_test.py 는 -WCTurns=0 로 세력선택을 건너뛰므로 이 화면을 못 friendly. 여기선 -WCShowSelect 로
# 선택 화면을 띄운 채 대기시키고, '둘이 하기' 토글에 실제 클릭을 주입해 Slate 가 입력을 받는지 본다.
# (사용자 지적: "마우스로 선택도 안됨" — Canvas→Slate 전환 후 실제로 먹는지 검증)
#
# 사용: python faction_click_test.py <clickX> <clickY>   (클라이언트 좌표, 1280x720 기준)
import ctypes, subprocess, sys, time
from ctypes import wintypes
from PIL import ImageGrab

user32 = ctypes.windll.user32
user32.SetProcessDPIAware()

UE = r"C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe"
UPROJ = r"C:\Users\Public\wc-game\ue\WorldConquestUE\WorldConquestUE.uproject"
OUT = r"C:\Users\서현범\AppData\Local\Temp\claude\C--Users-----Documents-Obsidian-Vault\0b9e29a1-ff26-417b-8533-611f1edc91ca\scratchpad"
W, H = 1280, 720


def find_windows():
    found = []
    @ctypes.WINFUNCTYPE(ctypes.c_bool, wintypes.HWND, wintypes.LPARAM)
    def cb(hwnd, lparam):
        n = user32.GetWindowTextLengthW(hwnd)
        if n and user32.IsWindowVisible(hwnd):
            b = ctypes.create_unicode_buffer(n + 1)
            user32.GetWindowTextW(hwnd, b, n + 1)
            if "Conquest" in b.value:
                found.append((hwnd, b.value))
        return True
    user32.EnumWindows(cb, 0)
    return found


def client_box(hwnd):
    r = wintypes.RECT(); user32.GetClientRect(hwnd, ctypes.byref(r))
    p = wintypes.POINT(0, 0); user32.ClientToScreen(hwnd, ctypes.byref(p))
    return p.x, p.y, r.right, r.bottom


def assert_foreground(hwnd, where):
    fg = user32.GetForegroundWindow()
    if fg != hwnd:
        n = user32.GetWindowTextLengthW(fg)
        b = ctypes.create_unicode_buffer(n + 1); user32.GetWindowTextW(fg, b, n + 1)
        print(f"  ✘ [{where}] 포그라운드 뺏김 → '{b.value}' (테스트 무효)")
        return False
    return True


def shot(hwnd, name):
    x, y, w, h = client_box(hwnd)
    im = ImageGrab.grab(bbox=(x, y, x + w, y + h), all_screens=True)
    path = f"{OUT}\\{name}.png"
    im.save(path)
    print(f"  shot: {path}  ({im.size})")
    return im


def force_foreground(hwnd):
    kernel32 = ctypes.windll.kernel32
    if user32.GetForegroundWindow() == hwnd:
        return True
    cur = kernel32.GetCurrentThreadId()
    fg_t = user32.GetWindowThreadProcessId(user32.GetForegroundWindow(), None)
    tg_t = user32.GetWindowThreadProcessId(hwnd, None)
    for t in (fg_t, tg_t):
        if t and t != cur:
            user32.AttachThreadInput(cur, t, True)
    user32.ShowWindow(hwnd, 5); user32.BringWindowToTop(hwnd)
    user32.SetForegroundWindow(hwnd); user32.SetActiveWindow(hwnd); user32.SetFocus(hwnd)
    for t in (fg_t, tg_t):
        if t and t != cur:
            user32.AttachThreadInput(cur, t, False)
    time.sleep(0.5)
    return user32.GetForegroundWindow() == hwnd


def click(hwnd, cx, cy):
    x, y, w, h = client_box(hwnd)
    sx, sy = x + cx, y + cy
    force_foreground(hwnd)
    user32.SetCursorPos(sx, sy)
    time.sleep(0.6)
    user32.mouse_event(0x0002, 0, 0, 0, 0)   # LEFTDOWN
    time.sleep(0.12)
    user32.mouse_event(0x0004, 0, 0, 0, 0)   # LEFTUP
    print(f"  click: client({cx},{cy}) → screen({sx},{sy})")
    time.sleep(1.2)


def main():
    cx = int(sys.argv[1]) if len(sys.argv) > 2 else 720   # 기본 '둘이 하기'
    cy = int(sys.argv[2]) if len(sys.argv) > 2 else 175

    print("게임 기동 (창모드, 세력 선택 화면)…")
    p = subprocess.Popen([UE, UPROJ, "-game", "-WINDOWED", f"-ResX={W}", f"-ResY={H}",
                          "-WCShowSelect", "-nosplash", "-nosound"])
    hwnd = None
    for _ in range(60):
        time.sleep(1)
        ws = find_windows()
        if ws:
            hwnd = ws[0][0]; print(f"  window: {ws[0][1]} hwnd={hwnd}"); break
    if not hwnd:
        p.kill(); sys.exit("게임 창을 찾지 못함")

    time.sleep(12)   # static 로드·세력 목록 채워질 여유
    force_foreground(hwnd)
    if not assert_foreground(hwnd, "before"):
        p.kill(); sys.exit("무효 — 다른 창이 앞에 있음")
    before = shot(hwnd, "faction_before")

    click(hwnd, cx, cy)
    if not assert_foreground(hwnd, "after"):
        p.kill(); sys.exit("무효 — 클릭 도중 포그라운드 뺏김")
    after = shot(hwnd, "faction_after")

    # 판정: '둘이 하기' 클릭 → 토글 버튼 두 개(금↔어둠 스왑) + 아래 안내문("아빠 나라 고르기")이 바뀐다.
    # 토글 줄 영역만 비교 — 지도 배경은 이 화면에서 정지라 diff 가 순수 UI 변화다.
    BOX = (440, 150, 850, 270)   # 두 토글 버튼 + 안내문
    b, a = before.crop(BOX).convert("RGB"), after.crop(BOX).convert("RGB")
    d = sum(1 for p1, p2 in zip(b.getdata(), a.getdata()) if p1 != p2)
    tot = b.size[0] * b.size[1]
    print(f"\n토글 영역 변화: {100.0*d/tot:.2f}%  ({d}/{tot})")
    print("→ 5%+ = 토글 먹힘(마우스 OK) / 한자리수 이하 = 클릭 무시")

    p.kill(); time.sleep(1)
    import glob, io
    logs = glob.glob(r"C:\Users\Public\wc-game\ue\WorldConquestUE\Saved\Logs\WorldConquestUE.log")
    if logs:
        txt = io.open(logs[0], encoding="utf-8", errors="ignore").read()
        hits = [l for l in txt.splitlines() if "LogWorldConquest" in l]
        print("\n=== LogWorldConquest 마지막 6줄 ===")
        for l in hits[-6:]:
            print("  " + l.split("]")[-1].strip()[:110])
    print("종료")


if __name__ == "__main__":
    main()
