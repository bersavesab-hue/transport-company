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

export interface StartTripCommand {
  type: "StartTrip";
  transportUnitId: EntityId;
}

export interface AdvanceTimeCommand {
  type: "AdvanceTime";
  elapsedGameSeconds: GameSeconds;
}

export type GameCommand =
  | AcceptOrderCommand
  | AssignTransportUnitCommand
  | PlanRouteCommand
  | StartTripCommand
  | AdvanceTimeCommand;
