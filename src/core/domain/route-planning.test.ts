import { describe, expect, it } from "vitest";
import { contentBundle } from "../../adapters/content.js";
import { findShortestRoadPath, planMultiStopRoute } from "./route-planning.js";

describe("route planning", () => {
  it("finds an indirect route when no direct road exists", () => {
    const path = findShortestRoadPath(contentBundle, "city_nanyang_001", "city_hefei_001");
    expect(path?.map((road) => road.id)).toEqual(["route_nanyang_wuhan_001", "route_wuhan_hefei_001"]);
  });

  it("builds a deterministic route across multiple destinations", () => {
    const plan = planMultiStopRoute(contentBundle, "city_nanyang_001", ["city_wuhan_001", "city_zhengzhou_001"]);
    expect(plan?.stopCityIds).toEqual(["city_zhengzhou_001", "city_wuhan_001"]);
    expect(plan?.routeIds).toHaveLength(2);
    expect(plan?.distanceMeters).toBe(775_000);
  });
});
