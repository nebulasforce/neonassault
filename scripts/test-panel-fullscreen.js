#!/usr/bin/env node
/* 主菜单 / 覆盖层面板须铺满视口，不得再锁死 880px 居中卡片。 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const index = fs.readFileSync(path.join(__dirname, '../web/index.html'), 'utf8');
const game = fs.readFileSync(path.join(__dirname, '../web/game.js'), 'utf8');

assert.ok(!/width:\s*min\(\s*880px/.test(index), '桌面面板不得再锁 880px');
assert.ok(!/width:\s*min\(\s*960px/.test(index), '触屏面板不得再锁 960px');
assert.ok(/\.panel\{[^}]*width:100%/.test(index.replace(/\s+/g, ' ')), '面板须 width:100%');
assert.ok(/\.panel\{[^}]*height:100%/.test(index.replace(/\s+/g, ' ')), '面板须 height:100%');
assert.ok(index.includes('data-mode="menu"'), '初始 overlay 应标记 menu 模式');
assert.ok(game.includes('ov.dataset.mode = mode'), 'showPanel 须写入 overlay 模式');
assert.ok(game.includes('class="menu-hero"'), '主菜单须用全屏 hero 布局');

console.log('test-panel-fullscreen: ok');
