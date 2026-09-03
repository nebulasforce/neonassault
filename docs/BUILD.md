# 构建与发版

本地开发见 [DEVELOPMENT.md](DEVELOPMENT.md)。

[![Deploy Web to GitHub Pages](https://github.com/nebulasforce/neonassault/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/nebulasforce/neonassault/actions/workflows/deploy-pages.yml)

---

## 提交与发版

本机没有 JDK / DevEco 时，用 GitHub Actions 打包。`127.0.0.1:7890` 有代理会自动走代理。

```bash
make push MSG="说明"                  # 提交并推送 → GitHub Pages
make release MSG="说明"               # 提交 + 打 tag，并等到 APK / Windows / macOS / 鸿蒙 zip 挂上
make release VERSION=1.2.2 MSG="说明" # 指定版本号
make release WAIT=0 MSG="说明"        # 推完即返回，自己去 Actions 看
make wait                             # 只等待当前版本打包结束
make tag                              # 只打当前 package.json 版本的 tag
```

打包进度：<https://github.com/nebulasforce/neonassault/actions>  
成品：<https://github.com/nebulasforce/neonassault/releases>

鸿蒙 HAP 仍需本机 DevEco；CI 只提供已同步 `web/` 的工程 zip。

---

## 五端构建

### 1. Web / PWA

```bash
pnpm build:web          # 产出 dist-web/，并给 sw.js 注入缓存版本戳
```

把 `dist-web/`（或直接 `web/`）丢到任意静态托管即可。
PWA 已具备：`manifest.json` + Service Worker + 192/512 图标（含 maskable），支持「添加到主屏幕」与离线运行。

> 更新游戏后务必跑一次 `pnpm build:web`，它会刷新缓存版本号，避免用户卡在旧缓存。

### 2. 桌面端（Electron）

```bash
pnpm install
pnpm dev:web            # 另开一个终端保持运行
pnpm dev:electron       # 开发模式启动桌面窗口

pnpm build:electron:mac     # → dist-electron/（dmg + zip，x64/arm64）
pnpm build:electron:win     # → nsis 安装包 + portable exe
pnpm build:electron:linux   # → AppImage
```

已配置：单实例锁、F11 全屏、F12 开发者工具、`resources/web` 兜底路径、外链走系统浏览器。

**交叉编译说明**：mac 上打 Windows 包需要 `brew install wine-stable`；打 Linux 包需要本机 `dpkg`/`fpm`。同平台打包无需额外依赖。

### 3. Android（Capacitor）

前置：**JDK 17+**、**Android Studio + SDK 34+**（`android/local.properties` 里的 `sdk.dir` 已指向本机 SDK）。

```bash
pnpm install
pnpm cap:add            # 首次：生成 android/ 平台（已生成，可跳过）
pnpm build:android      # 同步 web/ 并打 Debug APK
pnpm build:android:release   # Release APK
pnpm cap:open           # 用 Android Studio 打开工程
```

产物在 `android/app/build/outputs/apk/{debug,release}/`，已按 ABI 分包（`arm64-v8a` / `armeabi-v7a` / `x86_64` + universal）。

**Release 签名**：准备 keystore 后设置环境变量即可，未配置时会回落到 debug 签名以便先跑通构建。

```bash
export NA_KEYSTORE_FILE=/path/to/neonassault.keystore
export NA_KEYSTORE_PASSWORD=xxx
export NA_KEY_ALIAS=neonassault
export NA_KEY_PASSWORD=xxx
pnpm build:android:release
```

已做的 Android 适配：Activity 硬件加速开、WebView **不要**整页 `LAYER_TYPE_HARDWARE`（否则全屏 Canvas 会黑）、`isGame`、`sensorLandscape`、`resizeableActivity=false`。打包装前必须 `npx cap sync android`，`assets/public` 不进 git。

### 4. HarmonyOS（鸿蒙）

前置：**DevEco Studio** + HarmonyOS SDK（API 12+）。

```bash
pnpm sync:harmonyos     # 把 web/ 同步到 rawfile/web/
```

然后用 DevEco Studio 打开 `harmonyos/` → *File > Sync and Refresh Project* → *Build > Build Hap(s)*。

已做的适配：`fileAccess`/`javaScriptAccess`/`domStorageAccess` 全开（rawfile 子资源必需）、`setAudioMuted(false)`（WebAudio 需要）、横屏锁定、返回键二次确认退出、首帧加载进度条、`setWindowKeepScreenOn(true)`。

### 5. Chrome 应用 / 扩展

Chrome 已不再接受新的托管应用，PWA 是官方替代方案：直接用浏览器打开 Pages 站点，地址栏点「安装」即可获得独立窗口、离线可用的桌面体验，等价于此前的 Chrome App。

---

## 图标

源图：`web/icons/na-cool-1024.png`（脚本不会覆盖它）。

```bash
pnpm icons:electron -- --force     # 需要 Pillow：pip install pillow
```

会从源图派生 PWA（192 / 512 / maskable）、Electron（icns·ico·png）、Android mipmap、鸿蒙 media。加 `--redraw` 会忽略源图、改用几何 NA 占位。

---

## 自动部署（GitHub Pages）

`.github/workflows/deploy-pages.yml` 在每次 push 到 `main` 时，把 `web/` 部署到 GitHub Pages。

首次启用：仓库 **Settings → Pages → Source** 选 **GitHub Actions**，然后 push 一次即可。
站点地址：`https://<owner>.github.io/neonassault/`
