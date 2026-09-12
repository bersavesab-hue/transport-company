import type { ContentBundle, RoadDefinition } from "./model.js";

export const findDirectRoad = (content: ContentBundle, from: string, to: string): RoadDefinition | undefined =>
  content.routes.find((route) => route.active && ((route.from === from && route.to === to) || (route.from === to && route.to === from)));

export const getAdjacentCities = (content: ContentBundle, cityId: string): string[] =>
  content.routes.filter((route) => route.active && (route.from === cityId || route.to === cityId)).map((route) => route.from === cityId ? route.to : route.from);

export const estimateRoadCost = (road: RoadDefinition, consumptionBasis: number): number => {
  const distanceKm = road.distanceMeters / 1000;
  const fuelCents = Math.round(distanceKm * (consumptionBasis / 100) * 7.65);
  return fuelCents + road.tollCents + Math.round(distanceKm * 14) + Math.round(distanceKm * 11);
};
