import { afterEach, describe, expect, it, vi } from "vitest";
import { contentBundle } from "../adapters/content.js";
import { createInitialState, GameEngine } from "../core/domain/game-engine.js";
import { renderView, type ViewContext } from "./app-view.js";

const render = (context: ViewContext, prepare?: (engine: GameEngine) => void): string => {
  const clock = { innerHTML: "" };
  const main = { innerHTML: "" };
  vi.stubGlobal("document", { querySelector: (selector: string) => selector === "#clock" ? clock : main });
  const engine = new GameEngine(contentBundle, createInitialState(contentBundle));
  prepare?.(engine);
  renderView(engine.snapshot(), contentBundle, context);
  return main.innerHTML;
};

describe("mobile views", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows dynamic news and city intelligence on the map", () => {
    const html = render({ view: "map", selectedCityId: "city_zhengzhou_001", marketFilter: "all" });
    expect(html).toContain("市场快讯");
    expect(html).toContain("城市行情");
    expect(html).toContain("货运指数");
  });

  it("shows a profit preview after loading cargo", () => {
    const html = render({ view: "map", selectedCityId: null, marketFilter: "all" }, (engine) => {
      engine.dispatch({ type: "AcceptOrder", orderId: "order_sample_001" });
      engine.dispatch({ type: "AssignTransportUnit", orderId: "order_sample_001", transportUnitId: "vehicle_unit_player_001" });
    });
    expect(html).toContain("预计净利");
    expect(html).toContain("data-unload-order");
  });

  it("renders working local-market filters", () => {
    const html = render({ view: "market", selectedCityId: null, marketFilter: "local" });
    expect(html).toContain('data-market-filter="local" class="active"');
    expect(html).toContain("装入车辆");
  });
});
