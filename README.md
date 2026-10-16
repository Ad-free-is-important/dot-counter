# 点点计数 1.0.0

一个完全离线的 Android 计数工具，支持 Android 8.0 及以上。安装文件为 [`DotCounter-v1.0.0.apk`](https://github.com/Ad-free-is-important/dot-counter/releases/download/v1.0.0/DotCounter-v1.0.0.apk)，包名 `com.adfree.counter`。

## 安装

1. 在手机上下载并打开 APK。
2. 如系统提示，请为打开安装包的应用开启“允许安装未知应用”，然后继续安装。
3. 安装完成后打开“点点计数”。不需要登录或联网。

## 使用

- 默认按钮每次加 1 或减 1；点数字可直接修改，支持正数、零、负数。
- 长按按钮连续加减；一整段长按可一次撤销。
- 步长可选 1、5、10，也可自定义为 1–1,000,000。
- 点计数器名称切换或新建；“全部”页面可管理、复制、删除计数器，最多 100 个。
- 每个计数器独立保存数值、步长、标记颜色、可选目标和操作记录。
- 支持撤销、重做、归零。保留最近 50 步撤销和 80 条操作记录，重启后仍保留。
- 右上角进入专注模式，放大计数区域；再次点击或按 Android 返回键退出。
- 设置支持浅色、深色、跟随系统、触感反馈、保持屏幕常亮。
- 设置中的“导出备份”保存全部数据为 JSON；“导入备份”在确认后替换本机数据。
- 数值范围为 -999,999,999 到 999,999,999，仅支持整数。

数据自动保存在本机应用私有空间。卸载或清除应用数据会清空计数，请先导出备份。应用没有广告、登录、统计 SDK 或网络权限。文件导入导出使用 Android 系统文件选择器，不需要广泛存储权限。

## 源码

- `assets/index.html`、`style.css`：中文界面与响应式主题。
- `assets/model.js`：独立的计数、撤销、历史和备份校验逻辑。
- `assets/app.js`：交互、长按、弹窗和 Android 桥接。
- `src/com/adfree/counter/MainActivity.java`：Android 外壳、私有数据保存、系统文件导入导出、主题、触感和屏幕常亮。
- `AndroidManifest.xml`、`res/`：Android 配置及图标。
- `build.sh`：不依赖 Gradle 或外部 UI 库的构建脚本。
- `signing/`：仅供本地保存签名材料，不包含在此仓库中。

界面资源随安装包打包，通过受限的本地 HTTPS 来源交给系统 Android WebView 渲染。应用不访问互联网，不加载远程网页。

## 重新构建

需要 Java 17、Python 3、Android SDK Platform 35、Build Tools 35.0.0 以及 Eclipse ECJ 3.38.0。

```bash
export ANDROID_SDK_ROOT=/path/to/android-sdk
export ECJ_JAR=/path/to/ecj-3.38.0.jar
bash build.sh
```

如果使用独立的 R8/D8 JAR，可额外指定 `D8_JAR=/path/to/r8.jar`。产物位于 `dist/DotCounter-v1.0.0.apk`。

此仓库不包含 `signing/release.p12` 和 `signing/password.txt`；正式更新时需从私有备份恢复原签名。后续覆盖更新应继续使用相同包名和签名，并增加 manifest 的 `versionCode`。删除签名文件后脚本会生成新的签名，此时无法覆盖旧签名的安装。

## 仓库中的签名材料

本仓库排除了原始签名私钥及密码。直接运行构建脚本会在本机生成新签名，生成的 APK 无法覆盖当前已发布签名的安装。要保留覆盖升级能力，请在本地恢复原有 `signing/`，不要提交它。原有 APK 保持原始签名。

## 下载与校验

- [下载 点点计数 1.0.0 APK](https://github.com/Ad-free-is-important/dot-counter/releases/download/v1.0.0/DotCounter-v1.0.0.apk)
- [SHA-256 校验值](https://github.com/Ad-free-is-important/dot-counter/releases/download/v1.0.0/SHA256SUMS)

## 授权

此仓库未附加新的开源许可证，授权方式由项目所有者另行决定。
