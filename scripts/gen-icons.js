#!/usr/bin/env node
/* 图标生成入口：找到带 Pillow 的 Python，然后跑 scripts/gen-icons.py
 *
 * 用法：
 *   node scripts/gen-icons.js
 *   node scripts/gen-icons.js --force    # 强制重生成
 *   node scripts/gen-icons.js --redraw   # 连源图一起重绘
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const script = path.join(__dirname, 'gen-icons.py');
const args = process.argv.slice(2);

const candidates = [
  process.env.NA_PYTHON,
  '/Users/xingshanghe/.workbuddy/binaries/python/envs/default/bin/python',
  'python3',
  'python',
].filter(Boolean);

let chosen = null;
for (const bin of candidates) {
  const probe = spawnSync(bin, ['-c', 'import PIL; import sys; sys.exit(0)'], { stdio: 'ignore' });
  if (probe.status === 0) { chosen = bin; break; }
}

if (!chosen) {
  console.error('未找到带 Pillow 的 Python 解释器。');
  console.error('请先安装：pip install pillow');
  console.error('或设置环境变量 NA_PYTHON 指向可用的解释器。');
  process.exit(1);
}

console.log('使用解释器：' + chosen);
const r = spawnSync(chosen, [script, ...args], { stdio: 'inherit', cwd: root });
process.exit(r.status === null ? 1 : r.status);
