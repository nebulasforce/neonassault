/* 霓虹突袭 · NEON ASSAULT — Electron 主进程
 *
 * 说明：本项目把 web/ 目录作为唯一真实来源，Electron 只做一层壳。
 * 生产环境加载 app.asar 内的 web/index.html；同时 web/ 也会作为
 * extraResources 拷贝到 resources/web，两者取先存在者。
 */
const { app, BrowserWindow, shell, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !app.isPackaged;
const DEV_URL = process.env.NA_DEV_URL || 'http://localhost:8901/index.html';
let mainWindow = null;

/* ------------------------------------------------------------------ *
 * 定位 web 目录：依次尝试 extraResources / asar 内 / 开发态
 * ------------------------------------------------------------------ */
function resolveWebDir() {
  const candidates = [
    // 打包后：extraResources -> resources/web
    path.join(process.resourcesPath || '', 'web'),
    // 打包后：asar 内
    path.join(__dirname, '..', 'web'),
    // 开发态：仓库根
    path.join(__dirname, '..', 'web'),
  ];
  for (const dir of candidates) {
    if (dir && fs.existsSync(path.join(dir, 'index.html'))) return dir;
  }
  // 兜底：仍返回 asar 内路径，让 loadURL 失败时能看到明确报错
  return path.join(__dirname, '..', 'web');
}

function resolveIcon() {
  const candidates = [
    path.join(process.resourcesPath || '', 'web', 'icons', 'na-512.png'),
    path.join(__dirname, '..', 'web', 'icons', 'na-512.png'),
    path.join(__dirname, '..', 'build', 'icon.png'),
  ];
  for (const file of candidates) {
    if (file && fs.existsSync(file)) return file;
  }
  return undefined;
}

/* ------------------------------------------------------------------ *
 * 窗口
 * ------------------------------------------------------------------ */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: '霓虹突袭 · NEON ASSAULT',
    icon: resolveIcon(),
    backgroundColor: '#05070f',
    // 隐藏原生标题栏（mac 保留红绿灯），贴合赛博霓虹风格
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false, // 切到后台也保持帧率稳定
    },
    show: false,
  });

  const url = isDev
    ? DEV_URL
    : `file://${path.join(resolveWebDir(), 'index.html')}`;

  mainWindow.loadURL(url).catch(err => {
    console.error('loadURL failed:', url, err);
    dialog.showErrorBox(
      '资源加载失败',
      `无法加载 ${url}\n\n${err && err.message ? err.message : err}`
    );
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (!isDev) mainWindow.setFullScreen(false);
  });

  /* 外链统一交给系统浏览器 */
  mainWindow.webContents.setWindowOpenHandler(({ url: u }) => {
    shell.openExternal(u);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e, u) => {
    if (isDev && u.startsWith(DEV_URL.replace('/index.html', ''))) return;
    if (u.startsWith('file://')) return;
    e.preventDefault();
    shell.openExternal(u);
  });

  /* 快捷键：F11 全屏、F12/Ctrl+Shift+I 开发者工具 */
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    } else if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
  buildMenu();
}

/* ------------------------------------------------------------------ *
 * 菜单（保留 mac 的最小可用菜单，其余平台隐藏）
 * ------------------------------------------------------------------ */
function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: '游戏',
      submenu: [
        {
          label: '重新开始',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow && mainWindow.webContents.reload(),
        },
        {
          label: '全屏切换',
          accelerator: 'F11',
          click: () => mainWindow && mainWindow.setFullScreen(!mainWindow.isFullScreen()),
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: isMac ? 'Cmd+Q' : 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '开发者工具',
          accelerator: isMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: () => mainWindow && mainWindow.webContents.toggleDevTools(),
        },
        {
          label: '关于霓虹突袭',
          click: () => dialog.showMessageBox({
            type: 'info',
            title: '霓虹突袭 · NEON ASSAULT',
            message: '霓虹突袭 · NEON ASSAULT',
            detail: `版本 ${app.getVersion()}\nElectron ${process.versions.electron} / Node ${process.versions.node}`,
          }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ------------------------------------------------------------------ *
 * 生命周期
 * ------------------------------------------------------------------ */
// 单实例锁：重复启动直接聚焦已有窗口
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(createWindow);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

/* 渲染进程可用的最小 IPC */
ipcMain.handle('platform', () => process.platform);
ipcMain.handle('version', () => ({
  app: app.getVersion(),
  electron: process.versions.electron,
  node: process.versions.node,
  chrome: process.versions.chrome,
}));
ipcMain.handle('toggle-fullscreen', () => {
  if (!mainWindow) return false;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
  return mainWindow.isFullScreen();
});
