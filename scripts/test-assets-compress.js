#!/usr/bin/env node
/* 贴图清单与磁盘文件一致，且不再引用 png 精灵。 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const web = path.join(__dirname, '../web');
const sprites = fs.readFileSync(path.join(web, 'sprites.js'), 'utf8');
const m = sprites.match(/const MANIFEST = \{([\s\S]*?)\};/);
assert.ok(m, '找不到 SPR MANIFEST');
const files = [...m[1].matchAll(/'([^']+\.webp)'/g)].map(x => x[1]);
assert.ok(files.length >= 18, '清单条目过少: ' + files.length);
assert.ok(!/assets\/[^']+\.png/.test(sprites) && !/'[^']+\.png'/.test(m[1]),
  '精灵清单不应再指向 png');

const missing = files.filter(f => !fs.existsSync(path.join(web, 'assets', f)));
assert.deepStrictEqual(missing, [], '缺文件: ' + missing.join(','));

const leftover = fs.readdirSync(path.join(web, 'assets')).filter(f => f.endsWith('.png'));
assert.deepStrictEqual(leftover, [], 'assets 仍有 png: ' + leftover.join(','));

const icons = fs.readdirSync(path.join(web, 'icons'));
assert.ok(!icons.includes('na-cool-orange-1024.png'), '未使用的橙图应删除');
for (const need of ['na-192.png', 'na-512.png', 'na-maskable-192.png', 'na-maskable-512.png', 'na-cool-1024.png']) {
  assert.ok(icons.includes(need), '缺少图标 ' + need);
}

console.log('test-assets-compress: ok (' + files.length + ' webp)');
