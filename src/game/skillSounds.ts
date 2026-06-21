// 스킬 시전(cast) 효과음 — 원소별 CC0 샘플 매핑(리프). main.ts 의 sample() 헬퍼가 이 맵으로 재생하고, 미로드 시 무음 폴백.
// 스킬은 시전 순간엔 playTone 비프만 있어 사실상 무음이었음 → 원소에 맞는 CC0 샘플로 또렷한 시전음 부여.
export type SkillElement = "fire" | "heal" | "wind" | "gun" | "buff" | "melee" | "earth" | "summon";

export const SKILL_SOUND: Record<SkillElement, { names: readonly string[]; volume: number }> = {
  fire: { names: ["spell_fire_04", "spell_fire_05"], volume: 0.5 }, // 화염 — 기존 80팩 CC0 재사용
  heal: { names: ["heal_cast.wav"], volume: 0.5 }, // 치유/신성 — "Magic Words+Healing: health_restore"(2s 트림) CC0
  wind: { names: ["wind_cast.wav"], volume: 0.42 }, // 바람/에어 — "Air whoosh" CC0
  gun: { names: ["gun_shot.wav"], volume: 0.34 }, // 총성 — "22 Magnum" CC0
  buff: { names: ["buff_cast.wav"], volume: 0.5 }, // 강화/버프 — "Magic Words"(powerup/cast) CC0
  melee: { names: ["blade_01", "blade_02", "blade_03"], volume: 0.45 }, // 근접 강타 — 기존 blade
  earth: { names: ["stones_01", "stones_02", "stones_03"], volume: 0.5 }, // 대지/광역 강타 — 기존 stones
  summon: { names: ["spell_01", "spell_02"], volume: 0.45 }, // 소환/마법 — 기존 spell
};

// 시전음에 쓰는 신규 비-ogg 포함 전체 샘플 이름(ensureAudio preload 용)
export const SKILL_SOUND_PRELOAD: readonly string[] = ["heal_cast.wav", "wind_cast.wav", "gun_shot.wav", "buff_cast.wav"];
