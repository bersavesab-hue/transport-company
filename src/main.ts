import "./styles.css";
import { contentBundle } from "./adapters/content.js";
import { BrowserSaveRepository } from "./adapters/save-repository.js";
import { GameService } from "./application/game-service.js";
import { renderShell, renderView, type ViewContext } from "./presentation/app-view.js";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("App root is missing");
const service = new GameService(contentBundle, new BrowserSaveRepository());
const context: ViewContext = { view: "map", selectedCityId: null, selectedVehicleId: service.getState().vehicleUnits[0].id, marketFilter: "all" };
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
  const buyNew = target.closest<HTMLButtonElement>("[data-buy-new]");
  if (buyNew?.dataset.buyNew) { const previous = service.getState().vehicleUnits.length; const error = service.purchaseNewVehicle(buyNew.dataset.buyNew); const current = service.getState(); if (!error && current.vehicleUnits.length > previous) context.selectedVehicleId = current.vehicleUnits.at(-1)?.id ?? context.selectedVehicleId; toast(error ?? "新车已交付，可在车队中独立调度"); return; }
  const buyUsed = target.closest<HTMLButtonElement>("[data-buy-used]");
  if (buyUsed?.dataset.buyUsed) { const previous = service.getState().vehicleUnits.length; const error = service.purchaseUsedVehicle(buyUsed.dataset.buyUsed); const current = service.getState(); if (!error && current.vehicleUnits.length > previous) context.selectedVehicleId = current.vehicleUnits.at(-1)?.id ?? context.selectedVehicleId; toast(error ?? "二手车已过户并加入车队"); return; }
  const sellVehicle = target.closest<HTMLButtonElement>("[data-sell-vehicle]");
  if (sellVehicle?.dataset.sellVehicle) { const error = service.sellVehicle(sellVehicle.dataset.sellVehicle); const current = service.getState(); if (!current.vehicleUnits.some((unit) => unit.id === context.selectedVehicleId)) context.selectedVehicleId = current.vehicleUnits[0].id; toast(error ?? "车辆已出售，相关贷款已结清"); return; }
  if (target.closest("#expand-parking")) { const error = service.expandParking(); toast(error ?? "停车场扩建完成，新增 1 个车位"); return; }
  if (target.closest("#reset-game")) { service.reset(); context.selectedVehicleId = service.getState().vehicleUnits[0].id; activateView("map"); toast("测试存档已重置"); }
});

service.subscribe((state) => renderView(state, contentBundle, context));
service.startClock();
