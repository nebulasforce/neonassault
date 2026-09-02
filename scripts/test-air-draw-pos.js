#!/usr/bin/env node
/* 空中单位光圈必须跟机体视觉坐标，不能画在地面投影上。 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '../web/game.js'), 'utf8');
const start = src.indexOf('function airDrawPos');
const end = src.indexOf('/* Boss 基础血量');
assert.ok(start >= 0 && end > start, '找不到 airDrawPos');
const A = new Function('AIR_LIFT', src.slice(start, end) + '; return { airDrawPos };')(48);

const ground = { x: 400, y: 300, air: false, r: 16 };
assert.deepStrictEqual(A.airDrawPos(ground), { x: 400, y: 300 });

const air = { x: 400, y: 300, air: true, alt: 1, bob: 0, r: 23 };
const p = A.airDrawPos(air);
assert.ok(p.y < air.y - 40, '机体应抬升，不能和地面投影重合 y=' + p.y);
assert.ok(p.x > air.x, '透视应略向右偏');

const aim = src.slice(src.indexOf('function drawAimLock'), src.indexOf('function drawTouchAim'));
assert.ok(aim.includes('airDrawPos'), '瞄准光圈必须跟空中机体而不是地面坐标');

const airUpd = src.slice(src.indexOf('function updateAir'), src.indexOf('function dropBomb'));
assert.ok(airUpd.includes('airDrawPos'), '引擎尾迹粒子必须跟机体视觉坐标');

console.log('test-air-draw-pos: ok');
