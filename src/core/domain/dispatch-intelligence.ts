import type { ContentBundle, GameState, MarketOrder, VehicleUnitState } from "./model.js";
import { estimateRoadCost } from "./road-network.js";
import { planMultiStopRoute, resolveRoadDestination } from "./route-planning.js";

export interface TripProjection {
  destinationCityId: string;
  revenueCents: number;
  costCents: number;
  netProfitCents: number;
  weightKg: number;
  volumeLiters: number;
  loadBasisPoints: number;
  lateOrderCount: number;
  stopCityIds: string[];
  routeIds: string[];
  distanceMeters: number;
  travelSeconds: number;
}

const loadedOrders = (state: Readonly<GameState>, vehicle: Readonly<VehicleUnitState>): MarketOrder[] =>
  vehicle.assignedOrderIds.map((id) => state.orders.find((order) => order.id === id)).filter((order): order is MarketOrder => Boolean(order));

const contractedRevenue = (state: Readonly<GameState>, content: ContentBundle, order: MarketOrder, baseRevenue: number): number => {
  const contract = state.customerContracts.find((active) => {
    const definition = content.customerContracts.find((item) => item.id === active.definitionId);
    return definition?.originCityId === order.originCityId && definition.destinationCityId === order.destinationCityId && definition.cargoId === order.cargoId;
  });
  const definition = contract ? content.customerContracts.find((item) => item.id === contract.definitionId) : undefined;
  return baseRevenue + (definition ? Math.round(baseRevenue * definition.rewardBonusBasisPoints / 10_000) : 0);
};

const projectOrders = (state: Readonly<GameState>, content: ContentBundle, vehicle: Readonly<VehicleUnitState>, orders: readonly MarketOrder[]): TripProjection | null => {
  const model = content.vehicleModels.find((item) => item.id === vehicle.modelId);
  if (!orders.length || !model) return null;
  const plan = planMultiStopRoute(content, vehicle.currentCityId, orders.map((order) => order.destinationCityId));
  if (!plan) return null;
  const arrivalByCity = new Map<string, number>();
  let currentCityId = vehicle.currentCityId;
  let arrivesAt = state.clock.now;
  let costCents = 0;
  for (const routeId of plan.routeIds) {
    const road = content.routes.find((item) => item.id === routeId)!;
    currentCityId = resolveRoadDestination(road, currentCityId)!;
    arrivesAt += road.baseTravelSeconds;
    costCents += estimateRoadCost(road, model.baseConsumption);
    if (!arrivalByCity.has(currentCityId)) arrivalByCity.set(currentCityId, arrivesAt);
  }
  const revenueCents = orders.reduce((sum, order) => {
    const baseRevenue = (arrivalByCity.get(order.destinationCityId) ?? Number.POSITIVE_INFINITY) <= order.deadlineAt ? order.rewardCents : Math.round(order.rewardCents * 0.65);
    return sum + contractedRevenue(state, content, order, baseRevenue);
  }, 0);
  const weightKg = orders.reduce((sum, order) => sum + order.weightKg, 0);
  const volumeLiters = orders.reduce((sum, order) => sum + order.volumeLiters, 0);
  const loadBasisPoints = Math.round(Math.max(weightKg / model.capacityKg, volumeLiters / model.capacityLiters) * 10_000);
  return {
    destinationCityId: plan.stopCityIds.at(-1)!, revenueCents, costCents, netProfitCents: revenueCents - costCents,
    weightKg, volumeLiters, loadBasisPoints,
    lateOrderCount: orders.filter((order) => (arrivalByCity.get(order.destinationCityId) ?? Number.POSITIVE_INFINITY) > order.deadlineAt).length,
    stopCityIds: plan.stopCityIds, routeIds: plan.routeIds, distanceMeters: plan.distanceMeters, travelSeconds: plan.travelSeconds
  };
};

export const projectLoadedTrip = (state: Readonly<GameState>, content: ContentBundle, vehicle: Readonly<VehicleUnitState>): TripProjection | null =>
  projectOrders(state, content, vehicle, loadedOrders(state, vehicle));

export const findBestAdditionalLoad = (state: Readonly<GameState>, content: ContentBundle, vehicle: Readonly<VehicleUnitState>): string[] => {
  if (vehicle.status === "in_transit") return [];
  const model = content.vehicleModels.find((item) => item.id === vehicle.modelId);
  if (!model) return [];
  const existing = loadedOrders(state, vehicle);
  const fixedDestination = state.featureFlags.multiStopRouting === false ? existing[0]?.destinationCityId : undefined;
  const candidates = state.orders.filter((order) =>
    order.status === "available" && order.originCityId === vehicle.currentCityId &&
    model.capabilities.includes(content.cargoTypes.find((cargo) => cargo.id === order.cargoId)?.temperature ?? "ambient") &&
    (!fixedDestination || order.destinationCityId === fixedDestination)
  ).slice(0, 12);
  let bestIds: string[] = [];
  let bestScore = Number.NEGATIVE_INFINITY;
  const existingWeight = existing.reduce((sum, order) => sum + order.weightKg, 0);
  const existingVolume = existing.reduce((sum, order) => sum + order.volumeLiters, 0);

  for (let mask = 1; mask < 2 ** candidates.length; mask += 1) {
      const picked = candidates.filter((_, index) => Boolean(mask & (1 << index)));
      const weight = existingWeight + picked.reduce((sum, order) => sum + order.weightKg, 0);
      const volume = existingVolume + picked.reduce((sum, order) => sum + order.volumeLiters, 0);
      if (weight > model.capacityKg || volume > model.capacityLiters) continue;
      const plan = planMultiStopRoute(content, vehicle.currentCityId, [...existing, ...picked].map((order) => order.destinationCityId));
      if (!plan) continue;
      const projection = projectOrders(state, content, vehicle, [...existing, ...picked]);
      if (!projection) continue;
      const fullness = Math.max(weight / model.capacityKg, volume / model.capacityLiters);
      const extraStopPenalty = Math.max(0, plan.stopCityIds.length - 1) * 8_000;
      const score = projection.netProfitCents - extraStopPenalty + Math.round(fullness * 30_000);
      if (score > bestScore) {
        bestScore = score;
        bestIds = picked.map((order) => order.id);
      }
  }
  return bestIds;
};
