# 运输纪元 · Transport Company

当前版本：`prototype-0.3.0`

这是运输公司长期模拟经营项目。0.3.0 已具备可运行的移动端动态经营原型。

## 本地运行

```bash
npm install
npm run dev
```

## 完整检查

```bash
npm run check
```

当前可玩：六城市地图、六小时市场周期、产业事件联动运价、智能拼货、手动拼货、利润预估、车辆运输、实时进度、逾期折价、返程货源、城市行情、车况与公司经营数据。

长期模块与图片资源均使用登记表和功能开关接入，详见 `docs/MODULE_SLOTS.md` 与 `docs/ASSET_PIPELINE.md`。

一键工具安装后，后续更新只需向仓库根目录上传固定名称 `update.zip`；GitHub Actions 会自动检查、覆盖并提交。详见 `docs/ONE_CLICK_UPDATES.md`。

正式开发必须遵守根目录 `AGENTS.md` 与 `docs/` 中的架构约束。
