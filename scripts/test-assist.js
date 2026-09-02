#!/usr/bin/env node
/* 从 web/game.js 抽出瞄准 / 任意门纯函数，回归 atan2(0,0) 横向开火与甩头。 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '../web/game.js'), 'utf8');
const start = src.indexOf('const AIM_STICK_MIN2');
const end = src.indexOf('/* ═══ 5. 竞技场');
assert.ok(start >= 0 && end > start, '找不到瞄准辅助函数块');
const A = new Function(src.slice(start, end) +
  '; return { AIM_STICK_MIN2, AIM_POINTER_MIN2, AIM_DRAG_MIN, stickHasAim, pointerAim, isManualAim, warpExit };')();

/* 根因：atan2(0,0) === 0，朝右横向 */
assert.strictEqual(Math.atan2(0, 0), 0);

/* 右半屏点按、摇杆死区：不算手动瞄准 */
assert.strictEqual(A.stickHasAim({ active: true, x: 0, y: 0 }), false);
assert.strictEqual(A.stickHasAim({ active: true, x: 0.05, y: 0 }), false);
assert.strictEqual(A.stickHasAim({ active: true, x: 0.5, y: 0 }), true);
assert.strictEqual(A.stickHasAim({ active: false, x: 1, y: 0 }), false);

/* 单击开火（down 但未拖）不能抢走自动瞄准 */
assert.strictEqual(A.isManualAim(false, false, false, false), false);
assert.strictEqual(A.isManualAim(false, false, false, true), true);
assert.strictEqual(A.isManualAim(true, false, false, false), true);
assert.strictEqual(A.isManualAim(false, true, true, false), true);
assert.strictEqual(A.isManualAim(false, false, true, true), false);

/* 指针落在机体上：保持原朝向，不写成 0 */
assert.strictEqual(A.pointerAim(400, 300, 400, 300, 0, 0), null);
assert.ok(Math.abs(A.pointerAim(500, 300, 400, 300, 0, 0)) < 1e-9);
const up = A.pointerAim(400, 200, 400, 300, 0, 0);
assert.ok(Math.abs(up + Math.PI / 2) < 1e-9);

/* 任意门：沿飞入方向从对侧推出，且落在门外 */
const from = { x: 100, y: 100, r: 36 };
const to = { x: 800, y: 400, r: 36 };
const out = A.warpExit(from, to, 110, 100, 80, 0, 15);
assert.ok(out.x > to.x, '应出现在出口右侧（继续向右飞）');
assert.ok(Math.hypot(out.x - to.x, out.y - to.y) > to.r + 15, '出口不能立刻再吸入');

const slow = A.warpExit(from, to, 100, 80, 0, 0, 15);
assert.ok(slow.y < to.y, '低速时按进入偏移推出（从门下方进则从下方出）');

console.log('test-assist: ok');
