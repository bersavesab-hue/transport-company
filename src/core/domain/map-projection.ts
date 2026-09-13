import type { MapDetailLevel, MapNodeDefinition, MapRoadSegmentDefinition, NationalMapConfig } from "./model.js";

export const MAP_WIDTH = 100;
// Mobile-first world canvas: the nationwide network should occupy a tall phone map,
// while normalized node coordinates keep content independent from screen pixels.
export const MAP_HEIGHT = 160;

export interface MapPoint { x: number; y: number; }
export interface MapViewport { centerX: number; centerY: number; zoom: number; aspectRatio?: number; }
export interface MapViewBox { x: number; y: number; width: number; height: number; }
export interface MapNodeCluster { parentNodeId: string; count: number; }

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const viewportDimensions = (viewport: MapViewport): { width: number; height: number } => {
  const width = MAP_WIDTH / viewport.zoom;
  const defaultAspectRatio = MAP_WIDTH / MAP_HEIGHT;
  const aspectRatio = clamp(viewport.aspectRatio ?? defaultAspectRatio, 0.45, 2.2);
  return { width, height: Math.min(MAP_HEIGHT, width / aspectRatio) };
};

export const projectGeoPoint = (config: NationalMapConfig, longitude: number, latitude: number): MapPoint => ({
  x: (longitude - config.minLongitude) / (config.maxLongitude - config.minLongitude) * MAP_WIDTH,
  y: (config.maxLatitude - latitude) / (config.maxLatitude - config.minLatitude) * MAP_HEIGHT
});

export const projectMapNode = (config: NationalMapConfig, node: MapNodeDefinition): MapPoint => {
  if (node.mapX !== undefined && node.mapY !== undefined) {
    return { x: node.mapX * MAP_WIDTH, y: node.mapY * MAP_HEIGHT };
  }
  return projectGeoPoint(config, node.longitude ?? config.initialCenterLongitude, node.latitude ?? config.initialCenterLatitude);
};

export const defaultMapViewport = (config: NationalMapConfig): MapViewport => {
  const center = projectGeoPoint(config, config.initialCenterLongitude, config.initialCenterLatitude);
  return { centerX: center.x, centerY: center.y, zoom: config.defaultZoom };
};

export const nationalMapViewport = (config: NationalMapConfig): MapViewport => {
  const center = projectGeoPoint(config, config.initialCenterLongitude, config.initialCenterLatitude);
  return { centerX: center.x, centerY: center.y, zoom: config.minZoom };
};

export const mapViewportAtGeo = (config: NationalMapConfig, longitude: number, latitude: number, zoom = config.defaultZoom): MapViewport => {
  const point = projectGeoPoint(config, longitude, latitude);
  return clampMapViewport(config, { centerX: point.x, centerY: point.y, zoom });
};

export const clampMapViewport = (config: NationalMapConfig, viewport: MapViewport): MapViewport => {
  const zoom = clamp(viewport.zoom, config.minZoom, config.maxZoom);
  const normalized = { ...viewport, zoom };
  const { width, height } = viewportDimensions(normalized);
  return {
    zoom,
    aspectRatio: viewport.aspectRatio,
    centerX: clamp(viewport.centerX, width / 2, MAP_WIDTH - width / 2),
    centerY: clamp(viewport.centerY, height / 2, MAP_HEIGHT - height / 2)
  };
};

export const mapViewBox = (config: NationalMapConfig, viewport: MapViewport): MapViewBox => {
  const clamped = clampMapViewport(config, viewport);
  const { width, height } = viewportDimensions(clamped);
  return { x: clamped.centerX - width / 2, y: clamped.centerY - height / 2, width, height };
};

export const getMapDetailLevel = (config: NationalMapConfig, zoom: number): MapDetailLevel => {
  const levels = [...config.zoomLevels].sort((a, b) => a.minZoom - b.minZoom);
  return levels.filter((level) => zoom >= level.minZoom).at(-1)?.id ?? levels[0]?.id ?? "national";
};

const pointInsideBox = (point: MapPoint, box: MapViewBox, padding = 0): boolean =>
  point.x >= box.x - padding && point.x <= box.x + box.width + padding && point.y >= box.y - padding && point.y <= box.y + box.height + padding;

export const getVisibleMapNodes = (
  config: NationalMapConfig,
  nodes: readonly MapNodeDefinition[],
  viewport: MapViewport
): MapNodeDefinition[] => {
  const box = mapViewBox(config, viewport);
  return nodes.filter((node) => node.active && node.minZoom <= viewport.zoom && pointInsideBox(projectMapNode(config, node), box, 1.5));
};

export const getMapNodeClusters = (
  config: NationalMapConfig,
  nodes: readonly MapNodeDefinition[],
  viewport: MapViewport
): MapNodeCluster[] => {
  const visibleIds = new Set(getVisibleMapNodes(config, nodes, viewport).map((node) => node.id));
  const counts = new Map<string, number>();
  for (const node of nodes) {
    if (!node.active || node.minZoom <= viewport.zoom || !node.parentId || !visibleIds.has(node.parentId)) continue;
    counts.set(node.parentId, (counts.get(node.parentId) ?? 0) + 1);
  }
  return [...counts].map(([parentNodeId, count]) => ({ parentNodeId, count }));
};

export const getVisibleMapRoadSegments = (
  config: NationalMapConfig,
  segments: readonly MapRoadSegmentDefinition[],
  viewport: MapViewport
): MapRoadSegmentDefinition[] => {
  const box = mapViewBox(config, viewport);
  return segments.filter((segment) => {
    if (!segment.active || segment.minZoom > viewport.zoom || segment.geometry.length < 2) return false;
    const points = segment.geometry.map((coordinate) => projectGeoPoint(config, coordinate.longitude, coordinate.latitude));
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    return maxX >= box.x - 1 && minX <= box.x + box.width + 1 && maxY >= box.y - 1 && minY <= box.y + box.height + 1;
  });
};

export const projectRoadGeometry = (config: NationalMapConfig, segment: MapRoadSegmentDefinition): MapPoint[] =>
  segment.geometry.map((coordinate) => projectGeoPoint(config, coordinate.longitude, coordinate.latitude));

export const pointAlongPolyline = (points: readonly MapPoint[], progress: number): MapPoint => {
  if (!points.length) return { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
  if (points.length === 1) return points[0];
  const lengths = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let remaining = clamp(progress, 0, 1) * total;
  for (let index = 0; index < lengths.length; index += 1) {
    if (remaining <= lengths[index] || index === lengths.length - 1) {
      const ratio = lengths[index] ? remaining / lengths[index] : 0;
      return {
        x: points[index].x + (points[index + 1].x - points[index].x) * ratio,
        y: points[index].y + (points[index + 1].y - points[index].y) * ratio
      };
    }
    remaining -= lengths[index];
  }
  return points.at(-1)!;
};
