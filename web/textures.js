/* ══════════════════════════════════════════════════════════════
   textures.js — 程序化贴图库
   所有材质由离屏 Canvas 现场绘制生成：零外部资源、离线可用、可按主题换肤
   ══════════════════════════════════════════════════════════════ */
window.TEX = (() => {
'use strict';

/* ---------- 基础工具 ---------- */
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function px(hex) {
  hex = String(hex).replace('#', '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  const n = parseInt(hex, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba(hex, a) {
  const c = px(hex);
  return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
}
function shade(hex, amt) {
  const c = px(hex);
  const f = v => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  return 'rgb(' + f(c[0]) + ',' + f(c[1]) + ',' + f(c[2]) + ')';
}

/* ---------- 主题调色板 ---------- */
const THEMES = {
  dock: {
    cn:'霓虹码头', en:'NEON DOCKS',
    base:'#0a1523', plate:['#142a45','#0b182b'], seam:'#050b14',
    grid:'#7df9ff', accent:'#7df9ff', panel:['#1c3350','#0d1928'],
    rivet:'#3d6c8c', mot:'hex', fog:'#040a12',
  },
  foundry: {
    cn:'熔炉厂区', en:'THE FOUNDRY',
    base:'#1b0d07', plate:['#321809','#190c05'], seam:'#0d0502',
    grid:'#ff8a5c', accent:'#ff7a3c', panel:['#402517','#1e1009'],
    rivet:'#8a4d29', mot:'crack', fog:'#100604',
  },
  data: {
    cn:'数据回廊', en:'DATA CORRIDOR',
    base:'#100b20', plate:['#20133b','#110a24'], seam:'#070413',
    grid:'#c77dff', accent:'#a86bff', panel:['#2e1c52','#160e2b'],
    rivet:'#7350b4', mot:'circuit', fog:'#08051a',
  },
  frost: {
    cn:'霜蚀荒原', en:'FROSTBITE',
    base:'#0b1a26', plate:['#183646','#0c1f2b'], seam:'#050d14',
    grid:'#9be8ff', accent:'#7fd4ff', panel:['#22485e','#112836'],
    rivet:'#5399b4', mot:'ice', fog:'#050e16',
  },
  toxic: {
    cn:'毒沼地带', en:'TOXIC MARSH',
    base:'#0a1a11', plate:['#163524','#0a1e14'], seam:'#040e08',
    grid:'#9ae66e', accent:'#7ddc4a', panel:['#21472b','#0f2415'],
    rivet:'#559249', mot:'hazard', fog:'#050f08',
  },
  void: {
    cn:'虚空尖塔', en:'VOID SPIRE',
    base:'#0a0716', plate:['#1a1030','#0d081a'], seam:'#050310',
    grid:'#e0a3ff', accent:'#c77dff', panel:['#251945','#110c24'],
    rivet:'#734fac', mot:'star', fog:'#04020c',
  },
  rust: {
    cn:'锈蚀船坞', en:'RUST YARD',
    base:'#181008', plate:['#2e1d0c','#180f06'], seam:'#0b0703',
    grid:'#ffc857', accent:'#ffb020', panel:['#3d2811','#1d1208'],
    rivet:'#94712f', mot:'rust', fog:'#0b0704',
  },
  core: {
    cn:'核心熔毁', en:'CORE MELTDOWN',
    base:'#1d0711', plate:['#3a1023','#1e0812'], seam:'#100309',
    grid:'#ff4d6d', accent:'#ff2d55', panel:['#4c142c','#240b16'],
    rivet:'#ab2f4d', mot:'conduit', fog:'#0e0307',
  },
};

/* ---------- 地面装饰母题（在 256 平铺块内绘制） ---------- */
const MOTIF = {
  hex(x, S, T, r) {
    const R = 42, H = R * Math.sqrt(3);
    x.strokeStyle = rgba(T.accent, 0.11); x.lineWidth = 1.4;
    x.beginPath();
    for (let row = -1; row * H < S + H; row++)
      for (let c = -1; c * R * 1.5 < S + R * 2; c++) {
        const cx = c * R * 1.5, cy = row * H + (Math.abs(c) % 2 ? H / 2 : 0);
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          const ax = cx + Math.cos(a) * R, ay = cy + Math.sin(a) * R;
          i ? x.lineTo(ax, ay) : x.moveTo(ax, ay);
        }
        x.closePath();
      }
    x.stroke();
    x.fillStyle = rgba(T.accent, 0.20);
    for (let i = 0; i < 12; i++) { x.beginPath(); x.arc(r() * S, r() * S, 1.7, 0, 7); x.fill(); }
  },

  crack(x, S, T, r) {
    for (let i = 0; i < 8; i++) {
      let ax = r() * S, ay = r() * S, a = r() * Math.PI * 2;
      x.strokeStyle = rgba(T.accent, 0.10 + r() * 0.18);
      x.lineWidth = 1 + r() * 2.4;
      x.beginPath(); x.moveTo(ax, ay);
      for (let k = 0; k < 7; k++) {
        a += (r() - 0.5) * 1.35;
        const L = 12 + r() * 28;
        ax += Math.cos(a) * L; ay += Math.sin(a) * L; x.lineTo(ax, ay);
      }
      x.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const bx = r() * S, by = r() * S, R = 18 + r() * 36;
      const g = x.createRadialGradient(bx, by, 0, bx, by, R);
      g.addColorStop(0, rgba(T.accent, 0.20)); g.addColorStop(1, rgba(T.accent, 0));
      x.fillStyle = g; x.beginPath(); x.arc(bx, by, R, 0, 7); x.fill();
    }
  },

  circuit(x, S, T, r) {
    x.lineCap = 'round'; x.lineJoin = 'round';
    x.strokeStyle = rgba(T.accent, 0.20); x.lineWidth = 1.6;
    for (let i = 0; i < 24; i++) {
      let ax = Math.round(r() * 8) * 32, ay = Math.round(r() * 8) * 32;
      x.beginPath(); x.moveTo(ax, ay);
      for (let k = 0; k < 4; k++) {
        if (r() < 0.5) ax += (r() < 0.5 ? -1 : 1) * 32;
        else ay += (r() < 0.5 ? -1 : 1) * 32;
        x.lineTo(ax, ay);
      }
      x.stroke();
      x.fillStyle = rgba(T.accent, 0.38);
      x.beginPath(); x.arc(ax, ay, 2.7, 0, 7); x.fill();
    }
  },

  ice(x, S, T, r) {
    x.strokeStyle = rgba(T.accent, 0.12); x.lineWidth = 1;
    for (let i = 0; i < 30; i++) {
      let ax = r() * S, ay = r() * S, a = r() * 7;
      x.beginPath(); x.moveTo(ax, ay);
      for (let k = 0; k < 4; k++) {
        a += (r() - 0.5) * 1.7;
        const L = 8 + r() * 24;
        ax += Math.cos(a) * L; ay += Math.sin(a) * L; x.lineTo(ax, ay);
      }
      x.stroke();
    }
    x.fillStyle = 'rgba(255,255,255,0.10)';
    for (let i = 0; i < 170; i++) x.fillRect(r() * S, r() * S, 1.2, 1.2);
  },

  hazard(x, S, T, r) {
    for (let i = 0; i < 3; i++) {
      const bx = r() * S, by = r() * S, w = 62 + r() * 72, h = 22 + r() * 18;
      x.save(); x.beginPath(); x.rect(bx, by, w, h); x.clip();
      x.fillStyle = rgba(T.accent, 0.09); x.fillRect(bx, by, w, h);
      x.strokeStyle = rgba(T.accent, 0.15); x.lineWidth = 7;
      for (let d = -h; d < w + h; d += 16) { x.beginPath(); x.moveTo(bx + d, by + h); x.lineTo(bx + d + h, by); x.stroke(); }
      x.restore();
    }
    x.strokeStyle = rgba(T.accent, 0.16); x.lineWidth = 1;
    for (let i = 0; i < 30; i++) { const bx = r() * S, by = r() * S, R = 3 + r() * 12; x.beginPath(); x.arc(bx, by, R, 0, 7); x.stroke(); }
  },

  star(x, S, T, r) {
    for (let i = 0; i < 100; i++) {
      const ax = r() * S, ay = r() * S, R = (0.6 + r() * 1.8) * 4, a = 0.22 + r() * 0.65;
      const g = x.createRadialGradient(ax, ay, 0, ax, ay, R);
      g.addColorStop(0, 'rgba(255,255,255,' + a + ')');
      g.addColorStop(0.4, rgba(T.accent, a * 0.45));
      g.addColorStop(1, rgba(T.accent, 0));
      x.fillStyle = g; x.beginPath(); x.arc(ax, ay, R, 0, 7); x.fill();
    }
  },

  rust(x, S, T, r) {
    for (let i = 0; i < 16; i++) {
      const bx = r() * S, by = r() * S, R = 16 + r() * 48;
      const g = x.createRadialGradient(bx, by, 0, bx, by, R);
      g.addColorStop(0, rgba(T.accent, 0.13));
      g.addColorStop(0.55, rgba(T.rivet, 0.11));
      g.addColorStop(1, rgba(T.accent, 0));
      x.fillStyle = g; x.beginPath(); x.arc(bx, by, R, 0, 7); x.fill();
    }
    x.strokeStyle = 'rgba(0,0,0,0.15)'; x.lineWidth = 1;
    for (let i = 0; i < 44; i++) {
      const ax = r() * S, ay = r() * S;
      x.beginPath(); x.moveTo(ax, ay); x.lineTo(ax + r() * 30 - 15, ay + r() * 30 - 15); x.stroke();
    }
  },

  conduit(x, S, T, r) {
    const lines = [];
    for (let i = 0; i < 8; i++) lines.push({ h: r() < 0.5, p: Math.round(r() * 4) * 64 });
    x.lineCap = 'round';
    x.strokeStyle = rgba(T.accent, 0.09); x.lineWidth = 11;
    for (const L of lines) {
      x.beginPath();
      if (L.h) { x.moveTo(0, L.p); x.lineTo(S, L.p); } else { x.moveTo(L.p, 0); x.lineTo(L.p, S); }
      x.stroke();
    }
    x.strokeStyle = rgba(T.accent, 0.20); x.lineWidth = 3;
    for (const L of lines) {
      x.beginPath();
      if (L.h) { x.moveTo(0, L.p); x.lineTo(S, L.p); } else { x.moveTo(L.p, 0); x.lineTo(L.p, S); }
      x.stroke();
    }
    for (let i = 0; i < 14; i++) {
      const bx = Math.round(r() * 4) * 64, by = Math.round(r() * 4) * 64;
      const g = x.createRadialGradient(bx, by, 0, bx, by, 15);
      g.addColorStop(0, rgba(T.accent, 0.5)); g.addColorStop(1, rgba(T.accent, 0));
      x.fillStyle = g; x.beginPath(); x.arc(bx, by, 15, 0, 7); x.fill();
    }
  },
};

/* ---------- 地面贴图（256 无缝平铺） ---------- */
const FLOOR = new Map();
function floor(key) {
  if (FLOOR.has(key)) return FLOOR.get(key);
  const T = THEMES[key] || THEMES.dock;
  const S = 256, c = cv(S, S), x = c.getContext('2d');
  const seed = hash(key);

  x.fillStyle = T.base; x.fillRect(0, 0, S, S);

  /* 大板 2×2 */
  const r0 = rng(seed + 7);
  for (let py = 0; py < 2; py++) for (let pxi = 0; pxi < 2; pxi++) {
    const w = S / 2, ox = pxi * w, oy = py * w;
    x.fillStyle = T.plate[(pxi + py) % 2];
    x.fillRect(ox, oy, w, w);
    x.fillStyle = 'rgba(255,255,255,0.035)';
    x.fillRect(ox, oy, w, 2); x.fillRect(ox, oy, 2, w);
    x.fillStyle = 'rgba(0,0,0,0.30)';
    x.fillRect(ox, oy + w - 2, w, 2); x.fillRect(ox + w - 2, oy, 2, w);
    for (let i = 0; i < 30; i++) {
      x.fillStyle = 'rgba(255,255,255,' + (r0() * 0.035) + ')';
      x.fillRect(ox + r0() * w, oy + r0() * w, 1 + r0() * 4, 1);
    }
  }

  /* 板缝 */
  x.fillStyle = T.seam;
  x.fillRect(0, S / 2 - 1.5, S, 3);
  x.fillRect(S / 2 - 1.5, 0, 3, S);

  /* 细网格 */
  x.strokeStyle = rgba(T.grid, 0.055); x.lineWidth = 1;
  x.beginPath();
  for (let i = 0; i <= S; i += 32) { x.moveTo(i, 0); x.lineTo(i, S); x.moveTo(0, i); x.lineTo(S, i); }
  x.stroke();

  /* 噪点 */
  const rn = rng(seed + 11);
  for (let i = 0; i < 1100; i++) {
    x.fillStyle = rgba(rn() < 0.5 ? '#ffffff' : '#000000', rn() * 0.06);
    x.fillRect(rn() * S, rn() * S, 1, 1);
  }

  /* 主题母题（3×3 重绘保证无缝；每块用同一随机种子） */
  const m = MOTIF[T.mot] || MOTIF.hex;
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    x.save();
    x.translate(ox * S, oy * S);
    x.beginPath(); x.rect(0, 0, S, S); x.clip();
    m(x, S, T, rng(seed + 23));
    x.restore();
  }

  FLOOR.set(key, c);
  return c;
}

/* ---------- 掩体装甲板贴图（128 无缝平铺） ---------- */
const PANEL = new Map();
function panel(key) {
  if (PANEL.has(key)) return PANEL.get(key);
  const T = THEMES[key] || THEMES.dock;
  const S = 128, c = cv(S, S), x = c.getContext('2d');
  const r = rng(hash(key + ':p'));

  const g = x.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, T.panel[0]); g.addColorStop(1, T.panel[1]);
  x.fillStyle = g; x.fillRect(0, 0, S, S);

  /* 拉丝 */
  for (let i = 0; i < 80; i++) {
    x.strokeStyle = 'rgba(255,255,255,' + (r() * 0.032) + ')';
    x.lineWidth = 1;
    const y = r() * S;
    x.beginPath(); x.moveTo(0, y); x.lineTo(S, y); x.stroke();
  }
  /* 分块 */
  x.strokeStyle = 'rgba(0,0,0,0.42)'; x.lineWidth = 2;
  x.strokeRect(0.5, 0.5, S - 1, S - 1);
  x.beginPath(); x.moveTo(0, S / 2); x.lineTo(S, S / 2); x.stroke();
  /* 铆钉 */
  const rivet = (ax, ay) => {
    x.fillStyle = 'rgba(0,0,0,0.55)';
    x.beginPath(); x.arc(ax, ay, 3.2, 0, 7); x.fill();
    x.fillStyle = rgba(T.rivet, 0.9);
    x.beginPath(); x.arc(ax, ay - 0.5, 2.4, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.35)';
    x.beginPath(); x.arc(ax - 0.7, ay - 1.2, 0.9, 0, 7); x.fill();
  };
  for (let i = 14; i < S; i += 25) { rivet(i, 10); rivet(i, S - 10); }
  for (let i = 30; i < S; i += 34) { rivet(10, i); rivet(S - 10, i); }
  /* 警示斜纹 */
  x.save();
  x.beginPath(); x.rect(0, S - 20, S, 20); x.clip();
  x.fillStyle = rgba(T.accent, 0.07); x.fillRect(0, S - 20, S, 20);
  x.strokeStyle = rgba(T.accent, 0.13); x.lineWidth = 6;
  for (let d = -20; d < S + 20; d += 18) { x.beginPath(); x.moveTo(d, S); x.lineTo(d + 20, S - 20); x.stroke(); }
  x.restore();
  /* 噪点 */
  for (let i = 0; i < 420; i++) {
    x.fillStyle = rgba(r() < 0.5 ? '#ffffff' : '#000000', r() * 0.05);
    x.fillRect(r() * S, r() * S, 1, 1);
  }

  PANEL.set(key, c);
  return c;
}

