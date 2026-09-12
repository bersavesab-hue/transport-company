import { GAME_MODULES } from "../config/modules.js";
import { projectLoadedTrip } from "../core/domain/dispatch-intelligence.js";
import { getActiveMarketEvent, getCityMarketTone, getMarketIndexBasisPoints } from "../core/domain/market-intelligence.js";
import type { ContentBundle, GameState, MarketOrder, VehicleUnitState } from "../core/domain/model.js";
import { dealerDownPaymentCents, estimateVehicleResaleCents, parkingExpansionCostCents } from "../core/domain/vehicle-economy.js";
import { icon } from "./icons.js";

export type MarketFilter = "all" | "local" | "urgent";
export interface ViewContext { view: string; selectedCityId: string | null; selectedVehicleId: string | null; marketFilter: MarketFilter; }

const money = (cents: number) => new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(cents / 100);
const cityName = (content: ContentBundle, id: string) => content.cities.find((city) => city.id === id)?.name ?? id;
const cargoName = (content: ContentBundle, id: string) => content.cargoTypes.find((cargo) => cargo.id === id)?.name ?? id;
const gameTime = (seconds: number) => `${String(Math.floor(seconds / 3600) % 24).padStart(2, "0")}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}`;
const industryNames: Record<string, string> = { agriculture: "农业", manufacturing: "制造业", logistics: "物流", commerce: "商贸", technology: "科技", tourism: "旅游", food: "食品" };
const vehicleStatus = (vehicle: Readonly<VehicleUnitState>): string => vehicle.status === "idle" ? "空闲" : vehicle.status === "loading" ? "装货中" : "运输中";
const vehicleCode = (vehicle: Readonly<VehicleUnitState>): string => `豫R·${vehicle.id.slice(-3).toUpperCase().padStart(3, "0")}`;

const marketNews = (state: Readonly<GameState>, content: ContentBundle): string => {
  if (state.featureFlags.dynamicMarket === false) return "";
  const activeEvent = getActiveMarketEvent(state, content);
  if (!activeEvent) return "";
  const remainingHours = Math.max(1, Math.ceil((state.market.endsAt - state.clock.now) / 3600));
  return `<section class="market-news"><span>${icon("news")}</span><div><small>市场快讯 · 剩余 ${remainingHours} 小时</small><strong>${activeEvent.headline}</strong></div><em>+${Math.round(activeEvent.demandModifierBasisPoints / 100)}%</em></section>`;
};

const orderCard = (order: MarketOrder, state: Readonly<GameState>, content: ContentBundle, vehicle: Readonly<VehicleUnitState>): string => {
  const model = content.vehicleModels.find((item) => item.id === vehicle.modelId)!;
  const loads = vehicle.assignedOrderIds.map((id) => state.orders.find((item) => item.id === id)!).filter(Boolean);
  const loadedWeight = loads.reduce((sum, item) => sum + item.weightKg, 0);
  const loadedVolume = loads.reduce((sum, item) => sum + item.volumeLiters, 0);
  const atOrigin = order.originCityId === vehicle.currentCityId;
  const hasCapacity = loadedWeight + order.weightKg <= model.capacityKg && loadedVolume + order.volumeLiters <= model.capacityLiters;
  const cargo = content.cargoTypes.find((item) => item.id === order.cargoId);
  const activeContract = state.customerContracts.find((contract) => {
    const definition = content.customerContracts.find((item) => item.id === contract.definitionId);
    return definition?.originCityId === order.originCityId && definition.destinationCityId === order.destinationCityId && definition.cargoId === order.cargoId;
  });
  const contractDefinition = activeContract ? content.customerContracts.find((item) => item.id === activeContract.definitionId) : undefined;
  const displayedReward = contractDefinition ? order.rewardCents + Math.round(order.rewardCents * contractDefinition.rewardBonusBasisPoints / 10_000) : order.rewardCents;
  const capable = model.capabilities.includes(cargo?.temperature ?? "ambient");
  const disabled = !atOrigin || vehicle.status === "in_transit" || !hasCapacity || !capable;
  const buttonText = !atOrigin ? "车辆不在起点" : !capable ? "车型不适配" : !hasCapacity ? "运力不足" : "装入车辆";
  const marketIndex = Math.round(getMarketIndexBasisPoints(state, content, order.destinationCityId, order.cargoId) / 100);
  const remainingHours = Math.max(0, Math.round((order.deadlineAt - state.clock.now) / 3600));
  return `<article class="order-card ${disabled ? "muted" : ""}">
    <div class="order-head"><span class="cargo-chip">${icon("box")}${cargoName(content, order.cargoId)}${contractDefinition ? `<em>合同 +${Math.round(contractDefinition.rewardBonusBasisPoints / 100)}%</em>` : ""}</span><strong>${money(displayedReward)}</strong></div>
    <div class="route-line"><span>${cityName(content, order.originCityId)}</span>${icon("arrow")}<span>${cityName(content, order.destinationCityId)}</span></div>
    <div class="order-meta"><span>${order.weightKg} kg</span><span>${(order.volumeLiters / 1000).toFixed(1)} m³</span><span>余 ${remainingHours} 小时</span><span class="market-index ${marketIndex >= 115 ? "hot" : ""}">价指 ${marketIndex}</span></div>
    <button class="load-order" data-order-id="${order.id}" ${disabled ? "disabled" : ""}>${buttonText}</button>
  </article>`;
};

