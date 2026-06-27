// 닉네임 시스템 (파티 시스템 1차) — 최초 1회 설정, 이후 변경 불가.
// 중복 검사는 현재 이 브라우저의 사용 이력(레지스트리) 기준이며,
// 멀티플레이 서버가 붙으면 validateNickname 의 takenNames 자리에 서버 조회 결과를 넣는다.

export const NICKNAME_KEY = "ai-game-lab:nickname-v1";
export const NICKNAME_REGISTRY_KEY = "ai-game-lab:nickname-registry-v1";

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 10;

// 허용: 한글(완성형·자모)·영문·숫자·공백·대부분의 특수문자.
// 차단(아래 문자만): Firebase 실시간DB 키 금지문자(. # $ [ ] /), HTML 특수문자(< > & " '), 제어문자.
//   - 닉네임은 랭킹/파티/친구에서 DB 키로, 화면에서 innerHTML 로 쓰이므로 이 문자들만 막으면 안전하다.
const NICKNAME_FORBIDDEN = /[.#$/[\]<>&"'\x00-\x1F\x7F]/;

// 금지어 — 정규화(소문자·구분자 제거) 후 부분일치로 검사한다
const BANNED_WORDS = [
  "시발", "씨발", "씨빨", "씨바", "쉬발", "ㅅㅂ", "ㅆㅂ",
  "병신", "븅신", "ㅂㅅ", "빙신",
  "새끼", "색기", "개새", "개색",
  "좆", "존나", "졸라", "ㅈㄴ",
  "지랄", "ㅈㄹ",
  "미친놈", "미친년", "또라이", "닥쳐", "꺼져",
  "fuck", "fxck", "shit", "bitch", "asshole", "sex", "porn",
];

// 시스템 예약어 — 사칭 방지
const RESERVED_NAMES = ["관리자", "운영자", "시스템", "admin", "system", "gm", "operator"];

export type NicknameValidation = { ok: true; name: string } | { ok: false; reason: string };

function normalizeForFilter(value: string) {
  // 영숫자·한글(완성형/자모)만 남기고 전부 제거 → 공백·기호로 우회한 비속어("시 발", "시*발", "ㅅ.ㅂ")도 검출
  return value.toLowerCase().replace(/[^가-힣ㄱ-ㅎㅏ-ㅣa-z0-9]/g, "");
}

export function validateNickname(raw: string, takenNames: readonly string[]): NicknameValidation {
  const name = raw.trim().replace(/\s+/g, " "); // 양끝 공백 제거 + 내부 연속 공백을 한 칸으로 정규화
  if (name.length < NICKNAME_MIN_LENGTH) return { ok: false, reason: `닉네임은 ${NICKNAME_MIN_LENGTH}글자 이상이어야 합니다.` };
  if (name.length > NICKNAME_MAX_LENGTH) return { ok: false, reason: `닉네임은 ${NICKNAME_MAX_LENGTH}글자 이하여야 합니다.` };
  if (NICKNAME_FORBIDDEN.test(name)) return { ok: false, reason: `다음 문자는 쓸 수 없습니다: < > & " ' . # $ [ ] / 와 제어문자` };
  const normalized = normalizeForFilter(name);
  if (BANNED_WORDS.some((word) => normalized.includes(normalizeForFilter(word)))) {
    return { ok: false, reason: "비속어나 욕설이 들어간 닉네임은 사용할 수 없습니다." };
  }
  if (RESERVED_NAMES.some((reserved) => normalized === normalizeForFilter(reserved))) {
    return { ok: false, reason: "시스템 예약어는 닉네임으로 사용할 수 없습니다." };
  }
  if (takenNames.some((taken) => normalizeForFilter(taken) === normalized)) {
    return { ok: false, reason: "이미 있는 닉네임입니다. 다른 닉네임을 정해 주세요." };
  }
  return { ok: true, name };
}

export function loadNickname(storage: Storage = localStorage): string | null {
  try {
    if (import.meta.env.DEV && typeof location !== "undefined") {
      const override = new URLSearchParams(location.search).get("nickname");
      if (override && override.trim().length > 0) return override.trim();
    }
    const stored = storage.getItem(NICKNAME_KEY);
    return stored && stored.trim().length > 0 ? stored : null;
  } catch {
    return null;
  }
}

export function loadNicknameRegistry(storage: Storage = localStorage): string[] {
  try {
    const raw = storage.getItem(NICKNAME_REGISTRY_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

// 확정 — 유효하면 저장하고 레지스트리에 등록한다. 이미 확정된 닉네임이 있으면 절대 덮어쓰지 않는다.
export function confirmNickname(raw: string, storage: Storage = localStorage): NicknameValidation {
  const existing = loadNickname(storage);
  if (existing) return { ok: false, reason: "닉네임은 한 번 정하면 변경할 수 없습니다." };
  const result = validateNickname(raw, loadNicknameRegistry(storage));
  if (!result.ok) return result;
  try {
    storage.setItem(NICKNAME_KEY, result.name);
    storage.setItem(NICKNAME_REGISTRY_KEY, JSON.stringify([...loadNicknameRegistry(storage), result.name]));
  } catch {
    return { ok: false, reason: "닉네임을 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요." };
  }
  return result;
}
