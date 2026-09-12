# 图片与图标资源规范

## 当前阶段

0.5.0 路线经营与手机实机测试不需要补充正式图片。地图、路线、五种车辆、市场快讯和货物均使用代码原生图标或矢量占位，功能不会因缺图中断；所有车型已经登记永久资源编号，换图不需要改业务代码或存档。

## 第一批正式美术资源（进入视觉定稿阶段时再生成）

| 数量 | 类型 | 规格 | 目录 |
| ---: | --- | --- | --- |
| 1 | 游戏标志 | 512×512，透明 PNG | `public/assets/images/brand/` |
| 1 | 华中区域地图底图 | 1600×1200，WebP | `public/assets/images/maps/` |
| 5 | 五种车型侧前方视角图 | 768×384，透明 WebP | `public/assets/images/vehicles/` |
| 6 | 货物图标 | 192×192，透明 WebP | `public/assets/images/cargo/` |
| 2 | 总部与停车场 | 512×512，透明 WebP | `public/assets/images/facilities/` |

合计 15 张。车辆文件名固定为 `vehicle_light_truck_001.webp`、`vehicle_micro_van_001.webp`、`vehicle_medium_truck_001.webp`、`vehicle_heavy_truck_001.webp`、`vehicle_refrigerated_001.webp`。生成前必须再次确认统一画风；文件名使用永久资源编号，不使用提示词或日期命名。

正式资源进入 `public/assets/images/`；生成缓存、缩略图和废稿不得提交到仓库。
