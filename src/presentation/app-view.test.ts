import { afterEach, describe, expect, it, vi } from "vitest";
import { contentBundle } from "../adapters/content.js";
import { createInitialState, GameEngine } from "../core/domain/game-engine.js";
import { defaultMapViewport, nationalMapViewport } from "../core/domain/map-projection.js";
import { renderView, type ViewContext } from "./app-view.js";

const render = (context: Omit<ViewContext, "mapViewport" | "mapDrawerOpen" | "selectedMapNodeId"> & { mapViewport?: ViewContext["mapViewport"]; selectedMapNodeId?: string | null }, prepare?: (engine: GameEngine) => void): string => {
  const clock = { innerHTML: "" };
  const main = { innerHTML: "" };
  vi.stubGlobal("document", { querySelector: (selector: string) => selector === "#clock" ? clock : main });
  const engine = new GameEngine(contentBundle, createInitialState(contentBundle));
  prepare?.(engine);
  renderView(engine.snapshot(), contentBundle, { ...context, selectedMapNodeId: context.selectedMapNodeId ?? null, mapViewport: context.mapViewport ?? defaultMapViewport(contentBundle.mapConfig), mapDrawerOpen: false });
  return main.innerHTML;
};

describe("mobile views", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows dynamic news and city intelligence on the map", () => {
    const html = render({ view: "map", selectedCityId: "city_zhengzhou_001", selectedVehicleId: null, marketFilter: "all" });
    expect(html).toContain("市场快讯");
    expect(html).toContain("城市行情");
    expect(html).toContain("货运指数");
    expect(html).toContain('data-reposition-city="city_zhengzhou_001"');
  });

  it("renders the borderless fictional network over the terrain layer", () => {
    const html = render({ view: "map", selectedCityId: null, selectedVehicleId: null, marketFilter: "all", mapViewport: nationalMapViewport(contentBundle.mapConfig) });
    expect(html).toContain("全域运输网");
    expect(html).toContain("map-base-image");
    expect(html).toContain('data-map-scope="regional"');
    expect(html).not.toContain("region-marker");
  });

  it("keeps the management UI inside a collapsed map drawer", () => {
    const html = render({ view: "map", selectedCityId: null, selectedVehicleId: null, marketFilter: "all" });
    expect(html).toContain('class="map-bottom-sheet "');
    expect(html).toContain("上拉调度");
    expect(html).toContain('data-map-drawer');
  });

  it("limits local labels and hides inactive cross-region roads on a phone viewport", () => {
    const base = defaultMapViewport(contentBundle.mapConfig);
    const html = render({ view: "map", selectedCityId: null, selectedVehicleId: null, marketFilter: "all", mapViewport: { ...base, zoom: 24, aspectRatio: 0.55 } });
    expect(html.match(/class="map-node-label/g)?.length ?? 0).toBeLessThanOrEqual(9);
    expect(html).not.toContain("map-road expressway");
  });

  it("shows a profit preview after loading cargo", () => {
    const html = render({ view: "map", selectedCityId: null, selectedVehicleId: null, marketFilter: "all" }, (engine) => {
      engine.dispatch({ type: "AcceptOrder", orderId: "order_sample_001" });
      engine.dispatch({ type: "AssignTransportUnit", orderId: "order_sample_001", transportUnitId: "vehicle_unit_player_001" });
    });
    expect(html).toContain("预计净利");
    expect(html).toContain("data-unload-order");
  });

  it("renders working local-market filters", () => {
    const html = render({ view: "market", selectedCityId: null, selectedVehicleId: null, marketFilter: "local" });
    expect(html).toContain('data-market-filter="local" class="active"');
    expect(html).toContain("装入车辆");
  });

  it("shows a multi-stop route and return radar", () => {
    const html = render({ view: "map", selectedCityId: null, selectedVehicleId: null, marketFilter: "all" }, (engine) => {
      for (const orderId of ["order_sample_001", "order_sample_002"]) {
        engine.dispatch({ type: "AcceptOrder", orderId });
        engine.dispatch({ type: "AssignTransportUnit", orderId, transportUnitId: "vehicle_unit_player_001" });
      }
    });
    expect(html).toContain("开始 2 站配送");
    expect(html).toContain("返程雷达");
  });

  it("renders fleet expansion entry points", () => {
    const html = render({ view: "fleet", selectedCityId: null, selectedVehicleId: null, marketFilter: "all" });
    expect(html).toContain("我的车队");
    expect(html).toContain('data-view-jump="dealership"');
    expect(html).toContain("至少保留一辆");
  });

  it("renders data-driven dealer and used vehicle offers", () => {
    const dealer = render({ view: "dealership", selectedCityId: null, selectedVehicleId: null, marketFilter: "all" });
    const used = render({ view: "used-vehicles", selectedCityId: null, selectedVehicleId: null, marketFilter: "all" });
    expect(dealer).toContain("厂家金融");
    expect(dealer).toContain("data-buy-new");
    expect(used).toContain("data-buy-used");
  });

  it("renders customer contracts from the content pack", () => {
    const html = render({ view: "contracts", selectedCityId: null, selectedVehicleId: null, marketFilter: "all" });
    expect(html).toContain("伏川裕丰商贸");
    expect(html).toContain("data-sign-contract");
    expect(html).toContain("运价 +8%");
  });
});
