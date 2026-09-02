#!/usr/bin/env node
/* 手机 / 平板强制横屏：页面、原生壳、PWA 都要锁到横屏。 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');
const game = fs.readFileSync(path.join(root, 'web/game.js'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'web/manifest.json'), 'utf8');
const android = fs.readFileSync(path.join(root, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
const activity = fs.readFileSync(
  path.join(root, 'android/app/src/main/java/com/nebulasforce/neonassault/MainActivity.java'),
  'utf8');
const moduleJson = fs.readFileSync(path.join(root, 'harmonyos/entry/src/main/module.json5'), 'utf8');
const ability = fs.readFileSync(
  path.join(root, 'harmonyos/entry/src/main/ets/entryability/EntryAbility.ets'),
  'utf8');

assert.ok(index.includes('html.handheld #rotateLock'), '竖屏遮罩须在 html.handheld 下显示');
assert.ok(index.includes('body.need-rotate #rotateLock'), 'JS 须用 need-rotate 驱动旋转提示');
assert.ok(index.includes('请将手机或平板旋转至横屏'), '提示文案应覆盖手机与平板');
assert.ok(index.includes("classList.add('handheld')"), '首屏脚本须尽早标记 handheld');

assert.ok(game.includes('function isMobileOrTablet'), '须识别手机/平板（含 iPad 桌面 UA）');
assert.ok(game.includes('function tryLockLandscape'), '须调用 Screen Orientation lock');
assert.ok(game.includes("ori.lock('landscape')"), 'orientation.lock 须为 landscape');
assert.ok(game.includes("'need-rotate'"), '竖屏须加上 need-rotate');
assert.ok(game.includes('function applyBodyState'), 'setState 不得冲掉横屏相关 class');
assert.ok(!/body\.className\s*=\s*\(touchMode/.test(game), '不得再无条件覆盖 body.className');

assert.ok(manifest.includes('"orientation": "landscape"'), 'PWA 须声明横屏');
assert.ok(/screenOrientation="sensorLandscape"/.test(android), 'Android 须 sensorLandscape');
assert.ok(activity.includes('SCREEN_ORIENTATION_SENSOR_LANDSCAPE'), 'Activity 须再次锁定横屏');
assert.ok(moduleJson.includes('"orientation": "auto_rotation_landscape"'),
  '鸿蒙 Ability 须 auto_rotation_landscape');
assert.ok(ability.includes('AUTO_ROTATION_LANDSCAPE'), '鸿蒙窗口须 setPreferredOrientation 横屏');

console.log('test-landscape-lock: ok');
