import {
  getMapDetailLevel,
  getMapNodeClusters,
  getVisibleMapNodes,
  getVisibleMapRoadSegments,
  mapViewBox,
  pointAlongPolyline,
  projectGeoPoint,
  projectRoadGeometry,
  type MapPoint,
  type MapViewport
} from "../core/domain/map-projection.js";
import { projectLoadedTrip } from "../core/domain/dispatch-intelligence.js";
import { findShortestRoadPath } from "../core/domain/route-planning.js";
import type { ContentBundle, GameState, MapNodeDefinition, VehicleUnitState } from "../core/domain/model.js";

const detailLabels = { national: "全国网络", province: "省域网络", county: "县域网络", local: "城区网络" } as const;
const nodeLabelPriority: Record<string, number> = { national_hub: 1, province_hub: 2, prefecture_city: 3, county_city: 4, town: 5, logistics_park: 6, warehouse: 7, fuel_station: 8, toll_station: 9, cargo_source: 10 };

const cityPoint = (content: ContentBundle, cityId: string): MapPoint => {
  const node = content.mapNodes.find((item) => item.cityId === cityId);
  if (node) return projectGeoPoint(content.mapConfig, node.longitude, node.latitude);
  const city = content.cities.find((item) => item.id === cityId);
  return city ? projectGeoPoint(content.mapConfig, city.longitude, city.latitude) : { x: 50, y: 32 };
};

const vehiclePoint = (state: Readonly<GameState>, content: ContentBundle, vehicle: Readonly<VehicleUnitState>): MapPoint => {
  if (!vehicle.trip) return cityPoint(content, vehicle.currentCityId);
  const duration = Math.max(1, vehicle.trip.arrivesAt - vehicle.trip.startedAt);
  const progress = Math.min(1, Math.max(0, (state.clock.now - vehicle.trip.startedAt) / duration));
  const segment = content.mapRoadSegments.find((item) => item.routeIds.includes(vehicle.trip!.routeId));
  if (!segment) return pointAlongPolyline([cityPoint(content, vehicle.trip.fromCityId), cityPoint(content, vehicle.trip.toCityId)], progress);
  const startNode = content.mapNodes.find((item) => item.id === segment.fromNodeId);
  const points = projectRoadGeometry(content.mapConfig, segment);
  return pointAlongPolyline(startNode?.cityId === vehicle.trip.fromCityId ? points : [...points].reverse(), progress);
};

type LabelPlacement = { dx: number; dy: number; anchor: "start" | "middle" | "end"; leader: boolean };
type LabelBox = { x: number; y: number; width: number; height: number };

const labelCandidates = (radius: number): LabelPlacement[] => [
  { dx: 0, dy: -(radius + 0.75), anchor: "middle", leader: false },
  { dx: radius + 0.9, dy: -0.15, anchor: "start", leader: true },
  { dx: -(radius + 0.9), dy: -0.15, anchor: "end", leader: true },
  { dx: 0, dy: radius + 1.65, anchor: "middle", leader: true }
];

const toLabelBox = (node: MapNodeDefinition, point: MapPoint, box: ReturnType<typeof mapViewBox>, placement: LabelPlacement): LabelBox => ({
  x: (point.x + placement.dx - box.x) / box.width * 100,
  y: (point.y + placement.dy - box.y) / box.height * 100,
  width: Math.max(6.6, node.name.length * 2.05),
  height: 3.1
});

const overlaps = (a: LabelBox, b: LabelBox): boolean =>
  Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.y - b.y) < (a.height + b.height) / 2;

const routeIntersects = (routeIds: ReadonlySet<string>, roadRouteIds: readonly string[]): boolean => roadRouteIds.some((routeId) => routeIds.has(routeId));

