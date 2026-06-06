export type RewardSource =
  | "tree"
  | "dig"
  | "ore"
  | "animal"
  | "predator"
  | "boss"
  | "jammini"
  | "antHill"
  | "guard"
  | "foodStorage";

interface RewardTuning {
  quantityMultiplier?: number;
  minRandomMultiplier?: number;
  maxRandomMultiplier?: number;
  chanceMultiplier?: number;
}

interface OperatorRewardEvent extends RewardTuning {
  id: string;
  name: string;
  enabled: boolean;
  startsAt?: string;
  endsAt?: string;
  sources?: RewardSource[];
  items?: string[];
}

interface EffectiveRewardTuning {
  quantityEnabled: boolean;
  quantityMultiplier: number;
  minRandomMultiplier: number;
  maxRandomMultiplier: number;
  chanceMultiplier: number;
}

export const OPERATOR_REWARD_CONFIG = {
  quantity: {
    enabled: true,
    quantityMultiplier: 1,
    minRandomMultiplier: 1,
    maxRandomMultiplier: 3,
  },
  chance: {
    chanceMultiplier: 1,
  },
  sourceOverrides: {} as Partial<Record<RewardSource, RewardTuning>>,
  itemOverrides: {} as Record<string, RewardTuning>,
  activeEvents: [
    /*
    {
      id: "weekend-harvest-up",
      name: "주말 채집 2배 이벤트",
      enabled: false,
      startsAt: "2026-06-06T00:00:00+09:00",
      endsAt: "2026-06-08T00:00:00+09:00",
      sources: ["tree", "dig", "ore"],
      quantityMultiplier: 2,
      maxRandomMultiplier: 3,
      chanceMultiplier: 1.2,
    },
    */
  ] as OperatorRewardEvent[],
};

export function getRewardTuning(source: RewardSource, item: string, now = new Date()): EffectiveRewardTuning {
  const tuning: EffectiveRewardTuning = {
    quantityEnabled: OPERATOR_REWARD_CONFIG.quantity.enabled,
    quantityMultiplier: positiveNumber(OPERATOR_REWARD_CONFIG.quantity.quantityMultiplier, 1),
    minRandomMultiplier: positiveNumber(OPERATOR_REWARD_CONFIG.quantity.minRandomMultiplier, 1),
    maxRandomMultiplier: positiveNumber(OPERATOR_REWARD_CONFIG.quantity.maxRandomMultiplier, 1),
    chanceMultiplier: positiveNumber(OPERATOR_REWARD_CONFIG.chance.chanceMultiplier, 1),
  };

  applyRewardTuning(tuning, OPERATOR_REWARD_CONFIG.sourceOverrides[source]);
  applyRewardTuning(tuning, OPERATOR_REWARD_CONFIG.itemOverrides[item]);

  for (const event of OPERATOR_REWARD_CONFIG.activeEvents) {
    if (!isEventActive(event, now)) continue;
    if (event.sources && !event.sources.includes(source)) continue;
    if (event.items && !event.items.includes(item)) continue;
    applyRewardTuning(tuning, event);
  }

  if (!tuning.quantityEnabled) {
    tuning.quantityMultiplier = 1;
    tuning.minRandomMultiplier = 1;
    tuning.maxRandomMultiplier = 1;
  }
  if (tuning.maxRandomMultiplier < tuning.minRandomMultiplier) {
    tuning.maxRandomMultiplier = tuning.minRandomMultiplier;
  }

  return tuning;
}

function applyRewardTuning(target: EffectiveRewardTuning, source: RewardTuning | undefined) {
  if (!source) return;
  if (source.quantityMultiplier !== undefined) target.quantityMultiplier = positiveNumber(source.quantityMultiplier, target.quantityMultiplier);
  if (source.minRandomMultiplier !== undefined) target.minRandomMultiplier = positiveNumber(source.minRandomMultiplier, target.minRandomMultiplier);
  if (source.maxRandomMultiplier !== undefined) target.maxRandomMultiplier = positiveNumber(source.maxRandomMultiplier, target.maxRandomMultiplier);
  if (source.chanceMultiplier !== undefined) target.chanceMultiplier = positiveNumber(source.chanceMultiplier, target.chanceMultiplier);
}

function isEventActive(event: OperatorRewardEvent, now: Date) {
  if (!event.enabled) return false;
  const nowMs = now.getTime();
  if (event.startsAt && nowMs < Date.parse(event.startsAt)) return false;
  if (event.endsAt && nowMs >= Date.parse(event.endsAt)) return false;
  return true;
}

function positiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
