#!/usr/bin/env node
/* 安卓壳：全屏战场 Canvas 不能打进 WebView 的 HARDWARE layer，否则只剩 HUD/雷达。 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const activity = fs.readFileSync(
  path.join(root, 'android/app/src/main/java/com/nebulasforce/neonassault/MainActivity.java'),
  'utf8');
const game = fs.readFileSync(path.join(root, 'web/game.js'), 'utf8');
const build = fs.readFileSync(path.join(root, 'scripts/build-capacitor.js'), 'utf8');
const gitignore = fs.readFileSync(path.join(root, 'android/.gitignore'), 'utf8');

assert.ok(activity.includes('LAYER_TYPE_NONE'), 'WebView 须 LAYER_TYPE_NONE');
assert.ok(!activity.includes('setLayerType(View.LAYER_TYPE_HARDWARE'), 'WebView 不得整页 HARDWARE layer');
assert.ok(activity.includes('setOffscreenPreRaster(false)'), '不要 offscreen pre-raster 卡住首帧');
assert.ok(game.includes('function wantDesyncCanvas'), '安卓 UA / Capacitor 须关掉 desynchronized');
assert.ok(gitignore.includes('assets/public'), 'public 由 cap sync 生成，不应手改后打进包');
assert.ok(build.includes('npx cap sync android'), '打包前必须 cap sync');
assert.ok(build.includes('assets/player.webp'), 'sync 后须检查玩家贴图在不在包里');
assert.ok(build.includes('wantDesyncCanvas'), 'sync 后须确认 game.js 是当前修复版');

console.log('test-android-webview-canvas: ok');
