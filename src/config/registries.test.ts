import { describe, expect, it } from "vitest";
import { ASSET_CATALOG } from "./assets.js";
import { GAME_MODULES } from "./modules.js";

describe("extension registries", () => {
  it("keeps module ids permanent and unique", () => {
    expect(new Set(GAME_MODULES.map((module) => module.id)).size).toBe(GAME_MODULES.length);
    expect(GAME_MODULES.filter((module) => module.status === "reserved").length).toBeGreaterThanOrEqual(10);
  });

  it("keeps asset ids unique with safe fallbacks", () => {
    expect(new Set(ASSET_CATALOG.map((asset) => asset.id)).size).toBe(ASSET_CATALOG.length);
    expect(ASSET_CATALOG.every((asset) => asset.path || asset.fallback)).toBe(true);
  });
});
