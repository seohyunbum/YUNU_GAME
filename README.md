# AI Game Lab

초등학생 자녀와 함께 Codex 또는 Claude Code로 아이디어를 실제 게임으로 바꾸기 위한 로컬 프로젝트입니다.

## 지금 들어 있는 것

- Vite + TypeScript + Phaser 기반의 브라우저 게임 환경
- 바로 실행 가능한 샘플 게임 `별 정원`
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

## 파일 구조

```text
C:\ai-game-lab
├─ src
│  ├─ main.ts
│  └─ style.css
├─ docs
│  ├─ ai-prompts.md
│  └─ game-idea-canvas.md
├─ index.html
├─ package.json
└─ tsconfig.json
```

## 추천 진행 방식

1. `docs/game-idea-canvas.md`를 아이와 같이 채웁니다.
2. Codex에게 "이 아이디어를 현재 Phaser 게임에 반영해줘"라고 요청합니다.
3. `npm run dev` 화면에서 바로 놀아봅니다.
4. 한 번에 한 가지씩 바꿉니다. 예: 주인공, 배경, 점수 규칙, 장애물.
5. 재미있어진 순간을 저장하려면 Git 커밋을 만듭니다.

## 아이와 함께할 때 좋은 약속

- 개인 정보, 학교 이름, 친구 이름은 게임 안에 넣지 않습니다.
- AI 답변은 정답이 아니라 초안으로 봅니다.
- 아이가 만든 규칙을 먼저 존중하고, 어른은 구현을 도와주는 역할을 합니다.
- 실패한 아이디어도 기록합니다. 게임 만들기에서는 실패가 좋은 재료가 됩니다.
