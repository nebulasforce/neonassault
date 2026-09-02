#!/usr/bin/env node
/* 机体绘制：开火/有护盾时都不得再描战机周围的圈。 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '../web/game.js'), 'utf8');
const start = src.indexOf('function drawPlayer()');
const end = src.indexOf('function drawHitFog');
assert.ok(start >= 0 && end > start, '找不到 drawPlayer');
const body = src.slice(start, end);

assert.ok(!body.includes('护盾环'), 'drawPlayer 不应再画护盾环');
assert.ok(!/ctx\.arc\(\s*0,\s*0,\s*p\.r\s*\+\s*9/.test(body),
  'drawPlayer 不应再描机体周围的圈');
assert.ok(!/strokeStyle\s*=\s*'#7df9ff'/.test(body),
  'drawPlayer 不应再描青色护盾描边');

assert.ok(body.includes('p.muzzle > 0'), '开火枪口闪光应保留');
assert.ok(/if\s*\(\s*!usedSprite\s*\)\s*\{[\s\S]*strokeRect/.test(body),
  '程序化炮管矩形只应叠在无贴图回退上');

console.log('test-player-draw: ok');
