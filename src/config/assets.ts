export interface AssetDefinition {
  id: string;
  path: string | null;
  fallback: string;
  width: number;
  height: number;
  category: "brand" | "map" | "vehicle" | "cargo" | "facility" | "portrait";
  status: "fallback" | "final";
}

const mapBaseTerrainUrl = new URL("../../assets/generated/map-base-terrain-0001.png", import.meta.url).href;

export const ASSET_CATALOG: readonly AssetDefinition[] = [
  { id: "brand_logo_001", path: null, fallback: "route", width: 256, height: 256, category: "brand", status: "fallback" },
  { id: "map_region_central_china_001", path: null, fallback: "map", width: 1600, height: 1200, category: "map", status: "fallback" },
  { id: "map_china_national_001", path: null, fallback: "map", width: 4096, height: 2304, category: "map", status: "fallback" },
  { id: "map_world_terrain_001", path: mapBaseTerrainUrl, fallback: "map", width: 1536, height: 1024, category: "map", status: "final" },
  { id: "vehicle_light_truck_001", path: null, fallback: "truck", width: 512, height: 256, category: "vehicle", status: "fallback" },
  { id: "vehicle_micro_van_001", path: null, fallback: "truck", width: 512, height: 256, category: "vehicle", status: "fallback" },
  { id: "vehicle_medium_truck_001", path: null, fallback: "truck", width: 512, height: 256, category: "vehicle", status: "fallback" },
  { id: "vehicle_heavy_truck_001", path: null, fallback: "truck", width: 512, height: 256, category: "vehicle", status: "fallback" },
  { id: "vehicle_refrigerated_001", path: null, fallback: "truck", width: 512, height: 256, category: "vehicle", status: "fallback" },
  { id: "cargo_general_001", path: null, fallback: "box", width: 192, height: 192, category: "cargo", status: "fallback" },
  { id: "cargo_electronics_001", path: null, fallback: "chip", width: 192, height: 192, category: "cargo", status: "fallback" },
  { id: "cargo_furniture_001", path: null, fallback: "chair", width: 192, height: 192, category: "cargo", status: "fallback" },
  { id: "cargo_fresh_food_001", path: null, fallback: "fresh", width: 192, height: 192, category: "cargo", status: "fallback" },
  { id: "cargo_auto_parts_001", path: null, fallback: "gear", width: 192, height: 192, category: "cargo", status: "fallback" },
  { id: "cargo_express_001", path: null, fallback: "parcel", width: 192, height: 192, category: "cargo", status: "fallback" },
  { id: "facility_hq_small_001", path: null, fallback: "building", width: 512, height: 512, category: "facility", status: "fallback" },
  { id: "facility_parking_small_001", path: null, fallback: "parking", width: 512, height: 512, category: "facility", status: "fallback" }
] as const;

export const getAsset = (id: string) => ASSET_CATALOG.find((asset) => asset.id === id);
