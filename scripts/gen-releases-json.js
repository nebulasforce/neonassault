#!/usr/bin/env node
/* 根据 GitHub Releases + 本地 dist-releases/ 生成 releases.json
 *
 *   node scripts/gen-releases-json.js --mode github --out web/releases/releases.json
 *   node scripts/gen-releases-json.js --mode mirror --files dist-releases --out dist-web/releases/releases.json
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function fetchJson(url) {
  const body = execFileSync('curl', [
    '-fsSL', '-A', 'neonassault-releases',
    '-H', 'Accept: application/vnd.github+json',
    url
  ], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  return JSON.parse(body);
}

const root = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
}

const mode = arg('--mode', 'github'); // github | mirror
const out = path.resolve(root, arg('--out', 'web/releases/releases.json'));
const filesDir = path.resolve(root, arg('--files', 'dist-releases'));
const repo = arg('--repo', 'nebulasforce/neonassault');
const playUrl = arg('--play-url', mode === 'mirror' ? '/' : 'https://nebulasforce.github.io/neonassault/');

function classify(name) {
  const n = name.toLowerCase();
  if (n.endsWith('.apk')) return { platform: 'android', label: 'Android 通用包', hint: 'debug 签名，可直接侧载' };
  if (n.includes('windows') && n.includes('setup')) return { platform: 'windows-setup', label: 'Windows 安装包', hint: 'NSIS，可选安装目录' };
  if (n.includes('windows') && n.includes('portable')) return { platform: 'windows-portable', label: 'Windows 便携版', hint: '免安装，解压即可玩' };
  if (n.includes('macos') && n.endsWith('.dmg')) return { platform: 'macos', label: 'macOS 磁盘映像', hint: '未公证，首次请右键 → 打开' };
  if (n.includes('macos') && n.endsWith('.zip')) return { platform: 'macos-zip', label: 'macOS Zip', hint: '未公证，备用压缩包' };
  if (n.includes('harmonyos') || n.includes('deveco')) return { platform: 'harmonyos', label: '鸿蒙 DevEco 工程', hint: '用 DevEco 打开 harmonyos/ 后 Build Hap(s)' };
  if (n.endsWith('.appimage')) return { platform: 'linux', label: 'Linux AppImage', hint: 'chmod +x 后直接运行' };
  return { platform: 'other', label: name, hint: '' };
}

function localFile(tag, name) {
  const p = path.join(filesDir, tag, name);
  return fs.existsSync(p) ? p : null;
}

function sha256Of(file) {
  const side = file + '.sha256';
  if (fs.existsSync(side)) return fs.readFileSync(side, 'utf8').trim().split(/\s+/)[0];
  return '';
}

function notesHtml(body, latestPlay) {
  const lines = String(body || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let inList = false;
  const flush = () => { if (inList) { out.push('</ul>'); inList = false; } };
  for (let line of lines) {
    line = line.replace(/https:\/\/nebulasforce\.github\.io\/neonassault\/?/g, latestPlay);
    const bold = s => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
    if (/^##\s+/.test(line)) {
      flush();
      out.push('<h3>' + bold(line.replace(/^##\s+/, '')) + '</h3>');
    } else if (/^-\s+/.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push('<li>' + bold(line.replace(/^-\s+/, '')) + '</li>');
    } else if (!line.trim()) {
      flush();
    } else {
      flush();
      out.push('<p>' + bold(line) + '</p>');
    }
  }
  flush();
  return out.join('\n');
}

(async () => {
  const api = 'https://api.github.com/repos/' + repo + '/releases?per_page=12';
  const raw = await fetchJson(api);
  const published = raw.filter(r => !r.draft && !r.prerelease);
  if (!published.length) throw new Error('no published releases');

  const releases = published.map((r, i) => {
    const tag = r.tag_name;
    const assets = (r.assets || []).map(a => {
      const cls = classify(a.name);
      const local = localFile(tag, a.name);
      const githubUrl = a.browser_download_url;
      const url = (mode === 'mirror' && local)
        ? '/releases/download/' + encodeURIComponent(tag) + '/' + encodeURIComponent(a.name)
        : githubUrl;
      return {
        name: a.name,
        label: cls.label,
        hint: cls.hint,
        platform: cls.platform,
        size: a.size | 0,
        url,
        githubUrl,
        local: !!(mode === 'mirror' && local),
        sha256: local ? sha256Of(local) : ''
      };
    });
    return {
      tag,
      name: r.name || tag,
      publishedAt: r.published_at,
      latest: i === 0,
      notesHtml: notesHtml(r.body, playUrl),
      assets
    };
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    mode,
    repo: 'https://github.com/' + repo,
    playUrl,
    releases
  };

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(payload, null, 2) + '\n');
  console.log('wrote', out, '(' + releases.length + ' releases, mode=' + mode + ')');
})().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
