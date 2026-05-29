# AI Game Lab

초등학생 자녀와 함께 Codex 또는 Claude Code로 아이디어를 실제 게임으로 바꾸기 위한 로컬 프로젝트입니다.

현재 첫 게임은 Minecraft/Roblox 취향을 반영한 3D 1인칭 야생 생존 게임입니다.

## 지금 들어 있는 것

- Vite + TypeScript + Three.js 기반의 브라우저 3D 게임 환경
- React 기반 메뉴/설정 화면을 붙일 수 있는 준비
- 바로 실행 가능한 1인칭 야생 생존 게임
- 아이디어를 정리하는 문서 템플릿
- AI에게 변경을 요청할 때 쓸 수 있는 프롬프트 예시

## 실행 방법

PowerShell에서 아래 명령을 실행합니다.

```powershell
cd C:\ai-game-lab
.\start-dev.ps1
```

브라우저에서 아래 주소를 엽니다.

```text
http://127.0.0.1:5173
```

PC를 재시작한 뒤에는 보통 아래처럼 짧게 실행할 수 있습니다.

```powershell
cd C:\ai-game-lab
npm run dev
```

설치 직후 `Access is denied`가 보이면 새 PowerShell을 열거나 `.\start-dev.ps1`을 사용하면 됩니다.

## 현재 게임 조작

- 화면 클릭: 1인칭 시점 고정
- 마우스 이동: 시점 회전
- `WASD`: 이동
- `Shift`: 달리기
- `1-8`: 핫바 선택
- `E`: 보고 있는 대상과 상호작용
- `I`: 인벤토리와 2x2 미니 제작대
- `B`: 튜토리얼 책
- `P`: 보유 중인 제작대/재련대 설치
- `Esc`: 창 닫기 또는 시점 고정 해제

## 현재 구현된 생존 규칙

- 처음 핫바는 4칸이고 튜토리얼 책 1권이 들어 있습니다.
- 가방을 만들면 핫바가 8칸, 인벤토리가 40칸으로 늘어납니다.
- 작은 나무는 맨손으로 캘 수 있고 나무 1개를 줍니다.
- 큰 나무는 도끼가 필요하고 나무 5개를 줍니다.
- 100걸음마다 50% 확률로 상자가 생깁니다.
- 500걸음마다 20% 확률로 동굴이 생깁니다.
- 상자는 망치 50%, 재련대 2% 확률을 가집니다.
- 제작대, 확장 제작대, 재련대, 특수 재련대, 도구, 무기, 갑옷, 가방 제작 흐름이 들어 있습니다.
- 동굴에는 돌, 석탄, 드문 광부, 아주 낮은 확률의 광산 상자가 있습니다.
- 흑요석은 다이아몬드 곡괭이로만 캘 수 있고 특수 재련대에서만 재련됩니다.
- 마을 식량창고와 체력 10/방어 5의 마을기사가 있습니다.

## 검증

```powershell
cd C:\ai-game-lab
.\check-project.ps1
npm run visual-check
```

`npm run visual-check`는 로컬 Chrome/Edge로 데스크톱과 모바일 화면을 열고, WebGL 캔버스가 실제로 렌더링되는지 픽셀 검사까지 수행합니다.

## 파일 구조

```text
C:\ai-game-lab
├─ src
│  ├─ main.ts
│  └─ style.css
├─ docs
│  ├─ ai-prompts.md
│  ├─ game-idea-canvas.md
│  ├─ minecraft-roblox-readiness.md
│  └─ wilderness-game-notes.md
├─ scripts
│  └─ visual-check.mjs
├─ index.html
├─ package.json
└─ tsconfig.json
```

## 추천 진행 방식

1. `docs/game-idea-canvas.md`를 아이와 같이 채웁니다.
2. Codex에게 "이 아이디어를 현재 Three.js 1인칭 야생 게임에 반영해줘"라고 요청합니다.
3. `npm run dev` 화면에서 바로 놀아봅니다.
4. 한 번에 한 가지씩 바꿉니다. 예: 블록 설치, 동물 이동, 동굴 확장, 저장 기능.
5. 재미있어진 순간을 저장하려면 Git 커밋을 만듭니다.

## 아이와 함께할 때 좋은 약속

- 개인 정보, 학교 이름, 친구 이름은 게임 안에 넣지 않습니다.
- AI 답변은 정답이 아니라 초안으로 봅니다.
- 아이가 만든 규칙을 먼저 존중하고, 어른은 구현을 도와주는 역할을 합니다.
- 실패한 아이디어도 기록합니다. 게임 만들기에서는 실패가 좋은 재료가 됩니다.
