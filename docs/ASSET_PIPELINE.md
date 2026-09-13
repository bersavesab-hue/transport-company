# 图片与图标资源规范

## 当前阶段

0.6.3 多级地图底座不把路网和地名烙在背景图片中。全域坐标、四级缩放、节点聚合、道路折线和视野筛选均由数据与矢量界面驱动；正式地图图片只提供虚构地貌纹理，所有道路、标签、车辆和交互节点继续由程序绘制，换图不需要改业务代码或存档。

## 第一批正式美术资源（进入视觉定稿阶段时再生成）

| 数量 | 类型 | 规格 | 目录 |
| ---: | --- | --- | --- |
| 1 | 游戏标志 | 512×512，透明 PNG | `public/assets/images/brand/` |
| 1 | 全域物流地貌纹理（不绘制边界） | 1536×1024，PNG（当前定稿） | `assets/generated/` |
| 1 | 区域地貌纹理 | 1600×1200，WebP | `public/assets/images/maps/` |
| 5 | 五种车型侧前方视角图 | 768×384，透明 WebP | `public/assets/images/vehicles/` |
| 6 | 货物图标 | 192×192，透明 WebP | `public/assets/images/cargo/` |
| 2 | 总部与停车场 | 512×512，透明 WebP | `public/assets/images/facilities/` |

全域底图资源编号固定为 `map_world_terrain_001`；不得加入现实国家轮廓、海岸线、行政边界或真实地名。车辆文件名固定为 `vehicle_light_truck_001.webp`、`vehicle_micro_van_001.webp`、`vehicle_medium_truck_001.webp`、`vehicle_heavy_truck_001.webp`、`vehicle_refrigerated_001.webp`。

正式资源进入 `public/assets/images/`；生成缓存、缩略图和废稿不得提交到仓库。
