#!/usr/bin/env node
/* Capacitor Android 构建入口脚本
 *
 * 前置要求：
 *   - JDK 17+
 *   - Android Studio + SDK（API 34+），sdk.dir 已写入 android/local.properties
 *   - 首次使用需先执行 pnpm cap:add（npx cap add android）
 *
 * 用法：
 *   node scripts/build-capacitor.js            # 同步 Web 资源并打 Debug APK
 *   node scripts/build-capacitor.js --release  # 打 Release APK（需配置签名）
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
process.chdir(root);

function run(cmd) {
  console.log('> ' + cmd);
  execSync(cmd, { stdio: 'inherit' });
}

const androidDir = path.join(root, 'android');
if (!fs.existsSync(androidDir)) {
  console.error('尚未初始化 Android 平台，请先运行：pnpm cap:add');
  process.exit(1);
}

// 1) 把最新的 web/ 同步进 android/app/src/main/assets/public
run('npx cap sync android');

const release = process.argv.includes('--release');
const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const task = release ? 'assembleRelease' : 'assembleDebug';
run(`cd android && ${gradlew} ${task}`);

const outDir = path.join(
  'android', 'app', 'build', 'outputs', 'apk',
  release ? 'release' : 'debug'
);

console.log('');
if (fs.existsSync(outDir)) {
  const apks = fs.readdirSync(outDir).filter(f => f.endsWith('.apk'));
  if (apks.length) {
    console.log('构建产物：');
    for (const f of apks) {
      const size = (fs.statSync(path.join(outDir, f)).size / 1024 / 1024).toFixed(2);
      console.log(`  ${path.join(outDir, f)}  (${size} MB)`);
    }
  }
} else {
  console.log('未找到输出目录：' + outDir);
  console.log('若未配置签名，Release 构建会失败；请先设置 NA_KEYSTORE_* 环境变量。');
}
