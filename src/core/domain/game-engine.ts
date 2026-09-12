import { GAME_VERSION } from "../version.js";
import { INITIAL_FEATURE_FLAGS } from "../version.js";
import { estimateRoadCost, findDirectRoad, getAdjacentCities } from "./road-network.js";
import type { CommandResult, ContentBundle, EngineCommand, GameEvent, GameState, MarketOrder, VehicleUnitState } from "./model.js";

const MARKET_TARGET = 8;
const MAX_EVENT_LOG = 30;

const event = (state: GameState, type: string, message: string, amountCents?: number): GameEvent => ({
  id: `event_${state.clock.now}_${state.eventLog.length}_${type.toLowerCase()}`,
  type, occurredAt: state.clock.now, message, amountCents
});

export const createInitialState = (content: ContentBundle): GameState => ({
  saveVersion: 1,
  gameVersion: GAME_VERSION,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  contentPacks: [{ id: "content_pack_china_test_001", version: "0.1.0" }],
  featureFlags: { ...INITIAL_FEATURE_FLAGS },
  clock: { now: 8 * 3600, speed: 600, paused: false },
  company: {
    id: "company_player_001", name: "远行运输", cashCents: 8_000_000, debtCents: 4_200_000,
    reputationBasisPoints: 5_000, deliveredOrders: 0, onTimeOrders: 0,
    totalRevenueCents: 0, totalCostCents: 0, headquartersCityId: "city_nanyang_001"
  },
  vehicleUnits: [{
    id: "vehicle_unit_player_001", modelId: "vehicle_model_light_truck_001", currentCityId: "city_nanyang_001",
    status: "idle", conditionBasisPoints: 9_800, mileageMeters: 0, assignedOrderIds: [], trip: null
  }],
  orders: content.orderTemplates.map((order) => ({ ...order, availableAt: 8 * 3600 + order.availableAt, deadlineAt: 8 * 3600 + order.deadlineAt })),
  activeRoutes: [], eventLog: [], randomSeed: 260_912, nextOrderSerial: 9, migrationHistory: []
});

const nextRandom = (state: GameState): number => {
  state.randomSeed = (state.randomSeed * 1_664_525 + 1_013_904_223) >>> 0;
  return state.randomSeed / 4_294_967_296;
};

const replenishMarket = (state: GameState, content: ContentBundle): void => {
  while (state.orders.filter((order) => order.status === "available").length < MARKET_TARGET) {
    const origin = content.cities[Math.floor(nextRandom(state) * content.cities.length)];
    const adjacent = getAdjacentCities(content, origin.id);
    const destinationId = adjacent[Math.floor(nextRandom(state) * adjacent.length)];
    const cargo = content.cargoTypes[Math.floor(nextRandom(state) * content.cargoTypes.length)];
    const road = findDirectRoad(content, origin.id, destinationId);
    if (!road) continue;
    const weightKg = 420 + Math.floor(nextRandom(state) * 850);
    const volumeLiters = 1_800 + Math.floor(nextRandom(state) * 5_800);
    state.orders.push({
      id: `order_market_${String(state.nextOrderSerial++).padStart(5, "0")}`,
      cargoId: cargo.id, originCityId: origin.id, destinationCityId: destinationId, weightKg, volumeLiters,
      rewardCents: Math.round(90_000 + road.distanceMeters / 2.1 + weightKg * 42 + nextRandom(state) * 55_000),
      availableAt: state.clock.now, deadlineAt: state.clock.now + road.baseTravelSeconds + 18_000, status: "available"
    });
  }
};

const pushEvents = (state: GameState, events: GameEvent[]): void => {
  state.eventLog.unshift(...events);
  state.eventLog = state.eventLog.slice(0, MAX_EVENT_LOG);
};

const getVehicleAndModel = (state: GameState, content: ContentBundle, unitId: string) => {
  const vehicle = state.vehicleUnits.find((unit) => unit.id === unitId);
  const model = vehicle ? content.vehicleModels.find((item) => item.id === vehicle.modelId) : undefined;
  return { vehicle, model };
};

const assignedLoads = (state: GameState, vehicle: VehicleUnitState): MarketOrder[] =>
  vehicle.assignedOrderIds.map((id) => state.orders.find((order) => order.id === id)).filter((order): order is MarketOrder => Boolean(order));

export class GameEngine {
  constructor(private readonly content: ContentBundle, private readonly state: GameState) {
    replenishMarket(this.state, this.content);
  }

  snapshot(): Readonly<GameState> { return structuredClone(this.state); }

