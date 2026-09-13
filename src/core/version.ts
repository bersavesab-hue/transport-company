export const GAME_VERSION = "0.6.1" as const;
export const CURRENT_SAVE_VERSION = 4 as const;

export const INITIAL_FEATURE_FLAGS = {
  roadFreight: true,
  dynamicMarket: true,
  smartDispatch: true,
  cityIntelligence: true,
  fleetExpansion: true,
  multiStopRouting: true,
  customerContracts: true,
  scalableMap: true,
  roadPassenger: false,
  rail: false,
  shipping: false,
  aviation: false,
  internationalMap: false,
  npcCompetition: false,
  dealership: true,
  usedVehicleMarket: true
} as const;
