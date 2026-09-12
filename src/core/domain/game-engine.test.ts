import { describe, expect, it } from "vitest";
import { contentBundle } from "../../adapters/content.js";
import { createInitialState, GameEngine } from "./game-engine.js";
import { findBestAdditionalLoad, projectLoadedTrip } from "./dispatch-intelligence.js";

describe("GameEngine", () => {
  it("loads compatible orders and settles one trip", () => {
    const engine = new GameEngine(contentBundle, createInitialState(contentBundle));
    const unitId = "vehicle_unit_player_001";
    for (const orderId of ["order_sample_001", "order_sample_005"]) {
      expect(engine.dispatch({ type: "AcceptOrder", orderId }).ok).toBe(true);
      expect(engine.dispatch({ type: "AssignTransportUnit", orderId, transportUnitId: unitId }).ok).toBe(true);
    }
    expect(engine.dispatch({ type: "StartTrip", transportUnitId: unitId }).ok).toBe(true);
    engine.dispatch({ type: "AdvanceTime", elapsedGameSeconds: 20_000 });
    const state = engine.snapshot();
    expect(state.vehicleUnits[0].currentCityId).toBe("city_zhengzhou_001");
    expect(state.company.deliveredOrders).toBe(2);
    expect(state.orders.filter((order) => order.status === "available")).toHaveLength(8);
    expect(state.company.cashCents).toBeGreaterThan(8_000_000);
  });

  it("rejects cargo above capacity", () => {
    const engine = new GameEngine(contentBundle, createInitialState(contentBundle));
    const unitId = "vehicle_unit_player_001";
    engine.dispatch({ type: "AcceptOrder", orderId: "order_sample_002" });
    engine.dispatch({ type: "AssignTransportUnit", orderId: "order_sample_002", transportUnitId: unitId });
    engine.dispatch({ type: "AcceptOrder", orderId: "order_sample_001" });
    expect(engine.dispatch({ type: "AssignTransportUnit", orderId: "order_sample_001", transportUnitId: unitId }).ok).toBe(false);
  });

  it("builds a compatible smart-load plan and calculates projected profit", () => {
    const state = createInitialState(contentBundle);
    const orderIds = findBestAdditionalLoad(state, contentBundle, state.vehicleUnits[0]);
    expect(orderIds.length).toBeGreaterThan(0);
    const engine = new GameEngine(contentBundle, state);
    for (const orderId of orderIds) {
      expect(engine.dispatch({ type: "AcceptOrder", orderId }).ok).toBe(true);
      expect(engine.dispatch({ type: "AssignTransportUnit", orderId, transportUnitId: state.vehicleUnits[0].id }).ok).toBe(true);
    }
    const projection = projectLoadedTrip(engine.snapshot(), contentBundle, engine.snapshot().vehicleUnits[0]);
    expect(projection?.netProfitCents).toBeGreaterThan(0);
    expect(projection?.loadBasisPoints).toBeLessThanOrEqual(10_000);
  });

  it("lets the player undo a loaded order", () => {
    const engine = new GameEngine(contentBundle, createInitialState(contentBundle));
    const unitId = "vehicle_unit_player_001";
    engine.dispatch({ type: "AcceptOrder", orderId: "order_sample_001" });
    engine.dispatch({ type: "AssignTransportUnit", orderId: "order_sample_001", transportUnitId: unitId });
    expect(engine.dispatch({ type: "UnassignTransportUnit", orderId: "order_sample_001", transportUnitId: unitId }).ok).toBe(true);
    expect(engine.snapshot().orders.find((order) => order.id === "order_sample_001")?.status).toBe("available");
    expect(engine.snapshot().vehicleUnits[0].status).toBe("idle");
  });

  it("migrates version-one saves and rotates the market without resetting progress", () => {
    const legacy = createInitialState(contentBundle);
    legacy.saveVersion = 1;
    delete (legacy as Partial<typeof legacy>).market;
    legacy.featureFlags.dealership = false;
    legacy.featureFlags.usedVehicleMarket = false;
    legacy.company.cashCents = 9_123_456;
    const engine = new GameEngine(contentBundle, legacy);
    const before = engine.snapshot();
    expect(before.saveVersion).toBe(3);
    expect(before.company.cashCents).toBe(9_123_456);
    expect(before.migrationHistory).toContain("save_v1_to_v2_dynamic_market");
    expect(before.migrationHistory).toContain("save_v2_to_v3_fleet_assets");
    expect(before.vehicleUnits[0].loanBalanceCents).toBe(4_200_000);
    expect(before.featureFlags.dealership).toBe(true);
    expect(before.featureFlags.usedVehicleMarket).toBe(true);
    engine.dispatch({ type: "AdvanceTime", elapsedGameSeconds: 30_000 });
    const after = engine.snapshot();
    expect(after.market.periodIndex).toBeGreaterThan(before.market.periodIndex);
    expect(after.eventLog.some((item) => item.type === "MarketShift")).toBe(true);
    expect(after.orders.filter((order) => order.status === "available")).toHaveLength(8);
  });

  it("buys vehicles with financing, enforces parking, and expands capacity", () => {
    const engine = new GameEngine(contentBundle, createInitialState(contentBundle));
    const cashBefore = engine.snapshot().company.cashCents;
    expect(engine.dispatch({ type: "PurchaseNewVehicle", modelId: "vehicle_model_micro_van_001" }).ok).toBe(true);
    const purchased = engine.snapshot();
    expect(purchased.vehicleUnits).toHaveLength(2);
    expect(purchased.company.cashCents).toBe(cashBefore - 2_214_000);
    expect(purchased.company.debtCents).toBeGreaterThan(4_200_000);
    expect(engine.dispatch({ type: "PurchaseNewVehicle", modelId: "vehicle_model_micro_van_001" }).errorCode).toBe("PARKING_FULL");
    expect(engine.dispatch({ type: "ExpandParking" }).ok).toBe(true);
    expect(engine.snapshot().company.parkingCapacity).toBe(3);
  });

  it("purchases and sells a used vehicle without deleting the starter vehicle", () => {
    const initial = createInitialState(contentBundle);
    initial.company.cashCents = 40_000_000;
    const engine = new GameEngine(contentBundle, initial);
    const offer = engine.snapshot().vehicleMarket.usedOffers[0];
    expect(engine.dispatch({ type: "PurchaseUsedVehicle", offerId: offer.id }).ok).toBe(true);
    const used = engine.snapshot().vehicleUnits.find((unit) => unit.acquisitionSource === "used_market");
    expect(used).toBeDefined();
    expect(engine.dispatch({ type: "SellVehicle", transportUnitId: used!.id }).ok).toBe(true);
    expect(engine.snapshot().vehicleUnits).toHaveLength(1);
    expect(engine.dispatch({ type: "SellVehicle", transportUnitId: "vehicle_unit_player_001" }).errorCode).toBe("LAST_VEHICLE");
  });

  it("blocks chilled cargo on ambient vehicles and accepts it on a refrigerated vehicle", () => {
    const initial = createInitialState(contentBundle);
    initial.company.cashCents = 40_000_000;
    initial.company.reputationBasisPoints = 6_000;
    initial.company.parkingCapacity = 3;
    initial.company.headquartersCityId = "city_wuhan_001";
    initial.vehicleUnits[0].currentCityId = "city_wuhan_001";
    const ambient = new GameEngine(contentBundle, structuredClone(initial));
    ambient.dispatch({ type: "AcceptOrder", orderId: "order_sample_007" });
    expect(ambient.dispatch({ type: "AssignTransportUnit", orderId: "order_sample_007", transportUnitId: "vehicle_unit_player_001" }).errorCode).toBe("VEHICLE_CAPABILITY_MISMATCH");

    const cold = new GameEngine(contentBundle, initial);
    expect(cold.dispatch({ type: "PurchaseNewVehicle", modelId: "vehicle_model_refrigerated_001" }).ok).toBe(true);
    const refrigerated = cold.snapshot().vehicleUnits[1];
    cold.dispatch({ type: "AcceptOrder", orderId: "order_sample_007" });
    expect(cold.dispatch({ type: "AssignTransportUnit", orderId: "order_sample_007", transportUnitId: refrigerated.id }).ok).toBe(true);
    expect(cold.snapshot().orders.find((order) => order.id === "order_sample_007")?.status).toBe("accepted");
  });

  it("repays vehicle principal daily while only interest counts as operating cost", () => {
    const initial = createInitialState(contentBundle);
    const engine = new GameEngine(contentBundle, initial);
    engine.dispatch({ type: "AdvanceTime", elapsedGameSeconds: 86_400 });
    const state = engine.snapshot();
    expect(state.vehicleUnits[0].loanBalanceCents).toBeLessThan(4_200_000);
    expect(state.company.debtCents).toBe(state.vehicleUnits[0].loanBalanceCents);
    expect(state.company.totalCostCents).toBeGreaterThan(0);
    expect(state.company.totalCostCents).toBeLessThan(10_000);
    expect(state.eventLog.some((item) => item.type === "VehicleFinancePaid")).toBe(true);
  });
});