/* ---------- 辉光精灵（粒子 / 子弹通用） ---------- */
const GLOW = new Map();
function glow(color) {
  if (GLOW.has(color)) return GLOW.get(color);
  const S = 64, c = cv(S, S), x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0.00, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.13, rgba(color, 0.92));
  g.addColorStop(0.34, rgba(color, 0.36));
  g.addColorStop(0.66, rgba(color, 0.09));
  g.addColorStop(1.00, rgba(color, 0));
  x.fillStyle = g;
  x.beginPath(); x.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); x.fill();
  GLOW.set(color, c);
  return c;
}

/* ---------- 视差星空 / 星云（512 无缝） ---------- */
const SKY = new Map();
function sky(key) {
  if (SKY.has(key)) return SKY.get(key);
  const T = THEMES[key] || THEMES.dock;
  const S = 512, c = cv(S, S), x = c.getContext('2d');
  const r = rng(hash(key + ':y'));

  x.fillStyle = T.fog; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 18; i++) {
    const bx = r() * S, by = r() * S, R = 60 + r() * 190;
    const col = r() < 0.5 ? T.accent : T.grid;
    const g = x.createRadialGradient(bx, by, 0, bx, by, R);
    g.addColorStop(0, rgba(col, 0.11)); g.addColorStop(1, rgba(col, 0));
    x.fillStyle = g; x.beginPath(); x.arc(bx, by, R, 0, 7); x.fill();
  }
  for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    const rr = rng(hash(key + ':st'));
    x.save(); x.translate(ox * S, oy * S);
    for (let i = 0; i < 220; i++) {
      const bx = rr() * S, by = rr() * S, R = 0.5 + rr() * 1.5, a = 0.18 + rr() * 0.7;
      x.fillStyle = 'rgba(255,255,255,' + a + ')';
      x.beginPath(); x.arc(bx, by, R, 0, 7); x.fill();
    }
    x.restore();
  }
  SKY.set(key, c);
  return c;
}

