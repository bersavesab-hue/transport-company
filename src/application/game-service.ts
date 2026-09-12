import { BrowserSaveRepository } from "../adapters/save-repository.js";
import { createInitialState, GameEngine } from "../core/domain/game-engine.js";
import { findBestAdditionalLoad } from "../core/domain/dispatch-intelligence.js";
import type { ContentBundle, EngineCommand, GameState } from "../core/domain/model.js";

const ERRORS: Record<string, string> = {
  ORDER_NOT_AVAILABLE: "订单已经失效", ASSIGNMENT_INVALID: "订单或车辆状态不正确",
  VEHICLE_NOT_AT_ORIGIN: "车辆不在订单起点", MULTI_STOP_NOT_ENABLED: "当前版本只能拼装同一目的地订单",
  CAPACITY_EXCEEDED: "车辆载重或容积不足", TRIP_NOT_READY: "车辆尚未完成装载", NO_DIRECT_ROUTE: "当前没有可用直达道路",
  UNASSIGNMENT_INVALID: "当前订单无法撤下", VEHICLE_CAPABILITY_MISMATCH: "该车型不具备这类货物所需的运输能力",
  VEHICLE_MODEL_UNAVAILABLE: "该车型当前不可购买", FEATURE_DISABLED: "该功能尚未开放", PARKING_FULL: "停车位已满，请先扩建停车场",
  REPUTATION_TOO_LOW: "公司声誉尚未达到该车型的购买要求", INSUFFICIENT_CASH: "现金不足", USED_OFFER_UNAVAILABLE: "该二手车源已经失效",
  VEHICLE_NOT_FOUND: "车辆不存在", LAST_VEHICLE: "必须至少保留一辆运营车辆", VEHICLE_BUSY: "车辆执行任务时不能出售",
  LOAN_SETTLEMENT_UNAFFORDABLE: "出售收入不足以结清该车贷款", REPOSITION_INVALID: "只有空闲且未装货的车辆可以空驶调度",
  CONTRACT_UNAVAILABLE: "该客户合同当前不可签订", CONTRACT_ALREADY_SIGNED: "该合同已经签订", CONTRACT_LIMIT: "当前最多同时经营两份大客户合同"
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

  loadOrder(orderId: string, vehicleId?: string): string | null {
    const state = this.getState();
    const vehicle = state.vehicleUnits.find((item) => item.id === vehicleId) ?? state.vehicleUnits[0];
    const model = this.content.vehicleModels.find((item) => item.id === vehicle.modelId);
    const order = state.orders.find((item) => item.id === orderId);
    const loads = vehicle.assignedOrderIds.map((id) => state.orders.find((item) => item.id === id)).filter(Boolean);
    if (!order || !model) return "订单或车辆状态不正确";
    if (order.originCityId !== vehicle.currentCityId) return "车辆不在订单起点";
    if (state.featureFlags.multiStopRouting === false && loads.length && loads[0]?.destinationCityId !== order.destinationCityId) return ERRORS.MULTI_STOP_NOT_ENABLED;
    if (loads.reduce((sum, item) => sum + (item?.weightKg ?? 0), 0) + order.weightKg > model.capacityKg || loads.reduce((sum, item) => sum + (item?.volumeLiters ?? 0), 0) + order.volumeLiters > model.capacityLiters) return "车辆载重或容积不足";
    const cargo = this.content.cargoTypes.find((item) => item.id === order.cargoId);
    if (cargo && !model.capabilities.includes(cargo.temperature)) return ERRORS.VEHICLE_CAPABILITY_MISMATCH;
    const accepted = this.engine.dispatch({ type: "AcceptOrder", orderId });
    if (!accepted.ok) return ERRORS[accepted.errorCode ?? ""] ?? "操作失败";
    const assigned = this.engine.dispatch({ type: "AssignTransportUnit", orderId, transportUnitId: vehicle.id });
    if (!assigned.ok) return ERRORS[assigned.errorCode ?? ""] ?? "装载失败";
    this.persistAndNotify();
    return null;
  }

  startTrip(vehicleId?: string): string | null {
    const state = this.getState();
    const vehicle = state.vehicleUnits.find((item) => item.id === vehicleId) ?? state.vehicleUnits[0];
    const result = this.engine.dispatch({ type: "StartTrip", transportUnitId: vehicle.id });
    if (!result.ok) return ERRORS[result.errorCode ?? ""] ?? "发车失败";
    this.persistAndNotify();
    return null;
  }

  repositionVehicle(destinationCityId: string, vehicleId?: string): string | null {
    const state = this.getState();
    const vehicle = state.vehicleUnits.find((item) => item.id === vehicleId) ?? state.vehicleUnits[0];
    const result = this.engine.dispatch({ type: "RepositionVehicle", transportUnitId: vehicle.id, destinationCityId });
    if (!result.ok) return ERRORS[result.errorCode ?? ""] ?? "空驶调度失败";
    this.persistAndNotify();
    return null;
  }

  signCustomerContract(contractId: string): string | null {
    const result = this.engine.dispatch({ type: "SignCustomerContract", contractId });
    if (!result.ok) return ERRORS[result.errorCode ?? ""] ?? "签约失败";
    this.persistAndNotify();
    return null;
  }

  smartLoad(vehicleId?: string): string | null {
    const state = this.getState();
    if (state.featureFlags.smartDispatch === false) return "智能调度功能当前未开放";
    const vehicle = state.vehicleUnits.find((item) => item.id === vehicleId) ?? state.vehicleUnits[0];
    const orderIds = findBestAdditionalLoad(state, this.content, vehicle);
    if (!orderIds.length) return "当前城市没有可组成盈利方案的货源";
    for (const orderId of orderIds) {
      const accepted = this.engine.dispatch({ type: "AcceptOrder", orderId });
      if (!accepted.ok) return ERRORS[accepted.errorCode ?? ""] ?? "智能拼货失败";
      const assigned = this.engine.dispatch({ type: "AssignTransportUnit", orderId, transportUnitId: vehicle.id });
      if (!assigned.ok) return ERRORS[assigned.errorCode ?? ""] ?? "智能拼货失败";
    }
    this.persistAndNotify();
    return null;
  }

  unloadOrder(orderId: string, vehicleId?: string): string | null {
    const state = this.getState();
    const vehicle = state.vehicleUnits.find((item) => item.id === vehicleId) ?? state.vehicleUnits[0];
    const result = this.engine.dispatch({ type: "UnassignTransportUnit", orderId, transportUnitId: vehicle.id });
    if (!result.ok) return ERRORS[result.errorCode ?? ""] ?? "撤下失败";
    this.persistAndNotify();
    return null;
  }

  purchaseNewVehicle(modelId: string): string | null { return this.runAssetCommand({ type: "PurchaseNewVehicle", modelId }); }
  purchaseUsedVehicle(offerId: string): string | null { return this.runAssetCommand({ type: "PurchaseUsedVehicle", offerId }); }
  sellVehicle(vehicleId: string): string | null { return this.runAssetCommand({ type: "SellVehicle", transportUnitId: vehicleId }); }
  expandParking(): string | null { return this.runAssetCommand({ type: "ExpandParking" }); }

  setClock(speed: number, paused: boolean): void {
    this.engine.dispatch({ type: "SetClock", speed, paused });
    this.persistAndNotify();
  }

  startClock(): void {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => {
      const state = this.getState();
      if (!state.clock.paused) { this.engine.dispatch({ type: "AdvanceTime", elapsedGameSeconds: state.clock.speed }); this.persistAndNotify(); }
    }, 1_000);
  }

  reset(): void { this.saves.clear(); this.engine = new GameEngine(this.content, createInitialState(this.content)); this.persistAndNotify(); }
  private runAssetCommand(command: Extract<EngineCommand, { type: "PurchaseNewVehicle" | "PurchaseUsedVehicle" | "SellVehicle" | "ExpandParking" }>): string | null {
    const result = this.engine.dispatch(command);
    if (!result.ok) return ERRORS[result.errorCode ?? ""] ?? "资产操作失败";
    this.persistAndNotify();
    return null;
  }
  private persistAndNotify(): void { const snapshot = this.getState(); this.saves.save(snapshot as GameState); this.listeners.forEach((listener) => listener(snapshot)); }
}
