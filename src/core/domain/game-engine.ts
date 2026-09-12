import { CURRENT_SAVE_VERSION, GAME_VERSION, INITIAL_FEATURE_FLAGS } from "../version.js";
import { getActiveMarketEvent, getMarketIndexBasisPoints, MARKET_PERIOD_SECONDS } from "./market-intelligence.js";
import { estimateRoadCost, findDirectRoad, getAdjacentCities } from "./road-network.js";
import type { CommandResult, ContentBundle, EngineCommand, GameEvent, GameState, MarketOrder, VehicleUnitState } from "./model.js";

const MARKET_TARGET = 8;
const MAX_EVENT_LOG = 30;

const event = (state: GameState, type: string, message: string, amountCents?: number): GameEvent => ({
  id: `event_${state.clock.now}_${state.eventLog.length}_${type.toLowerCase()}`,
  type, occurredAt: state.clock.now, message, amountCents
});

export const createInitialState = (content: ContentBundle): GameState => ({
  saveVersion: CURRENT_SAVE_VERSION,
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
  activeRoutes: [], eventLog: [],
  market: {
    periodIndex: Math.floor(8 * 3600 / MARKET_PERIOD_SECONDS),
    activeEventId: content.marketEvents.find((item) => item.active)?.id ?? null,
    startedAt: Math.floor(8 * 3600 / MARKET_PERIOD_SECONDS) * MARKET_PERIOD_SECONDS,
    endsAt: (Math.floor(8 * 3600 / MARKET_PERIOD_SECONDS) + 1) * MARKET_PERIOD_SECONDS
  },
  randomSeed: 260_912, nextOrderSerial: 9, migrationHistory: []
});

const nextRandom = (state: GameState): number => {
  state.randomSeed = (state.randomSeed * 1_664_525 + 1_013_904_223) >>> 0;
  return state.randomSeed / 4_294_967_296;
};

const migrateSaveV1ToV2 = (state: GameState, content: ContentBundle): void => {
  const periodIndex = Math.floor(state.clock.now / MARKET_PERIOD_SECONDS);
  state.market = {
    periodIndex,
    activeEventId: content.marketEvents.find((item) => item.active)?.id ?? null,
    startedAt: periodIndex * MARKET_PERIOD_SECONDS,
    endsAt: (periodIndex + 1) * MARKET_PERIOD_SECONDS
  };
  if (!state.migrationHistory.includes("save_v1_to_v2_dynamic_market")) state.migrationHistory.push("save_v1_to_v2_dynamic_market");
};

const migrateState = (state: GameState, content: ContentBundle): void => {
  state.featureFlags = { ...INITIAL_FEATURE_FLAGS, ...state.featureFlags };
  if (state.saveVersion < 2 || !state.market) migrateSaveV1ToV2(state, content);
  state.saveVersion = CURRENT_SAVE_VERSION;
  state.gameVersion = GAME_VERSION;
};

const refreshMarketPeriod = (state: GameState, content: ContentBundle): GameEvent | null => {
  if (state.featureFlags.dynamicMarket === false) return null;
  const periodIndex = Math.floor(state.clock.now / MARKET_PERIOD_SECONDS);
  if (periodIndex === state.market.periodIndex && state.clock.now < state.market.endsAt) return null;
  const activeEvents = content.marketEvents.filter((item) => item.active);
  const selected = activeEvents[Math.floor(nextRandom(state) * activeEvents.length)];
  state.market = {
    periodIndex,
    activeEventId: selected?.id ?? null,
    startedAt: state.clock.now,
    endsAt: state.clock.now + (selected?.durationSeconds ?? MARKET_PERIOD_SECONDS)
  };
  return selected ? event(state, "MarketShift", selected.headline) : null;
};

