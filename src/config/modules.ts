export type ModuleStatus = "active" | "reserved";

export interface GameModuleDefinition {
  id: string;
  label: string;
  shortLabel: string;
  icon: string;
  status: ModuleStatus;
  featureFlag?: string;
  group: "primary" | "operation" | "expansion";
}

export const GAME_MODULES: readonly GameModuleDefinition[] = [
  { id: "map", label: "运输地图", shortLabel: "地图", icon: "map", status: "active", group: "primary" },
  { id: "market", label: "订单市场", shortLabel: "订单", icon: "orders", status: "active", group: "primary" },
  { id: "fleet", label: "车辆档案", shortLabel: "车队", icon: "truck", status: "active", group: "primary" },
  { id: "company", label: "公司经营", shortLabel: "公司", icon: "company", status: "active", group: "primary" },
  { id: "warehouse", label: "仓储网络", shortLabel: "仓库", icon: "warehouse", status: "reserved", group: "operation" },
  { id: "staff", label: "员工与司机", shortLabel: "员工", icon: "staff", status: "reserved", group: "operation" },
  { id: "contracts", label: "大客户合同", shortLabel: "合同", icon: "contract", status: "reserved", group: "operation" },
  { id: "maintenance", label: "维修与配件", shortLabel: "维修", icon: "tools", status: "reserved", group: "operation" },
  { id: "dealership", label: "4S店", shortLabel: "4S店", icon: "store", status: "active", featureFlag: "dealership", group: "expansion" },
  { id: "used-vehicles", label: "二手车市场", shortLabel: "二手车", icon: "used", status: "active", featureFlag: "usedVehicleMarket", group: "expansion" },
  { id: "passenger", label: "客运业务", shortLabel: "客运", icon: "bus", status: "reserved", featureFlag: "roadPassenger", group: "expansion" },
  { id: "rail", label: "铁路货运", shortLabel: "铁路", icon: "rail", status: "reserved", featureFlag: "rail", group: "expansion" },
  { id: "shipping", label: "港口航运", shortLabel: "航运", icon: "ship", status: "reserved", featureFlag: "shipping", group: "expansion" },
  { id: "aviation", label: "航空货运", shortLabel: "航空", icon: "plane", status: "reserved", featureFlag: "aviation", group: "expansion" },
  { id: "branches", label: "分公司网络", shortLabel: "分公司", icon: "branch", status: "reserved", group: "expansion" },
  { id: "international", label: "国际物流", shortLabel: "国际", icon: "globe", status: "reserved", featureFlag: "internationalMap", group: "expansion" },
  { id: "competitors", label: "同行竞争", shortLabel: "竞争", icon: "rival", status: "reserved", featureFlag: "npcCompetition", group: "expansion" }
] as const;
