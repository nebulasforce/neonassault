#!/usr/bin/env node
/* 游戏说明页与游戏页拆分：静态契约回归。 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const web = path.join(__dirname, '../web');
const index = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
const guide = fs.readFileSync(path.join(web, 'guide.html'), 'utf8');
const game = fs.readFileSync(path.join(web, 'game.js'), 'utf8');
const sw = fs.readFileSync(path.join(web, 'sw.js'), 'utf8');

assert.ok(fs.existsSync(path.join(web, 'guide.html')), '缺少 web/guide.html');
assert.ok(guide.includes('href="index.html"'), '说明页必须链回游戏页');
assert.ok(guide.includes('作战简报'), '说明页应有作战简报标题');
assert.ok(guide.includes('<kbd>W</kbd>'), '说明页应包含操作说明');
assert.ok(!guide.includes('game.js'), '说明页不得加载 game.js');
assert.ok(!guide.includes('textures.js'), '说明页不得加载 textures.js');
assert.ok(!guide.includes('sprites.js'), '说明页不得加载 sprites.js');

assert.ok(game.includes('href="guide.html"'), '游戏菜单必须链到说明页');
assert.ok(game.includes("showPanel('ach')"), '成就应独立成面板');
assert.ok(!game.includes('TAB_DESIGN'), '游戏脚本不得再内嵌设计说明');
assert.ok(!game.includes('TAB_CONTROLS'), '游戏脚本不得再内嵌操作说明');
assert.ok(!game.includes('function codexHtml'), '图鉴应从游戏脚本移除');
assert.ok(!game.includes('paintCodexThumbs'), '图鉴缩略图绘制应从游戏脚本移除');
assert.ok(!index.includes('cx-card'), '游戏页 CSS 不得再含图鉴卡片');
assert.ok(!index.includes('.keys{'), '游戏页 CSS 不得再含按键说明表');

assert.ok(sw.includes(" './guide.html'"), 'Service Worker 须缓存说明页');

console.log('test-guide-split: ok');
