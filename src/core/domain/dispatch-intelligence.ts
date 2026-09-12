import type { ContentBundle, GameState, MarketOrder, VehicleUnitState } from "./model.js";
import { estimateRoadCost, findDirectRoad } from "./road-network.js";

export interface TripProjection {
  destinationCityId: string;
  revenueCents: number;
  costCents: number;
  netProfitCents: number;
  weightKg: number;
  volumeLiters: number;
  loadBasisPoints: number;
  lateOrderCount: number;
}

const loadedOrders = (state: Readonly<GameState>, vehicle: Readonly<VehicleUnitState>): MarketOrder[] =>
  vehicle.assignedOrderIds.map((id) => state.orders.find((order) => order.id === id)).filter((order): order is MarketOrder => Boolean(order));

export const projectLoadedTrip = (state: Readonly<GameState>, content: ContentBundle, vehicle: Readonly<VehicleUnitState>): TripProjection | null => {
  const orders = loadedOrders(state, vehicle);
  const model = content.vehicleModels.find((item) => item.id === vehicle.modelId);
  if (!orders.length || !model) return null;
  const destinationCityId = orders[0].destinationCityId;
  const road = findDirectRoad(content, vehicle.currentCityId, destinationCityId);
  if (!road) return null;
  const arrivesAt = state.clock.now + road.baseTravelSeconds;
  const revenueCents = orders.reduce((sum, order) => sum + (arrivesAt <= order.deadlineAt ? order.rewardCents : Math.round(order.rewardCents * 0.65)), 0);
  const weightKg = orders.reduce((sum, order) => sum + order.weightKg, 0);
  const volumeLiters = orders.reduce((sum, order) => sum + order.volumeLiters, 0);
  const loadBasisPoints = Math.round(Math.max(weightKg / model.capacityKg, volumeLiters / model.capacityLiters) * 10_000);
  const costCents = estimateRoadCost(road, model.baseConsumption);
  return {
    destinationCityId, revenueCents, costCents, netProfitCents: revenueCents - costCents,
    weightKg, volumeLiters, loadBasisPoints,
    lateOrderCount: orders.filter((order) => arrivesAt > order.deadlineAt).length
  };
};

export const findBestAdditionalLoad = (state: Readonly<GameState>, content: ContentBundle, vehicle: Readonly<VehicleUnitState>): string[] => {
  if (vehicle.status === "in_transit") return [];
  const model = content.vehicleModels.find((item) => item.id === vehicle.modelId);
  if (!model) return [];
  const existing = loadedOrders(state, vehicle);
  const fixedDestination = existing[0]?.destinationCityId;
  const candidates = state.orders.filter((order) =>
    order.status === "available" && order.originCityId === vehicle.currentCityId && (!fixedDestination || order.destinationCityId === fixedDestination)
  );
  let bestIds: string[] = [];
  let bestScore = Number.NEGATIVE_INFINITY;
  const destinations = fixedDestination ? [fixedDestination] : [...new Set(candidates.map((order) => order.destinationCityId))];
  const existingWeight = existing.reduce((sum, order) => sum + order.weightKg, 0);
  const existingVolume = existing.reduce((sum, order) => sum + order.volumeLiters, 0);

  for (const destination of destinations) {
    const road = findDirectRoad(content, vehicle.currentCityId, destination);
    if (!road) continue;
    const group = candidates.filter((order) => order.destinationCityId === destination).slice(0, 12);
    for (let mask = 1; mask < 2 ** group.length; mask += 1) {
      const picked = group.filter((_, index) => Boolean(mask & (1 << index)));
      const weight = existingWeight + picked.reduce((sum, order) => sum + order.weightKg, 0);
      const volume = existingVolume + picked.reduce((sum, order) => sum + order.volumeLiters, 0);
      if (weight > model.capacityKg || volume > model.capacityLiters) continue;
      const arrivesAt = state.clock.now + road.baseTravelSeconds;
      const revenue = [...existing, ...picked].reduce((sum, order) => sum + (arrivesAt <= order.deadlineAt ? order.rewardCents : Math.round(order.rewardCents * 0.65)), 0);
      const cost = estimateRoadCost(road, model.baseConsumption);
      const fullness = Math.max(weight / model.capacityKg, volume / model.capacityLiters);
      const score = revenue - cost + Math.round(fullness * 30_000);
      if (score > bestScore) {
        bestScore = score;
        bestIds = picked.map((order) => order.id);
      }
    }
  }
  return bestIds;
};
