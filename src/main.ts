import "./styles.css";
import { contentBundle } from "./adapters/content.js";
import { BrowserSaveRepository } from "./adapters/save-repository.js";
import { GameService } from "./application/game-service.js";
import { renderShell, renderView, type ViewContext } from "./presentation/app-view.js";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("App root is missing");
const service = new GameService(contentBundle, new BrowserSaveRepository());
const context: ViewContext = { view: "map", selectedCityId: null, marketFilter: "all" };
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
  const speed = target.closest<HTMLButtonElement>("[data-speed]");
  if (speed?.dataset.speed) { service.setClock(Number(speed.dataset.speed), false); return; }
  if (target.closest("[data-pause]")) { const state = service.getState(); service.setClock(state.clock.speed || 600, !state.clock.paused); return; }
  const orderButton = target.closest<HTMLButtonElement>(".load-order");
  if (orderButton?.dataset.orderId) { const error = service.loadOrder(orderButton.dataset.orderId); toast(error ?? "装车成功，可继续拼货或立即发车"); return; }
  const unloadButton = target.closest<HTMLButtonElement>("[data-unload-order]");
  if (unloadButton?.dataset.unloadOrder) { const error = service.unloadOrder(unloadButton.dataset.unloadOrder); toast(error ?? "订单已撤下，可重新安排"); return; }
  if (target.closest("#smart-load")) { const error = service.smartLoad(); toast(error ?? "已生成当前城市收益更高的拼货方案"); return; }
  if (target.closest("#start-trip")) { const error = service.startTrip(); toast(error ?? "车辆已出发，地图将实时推进"); return; }
  if (target.closest("#reset-game")) { service.reset(); activateView("map"); toast("测试存档已重置"); }
});

service.subscribe((state) => renderView(state, contentBundle, context));
service.startClock();
