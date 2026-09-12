import type {
  Capacity,
  CargoLoad,
  CostEstimate,
  DistanceMeters,
  EntityId,
  GameSeconds,
  RouteStop,
  TransportMode
} from "./types.js";

export interface TransportUnitSnapshot {
  id: EntityId;
  modelId: EntityId;
  mode: TransportMode;
  currentCityId: EntityId | null;
  capacity: Capacity;
  loads: CargoLoad[];
  conditionBasisPoints: number;
  mileageMeters: DistanceMeters;
  availableAt: GameSeconds;
}

export interface RoutePlan {
  id: EntityId;
  mode: TransportMode;
  stops: RouteStop[];
  totalDistanceMeters: DistanceMeters;
  emptyDistanceMeters: DistanceMeters;
}

export interface ValidationResult {
  ok: boolean;
  errorCodes: string[];
}

export interface TransportModeAdapter {
  readonly mode: TransportMode;
  validateCapacity(unit: TransportUnitSnapshot, loads: CargoLoad[]): ValidationResult;
  validateRoute(unit: TransportUnitSnapshot, plan: RoutePlan): ValidationResult;
  estimateDuration(unit: TransportUnitSnapshot, plan: RoutePlan): GameSeconds;
  estimateCost(unit: TransportUnitSnapshot, plan: RoutePlan): CostEstimate;
}
