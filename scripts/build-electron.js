#!/usr/bin/env node
/* Electron 打包入口脚本 — 封装当前 web/ 目录 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
process.chdir(root);

function run(cmd) {
  console.log('> ' + cmd);
  execSync(cmd, { stdio: 'inherit' });
}

const target = process.argv[2] || '--mac --win';
run(`npx electron-builder ${target} --publish=never`);
console.log('Electron build done. Outputs in dist-electron/');
