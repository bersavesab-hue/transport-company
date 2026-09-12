import { describe, expect, it } from "vitest";
import { contentBundle } from "../../adapters/content.js";
import { createInitialState, GameEngine } from "./game-engine.js";

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
});
