# 무장 초상 일러스트 생성 가이드 (AI아트 프롬프트 시트)

> 게임 내 무장 카드·초빙 리빌에 쓰일 초상 일러스트를 AI 이미지 서비스(미드저니·NanoBanana 등)로 생성해 넣는 가이드.
> **가족 전용 사적 이용** 전제 (스펙 §0 IP 정책 — 퍼블릭 공개·상업화·외부 공유 금지).

## 적용 방법 (3단계)

1. 아래 프롬프트로 이미지 생성 → **세로형 4:5** (권장 1024×1280 이상)
2. 파일명을 정확히 맞춰 저장 → `ue/WorldConquestUE/RawAssets/Portraits/<캐릭터id>.png` 덮어쓰기
3. 임포트 실행 (또는 Claude 에게 "초상 임포트" 요청):
   ```
   UnrealEditor-Cmd.exe C:\Users\Public\wc-game\ue\WorldConquestUE\WorldConquestUE.uproject -run=pythonscript -script="...\Scripts\import_portraits.py" -unattended
   ```

## 공통 스타일 접두 (모든 프롬프트 앞에 붙이기 — 카드 전체 톤 통일)

```
epic strategy game character portrait, painterly semi-realistic style, dramatic rim lighting,
dark atmospheric background, bust shot facing slightly left, ornate detailed costume,
rich color grading, game card art quality --ar 4:5
```

## 캐릭터별 프롬프트

| 파일명 | 캐릭터 | 프롬프트 (공통 접두 + 아래) |
|---|---|---|
| `yi_sunsin.png` | 이순신 ★5 | Joseon dynasty admiral in ornate turtle-ship-motif armor, stern wise gaze, naval commander's robe over lamellar armor, dark sea and warship silhouettes behind |
| `cao_cao.png` | 조조 ★5 | Chinese Three Kingdoms warlord, sharp cunning eyes, black and gold imperial armor with dragon motifs, commanding presence, banners of Wei behind |
| `guan_yu.png` | 관우 ★5 | legendary Chinese general with long flowing black beard, green robe over heavy armor, guandao blade over shoulder, solemn loyal expression, red-crowned phoenix motif |
| `napoleon.png` | 나폴레옹 ★5 | early 19th century French emperor in bicorne hat and navy military coat with gold epaulettes, hand tucked in coat, battlefield smoke behind |
| `jeanne_darc.png` | 잔 다르크 ★4 | young French saint knight in polished silver plate armor with white and gold banner, short hair, determined pure gaze, holy light rays |
| `kamado_tanjiro.png` | 카마도 탄지로 ★4 | kind-eyed young swordsman with checkered green-black haori, scar on forehead, hanafuda earrings, water-breathing wave effect around katana |
| `sung_jinwoo.png` | 성진우 ★5 | dark-haired shadow monarch hunter in sleek black coat, glowing purple-blue shadow soldiers rising behind, cold sharp eyes |
| `iron_man.png` | 아이언맨 ★5 | red and gold powered armor suit portrait, glowing arc reactor in chest, helmet off showing confident genius smirk, holographic HUD lights |
| `saber_artoria.png` | 세이버 ★5 | golden-haired knight king in blue and silver armored dress, invisible-wind-wrapped holy sword, regal green eyes, royal dignity |
| `mash_kyrielight.png` | 마슈 ★4 | gentle purple-haired shielder in black-violet armor holding massive cross shield, kind protective gaze, soft magical glow |

## 규격·주의

- **얼굴이 상단 1/3** 에 오게 (카드 크롭·리빌 프레임 300×375 기준)
- 배경은 어둡게 — 게임 UI(다크+골드)와 조화
- 같은 세션/모델·같은 공통 접두로 한 번에 생성해야 톤이 통일됨
- IP 캐릭터(탄지로·성진우·아이언맨·세이버·마슈)는 **가족 전용 게임 내부 사용만** — repo 는 비공개 유지
