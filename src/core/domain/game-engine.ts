import { CURRENT_SAVE_VERSION, GAME_VERSION, INITIAL_FEATURE_FLAGS } from "../version.js";
import { getActiveMarketEvent, getMarketIndexBasisPoints, MARKET_PERIOD_SECONDS } from "./market-intelligence.js";
import { estimateRoadCost, findDirectRoad, getAdjacentCities } from "./road-network.js";
import { planMultiStopRoute, resolveRoadDestination } from "./route-planning.js";
import { dealerDownPaymentCents, estimateVehicleResaleCents, parkingExpansionCostCents } from "./vehicle-economy.js";
import type { CommandResult, ContentBundle, EngineCommand, GameEvent, GameState, MarketOrder, VehicleUnitState } from "./model.js";

const MARKET_TARGET = 8;
const MAX_EVENT_LOG = 30;

const event = (state: GameState, type: string, message: string, amountCents?: number): GameEvent => ({
  id: `event_${String(state.nextEventSerial++).padStart(8, "0")}_${type.toLowerCase()}`,
  type, occurredAt: state.clock.now, message, amountCents
});

export const createInitialState = (content: ContentBundle): GameState => ({
  saveVersion: CURRENT_SAVE_VERSION,
  gameVersion: GAME_VERSION,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  contentPacks: [{ id: "content_pack_china_test_001", version: "0.4.0" }],
  featureFlags: { ...INITIAL_FEATURE_FLAGS },
  clock: { now: 8 * 3600, speed: 600, paused: false },
  company: {
    id: "company_player_001", name: "远行运输", cashCents: 8_000_000, debtCents: 4_200_000,
    reputationBasisPoints: 5_000, deliveredOrders: 0, onTimeOrders: 0,
    totalRevenueCents: 0, totalCostCents: 0, headquartersCityId: "city_nanyang_001", parkingCapacity: 2
  },
  vehicleUnits: [{
    id: "vehicle_unit_player_001", modelId: "vehicle_model_light_truck_001", currentCityId: "city_nanyang_001",
    status: "idle", conditionBasisPoints: 9_800, mileageMeters: 0, loadedDistanceMeters: 0, emptyDistanceMeters: 0, assignedOrderIds: [], trip: null,
    acquisitionSource: "starter", purchasePriceCents: 12_680_000, loanBalanceCents: 4_200_000,
    lifetimeRevenueCents: 0, lifetimeCostCents: 0
  }],
  orders: content.orderTemplates.map((order) => ({ ...order, availableAt: 8 * 3600 + order.availableAt, deadlineAt: 8 * 3600 + order.deadlineAt })),
  activeRoutes: [], eventLog: [],
  market: {
    periodIndex: Math.floor(8 * 3600 / MARKET_PERIOD_SECONDS),
    activeEventId: content.marketEvents.find((item) => item.active)?.id ?? null,
    startedAt: Math.floor(8 * 3600 / MARKET_PERIOD_SECONDS) * MARKET_PERIOD_SECONDS,
    endsAt: (Math.floor(8 * 3600 / MARKET_PERIOD_SECONDS) + 1) * MARKET_PERIOD_SECONDS
  },
  vehicleMarket: {
    offerDay: 0,
    lastFinanceDay: 0,
    usedOffers: content.vehicleModels.filter((item) => item.active).slice(0, 3).map((model, index) => ({
      id: `used_offer_initial_${String(index + 1).padStart(3, "0")}`,
      modelId: model.id,
      priceCents: Math.round(model.purchasePriceCents * (0.58 + index * 0.05)),
      conditionBasisPoints: 8_900 - index * 700,
      mileageMeters: 48_000_000 + index * 39_000_000,
      expiresAt: 86_400
    })),
    nextOfferSerial: 4,
    nextVehicleSerial: 2
  },
  customerContracts: [],
  randomSeed: 260_912, nextOrderSerial: 9, nextEventSerial: 1, migrationHistory: []
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

const migrateSaveV2ToV3 = (state: GameState, content: ContentBundle): void => {
  state.featureFlags.fleetExpansion = true;
  state.featureFlags.dealership = true;
  state.featureFlags.usedVehicleMarket = true;
  state.company.parkingCapacity = state.company.parkingCapacity ?? 2;
  state.vehicleUnits.forEach((unit) => {
    const model = content.vehicleModels.find((item) => item.id === unit.modelId);
    unit.acquisitionSource = unit.acquisitionSource ?? "starter";
    unit.purchasePriceCents = unit.purchasePriceCents ?? model?.purchasePriceCents ?? 0;
    unit.loanBalanceCents = unit.loanBalanceCents ?? (state.vehicleUnits.length === 1 ? state.company.debtCents : 0);
    unit.lifetimeRevenueCents = unit.lifetimeRevenueCents ?? 0;
    unit.lifetimeCostCents = unit.lifetimeCostCents ?? 0;
  });
  const day = Math.floor(state.clock.now / 86_400);
  state.vehicleMarket = {
    offerDay: day - 1,
    lastFinanceDay: day,
    usedOffers: [],
    nextOfferSerial: 1,
    nextVehicleSerial: state.vehicleUnits.length + 1
  };
  state.nextEventSerial = state.nextEventSerial ?? state.eventLog.length + 1;
  if (!state.migrationHistory.includes("save_v2_to_v3_fleet_assets")) state.migrationHistory.push("save_v2_to_v3_fleet_assets");
};

const migrateSaveV3ToV4 = (state: GameState): void => {
  state.featureFlags.multiStopRouting = true;
  state.featureFlags.customerContracts = true;
  state.customerContracts = state.customerContracts ?? [];
  const chinaPack = state.contentPacks.find((pack) => pack.id === "content_pack_china_test_001");
  if (chinaPack) chinaPack.version = "0.4.0";
  state.vehicleUnits.forEach((unit) => {
    unit.loadedDistanceMeters = unit.loadedDistanceMeters ?? unit.mileageMeters;
    unit.emptyDistanceMeters = unit.emptyDistanceMeters ?? 0;
    if (!unit.trip) return;
    unit.trip.routeIds = unit.trip.routeIds ?? [unit.trip.routeId];
    unit.trip.routeIndex = unit.trip.routeIndex ?? 0;
    unit.trip.finalCityId = unit.trip.finalCityId ?? unit.trip.toCityId;
    unit.trip.purpose = unit.trip.purpose ?? "delivery";
  });
  if (!state.migrationHistory.includes("save_v3_to_v4_multi_stop_routes")) state.migrationHistory.push("save_v3_to_v4_multi_stop_routes");
};

const migrateState = (state: GameState, content: ContentBundle): void => {
  state.featureFlags = { ...INITIAL_FEATURE_FLAGS, ...state.featureFlags };
  if (state.saveVersion < 2 || !state.market) migrateSaveV1ToV2(state, content);
  if (state.saveVersion < 3 || !state.vehicleMarket) migrateSaveV2ToV3(state, content);
  if (state.saveVersion < 4 || state.vehicleUnits.some((unit) => unit.trip && !unit.trip.routeIds)) migrateSaveV3ToV4(state);
  const chinaPack = state.contentPacks.find((pack) => pack.id === "content_pack_china_test_001");
  if (chinaPack) chinaPack.version = "0.4.0";
  state.nextEventSerial = state.nextEventSerial ?? state.eventLog.length + 1;
  state.saveVersion = CURRENT_SAVE_VERSION;
  state.gameVersion = GAME_VERSION;
};

const refreshUsedVehicleMarket = (state: GameState, content: ContentBundle): GameEvent | null => {
  if (state.featureFlags.usedVehicleMarket === false) return null;
  const day = Math.floor(state.clock.now / 86_400);
  if (state.vehicleMarket.offerDay === day && state.vehicleMarket.usedOffers.some((offer) => offer.expiresAt > state.clock.now)) return null;
  const models = content.vehicleModels.filter((item) => item.active);
  const offers = Array.from({ length: Math.min(4, models.length) }, () => {
    const model = models[Math.floor(nextRandom(state) * models.length)];
    const conditionBasisPoints = 6_500 + Math.floor(nextRandom(state) * 3_101);
    const mileageMeters = 35_000_000 + Math.floor(nextRandom(state) * 190_000_001);
    const priceFactor = 0.28 + conditionBasisPoints / 20_000;
    return {
      id: `used_offer_${String(state.vehicleMarket.nextOfferSerial++).padStart(6, "0")}`,
      modelId: model.id,
      priceCents: Math.round(model.purchasePriceCents * priceFactor),
      conditionBasisPoints,
      mileageMeters,
      expiresAt: (day + 1) * 86_400
    };
  });
  state.vehicleMarket.offerDay = day;
  state.vehicleMarket.usedOffers = offers;
  return event(state, "UsedMarketRefreshed", `二手车市场已刷新 ${offers.length} 条车源`);
};

const createVehicleUnit = (state: GameState, modelId: string, source: "dealer" | "used_market", priceCents: number, conditionBasisPoints: number, mileageMeters: number, loanBalanceCents: number): VehicleUnitState => ({
  id: `vehicle_unit_player_${String(state.vehicleMarket.nextVehicleSerial++).padStart(3, "0")}`,
  modelId,
  currentCityId: state.company.headquartersCityId,
  status: "idle",
  conditionBasisPoints,
  mileageMeters,
  loadedDistanceMeters: 0,
  emptyDistanceMeters: 0,
  assignedOrderIds: [],
  trip: null,
  acquisitionSource: source,
  purchasePriceCents: priceCents,
  loanBalanceCents,
  lifetimeRevenueCents: 0,
  lifetimeCostCents: 0
});

const settleDailyVehicleFinance = (state: GameState): GameEvent | null => {
  const currentDay = Math.floor(state.clock.now / 86_400);
  const elapsedDays = Math.max(0, currentDay - state.vehicleMarket.lastFinanceDay);
  if (!elapsedDays) return null;
  let totalPayment = 0;
  let totalInterest = 0;
  for (let day = 0; day < elapsedDays; day += 1) {
    for (const unit of state.vehicleUnits) {
      if (unit.loanBalanceCents <= 0) continue;
      const interest = Math.max(1, Math.round(unit.loanBalanceCents * 0.00025));
      const principal = Math.min(unit.loanBalanceCents, Math.max(10_000, Math.round(unit.loanBalanceCents / 180)));
      unit.loanBalanceCents -= principal;
      state.company.debtCents = Math.max(0, state.company.debtCents - principal);
      totalPayment += interest + principal;
      totalInterest += interest;
    }
  }
  state.vehicleMarket.lastFinanceDay = currentDay;
  if (!totalPayment) return null;
  state.company.cashCents -= totalPayment;
  state.company.totalCostCents += totalInterest;
  return event(state, "VehicleFinancePaid", `已结算 ${elapsedDays} 天车辆贷款`, -totalPayment);
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
    const usedMarketEvent = refreshUsedVehicleMarket(this.state, this.content);
    if (usedMarketEvent) pushEvents(this.state, [usedMarketEvent]);
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
      if (this.state.featureFlags.multiStopRouting === false && loads.length && loads[0].destinationCityId !== order.destinationCityId) return { ok: false, errorCode: "MULTI_STOP_NOT_ENABLED", events };
      const weight = loads.reduce((sum, item) => sum + item.weightKg, 0) + order.weightKg;
      const volume = loads.reduce((sum, item) => sum + item.volumeLiters, 0) + order.volumeLiters;
      if (weight > model.capacityKg || volume > model.capacityLiters) return { ok: false, errorCode: "CAPACITY_EXCEEDED", events };
      const cargo = this.content.cargoTypes.find((item) => item.id === order.cargoId);
      if (cargo && !model.capabilities.includes(cargo.temperature)) return { ok: false, errorCode: "VEHICLE_CAPABILITY_MISMATCH", events };
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
      const plan = planMultiStopRoute(this.content, vehicle.currentCityId, loads.map((order) => order.destinationCityId));
      const road = plan ? this.content.routes.find((item) => item.id === plan.routeIds[0]) : undefined;
      const destinationId = road ? resolveRoadDestination(road, vehicle.currentCityId) : null;
      if (!plan || !road || !destinationId) return { ok: false, errorCode: "NO_DIRECT_ROUTE", events };
      loads.forEach((order) => { order.status = "in_transit"; });
      vehicle.status = "in_transit";
      vehicle.trip = {
        routeId: road.id, routeIds: plan.routeIds, routeIndex: 0, finalCityId: plan.stopCityIds.at(-1)!,
        purpose: "delivery",
        fromCityId: vehicle.currentCityId, toCityId: destinationId,
        startedAt: this.state.clock.now, arrivesAt: this.state.clock.now + road.baseTravelSeconds,
        distanceMeters: road.distanceMeters, orderIds: [...vehicle.assignedOrderIds],
        projectedCostCents: estimateRoadCost(road, model.baseConsumption)
      };
      if (!this.state.activeRoutes.includes(road.id)) this.state.activeRoutes.push(road.id);
      events.push(event(this.state, "TripStarted", plan.stopCityIds.length > 1 ? `车辆已发车，计划配送 ${plan.stopCityIds.length} 个城市` : "车辆已发车"));
    }

    if (command.type === "RepositionVehicle") {
      const { vehicle, model } = getVehicleAndModel(this.state, this.content, command.transportUnitId);
      if (!vehicle || !model || vehicle.status !== "idle" || vehicle.assignedOrderIds.length || vehicle.currentCityId === command.destinationCityId) return { ok: false, errorCode: "REPOSITION_INVALID", events };
      const plan = planMultiStopRoute(this.content, vehicle.currentCityId, [command.destinationCityId]);
      const road = plan ? this.content.routes.find((item) => item.id === plan.routeIds[0]) : undefined;
      const nextCityId = road ? resolveRoadDestination(road, vehicle.currentCityId) : null;
      if (!plan || !road || !nextCityId) return { ok: false, errorCode: "NO_DIRECT_ROUTE", events };
      vehicle.status = "in_transit";
      vehicle.trip = {
        routeId: road.id, routeIds: plan.routeIds, routeIndex: 0, finalCityId: command.destinationCityId,
        purpose: "reposition", fromCityId: vehicle.currentCityId, toCityId: nextCityId,
        startedAt: this.state.clock.now, arrivesAt: this.state.clock.now + road.baseTravelSeconds,
        distanceMeters: road.distanceMeters, orderIds: [], projectedCostCents: estimateRoadCost(road, model.baseConsumption)
      };
      if (!this.state.activeRoutes.includes(road.id)) this.state.activeRoutes.push(road.id);
      events.push(event(this.state, "VehicleRepositionStarted", `车辆开始空驶调往${this.content.cities.find((city) => city.id === command.destinationCityId)?.name ?? command.destinationCityId}`));
    }

    if (command.type === "SignCustomerContract") {
      if (this.state.featureFlags.customerContracts === false) return { ok: false, errorCode: "FEATURE_DISABLED", events };
      const definition = this.content.customerContracts.find((item) => item.id === command.contractId && item.active);
      if (!definition) return { ok: false, errorCode: "CONTRACT_UNAVAILABLE", events };
      if (this.state.customerContracts.some((item) => item.definitionId === definition.id)) return { ok: false, errorCode: "CONTRACT_ALREADY_SIGNED", events };
      if (this.state.customerContracts.length >= 2) return { ok: false, errorCode: "CONTRACT_LIMIT", events };
      if (this.state.company.reputationBasisPoints < definition.requiredReputationBasisPoints) return { ok: false, errorCode: "REPUTATION_TOO_LOW", events };
      if (this.state.company.cashCents < definition.signingFeeCents) return { ok: false, errorCode: "INSUFFICIENT_CASH", events };
      this.state.company.cashCents -= definition.signingFeeCents;
      this.state.company.totalCostCents += definition.signingFeeCents;
      this.state.customerContracts.push({ definitionId: definition.id, signedAt: this.state.clock.now, completedOrders: 0, earnedBonusCents: 0 });
      events.push(event(this.state, "CustomerContractSigned", `已与${definition.customerName}签订${definition.title}`, -definition.signingFeeCents));
    }

    if (command.type === "PurchaseNewVehicle") {
      const model = this.content.vehicleModels.find((item) => item.id === command.modelId && item.active && item.dealerAvailable);
      if (!model) return { ok: false, errorCode: "VEHICLE_MODEL_UNAVAILABLE", events };
      if (this.state.featureFlags.fleetExpansion === false || this.state.featureFlags.dealership === false) return { ok: false, errorCode: "FEATURE_DISABLED", events };
      if (this.state.vehicleUnits.length >= this.state.company.parkingCapacity) return { ok: false, errorCode: "PARKING_FULL", events };
      if (this.state.company.reputationBasisPoints < model.requiredReputationBasisPoints) return { ok: false, errorCode: "REPUTATION_TOO_LOW", events };
      const downPayment = dealerDownPaymentCents(model);
      if (this.state.company.cashCents < downPayment) return { ok: false, errorCode: "INSUFFICIENT_CASH", events };
      const loan = model.purchasePriceCents - downPayment;
      this.state.company.cashCents -= downPayment;
      this.state.company.debtCents += loan;
      this.state.vehicleUnits.push(createVehicleUnit(this.state, model.id, "dealer", model.purchasePriceCents, 10_000, 0, loan));
      events.push(event(this.state, "VehiclePurchased", `已从 4S 店购入 ${model.name}，首付已支付`, -downPayment));
    }

    if (command.type === "PurchaseUsedVehicle") {
      if (this.state.featureFlags.fleetExpansion === false || this.state.featureFlags.usedVehicleMarket === false) return { ok: false, errorCode: "FEATURE_DISABLED", events };
      const offer = this.state.vehicleMarket.usedOffers.find((item) => item.id === command.offerId && item.expiresAt > this.state.clock.now);
      const model = offer ? this.content.vehicleModels.find((item) => item.id === offer.modelId && item.active) : undefined;
      if (!offer || !model) return { ok: false, errorCode: "USED_OFFER_UNAVAILABLE", events };
      if (this.state.vehicleUnits.length >= this.state.company.parkingCapacity) return { ok: false, errorCode: "PARKING_FULL", events };
      if (this.state.company.cashCents < offer.priceCents) return { ok: false, errorCode: "INSUFFICIENT_CASH", events };
      this.state.company.cashCents -= offer.priceCents;
      this.state.vehicleUnits.push(createVehicleUnit(this.state, model.id, "used_market", offer.priceCents, offer.conditionBasisPoints, offer.mileageMeters, 0));
      this.state.vehicleMarket.usedOffers = this.state.vehicleMarket.usedOffers.filter((item) => item.id !== offer.id);
      events.push(event(this.state, "UsedVehiclePurchased", `已从二手市场购入 ${model.name}`, -offer.priceCents));
    }

    if (command.type === "SellVehicle") {
      const vehicle = this.state.vehicleUnits.find((item) => item.id === command.transportUnitId);
      const model = vehicle ? this.content.vehicleModels.find((item) => item.id === vehicle.modelId) : undefined;
      if (!vehicle || !model) return { ok: false, errorCode: "VEHICLE_NOT_FOUND", events };
      if (this.state.vehicleUnits.length <= 1) return { ok: false, errorCode: "LAST_VEHICLE", events };
      if (vehicle.status !== "idle" || vehicle.trip || vehicle.assignedOrderIds.length) return { ok: false, errorCode: "VEHICLE_BUSY", events };
      const salePrice = estimateVehicleResaleCents(model, vehicle);
      if (salePrice + this.state.company.cashCents < vehicle.loanBalanceCents) return { ok: false, errorCode: "LOAN_SETTLEMENT_UNAFFORDABLE", events };
      this.state.company.cashCents += salePrice - vehicle.loanBalanceCents;
      this.state.company.debtCents = Math.max(0, this.state.company.debtCents - vehicle.loanBalanceCents);
      this.state.vehicleUnits = this.state.vehicleUnits.filter((item) => item.id !== vehicle.id);
      events.push(event(this.state, "VehicleSold", `已出售 ${model.name} 并结清该车贷款`, salePrice - vehicle.loanBalanceCents));
    }

    if (command.type === "ExpandParking") {
      const cost = parkingExpansionCostCents(this.state.company.parkingCapacity);
      if (this.state.company.cashCents < cost) return { ok: false, errorCode: "INSUFFICIENT_CASH", events };
      this.state.company.cashCents -= cost;
      this.state.company.parkingCapacity += 1;
      this.state.company.totalCostCents += cost;
      events.push(event(this.state, "ParkingExpanded", `停车场扩建完成，新增 1 个车位`, -cost));
    }

    if (command.type === "AdvanceTime") {
      this.state.clock.now += command.elapsedGameSeconds;
      const marketEvent = refreshMarketPeriod(this.state, this.content);
      if (marketEvent) events.push(marketEvent);
      const usedMarketEvent = refreshUsedVehicleMarket(this.state, this.content);
      if (usedMarketEvent) events.push(usedMarketEvent);
      const financeEvent = settleDailyVehicleFinance(this.state);
      if (financeEvent) events.push(financeEvent);
      this.state.orders.forEach((order) => {
        if (order.status === "available" && order.deadlineAt <= this.state.clock.now) order.status = "cancelled";
      });
      for (const vehicle of this.state.vehicleUnits) {
        const vehicleModel = this.content.vehicleModels.find((item) => item.id === vehicle.modelId);
        if (!vehicleModel) continue;
        while (vehicle.trip && vehicle.trip.arrivesAt <= this.state.clock.now) {
          const trip = vehicle.trip;
          vehicle.currentCityId = trip.toCityId;
          const delivered = assignedLoads(this.state, vehicle).filter((order) => order.destinationCityId === vehicle.currentCityId);
          let revenue = 0;
          for (const order of delivered) {
            const baseRevenue = trip.arrivesAt <= order.deadlineAt ? order.rewardCents : Math.round(order.rewardCents * 0.65);
            const activeContract = this.state.customerContracts.find((contract) => {
              const definition = this.content.customerContracts.find((item) => item.id === contract.definitionId);
              return definition?.originCityId === order.originCityId && definition.destinationCityId === order.destinationCityId && definition.cargoId === order.cargoId;
            });
            const definition = activeContract ? this.content.customerContracts.find((item) => item.id === activeContract.definitionId) : undefined;
            const bonus = definition ? Math.round(baseRevenue * definition.rewardBonusBasisPoints / 10_000) : 0;
            revenue += baseRevenue + bonus;
            if (activeContract && definition) {
              activeContract.completedOrders += 1;
              activeContract.earnedBonusCents += bonus;
              if (activeContract.completedOrders === definition.milestoneOrders) events.push(event(this.state, "ContractMilestone", `${definition.customerName}合同达成首个里程碑`, bonus));
            }
          }
          const onTime = delivered.filter((order) => trip.arrivesAt <= order.deadlineAt).length;
          delivered.forEach((order) => { order.status = trip.arrivesAt <= order.deadlineAt ? "delivered" : "failed"; });
          this.state.company.cashCents += revenue - trip.projectedCostCents;
          this.state.company.totalRevenueCents += revenue;
          this.state.company.totalCostCents += trip.projectedCostCents;
          this.state.company.deliveredOrders += delivered.length;
          this.state.company.onTimeOrders += onTime;
          this.state.company.reputationBasisPoints = Math.min(10_000, this.state.company.reputationBasisPoints + onTime * 25 + (delivered.length - onTime) * 5);
          vehicle.lifetimeRevenueCents += revenue;
          vehicle.lifetimeCostCents += trip.projectedCostCents;
          vehicle.mileageMeters += trip.distanceMeters;
          if (trip.purpose === "delivery") vehicle.loadedDistanceMeters += trip.distanceMeters;
          else vehicle.emptyDistanceMeters += trip.distanceMeters;
          vehicle.conditionBasisPoints = Math.max(0, vehicle.conditionBasisPoints - Math.round(trip.distanceMeters / 4_000));
          const deliveredIds = new Set(delivered.map((order) => order.id));
          vehicle.assignedOrderIds = vehicle.assignedOrderIds.filter((id) => !deliveredIds.has(id));
          if (delivered.length) events.push(event(this.state, "DeliveryCompleted", `抵达${this.content.cities.find((city) => city.id === vehicle.currentCityId)?.name ?? vehicle.currentCityId}，完成 ${delivered.length} 单`, revenue - trip.projectedCostCents));

          const nextRouteIndex = trip.routeIndex + 1;
          const nextRoad = nextRouteIndex < trip.routeIds.length ? this.content.routes.find((road) => road.id === trip.routeIds[nextRouteIndex]) : undefined;
          const nextCityId = nextRoad ? resolveRoadDestination(nextRoad, vehicle.currentCityId) : null;
          if (nextRoad && nextCityId && (trip.purpose === "reposition" || vehicle.assignedOrderIds.length)) {
            vehicle.trip = {
              ...trip, routeId: nextRoad.id, routeIndex: nextRouteIndex,
              fromCityId: vehicle.currentCityId, toCityId: nextCityId,
              startedAt: trip.arrivesAt, arrivesAt: trip.arrivesAt + nextRoad.baseTravelSeconds,
              distanceMeters: nextRoad.distanceMeters, orderIds: [...vehicle.assignedOrderIds],
              projectedCostCents: estimateRoadCost(nextRoad, vehicleModel.baseConsumption)
            };
          } else {
            vehicle.assignedOrderIds = [];
            vehicle.status = "idle";
            vehicle.trip = null;
            if (trip.purpose === "reposition") events.push(event(this.state, "VehicleRepositionCompleted", `空驶调度完成，车辆抵达${this.content.cities.find((city) => city.id === vehicle.currentCityId)?.name ?? vehicle.currentCityId}`, -trip.projectedCostCents));
          }
        }
      }
      this.state.activeRoutes = [...new Set(this.state.vehicleUnits.map((unit) => unit.trip?.routeId).filter((routeId): routeId is string => Boolean(routeId)))];
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
