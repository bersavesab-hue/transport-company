import type { VehicleModelDefinition, VehicleUnitState } from "./model.js";

export const dealerDownPaymentCents = (model: Readonly<VehicleModelDefinition>): number => Math.round(model.purchasePriceCents * 0.3);

export const parkingExpansionCostCents = (currentCapacity: number): number =>
  1_200_000 + currentCapacity * currentCapacity * 240_000;

export const estimateVehicleResaleCents = (model: Readonly<VehicleModelDefinition>, unit: Readonly<VehicleUnitState>): number => {
  const conditionFactor = unit.conditionBasisPoints / 10_000;
  const mileageFactor = Math.max(0.48, 1 - unit.mileageMeters / 1_500_000_000);
  return Math.max(0, Math.round(model.purchasePriceCents * 0.72 * conditionFactor * mileageFactor));
};
