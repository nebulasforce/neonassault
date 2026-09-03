#!/usr/bin/env node
/* 国内投放页与 Docker nginx 部署契约。 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'web/releases/index.html'), 'utf8');
const jsonPath = path.join(root, 'web/releases/releases.json');
const game = fs.readFileSync(path.join(root, 'web/game.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'web/sw.js'), 'utf8');
const nginx = fs.readFileSync(path.join(root, 'deploy/nginx/default.conf'), 'utf8');
const compose = fs.readFileSync(path.join(root, 'deploy/docker-compose.tencent.yml'), 'utf8');

assert.ok(page.includes('投放清单'), '下载页应有投放清单标题');
assert.ok(page.includes('releases.json'), '下载页应加载 releases.json');
assert.ok(page.includes('../index.html'), '下载页必须链回游戏');
assert.ok(game.includes('href="releases/"'), '主菜单应链到安装包页');
assert.ok(sw.includes('/releases/'), 'SW 须单独处理 releases 路径');
assert.ok(nginx.includes('alias /data/releases/'), 'nginx 须把 /releases/download/ 指到外挂目录');
assert.ok(compose.includes('/usr/share/nginx/html:ro'), 'compose 须外挂 www');
assert.ok(compose.includes('/data/releases:ro'), 'compose 须外挂 files');
assert.ok(compose.includes('nginx/default.conf'), 'compose 须外挂 nginx 配置');
assert.ok(fs.existsSync(path.join(root, 'deploy/push-and-deploy.sh')));
assert.ok(fs.existsSync(path.join(root, 'deploy/remote-deploy.sh')));

if (fs.existsSync(jsonPath)) {
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  assert.ok(Array.isArray(data.releases) && data.releases.length, 'releases.json 应含版本列表');
  assert.ok(data.releases[0].assets.length, '最新版本应有资源');
}

console.log('test-releases-page: ok');
