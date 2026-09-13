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
import type { ContentBundle, GameState, VehicleUnitState } from "../core/domain/model.js";

const detailLabels = { national: "全国网络", province: "省域网络", county: "县域网络", local: "城区网络" } as const;

const cityPoint = (content: ContentBundle, cityId: string): MapPoint => {
  const node = content.mapNodes.find((item) => item.cityId === cityId);
  if (node) return projectGeoPoint(content.mapConfig, node.longitude, node.latitude);
  const city = content.cities.find((item) => item.id === cityId);
  return city ? projectGeoPoint(content.mapConfig, city.longitude, city.latitude) : { x: 50, y: 32 };
};

const vehiclePoint = (state: Readonly<GameState>, content: ContentBundle, vehicle: Readonly<VehicleUnitState>): MapPoint => {
  if (!vehicle.trip) return cityPoint(content, vehicle.currentCityId);
  const progress = Math.min(1, Math.max(0, (state.clock.now - vehicle.trip.startedAt) / (vehicle.trip.arrivesAt - vehicle.trip.startedAt)));
  const segment = content.mapRoadSegments.find((item) => item.routeIds.includes(vehicle.trip!.routeId));
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

  const roads = visibleRoads.map((road) => {
    const points = projectRoadGeometry(content.mapConfig, road).map((point) => `${point.x},${point.y}`).join(" ");
    return `<polyline class="map-road ${road.roadClass} ${road.routeIds.includes(activeRouteId ?? "") ? "active" : ""}" points="${points}"/>`;
  }).join("");

  const nodeRadius = 1.25 / viewport.zoom;
  const labelSize = 2 / viewport.zoom;
  const nodes = visibleNodes.map((node) => {
    const point = projectGeoPoint(content.mapConfig, node.longitude, node.latitude);
    const cityAttribute = node.cityId ? `data-city-id="${node.cityId}"` : "";
    const selected = node.cityId === selectedCityId || node.id === selectedMapNodeId ? "selected" : "";
    const current = node.cityId === vehicle.currentCityId ? "current" : "";
    return `<g ${cityAttribute} data-map-node-id="${node.id}" class="map-node ${node.kind} ${selected} ${current}" transform="translate(${point.x} ${point.y})"><circle r="${nodeRadius}"/><text style="font-size:${labelSize}px" y="-${nodeRadius + 0.7}">${node.name}</text></g>`;
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
  const progress = vehicle.trip ? Math.min(100, Math.max(0, Math.round((state.clock.now - vehicle.trip.startedAt) / (vehicle.trip.arrivesAt - vehicle.trip.startedAt) * 100))) : 0;

  return `<section class="map-stage">
    <svg class="network-map" data-map-canvas viewBox="${box.x} ${box.y} ${box.width} ${box.height}" role="img" aria-label="${detailLabels[detail]}">
      <defs><linearGradient id="map-land" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e8e2d4"/><stop offset="1" stop-color="#cfdccf"/></linearGradient></defs>
      <rect class="map-land" x="0" y="0" width="100" height="64"/>${regions}${roads}${nodes}${clusterMarkers}
      <g class="truck-marker" transform="translate(${truck.x} ${truck.y})"><circle r="${1.15 / viewport.zoom}"/><text style="font-size:${1.45 / viewport.zoom}px" text-anchor="middle" y="${0.45 / viewport.zoom}">▰</text></g>
    </svg>
    <div class="map-level"><strong>${detailLabels[detail]}</strong><span>${viewport.zoom.toFixed(1)}×</span></div>
    <div class="map-floating-controls"><button data-map-zoom="in" aria-label="放大地图">＋</button><button data-map-zoom="out" aria-label="缩小地图">−</button><button data-map-scope="national">国</button><button data-map-scope="regional">车</button></div>
    <div class="map-trip-pill"><span>${vehicle.trip ? `${progress}% · 运输中` : "车辆待调度"}</span><b>${visibleNodes.length} 节点 · ${visibleRoads.length} 路段</b></div>
  </section>`;
};