const cityPanel = (cityId: string, state: Readonly<GameState>, content: ContentBundle, vehicle: Readonly<VehicleUnitState>): string => {
  const city = content.cities.find((item) => item.id === cityId);
  if (!city) return "";
  const index = getMarketIndexBasisPoints(state, content, city.id);
  const outgoing = state.orders.filter((order) => order.status === "available" && order.originCityId === city.id).length;
  const incoming = state.orders.filter((order) => order.status === "available" && order.destinationCityId === city.id).length;
  const industries = city.industryTags.map((tag) => industryNames[tag] ?? tag).join(" · ");
  return `<section class="city-panel">
    <div><span class="eyebrow">城市行情</span><h2>${city.name}<small>${industries}</small></h2></div>
    <div class="city-market"><strong>${Math.round(index / 100)}</strong><span>货运指数<br><b>${getCityMarketTone(index)}</b></span></div>
    <div class="city-flow"><span>发出货源 <b>${outgoing}</b></span><span>到达需求 <b>${incoming}</b></span></div>
    ${city.id !== vehicle.currentCityId ? `<button class="reposition-button" data-reposition-city="${city.id}" ${vehicle.status !== "idle" || vehicle.assignedOrderIds.length ? "disabled" : ""}>${vehicle.status !== "idle" || vehicle.assignedOrderIds.length ? "车辆忙碌中" : `空车调往${city.name}`}</button>` : ""}
    <button data-close-city aria-label="关闭城市详情">×</button>
  </section>`;
};

const mapView = (state: Readonly<GameState>, content: ContentBundle, selectedCityId: string | null, vehicle: Readonly<VehicleUnitState>): string => {
  const trip = vehicle.trip;
  const progress = trip ? Math.min(1, Math.max(0, (state.clock.now - trip.startedAt) / (trip.arrivesAt - trip.startedAt))) : 0;
  const from = content.cities.find((city) => city.id === (trip?.fromCityId ?? vehicle.currentCityId));
  const to = content.cities.find((city) => city.id === trip?.toCityId);
  const truckX = from && to ? from.x + (to.x - from.x) * progress : from?.x ?? 0.43;
  const truckY = from && to ? from.y + (to.y - from.y) * progress : from?.y ?? 0.54;
  const roads = content.routes.map((route) => {
    const a = content.cities.find((city) => city.id === route.from)!;
    const b = content.cities.find((city) => city.id === route.to)!;
    return `<line class="road ${trip?.routeId === route.id ? "active" : ""}" x1="${a.x * 100}" y1="${a.y * 100}" x2="${b.x * 100}" y2="${b.y * 100}"/>`;
  }).join("");
  const cities = content.cities.map((city) => `<g data-city-id="${city.id}" class="city ${city.id === vehicle.currentCityId ? "current" : ""} ${city.id === selectedCityId ? "selected" : ""}" transform="translate(${city.x * 100} ${city.y * 100})"><circle r="2.2"/><text y="-4">${city.name}</text></g>`).join("");
  return `<section class="map-card">
    <div class="map-toolbar"><div><span class="eyebrow">华中运输网络</span><h1>把空驶变成利润</h1></div><div class="live-pill"><i></i>${trip ? "运输中" : "待调度"}</div></div>
    <svg class="network-map" viewBox="0 0 100 100" role="img" aria-label="六城市运输地图"><defs><linearGradient id="land" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#1f3850"/><stop offset="1" stop-color="#16283c"/></linearGradient></defs><path class="land" d="M8 16 34 7l22 8 30-3 8 22-9 26 5 21-29 12-25-8-21 4L5 65l7-20z"/>${roads}${cities}<g class="truck-marker" transform="translate(${truckX * 100} ${truckY * 100})"><circle r="4.2"/><text text-anchor="middle" y="1.7">▰</text></g></svg>
    <div class="trip-strip"><div><span>当前位置</span><strong>${trip ? `${cityName(content, trip.fromCityId)} → ${cityName(content, trip.toCityId)}` : cityName(content, vehicle.currentCityId)}</strong></div><div><span>装载订单</span><strong>${vehicle.assignedOrderIds.length} 单</strong></div><div><span>车辆状态</span><strong>${vehicle.status === "in_transit" ? `${Math.round(progress * 100)}%` : vehicle.status === "loading" ? "装货中" : "空闲"}</strong></div></div>
  </section>${selectedCityId && state.featureFlags.cityIntelligence !== false ? cityPanel(selectedCityId, state, content, vehicle) : ""}`;
};

