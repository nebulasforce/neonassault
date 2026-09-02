#!/usr/bin/env node
/* 地面单位绕障：可贴墙，但不能朝障碍物内部一直顶着滑行。 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '../web/game.js'), 'utf8');
const start = src.indexOf('function hitObstacleIn');
const end = src.indexOf('function spawnPos');
assert.ok(start >= 0 && end > start, '找不到绕障函数块 hitObstacleIn…spawnPos');
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const A = new Function('clamp', src.slice(start, end) +
  '; return { hitObstacleIn, aroundWaypoints, steerAround, resolveObstaclesIn };')(clamp);

const box = { x: 200, y: 200, w: 200, h: 80 };
const list = [box];

/* 南侧正对：绕行点应是底边两角，而不是穿箱体的北角 */
const south = A.aroundWaypoints(box, 300, 300, 16);
assert.strictEqual(south.length, 2);
assert.ok(south.every(p => p.y > box.y + box.h), '南侧绕点应在箱子下方外侧');
assert.ok(south.some(p => p.x < box.x) && south.some(p => p.x > box.x + box.w));

/* 朝北撞墙：转向必须带明显横向分量，不能继续往箱子里走 */
const e0 = { x: 300, y: 310, r: 16, wallT: 0, steerSide: 0, steerObs: null };
const s0 = A.steerAround(e0, 0, -1, 300, 140, 1 / 60, list);
const into = s0.x * 0 + s0.y * -1;
assert.ok(Math.abs(s0.x) > 0.45, '应沿墙走向一侧，x 分量不足: ' + s0.x);
assert.ok(into < 0.85, '不应继续全力朝箱子内部走: ' + into);

/* 侧向一旦选定，下一帧不能来回翻面 */
const e1 = { x: 300, y: 310, r: 16, wallT: 0, steerSide: 0, steerObs: null };
const a = A.steerAround(e1, 0, -1, 300, 140, 1 / 60, list);
const b = A.steerAround(e1, 0, -1, 300, 140, 1 / 60, list);
assert.ok(a.x * b.x > 0, '绕障侧向应粘滞，不能每帧左右翻转');

function simulate(useSteer, frames) {
  const obs = [{ x: 200, y: 200, w: 200, h: 80 }];
  const e = { x: 300, y: 312, r: 16, vx: 0, vy: 0, wallT: 0, steerSide: 0, steerObs: null };
  const dt = 1 / 60;
  const sp = 140;
  for (let i = 0; i < frames; i++) {
    let mvx = 0, mvy = -1;
    if (useSteer) {
      const s = A.steerAround(e, mvx, mvy, 300, 140, dt, obs);
      mvx = s.x; mvy = s.y;
    }
    const ml = Math.hypot(mvx, mvy) || 1;
    e.vx = (mvx / ml) * sp;
    e.vy = (mvy / ml) * sp;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    A.resolveObstaclesIn(e, obs);
  }
  return e;
}

const stuck = simulate(false, 180);
assert.ok(stuck.y > box.y + box.h, '无绕障时应卡在南墙外（复现原 bug）');
assert.ok(Math.abs(stuck.x - 300) < 50, '无绕障时几乎不绕开，x=' + stuck.x);

const went = simulate(true, 180);
assert.ok(went.y < box.y, '绕障后应到达箱子北侧，y=' + went.y);
assert.ok(Math.abs(went.x - 300) > 40, '绕障过程应离开中线');

/* 开阔地：朝向不变 */
const open = { x: 80, y: 80, r: 16, wallT: 0, steerSide: 0, steerObs: null };
const sOpen = A.steerAround(open, 1, 0, 500, 80, 1 / 60, list);
assert.ok(Math.abs(sOpen.x - 1) < 1e-9 && Math.abs(sOpen.y) < 1e-9, '开阔地不应改向');

console.log('test-steer: ok');