  dispatch(command: EngineCommand): CommandResult {
    const events: GameEvent[] = [];
    if (command.type === "AcceptOrder") {
      const order = this.state.orders.find((item) => item.id === command.orderId);
      if (!order || order.status !== "available") return { ok: false, errorCode: "ORDER_NOT_AVAILABLE", events };
      order.status = "accepted";
      events.push(event(this.state, "OrderAccepted", "订单已承接"));
    }

    if (command.type === "AssignTransportUnit") {
      const order = this.state.orders.find((item) => item.id === command.orderId);
      const { vehicle, model } = getVehicleAndModel(this.state, this.content, command.transportUnitId);
      if (!order || order.status !== "accepted" || !vehicle || !model) return { ok: false, errorCode: "ASSIGNMENT_INVALID", events };
      if (vehicle.status === "in_transit" || order.originCityId !== vehicle.currentCityId) return { ok: false, errorCode: "VEHICLE_NOT_AT_ORIGIN", events };
      const loads = assignedLoads(this.state, vehicle);
      if (loads.length && loads[0].destinationCityId !== order.destinationCityId) return { ok: false, errorCode: "MULTI_STOP_NOT_ENABLED", events };
      const weight = loads.reduce((sum, item) => sum + item.weightKg, 0) + order.weightKg;
      const volume = loads.reduce((sum, item) => sum + item.volumeLiters, 0) + order.volumeLiters;
      if (weight > model.capacityKg || volume > model.capacityLiters) return { ok: false, errorCode: "CAPACITY_EXCEEDED", events };
      vehicle.assignedOrderIds.push(order.id);
      vehicle.status = "loading";
      events.push(event(this.state, "CargoLoaded", "货物已装车"));
    }

    if (command.type === "StartTrip") {
      const { vehicle, model } = getVehicleAndModel(this.state, this.content, command.transportUnitId);
      if (!vehicle || !model || !vehicle.assignedOrderIds.length || vehicle.trip) return { ok: false, errorCode: "TRIP_NOT_READY", events };
      const loads = assignedLoads(this.state, vehicle);
      const destinationId = loads[0].destinationCityId;
      const road = findDirectRoad(this.content, vehicle.currentCityId, destinationId);
      if (!road) return { ok: false, errorCode: "NO_DIRECT_ROUTE", events };
      loads.forEach((order) => { order.status = "in_transit"; });
      vehicle.status = "in_transit";
      vehicle.trip = {
        routeId: road.id, fromCityId: vehicle.currentCityId, toCityId: destinationId,
        startedAt: this.state.clock.now, arrivesAt: this.state.clock.now + road.baseTravelSeconds,
        distanceMeters: road.distanceMeters, orderIds: [...vehicle.assignedOrderIds],
        projectedCostCents: estimateRoadCost(road, model.baseConsumption)
      };
      this.state.activeRoutes.push(road.id);
      events.push(event(this.state, "TripStarted", "车辆已发车"));
    }

    if (command.type === "AdvanceTime") {
      this.state.clock.now += command.elapsedGameSeconds;
      for (const vehicle of this.state.vehicleUnits) {
        if (!vehicle.trip || vehicle.trip.arrivesAt > this.state.clock.now) continue;
        const trip = vehicle.trip;
        const loads = assignedLoads(this.state, vehicle);
        const revenue = loads.reduce((sum, order) => sum + order.rewardCents, 0);
        const onTime = loads.filter((order) => trip.arrivesAt <= order.deadlineAt).length;
        loads.forEach((order) => { order.status = trip.arrivesAt <= order.deadlineAt ? "delivered" : "failed"; });
        this.state.company.cashCents += revenue - trip.projectedCostCents;
        this.state.company.totalRevenueCents += revenue;
        this.state.company.totalCostCents += trip.projectedCostCents;
        this.state.company.deliveredOrders += loads.length;
        this.state.company.onTimeOrders += onTime;
        vehicle.currentCityId = trip.toCityId;
        vehicle.mileageMeters += trip.distanceMeters;
        vehicle.conditionBasisPoints = Math.max(0, vehicle.conditionBasisPoints - Math.round(trip.distanceMeters / 4_000));
        vehicle.assignedOrderIds = [];
        vehicle.status = "idle";
        vehicle.trip = null;
        this.state.activeRoutes = this.state.activeRoutes.filter((routeId) => routeId !== trip.routeId);
        events.push(event(this.state, "DeliveryCompleted", `完成 ${loads.length} 单运输，净收入已入账`, revenue - trip.projectedCostCents));
      }
    }

    replenishMarket(this.state, this.content);
    pushEvents(this.state, events);
    return { ok: true, events };
  }
}
