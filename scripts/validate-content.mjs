import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "data/content-packs");
const idPattern = /^[a-z0-9_]+$/;

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const ensureUniqueIds = (items, label) => {
  const seen = new Set();
  for (const item of items) {
    assert(typeof item.id === "string" && idPattern.test(item.id), `${label}: 非法编号 ${item.id}`);
    assert(!seen.has(item.id), `${label}: 重复编号 ${item.id}`);
    seen.add(item.id);
  }
  return seen;
};

const packFolders = await readdir(root, { withFileTypes: true });
let checkedPacks = 0;
let checkedRecords = 0;

for (const folder of packFolders.filter((entry) => entry.isDirectory())) {
  const packRoot = resolve(root, folder.name);
  const manifest = await readJson(resolve(packRoot, "manifest.json"));
  assert(idPattern.test(manifest.id), `内容包非法编号: ${manifest.id}`);
  assert(typeof manifest.version === "string", `${manifest.id}: 缺少版本`);

  const cities = await readJson(resolve(packRoot, manifest.files.cities));
  const routes = await readJson(resolve(packRoot, manifest.files.routes));
  const cargoTypes = await readJson(resolve(packRoot, manifest.files.cargoTypes));
  const vehicleModels = await readJson(resolve(packRoot, manifest.files.vehicleModels));
  const orders = await readJson(resolve(packRoot, manifest.files.orders));
  const marketEvents = await readJson(resolve(packRoot, manifest.files.marketEvents));

  const cityIds = ensureUniqueIds(cities, "城市");
  const routeIds = ensureUniqueIds(routes, "路线");
  const cargoIds = ensureUniqueIds(cargoTypes, "货物");
  const vehicleIds = ensureUniqueIds(vehicleModels, "车辆型号");
  const orderIds = ensureUniqueIds(orders, "订单");
  const marketEventIds = ensureUniqueIds(marketEvents, "市场事件");

  for (const city of cities) {
    assert(city.contentPackId === manifest.id, `${city.id}: 内容包归属错误`);
    assert(city.x >= 0 && city.x <= 1 && city.y >= 0 && city.y <= 1, `${city.id}: 地图坐标越界`);
  }

  for (const route of routes) {
    assert(cityIds.has(route.from) && cityIds.has(route.to), `${route.id}: 路线端点不存在`);
    assert(route.from !== route.to, `${route.id}: 起终点相同`);
    assert(Number.isInteger(route.distanceMeters) && route.distanceMeters > 0, `${route.id}: 距离无效`);
  }

  for (const vehicle of vehicleModels) {
    assert(vehicle.contentPackId === manifest.id, `${vehicle.id}: 内容包归属错误`);
    assert(Number.isInteger(vehicle.purchasePriceCents) && vehicle.purchasePriceCents >= 0, `${vehicle.id}: 价格无效`);
  }

  for (const order of orders) {
    assert(cityIds.has(order.originCityId), `${order.id}: 起点不存在`);
    assert(cityIds.has(order.destinationCityId), `${order.id}: 终点不存在`);
    assert(order.originCityId !== order.destinationCityId, `${order.id}: 起终点相同`);
    assert(cargoIds.has(order.cargoId), `${order.id}: 货物不存在`);
    assert(order.deadlineAt > order.availableAt, `${order.id}: 截止时间无效`);
  }

  for (const event of marketEvents) {
    assert(cityIds.has(event.cityId), `${event.id}: 事件城市不存在`);
    assert(cargoIds.has(event.cargoId), `${event.id}: 事件货物不存在`);
    assert(Number.isInteger(event.demandModifierBasisPoints) && event.demandModifierBasisPoints > 0, `${event.id}: 需求增幅无效`);
    assert(Number.isInteger(event.durationSeconds) && event.durationSeconds > 0, `${event.id}: 持续时间无效`);
  }

  checkedRecords += cityIds.size + routeIds.size + cargoIds.size + vehicleIds.size + orderIds.size + marketEventIds.size;
  checkedPacks += 1;
}

console.log(`内容校验通过：${checkedPacks} 个内容包，${checkedRecords} 条记录。`);
