#!/usr/bin/env node
/* 构建 Web 发行版：web/ -> dist-web/
 *
 * 做什么：
 *   1. 原样拷贝 web/ 到 dist-web/
 *   2. 给 Service Worker 的 CACHE_NAME 注入构建时间戳（保证发版后旧缓存能被淘汰）
 *   3. 输出体积报告
 *
 * 用法：node scripts/build-web.js [--out dist-web] [--no-sw-stamp]
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);

function arg(name, fallback) {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
}

const outDir = path.resolve(root, arg('--out', 'dist-web'));
const stampSW = !argv.includes('--no-sw-stamp');
const srcDir = path.join(root, 'web');

if (!fs.existsSync(path.join(srcDir, 'index.html'))) {
  console.error('找不到 web/index.html，请在仓库根目录运行。');
  process.exit(1);
}

/* ---------- 拷贝 ---------- */
function copyRecursive(src, dst, stats) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(s, d, stats);
    } else {
      fs.copyFileSync(s, d);
      stats.files += 1;
      stats.bytes += fs.statSync(s).size;
    }
  }
}

const stats = { files: 0, bytes: 0 };
fs.rmSync(outDir, { recursive: true, force: true });
copyRecursive(srcDir, outDir, stats);

/* ---------- Service Worker 版本戳 ---------- */
if (stampSW) {
  const swPath = path.join(outDir, 'sw.js');
  if (fs.existsSync(swPath)) {
    let sw = fs.readFileSync(swPath, 'utf8');
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    sw = sw.replace(/const CACHE_NAME\s*=\s*'[^']*'/, `const CACHE_NAME = 'neon-assault-${stamp}'`);
    fs.writeFileSync(swPath, sw);
    console.log(`Service Worker 缓存版本：neon-assault-${stamp}`);
  }
}

const kb = n => (n / 1024).toFixed(1) + ' KB';
console.log(`Web 构建完成：${outDir}`);
console.log(`  文件数 ${stats.files}，总大小 ${kb(stats.bytes)}`);