export const renderShell = (root: HTMLElement): void => {
  root.innerHTML = `<div class="app-shell"><header class="topbar"><div class="brand"><span>路</span><div><b>运输纪元</b><small>公路货运 · 初创期</small></div></div><div id="clock"></div></header><main id="main-view"></main><nav class="bottom-nav">${GAME_MODULES.filter((module) => module.group === "primary").map((module, index) => `<button data-view="${module.id}" class="${index === 0 ? "active" : ""}">${icon(module.icon)}<span>${module.shortLabel}</span></button>`).join("")}<button data-view="more">${icon("more")}<span>更多</span></button></nav><div id="toast" role="status"></div></div>`;
};

export const renderView = (state: Readonly<GameState>, content: ContentBundle, context: ViewContext): void => {
  const clock = document.querySelector<HTMLElement>("#clock")!;
  const main = document.querySelector<HTMLElement>("#main-view")!;
  const { view } = context;
  clock.innerHTML = `<strong>${money(state.company.cashCents)}</strong><span>第 ${Math.floor(state.clock.now / 86400) + 1} 天 · ${gameTime(state.clock.now)}</span><div class="speed-control"><button data-speed="600" class="${!state.clock.paused && state.clock.speed === 600 ? "active" : ""}">1×</button><button data-speed="1800" class="${!state.clock.paused && state.clock.speed === 1800 ? "active" : ""}">3×</button><button data-speed="7200" class="${!state.clock.paused && state.clock.speed === 7200 ? "active" : ""}">12×</button><button data-pause class="${state.clock.paused ? "active" : ""}">${state.clock.paused ? "▶" : "Ⅱ"}</button></div>`;
  const vehicle = state.vehicleUnits.find((item) => item.id === context.selectedVehicleId) ?? state.vehicleUnits[0];
  const model = content.vehicleModels.find((item) => item.id === vehicle.modelId)!;
  const loads = vehicle.assignedOrderIds.map((id) => state.orders.find((order) => order.id === id)!).filter(Boolean);
  const loadWeight = loads.reduce((sum, order) => sum + order.weightKg, 0);
  const loadVolume = loads.reduce((sum, order) => sum + order.volumeLiters, 0);
  const projection = projectLoadedTrip(state, content, vehicle);

  if (view === "map") {
    const nearby = state.orders.filter((order) => order.status === "available" && order.originCityId === vehicle.currentCityId).slice(0, 3);
    const manifest = loads.length ? `<div class="load-manifest">${loads.map((order) => `<span>${cargoName(content, order.cargoId)} ${order.weightKg}kg<button data-unload-order="${order.id}">×</button></span>`).join("")}</div>` : "";
    const projectionCard = projection ? `<div class="profit-preview"><div><span>预计收入</span><b>${money(projection.revenueCents)}</b></div><div><span>道路成本</span><b>−${money(projection.costCents)}</b></div><div><span>预计净利</span><strong>${money(projection.netProfitCents)}</strong></div><em>${projection.stopCityIds.length} 站 · ${(projection.distanceMeters / 1000).toFixed(0)} km · ${Math.round(projection.loadBasisPoints / 100)}% 装载${projection.lateOrderCount ? ` · ${projection.lateOrderCount}单可能迟到` : " · 时效安全"}</em><div class="route-plan">${projection.stopCityIds.map((id, index) => `<span>${index + 1}</span><b>${cityName(content, id)}</b>`).join("")}</div></div>` : "";
    const finalCityId = vehicle.trip?.finalCityId ?? projection?.destinationCityId;
    const returnCount = finalCityId ? state.orders.filter((order) => order.status === "available" && order.originCityId === finalCityId && order.destinationCityId === state.company.headquartersCityId).length : 0;
    const returnHint = finalCityId ? `<div class="return-hint"><div><span class="eyebrow">返程雷达</span><b>${cityName(content, finalCityId)} → ${cityName(content, state.company.headquartersCityId)}</b></div><strong>${returnCount ? `${returnCount} 单可返程` : "暂无直返单"}</strong></div>` : "";
    const vehicleSwitcher = state.vehicleUnits.length > 1 ? `<div class="vehicle-switcher">${state.vehicleUnits.map((unit, index) => `<button data-select-vehicle="${unit.id}" class="${unit.id === vehicle.id ? "active" : ""}">车辆${index + 1}<small>${vehicleStatus(unit)}</small></button>`).join("")}</div>` : "";
    main.innerHTML = `${marketNews(state, content)}${vehicleSwitcher}${mapView(state, content, context.selectedCityId, vehicle)}<section class="dispatch-card"><div class="section-title"><div><span class="eyebrow">当前调度 · ${vehicleCode(vehicle)}</span><h2>${model.name}</h2></div><span class="condition">车况 ${(vehicle.conditionBasisPoints / 100).toFixed(0)}%</span></div><div class="capacity"><div><span>载重</span><b>${loadWeight} / ${model.capacityKg} kg</b><i><em style="width:${loadWeight / model.capacityKg * 100}%"></em></i></div><div><span>容积</span><b>${(loadVolume / 1000).toFixed(1)} / ${(model.capacityLiters / 1000).toFixed(1)} m³</b><i><em style="width:${loadVolume / model.capacityLiters * 100}%"></em></i></div></div>${manifest}${projectionCard}${returnHint}<div class="dispatch-actions">${state.featureFlags.smartDispatch !== false ? `<button id="smart-load" ${vehicle.status === "in_transit" ? "disabled" : ""}>智能拼货</button>` : ""}<button id="start-trip" class="primary-action" ${!loads.length || vehicle.status === "in_transit" ? "disabled" : ""}>${vehicle.status === "in_transit" ? "多站运输进行中" : loads.length ? projection && projection.stopCityIds.length > 1 ? `开始 ${projection.stopCityIds.length} 站配送` : `发车前往${cityName(content, loads[0].destinationCityId)}` : "先装入订单"}</button></div></section><section class="nearby"><div class="section-title"><div><span class="eyebrow">本地货源</span><h2>${cityName(content, vehicle.currentCityId)}可接订单</h2></div><button data-view-jump="market">全部 ${state.orders.filter((order) => order.status === "available").length}</button></div><div class="order-list">${nearby.length ? nearby.map((order) => orderCard(order, state, content, vehicle)).join("") : '<div class="empty">本地暂无货源，可加速等待行情刷新</div>'}</div></section>`;
  } else if (view === "market") {
    const available = state.orders.filter((order) => order.status === "available");
    const filtered = available.filter((order) => context.marketFilter === "local" ? order.originCityId === vehicle.currentCityId : context.marketFilter === "urgent" ? order.deadlineAt - state.clock.now <= 28_800 : true).sort((a, b) => Number(b.originCityId === vehicle.currentCityId) - Number(a.originCityId === vehicle.currentCityId) || b.rewardCents - a.rewardCents);
    main.innerHTML = `${marketNews(state, content)}<section class="page-head"><span class="eyebrow">动态供需 · ${vehicleCode(vehicle)}</span><h1>订单市场</h1><p>当前为 ${model.name} 选货，运价由城市产业、事件、货物类型和时效共同变化。</p></section><div class="filter-row"><button data-market-filter="all" class="${context.marketFilter === "all" ? "active" : ""}">全部 ${available.length}</button><button data-market-filter="local" class="${context.marketFilter === "local" ? "active" : ""}">当前城市 ${available.filter((order) => order.originCityId === vehicle.currentCityId).length}</button><button data-market-filter="urgent" class="${context.marketFilter === "urgent" ? "active" : ""}">高时效</button></div><section class="order-list market-list">${filtered.length ? filtered.map((order) => orderCard(order, state, content, vehicle)).join("") : '<div class="empty">当前筛选下暂无订单</div>'}</section>`;
  } else if (view === "contracts") {
    const atLimit = state.customerContracts.length >= 2;
    main.innerHTML = `<section class="page-head"><span class="eyebrow">稳定货源 · 长期加成</span><h1>大客户合同</h1><p>最多同时经营两份合同。完成匹配线路和货物的市场订单，会自动获得协议运价加成。</p></section><div class="asset-summary"><span>已签合同 <b>${state.customerContracts.length}/2</b></span><span>公司声誉 <b>${Math.round(state.company.reputationBasisPoints / 100)}</b></span></div><section class="contract-list">${content.customerContracts.filter((item) => item.active).map((item) => {
      const signed = state.customerContracts.find((contract) => contract.definitionId === item.id);
      const locked = state.company.reputationBasisPoints < item.requiredReputationBasisPoints;
      const disabled = Boolean(signed) || locked || atLimit || state.company.cashCents < item.signingFeeCents;
      const label = signed ? `已完成 ${signed.completedOrders}/${item.milestoneOrders} 单` : locked ? `声誉 ${Math.round(item.requiredReputationBasisPoints / 100)} 解锁` : atLimit ? "合同席位已满" : state.company.cashCents < item.signingFeeCents ? "签约资金不足" : `支付 ${money(item.signingFeeCents)} 签约`;
      return `<article class="contract-card ${signed ? "signed" : ""}"><div><span>${item.customerName}</span><h2>${item.title}</h2><p>${cityName(content, item.originCityId)} → ${cityName(content, item.destinationCityId)} · ${cargoName(content, item.cargoId)}</p></div><strong>运价 +${Math.round(item.rewardBonusBasisPoints / 100)}%</strong>${signed ? `<div class="contract-progress"><i><em style="width:${Math.min(100, signed.completedOrders / item.milestoneOrders * 100)}%"></em></i><span>累计加成 ${money(signed.earnedBonusCents)}</span></div>` : ""}<button data-sign-contract="${item.id}" ${disabled ? "disabled" : ""}>${label}</button></article>`;
    }).join("")}</section>`;
  } else if (view === "fleet") {
    const cards = state.vehicleUnits.map((unit) => {
      const unitModel = content.vehicleModels.find((item) => item.id === unit.modelId)!;
      const net = unit.lifetimeRevenueCents - unit.lifetimeCostCents;
      const operatingDistance = unit.loadedDistanceMeters + unit.emptyDistanceMeters;
      const emptyRate = operatingDistance ? Math.round(unit.emptyDistanceMeters / operatingDistance * 100) : 0;
      const canSell = state.vehicleUnits.length > 1 && unit.status === "idle" && !unit.assignedOrderIds.length;
      return `<article class="fleet-unit ${unit.id === vehicle.id ? "selected" : ""}"><div class="fleet-unit-head"><div class="vehicle-mini">${icon("truck", "vehicle-icon")}</div><div><span class="status-dot">${vehicleStatus(unit)} · ${vehicleCode(unit)}</span><h2>${unitModel.name}</h2><p>${cityName(content, unit.currentCityId)} · ${unit.acquisitionSource === "used_market" ? "二手购入" : unit.acquisitionSource === "dealer" ? "4S店购入" : "创业车辆"}</p></div></div><div class="vehicle-stats"><div><span>运营里程</span><b>${(operatingDistance / 1000).toFixed(0)} km</b></div><div><span>空驶率</span><b>${emptyRate}%</b></div><div><span>累计净收益</span><b>${money(net)}</b></div><div><span>每公里净利</span><b>${operatingDistance ? money(Math.round(net / (operatingDistance / 1000))) : money(0)}</b></div><div><span>车况</span><b>${(unit.conditionBasisPoints / 100).toFixed(0)}%</b></div><div><span>车辆贷款</span><b>${money(unit.loanBalanceCents)}</b></div></div><div class="fleet-actions"><button data-select-vehicle="${unit.id}">调度此车</button><button data-sell-vehicle="${unit.id}" ${canSell ? "" : "disabled"}>${state.vehicleUnits.length === 1 ? "至少保留一辆" : unit.status !== "idle" || unit.assignedOrderIds.length ? "任务中不可出售" : `出售约 ${money(estimateVehicleResaleCents(unitModel, unit))}`}</button></div></article>`;
    }).join("");
    main.innerHTML = `<section class="page-head"><span class="eyebrow">资产档案 · ${state.vehicleUnits.length}/${state.company.parkingCapacity} 车位</span><h1>我的车队</h1><p>选择任意车辆独立接单、拼货与发车；收入、成本、里程和贷款按车永久记录。</p></section><section class="fleet-list">${cards}</section><div class="asset-shortcuts"><button data-view-jump="dealership">进入 4S 店</button><button data-view-jump="used-vehicles">逛二手车市场</button></div>`;
  } else if (view === "dealership") {
    const parkingFull = state.vehicleUnits.length >= state.company.parkingCapacity;
    const models = content.vehicleModels.filter((item) => item.active && item.dealerAvailable);
    main.innerHTML = `<section class="page-head"><span class="eyebrow">厂家金融 · 新车质保</span><h1>御风 4S 店</h1><p>首付 30%，余款形成车辆贷款并按游戏日偿还。不同车型会解锁更大的货源和冷链订单。</p></section><div class="asset-summary"><span>可用现金 <b>${money(state.company.cashCents)}</b></span><span>停车位 <b>${state.vehicleUnits.length}/${state.company.parkingCapacity}</b></span><span>公司声誉 <b>${Math.round(state.company.reputationBasisPoints / 100)}</b></span></div><section class="dealer-list">${models.map((item) => {
      const down = dealerDownPaymentCents(item);
      const locked = state.company.reputationBasisPoints < item.requiredReputationBasisPoints;
      const disabled = parkingFull || locked || state.company.cashCents < down;
      const reason = parkingFull ? "停车位已满" : locked ? `声誉 ${Math.round(item.requiredReputationBasisPoints / 100)} 解锁` : state.company.cashCents < down ? "首付现金不足" : "支付首付并交车";
      return `<article class="dealer-card"><div class="vehicle-showcase">${icon("truck", "vehicle-icon")}</div><div class="dealer-copy"><span>${item.category} · ${item.capabilities.includes("chilled") ? "常温 / 冷链" : "常温运输"}</span><h2>${item.name}</h2><p>载重 ${item.capacityKg} kg · 容积 ${(item.capacityLiters / 1000).toFixed(1)} m³</p><div><b>全款 ${money(item.purchasePriceCents)}</b><strong>首付 ${money(down)}</strong></div></div><button data-buy-new="${item.id}" ${disabled ? "disabled" : ""}>${reason}</button></article>`;
    }).join("")}</section>`;
  } else if (view === "used-vehicles") {
    const parkingFull = state.vehicleUnits.length >= state.company.parkingCapacity;
    const offers = state.vehicleMarket.usedOffers.filter((offer) => offer.expiresAt > state.clock.now);
    main.innerHTML = `<section class="page-head"><span class="eyebrow">每日刷新 · 全款交易</span><h1>二手车市场</h1><p>价格更低但车况和里程不同；车源会随游戏时间变化，适合低成本扩张。</p></section><div class="asset-summary"><span>可用现金 <b>${money(state.company.cashCents)}</b></span><span>停车位 <b>${state.vehicleUnits.length}/${state.company.parkingCapacity}</b></span></div><section class="dealer-list">${offers.length ? offers.map((offer) => {
      const item = content.vehicleModels.find((candidate) => candidate.id === offer.modelId)!;
      const disabled = parkingFull || state.company.cashCents < offer.priceCents;
      const hours = Math.max(1, Math.ceil((offer.expiresAt - state.clock.now) / 3600));
      return `<article class="dealer-card used-card"><div class="vehicle-showcase">${icon("used", "vehicle-icon")}</div><div class="dealer-copy"><span>车况 ${Math.round(offer.conditionBasisPoints / 100)}% · 剩余 ${hours} 小时</span><h2>${item.name}</h2><p>${(offer.mileageMeters / 1000).toFixed(0)} km · 载重 ${item.capacityKg} kg</p><div><b>${money(offer.priceCents)}</b><strong>省 ${money(Math.max(0, item.purchasePriceCents - offer.priceCents))}</strong></div></div><button data-buy-used="${offer.id}" ${disabled ? "disabled" : ""}>${parkingFull ? "停车位已满" : state.company.cashCents < offer.priceCents ? "现金不足" : "全款购入"}</button></article>`;
    }).join("") : '<div class="empty">今日车源已售罄，加速到下一天会刷新。</div>'}</section>`;
  } else if (view === "company") {
    const profit = state.company.totalRevenueCents - state.company.totalCostCents;
    const onTime = state.company.deliveredOrders ? Math.round(state.company.onTimeOrders / state.company.deliveredOrders * 100) : 100;
    const loadedDistance = state.vehicleUnits.reduce((sum, unit) => sum + unit.loadedDistanceMeters, 0);
    const emptyDistance = state.vehicleUnits.reduce((sum, unit) => sum + unit.emptyDistanceMeters, 0);
    const operatingDistance = loadedDistance + emptyDistance;
    const emptyRate = operatingDistance ? Math.round(emptyDistance / operatingDistance * 100) : 0;
    const expansionCost = parkingExpansionCostCents(state.company.parkingCapacity);
    main.innerHTML = `<section class="page-head"><span class="eyebrow">经营总览</span><h1>${state.company.name}</h1><p>总部：南阳 · 普通道路货运资质</p></section><div class="metric-grid"><article><span>累计营收</span><strong>${money(state.company.totalRevenueCents)}</strong></article><article><span>累计净利</span><strong>${money(profit)}</strong></article><article><span>完成订单</span><strong>${state.company.deliveredOrders}</strong></article><article><span>准时率</span><strong>${onTime}%</strong></article><article><span>运营里程</span><strong>${(operatingDistance / 1000).toFixed(0)} km</strong></article><article><span>车队空驶率</span><strong>${emptyRate}%</strong></article></div><section class="parking-card"><div><span class="eyebrow">基础设施</span><h2>公司停车场</h2><p>已使用 ${state.vehicleUnits.length} / ${state.company.parkingCapacity} 个车位。提前扩建可为后续车队和司机模块留出空间。</p></div><button id="expand-parking" ${state.company.cashCents < expansionCost ? "disabled" : ""}>扩建 1 个车位 · ${money(expansionCost)}</button></section><section class="event-card"><div class="section-title"><h2>经营动态</h2></div>${state.eventLog.length ? state.eventLog.slice(0, 8).map((item) => `<div class="event-row"><i></i><span>${item.message}</span>${item.amountCents ? `<b>${money(item.amountCents)}</b>` : ""}</div>`).join("") : '<div class="empty">完成第一趟运输后，这里将形成公司历史。</div>'}</section><button id="reset-game" class="danger-link">重新开始测试存档</button>`;
  } else {
    const modules = GAME_MODULES.filter((module) => module.group !== "primary");
    main.innerHTML = `<section class="page-head"><span class="eyebrow">长期扩展</span><h1>业务中心</h1><p>模块拥有独立入口、功能开关和资源编号，后续更新不会挤占现有页面。</p></section><div class="module-grid">${modules.map((module) => `<article class="${module.status === "active" ? "available" : ""}" ${module.status === "active" ? `data-view-jump="${module.id}"` : ""}><span class="module-icon">${icon(module.icon)}</span><div><b>${module.label}</b><small>${module.status === "active" ? "点击进入" : "接口已预留"}</small></div><em>${module.status === "active" ? "已开放" : "待开放"}</em></article>`).join("")}</div>`;
  }
};
