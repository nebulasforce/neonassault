#!/usr/bin/env node
/* 通关后自动进下一关必须立刻发放该关武器，不能等到重新进入。 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '../web/game.js'), 'utf8');
const start = src.indexOf('function grantSectorGunsTo');
const end = src.indexOf('function grantSectorGuns(');
assert.ok(start >= 0 && end > start, '找不到 grantSectorGunsTo');
const A = new Function(src.slice(start, end) + '; return { grantSectorGunsTo };')();

const WEAPONS = [
  { id: 'pistol', ammoMax: Infinity },
  { id: 'smg', ammoMax: 260 },
  { id: 'shotgun', ammoMax: 44 },
  { id: 'laser', ammoMax: 220 },
  { id: 'rocket', ammoMax: 14 },
];
const ammoFor = w => w.ammoMax;

const owned = { pistol: true, smg: true, shotgun: false, laser: false, rocket: false };
const ammo = { pistol: Infinity, smg: 260, shotgun: 0, laser: 0, rocket: 0 };

const n1 = A.grantSectorGunsTo(owned, ammo, 2, WEAPONS, ammoFor);
assert.strictEqual(n1.length, 0, '同关不应重复提示已有武器');
assert.strictEqual(owned.shotgun, false);

const n2 = A.grantSectorGunsTo(owned, ammo, 4, WEAPONS, ammoFor);
assert.deepStrictEqual(n2.map(w => w.id), ['shotgun', 'laser']);
assert.strictEqual(owned.shotgun, true);
assert.strictEqual(owned.laser, true);
assert.strictEqual(owned.rocket, false);
assert.strictEqual(ammo.shotgun, 44);
assert.strictEqual(ammo.laser, 220);

const enter = src.slice(src.indexOf('function enterSector'), src.indexOf('function startWave'));
assert.ok(enter.includes('grantSectorGuns(player)'), '自动进下一关必须发放该关武器');

const newGame = src.slice(src.indexOf('function newGame'), src.indexOf('function setState'));
assert.ok(!/for\s*\(\s*let i = 0; i < guns/.test(newGame),
  '发放应集中在 enterSector，避免只在重进时解锁');

console.log('test-weapons-start: ok');
