# 图片与图标资源规范

## 当前阶段

0.2.0 原型不需要正式生成图片。地图、路线、车辆和货物均有矢量占位，功能不会因缺图中断。

## 第一批正式美术资源（进入视觉定稿阶段时再生成）

| 数量 | 类型 | 规格 | 目录 |
| ---: | --- | --- | --- |
| 1 | 游戏标志 | 512×512，透明 PNG | `public/assets/images/brand/` |
| 1 | 华中区域地图底图 | 1600×1200，WebP | `public/assets/images/maps/` |
| 3 | 轻型货车视角图 | 768×384，透明 WebP | `public/assets/images/vehicles/` |
| 6 | 货物图标 | 192×192，透明 WebP | `public/assets/images/cargo/` |
| 2 | 总部与停车场 | 512×512，透明 WebP | `public/assets/images/facilities/` |

合计 13 张。生成前必须再次确认统一画风；文件名使用永久资源编号，不使用提示词或日期命名。

正式资源进入 `public/assets/images/`；生成缓存、缩略图和废稿不得提交到仓库。
