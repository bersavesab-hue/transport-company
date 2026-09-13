import "./styles.css";
import "./v062.css";
import { contentBundle } from "./adapters/content.js";
import { BrowserSaveRepository } from "./adapters/save-repository.js";
import { GameService } from "./application/game-service.js";
import { clampMapViewport, defaultMapViewport, mapViewBox, mapViewportAtGeo, nationalMapViewport } from "./core/domain/map-projection.js";
import { renderShell, renderView, type ViewContext } from "./presentation/app-view.js";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("App root is missing");
const service = new GameService(contentBundle, new BrowserSaveRepository());

const focusVehicleViewport = (zoom = 4.6) => {
  const state = service.getState();
  const vehicle = state.vehicleUnits[0];
  const cityId = vehicle.trip?.toCityId ?? vehicle.currentCityId;
  const city = contentBundle.cities.find((item) => item.id === cityId);
  return city ? mapViewportAtGeo(contentBundle.mapConfig, city.longitude, city.latitude, zoom) : defaultMapViewport(contentBundle.mapConfig);
};

const context: ViewContext = {
  view: "map",
  selectedCityId: null,
  selectedMapNodeId: null,
  selectedVehicleId: service.getState().vehicleUnits[0].id,
  marketFilter: "all",
  mapViewport: focusVehicleViewport(),
  mapDrawerOpen: false
};
renderShell(root);

const toast = (message: string): void => {
  const element = document.querySelector<HTMLElement>("#toast")!;
  element.textContent = message; element.classList.add("show");
  window.setTimeout(() => element.classList.remove("show"), 2_200);
};
const activateView = (view: string): void => {
  context.view = view;
  context.selectedCityId = null;
  context.selectedMapNodeId = null;
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  renderView(service.getState(), contentBundle, context);
};

const focusCity = (cityId: string): void => {
  const node = contentBundle.mapNodes.find((item) => item.cityId === cityId);
  const city = contentBundle.cities.find((item) => item.id === cityId);
  const longitude = node?.longitude ?? city?.longitude;
  const latitude = node?.latitude ?? city?.latitude;
  if (longitude === undefined || latitude === undefined) return;
  const targetZoom = Math.max(context.mapViewport.zoom, Math.min(9, Math.max(4.6, node?.minZoom ?? 4.6)));
  context.mapViewport = mapViewportAtGeo(contentBundle.mapConfig, longitude, latitude, targetZoom);
};

const focusMapNode = (nodeId: string): void => {
  const node = contentBundle.mapNodes.find((item) => item.id === nodeId);
  if (!node) return;
  const targetZoom = Math.max(context.mapViewport.zoom, Math.min(16, Math.max(4.6, node.minZoom)));
  context.mapViewport = mapViewportAtGeo(contentBundle.mapConfig, node.longitude, node.latitude, targetZoom);
};

