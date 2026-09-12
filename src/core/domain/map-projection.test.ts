import { describe, expect, it } from "vitest";
import { contentBundle } from "../../adapters/content.js";
import { clampMapViewport, defaultMapViewport, mapViewBox, nationalMapViewport, projectGeoPoint } from "./map-projection.js";

describe("national map projection", () => {
  it("projects all current cities inside the national canvas", () => {
    for (const city of contentBundle.cities) {
      const point = projectGeoPoint(contentBundle.mapConfig, city.longitude, city.latitude);
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(100);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(64);
    }
  });

  it("keeps zoomed and dragged viewports inside national bounds", () => {
    const clamped = clampMapViewport(contentBundle.mapConfig, { centerX: -200, centerY: 900, zoom: 99 });
    const box = mapViewBox(contentBundle.mapConfig, clamped);
    expect(clamped.zoom).toBe(contentBundle.mapConfig.maxZoom);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(64);
  });

  it("provides separate regional and national starting views", () => {
    expect(defaultMapViewport(contentBundle.mapConfig).zoom).toBeGreaterThan(1);
    expect(nationalMapViewport(contentBundle.mapConfig).zoom).toBe(1);
  });
});
