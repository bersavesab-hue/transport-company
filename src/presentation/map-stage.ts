import {
  getMapDetailLevel,
  getMapNodeClusters,
  getVisibleMapNodes,
  getVisibleMapRoadSegments,
  MAP_HEIGHT,
  mapViewBox,
  pointAlongPolyline,
  projectGeoPoint,
  projectMapNode,
  projectRoadGeometry,
  type MapPoint,
  type MapViewport
} from "../core/domain/map-projection.js";
import type { ContentBundle, GameState, VehicleUnitState } from "../core/domain/model.js";
import { getAsset } from "../config/assets.js";

const detailLabels = { national: "全域运输网", province: "区域网络", county: "郡县网络", local: "城区网络" } as const;
const nodeLabelPriority: Record<string, number> = { national_hub: 1, province_hub: 2, prefecture_city: 3, county_city: 4, town: 5, logistics_park: 6, warehouse: 7, fuel_station: 8, toll_station: 9, cargo_source: 10 };
const labelLimits = { national: 7, province: 8, county: 10, local: 9 } as const;

interface LabelBox { left: number; right: number; top: number; bottom: number; }
interface LabelPlacement { offsetX: number; offsetY: number; box: LabelBox; }

const boxesOverlap = (first: LabelBox, second: LabelBox): boolean =>
  first.left < second.right + 1.7 && first.right + 1.7 > second.left && first.top < second.bottom + 0.8 && first.bottom + 0.8 > second.top;

const findLabelPlacement = (
  screenX: number,
  screenY: number,
  labelWidth: number,
  occupied: readonly LabelBox[]
): LabelPlacement | null => {
  const candidates = [
    { offsetX: 0, offsetY: -4.2 },
    { offsetX: 0, offsetY: 4.2 },
    { offsetX: labelWidth / 2 + 2.2, offsetY: -0.4 },
    { offsetX: -(labelWidth / 2 + 2.2), offsetY: -0.4 },
    { offsetX: labelWidth / 2 + 1.6, offsetY: 4.1 },
    { offsetX: -(labelWidth / 2 + 1.6), offsetY: 4.1 }
  ];
  for (const candidate of candidates) {
    const centerX = screenX + candidate.offsetX;
    const centerY = screenY + candidate.offsetY;
    const box = { left: centerX - labelWidth / 2, right: centerX + labelWidth / 2, top: centerY - 1.7, bottom: centerY + 1.7 };
    if (box.left < 2 || box.right > 98 || box.top < 3 || box.bottom > 97 || occupied.some((item) => boxesOverlap(item, box))) continue;
    return { ...candidate, box };
  }
  return null;
};

const cityPoint = (content: ContentBundle, cityId: string): MapPoint => {
  const node = content.mapNodes.find((item) => item.active && item.cityId === cityId) ?? content.mapNodes.find((item) => item.cityId === cityId);
  if (node) return projectMapNode(content.mapConfig, node);
  const city = content.cities.find((item) => item.id === cityId);
  return city ? projectGeoPoint(content.mapConfig, city.longitude, city.latitude) : { x: 50, y: 32 };
};