/* ---------- 地面装饰贴片 ---------- */
const DEC = new Map();
function decal(key, kind) {
  const id = key + '|' + kind;
  if (DEC.has(id)) return DEC.get(id);
  const T = THEMES[key] || THEMES.dock;
  const S = 128, c = cv(S, S), x = c.getContext('2d');
  const r = rng(hash(id));

  if (kind === 'scorch') {
    for (let i = 0; i < 16; i++) {
      const a = r() * Math.PI * 2, d = r() * 32;
      const bx = S / 2 + Math.cos(a) * d, by = S / 2 + Math.sin(a) * d, R = 12 + r() * 42;
      const g = x.createRadialGradient(bx, by, 0, bx, by, R);
      g.addColorStop(0, 'rgba(0,0,0,0.52)');
      g.addColorStop(0.62, 'rgba(0,0,0,0.26)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.beginPath(); x.arc(bx, by, R, 0, 7); x.fill();
    }
    x.strokeStyle = rgba(T.accent, 0.09); x.lineWidth = 2;
    for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(S / 2 + (r() - 0.5) * 44, S / 2 + (r() - 0.5) * 44, 20 + r() * 36, 0, 7); x.stroke(); }
  } else if (kind === 'grate') {
    x.fillStyle = 'rgba(0,0,0,0.40)'; x.fillRect(0, 0, S, S);
    x.strokeStyle = rgba(T.accent, 0.13); x.lineWidth = 3;
    for (let i = 10; i < S; i += 13) { x.beginPath(); x.moveTo(8, i); x.lineTo(S - 8, i); x.stroke(); }
    x.strokeStyle = 'rgba(0,0,0,0.55)'; x.lineWidth = 3; x.strokeRect(3, 3, S - 6, S - 6);
    x.strokeStyle = rgba(T.accent, 0.22); x.lineWidth = 1; x.strokeRect(9, 9, S - 18, S - 18);
  } else { /* chevron */
    x.lineCap = 'round'; x.lineJoin = 'round';
    x.strokeStyle = rgba(T.accent, 0.26); x.lineWidth = 6;
    for (let i = 0; i < 4; i++) {
      const y = 22 + i * 28;
      x.beginPath(); x.moveTo(20, y + 20); x.lineTo(S / 2, y - 4); x.lineTo(S - 20, y + 20); x.stroke();
    }
  }
  DEC.set(id, c);
  return c;
}

