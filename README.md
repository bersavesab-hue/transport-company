# 运输纪元 · Transport Company

当前版本：`prototype-0.5.1`

这是运输公司长期模拟经营项目。0.5.1 在路线经营循环之上加入全国统一地图坐标、区域分层视图与移动端缩放拖动底座。

## 本地运行

```bash
npm install
npm run dev
```

## 完整检查

```bash
npm run check
```

当前可玩：全国/区域地图切换和拖动缩放、六城市动态市场、多目的地智能与手动拼货、无直达道路自动寻路、多站连续配送、逐站结算、终点返程雷达、空车跨城调度、空驶率与每公里利润、大客户合同、多车辆独立运输、4S 店和二手车扩张。

长期模块与图片资源均使用登记表和功能开关接入，详见 `docs/MODULE_SLOTS.md` 与 `docs/ASSET_PIPELINE.md`。

手机实机测试使用 GitHub Pages，不需要安装开发环境，详见 `docs/MOBILE_TESTING.md`。

一键工具安装后，后续更新只需向仓库根目录上传固定名称 `update.zip`；GitHub Actions 会自动检查、覆盖并提交。详见 `docs/ONE_CLICK_UPDATES.md`。

正式开发必须遵守根目录 `AGENTS.md` 与 `docs/` 中的架构约束。
