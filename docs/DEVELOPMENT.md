# 开发说明

一套 `web/` 代码，五端交付：浏览器 / PWA / 桌面（mac·Win·Linux）/ Android / HarmonyOS。

技术栈：原生 Canvas 2D + WebAudio，零运行时依赖。

游戏说明见 [README.md](../README.md)；打包与发版见 [BUILD.md](BUILD.md)。

---

## 目录结构

```
neonassault/
├── web/                    # ★ 唯一真实来源：纯静态游戏本体
│   ├── index.html          #    游戏入口（含 PWA meta 与 Service Worker 注册）
│   ├── guide.html          #    作战简报 / 游戏说明（不加载游戏脚本）
│   ├── game.js             #    游戏主逻辑
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
