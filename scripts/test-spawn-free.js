#!/usr/bin/env node
/* 刷怪 / 福利包不得落在掩体碰撞盒内；失败回退也必须是空地。 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '../web/game.js'), 'utf8');
const start = src.indexOf('function hitObstacleIn');
const end = src.indexOf('function aroundWaypoints');
assert.ok(start >= 0 && end > start, '找不到 hitObstacleIn…aroundWaypoints');
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const TAU = Math.PI * 2;
const A = new Function('clamp', 'TAU', src.slice(start, end) +
  '; return { hitObstacleIn, placeFreeIn };')(clamp, TAU);

const box = { x: 200, y: 200, w: 200, h: 80 };
const list = [box];
const arena = { w: 800, h: 600 };

const inside = A.placeFreeIn(list, arena, 300, 240, 20);
assert.ok(inside, '墙内点应被推到空地');
assert.ok(!A.hitObstacleIn(list, inside.x, inside.y, 20),
  '推开后仍在墙内 ' + JSON.stringify(inside));

const open = A.placeFreeIn(list, arena, 80, 80, 20);
assert.strictEqual(open.x, 80);
assert.strictEqual(open.y, 80);

const spawnSrc = src.slice(src.indexOf('function spawnPos'), src.indexOf('/* ═══ 6. 实体'));
assert.ok(spawnSrc.includes('placeFreeIn') || spawnSrc.includes('ring') || spawnSrc.includes('中心'),
  'spawnPos 失败回退不能再随机落到墙里');
assert.ok(!/return \{ x: rand\(90, ARENA\.w - 90\), y: rand\(90, ARENA\.h - 90\) \};/.test(spawnSrc),
  'spawnPos 不得无检查随机回退');

console.log('test-spawn-free: ok');
