import type { ContentBundle, RoadDefinition } from "./model.js";

export interface PlannedRoute {
  routeIds: string[];
  stopCityIds: string[];
  distanceMeters: number;
  travelSeconds: number;
}

const otherCity = (road: RoadDefinition, cityId: string): string => road.from === cityId ? road.to : road.from;

export const resolveRoadDestination = (road: RoadDefinition, fromCityId: string): string | null => {
  if (road.from === fromCityId) return road.to;
  if (road.to === fromCityId) return road.from;
  return null;
};

export const findShortestRoadPath = (content: ContentBundle, fromCityId: string, toCityId: string): RoadDefinition[] | null => {
  if (fromCityId === toCityId) return [];
  const distances = new Map<string, number>([[fromCityId, 0]]);
  const previous = new Map<string, { cityId: string; road: RoadDefinition }>();
  const pending = new Set(content.cities.filter((city) => city.active).map((city) => city.id));

  while (pending.size) {
    let current: string | null = null;
    let currentDistance = Number.POSITIVE_INFINITY;
    for (const cityId of pending) {
      const distance = distances.get(cityId) ?? Number.POSITIVE_INFINITY;
      if (distance < currentDistance) { current = cityId; currentDistance = distance; }
    }
    if (!current || currentDistance === Number.POSITIVE_INFINITY) break;
    pending.delete(current);
    if (current === toCityId) break;
    for (const road of content.routes.filter((item) => item.active && (item.from === current || item.to === current))) {
      const adjacent = otherCity(road, current);
      if (!pending.has(adjacent)) continue;
      const candidate = currentDistance + road.distanceMeters;
      if (candidate < (distances.get(adjacent) ?? Number.POSITIVE_INFINITY)) {
        distances.set(adjacent, candidate);
        previous.set(adjacent, { cityId: current, road });
      }
    }
  }

  if (!previous.has(toCityId)) return null;
  const path: RoadDefinition[] = [];
  let cursor = toCityId;
  while (cursor !== fromCityId) {
    const step = previous.get(cursor);
    if (!step) return null;
    path.unshift(step.road);
    cursor = step.cityId;
  }
  return path;
};

export const planMultiStopRoute = (content: ContentBundle, fromCityId: string, destinationCityIds: readonly string[]): PlannedRoute | null => {
  const remaining = new Set(destinationCityIds.filter((id) => id !== fromCityId));
  const routeIds: string[] = [];
  const stopCityIds: string[] = [];
  let current = fromCityId;
  let distanceMeters = 0;
  let travelSeconds = 0;

  while (remaining.size) {
    let selected: { cityId: string; path: RoadDefinition[]; distance: number } | null = null;
    for (const cityId of remaining) {
      const path = findShortestRoadPath(content, current, cityId);
      if (!path) continue;
      const distance = path.reduce((sum, road) => sum + road.distanceMeters, 0);
      if (!selected || distance < selected.distance || (distance === selected.distance && cityId < selected.cityId)) selected = { cityId, path, distance };
    }
    if (!selected) return null;
    for (const road of selected.path) {
      routeIds.push(road.id);
      distanceMeters += road.distanceMeters;
      travelSeconds += road.baseTravelSeconds;
      current = otherCity(road, current);
      if (remaining.has(current)) { remaining.delete(current); stopCityIds.push(current); }
    }
    if (remaining.has(selected.cityId)) { remaining.delete(selected.cityId); stopCityIds.push(selected.cityId); }
  }

  return routeIds.length ? { routeIds, stopCityIds, distanceMeters, travelSeconds } : null;
};