root.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const nav = target.closest<HTMLButtonElement>("[data-view]");
  if (nav) return activateView(nav.dataset.view ?? "map");
  const jump = target.closest<HTMLButtonElement>("[data-view-jump]");
  if (jump) return activateView(jump.dataset.viewJump ?? "map");
  const mapScope = target.closest<HTMLButtonElement>("[data-map-scope]");
  if (mapScope?.dataset.mapScope) {
    if (mapScope.dataset.mapScope === "national") context.mapViewport = nationalMapViewport(contentBundle.mapConfig);
    else {
      const state = service.getState();
      const vehicle = state.vehicleUnits.find((item) => item.id === context.selectedVehicleId) ?? state.vehicleUnits[0];
      const city = contentBundle.cities.find((item) => item.id === (vehicle.trip?.toCityId ?? vehicle.currentCityId));
      context.mapViewport = city ? mapViewportAtGeo(contentBundle.mapConfig, city.longitude, city.latitude, Math.max(4.6, context.mapViewport.zoom)) : defaultMapViewport(contentBundle.mapConfig);
    }
    renderView(service.getState(), contentBundle, context); return;
  }
  const mapZoom = target.closest<HTMLButtonElement>("[data-map-zoom]");
  if (mapZoom?.dataset.mapZoom) {
    context.mapViewport = clampMapViewport(contentBundle.mapConfig, { ...context.mapViewport, zoom: context.mapViewport.zoom * (mapZoom.dataset.mapZoom === "in" ? 1.35 : 1 / 1.35) });
    renderView(service.getState(), contentBundle, context); return;
  }
  if (target.closest("[data-map-drawer]")) { context.mapDrawerOpen = !context.mapDrawerOpen; renderView(service.getState(), contentBundle, context); return; }
  const city = target.closest<SVGGElement>("[data-city-id]");
  if (city?.dataset.cityId) {
    context.selectedCityId = city.dataset.cityId; context.selectedMapNodeId = null; focusCity(city.dataset.cityId);
    renderView(service.getState(), contentBundle, context); return;
  }
  const mapNode = target.closest<SVGGElement>("[data-map-node-id]");
  if (mapNode?.dataset.mapNodeId) {
    context.selectedMapNodeId = mapNode.dataset.mapNodeId; context.selectedCityId = null; focusMapNode(mapNode.dataset.mapNodeId);
    renderView(service.getState(), contentBundle, context); return;
  }
  if (target.closest("[data-close-city]")) { context.selectedCityId = null; renderView(service.getState(), contentBundle, context); return; }
  if (target.closest("[data-close-map-node]")) { context.selectedMapNodeId = null; renderView(service.getState(), contentBundle, context); return; }
  const filter = target.closest<HTMLButtonElement>("[data-market-filter]");
  if (filter?.dataset.marketFilter) { context.marketFilter = filter.dataset.marketFilter as ViewContext["marketFilter"]; renderView(service.getState(), contentBundle, context); return; }
  const vehicleButton = target.closest<HTMLButtonElement>("[data-select-vehicle]");
  if (vehicleButton?.dataset.selectVehicle) { context.selectedVehicleId = vehicleButton.dataset.selectVehicle; activateView("map"); toast("已切换当前调度车辆"); return; }
  const speed = target.closest<HTMLButtonElement>("[data-speed]");
  if (speed?.dataset.speed) { service.setClock(Number(speed.dataset.speed), false); return; }
  if (target.closest("[data-pause]")) { const state = service.getState(); service.setClock(state.clock.speed || 600, !state.clock.paused); return; }
  const orderButton = target.closest<HTMLButtonElement>(".load-order");
  if (orderButton?.dataset.orderId) { const error = service.loadOrder(orderButton.dataset.orderId, context.selectedVehicleId ?? undefined); toast(error ?? "装车成功，可继续拼货或立即发车"); return; }
  const unloadButton = target.closest<HTMLButtonElement>("[data-unload-order]");
  if (unloadButton?.dataset.unloadOrder) { const error = service.unloadOrder(unloadButton.dataset.unloadOrder, context.selectedVehicleId ?? undefined); toast(error ?? "订单已撤下，可重新安排"); return; }
  if (target.closest("#smart-load")) { const error = service.smartLoad(context.selectedVehicleId ?? undefined); toast(error ?? "已生成当前城市收益更高的拼货方案"); return; }
  if (target.closest("#start-trip")) { const error = service.startTrip(context.selectedVehicleId ?? undefined); toast(error ?? "车辆已出发，地图将实时推进"); return; }
  const reposition = target.closest<HTMLButtonElement>("[data-reposition-city]");
  if (reposition?.dataset.repositionCity) { const error = service.repositionVehicle(reposition.dataset.repositionCity, context.selectedVehicleId ?? undefined); context.selectedCityId = null; toast(error ?? "车辆已开始空驶调度，成本和空驶里程将被记录"); return; }
  const signContract = target.closest<HTMLButtonElement>("[data-sign-contract]");
  if (signContract?.dataset.signContract) { const error = service.signCustomerContract(signContract.dataset.signContract); toast(error ?? "大客户合同已生效，匹配订单将自动获得加成"); return; }
  const buyNew = target.closest<HTMLButtonElement>("[data-buy-new]");
  if (buyNew?.dataset.buyNew) { const previous = service.getState().vehicleUnits.length; const error = service.purchaseNewVehicle(buyNew.dataset.buyNew); const current = service.getState(); if (!error && current.vehicleUnits.length > previous) context.selectedVehicleId = current.vehicleUnits.at(-1)?.id ?? context.selectedVehicleId; toast(error ?? "新车已交付，可在车队中独立调度"); return; }
  const buyUsed = target.closest<HTMLButtonElement>("[data-buy-used]");
  if (buyUsed?.dataset.buyUsed) { const previous = service.getState().vehicleUnits.length; const error = service.purchaseUsedVehicle(buyUsed.dataset.buyUsed); const current = service.getState(); if (!error && current.vehicleUnits.length > previous) context.selectedVehicleId = current.vehicleUnits.at(-1)?.id ?? context.selectedVehicleId; toast(error ?? "二手车已过户并加入车队"); return; }
  const sellVehicle = target.closest<HTMLButtonElement>("[data-sell-vehicle]");
  if (sellVehicle?.dataset.sellVehicle) { const error = service.sellVehicle(sellVehicle.dataset.sellVehicle); const current = service.getState(); if (!current.vehicleUnits.some((unit) => unit.id === context.selectedVehicleId)) context.selectedVehicleId = current.vehicleUnits[0].id; toast(error ?? "车辆已出售，相关贷款已结清"); return; }
  if (target.closest("#expand-parking")) { const error = service.expandParking(); toast(error ?? "停车场扩建完成，新增 1 个车位"); return; }
  if (target.closest("#reset-game")) { service.reset(); context.selectedVehicleId = service.getState().vehicleUnits[0].id; context.mapViewport = focusVehicleViewport(); activateView("map"); toast("测试存档已重置"); }
});

