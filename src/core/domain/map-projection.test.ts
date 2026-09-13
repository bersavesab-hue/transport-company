import { describe, expect, it } from "vitest";
import { contentBundle } from "../../adapters/content.js";
import { clampMapViewport, defaultMapViewport, getMapDetailLevel, getMapNodeClusters, getVisibleMapNodes, getVisibleMapRoadSegments, mapViewBox, nationalMapViewport, pointAlongPolyline, projectGeoPoint } from "./map-projection.js";

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

  it("switches detail levels and reveals denser node and road layers", () => {
    expect(getMapDetailLevel(contentBundle.mapConfig, 1)).toBe("national");
    expect(getMapDetailLevel(contentBundle.mapConfig, 3)).toBe("province");
    expect(getMapDetailLevel(contentBundle.mapConfig, 8)).toBe("county");
    expect(getMapDetailLevel(contentBundle.mapConfig, 16)).toBe("local");
    const national = nationalMapViewport(contentBundle.mapConfig);
    const county = clampMapViewport(contentBundle.mapConfig, { ...defaultMapViewport(contentBundle.mapConfig), zoom: 8 });
    expect(getVisibleMapNodes(contentBundle.mapConfig, contentBundle.mapNodes, county).length).toBeGreaterThan(getVisibleMapNodes(contentBundle.mapConfig, contentBundle.mapNodes, national).length);
    expect(getVisibleMapRoadSegments(contentBundle.mapConfig, contentBundle.mapRoadSegments, county).length).toBeGreaterThan(getVisibleMapRoadSegments(contentBundle.mapConfig, contentBundle.mapRoadSegments, national).length);
  });

  it("aggregates hidden child nodes under their visible parent", () => {
    const viewport = defaultMapViewport(contentBundle.mapConfig);
    const clusters = getMapNodeClusters(contentBundle.mapConfig, contentBundle.mapNodes, viewport);
    expect(clusters.find((cluster) => cluster.parentNodeId === "map_node_nanyang_001")?.count).toBeGreaterThan(0);
  });

  it("moves vehicles along shaped road geometry", () => {
    expect(pointAlongPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 0.75)).toEqual({ x: 10, y: 5 });
  });
});
