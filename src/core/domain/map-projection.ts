import type { NationalMapConfig } from "./model.js";

export const MAP_WIDTH = 100;
export const MAP_HEIGHT = 64;

export interface MapPoint { x: number; y: number; }
export interface MapViewport { centerX: number; centerY: number; zoom: number; }
export interface MapViewBox { x: number; y: number; width: number; height: number; }

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const projectGeoPoint = (config: NationalMapConfig, longitude: number, latitude: number): MapPoint => ({
  x: (longitude - config.minLongitude) / (config.maxLongitude - config.minLongitude) * MAP_WIDTH,
  y: (config.maxLatitude - latitude) / (config.maxLatitude - config.minLatitude) * MAP_HEIGHT
});

export const defaultMapViewport = (config: NationalMapConfig): MapViewport => {
  const center = projectGeoPoint(config, config.initialCenterLongitude, config.initialCenterLatitude);
  return { centerX: center.x, centerY: center.y, zoom: config.defaultZoom };
};

export const nationalMapViewport = (config: NationalMapConfig): MapViewport => ({
  centerX: MAP_WIDTH / 2,
  centerY: MAP_HEIGHT / 2,
  zoom: config.minZoom
});

export const clampMapViewport = (config: NationalMapConfig, viewport: MapViewport): MapViewport => {
  const zoom = clamp(viewport.zoom, config.minZoom, config.maxZoom);
  const width = MAP_WIDTH / zoom;
  const height = MAP_HEIGHT / zoom;
  return {
    zoom,
    centerX: clamp(viewport.centerX, width / 2, MAP_WIDTH - width / 2),
    centerY: clamp(viewport.centerY, height / 2, MAP_HEIGHT - height / 2)
  };
};

export const mapViewBox = (config: NationalMapConfig, viewport: MapViewport): MapViewBox => {
  const clamped = clampMapViewport(config, viewport);
  const width = MAP_WIDTH / clamped.zoom;
  const height = MAP_HEIGHT / clamped.zoom;
  return { x: clamped.centerX - width / 2, y: clamped.centerY - height / 2, width, height };
};
