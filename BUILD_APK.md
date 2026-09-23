# 打包 APK 使用说明

这个文件夹已经配置好了云端自动打包 APK。你不需要在电脑上安装 Android Studio。

## 方法：GitHub Actions 自动打包

1. 登录 GitHub。
2. 新建一个仓库，比如 `school-market-ledger`。
3. 把 `school-market-apk-builder` 文件夹里的所有文件上传到仓库。
4. 打开仓库页面的 `Actions`。
5. 选择 `Build Android APK`。
6. 点 `Run workflow`。
7. 等构建完成后，打开构建记录。
8. 在 `Artifacts` 里下载 `school-market-ledger-debug-apk`。
9. 解压后里面就是 `app-debug.apk`，发到安卓手机安装即可。

## 手机安装提示

这是 debug APK，手机可能会提示“未知来源应用”或“此应用未经 Play 保护验证”。这是因为它不是从应用商店安装的测试包。

## 后期优化

后面继续改 `www` 里的 App 文件，再重新运行 GitHub Actions，就能生成新的 APK。

## 正式发布

如果以后要上架应用商店，需要再做 release 签名包，而不是 debug APK。第一版自己安装测试，用 debug APK 就够了。