const replenishMarket = (state: GameState, content: ContentBundle): void => {
  while (state.orders.filter((order) => order.status === "available").length < MARKET_TARGET) {
    const activeEvent = getActiveMarketEvent(state, content);
    const eventAdjacent = activeEvent ? getAdjacentCities(content, activeEvent.cityId) : [];
    const followEvent = Boolean(activeEvent && eventAdjacent.length && nextRandom(state) < 0.55);
    const randomOrigin = content.cities[Math.floor(nextRandom(state) * content.cities.length)];
    const origin = followEvent
      ? content.cities.find((city) => city.id === eventAdjacent[Math.floor(nextRandom(state) * eventAdjacent.length)]) ?? randomOrigin
      : randomOrigin;
    const adjacent = getAdjacentCities(content, origin.id);
    const destinationId = followEvent && activeEvent ? activeEvent.cityId : adjacent[Math.floor(nextRandom(state) * adjacent.length)];
    const cargo = followEvent && activeEvent
      ? content.cargoTypes.find((item) => item.id === activeEvent.cargoId)!
      : content.cargoTypes[Math.floor(nextRandom(state) * content.cargoTypes.length)];
    const road = findDirectRoad(content, origin.id, destinationId);
    if (!road) continue;
    const weightKg = 420 + Math.floor(nextRandom(state) * 850);
    const volumeLiters = 1_800 + Math.floor(nextRandom(state) * 5_800);
    const operatingCost = estimateRoadCost(road, content.vehicleModels[0].baseConsumption);
    const marketIndex = getMarketIndexBasisPoints(state, content, destinationId, cargo.id);
    const cargoPremium = cargo.temperature === "chilled" ? 24_000 : cargo.fragility * 260;
    const baseReward = operatingCost + 48_000 + Math.round(road.distanceMeters * 0.34) + weightKg * 28 + volumeLiters * 3 + cargoPremium;
    state.orders.push({
      id: `order_market_${String(state.nextOrderSerial++).padStart(5, "0")}`,
      cargoId: cargo.id, originCityId: origin.id, destinationCityId: destinationId, weightKg, volumeLiters,
      rewardCents: Math.round(baseReward * marketIndex / 10_000 + nextRandom(state) * 24_000),
      availableAt: state.clock.now, deadlineAt: state.clock.now + road.baseTravelSeconds + 10_800 + Math.floor(nextRandom(state) * 14_400), status: "available"
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
    migrateState(this.state, this.content);
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

    if (command.type === "UnassignTransportUnit") {
      const order = this.state.orders.find((item) => item.id === command.orderId);
      const { vehicle } = getVehicleAndModel(this.state, this.content, command.transportUnitId);
      if (!order || !vehicle || vehicle.trip || !vehicle.assignedOrderIds.includes(order.id)) return { ok: false, errorCode: "UNASSIGNMENT_INVALID", events };
      vehicle.assignedOrderIds = vehicle.assignedOrderIds.filter((id) => id !== order.id);
      order.status = "available";
      vehicle.status = vehicle.assignedOrderIds.length ? "loading" : "idle";
      events.push(event(this.state, "CargoUnloaded", "订单已从本车撤下"));
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
      const marketEvent = refreshMarketPeriod(this.state, this.content);
      if (marketEvent) events.push(marketEvent);
      this.state.orders.forEach((order) => {
        if (order.status === "available" && order.deadlineAt <= this.state.clock.now) order.status = "cancelled";
      });
      for (const vehicle of this.state.vehicleUnits) {
        if (!vehicle.trip || vehicle.trip.arrivesAt > this.state.clock.now) continue;
        const trip = vehicle.trip;
        const loads = assignedLoads(this.state, vehicle);
        const revenue = loads.reduce((sum, order) => sum + (trip.arrivesAt <= order.deadlineAt ? order.rewardCents : Math.round(order.rewardCents * 0.65)), 0);
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

    if (command.type === "SetClock") {
      this.state.clock.speed = Math.max(0, command.speed);
      this.state.clock.paused = command.paused;
      events.push(event(this.state, "ClockChanged", command.paused ? "经营时间已暂停" : "经营时间速度已调整"));
    }

    replenishMarket(this.state, this.content);
    pushEvents(this.state, events);
    return { ok: true, events };
  }
}
