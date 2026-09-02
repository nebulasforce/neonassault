#!/usr/bin/env node
/* 手机/平板战场画布：跟视口走，改分辨率后必须重建地面贴图，否则 WebKit 全黑。 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');
const game = fs.readFileSync(path.join(root, 'web/game.js'), 'utf8');

assert.ok(/#game\{[^}]*width:100%/.test(index.replace(/\s+/g, ' ')), '画布须 width:100%');
assert.ok(!/#game\{[^}]*inset:0/.test(index.replace(/\s+/g, ' ')), '画布不得再用 inset:0 和 JS 宽高对抢');
assert.ok(!/canvas\.style\.width\s*=\s*view\.w/.test(game), '不得再把 canvas.style.width 写成 innerWidth 像素');

assert.ok(game.includes('function cssViewSize'), '视口须从 #app / visualViewport 读取');
assert.ok(game.includes('function refreshPatterns'), '须能重建地面/天空 pattern');
assert.ok(game.includes('refreshPatterns()'), '改 backing store 后须重建 pattern');
assert.ok(game.includes('function wantDesyncCanvas'), '嵌入式 WebView 须单独决定是否开 desynchronized');
assert.ok(game.includes('window.Capacitor'), 'Capacitor 安卓壳不得开 desynchronized');
assert.ok(game.includes('theme.base'), '地面须有纯色兜底，pattern 失效时不能一片黑');

console.log('test-canvas-viewport: ok');