type MapPointer = { clientX: number; clientY: number };
let mapPointers = new Map<number, MapPointer>();
let mapGesture: { viewport: ViewContext["mapViewport"]; centerX: number; centerY: number; distance: number; width: number; height: number } | null = null;
let mapRenderFrame = 0;
const scheduleMapRender = (): void => {
  if (mapRenderFrame) return;
  mapRenderFrame = window.requestAnimationFrame(() => { mapRenderFrame = 0; renderView(service.getState(), contentBundle, context); });
};
const pointerCenter = (pointers: readonly MapPointer[]): MapPointer => ({ clientX: pointers.reduce((sum, point) => sum + point.clientX, 0) / pointers.length, clientY: pointers.reduce((sum, point) => sum + point.clientY, 0) / pointers.length });
const pointerDistance = (pointers: readonly MapPointer[]): number => pointers.length < 2 ? 1 : Math.hypot(pointers[1].clientX - pointers[0].clientX, pointers[1].clientY - pointers[0].clientY);
root.addEventListener("pointerdown", (event) => {
  const target = event.target as Element;
  const map = target.closest<SVGSVGElement>("[data-map-canvas]");
  if (!map || target.closest("[data-map-node-id]")) return;
  mapPointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
  const points = [...mapPointers.values()];
  const center = pointerCenter(points);
  mapGesture = { viewport: { ...context.mapViewport }, centerX: center.clientX, centerY: center.clientY, distance: pointerDistance(points), width: Math.max(1, map.clientWidth), height: Math.max(1, map.clientHeight) };
  map.setPointerCapture?.(event.pointerId);
});
root.addEventListener("pointermove", (event) => {
  if (!mapGesture || !mapPointers.has(event.pointerId)) return;
  mapPointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
  const points = [...mapPointers.values()];
  const center = pointerCenter(points);
  const zoom = points.length > 1 ? mapGesture.viewport.zoom * pointerDistance(points) / mapGesture.distance : mapGesture.viewport.zoom;
  const box = mapViewBox(contentBundle.mapConfig, { ...mapGesture.viewport, zoom });
  context.mapViewport = clampMapViewport(contentBundle.mapConfig, {
    ...mapGesture.viewport,
    zoom,
    centerX: mapGesture.viewport.centerX - (center.clientX - mapGesture.centerX) / mapGesture.width * box.width,
    centerY: mapGesture.viewport.centerY - (center.clientY - mapGesture.centerY) / mapGesture.height * box.height
  });
  scheduleMapRender();
});
const endMapDrag = (event: PointerEvent): void => {
  mapPointers.delete(event.pointerId);
  const points = [...mapPointers.values()];
  if (!points.length) { mapGesture = null; return; }
  const center = pointerCenter(points);
  mapGesture = { viewport: { ...context.mapViewport }, centerX: center.clientX, centerY: center.clientY, distance: pointerDistance(points), width: mapGesture?.width ?? 1, height: mapGesture?.height ?? 1 };
};
root.addEventListener("pointerup", endMapDrag);
root.addEventListener("pointercancel", endMapDrag);
root.addEventListener("wheel", (event) => {
  const target = event.target as Element;
  if (!target.closest("[data-map-canvas]")) return;
  event.preventDefault();
  const factor = event.deltaY < 0 ? 1.16 : 1 / 1.16;
  context.mapViewport = clampMapViewport(contentBundle.mapConfig, { ...context.mapViewport, zoom: context.mapViewport.zoom * factor });
  scheduleMapRender();
}, { passive: false });

service.subscribe((state) => renderView(state, contentBundle, context));
service.startClock();
if ("serviceWorker" in navigator && import.meta.env.PROD) window.addEventListener("load", () => { void navigator.serviceWorker.register("./sw.js").catch(() => undefined); });
