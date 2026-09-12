import "./styles.css";
import { contentBundle } from "./adapters/content.js";
import { BrowserSaveRepository } from "./adapters/save-repository.js";
import { GameService } from "./application/game-service.js";
import { renderShell, renderView } from "./presentation/app-view.js";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("App root is missing");
const service = new GameService(contentBundle, new BrowserSaveRepository());
let currentView = "map";
renderShell(root);

const toast = (message: string): void => {
  const element = document.querySelector<HTMLElement>("#toast")!;
  element.textContent = message; element.classList.add("show");
  window.setTimeout(() => element.classList.remove("show"), 2_200);
};
const activateView = (view: string): void => {
  currentView = view;
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  renderView(service.getState(), contentBundle, currentView);
};

root.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const nav = target.closest<HTMLButtonElement>("[data-view]");
  if (nav) return activateView(nav.dataset.view ?? "map");
  const jump = target.closest<HTMLButtonElement>("[data-view-jump]");
  if (jump) return activateView(jump.dataset.viewJump ?? "map");
  const orderButton = target.closest<HTMLButtonElement>(".load-order");
  if (orderButton?.dataset.orderId) { const error = service.loadOrder(orderButton.dataset.orderId); toast(error ?? "装车成功，可继续拼货或立即发车"); return; }
  if (target.closest("#start-trip")) { const error = service.startTrip(); toast(error ?? "车辆已出发，地图将实时推进"); return; }
  if (target.closest("#reset-game")) { service.reset(); activateView("map"); toast("测试存档已重置"); }
});

service.subscribe((state) => renderView(state, contentBundle, currentView));
service.startClock();