const vehiclePoint = (state: Readonly<GameState>, content: ContentBundle, vehicle: Readonly<VehicleUnitState>): MapPoint => {
  if (!vehicle.trip) return cityPoint(content, vehicle.currentCityId);
  const progress = Math.min(1, Math.max(0, (state.clock.now - vehicle.trip.startedAt) / (vehicle.trip.arrivesAt - vehicle.trip.startedAt)));
  const segment = content.mapRoadSegments.find((item) => item.active && item.routeIds.includes(vehicle.trip!.routeId));
  if (!segment) {
    return pointAlongPolyline([cityPoint(content, vehicle.trip.fromCityId), cityPoint(content, vehicle.trip.toCityId)], progress);
  }
  const startNode = content.mapNodes.find((item) => item.id === segment.fromNodeId);
  const points = projectRoadGeometry(content.mapConfig, segment);
  return pointAlongPolyline(startNode?.cityId === vehicle.trip.fromCityId ? points : [...points].reverse(), progress);
};

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
  const activeRouteId = vehicle.trip?.routeId;
  const mapAsset = getAsset(content.mapConfig.assetId);

  const renderedRoads = visibleRoads.filter((road) => road.routeIds.includes(activeRouteId ?? "") || detail === "national" || detail === "province" || road.minZoom >= 7);
  const roads = renderedRoads.map((road) => {
    const points = projectRoadGeometry(content.mapConfig, road).map((point) => `${point.x},${point.y}`).join(" ");
    return `<polyline class="map-road ${road.roadClass} ${road.routeIds.includes(activeRouteId ?? "") ? "active" : ""}" points="${points}"/>`;
  }).join("");

  const nodeRadius = 1.05 / viewport.zoom;
  const labelSize = 2.8 / viewport.zoom;
  const occupiedLabels: LabelBox[] = [];
  let visibleLabelCount = 0;
  const prioritizedNodes = [...visibleNodes].sort((a, b) => {
    const aPinned = Number((selectedCityId !== null && a.cityId === selectedCityId) || (selectedMapNodeId !== null && a.id === selectedMapNodeId) || a.cityId === vehicle.currentCityId);
    const bPinned = Number((selectedCityId !== null && b.cityId === selectedCityId) || (selectedMapNodeId !== null && b.id === selectedMapNodeId) || b.cityId === vehicle.currentCityId);
    return bPinned - aPinned || (nodeLabelPriority[a.kind] ?? 99) - (nodeLabelPriority[b.kind] ?? 99) || a.id.localeCompare(b.id);
  });
  const nodes = prioritizedNodes.map((node) => {
    const point = projectMapNode(content.mapConfig, node);
    const cityAttribute = node.cityId ? `data-city-id="${node.cityId}"` : "";
    const selected = (selectedCityId !== null && node.cityId === selectedCityId) || (selectedMapNodeId !== null && node.id === selectedMapNodeId) ? "selected" : "";
    const current = node.cityId === vehicle.currentCityId ? "current" : "";
    const screenX = (point.x - box.x) / box.width * 100;
    const screenY = (point.y - box.y) / box.height * 100;
    const isFacility = ["logistics_park", "warehouse", "fuel_station", "toll_station", "cargo_source"].includes(node.kind);
    const labelWidth = Math.max(6.2, node.name.length * (isFacility ? 1.65 : 2.05) + 2);
    const pinned = Boolean(selected || current);
    const placement = visibleLabelCount < labelLimits[detail] || pinned ? findLabelPlacement(screenX, screenY, labelWidth, occupiedLabels) : null;
    const fallbackPlacement = pinned && !placement ? { offsetX: 0, offsetY: -4.2, box: { left: screenX - labelWidth / 2, right: screenX + labelWidth / 2, top: screenY - 5.9, bottom: screenY - 2.5 } } : null;
    const finalPlacement = placement ?? fallbackPlacement;
    if (finalPlacement) {
      occupiedLabels.push(finalPlacement.box);
      visibleLabelCount += 1;
    }
    const labelOffsetX = finalPlacement ? finalPlacement.offsetX / 100 * box.width : 0;
    const labelOffsetY = finalPlacement ? finalPlacement.offsetY / 100 * box.height : 0;
    const leader = finalPlacement && (Math.abs(finalPlacement.offsetX) > 0.1 || finalPlacement.offsetY > 0) ? `<line class="map-label-leader" x1="0" y1="0" x2="${labelOffsetX}" y2="${labelOffsetY}"/>` : "";
    const label = finalPlacement ? `<text class="map-node-label ${isFacility ? "facility-label" : ""}" style="font-size:${labelSize}px" x="${labelOffsetX}" y="${labelOffsetY}" dominant-baseline="middle">${node.name}</text>` : "";
    return `<g ${cityAttribute} data-map-node-id="${node.id}" class="map-node ${node.kind} ${selected} ${current}" transform="translate(${point.x} ${point.y})"><circle r="${nodeRadius}"/>${leader}${label}</g>`;
  }).join("");

  const clusterMarkers = clusters.map((cluster) => {
    const parent = nodeById.get(cluster.parentNodeId);
    if (!parent) return "";
    const point = projectMapNode(content.mapConfig, parent);
    return `<g class="map-cluster" transform="translate(${point.x + nodeRadius * 1.3} ${point.y - nodeRadius * 1.3})"><circle r="${nodeRadius * 0.9}"/><text style="font-size:${labelSize * 0.72}px">${cluster.count}</text></g>`;
  }).join("");

  const truck = vehiclePoint(state, content, vehicle);
  const progress = vehicle.trip ? Math.min(100, Math.max(0, Math.round((state.clock.now - vehicle.trip.startedAt) / (vehicle.trip.arrivesAt - vehicle.trip.startedAt) * 100))) : 0;

  return `<section class="map-stage">
    <svg class="network-map" data-map-canvas viewBox="${box.x} ${box.y} ${box.width} ${box.height}" role="img" aria-label="${detailLabels[detail]}">
      <defs><linearGradient id="map-land" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e8e2d4"/><stop offset="1" stop-color="#cfdccf"/></linearGradient></defs>
      <rect class="map-land" x="0" y="0" width="100" height="${MAP_HEIGHT}"/>${mapAsset?.path ? `<image class="map-base-image" href="${mapAsset.path}" x="0" y="0" width="100" height="${MAP_HEIGHT}" preserveAspectRatio="xMidYMid slice"/>` : ""}${roads}${nodes}${clusterMarkers}
      <g class="truck-marker" transform="translate(${truck.x} ${truck.y})"><g transform="scale(${1 / viewport.zoom})"><circle r="1.15"/><rect class="truck-body" x="-0.72" y="-0.42" width="1.05" height="0.72" rx="0.12"/><path class="truck-cab" d="M0.28,-0.28 H0.7 L0.92,0.02 V0.3 H0.28 Z"/><circle class="truck-wheel" cx="-0.42" cy="0.42" r="0.18"/><circle class="truck-wheel" cx="0.58" cy="0.42" r="0.18"/></g></g>
    </svg>
    <div class="map-level"><strong>${detailLabels[detail]}</strong><span>${viewport.zoom.toFixed(1)}×</span></div>
    <div class="map-floating-controls"><button data-map-zoom="in" aria-label="放大地图">＋</button><button data-map-zoom="out" aria-label="缩小地图">−</button><button data-map-scope="national">国</button><button data-map-scope="regional">车</button></div>
    <div class="map-trip-pill"><span>${vehicle.trip ? `${progress}% · 运输中` : "车辆待调度"}</span><b>${visibleNodes.length} 节点 · ${renderedRoads.length} 路段</b></div>
  </section>`;
};