export const renderMapStage = (
  state: Readonly<GameState>,
  content: ContentBundle,
  viewport: MapViewport,
  vehicle: Readonly<VehicleUnitState>,
  selectedCityId: string | null,
  selectedMapNodeId: string | null
): string => {
  const box = mapViewBox(content.mapConfig, viewport);
  const detail = getMapDetailLevel(content.mapConfig, viewport.zoom);
  const visibleNodes = getVisibleMapNodes(content.mapConfig, content.mapNodes, viewport);
  const visibleRoads = getVisibleMapRoadSegments(content.mapConfig, content.mapRoadSegments, viewport);
  const clusters = getMapNodeClusters(content.mapConfig, content.mapNodes, viewport);
  const nodeById = new Map(content.mapNodes.map((node) => [node.id, node]));

  const activeRouteIds = new Set(vehicle.trip?.routeIds ?? []);
  const plannedRouteIds = new Set(projectLoadedTrip(state, content, vehicle)?.routeIds ?? []);
  const selectedPath = selectedCityId && selectedCityId !== vehicle.currentCityId ? findShortestRoadPath(content, vehicle.currentCityId, selectedCityId) : null;
  const selectedRouteIds = new Set(selectedPath?.map((road) => road.id) ?? []);

  const roads = visibleRoads.map((road) => {
    const points = projectRoadGeometry(content.mapConfig, road).map((point) => `${point.x},${point.y}`).join(" ");
    const active = routeIntersects(activeRouteIds, road.routeIds);
    const planned = !active && routeIntersects(plannedRouteIds, road.routeIds);
    const selected = !active && !planned && routeIntersects(selectedRouteIds, road.routeIds);
    const stateClass = active ? "route-active" : planned ? "route-planned" : selected ? "route-selected" : "";
    return `<polyline class="map-road ${road.roadClass} ${stateClass}" points="${points}"/>`;
  }).join("");

  const nodeRadius = 1.05 / viewport.zoom;
  const labelSize = 2.8 / viewport.zoom;
  const occupiedLabels: LabelBox[] = [];
  const prioritizedNodes = [...visibleNodes].sort((a, b) => {
    const aPinned = Number(a.cityId === selectedCityId || a.id === selectedMapNodeId || a.cityId === vehicle.currentCityId);
    const bPinned = Number(b.cityId === selectedCityId || b.id === selectedMapNodeId || b.cityId === vehicle.currentCityId);
    return bPinned - aPinned || (nodeLabelPriority[a.kind] ?? 99) - (nodeLabelPriority[b.kind] ?? 99) || a.id.localeCompare(b.id);
  });

  const nodes = prioritizedNodes.map((node) => {
    const point = projectGeoPoint(content.mapConfig, node.longitude, node.latitude);
    const cityAttribute = node.cityId ? `data-city-id="${node.cityId}"` : "";
    const isSelected = node.cityId === selectedCityId || node.id === selectedMapNodeId;
    const isCurrent = node.cityId === vehicle.currentCityId;
    const pinned = isSelected || isCurrent;
    let chosen: { placement: LabelPlacement; box: LabelBox } | null = null;

    for (const placement of labelCandidates(nodeRadius)) {
      const candidateBox = toLabelBox(node, point, box, placement);
      if (!occupiedLabels.some((occupied) => overlaps(occupied, candidateBox))) {
        chosen = { placement, box: candidateBox };
        break;
      }
    }

    if (!chosen && pinned) {
      const placement = labelCandidates(nodeRadius)[isSelected ? 1 : 0];
      chosen = { placement, box: toLabelBox(node, point, box, placement) };
    }
    if (!chosen && (nodeLabelPriority[node.kind] ?? 99) <= 3) {
      const placement = labelCandidates(nodeRadius)[0];
      chosen = { placement, box: toLabelBox(node, point, box, placement) };
    }

    if (chosen) occupiedLabels.push(chosen.box);
    const leader = chosen?.placement.leader ? `<line class="map-label-leader" x1="0" y1="0" x2="${chosen.placement.dx}" y2="${chosen.placement.dy}"/>` : "";
    const label = chosen ? `<text text-anchor="${chosen.placement.anchor}" style="font-size:${labelSize}px" x="${chosen.placement.dx}" y="${chosen.placement.dy}">${node.name}</text>` : "";
    const classes = ["map-node", node.kind, isSelected ? "selected" : "", isCurrent ? "current" : ""].filter(Boolean).join(" ");
    return `<g ${cityAttribute} data-map-node-id="${node.id}" class="${classes}" transform="translate(${point.x} ${point.y})"><circle r="${nodeRadius}"/>${leader}${label}</g>`;
  }).join("");

  const clusterMarkers = clusters.map((cluster) => {
    const parent = nodeById.get(cluster.parentNodeId);
    if (!parent) return "";
    const point = projectGeoPoint(content.mapConfig, parent.longitude, parent.latitude);
    return `<g class="map-cluster" transform="translate(${point.x + nodeRadius * 1.3} ${point.y - nodeRadius * 1.3})"><circle r="${nodeRadius * 0.9}"/><text style="font-size:${labelSize * 0.72}px">${cluster.count}</text></g>`;
  }).join("");

  const regions = detail === "national" ? content.regions.filter((region) => region.active).map((region) => {
    const point = projectGeoPoint(content.mapConfig, region.centerLongitude, region.centerLatitude);
    return `<g class="region-marker ${region.status}" transform="translate(${point.x} ${point.y})"><circle r="3.2"/><text text-anchor="middle" y="0.6">${region.status === "locked" ? "锁" : region.status === "gateway" ? "点" : "开"}</text><text class="region-name" text-anchor="middle" y="5.4">${region.name}</text></g>`;
  }).join("") : "";

  const truck = vehiclePoint(state, content, vehicle);
  const duration = Math.max(1, (vehicle.trip?.arrivesAt ?? 1) - (vehicle.trip?.startedAt ?? 0));
  const progress = vehicle.trip ? Math.min(100, Math.max(0, Math.round((state.clock.now - vehicle.trip.startedAt) / duration * 100))) : 0;
  const routeState = vehicle.trip ? "运输路线" : plannedRouteIds.size ? "待发路线" : selectedRouteIds.size ? "预览路线" : "道路网络";

  return `<section class="map-stage">
    <svg class="network-map" data-map-canvas viewBox="${box.x} ${box.y} ${box.width} ${box.height}" role="img" aria-label="${detailLabels[detail]}">
      <defs><linearGradient id="map-land" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e8e2d4"/><stop offset="1" stop-color="#cfdccf"/></linearGradient></defs>
      <rect class="map-land" x="0" y="0" width="100" height="64"/>${regions}${roads}${nodes}${clusterMarkers}
      <g class="truck-marker" transform="translate(${truck.x} ${truck.y})"><g transform="scale(${1 / viewport.zoom})"><circle r="1.15"/><rect class="truck-body" x="-0.72" y="-0.42" width="1.05" height="0.72" rx="0.12"/><path class="truck-cab" d="M0.28,-0.28 H0.7 L0.92,0.02 V0.3 H0.28 Z"/><circle class="truck-wheel" cx="-0.42" cy="0.42" r="0.18"/><circle class="truck-wheel" cx="0.58" cy="0.42" r="0.18"/></g></g>
    </svg>
    <div class="map-level"><strong>${detailLabels[detail]}</strong><span>${viewport.zoom.toFixed(1)}× · ${routeState}</span></div>
    <div class="map-floating-controls"><button data-map-zoom="in" aria-label="放大地图">＋</button><button data-map-zoom="out" aria-label="缩小地图">−</button><button data-map-scope="national" aria-label="全国视图">国</button><button data-map-scope="regional" aria-label="定位当前车辆">车</button></div>
    <div class="map-trip-pill"><span>${vehicle.trip ? `${progress}% · 运输中` : plannedRouteIds.size ? "已规划，等待发车" : selectedRouteIds.size ? "正在预览路线" : "车辆待调度"}</span><b>${visibleNodes.length} 节点 · ${visibleRoads.length} 路段</b></div>
  </section>`;
};
