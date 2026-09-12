export const GAME_VERSION = "0.3.0" as const;
export const CURRENT_SAVE_VERSION = 2 as const;

export const INITIAL_FEATURE_FLAGS = {
  roadFreight: true,
  dynamicMarket: true,
  smartDispatch: true,
  cityIntelligence: true,
  roadPassenger: false,
  rail: false,
  shipping: false,
  aviation: false,
  internationalMap: false,
  npcCompetition: false,
  dealership: false,
  usedVehicleMarket: false
} as const;
