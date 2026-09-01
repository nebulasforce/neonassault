#!/usr/bin/env node
/* Electron 开发启动器
 *
 * 为什么需要它：某些宿主环境（IDE / 终端复用工具）会全局设置
 * ELECTRON_RUN_AS_NODE=1，这会让 Electron 退化成纯 Node 运行，
 * 表现为 require('electron') 拿不到 app/BrowserWindow。
 * 这里在 spawn 前主动剔除该变量，保证主进程拿到完整的 Electron API。
 *
 * 用法：node scripts/dev-electron.js
 */
const { spawn } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');

// 用 electron 包自身解析出的可执行文件路径
const electronPath = require(path.join(root, 'node_modules', 'electron'));

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

// 允许外部覆盖开发服务器地址：NA_DEV_URL=http://localhost:3000
if (!env.NA_DEV_URL) env.NA_DEV_URL = 'http://localhost:8901/index.html';

console.log('启动 Electron（开发模式）…');
console.log('  可执行：' + electronPath);
console.log('  入口页：' + env.NA_DEV_URL);
console.log('  提示：请先运行 pnpm dev:web 起本地服务器');

const child = spawn(electronPath, [root], { stdio: 'inherit', env });
child.on('exit', code => process.exit(code === null ? 1 : code));
