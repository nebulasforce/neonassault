#!/usr/bin/env node
/* 机体绘制：浅色护盾泡，有盾才画；碎掉后不画。不是旧青色描边圈。 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '../web/game.js'), 'utf8');
const start = src.indexOf('function drawPlayer()');
const end = src.indexOf('function drawHitFog');
assert.ok(start >= 0 && end > start, '找不到 drawPlayer');
const body = src.slice(start, end);

assert.ok(body.includes('function drawShieldBubble'), '应有浅色护盾泡');
assert.ok(body.includes('p.sh <= 0.5'), '护盾碎掉后不再画泡');
assert.ok(!body.includes('护盾环'), '不应再画旧护盾环');
assert.ok(!/strokeStyle\s*=\s*'#7df9ff'/.test(body), '不应再描青色护盾描边');
assert.ok(body.includes('drawShieldBubble()'), 'drawPlayer 应调用护盾泡');
assert.ok(body.includes('p.muzzle > 0'), '开火枪口闪光应保留');
assert.ok(/if\s*\(\s*!usedSprite\s*\)\s*\{[\s\S]*strokeRect/.test(body),
  '程序化炮管矩形只应叠在无贴图回退上');

console.log('test-player-draw: ok');
