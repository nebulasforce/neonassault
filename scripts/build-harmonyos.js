#!/usr/bin/env node
/* 鸿蒙 ArkTS 封装入口脚本
 *
 * 前置要求：本机已安装 DevEco Studio 与 HarmonyOS SDK（API 12+）
 *
 * 做什么：
 *   1. 清空并重新同步 web/ -> harmonyos/entry/src/main/resources/rawfile/web/
 *   2. 输出体积报告与后续操作提示
 *
 * 用法：node scripts/build-harmonyos.js
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const webDir = path.join(root, 'web');
const rawDir = path.join(root, 'harmonyos', 'entry', 'src', 'main', 'resources', 'rawfile', 'web');

if (!fs.existsSync(path.join(webDir, 'index.html'))) {
  console.error('找不到 web/index.html，请在仓库根目录运行。');
  process.exit(1);
}

const stats = { files: 0, bytes: 0 };

function copyRecursive(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
      stats.files += 1;
      stats.bytes += fs.statSync(s).size;
    }
  }
}

console.log('同步 web/ -> harmonyos/.../rawfile/web ...');
fs.rmSync(rawDir, { recursive: true, force: true });
copyRecursive(webDir, rawDir);

if (!fs.existsSync(path.join(rawDir, 'assets', 'player.webp'))) {
  console.error('鸿蒙 rawfile 缺少 assets/player.webp');
  process.exit(1);
}

const kb = n => (n / 1024).toFixed(1) + ' KB';
console.log(`同步完成：${stats.files} 个文件，${kb(stats.bytes)}`);
console.log('');
console.log('下一步：');
console.log('  1. 用 DevEco Studio 打开 harmonyos/ 目录');
console.log('  2. File > Sync and Refresh Project');
console.log('  3. Build > Build Hap(s)/APP(s) > Build Hap(s)');
console.log('     （或用命令行：hvigorw assembleHap --mode module -p product=default）');
