#!/usr/bin/env node
/* 空中单位把内墙当掩体：绕行、弹出，不得钻进碰撞盒。巡航导弹仍越墙。 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '../web/game.js'), 'utf8');

const airFn = src.slice(src.indexOf('function updateAir'), src.indexOf('function dropBomb'));
assert.ok(airFn.includes('steerAround'), 'updateAir 应绕掩体飞，不能直线穿墙');
assert.ok(airFn.includes('confineGround'), 'updateAir 移动后应弹出掩体');
assert.ok(!/不受障碍物阻挡/.test(airFn), '空中单位注释不得再写不受障碍阻挡');

const sep = src.slice(src.indexOf('空中与地面单位互不挤压'), src.indexOf('function updateAir'));
assert.ok(!/!e\.boss && !e\.air/.test(sep), '敌机分离后不得再跳过空中单位的 confineGround');
assert.ok(/e\.air/.test(sep) && /confineGround\(e,\s*true\)/.test(sep),
  '空中单位分离后仍要用 loose confine 挡住内墙');

const spawn = src.slice(src.indexOf('function airSpawn'), src.indexOf('function makeAir'));
assert.ok(spawn.includes('inObstacle') && spawn.includes('placeFreeIn'),
  'airSpawn 不得把切入点放进掩体');

/* 仿真：朝北撞墙的攻击机应被弹出，不能停在箱体内 */
const start = src.indexOf('function hitObstacleIn');
const end = src.indexOf('function spawnPos');
assert.ok(start >= 0 && end > start, '找不到碰撞函数块');
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const A = new Function('clamp', src.slice(start, end) +
  '; return { hitObstacleIn, aroundWaypoints, steerAround, resolveObstaclesIn };')(clamp);

const box = { x: 200, y: 200, w: 200, h: 80 };
const obs = [box];
const e = { x: 300, y: 310, r: 23, vx: 0, vy: 0, wallT: 0, steerSide: 0, steerObs: null };
const dt = 1 / 60, sp = 315;
for (let i = 0; i < 180; i++) {
  let mvx = 0, mvy = -1;
  const s = A.steerAround(e, mvx, mvy, 300, 140, dt, obs);
  mvx = s.x; mvy = s.y;
  const ml = Math.hypot(mvx, mvy) || 1;
  e.vx = (mvx / ml) * sp;
  e.vy = (mvy / ml) * sp;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  A.resolveObstaclesIn(e, obs);
  assert.ok(!A.hitObstacleIn(obs, e.x, e.y, e.r * 0.4),
    '第 ' + i + ' 帧仍在墙内 x=' + e.x + ' y=' + e.y);
}

assert.ok(e.y < box.y || Math.abs(e.x - 300) > 40,
  '绕障后应离开墙面正前方，x=' + e.x + ' y=' + e.y);

const cruise = src.slice(src.indexOf('function updateBullets'), src.indexOf('function damageEnemy'));
assert.ok(cruise.includes('!b.explode') && cruise.includes('inObstacle'),
  '普通子弹仍撞墙；巡航导弹不因内墙销毁');

console.log('test-air-walls: ok');
