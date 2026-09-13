import { describe, expect, it } from "vitest";
import { contentBundle } from "../../adapters/content.js";
import { clampMapViewport, defaultMapViewport, getMapDetailLevel, getMapNodeClusters, getVisibleMapNodes, getVisibleMapRoadSegments, MAP_HEIGHT, mapViewBox, nationalMapViewport, pointAlongPolyline, projectGeoPoint } from "./map-projection.js";

describe("national map projection", () => {
  it("projects all current cities inside the national canvas", () => {
    for (const city of contentBundle.cities) {
      const point = projectGeoPoint(contentBundle.mapConfig, city.longitude, city.latitude);
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(100);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(MAP_HEIGHT);
    }
  });

  it("keeps zoomed and dragged viewports inside national bounds", () => {
    const clamped = clampMapViewport(contentBundle.mapConfig, { centerX: -200, centerY: 900, zoom: 99 });
    const box = mapViewBox(contentBundle.mapConfig, clamped);
    expect(clamped.zoom).toBe(contentBundle.mapConfig.maxZoom);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(MAP_HEIGHT);
  });

  it("uses the tall mobile canvas instead of letterboxing dense local maps", () => {
    const landscape = mapViewBox(contentBundle.mapConfig, { centerX: 63, centerY: 80, zoom: 24, aspectRatio: 1.6 });
    const portrait = mapViewBox(contentBundle.mapConfig, { centerX: 63, centerY: 80, zoom: 24, aspectRatio: 0.55 });
    expect(portrait.width).toBeCloseTo(landscape.width);
    expect(portrait.height).toBeGreaterThan(landscape.height * 2);
    expect(portrait.width / portrait.height).toBeCloseTo(0.55);
  });

  it("opens and resets to the complete national network", () => {
    expect(defaultMapViewport(contentBundle.mapConfig).zoom).toBe(contentBundle.mapConfig.minZoom);
    expect(nationalMapViewport(contentBundle.mapConfig).zoom).toBe(contentBundle.mapConfig.minZoom);
    expect(nationalMapViewport(contentBundle.mapConfig).zoom).toBeLessThan(contentBundle.mapConfig.zoomLevels[1].minZoom);
  });

  it("switches detail levels while keeping roads as an independent later layer", () => {
    expect(getMapDetailLevel(contentBundle.mapConfig, 1)).toBe("national");
    expect(getMapDetailLevel(contentBundle.mapConfig, 3)).toBe("province");
    expect(getMapDetailLevel(contentBundle.mapConfig, 8)).toBe("county");
    expect(getMapDetailLevel(contentBundle.mapConfig, 16)).toBe("local");
    const national = nationalMapViewport(contentBundle.mapConfig);
    expect(getVisibleMapNodes(contentBundle.mapConfig, contentBundle.mapNodes, national)).toHaveLength(12);
    expect(contentBundle.mapNodes.filter((node) => node.active && node.minZoom === 2.2)).toHaveLength(30);
    expect(getVisibleMapRoadSegments(contentBundle.mapConfig, contentBundle.mapRoadSegments, national)).toHaveLength(0);
  });

  it("aggregates hidden child nodes under their visible parent", () => {
    const viewport = defaultMapViewport(contentBundle.mapConfig);
    const clusters = getMapNodeClusters(contentBundle.mapConfig, contentBundle.mapNodes, viewport);
    expect(clusters.find((cluster) => cluster.parentNodeId === "map_node_world_heyue_001")?.count).toBeGreaterThan(0);
  });

  it("moves vehicles along shaped road geometry", () => {
    expect(pointAlongPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 0.75)).toEqual({ x: 10, y: 5 });
  });
});
