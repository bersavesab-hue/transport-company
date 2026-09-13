import { describe, expect, it } from "vitest";
import { ASSET_CATALOG } from "./assets.js";
import { GAME_MODULES } from "./modules.js";
import { contentBundle } from "../adapters/content.js";

describe("extension registries", () => {
  it("keeps module ids permanent and unique", () => {
    expect(new Set(GAME_MODULES.map((module) => module.id)).size).toBe(GAME_MODULES.length);
    expect(GAME_MODULES.filter((module) => module.status === "reserved").length).toBeGreaterThanOrEqual(10);
  });

  it("keeps asset ids unique with safe fallbacks", () => {
    expect(new Set(ASSET_CATALOG.map((asset) => asset.id)).size).toBe(ASSET_CATALOG.length);
    expect(ASSET_CATALOG.every((asset) => asset.path || asset.fallback)).toBe(true);
    expect(ASSET_CATALOG.some((asset) => asset.id === contentBundle.mapConfig.assetId)).toBe(true);
  });

  it("keeps market events connected to valid cities and cargo", () => {
    const cityIds = new Set(contentBundle.cities.map((city) => city.id));
    const cargoIds = new Set(contentBundle.cargoTypes.map((cargo) => cargo.id));
    expect(contentBundle.marketEvents).toHaveLength(8);
    expect(contentBundle.marketEvents.every((event) => cityIds.has(event.cityId) && cargoIds.has(event.cargoId))).toBe(true);
    expect(contentBundle.customerContracts).toHaveLength(4);
    expect(contentBundle.customerContracts.every((contract) => cityIds.has(contract.originCityId) && cityIds.has(contract.destinationCityId) && cargoIds.has(contract.cargoId))).toBe(true);
  });

  it("keeps visual map nodes and road segments independent from economic routes", () => {
    const nodeIds = new Set(contentBundle.mapNodes.map((node) => node.id));
    const routeIds = new Set(contentBundle.routes.map((route) => route.id));
    expect(contentBundle.mapNodes.length).toBeGreaterThan(contentBundle.cities.length);
    expect(contentBundle.mapRoadSegments.every((segment) => nodeIds.has(segment.fromNodeId) && nodeIds.has(segment.toNodeId))).toBe(true);
    expect(contentBundle.mapRoadSegments.flatMap((segment) => segment.routeIds).every((routeId) => routeIds.has(routeId))).toBe(true);
  });
});
