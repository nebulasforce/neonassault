#!/usr/bin/env node
/* 局内存档：Infinity 弹药可往返；快照不含函数。 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '../web/game.js'), 'utf8');
const start = src.indexOf('function dumpAmmo');
const end = src.indexOf('function snapshotRun');
assert.ok(start >= 0 && end > start, '找不到 dumpAmmo…snapshotRun');
const A = new Function(src.slice(start, end) + '; return { dumpAmmo, loadAmmo };')();

const dumped = A.dumpAmmo({ pistol: Infinity, smg: 80, rocket: 0 });
const json = JSON.parse(JSON.stringify(dumped));
const back = A.loadAmmo(json);
assert.strictEqual(back.pistol, Infinity);
assert.strictEqual(back.smg, 80);
assert.strictEqual(back.rocket, 0);

assert.ok(src.includes("const RUN_KEY = 'na_run_v1'"), '局内存档应使用独立 localStorage 键');
assert.ok(src.includes('function loadRun'), '应能读取局内存档');
assert.ok(src.includes('function persistRun'), '应能写入局内存档');
assert.ok(src.includes('btnContinue') || src.includes('继续游戏'), '主菜单应能继续已存档的一局');

const newGame = src.slice(src.indexOf('function newGame'), src.indexOf('function setState'));
assert.ok(newGame.includes('clearRun'), '新开一局应清掉旧的局内存档');

console.log('test-run-save: ok');
