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

  const mapConfig = await readJson(resolve(packRoot, manifest.files.mapConfig));
  const regions = await readJson(resolve(packRoot, manifest.files.regions));
  const mapNodes = await readJson(resolve(packRoot, manifest.files.mapNodes));
  const mapRoadSegments = await readJson(resolve(packRoot, manifest.files.mapRoadSegments));
  const cities = await readJson(resolve(packRoot, manifest.files.cities));
  const routes = await readJson(resolve(packRoot, manifest.files.routes));
  const cargoTypes = await readJson(resolve(packRoot, manifest.files.cargoTypes));
  const vehicleModels = await readJson(resolve(packRoot, manifest.files.vehicleModels));
  const orders = await readJson(resolve(packRoot, manifest.files.orders));
  const marketEvents = await readJson(resolve(packRoot, manifest.files.marketEvents));
  const customerContracts = await readJson(resolve(packRoot, manifest.files.customerContracts));

  const regionIds = ensureUniqueIds(regions, "区域");
  const mapNodeIds = ensureUniqueIds(mapNodes, "地图节点");
  const mapRoadSegmentIds = ensureUniqueIds(mapRoadSegments, "地图道路");
  const cityIds = ensureUniqueIds(cities, "城市");
  const routeIds = ensureUniqueIds(routes, "路线");
  const cargoIds = ensureUniqueIds(cargoTypes, "货物");
  const vehicleIds = ensureUniqueIds(vehicleModels, "车辆型号");
  const orderIds = ensureUniqueIds(orders, "订单");
  const marketEventIds = ensureUniqueIds(marketEvents, "市场事件");
  const contractIds = ensureUniqueIds(customerContracts, "客户合同");

  assert(mapConfig.minLongitude < mapConfig.maxLongitude && mapConfig.minLatitude < mapConfig.maxLatitude, `${mapConfig.id}: 全国地图边界无效`);
  assert(mapConfig.minZoom > 0 && mapConfig.defaultZoom >= mapConfig.minZoom && mapConfig.maxZoom >= mapConfig.defaultZoom, `${mapConfig.id}: 地图缩放范围无效`);
  assert(Array.isArray(mapConfig.zoomLevels) && mapConfig.zoomLevels.length === 4, `${mapConfig.id}: 必须配置四级地图缩放`);
  assert(mapConfig.zoomLevels.map((level) => level.id).join(",") === "national,province,county,local", `${mapConfig.id}: 地图层级顺序无效`);
  mapConfig.zoomLevels.forEach((level, index) => {
    assert(level.minZoom >= mapConfig.minZoom && level.minZoom <= mapConfig.maxZoom, `${mapConfig.id}: ${level.id} 缩放阈值越界`);
    if (index > 0) assert(level.minZoom > mapConfig.zoomLevels[index - 1].minZoom, `${mapConfig.id}: 地图缩放阈值必须递增`);
  });

  for (const region of regions) {
    assert(region.contentPackId === manifest.id, `${region.id}: 内容包归属错误`);
    assert(region.centerLongitude >= mapConfig.minLongitude && region.centerLongitude <= mapConfig.maxLongitude, `${region.id}: 区域经度越界`);
    assert(region.centerLatitude >= mapConfig.minLatitude && region.centerLatitude <= mapConfig.maxLatitude, `${region.id}: 区域纬度越界`);
  }

  for (const city of cities) {
    assert(city.contentPackId === manifest.id, `${city.id}: 内容包归属错误`);
    assert(city.x >= 0 && city.x <= 1 && city.y >= 0 && city.y <= 1, `${city.id}: 地图坐标越界`);
    assert(city.longitude >= mapConfig.minLongitude && city.longitude <= mapConfig.maxLongitude, `${city.id}: 全国经度越界`);
    assert(city.latitude >= mapConfig.minLatitude && city.latitude <= mapConfig.maxLatitude, `${city.id}: 全国纬度越界`);
    assert(regionIds.has(city.regionId), `${city.id}: 所属区域不存在`);
  }

  for (const node of mapNodes) {
    assert(node.contentPackId === manifest.id, `${node.id}: 内容包归属错误`);
    assert(regionIds.has(node.regionId), `${node.id}: 所属区域不存在`);
    assert(node.parentId === null || mapNodeIds.has(node.parentId), `${node.id}: 上级地图节点不存在`);
    assert(node.cityId === null || cityIds.has(node.cityId), `${node.id}: 经营城市不存在`);
    assert(node.longitude >= mapConfig.minLongitude && node.longitude <= mapConfig.maxLongitude, `${node.id}: 地图经度越界`);
    assert(node.latitude >= mapConfig.minLatitude && node.latitude <= mapConfig.maxLatitude, `${node.id}: 地图纬度越界`);
    assert(node.minZoom >= mapConfig.minZoom && node.minZoom <= mapConfig.maxZoom, `${node.id}: 显示缩放级别越界`);
  }

  for (const segment of mapRoadSegments) {
    assert(segment.contentPackId === manifest.id, `${segment.id}: 内容包归属错误`);
    assert(mapNodeIds.has(segment.fromNodeId) && mapNodeIds.has(segment.toNodeId), `${segment.id}: 地图道路端点不存在`);
    assert(segment.fromNodeId !== segment.toNodeId, `${segment.id}: 地图道路起终点相同`);
    assert(Array.isArray(segment.geometry) && segment.geometry.length >= 2, `${segment.id}: 道路形状点不足`);
    assert(Array.isArray(segment.routeIds) && segment.routeIds.every((id) => routeIds.has(id)), `${segment.id}: 经营路线引用无效`);
    assert(segment.minZoom >= mapConfig.minZoom && segment.minZoom <= mapConfig.maxZoom, `${segment.id}: 显示缩放级别越界`);
    for (const point of segment.geometry) {
      assert(point.longitude >= mapConfig.minLongitude && point.longitude <= mapConfig.maxLongitude, `${segment.id}: 道路经度越界`);
      assert(point.latitude >= mapConfig.minLatitude && point.latitude <= mapConfig.maxLatitude, `${segment.id}: 道路纬度越界`);
    }
  }

  for (const route of routes) {
    assert(cityIds.has(route.from) && cityIds.has(route.to), `${route.id}: 路线端点不存在`);
    assert(route.from !== route.to, `${route.id}: 起终点相同`);
    assert(Number.isInteger(route.distanceMeters) && route.distanceMeters > 0, `${route.id}: 距离无效`);
  }

  for (const vehicle of vehicleModels) {
    assert(vehicle.contentPackId === manifest.id, `${vehicle.id}: 内容包归属错误`);
    assert(Number.isInteger(vehicle.purchasePriceCents) && vehicle.purchasePriceCents >= 0, `${vehicle.id}: 价格无效`);
    assert(Array.isArray(vehicle.capabilities) && vehicle.capabilities.length > 0, `${vehicle.id}: 缺少运载能力`);
    assert(Number.isInteger(vehicle.requiredReputationBasisPoints) && vehicle.requiredReputationBasisPoints >= 0, `${vehicle.id}: 声誉门槛无效`);
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

  for (const contract of customerContracts) {
    assert(cityIds.has(contract.originCityId) && cityIds.has(contract.destinationCityId), `${contract.id}: 合同城市不存在`);
    assert(cargoIds.has(contract.cargoId), `${contract.id}: 合同货物不存在`);
    assert(Number.isInteger(contract.signingFeeCents) && contract.signingFeeCents >= 0, `${contract.id}: 签约费用无效`);
    assert(Number.isInteger(contract.rewardBonusBasisPoints) && contract.rewardBonusBasisPoints > 0, `${contract.id}: 合同加成无效`);
    assert(Number.isInteger(contract.milestoneOrders) && contract.milestoneOrders > 0, `${contract.id}: 里程碑无效`);
  }

  checkedRecords += 1 + regionIds.size + mapNodeIds.size + mapRoadSegmentIds.size + cityIds.size + routeIds.size + cargoIds.size + vehicleIds.size + orderIds.size + marketEventIds.size + contractIds.size;
  checkedPacks += 1;
}

console.log(`内容校验通过：${checkedPacks} 个内容包，${checkedRecords} 条记录。`);
