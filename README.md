# 霓虹突袭 · NEON ASSAULT

[![Deploy Web to GitHub Pages](https://github.com/nebulasforce/neonassault/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/nebulasforce/neonassault/actions/workflows/deploy-pages.yml)

俯视角双摇杆竞技场生存射击：在霓虹废墟里清波次、抢补给、打 Boss，直到被打倒。

一套 `web/` 代码，五端交付 —— **浏览器 / PWA / 桌面（mac·Win·Linux）/ Android / HarmonyOS**。

- 在线试玩：<https://nebulasforce.github.io/neonassault/>
- 技术栈：原生 Canvas 2D + WebAudio，零运行时依赖

---

## 目录结构

```
neonassault/
├── web/                    # ★ 唯一真实来源：纯静态游戏本体
│   ├── index.html          #    入口（含 PWA meta 与 Service Worker 注册）
│   ├── game.js             #    游戏主逻辑（约 3700 行）
│   ├── textures.js         #    程序化纹理生成
│   ├── sprites.js          #    外部贴图加载与缓存
│   ├── manifest.json       #    PWA 清单
│   ├── sw.js               #    Service Worker（离线缓存）
│   ├── icons/              #    源图 na-cool-1024.png + 派生 PWA 图标
│   └── assets/             #    精灵与贴图资源
├── electron/               #    桌面端外壳（mac / Win / Linux）
│   ├── main.js             #    主进程：窗口、菜单、单实例锁
│   ├── preload.js          #    最小 IPC 桥（contextIsolation）
│   └── build/              #    icon.icns / icon.ico / icon.png
├── android/                #    Capacitor Android 工程（自动同步）
├── harmonyos/              #    鸿蒙 ArkTS Web 封装壳
│   └── entry/src/main/resources/rawfile/web/   # 由脚本同步生成
├── scripts/                #    构建与同步脚本
├── .github/workflows/      #    GitHub Pages 自动部署
└── package.json            #    脚本入口 + electron-builder 配置
```

**核心约定**：`web/` 是唯一真实来源。Electron 直接加载它，Android 由 `cap sync` 拷进 assets，鸿蒙由 `scripts/build-harmonyos.js` 拷进 rawfile。**改游戏只改 `web/`**。

---

## 快速开始

```bash
# 安装依赖（推荐 pnpm，仓库已带 .npmrc 国内镜像）
pnpm install

# 起本地服务器，浏览器打开 http://localhost:8901
pnpm dev:web
```

本地服务器是必须的：`file://` 协议下 Canvas 会被跨域污染，贴图无法读取。

### 提交与发版

本机没有 JDK / DevEco 时，用 GitHub Actions 打包。`127.0.0.1:7890` 有代理会自动走代理。

```bash
make push MSG="说明"                  # 提交并推送 → GitHub Pages
make release MSG="说明"               # 提交 + 打 tag → APK / Windows / macOS / 鸿蒙 zip
make release VERSION=1.2.2 MSG="说明" # 指定版本号
make tag                              # 只打当前 package.json 版本的 tag
```

打包进度：<https://github.com/nebulasforce/neonassault/actions>  
成品：<https://github.com/nebulasforce/neonassault/releases>

鸿蒙 HAP 仍需本机 DevEco；CI 只提供已同步 `web/` 的工程 zip。

---

## 操控

### 桌面（尽量不碰鼠标）

| 操作 | 按键 |
| --- | --- |
| 移动 | `W` `A` `S` `D` |
| 瞄准 + 开火 | `↑` `↓` `←` `→`（按下即持续开火） |
| 冲刺 | `Shift` / `空格` |
| 切换武器 | `Q` / `E` / 滚轮 |
| 暂停 | `P` / `Esc` |
| 确认（菜单→开局、暂停→继续、阵亡→重开） | `Enter` |
| 强化三选一 | `1` `2` `3`，跳过按 `S` |
| 关卡选择界面直达 | `1` – `8` |
| 查看操作说明 | `Tab` |
| 自动瞄准 / 自动发射 | 右上 `AIM` / `FIRE`，或主菜单、暂停面板开关（写入存档） |

> 方向键**只用于瞄准**（经典双摇杆手感）；瞄准时按 `WASD` 仍可移动，但方向键不会再让你走动。
>
> **辅助开关互相独立**：只开瞄准会对准最近敌人但仍需自己开火；只开发射会朝当前朝向连发；两个都开 = 锁定并持续开火。按住鼠标或触屏右半屏可随时手动接管瞄准。

### 触屏（横屏双摇杆）

请将设备**横置**游玩。竖屏会全屏提示旋转；Android / 鸿蒙 / 已安装的 PWA 会锁定横屏。

- 左半屏：浮动虚拟摇杆移动
- 右半屏：按住拖动瞄准并持续开火
- `AIM`：自动瞄准最近敌人
- `FIRE`：自动发射（空场停火）
- `◀` `▶`：切换武器
- `DASH`：冲刺

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

已做的 Android 适配：`hardwareAccelerated`（Canvas 必需）、`isGame`、`screenOrientation=landscape`、`resizeableActivity=false`。

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

---

## 常见问题

**`require('electron')` 返回路径字符串 / 拿不到 `app`**
宿主环境设置了 `ELECTRON_RUN_AS_NODE=1`，Electron 退化成了纯 Node。用 `pnpm dev:electron`（内部走 `scripts/dev-electron.js`，会剔除该变量）或手动 `env -u ELECTRON_RUN_AS_NODE electron .`。

**Electron 二进制下载超时**
仓库已带 `.npmrc`，把 npm 与 Electron 二进制指向 npmmirror。若仍失败，手动指定镜像：
`ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ pnpm install`

**页面白屏 / 贴图加载不出来**
必须用 HTTP 服务打开（`pnpm dev:web`）。`file://` 下 Canvas 会被污染。

**Android 构建报 "Unable to locate a Java Runtime"**
未安装 JDK 17+。装完后确认 `java -version` 可用。

---

## License

MIT © 2026 Alex Xing / nebulasforce
