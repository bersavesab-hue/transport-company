import "./styles.css";
import { contentBundle } from "./adapters/content.js";
import { BrowserSaveRepository } from "./adapters/save-repository.js";
import { GameService } from "./application/game-service.js";
import { clampMapViewport, defaultMapViewport, mapViewBox, nationalMapViewport } from "./core/domain/map-projection.js";
import { renderShell, renderView, type ViewContext } from "./presentation/app-view.js";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("App root is missing");
const service = new GameService(contentBundle, new BrowserSaveRepository());
const context: ViewContext = { view: "map", selectedCityId: null, selectedVehicleId: service.getState().vehicleUnits[0].id, marketFilter: "all", mapViewport: defaultMapViewport(contentBundle.mapConfig) };
renderShell(root);

const toast = (message: string): void => {
  const element = document.querySelector<HTMLElement>("#toast")!;
  element.textContent = message; element.classList.add("show");
  window.setTimeout(() => element.classList.remove("show"), 2_200);
};
const activateView = (view: string): void => {
  context.view = view;
  context.selectedCityId = null;
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  renderView(service.getState(), contentBundle, context);
};

root.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const nav = target.closest<HTMLButtonElement>("[data-view]");
  if (nav) return activateView(nav.dataset.view ?? "map");
  const jump = target.closest<HTMLButtonElement>("[data-view-jump]");
  if (jump) return activateView(jump.dataset.viewJump ?? "map");
  const mapScope = target.closest<HTMLButtonElement>("[data-map-scope]");
  if (mapScope?.dataset.mapScope) { context.mapViewport = mapScope.dataset.mapScope === "national" ? nationalMapViewport(contentBundle.mapConfig) : defaultMapViewport(contentBundle.mapConfig); renderView(service.getState(), contentBundle, context); return; }
  const mapZoom = target.closest<HTMLButtonElement>("[data-map-zoom]");
  if (mapZoom?.dataset.mapZoom) { context.mapViewport = clampMapViewport(contentBundle.mapConfig, { ...context.mapViewport, zoom: context.mapViewport.zoom * (mapZoom.dataset.mapZoom === "in" ? 1.35 : 1 / 1.35) }); renderView(service.getState(), contentBundle, context); return; }
  const city = target.closest<SVGGElement>("[data-city-id]");
  if (city?.dataset.cityId) { context.selectedCityId = city.dataset.cityId; renderView(service.getState(), contentBundle, context); return; }
  if (target.closest("[data-close-city]")) { context.selectedCityId = null; renderView(service.getState(), contentBundle, context); return; }
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
  if (target.closest("#reset-game")) { service.reset(); context.selectedVehicleId = service.getState().vehicleUnits[0].id; activateView("map"); toast("测试存档已重置"); }
});

let mapDrag: { pointerId: number; clientX: number; clientY: number; viewport: ViewContext["mapViewport"]; width: number; height: number } | null = null;
root.addEventListener("pointerdown", (event) => {
  const target = event.target as Element;
  const map = target.closest<SVGSVGElement>("[data-map-canvas]");
  if (!map || target.closest("[data-city-id]")) return;
  mapDrag = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, viewport: { ...context.mapViewport }, width: Math.max(1, map.clientWidth), height: Math.max(1, map.clientHeight) };
  root.setPointerCapture(event.pointerId);
});
root.addEventListener("pointermove", (event) => {
  if (!mapDrag || mapDrag.pointerId !== event.pointerId) return;
  const box = mapViewBox(contentBundle.mapConfig, mapDrag.viewport);
  context.mapViewport = clampMapViewport(contentBundle.mapConfig, {
    ...mapDrag.viewport,
    centerX: mapDrag.viewport.centerX - (event.clientX - mapDrag.clientX) / mapDrag.width * box.width,
    centerY: mapDrag.viewport.centerY - (event.clientY - mapDrag.clientY) / mapDrag.height * box.height
  });
  renderView(service.getState(), contentBundle, context);
});
const endMapDrag = (event: PointerEvent): void => { if (mapDrag?.pointerId === event.pointerId) mapDrag = null; };
root.addEventListener("pointerup", endMapDrag);
root.addEventListener("pointercancel", endMapDrag);

service.subscribe((state) => renderView(state, contentBundle, context));
service.startClock();
if ("serviceWorker" in navigator && import.meta.env.PROD) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
