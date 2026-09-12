# 运输纪元 · Transport Company

当前版本：`prototype-0.2.0`

这是运输公司长期模拟经营项目。0.2.0 已具备可运行的移动端网页原型。

## 本地运行

```bash
npm install
npm run dev
```

## 完整检查

```bash
npm run check
```

当前可玩：六城市地图、动态订单市场、同目的地拼货、车辆运输、实时进度、成本结算、返程货源、车况与公司经营数据。

长期模块与图片资源均使用登记表和功能开关接入，详见 `docs/MODULE_SLOTS.md` 与 `docs/ASSET_PIPELINE.md`。

首次安装 0.2.0 后，后续更新只需向仓库根目录上传固定名称 `update.zip`；GitHub Actions 会自动检查、覆盖并提交。详见 `docs/ONE_CLICK_UPDATES.md`。

正式开发必须遵守根目录 `AGENTS.md` 与 `docs/` 中的架构约束。
