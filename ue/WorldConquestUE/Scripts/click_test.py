# 실마우스 클릭 QA 하네스 — 게임 창을 띄우고 Windows SendInput 으로 실제 클릭을 주입해
# Slate 버튼이 입력을 받는지 검증한다. (오프스크린 스크린샷 QA 로는 클릭 검증 불가)
#
# 사용: python click_test.py <clickX> <clickY>   (클라이언트 좌표. 생략 시 클릭 없이 스샷만)
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
            t = b.value
            if "WorldConquest" in t or "Conquest" in t:
                found.append((hwnd, t))
        return True
    user32.EnumWindows(cb, 0)
    return found


def client_box(hwnd):
    r = wintypes.RECT(); user32.GetClientRect(hwnd, ctypes.byref(r))
    p = wintypes.POINT(0, 0); user32.ClientToScreen(hwnd, ctypes.byref(p))
    return p.x, p.y, r.right, r.bottom


def assert_foreground(hwnd, where):
    """다른 앱(예: 블래스터 공방)이 포그라운드를 뺏으면 스샷·클릭이 그 창에 가서 테스트가 무효가 된다."""
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
    """SetForegroundWindow 는 포그라운드 락 때문에 조용히 실패한다 → AttachThreadInput 우회."""
    kernel32 = ctypes.windll.kernel32
    fg = user32.GetForegroundWindow()
    if fg == hwnd:
        return True
    cur_tid = kernel32.GetCurrentThreadId()
    fg_tid = user32.GetWindowThreadProcessId(fg, None)
    tgt_tid = user32.GetWindowThreadProcessId(hwnd, None)
    for t in (fg_tid, tgt_tid):
        if t and t != cur_tid:
            user32.AttachThreadInput(cur_tid, t, True)
    user32.ShowWindow(hwnd, 5)          # SW_SHOW
    user32.BringWindowToTop(hwnd)
    user32.SetForegroundWindow(hwnd)
    user32.SetActiveWindow(hwnd)
    user32.SetFocus(hwnd)
    for t in (fg_tid, tgt_tid):
        if t and t != cur_tid:
            user32.AttachThreadInput(cur_tid, t, False)
    time.sleep(0.5)
    ok = user32.GetForegroundWindow() == hwnd
    print(f"  foreground: {'OK' if ok else '실패'} (fg={user32.GetForegroundWindow()}, target={hwnd})")
    return ok


def click(hwnd, cx, cy):
    x, y, w, h = client_box(hwnd)
    sx, sy = x + cx, y + cy
    force_foreground(hwnd)
    # 마우스를 먼저 올려두고(hover) 한 프레임 넘긴 뒤 누른다 — Slate 는 hover→press 순서를 기대
    user32.SetCursorPos(sx, sy)
    time.sleep(0.6)
    user32.mouse_event(0x0002, 0, 0, 0, 0)   # LEFTDOWN
    time.sleep(0.12)
    user32.mouse_event(0x0004, 0, 0, 0, 0)   # LEFTUP
    print(f"  click: client({cx},{cy}) → screen({sx},{sy})")
    time.sleep(1.5)


def main():
    cx = int(sys.argv[1]) if len(sys.argv) > 2 else None
    cy = int(sys.argv[2]) if len(sys.argv) > 2 else None

    print("게임 기동 (창모드, 한성 진입)…")
    # -WCTurns=0 이 있어야 세력선택을 건너뛰고 solo 조선 자동 시작 → -WCCity 로 거점 진입.
    p = subprocess.Popen([UE, UPROJ, "-game", "-WINDOWED", f"-ResX={W}", f"-ResY={H}",
                          "-WCTurns=0", "-WCCity=hanseong", "-WCInputProbe", "-nosplash", "-nosound"])
    hwnd = None
    for _ in range(60):                       # 최대 60s 대기 (디오라마 로드·셰이더)
        time.sleep(1)
        ws = find_windows()
        if ws:
            hwnd = ws[0][0]
            print(f"  window: {ws[0][1]} hwnd={hwnd}")
            break
    if not hwnd:
        p.kill(); sys.exit("게임 창을 찾지 못함")

    time.sleep(14)                            # 도시 진입·디오라마 스트리밍 여유
    force_foreground(hwnd)
    if not assert_foreground(hwnd, "before-shot"):
        p.kill(); sys.exit("무효 — 다른 창이 앞에 있음. 해당 앱을 닫고 재실행")
    before = shot(hwnd, "click_before")

    if cx is not None:
        click(hwnd, cx, cy)
        if not assert_foreground(hwnd, "after-click"):
            p.kill(); sys.exit("무효 — 클릭 도중 포그라운드 뺏김")
        after = shot(hwnd, "click_after")

        # 판정: 3D 디오라마는 매 프레임 흔들리므로 전체 diff 는 무의미.
        # 정적 UI 패널 영역(내정 패널)만 비교한다 — 거점을 나가면 이 영역이 통째로 바뀐다.
        BOX = (40, 360, 430, 650)
        b, a = before.crop(BOX).convert("RGB"), after.crop(BOX).convert("RGB")
        d = sum(1 for p1, p2 in zip(b.getdata(), a.getdata()) if p1 != p2)
        tot = b.size[0] * b.size[1]
        print(f"\n내정 패널 영역 변화: {100.0*d/tot:.2f}%  ({d}/{tot})")
        print("→ 30%+ = 화면 전환(클릭 먹힘) / 한자리수 = 클릭 무시됨")

    p.kill()
    time.sleep(1)
    # 로그 정답지 — 클릭으로 명령이 나갔거나 화면이 바뀌면 흔적이 남는다
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
