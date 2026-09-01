/* 预加载脚本：以最小 API 面向渲染进程暴露宿主能力（contextIsolation = true） */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__ELECTRON', {
  /** 'darwin' | 'win32' | 'linux' */
  platform: () => ipcRenderer.invoke('platform'),
  /** { app, electron, node, chrome } */
  version: () => ipcRenderer.invoke('version'),
  /** 切换全屏，返回切换后的全屏状态 */
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
});
