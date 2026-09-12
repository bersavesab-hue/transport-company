import type { EntityId, GameSeconds, MoneyCents } from "./types.js";

export interface DomainEvent<TPayload = unknown> {
  id: EntityId;
  type: string;
  occurredAt: GameSeconds;
  aggregateId: EntityId;
  payload: TPayload;
}

export interface AcceptOrderCommand {
  type: "AcceptOrder";
  companyId: EntityId;
  orderId: EntityId;
  expectedRewardCents: MoneyCents;
}

export interface AssignTransportUnitCommand {
  type: "AssignTransportUnit";
  orderIds: EntityId[];
  transportUnitId: EntityId;
}

export interface PlanRouteCommand {
  type: "PlanRoute";
  transportUnitId: EntityId;
  cityIds: EntityId[];
}

export type GameCommand =
  | AcceptOrderCommand
  | AssignTransportUnitCommand
  | PlanRouteCommand;
