#!/usr/bin/env node
/* 微型导弹改为巡航：越内墙、有高度投影；普通子弹仍撞墙。 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '../web/game.js'), 'utf8');

assert.ok(src.includes('cruise: true') || src.includes('b.cruise'), '导弹应标记为巡航弹');
assert.ok(/OBS_H\s*=\s*([3-9]\d|[1-9]\d{2})/.test(src), '掩体立体高度应明显高于 15px');

const upd = src.slice(src.indexOf('function updateBullets'), src.indexOf('function damageEnemy'));
assert.ok(upd.includes('!b.explode') && upd.includes('inObstacle'),
  '普通子弹撞墙；巡航导弹 (!b.explode) 不因内墙销毁');

const draw = src.slice(src.indexOf('/* 火箭弹'), src.indexOf('function drawEnemyBullets'));
assert.ok(draw.includes('lift') || draw.includes('MISSILE_LIFT') || draw.includes('b.y -'),
  '导弹绘制应抬升，呈现飞越掩体');
assert.ok(draw.includes('ellipse') || draw.includes('shadow'), '巡航导弹应有地面投影');

console.log('test-cruise-missile: ok');
