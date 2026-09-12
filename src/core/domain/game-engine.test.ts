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
    legacy.company.cashCents = 9_123_456;
    const engine = new GameEngine(contentBundle, legacy);
    const before = engine.snapshot();
    expect(before.saveVersion).toBe(2);
    expect(before.company.cashCents).toBe(9_123_456);
    expect(before.migrationHistory).toContain("save_v1_to_v2_dynamic_market");
    engine.dispatch({ type: "AdvanceTime", elapsedGameSeconds: 30_000 });
    const after = engine.snapshot();
    expect(after.market.periodIndex).toBeGreaterThan(before.market.periodIndex);
    expect(after.eventLog.some((item) => item.type === "MarketShift")).toBe(true);
    expect(after.orders.filter((order) => order.status === "available")).toHaveLength(8);
  });
});