/* ---------- 关卡卡片缩略图 ---------- */
function thumb(key, w, h) {
  const T = THEMES[key] || THEMES.dock;
  const c = cv(w, h), x = c.getContext('2d');
  const r = rng(hash(key + ':t'));

  x.fillStyle = x.createPattern(floor(key), 'repeat');
  x.fillRect(0, 0, w, h);

  const pp = x.createPattern(panel(key), 'repeat');
  for (let i = 0; i < 5; i++) {
    const bw = 34 + r() * 56, bh = 26 + r() * 34;
    const bx = r() * (w - bw), by = h * 0.30 + r() * (h * 0.62 - bh);
    x.save(); x.translate(bx, by);
    x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(5, 6, bw, bh);
    x.save(); x.beginPath(); x.rect(0, 0, bw, bh); x.clip();
    x.translate(bx, by); x.fillStyle = pp; x.fillRect(0, 0, bw, bh); x.restore();
    x.strokeStyle = rgba(T.accent, 0.7); x.lineWidth = 1.4; x.strokeRect(0.5, 0.5, bw - 1, bh - 1);
    x.fillStyle = rgba(T.accent, 0.20); x.fillRect(0, 0, bw, 2.5);
    x.fillStyle = 'rgba(255,255,255,0.07)'; x.fillRect(0, 0, bw, 1);
    x.restore();
  }

  /* 装饰 */
  for (let i = 0; i < 6; i++) {
    const s = 40 + r() * 70;
    x.globalAlpha = 0.5;
    x.drawImage(decal(key, r() < 0.5 ? 'scorch' : 'grate'), r() * w - s / 2, r() * h - s / 2, s, s);
    x.globalAlpha = 1;
  }

  /* 玩家与敌人剪影 */
  const gs = TEX.glow(T.accent);
  x.save();
  x.globalCompositeOperation = 'lighter';
  x.globalAlpha = 0.85;
  x.drawImage(gs, w * 0.26 - 22, h * 0.62 - 22, 44, 44);
  x.globalAlpha = 0.7;
  x.drawImage(gs, w * 0.72 - 16, h * 0.40 - 16, 32, 32);
  x.drawImage(gs, w * 0.84 - 13, h * 0.66 - 13, 26, 26);
  x.restore();

  /* 主题光晕 + 暗角 */
  const g = x.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, rgba(T.accent, 0.14));
  g.addColorStop(0.55, 'rgba(0,0,0,0)');
  g.addColorStop(1, rgba(T.fog, 0.82));
  x.fillStyle = g; x.fillRect(0, 0, w, h);

  const v = x.createRadialGradient(w / 2, h / 2, 12, w / 2, h / 2, w * 0.74);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.74)');
  x.fillStyle = v; x.fillRect(0, 0, w, h);

  return c;
}

