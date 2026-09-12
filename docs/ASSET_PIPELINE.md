# 图片与图标资源规范

## 当前阶段

0.5.1 全国地图底座不需要补充正式图片。全国坐标、区域分层、城市、路线、缩放和拖动均由数据与矢量界面驱动；所有车型和地图已经登记永久资源编号，换图不需要改业务代码或存档。

## 第一批正式美术资源（进入视觉定稿阶段时再生成）

| 数量 | 类型 | 规格 | 目录 |
| ---: | --- | --- | --- |
| 1 | 游戏标志 | 512×512，透明 PNG | `public/assets/images/brand/` |
| 1 | 全国物流地貌纹理（不绘制边界） | 4096×2304，WebP | `public/assets/images/maps/` |
| 1 | 华中区域地貌纹理 | 1600×1200，WebP | `public/assets/images/maps/` |
| 5 | 五种车型侧前方视角图 | 768×384，透明 WebP | `public/assets/images/vehicles/` |
| 6 | 货物图标 | 192×192，透明 WebP | `public/assets/images/cargo/` |
| 2 | 总部与停车场 | 512×512，透明 WebP | `public/assets/images/facilities/` |

合计 16 张。全国纹理固定为 `map_china_national_001.webp`，华中纹理保留 `map_region_central_china_001.webp`；行政与国界不由AI图片生成，正式发布时另行接入经过核验的标准矢量地图。车辆文件名固定为 `vehicle_light_truck_001.webp`、`vehicle_micro_van_001.webp`、`vehicle_medium_truck_001.webp`、`vehicle_heavy_truck_001.webp`、`vehicle_refrigerated_001.webp`。

正式资源进入 `public/assets/images/`；生成缓存、缩略图和废稿不得提交到仓库。
