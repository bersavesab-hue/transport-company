import cargoTypesSource from "../../data/content-packs/china_test_001/cargo-types.json";
import citiesSource from "../../data/content-packs/china_test_001/cities.json";
import ordersSource from "../../data/content-packs/china_test_001/orders.sample.json";
import routesSource from "../../data/content-packs/china_test_001/routes.json";
import vehicleModelsSource from "../../data/content-packs/china_test_001/vehicle-models.json";
import marketEventsSource from "../../data/content-packs/china_test_001/market-events.json";
import type { ContentBundle } from "../core/domain/model.js";

export const contentBundle: ContentBundle = {
  cities: citiesSource,
  routes: routesSource,
  cargoTypes: cargoTypesSource,
  vehicleModels: vehicleModelsSource,
  orderTemplates: ordersSource,
  marketEvents: marketEventsSource
} as ContentBundle;