/* ---------- 敌人贴图（128×128 程序化机甲纹理） ----------
   用填充渐变替代描边线条，呈现实体机甲质感；缺失时 game.js 会回退到几何绘制。 */
const ENEMY = new Map();
function enemy(type, color) {
  const id = type + '|' + color;
  if (ENEMY.has(id)) return ENEMY.get(id);
  const S = 128, c = cv(S, S), x = c.getContext('2d');
  const C = px(color);
  const bodyDark = 'rgba(' + Math.round(C[0]*0.18) + ',' + Math.round(C[1]*0.18) + ',' + Math.round(C[2]*0.18) + ',0.92)';
  const bodyMid = 'rgba(' + Math.round(C[0]*0.35) + ',' + Math.round(C[1]*0.35) + ',' + Math.round(C[2]*0.35) + ',0.88)';
  const core = rgba(color, 0.95);
  const glow = rgba(color, 0.55);
  const cx = S / 2, cy = S / 2;

  function fillBody(pathFn, gradAngle = 0) {
    const g = x.createLinearGradient(
      cx + Math.cos(gradAngle) * S * 0.35, cy + Math.sin(gradAngle) * S * 0.35,
      cx - Math.cos(gradAngle) * S * 0.42, cy - Math.sin(gradAngle) * S * 0.42
    );
    g.addColorStop(0, bodyMid);
    g.addColorStop(0.55, bodyDark);
    g.addColorStop(1, '#05060a');
    x.fillStyle = g;
    x.beginPath(); pathFn(); x.closePath(); x.fill();
  }

  function coreLight(ax, ay, R) {
    const g = x.createRadialGradient(ax, ay, 0, ax, ay, R);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.2, core);
    g.addColorStop(0.6, glow);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.beginPath(); x.arc(ax, ay, R, 0, 7); x.fill();
  }

  if (type === 'runner') {
    // 箭头型高速突击机
    fillBody(() => {
      x.moveTo(cx + S * 0.42, cy);
      x.lineTo(cx - S * 0.18, cy + S * 0.28);
      x.quadraticCurveTo(cx - S * 0.08, cy, cx - S * 0.18, cy - S * 0.28);
    }, -0.1);
    // 尾焰
    const tg = x.createRadialGradient(cx - S * 0.22, cy, 0, cx - S * 0.22, cy, S * 0.18);
    tg.addColorStop(0, rgba(color, 0.85)); tg.addColorStop(0.4, rgba(color, 0.35)); tg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = tg; x.beginPath(); x.ellipse(cx - S * 0.24, cy, S * 0.14, S * 0.08, 0, 0, 7); x.fill();
    // 装甲高光
    const hg = x.createLinearGradient(cx - S * 0.12, cy - S * 0.12, cx + S * 0.18, cy + S * 0.12);
    hg.addColorStop(0, 'rgba(255,255,255,0)'); hg.addColorStop(0.5, 'rgba(255,255,255,0.18)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = hg; x.beginPath(); x.moveTo(cx + S * 0.32, cy); x.lineTo(cx - S * 0.10, cy + S * 0.14); x.lineTo(cx - S * 0.10, cy - S * 0.14); x.closePath(); x.fill();
    coreLight(cx + S * 0.06, cy, S * 0.10);
  } else if (type === 'tank') {
    // 重型八边形坦克
    fillBody(() => {
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 - Math.PI / 8;
        const R = i % 2 ? S * 0.34 : S * 0.26;
        const px_ = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R;
        i ? x.lineTo(px_, py) : x.moveTo(px_, py);
      }
    }, 0);
    // 装甲板
    x.strokeStyle = rgba(color, 0.28); x.lineWidth = 2; x.strokeRect(cx - S * 0.14, cy - S * 0.14, S * 0.28, S * 0.28);
    // 双炮管
    x.fillStyle = '#05060a'; x.fillRect(cx + S * 0.08, cy - S * 0.20, S * 0.34, S * 0.08);
    x.fillRect(cx + S * 0.08, cy + S * 0.12, S * 0.34, S * 0.08);
    const g = x.createLinearGradient(cx, cy, cx + S * 0.40, cy);
    g.addColorStop(0, rgba(color, 0.9)); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(cx + S * 0.08, cy - S * 0.20, S * 0.34, S * 0.08);
    x.fillRect(cx + S * 0.08, cy + S * 0.12, S * 0.34, S * 0.08);
    coreLight(cx, cy, S * 0.14);
  } else if (type === 'sniper') {
    // 圆形狙击炮台 + 长枪管
    fillBody(() => {
      x.arc(cx - S * 0.04, cy, S * 0.28, 0, 7);
    }, 0);
    // 瞄准环
    const rg = x.createRadialGradient(cx - S * 0.04, cy, S * 0.12, cx - S * 0.04, cy, S * 0.28);
    rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(0.8, rgba(color, 0.22)); rg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = rg; x.beginPath(); x.arc(cx - S * 0.04, cy, S * 0.28, 0, 7); x.fill();
    // 枪管
    x.fillStyle = '#05060a'; x.fillRect(cx + S * 0.10, cy - S * 0.07, S * 0.36, S * 0.06);
    const g = x.createLinearGradient(cx, cy, cx + S * 0.44, cy);
    g.addColorStop(0, rgba(color, 0.85)); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(cx + S * 0.10, cy - S * 0.07, S * 0.36, S * 0.06);
    coreLight(cx - S * 0.04, cy, S * 0.10);
  } else if (type === 'shooter') {
    // 五边形突击无人机 + 双炮
    fillBody(() => {
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5 - Math.PI / 2;
        const R = i === 0 ? S * 0.32 : S * 0.22;
        const px_ = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R;
        i ? x.lineTo(px_, py) : x.moveTo(px_, py);
      }
    }, 0);
    x.fillStyle = '#05060a'; x.fillRect(cx + S * 0.08, cy - S * 0.22, S * 0.30, S * 0.06);
    x.fillRect(cx + S * 0.08, cy + S * 0.16, S * 0.30, S * 0.06);
    const g = x.createLinearGradient(cx, cy, cx + S * 0.38, cy);
    g.addColorStop(0, rgba(color, 0.85)); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(cx + S * 0.08, cy - S * 0.22, S * 0.30, S * 0.06);
    x.fillRect(cx + S * 0.08, cy + S * 0.16, S * 0.30, S * 0.06);
    coreLight(cx + S * 0.02, cy, S * 0.10);
  } else {
    // 默认三角无人机
    fillBody(() => {
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3 - Math.PI / 2;
        const R = i === 0 ? S * 0.34 : S * 0.26;
        const px_ = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R;
        i ? x.lineTo(px_, py) : x.moveTo(px_, py);
      }
    }, 0);
    // 装甲纹理
    const g = x.createRadialGradient(cx, cy, S * 0.05, cx, cy, S * 0.34);
    g.addColorStop(0, rgba(color, 0.10)); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.beginPath(); x.moveTo(cx, cy - S * 0.34); x.lineTo(cx + S * 0.28, cy + S * 0.20); x.lineTo(cx - S * 0.28, cy + S * 0.20); x.closePath(); x.fill();
    coreLight(cx, cy, S * 0.12);
  }

  ENEMY.set(id, c);
  return c;
}

/* ---------- 对外接口 ---------- */
const api = {
  themes: THEMES,
  theme: k => THEMES[k] || THEMES.dock,
  floor, panel, glow, sky, decal, thumb, enemy,
  rgba, shade, TILE: 256,
};
/* 内部自引用（thumb 用到 glow） */
const TEX = api;
return api;

})();
