import { BrowserSaveRepository } from "../adapters/save-repository.js";
import { createInitialState, GameEngine } from "../core/domain/game-engine.js";
import type { ContentBundle, GameState } from "../core/domain/model.js";

const ERRORS: Record<string, string> = {
  ORDER_NOT_AVAILABLE: "订单已经失效", ASSIGNMENT_INVALID: "订单或车辆状态不正确",
  VEHICLE_NOT_AT_ORIGIN: "车辆不在订单起点", MULTI_STOP_NOT_ENABLED: "当前版本只能拼装同一目的地订单",
  CAPACITY_EXCEEDED: "车辆载重或容积不足", TRIP_NOT_READY: "车辆尚未完成装载", NO_DIRECT_ROUTE: "当前没有可用直达道路"
};

export class GameService {
  private engine: GameEngine;
  private listeners = new Set<(state: Readonly<GameState>) => void>();
  private timer: number | null = null;

  constructor(private readonly content: ContentBundle, private readonly saves: BrowserSaveRepository) {
    this.engine = new GameEngine(content, saves.load() ?? createInitialState(content));
  }

  getState(): Readonly<GameState> { return this.engine.snapshot(); }
  subscribe(listener: (state: Readonly<GameState>) => void): () => void { this.listeners.add(listener); listener(this.getState()); return () => this.listeners.delete(listener); }

  loadOrder(orderId: string): string | null {
    const state = this.getState();
    const vehicle = state.vehicleUnits[0];
    const model = this.content.vehicleModels.find((item) => item.id === vehicle.modelId);
    const order = state.orders.find((item) => item.id === orderId);
    const loads = vehicle.assignedOrderIds.map((id) => state.orders.find((item) => item.id === id)).filter(Boolean);
    if (!order || !model) return "订单或车辆状态不正确";
    if (order.originCityId !== vehicle.currentCityId) return "车辆不在订单起点";
    if (loads.length && loads[0]?.destinationCityId !== order.destinationCityId) return "当前版本只能拼装同一目的地订单";
    if (loads.reduce((sum, item) => sum + (item?.weightKg ?? 0), 0) + order.weightKg > model.capacityKg || loads.reduce((sum, item) => sum + (item?.volumeLiters ?? 0), 0) + order.volumeLiters > model.capacityLiters) return "车辆载重或容积不足";
    const vehicleId = vehicle.id;
    const accepted = this.engine.dispatch({ type: "AcceptOrder", orderId });
    if (!accepted.ok) return ERRORS[accepted.errorCode ?? ""] ?? "操作失败";
    const assigned = this.engine.dispatch({ type: "AssignTransportUnit", orderId, transportUnitId: vehicleId });
    if (!assigned.ok) return ERRORS[assigned.errorCode ?? ""] ?? "装载失败";
    this.persistAndNotify();
    return null;
  }

  startTrip(): string | null {
    const result = this.engine.dispatch({ type: "StartTrip", transportUnitId: this.getState().vehicleUnits[0].id });
    if (!result.ok) return ERRORS[result.errorCode ?? ""] ?? "发车失败";
    this.persistAndNotify();
    return null;
  }

  startClock(): void {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => {
      const state = this.getState();
      if (!state.clock.paused) { this.engine.dispatch({ type: "AdvanceTime", elapsedGameSeconds: state.clock.speed }); this.persistAndNotify(); }
    }, 1_000);
  }

  reset(): void { this.saves.clear(); this.engine = new GameEngine(this.content, createInitialState(this.content)); this.persistAndNotify(); }
  private persistAndNotify(): void { const snapshot = this.getState(); this.saves.save(snapshot as GameState); this.listeners.forEach((listener) => listener(snapshot)); }
}
