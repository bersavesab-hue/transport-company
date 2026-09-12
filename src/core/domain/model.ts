import type { BasisPoints, EntityId, GameSeconds, MoneyCents } from "../contracts/types.js";

export interface CityDefinition { id: EntityId; name: string; level: string; x: number; y: number; modes: string[]; industryTags: string[]; active: boolean; }
export interface RoadDefinition { id: EntityId; from: EntityId; to: EntityId; mode: "road"; distanceMeters: number; baseTravelSeconds: number; tollCents: MoneyCents; active: boolean; }
export interface CargoDefinition { id: EntityId; name: string; temperature: string; fragility: number; active: boolean; }
export interface VehicleModelDefinition { id: EntityId; name: string; mode: "road_freight"; capacityKg: number; capacityLiters: number; purchasePriceCents: MoneyCents; baseConsumption: number; assetId: string; active: boolean; }
export interface MarketEventDefinition { id: EntityId; headline: string; cityId: EntityId; cargoId: EntityId; demandModifierBasisPoints: BasisPoints; durationSeconds: GameSeconds; active: boolean; }
export type OrderStatus = "available" | "accepted" | "in_transit" | "delivered" | "failed" | "cancelled";
export interface OrderTemplate { id: EntityId; cargoId: EntityId; originCityId: EntityId; destinationCityId: EntityId; weightKg: number; volumeLiters: number; rewardCents: MoneyCents; availableAt: GameSeconds; deadlineAt: GameSeconds; status: OrderStatus; }
export interface ContentBundle { cities: CityDefinition[]; routes: RoadDefinition[]; cargoTypes: CargoDefinition[]; vehicleModels: VehicleModelDefinition[]; orderTemplates: OrderTemplate[]; marketEvents: MarketEventDefinition[]; }
export interface MarketOrder extends OrderTemplate { status: OrderStatus; }
export interface TripState { routeId: EntityId; fromCityId: EntityId; toCityId: EntityId; startedAt: GameSeconds; arrivesAt: GameSeconds; distanceMeters: number; orderIds: EntityId[]; projectedCostCents: MoneyCents; }
export interface VehicleUnitState { id: EntityId; modelId: EntityId; currentCityId: EntityId; status: "idle" | "loading" | "in_transit"; conditionBasisPoints: BasisPoints; mileageMeters: number; assignedOrderIds: EntityId[]; trip: TripState | null; }
export interface CompanyState { id: EntityId; name: string; cashCents: MoneyCents; debtCents: MoneyCents; reputationBasisPoints: BasisPoints; deliveredOrders: number; onTimeOrders: number; totalRevenueCents: MoneyCents; totalCostCents: MoneyCents; headquartersCityId: EntityId; }
export interface GameEvent { id: EntityId; type: string; occurredAt: GameSeconds; message: string; amountCents?: MoneyCents; }
export interface MarketState { periodIndex: number; activeEventId: EntityId | null; startedAt: GameSeconds; endsAt: GameSeconds; }
export interface GameState { saveVersion: number; gameVersion: string; createdAt: string; updatedAt: string; contentPacks: Array<{ id: string; version: string }>; featureFlags: Record<string, boolean>; clock: { now: GameSeconds; speed: number; paused: boolean }; company: CompanyState; vehicleUnits: VehicleUnitState[]; orders: MarketOrder[]; activeRoutes: EntityId[]; eventLog: GameEvent[]; market: MarketState; randomSeed: number; nextOrderSerial: number; migrationHistory: string[]; }
export type EngineCommand = { type: "AcceptOrder"; orderId: EntityId } | { type: "AssignTransportUnit"; orderId: EntityId; transportUnitId: EntityId } | { type: "UnassignTransportUnit"; orderId: EntityId; transportUnitId: EntityId } | { type: "StartTrip"; transportUnitId: EntityId } | { type: "AdvanceTime"; elapsedGameSeconds: GameSeconds } | { type: "SetClock"; speed: number; paused: boolean };
export interface CommandResult { ok: boolean; errorCode?: string; events: GameEvent[]; }
