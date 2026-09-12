export type EntityId = string;
export type MoneyCents = number;
export type DistanceMeters = number;
export type GameSeconds = number;
export type WeightKg = number;
export type VolumeLiters = number;
export type BasisPoints = number;

export type TransportMode =
  | "road_freight"
  | "road_passenger"
  | "rail"
  | "shipping"
  | "aviation";

export interface Capacity {
  weightKg: WeightKg;
  volumeLiters: VolumeLiters;
  seats: number;
}

export interface CargoLoad {
  orderId: EntityId;
  weightKg: WeightKg;
  volumeLiters: VolumeLiters;
  passengerCount: number;
}

export interface RouteStop {
  cityId: EntityId;
  arrivalAt: GameSeconds;
  departureAt: GameSeconds;
  loadOrderIds: EntityId[];
  unloadOrderIds: EntityId[];
}

export interface CostEstimate {
  energyCents: MoneyCents;
  tollCents: MoneyCents;
  laborCents: MoneyCents;
  maintenanceCents: MoneyCents;
  otherCents: MoneyCents;
  totalCents: MoneyCents;
}
