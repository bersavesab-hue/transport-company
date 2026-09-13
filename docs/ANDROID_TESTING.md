# 安卓安装包测试

## 自动生成

上传 `update.zip` 并等待 `Apply Update ZIP` 绿色对勾后，`Build Android APK` 会自动检查项目、构建手机资源并生成安卓测试包。

## 手机下载

1. 打开仓库 `Actions`。
2. 打开最新的 `Build Android APK` 绿色任务。
3. 在任务底部下载 `transport-epoch-v0.6.0-debug-apk`。
4. 解压下载文件，安装其中的 `app-debug.apk`。

测试包应用名称固定为“运输纪元”，应用包名固定为 `com.transportepoch.game`。测试签名由 Actions 缓存，正常情况下后续测试包可直接覆盖安装并保留存档。若测试签名缓存被 GitHub 清除，安卓会拒绝覆盖安装，此时需要卸载旧测试包后再安装；正式发布版将使用独立且永久保存的正式签名。

APK 内置 `docs/play` 离线资源，不依赖 GitHub Pages。网页版本与 APK 使用不同存储空间，二者存档不互通。
