# 운영자 계정 리포트 (admin-report)

서버 운영자가 **필요할 때** 전체 계정 현황을 받아보는 오프라인 CLI 도구입니다.

## 실행

```bash
npm run admin-report                      # Edge + Chrome 자동 스냅샷 → 집계
npm run admin-report -- --browser edge    # Edge 만
npm run admin-report -- --snapshot <dir>  # 미리 만든 leveldb 스냅샷 폴더 사용
npm run admin-report -- --json out.json   # JSON 저장 경로 지정
```

콘솔에 닉네임별 요약을 출력하고, 동시에 `admin-reports/admin-report-<시각>.json` 으로
기록을 남깁니다(플레이어 데이터라 `admin-reports/` 는 git 에서 제외됨).

## 집계 항목 (닉네임별)

- **최고 레벨** + 직업, **직업별 최고 레벨**
- **세이브 수** (명명 슬롯 + 자동 백업 이력 포함, 저장 시각 기준 중복 제거)
- **누적 걸음수** — 활동량 지표
- **저장 기록 범위** (첫 저장 → 마지막 저장)
- **플레이 환경** (Edge/Chrome × 로컬/배포 origin)
- **친구 목록** (소셜 디렉터리)

## 구조상 한계 (중요)

이 게임은 **중앙 서버가 없는** 브라우저 localStorage + PeerJS P2P 게임입니다.

- 각 플레이어의 계정·세이브는 **그 사람 PC 의 브라우저에만** 저장됩니다.
- 따라서 이 도구는 **명령을 실행한 머신의 브라우저에서 플레이된 계정만** 봅니다.
  원격 플레이어의 데이터를 한곳에서 모아 보려면 별도 계정 서버가 필요합니다.
- **GameMaster/운영자 계정은 없습니다.** `gm · admin · 운영자 · 관리자 · 시스템 ·
  operator` 는 닉네임 등록이 차단된 예약어입니다.
- **실제 플레이타임(벽시계)은 기록하지 않습니다.** 활동량은 누적 걸음수와 저장 시각
  범위로 추정합니다. 정확한 플레이타임이 필요하면 세이브에 `playSeconds` 누적 필드를
  추가해야 합니다(별도 작업).

## 동작 방식

라이브 브라우저 DB 는 잠겨 있어 직접 못 열기에, leveldb 파일을 임시 폴더로 복사(LOCK
제외)한 뒤 `classic-level` 로 현재값을 읽습니다. localStorage 값의 Chromium 인코딩
(UTF-16/Latin-1 태그)과 압축 세이브(deflate-raw + base64)를 해제해 집계합니다.
