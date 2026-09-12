import type { ContentBundle, GameState, MarketEventDefinition } from "./model.js";

export const MARKET_PERIOD_SECONDS = 21_600;

const stableHash = (value: string): number => {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
};

export const getActiveMarketEvent = (state: Readonly<GameState>, content: ContentBundle): MarketEventDefinition | undefined =>
  state.featureFlags.dynamicMarket === false ? undefined : content.marketEvents.find((item) => item.id === state.market.activeEventId && item.active && item.durationSeconds > 0);

export const getMarketIndexBasisPoints = (state: Readonly<GameState>, content: ContentBundle, cityId: string, cargoId?: string): number => {
  if (state.featureFlags.dynamicMarket === false) return 10_000;
  const cycle = stableHash(`${cityId}:${cargoId ?? "all"}:${state.market.periodIndex}`) % 2_401;
  let index = 8_900 + cycle;
  const activeEvent = getActiveMarketEvent(state, content);
  if (activeEvent?.cityId === cityId && (!cargoId || activeEvent.cargoId === cargoId)) {
    index += cargoId ? activeEvent.demandModifierBasisPoints : Math.round(activeEvent.demandModifierBasisPoints / 2);
  }
  return index;
};

export const getCityMarketTone = (indexBasisPoints: number): string => {
  if (indexBasisPoints >= 12_000) return "火热";
  if (indexBasisPoints >= 10_500) return "活跃";
  if (indexBasisPoints < 9_500) return "偏冷";
  return "平稳";
};
