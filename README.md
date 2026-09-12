# 运输纪元 · Transport Company

当前版本：`prototype-0.4.0`

这是运输公司长期模拟经营项目。0.4.0 已形成“接单经营—积累现金—扩建车位—购买车辆—多车调度”的首个扩张循环。

## 本地运行

```bash
npm install
npm run dev
```

## 完整检查

```bash
npm run check
```

当前可玩：六城市动态市场、智能与手动拼货、利润预估、多车辆独立运输、4S 店分期购车、每日二手车市场、卖车结清贷款、停车场扩建、车型货物能力限制和永久车辆经营档案。

长期模块与图片资源均使用登记表和功能开关接入，详见 `docs/MODULE_SLOTS.md` 与 `docs/ASSET_PIPELINE.md`。

一键工具安装后，后续更新只需向仓库根目录上传固定名称 `update.zip`；GitHub Actions 会自动检查、覆盖并提交。详见 `docs/ONE_CLICK_UPDATES.md`。

正式开发必须遵守根目录 `AGENTS.md` 与 `docs/` 中的架构约束。
