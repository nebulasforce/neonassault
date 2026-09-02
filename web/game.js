/* 霓虹突袭 NEON ASSAULT — 核心逻辑 */
(() => {
'use strict';

/* ═══ 0. 工具 ═══════════════════════════════════════════ */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp  = (a, b, t) => a + (b - a) * t;
const rand  = (a, b) => a + Math.random() * (b - a);
const randI = (a, b) => Math.floor(rand(a, b + 1));
const pick  = a => a[(Math.random() * a.length) | 0];
const dist  = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const angLerp = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
const $ = id => document.getElementById(id);

/* ═══ 1. 配置：武器 / 敌人 / Boss / 关卡 ═════════════════ */
const WEAPONS = [
  { id:'pistol',  name:'脉冲枪', key:'1', color:'#7df9ff',
    dmg:26, rate:0.16,  speed:980,  spread:0.020, count:1, ammoMax:Infinity, auto:false,
    recoil:2.4, knock:90,  life:1.1,  pierce:0,  r:3.5, ico:10 },
  { id:'smg',     name:'撕裂者',   key:'2', color:'#ffe066',
    dmg:13, rate:0.065, speed:1020, spread:0.085, count:1, ammoMax:260, auto:true,
    recoil:1.3, knock:40,  life:1.0,  pierce:0,  r:3,   ico:8 },
  { id:'shotgun', name:'爆裂霰弹', key:'3', color:'#ff8a5c',
    dmg:15, rate:0.62,  speed:860,  spread:0.30,  count:8, ammoMax:44,  auto:false,
    recoil:9,   knock:260, life:0.34, pierce:0,  r:4,   ico:14 },
  { id:'laser',   name:'棱镜激光', key:'4', color:'#c77dff',
    dmg:17, rate:0.07,  speed:0,    spread:0,     count:1, ammoMax:220, auto:true,
    recoil:0.4, knock:12,  life:0,    pierce:0,  r:0, beam:true, ico:16 },
  { id:'rocket',  name:'微型导弹', key:'5', color:'#ff4d6d',
    dmg:30, rate:0.85,  speed:560,  spread:0.02,  count:1, ammoMax:14,  auto:false,
    recoil:7,   knock:180, life:2.2,  pierce:0,  r:6, ico:12,
    explode:{ dmg:80, radius:125 } },
];
const WI = {}; WEAPONS.forEach((w, i) => { WI[w.id] = i; });

const ENEMY_TYPES = {
  grunt:   { name:'游荡者', hp:60,  r:16, speed:120, color:'#ff4d6d', score:100,
             dmg:11, fireRate:1.7,  bSpeed:330,  prefer:150, burst:1, contact:true,
             sprite:'grunt' },
  runner:  { name:'突袭者', hp:38,  r:13, speed:228, color:'#ff8a5c', score:130,
             dmg:15, fireRate:0,    bSpeed:0,    prefer:0,   burst:0, contact:true,
             sprite:'runner' },
  shooter: { name:'射手',   hp:82,  r:17, speed:96,  color:'#c77dff', score:170,
             dmg:9,  fireRate:1.15, bSpeed:400,  prefer:330, burst:3, contact:false,
             sprite:'shooter' },
  sniper:  { name:'狙击手', hp:70,  r:16, speed:80,  color:'#7df9ff', score:210,
             dmg:27, fireRate:2.5,  bSpeed:1150, prefer:540, burst:1, contact:false, charge:0.85,
             sprite:'sniper' },
  tank:    { name:'重装',   hp:340, r:29, speed:64,  color:'#9ae66e', score:420,
             dmg:16, fireRate:1.9,  bSpeed:300,  prefer:230, burst:5, spread:0.52, contact:true,
             sprite:'tank' },
};

/* ── 空中单位（飞行高度 alt 决定视觉抬升与投影分离） ──
   mode:  orbit  = 绕玩家盘旋射击
          strafe = 俯冲掠袭（高速直线穿过并扫射）
          bomb   = 巡航投弹（落点预警圈 + 范围爆炸）        */
const AIR_TYPES = {
  drone:   { name:'侦查无人机', hp:85,  r:19, speed:172, color:'#7df9ff', score:340,
             dmg:8,  fireRate:1.15, bSpeed:470, burst:2, spread:0.15, alt:0.62,
             sprite:'drone', mode:'orbit',  prefer:265 },
  wasp:    { name:'掠袭攻击机', hp:155, r:23, speed:315, color:'#ff8a5c', score:560,
             dmg:11, fireRate:0.85, bSpeed:660, burst:3, spread:0.09, alt:0.82,
             sprite:'wasp',  mode:'strafe' },
  gunship: { name:'重装炮艇',  hp:640, r:36, speed:112, color:'#c77dff', score:1200,
             dmg:32, fireRate:2.5,  bSpeed:0,   burst:0, alt:1.00,
             sprite:'gunship', mode:'bomb', prefer:235, bombCd:2.4, bombR:132 },
};
const AI_ = {}; ['drone','wasp','gunship'].forEach(k => { AI_[k] = AIR_TYPES[k]; });

/* 空中单位视觉抬升高度（px），乘以各自的 alt */
const AIR_LIFT = 48;

/* Boss 基础血量，实际血量 = base × (1 + 关卡序号 × 0.5) */
const BOSSES = [
  { name:'SENTINEL',    cn:'哨兵',     base:1900, r:46, color:'#ff4d6d', speed:88,
    sprite:'sentinel', spin:0.50 },
  { name:'WRAITH',      cn:'幽影',     base:2600, r:52, color:'#c77dff', speed:112,
    sprite:'wraith',   spin:0.82 },   /* 最灵活：力场转得最快 */
  { name:'TITAN',       cn:'泰坦',     base:3400, r:62, color:'#9ae66e', speed:74,
    sprite:'titan',    spin:0.30 },   /* 最笨重：力场沉缓 */
  /* 空中 Boss：飞行、投弹、不可被地面单位阻挡 */
  { name:'DREADNOUGHT', cn:'无畏舰',   base:3000, r:58, color:'#ff8a5c', speed:96,
    air:true, alt:1.0, sprite:'dreadnought', mode:'bomb',
    bombCd:2.2, bombR:155, dmg:30, prefer:300 },
];

const PICKUPS = { heal:{color:'#9ae66e'}, ammo:{color:'#ffe066'}, shield:{color:'#7df9ff'} };

/* ═══ 6.5 局内强化（每波清完 3 选 1） ═══════════════════ */
const PERKS = [
  { id:'dmg',    name:'超载弹芯',    cn:'子弹伤害 +15%',        color:'#ff4d6d', desc:'所有武器单发伤害提升',        bonus:{ dmgMult:0.15 } },
  { id:'rate',   name:'液压扳机',    cn:'射速 +12%',            color:'#ffe066', desc:'武器冷却时间缩短',          bonus:{ rateMult:0.12 } },
  { id:'speed',  name:'矢量推进器',  cn:'移动速度 +10%',        color:'#7df9ff', desc:'WASD 最大移速提升',         bonus:{ spdMult:0.10 } },
  { id:'hp',     name:'纳米装甲',    cn:'生命上限 +25',         color:'#9ae66e', desc:'提高生命上限并回满生命',      bonus:{ hpBonus:25 } },
  { id:'shield', name:'护盾电容',    cn:'护盾上限 +20',         color:'#3fa9ff', desc:'提高护盾容量',               bonus:{ shBonus:20 } },
  { id:'regen',  name:'快速充能',    cn:'护盾回复 +20%',        color:'#7df9ff', desc:'护盾自动回复速度提升',        bonus:{ shRegenMult:0.20 } },
  { id:'dash',   name:'冷却剂注入',  cn:'冲刺冷却 -12%',        color:'#c77dff', desc:'Shift/空格冲刺冷却缩短',      bonus:{ dashMult:0.12 } },
  { id:'crit',   name:'热感瞄准',    cn:'暴击率 +8%',           color:'#ff8a5c', desc:'更容易打出暴击',             bonus:{ critBonus:0.08 } },
  { id:'pierce', name:'贯穿模块',    cn:'子弹穿透 +1',          color:'#d5ffff', desc:'子弹可额外穿过一个敌人',      bonus:{ pierceBonus:1 } },
  { id:'spread', name:'稳定握把',    cn:'散布 -15%',            color:'#ffd166', desc:'降低武器后坐力散布',         bonus:{ spreadMult:0.15 } },
  { id:'magnet', name:'引力拾取',    cn:'拾取范围 +30%',        color:'#9ae66e', desc:'更远距离自动拾取补给',        bonus:{ magnetMult:0.30 } },
  { id:'vamp',   name:'战地维修',    cn:'击杀回血 +5',          color:'#ff2d55', desc:'每击杀一个敌人恢复生命',      bonus:{ vamp:5 } },
  { id:'ammo',   name:'扩容弹仓',    cn:'弹药上限 +25%',        color:'#b9c6da', desc:'所有武器弹药携带量提升',      bonus:{ ammoMult:0.25 } },
];
const PI = {}; PERKS.forEach((p, i) => { PI[p.id] = i; });

/* ═══ 6.6 商店（跨局永久强化，金币购买，写入存档） ═══════
   cost/grow : 第 n 级价格 = cost + grow * n（n 从 0 起）
   max       : 可叠层数；bonus 与局内强化共用 pval 聚合         */
const SHOP_ITEMS = [
  { id:'hull',   name:'纳米装甲', cn:'开局生命 +20',   color:'#9ae66e', cost:120, grow:40, max:5, bonus:{ hpBonus:20 } },
  { id:'shield', name:'护盾电容', cn:'开局护盾 +15',   color:'#7df9ff', cost:100, grow:35, max:5, bonus:{ shBonus:15 } },
  { id:'core',   name:'超载弹芯', cn:'伤害 +6%',       color:'#ff4d6d', cost:150, grow:50, max:5, bonus:{ dmgMult:0.06 } },
  { id:'vec',    name:'矢量推进', cn:'移速 +5%',       color:'#7df9ff', cost:130, grow:40, max:5, bonus:{ spdMult:0.05 } },
  { id:'mag',    name:'扩容弹仓', cn:'弹药上限 +15%',  color:'#ffe066', cost:110, grow:40, max:5, bonus:{ ammoMult:0.15 } },
  { id:'cell',   name:'快速充能', cn:'护盾回复 +12%',  color:'#3fa9ff', cost:140, grow:45, max:5, bonus:{ shRegenMult:0.12 } },
];
const SI = {}; SHOP_ITEMS.forEach((it, i) => { SI[it.id] = i; });
const GOLD_ICO = '<i class="gold-ico" aria-hidden="true"></i>';

/* ═══ 6.8 成就系统 ═══════════════════════════════════════
   rarity : 0 青铜 / 1 白银 / 2 黄金 / 3 铂金（决定卡片与飘窗配色）
   stat   : 对应 save.ach 中的计数器；sectorClears 为派生值（已通关区域数）
   goal>1 : 进度型成就，墙上显示 x / goal；goal=1 为一次性成就       */
const RARITY = [
  { key:'bronze',   cn:'青铜', color:'#e0913f' },
  { key:'silver',   cn:'白银', color:'#c3cee0' },
  { key:'gold',     cn:'黄金', color:'#ffe066' },
  { key:'platinum', cn:'铂金', color:'#7df9ff' },
];
const ACHIEVEMENTS = [
  { id:'first_blood',   name:'FIRST BLOOD',   cn:'首杀',     desc:'击杀第 1 名敌人',             rarity:0, goal:1,     stat:'kills' },
  { id:'cleaner',       name:'CLEANER',       cn:'清道夫',   desc:'累计击杀 100 名敌人',          rarity:0, goal:100,   stat:'kills' },
  { id:'grinder',       name:'GRINDER',       cn:'绞肉机',   desc:'累计击杀 500 名敌人',          rarity:1, goal:500,   stat:'kills' },
  { id:'apocalypse',    name:'APOCALYPSE',    cn:'天灾',     desc:'累计击杀 2000 名敌人',         rarity:2, goal:2000,  stat:'kills' },
  { id:'sky_supremacy', name:'SKY SUPREMACY', cn:'制空权',   desc:'累计击落 50 架空中单位',       rarity:1, goal:50,    stat:'airKills' },
  { id:'boss_hunter',   name:'BOSS HUNTER',   cn:'猎首者',   desc:'累计击杀 5 个 BOSS',           rarity:1, goal:5,     stat:'bossKills' },
  { id:'boss_slayer',   name:'BOSS SLAYER',   cn:'屠戮者',   desc:'累计击杀 20 个 BOSS',          rarity:2, goal:20,    stat:'bossKills' },
  { id:'combo_master',  name:'COMBO MASTER',  cn:'连杀狂潮', desc:'单局达成 25 连杀',             rarity:1, goal:25,    stat:'bestCombo' },
  { id:'flawless',      name:'FLAWLESS',      cn:'无伤猎杀', desc:'一局内未受任何伤害并击杀 BOSS', rarity:2, goal:1,     stat:'flawlessBoss' },
  { id:'high_score',    name:'HIGH SCORE',    cn:'霓虹之巅', desc:'单局得分达到 50,000',          rarity:2, goal:50000, stat:'bestRun' },
  { id:'expedition',    name:'EXPEDITION',    cn:'远征者',   desc:'通关 3 个区域',                rarity:1, goal:3,     stat:'sectorClears' },
  { id:'iron_hand',     name:'IRON HAND',     cn:'铁手',     desc:'全程只用脉冲枪通关一个区域',    rarity:3, goal:1,     stat:'pistolClear' },
  { id:'ascetic',       name:'ASCETIC',       cn:'苦行',     desc:'不选任何强化通关一个区域',      rarity:3, goal:1,     stat:'noPerkClear' },
  { id:'pacification',  name:'PACIFICATION',  cn:'全境肃清', desc:'通关全部 8 个区域',            rarity:3, goal:8,     stat:'sectorClears' },
];
const ACH_BY_ID = {}; ACHIEVEMENTS.forEach(a => { ACH_BY_ID[a.id] = a; });
/* 存档中需要存在的计数器（旧档补默认值） */
const ACH_STATS = ['kills', 'airKills', 'bossKills', 'bestCombo', 'bestRun',
                   'flawlessBoss', 'pistolClear', 'noPerkClear'];

/* ── 关卡（每关 5 波，第 5 波为 Boss） ── */
const SECTORS = [
  { key:'dock',    n:'01', mod:'标准规则 · 无额外修正',
    mods:{},                                    guns:2, size:0 },
  { key:'foundry', n:'02', mod:'敌人移速 +12%',
    mods:{ spd:1.12 },                          guns:3, size:0 },
  { key:'data',    n:'03', mod:'敌人射速 +18% · 弹药补给 +30%',
    mods:{ rate:0.85, ammo:1.30 },              guns:4, size:1 },
  { key:'frost',   n:'04', mod:'敌人血量 +18% · 护盾回复 −40%',
    mods:{ hp:1.18, shield:0.60 },              guns:5, size:1 },
  { key:'toxic',   n:'05', mod:'敌人数量 +20% · 移速 +8%',
    mods:{ count:1.20, spd:1.08 },              guns:5, size:1 },
  { key:'void',    n:'06', mod:'敌人血量 +25% · 得分 +30%',
    mods:{ hp:1.25, score:1.30 },               guns:5, size:2 },
  { key:'rust',    n:'07', mod:'敌人数量 +25% · 射速 +12%',
    mods:{ count:1.25, rate:0.88 },             guns:5, size:2 },
  { key:'core',    n:'08', mod:'全属性强化 · 最终区域',
    mods:{ hp:1.20, spd:1.15, rate:0.85, count:1.15 }, guns:5, size:2 },
];
const ARENA_SIZES = [
  { w:2600, h:2000, obs:22 },
  { w:2400, h:1850, obs:26 },
  { w:2250, h:1700, obs:30 },
];

/* ═══ 2. 画布 ═══════════════════════════════════════════ */
const canvas = $('game');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
const ARENA = { w: 2600, h: 2000 };
const view = { w: 0, h: 0, dpr: 0 };
const cam = { x: 0, y: 0, shake: 0, sx: 0, sy: 0 };

/* 动态分辨率：CSS 铺满屏幕，backing store 按帧时间爬升/下降。
   超过 ~1920 边长时部分安卓 GPU 会丢掉硬件纹理、改走 CPU。 */
const Q = {
  handheld: false, fx: true, burstK: 1, partMax: 900, hudEvery: 1,
  emaMs: 16.7, cool: 0, warm: 0,
  minDpr: 0.42, maxDpr: 2, maxEdge: 1920, maxPx: Infinity,
};

function isHandheldShell() {
  if (window.Capacitor) return true;
  const ua = navigator.userAgent || '';
  return /Android|HarmonyOS|OpenHarmony|HUAWEI|iPad|iPhone|iPod/i.test(ua);
}

function inView(x, y, pad) {
  pad = pad || 48;
  return x + pad >= cam.x && x - pad <= cam.x + view.w
      && y + pad >= cam.y && y - pad <= cam.y + view.h;
}

function clampDpr(dpr) {
  dpr = Math.max(Q.minDpr, Math.min(Q.maxDpr, dpr));
  if (view.w * dpr > Q.maxEdge) dpr = Q.maxEdge / view.w;
  if (view.h * dpr > Q.maxEdge) dpr = Math.min(dpr, Q.maxEdge / view.h);
  const css = Math.max(1, view.w * view.h);
  if (css * dpr * dpr > Q.maxPx) dpr = Math.sqrt(Q.maxPx / css);
  return Math.max(Q.minDpr, dpr);
}

function applyBacking() {
  const w = Math.max(1, Math.floor(view.w * view.dpr));
  const h = Math.max(1, Math.floor(view.h * view.dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  canvas.style.width = view.w + 'px';
  canvas.style.height = view.h + 'px';
}

function syncQualityFromDpr() {
  const d = view.dpr;
  Q.fx = d >= 0.58;
  Q.burstK = d < 0.55 ? 0.28 : d < 0.85 ? 0.55 : 1;
  Q.partMax = d < 0.55 ? 110 : d < 0.85 ? 260 : 900;
  Q.hudEvery = d < 0.7 ? 3 : d < 1 ? 2 : 1;
  if (document.body) document.body.classList.toggle('lofi', Q.handheld || d < 0.95);
}

function resize() {
  Q.handheld = isHandheldShell() || ('ontouchstart' in window) || (navigator.maxTouchPoints > 1);
  view.w = window.innerWidth;
  view.h = window.innerHeight;
  if (Q.handheld) {
    Q.maxDpr = Math.min(window.devicePixelRatio || 1, 1.25);
    Q.minDpr = 0.42;
    Q.maxPx = 2.4e6;
  } else {
    Q.maxDpr = Math.min(window.devicePixelRatio || 1, 2);
    Q.minDpr = 1;
    Q.maxPx = Infinity;
  }
  const start = Q.handheld ? Math.min(0.72, Q.maxDpr) : Q.maxDpr;
  view.dpr = clampDpr(view.dpr > 0.05 ? view.dpr : start);
  applyBacking();
  syncQualityFromDpr();
}

function adaptCanvas(dt) {
  if (!Q.handheld) return;
  if (Q.warm < 40) { Q.warm++; return; }
  Q.emaMs = Q.emaMs * 0.88 + dt * 1000 * 0.12;
  if (Q.cool > 0) { Q.cool--; syncQualityFromDpr(); return; }
  const slow = Q.emaMs > 21;
  const fast = Q.emaMs < 14.5;
  if (!slow && !fast) { syncQualityFromDpr(); return; }
  const next = clampDpr(view.dpr * (slow ? 0.86 : 1.08));
  if (Math.abs(next - view.dpr) < 0.025) { syncQualityFromDpr(); return; }
  view.dpr = next;
  applyBacking();
  syncQualityFromDpr();
  Q.cool = slow ? 18 : 32;
}

window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { Q.warm = 0; Q.emaMs = 16.7; }
});
resize();

/* ═══ 3. 音效（WebAudio 程序化合成） ════════════════════ */
let muted = false;
const SFX = {
  ac:null, master:null, nb:null,
  init() {
    if (this.ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ac = new AC();
      this.master = this.ac.createGain();
      this.master.gain.value = muted ? 0 : 0.26;
      this.master.connect(this.ac.destination);
      const len = (this.ac.sampleRate * 0.7) | 0;
      this.nb = this.ac.createBuffer(1, len, this.ac.sampleRate);
      const d = this.nb.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ac = null; }
  },
  setMuted(v) {
    muted = v;
    if (this.master) this.master.gain.value = v ? 0 : 0.26;
  },
  resume() { if (this.ac && this.ac.state === 'suspended') this.ac.resume(); },
  tone(f1, f2, dur, type, vol) {
    if (!this.ac || muted) return;
    const t = this.ac.currentTime;
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f2 || f1), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol, freq, q) {
    if (!this.ac || !this.nb || muted) return;
    const t = this.ac.currentTime;
    const s = this.ac.createBufferSource(); s.buffer = this.nb;
    const f = this.ac.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq || 900; f.Q.value = q || 1;
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.02);
  },
  shot(id) {
    if (id === 'pistol')  { this.tone(720, 200, 0.09, 'square', 0.15); this.noise(0.06, 0.07, 1600); }
    else if (id === 'smg'){ this.tone(560, 240, 0.05, 'sawtooth', 0.08); this.noise(0.04, 0.05, 2200); }
    else if (id === 'shotgun'){ this.noise(0.20, 0.22, 700, 0.7); this.tone(180, 60, 0.16, 'square', 0.13); }
    else if (id === 'laser'){ this.tone(1500, 900, 0.06, 'sawtooth', 0.055); }
    else if (id === 'rocket'){ this.tone(300, 90, 0.22, 'sawtooth', 0.17); this.noise(0.18, 0.12, 500); }
  },
  hit(){ this.tone(300,140,0.05,'triangle',0.09); },
  kill(){ this.noise(0.18,0.13,420,0.6); this.tone(220,70,0.16,'square',0.09); },
  boom(){ this.noise(0.45,0.30,260,0.5); this.tone(120,35,0.40,'sawtooth',0.19); },
  hurt(){ this.tone(200,80,0.22,'sawtooth',0.22); this.noise(0.16,0.15,320,0.8); },
  shieldHit(){ this.tone(980,420,0.08,'sine',0.10); this.noise(0.05,0.04,2400,2); },
  shieldBreak(){ this.tone(640,160,0.24,'triangle',0.16); this.noise(0.22,0.14,1800,1.1); },
  dash(){ this.noise(0.16,0.13,2400,2.2); },
  warp(){ this.tone(180,720,0.16,'sine',0.14); this.noise(0.12,0.08,1100,1.6); },
  pickup(){ this.tone(660,1320,0.12,'sine',0.15); },
  wave(){ this.tone(330,660,0.22,'sine',0.15); setTimeout(()=>this.tone(440,880,0.30,'sine',0.13),130); },
  boss(){ this.tone(110,55,0.9,'sawtooth',0.25); this.noise(0.8,0.17,180,0.6); },
  bossIntro(name){
    /* 入场三段：低频轰鸣 + 冲击噪声 + 各 Boss 特征音（按名字哈希频率） */
    this.tone(110,55,0.9,'sawtooth',0.25);
    this.noise(0.8,0.17,180,0.6);
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
    const fHi = 420 + ((h * 17) & 511);            /* 420 ~ 931 */
    const fLo = 220 + ((h * 23) & 255);            /* 220 ~ 475 */
    setTimeout(() => this.tone(fHi, fLo, 0.55, 'triangle', 0.18), 180);
    setTimeout(() => this.noise(0.45, 0.12, 140 + ((h >>> 4) & 191), 0.5), 540);
  },
  die(){ this.tone(420,40,1.0,'sawtooth',0.26); this.noise(0.7,0.24,200,0.5); },
  ui(){ this.tone(880,1320,0.05,'sine',0.09); },
  unlock(){ this.tone(520,1040,0.16,'sine',0.15); setTimeout(()=>this.tone(780,1560,0.26,'sine',0.12),120); },
};

/* ═══ 4. 存档与状态 ═════════════════════════════════════
   localStorage na_save_v2：关卡解锁 / 最高分 / 金币 / 商店层数 / 成就 / 静音 / 辅助瞄准发射
   购买与击杀即时写入，刷新或换端（同浏览器）可接着玩               */
const SAVE_KEY = 'na_save_v2';
function loadSave() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) {}
  const old = +(localStorage.getItem('na_best') || 0);
  if (!s || typeof s !== 'object') s = {};
  const shop = (s.shop && typeof s.shop === 'object') ? s.shop : {};
  SHOP_ITEMS.forEach(it => { if (typeof shop[it.id] !== 'number') shop[it.id] = 0; });
  return {
    unlocked: Math.max(1, Math.min(SECTORS.length, s.unlocked | 0 || 1)),
    best: Math.max(+s.best || 0, old),
    sec: (s.sec && typeof s.sec === 'object') ? s.sec : {},
    muted: !!s.muted,
    autoAim: !!s.autoAim,
    autoFire: !!s.autoFire,
    gold: Math.max(0, s.gold | 0),
    shop,
    ach: (s.ach && typeof s.ach === 'object') ? s.ach : {},
    achGot: (s.achGot && typeof s.achGot === 'object') ? s.achGot : {},
  };
}
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
}
let save = loadSave();
muted = save.muted;
let autoAim = !!save.autoAim;   // 自动瞄准：未手动瞄准时锁定最近敌人
let autoFire = !!save.autoFire; // 自动发射：有目标时持续开火，不必按住
ACH_STATS.forEach(k => { if (typeof save.ach[k] !== 'number') save.ach[k] = 0; });

/* ═══ 4.5 成就运行时 ═════════════════════════════════════
   save.ach     : 跨局累计计数器
   save.achGot  : 已解锁 id -> 时间戳
   runStats     : 本局临时统计，newGame 时重置                    */
let runStats = { dmgTaken:0, comboMax:0, perksTaken:0, bossKills:0, gunsUsed:{} };
function resetRunStats() {
  runStats = { dmgTaken:0, comboMax:0, perksTaken:0, bossKills:0, gunsUsed:{} };
}
/* 当前成就进度值（sectorClears 为派生：已通关的区域数） */
function achProgress(a) {
  if (a.stat === 'sectorClears') return Object.keys(save.sec).length;
  return save.ach[a.stat] | 0;
}
function achCount() { return Object.keys(save.achGot).length; }
/* 累加型：+n 后检查达标 */
function bumpAch(stat, n) {
  save.ach[stat] = (save.ach[stat] | 0) + (n | 0);
  achCheck(stat);
}
/* 取最大型：仅在刷新纪录时写入 */
function bumpMaxAch(stat, v) {
  if (v > (save.ach[stat] | 0)) { save.ach[stat] = v; achCheck(stat); }
}
function achCheck(stat) {
  let got = false;
  for (const a of ACHIEVEMENTS) {
    if (a.stat !== stat || save.achGot[a.id]) continue;
    if (achProgress(a) >= a.goal) { save.achGot[a.id] = Date.now(); achToast(a); got = true; }
  }
  if (got) persist();
}
/* 解锁飘窗（右上角滑入，3.4s 后滑出）
   多成就同时触发（如加载存档）时只保留最多 4 个可见，其余排队 */
const ACH_TOAST_MAX = 4;
function achToast(a) {
  SFX.unlock();
  const box = document.getElementById('achToasts');
  if (!box) return;
  /* 超出上限就先让最老的离场，腾出位置 */
  while (box.children.length >= ACH_TOAST_MAX) box.firstElementChild.remove();
  const R = RARITY[a.rarity];
  const el = document.createElement('div');
  el.className = 'ach-toast';
  el.style.setProperty('--c', R.color);
  el.innerHTML =
    '<div class="ach-badge">★</div>' +
    '<div class="ach-body">' +
      '<div class="ach-kick">成就解锁 · ' + R.cn + '</div>' +
      '<div class="ach-name">' + a.cn + '</div>' +
      '<div class="ach-sub">' + a.name + ' · ' + a.desc + '</div>' +
    '</div>';
  box.appendChild(el);
  setTimeout(() => el.classList.add('out'), 3400);
  setTimeout(() => el.remove(), 4150);
}
/* 分数 / 连杀这类"随局内实时刷新"的计数器，每帧比对成本极低，统一在这里同步 */
let achScoreMark = -1;
function achTick() {
  if (score === achScoreMark) return;
  achScoreMark = score;
  bumpMaxAch('bestRun', score);
  if (runStats.comboMax) bumpMaxAch('bestCombo', runStats.comboMax);
}

let state = 'menu';                     // menu | levels | shop | playing | paused | dead | perks
let enemies = [], eBullets = [], pBullets = [], parts = [], beams = [];
let pickups = [], portals = [], gates = [], texts = [], obstacles = [], decals = [];
let authorMark = { x: 190, y: 180, rot: -0.18 };  /* 地面 Alex 喷漆位置 */
let authorSpr = null, authorSprAccent = '';
let bombs = [];            // 空中单位投下的航弹
let player = null, boss = null;
let wave = 0, score = 0, best = save.best, runGold = 0;
let spawnQueue = [], intermission = 0;
let bossIntro = { active:false, boss:null, t:0 };          // Boss 出场仪式：横幅+屏闪+专属音效
const BOSS_INTRO_DUR = 1.7;
let combo = 0, comboTimer = 0, kills = 0, shotsFired = 0, shotsHit = 0;
let elapsed = 0, hintTimer = 0, flash = 0;
let crateT = 4;            // 局内漂流补给下次生成倒计时
let hitStop = 0;           // 命中停顿剩余帧数
let perks = [];            // 当前局已选强化
let sector = 0, SEC = SECTORS[0], theme = TEX.theme('dock');

/* 移动端虚拟摇杆状态 */
const stick = { active:false, x:0, y:0, id:null, cx:0, cy:0 };
const aimStick = { active:false, x:0, y:0, id:null, cx:0, cy:0 };
const isTouch = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;
let touchMode = false;     // 触屏模式：半自动武器按住连发、隐藏鼠标准星
let touchLock = null;      // 自动瞄准当前锁定的目标（用于画锁定框）
let kbAimFiring = false;   // 方向键瞄准时由 updatePlayer 合成的开火状态，
                           // 方向键释放后用来把 mouse.down 清回去。

/* 强制释放所有虚拟摇杆（切出游戏 / 失焦 / 死亡时调用） */
function releaseSticks() {
  stick.active = false; stick.id = null; stick.x = 0; stick.y = 0;
  aimStick.active = false; aimStick.id = null; aimStick.x = 0; aimStick.y = 0;
  mouse.down = false;
  mouse.drag = false;
  ['stickMove', 'stickAim'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    el.classList.remove('on');
    el.style.cssText = '';
    const k = el.querySelector('.knob'); if (k) k.style.transform = 'translate(0,0)';
  });
}

/* 强化数值聚合：局内强化 + 商店永久层数 */
function pval(key, def) {
  let v = def;
  perks.forEach(p => {
    const b = p.bonus[key];
    if (b !== undefined) v += b * p.stacks;
  });
  SHOP_ITEMS.forEach(it => {
    const n = save.shop[it.id] | 0;
    if (n && it.bonus[key]) v += it.bonus[key] * n;
  });
  return v;
}
function shopStacks(id) { return save.shop[id] | 0; }
function shopPrice(it) { return it.cost + it.grow * shopStacks(it.id); }
function earnGold(n, x, y) {
  n = n | 0;
  if (n <= 0) return;
  save.gold += n;
  runGold += n;
  persist();
  if (x != null) floatText(x, y - 8, '+' + n, '#ffe066', 12, 'gold');
}
function shopBuy(id) {
  const it = SHOP_ITEMS[SI[id]];
  if (!it) return false;
  const n = shopStacks(id);
  if (n >= it.max) { showHint(it.name + ' 已满级'); return false; }
  const price = shopPrice(it);
  if (save.gold < price) { showHint('金币不足 · 还差 ' + (price - save.gold)); return false; }
  save.gold -= price;
  save.shop[id] = n + 1;
  persist();
  SFX.unlock();
  showHint('已购置 ' + it.name + '  Lv.' + (n + 1));
  if (player) {
    refreshPlayerStats();
    player.hp = Math.min(player.hpMax, player.hp);
    player.sh = Math.min(player.shMax, player.sh);
  }
  return true;
}
let floorPat = null, panelPat = null, skyPat = null;
const keys = Object.create(null);
const mouse = { x: 0, y: 0, down: false, drag: false, sx: 0, sy: 0 };

/* 瞄准辅助：atan2(0,0) === 0（朝右），触屏右半屏点按未拖动、或自动瞄准改写
   鼠标坐标后又被真实光标抢回，都会变成横向扫射并来回甩头。 */
const AIM_STICK_MIN2 = 0.0144;  /* 0.12^2，摇杆死区以上才算手动瞄准 */
const AIM_POINTER_MIN2 = 64;    /* 8px^2，零向量不改朝向 */
const AIM_DRAG_MIN = 14;        /* 按住并拖过这段距离才接管自动瞄准 */
function stickHasAim(s) {
  return !!(s && s.active && (s.x * s.x + s.y * s.y) > AIM_STICK_MIN2);
}
function pointerAim(mx, my, px, py, camx, camy) {
  const dx = mx + camx - px, dy = my + camy - py;
  if (dx * dx + dy * dy <= AIM_POINTER_MIN2) return null;
  return Math.atan2(dy, dx);
}
function isManualAim(aimKey, stickAiming, touchMode, mouseDrag) {
  return !!(aimKey || stickAiming || (!touchMode && mouseDrag));
}
function warpExit(from, to, px, py, vx, vy, rShip) {
  const dx = px - from.x, dy = py - from.y;
  const d = Math.hypot(dx, dy) || 1;
  const spd = Math.hypot(vx, vy);
  const ox = spd > 40 ? vx / spd : dx / d;
  const oy = spd > 40 ? vy / spd : dy / d;
  const push = to.r + rShip + 8;
  return { x: to.x + ox * push, y: to.y + oy * push };
}

/* ═══ 5. 竞技场 ═════════════════════════════════════════ */
function applyTheme(key) {
  theme = TEX.theme(key);
  floorPat = ctx.createPattern(TEX.floor(key), 'repeat');
  panelPat = ctx.createPattern(TEX.panel(key), 'repeat');
  skyPat   = ctx.createPattern(TEX.sky(key), 'repeat');
  document.documentElement.style.setProperty('--accent', theme.accent);
}

function buildArena() {
  const sz = ARENA_SIZES[Math.min(SEC.size, ARENA_SIZES.length - 1)];
  ARENA.w = sz.w; ARENA.h = sz.h;

  obstacles = [];
  const cx = ARENA.w / 2, cy = ARENA.h / 2;
  let guard = 0;
  while (obstacles.length < sz.obs && guard++ < 900) {
    const w = rand(80, 230), h = rand(80, 230);
    const x = rand(110, ARENA.w - w - 110), y = rand(110, ARENA.h - h - 110);
    if (dist(x + w / 2, y + h / 2, cx, cy) < 420) continue;
    let ok = true;
    for (const o of obstacles)
      if (x < o.x + o.w + 110 && x + w + 110 > o.x && y < o.y + o.h + 110 && y + h + 110 > o.y) { ok = false; break; }
    if (ok) obstacles.push({ x, y, w, h, seed: Math.random() * 1000 });
  }

  decals = [];
  const kinds = ['scorch', 'grate', 'chevron'];
  for (let i = 0; i < 30; i++) {
    decals.push({
      x: rand(60, ARENA.w - 60), y: rand(60, ARENA.h - 60),
      s: rand(70, 230), rot: rand(0, TAU),
      kind: pick(kinds), a: rand(0.35, 0.9),
    });
  }

  /* 作者喷漆：偏角落的空地，避开出生点视野和场边暗角 */
  const corners = [
    { x: 720, y: ARENA.h - 400, rot: -0.18 },
    { x: ARENA.w - 740, y: ARENA.h - 390, rot: 0.14 },
    { x: 730, y: 380, rot: 0.22 },
    { x: ARENA.w - 750, y: 390, rot: -0.08 },
  ];
  authorMark = corners.find(p => !inObstacle(p.x, p.y, 170)) || corners[0];
  buildGates();
}

/* 任意门：成对传送门，飞入一侧从对侧出来。不占用敌军 spawn 的 portals 数组。 */
function gateSpotOk(x, y, others, minPair) {
  if (inObstacle(x, y, 52)) return false;
  if (dist(x, y, ARENA.w / 2, ARENA.h / 2) < 380) return false;
  for (const g of others) if (dist(x, y, g.x, g.y) < (minPair || 280)) return false;
  return true;
}
function pickGateSpot(others, minPair) {
  for (let i = 0; i < 90; i++) {
    const x = rand(180, ARENA.w - 180), y = rand(180, ARENA.h - 180);
    if (gateSpotOk(x, y, others, minPair)) return { x, y };
  }
  return null;
}
function buildGates() {
  gates = [];
  const pal = ['#ff7eb3', '#7df9ff'];
  const fallback = [
    [{ x: 240, y: 240 }, { x: ARENA.w - 240, y: ARENA.h - 240 }],
    [{ x: ARENA.w - 240, y: 240 }, { x: 240, y: ARENA.h - 240 }],
  ];
  for (let n = 0; n < 2; n++) {
    const a = pickGateSpot(gates, 280) || (gateSpotOk(fallback[n][0].x, fallback[n][0].y, gates, 200) ? fallback[n][0] : null);
    if (!a) continue;
    const need = [{ x: a.x, y: a.y, r: 36 }];
    const b = pickGateSpot(gates.concat(need), 720) ||
      (gateSpotOk(fallback[n][1].x, fallback[n][1].y, gates.concat(need), 480) ? fallback[n][1] : null);
    if (!b) continue;
    const i = gates.length;
    const col = pal[n % pal.length];
    gates.push({ x: a.x, y: a.y, r: 36, pair: i + 1, color: col, t: rand(0, TAU) });
    gates.push({ x: b.x, y: b.y, r: 36, pair: i, color: col, t: rand(0, TAU) });
  }
}

function inObstacle(x, y, pad) {
  return !!hitObstacleIn(obstacles, x, y, pad);
}

function hitObstacleIn(list, x, y, pad) {
  pad = pad || 0;
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    if (x > o.x - pad && x < o.x + o.w + pad && y > o.y - pad && y < o.y + o.h + pad) return o;
  }
  return null;
}

/* 离障碍最近的那条边（或角）的两个可走拐点。点在箱外时路径不穿箱体。 */
function aroundWaypoints(o, x, y, pad) {
  const L = o.x - pad, R = o.x + o.w + pad, T = o.y - pad, B = o.y + o.h + pad;
  const tl = { x: L, y: T }, tr = { x: R, y: T };
  const bl = { x: L, y: B }, br = { x: R, y: B };
  if (x <= L) {
    if (y <= T) return [tr, bl];
    if (y >= B) return [tl, br];
    return [tl, bl];
  }
  if (x >= R) {
    if (y <= T) return [tl, br];
    if (y >= B) return [tr, bl];
    return [tr, br];
  }
  if (y <= T) return [tl, tr];
  if (y >= B) return [bl, br];
  const dl = x - L, dr = R - x, dt = y - T, db = B - y;
  const m = Math.min(dl, dr, dt, db);
  if (m === dl) return [tl, bl];
  if (m === dr) return [tr, br];
  if (m === dt) return [tl, tr];
  return [bl, br];
}

/* 朝向被挡住时改走最近拐点；侧向粘滞，避免在长边上来回翻。 */
function steerAround(e, mvx, mvy, tx, ty, dt, list) {
  const sp = Math.hypot(mvx, mvy);
  if (sp < 0.001) return { x: mvx, y: mvy };
  const ux = mvx / sp, uy = mvy / sp;
  const look = e.r + 26;
  const o = hitObstacleIn(list, e.x + ux * look, e.y + uy * look, e.r + 2)
          || hitObstacleIn(list, e.x, e.y, e.r + 1);
  if (!o) {
    e.wallT = 0;
    e.steerObs = null;
    return { x: mvx, y: mvy };
  }
  e.wallT = (e.wallT || 0) + dt;
  if (e.steerObs !== o) { e.steerSide = 0; e.steerObs = o; }
  const pts = aroundWaypoints(o, e.x, e.y, e.r + 10);
  let best = null, bestCost = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const c = pts[i];
    const dHere = Math.hypot(c.x - e.x, c.y - e.y);
    if (dHere < 6) continue;
    let cost = dHere + Math.hypot(c.x - tx, c.y - ty);
    const side = Math.sign((c.x - e.x) * (ty - e.y) - (c.y - e.y) * (tx - e.x));
    if (e.steerSide && side && side !== e.steerSide) cost += 420;
    if (cost < bestCost) { bestCost = cost; best = c; }
  }
  if (!best) return { x: mvx, y: mvy };
  const dx = best.x - e.x, dy = best.y - e.y;
  const dl = Math.hypot(dx, dy) || 1;
  const cross = dx * (ty - e.y) - dy * (tx - e.x);
  e.steerSide = cross >= 0 ? 1 : -1;
  return { x: dx / dl, y: dy / dl };
}

function resolveObstaclesIn(e, list) {
  let nxSum = 0, nySum = 0, hit = false;
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    const hx = clamp(e.x, o.x, o.x + o.w), hy = clamp(e.y, o.y, o.y + o.h);
    const dx = e.x - hx, dy = e.y - hy, d2 = dx * dx + dy * dy;
    if (d2 >= e.r * e.r) continue;
    hit = true;
    const d = Math.sqrt(d2);
    if (d > 0.001) {
      const px = dx / d, py = dy / d;
      e.x = hx + px * e.r; e.y = hy + py * e.r;
      nxSum += px; nySum += py;
    } else {
      const l = e.x - o.x, rgt = o.x + o.w - e.x, t = e.y - o.y, btm = o.y + o.h - e.y;
      const m = Math.min(l, rgt, t, btm);
      if (m === l) { e.x = o.x - e.r; nxSum -= 1; }
      else if (m === rgt) { e.x = o.x + o.w + e.r; nxSum += 1; }
      else if (m === t) { e.y = o.y - e.r; nySum -= 1; }
      else { e.y = o.y + o.h + e.r; nySum += 1; }
    }
  }
  if (!hit) return;
  const nl = Math.hypot(nxSum, nySum);
  if (nl < 0.001) return;
  const nx = nxSum / nl, ny = nySum / nl;
  const vn = e.vx * nx + e.vy * ny;
  if (vn < 0) { e.vx -= vn * nx; e.vy -= vn * ny; }
}

function resolveObstacles(e) {
  resolveObstaclesIn(e, obstacles);
}

function spawnPos(minFromPlayer) {
  const mfp = minFromPlayer == null ? 520 : minFromPlayer;
  for (let i = 0; i < 90; i++) {
    const x = rand(90, ARENA.w - 90), y = rand(90, ARENA.h - 90);
    if (inObstacle(x, y, 34)) continue;
    if (player && dist(x, y, player.x, player.y) < mfp) continue;
    return { x, y };
  }
  return { x: rand(90, ARENA.w - 90), y: rand(90, ARENA.h - 90) };
}

/* ═══ 6. 实体 ═══════════════════════════════════════════ */
function particle(x, y, vx, vy, life, color, size, drag) {
  if (parts.length > Q.partMax) return;
  parts.push({ x, y, vx, vy, life, max: life, color, size: size || 3,
               drag: drag == null ? 0.90 : drag, ring: false });
}
function burst(x, y, n, color, spd, size, life) {
  n = Math.max(1, Math.round(n * Q.burstK));
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), s = rand(spd * 0.25, spd);
    particle(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(life * 0.5, life), color, size, 0.90);
  }
}
/* 受击团雾：慢速扩散的大光斑，围绕命中点形成一团滞留的雾状烟团 */
function hitFog(x, y, color, r) {
  if (parts.length > Q.partMax - 40) return;
  const n = 6 + Math.min(8, Math.round(r * 0.6));
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), d = rand(0.15, 0.95);
    particle(x + Math.cos(a) * r * d, y + Math.sin(a) * r * d,
             Math.cos(a) * rand(18, 85), Math.sin(a) * rand(18, 85),
             rand(0.30, 0.55), color, rand(2.4, 4.2), 0.84);
  }
}
function floatText(x, y, txt, color, size, type) {
  if (texts.length > 60) return;
  texts.push({ x, y, txt, color, size: size || 14, life: 0.9, max: 0.9,
               vy: -50, vx: rand(-18, 18), type: type || '' });
}
function shake(v) { cam.shake = Math.min(28, cam.shake + v); }

function makePlayer() {
  return {
    x: ARENA.w / 2, y: ARENA.h / 2, r: 15, vx: 0, vy: 0, aim: -Math.PI / 2,
    hp: 100, hpMax: 100, sh: 50, shMax: 50, shRegenT: 0, speed: 305,
    owned: { pistol:true, smg:true, shotgun:false, laser:false, rocket:false },
    ammo: { pistol:Infinity, smg:260, shotgun:0, laser:0, rocket:0 },
    wi: 0, cool: 0, firedPress: false,
    dashT: 0, dashCd: 0, dashDx: 0, dashDy: 0, iframe: 0, gateCd: 0,
    hurtFlash: 0, muzzle: 0, recoil: 0, shPulse: 0, dead: false, touchCd: 0,
  };
}

function ammoMaxFor(w) {
  return w.ammoMax === Infinity ? Infinity : Math.round(w.ammoMax * (1 + pval('ammoMult', 0)));
}

function refreshPlayerStats() {
  const P = player; if (!P) return;
  P.hpMax = Math.round(100 + pval('hpBonus', 0));
  P.shMax = Math.round(50 + pval('shBonus', 0));
  P.hp = Math.min(P.hp, P.hpMax);
  P.sh = Math.min(P.sh, P.shMax);
}

function takePerk(id) {
  const def = PERKS[PI[id]];
  const p = perks.find(x => x.id === id);
  if (p) p.stacks++; else perks.push({ id, stacks:1, bonus:def.bonus });
  runStats.perksTaken++;             /* 「苦行」成就：全程不选强化 */
  refreshPlayerStats();
  const P = player;
  if (P) {
    P.hp = Math.min(P.hpMax, P.hp + 25);
    WEAPONS.forEach(w => {
      if (P.owned[w.id] && w.ammoMax !== Infinity)
        P.ammo[w.id] = Math.min(ammoMaxFor(w), P.ammo[w.id]);
    });
  }
  SFX.ui();
  floatText(P ? P.x : ARENA.w / 2, (P ? P.y : ARENA.h / 2) - 30, '获得 ' + def.name, def.color, 17, 'combo');
}

function makeEnemy(type, x, y, scale) {
  const t = ENEMY_TYPES[type];
  const hp = Math.round(t.hp * scale);
  return { type, t, x, y, r: t.r, vx: 0, vy: 0, hp, hpMax: hp,
           color: t.color, cool: rand(0.3, 1.4), fireT: 0, burstLeft: 0,
           chargeT: 0, hitT: 0, angle: rand(0, TAU),
           strafe: Math.random() < 0.5 ? 1 : -1, strafeT: rand(0.6, 1.8),
           spawnT: 0.35, touchCd: 0, noLosT: 0,
           wallT: 0, steerSide: 0, steerObs: null,
           sprite: t.sprite || type,
           boss: false, dead: false, spin: rand(0, TAU) };
}

function makeBoss(s) {
  const b = BOSSES[s % BOSSES.length];
  const hp = Math.round(b.base * (1 + s * 0.5));
  const p = b.air ? airSpawn(Math.hypot(view.w || 1280, view.h || 720) * 0.5 + 160)
                  : spawnPos(780);
  return { type:'boss', t:b, x:p.x, y:p.y, r:b.r, vx:0, vy:0, hp, hpMax:hp,
           color:b.color, speed:b.speed, cool:1.4, phase:0, pt:2.2, sub:0, subN:0,
           chargeT:0, cx:0, cy:0, hitT:0, angle:0, spawnT:0.8, touchCd:0,
           wallT:0, steerSide:0, steerObs:null,
           boss:true, dead:false, name:b.name, cn:b.cn,
           /* 空中 Boss：补齐 updateAir 用到的全部字段，否则坐标会算成 NaN */
           air: !!b.air, alt: b.alt || 0, sprite: b.sprite || '', mode: b.mode || '',
           spin: b.spin || 0,
           bob: rand(0, TAU), bombCd: rand(1.2, 2.2),
           strafe: Math.random() < 0.5 ? 1 : -1, strafeT: rand(0.9, 2.0),
           state: 'enter', stateT: rand(0.4, 1.0), runA: 0,
           fireT: 0, burstLeft: 0 };
}

/* 在玩家视野外侧挑一个仍在场地内的切入点；场地太小则退而求其次取最深的一处 */
function airSpawn(rad) {
  const cx = player ? player.x : ARENA.w / 2;
  const cy = player ? player.y : ARENA.h / 2;
  const pad = 70;
  let best = { x: cx, y: cy }, bestScore = -Infinity;
  for (let i = 0; i < 12; i++) {
    const a = rand(0, TAU);
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    const s = Math.min(x - pad, ARENA.w - pad - x, y - pad, ARENA.h - pad - y);
    if (s >= 0) return { x, y };
    if (s > bestScore) {
      bestScore = s;
      best = { x: clamp(x, pad, ARENA.w - pad), y: clamp(y, pad, ARENA.h - pad) };
    }
  }
  return best;
}

/* 生成空中单位。从玩家视野边缘外切入：既不会凭空出现在脸上，也不会飞半天才接敌 */
function makeAir(type, scale) {
  const t = AIR_TYPES[type];
  const hp = Math.round(t.hp * scale);
  const rad = Math.hypot(view.w || 1280, view.h || 720) * 0.5 + 120;
  const sp = airSpawn(rad);
  const x = sp.x, y = sp.y;
  return { type, t, x, y, r: t.r, vx: 0, vy: 0, hp, hpMax: hp,
           color: t.color, cool: rand(0.7, 1.8), fireT: 0, burstLeft: 0,
           hitT: 0, angle: rand(0, TAU), alt: t.alt, bob: rand(0, TAU),
           strafe: Math.random() < 0.5 ? 1 : -1, strafeT: rand(0.8, 2.0),
           air: true, boss: false, dead: false, spawnT: 0.55,
           mode: t.mode, state: 'enter', stateT: rand(0.4, 1.0),
           runA: 0, bombCd: rand(1.0, 2.2) };
}

/* ═══ 7. 波次 / 关卡推进 ════════════════════════════════ */
const secWave  = () => wave - sector * 5;          // 本关内第几波（1..5）
const isBossWave = () => secWave() === 5;

function hpScale() {
  return (1 + (secWave() - 1) * 0.10) * (1 + sector * 0.55) * (SEC.mods.hp || 1);
}

function composition() {
  const lw = secWave();
  const pool = ['grunt'];
  if (lw >= 2 || sector >= 1) pool.push('runner');
  if (lw >= 3 || sector >= 1) pool.push('shooter');
  if (lw >= 4 || sector >= 2) pool.push('sniper');
  if (lw >= 5 || sector >= 3) pool.push('tank');
  return pool;
}

/* 进入新关卡（切换区域：换主题、换地图、白闪） */
function enterSector(s) {
  sector = s;
  SEC = SECTORS[Math.min(s, SECTORS.length - 1)];
  applyTheme(SEC.key);
  buildArena();
  /* 清干净所有“带坐标的旧场景状态”，否则换图后会留下上个关卡的残影 */
  enemies = []; eBullets = []; portals = []; pBullets = []; beams = [];
  bombs = []; pickups = []; texts = []; decals = []; parts = [];
  if (player) {
    player.x = ARENA.w / 2; player.y = ARENA.h / 2;
    player.vx = player.vy = 0;
    player.gateCd = 0;
    cam.x = clamp(player.x - view.w / 2, 0, Math.max(0, ARENA.w - view.w));
    cam.y = clamp(player.y - view.h / 2, 0, Math.max(0, ARENA.h - view.h));
  }
  flash = 1;
  banner('SECTOR ' + SEC.n, theme.cn + ' · ' + theme.en, theme.accent);
  SFX.unlock();
}

function startWave() {
  wave++;
  const s = Math.floor((wave - 1) / 5);
  if (s !== sector) enterSector(s);

  const lw = secWave();
  SFX.wave();
  spawnQueue = [];

  if (isBossWave()) {
    spawnQueue.push({ boss:true, delay: 1.2 });
    const adds = 3 + sector;
    for (let i = 0; i < adds; i++)
      spawnQueue.push({ type: pick(['grunt', 'runner']), delay: 3.4 + i * 2.6 });
    const b = BOSSES[sector % BOSSES.length];
    banner('WAVE ' + lw + ' / 5', 'BOSS · ' + b.cn + ' ' + b.name, b.color);
  } else {
    const budget = Math.max(3, Math.round((4 + lw * 2.15 + sector * 1.5) * (SEC.mods.count || 1)));
    const pool = composition();
    let t = 0.6;
    for (let i = 0; i < budget; i++) {
      let type = pick(pool);
      if (sector >= 3 && Math.random() < 0.18) type = pick(['tank', 'sniper']);
      spawnQueue.push({ type, delay: t });
      t += rand(0.42, 1.05);
    }
    /* 空中支援：第 1 波就派 1 架侦查机亮相，之后随关卡与波次递增（Boss 波不叠加） */
    const airPool = ['drone'];
    if (lw >= 3 || sector >= 1) airPool.push('wasp');
    if (lw >= 4 || sector >= 2) airPool.push('gunship');
    const nAir = Math.min(4, lw === 1 ? 1 : Math.floor(lw * 0.75) + (sector >= 1 ? 1 : 0));
    for (let i = 0; i < nAir; i++)
      spawnQueue.push({ air: true, type: pick(airPool), delay: 2.4 + i * rand(2.6, 4.6) });

    banner('WAVE ' + lw + ' / 5',
           '敌军 ' + budget + ' 名' + (nAir ? ' · 空中 ' + nAir + ' 架' : ''),
           theme.accent);
  }
  if (lw === 1 && sector === 0)
    showHint(touchMode
      ? '左半屏移动 · 右半屏瞄准开火 · AIM 自动瞄准 · FIRE 自动发射 · DASH 冲刺'
      : 'WASD 移动 · 方向键瞄准开火 · 右上 AIM/FIRE 辅助开关 · Shift 冲刺 · Q/E 换枪');
}

function pumpSpawns(dt) {
  for (let i = spawnQueue.length - 1; i >= 0; i--) {
    const s = spawnQueue[i];
    s.delay -= dt;
    if (s.delay > 0) continue;
    if (enemies.length > 64) continue;
    spawnQueue.splice(i, 1);
    if (s.boss) {
      spawnBossFromQueue(sector);
    } else if (s.air) {
      /* 空中单位不走传送门：直接从场外飞入 */
      enemies.push(makeAir(s.type, hpScale()));
      SFX.ui();
    } else {
      const p = spawnPos();
      portals.push({ x: p.x, y: p.y, t: 0.62, max: 0.62, r: 30, enemy: s.type, scale: hpScale() });
    }
  }
}

function waveCleared() {
  const bossWave = isBossWave();
  const bonus = Math.round((250 * wave + (bossWave ? 1500 : 0)) * (SEC.mods.score || 1));
  score += bonus;

  if (bossWave) {
    sectorClear();
    intermission = 3.0;
  } else {
    SFX.wave(); banner('WAVE CLEAR', '+' + bonus + ' 分', '#9ae66e');
    earnGold(20 + secWave() * 5, player.x, player.y);
    dropAt(player.x + rand(-90, 90), player.y + rand(-90, 90), 'heal');
    dropAt(player.x + rand(-120, 120), player.y + rand(-120, 120), 'ammo');
    if (secWave() % 2 === 0) dropWeapon();
    boss = null;
    $('bossBar').classList.remove('on');
    /* 普通波清完后进入强化选择 */
    setTimeout(() => offerPerks(), 600);
    intermission = 99; // 选择完成前暂停波次推进
  }
}

function sectorClear() {
  const cleared = sector;
  score += Math.round(3000 * (SEC.mods.score || 1));
  banner('SECTOR CLEAR', theme.cn + ' 已通关 · +3000', '#9ae66e');
  SFX.wave(); setTimeout(() => SFX.unlock(), 260);

  const k = String(cleared);
  if (!save.sec[k] || score > save.sec[k]) { save.sec[k] = score; }
  const next = cleared + 1;
  if (next >= save.unlocked && next < SECTORS.length) {
    save.unlocked = next + 1;
    const nx = SECTORS[next];
    showHint('已解锁 SECTOR ' + nx.n + ' · ' + TEX.theme(nx.key).cn);
  }
  persist();
  earnGold(120, player ? player.x : 0, player ? player.y : 0);

  /* 通关型成就判定 */
  const guns = Object.keys(runStats.gunsUsed);
  if (guns.length === 1 && guns[0] === 'pistol') bumpAch('pistolClear', 1);
  if (runStats.perksTaken === 0) bumpAch('noPerkClear', 1);
  bumpMaxAch('bestRun', score);
  achCheck('sectorClears');
}

let perkChoices = []; // 当前弹出的 3 个强化选项

function offerPerks() {
  if (state !== 'playing') return;
  /* 随机抽取 3 个不重复强化，已拥有的权重降低但仍可出现（可叠加强化） */
  const pool = PERKS.slice().sort(() => Math.random() - 0.5);
  perkChoices = pool.slice(0, 3).map(def => {
    const owned = perks.find(p => p.id === def.id);
    return { def, stacks: (owned ? owned.stacks : 0) + 1 };
  });
  setState('perks');
  showPanel('perks');
}

function pickPerk(idx) {
  if (state !== 'perks' || idx < 0 || idx >= perkChoices.length) return;
  const choice = perkChoices[idx];
  takePerk(choice.def.id);
  setState('playing');
  intermission = 1.0; // 选择后短暂间隔进入下一波
}

function dropWeapon() {
  const locked = WEAPONS.filter(w => !player.owned[w.id]);
  if (!locked.length) { const p = spawnPos(300); dropAt(p.x, p.y, 'shield'); return; }
  const w = pick(locked), p = spawnPos(300);
  pushPickup(p.x, p.y, 'weapon', { r:17, weapon:w.id, color:w.color });
}

function driftVel() {
  const a = rand(0, TAU), spd = rand(26, 58);
  return { vx: Math.cos(a) * spd, vy: Math.sin(a) * spd };
}

function pushPickup(x, y, kind, extra) {
  if (pickups.length >= 12) pickups.shift();
  x = clamp(x, 60, ARENA.w - 60); y = clamp(y, 60, ARENA.h - 60);
  const v = driftVel();
  pickups.push(Object.assign({
    x, y, r: 14, kind, color: PICKUPS[kind] ? PICKUPS[kind].color : '#ffe066',
    t: 0, bob: rand(0, TAU), vx: v.vx, vy: v.vy, life: 18,
  }, extra || {}));
}

function dropAt(x, y, kind) {
  pushPickup(x, y, kind, null);
}

/* 从场地边缘漂进来的福利箱：血包 / 护盾光 / 弹药 */
function spawnDriftCrate() {
  if (pickups.length >= 8) return;
  const kind = Math.random() < 0.40 ? 'heal' : Math.random() < 0.55 ? 'ammo' : 'shield';
  const edge = (Math.random() * 4) | 0;
  let x, y, vx, vy;
  if (edge === 0) { x = 70; y = rand(90, ARENA.h - 90); vx = rand(28, 64); vy = rand(-36, 36); }
  else if (edge === 1) { x = ARENA.w - 70; y = rand(90, ARENA.h - 90); vx = -rand(28, 64); vy = rand(-36, 36); }
  else if (edge === 2) { x = rand(90, ARENA.w - 90); y = 70; vx = rand(-36, 36); vy = rand(28, 64); }
  else { x = rand(90, ARENA.w - 90); y = ARENA.h - 70; vx = rand(-36, 36); vy = -rand(28, 64); }
  if (inObstacle(x, y, 24)) { const p = spawnPos(240); x = p.x; y = p.y; }
  pushPickup(x, y, kind, { vx, vy, life: 22 });
}

/* ═══ 8. 玩家 ═══════════════════════════════════════════ */
function nearestLiveEnemy(p) {
  let best = null, bd = Infinity;
  for (const e of enemies) {
    if (e.dead || e.spawnT > 0) continue;
    const d = (e.x - p.x) * (e.x - p.x) + (e.y - p.y) * (e.y - p.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function anyLiveEnemy() {
  for (const e of enemies) if (!e.dead && e.spawnT <= 0) return true;
  return false;
}
function updatePlayer(dt) {
  const p = player;
  p.cool -= dt; p.dashCd -= dt; p.iframe -= dt; p.hurtFlash -= dt; p.muzzle -= dt;
  p.shPulse -= dt;
  p.recoil = Math.max(0, p.recoil - dt * 4.2);

  /* 方向键瞄准：方向键按下时接管鼠标瞄准并自动开火。
     这是经典的双摇杆键盘布局（左手 WASD 移动、右手 ←↑↓→ 瞄准），
     俯视角无透视问题，玩家贴图按 p.aim 旋转即可直接看出朝向。
     没有鼠标时也能玩；松开方向键后回到鼠标瞄准模式。 */
  const _ak = keys;
  let aimKey = _ak['arrowleft'] || _ak['arrowright'] || _ak['arrowup'] || _ak['arrowdown'];

  /* 自动瞄准：未手动接管时锁定最近敌人。
     手动接管：方向键 / 触屏瞄准摇杆已拖出死区 / 桌面按住并拖动鼠标。
     单击开火或右半屏点按不抢走瞄准，也不改写 mouse（避免准星和朝向来回甩）。 */
  const stickAiming = stickHasAim(aimStick);
  const manualAim = isManualAim(aimKey, stickAiming, touchMode, mouse.drag);
  touchLock = null;
  if (autoAim && !manualAim) {
    const best = nearestLiveEnemy(p);
    if (best) {
      p.aim = Math.atan2(best.y - p.y, best.x - p.x);
      touchLock = best;
    }
  }

  if (aimKey) {
    let ax = 0, ay = 0;
    if (_ak['arrowleft'])  ax -= 1;
    if (_ak['arrowright']) ax += 1;
    if (_ak['arrowup'])    ay -= 1;
    if (_ak['arrowdown'])  ay += 1;
    p.aim = Math.atan2(ay, ax);
    /* 让原生准星画在玩家前方的虚拟位置 — 给玩家一个「子弹会往哪飞」的视觉锚点 */
    const KB_AIM_DIST = 220;
    mouse.x = p.x - cam.x + Math.cos(p.aim) * KB_AIM_DIST;
    mouse.y = p.y - cam.y + Math.sin(p.aim) * KB_AIM_DIST;
    if (!mouse.down) kbAimFiring = true;       /* 仅首次接管时记录 */
    mouse.down = true;                          /* 自动开火 */
  } else if (stickAiming) {
    p.aim = Math.atan2(aimStick.y, aimStick.x);
  } else if (!touchLock) {
    const a = pointerAim(mouse.x, mouse.y, p.x, p.y, cam.x, cam.y);
    if (a != null) p.aim = a;
    if (kbAimFiring) { mouse.down = false; kbAimFiring = false; }
  } else if (kbAimFiring) {
    mouse.down = false; kbAimFiring = false;
  }

  let mx = 0, my = 0, ml = 0;
  if (stick.active) { mx = stick.x; my = stick.y; }
  else {
    /* 移动以 WASD 为主；方向键仅在未被当作瞄准键时才能移动，
       保证「左手走位 + 右手方向键瞄准」时两者互不干扰 */
    if (keys['w']) my -= 1;
    if (keys['s']) my += 1;
    if (keys['a']) mx -= 1;
    if (keys['d']) mx += 1;
    if (!aimKey) {
      if (keys['arrowup'])    my -= 1;
      if (keys['arrowdown'])  my += 1;
      if (keys['arrowleft'])  mx -= 1;
      if (keys['arrowright']) mx += 1;
    }
    ml = Math.hypot(mx, my);
    if (ml > 0) { mx /= ml; my /= ml; }
  }
  if (stick.active) ml = Math.hypot(mx, my);

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.dashDx * 1180; p.vy = p.dashDy * 1180;
    if (Math.random() < 0.9) particle(p.x, p.y, rand(-40, 40), rand(-40, 40), 0.32, '#c77dff', 3.4, 0.86);
  } else {
    const k = 1 - Math.pow(0.0009, dt);
    const spd = p.speed * (1 + pval('spdMult', 0));
    p.vx = lerp(p.vx, mx * spd, k);
    p.vy = lerp(p.vy, my * spd, k);
  }
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.x = clamp(p.x, p.r, ARENA.w - p.r);
  p.y = clamp(p.y, p.r, ARENA.h - p.r);
  resolveObstacles(p);
  tryWarp(p, dt);

  /* 引擎尾焰 */
  if (Math.hypot(p.vx, p.vy) > 40 && Math.random() < 0.55) {
    const a = Math.atan2(-p.vy, -p.vx) + rand(-0.3, 0.3);
    particle(p.x + Math.cos(a) * 12, p.y + Math.sin(a) * 12,
             p.vx * -0.25 + rand(-30, 30), p.vy * -0.25 + rand(-30, 30),
             0.24, theme.accent, 2.4, 0.88);
  }

  if ((keys['shift'] || keys[' ']) && p.dashCd <= 0 && p.dashT <= 0) {
    let dx = mx, dy = my;
    if (ml === 0) { dx = Math.cos(p.aim); dy = Math.sin(p.aim); }
    p.dashDx = dx; p.dashDy = dy;
    p.dashT = 0.17; p.dashCd = 1.15 * (1 - pval('dashMult', 0)); p.iframe = 0.26;
    SFX.dash(); shake(3);
  }

  const w = WEAPONS[p.wi];
  let wantFire = false;
  /* 自动发射：有目标时持续开火。与自动瞄准独立——
     只开瞄准要对准但不扣扳机；只开发射朝当前朝向扫射。
     两者都开 = 旧 AUTO（锁最近敌人并连发，空场停火）。 */
  const assistFire = autoFire && (autoAim ? !!(touchLock && !touchLock.dead) : anyLiveEnemy());
  const holdFire = mouse.down || assistFire;
  /* 触屏 / 方向键 / 自动发射：按住 = 持续开火（仍受武器自身射速 / 弹药限制）。
     这样半自动武器（脉冲枪、霰弹）也能在辅助或键盘下连发。 */
  if (w.auto || touchMode || aimKey || autoFire) wantFire = holdFire;
  else { if (holdFire && !p.firedPress) wantFire = true; }
  if (holdFire) p.firedPress = true; else p.firedPress = false;
  if (wantFire && p.cool <= 0 && p.ammo[w.id] > 0) fire(w);

  p.shRegenT -= dt;
  if (p.shRegenT <= 0 && p.sh < p.shMax) {
    const was = p.sh;
    p.sh = Math.min(p.shMax, p.sh + 14 * (1 + pval('shRegenMult', 0)) * (SEC.mods.shield || 1) * dt);
    if (was <= 0.5 && p.sh > 0.5) p.shPulse = 0.18;
  }

  const magnet = 1 + pval('magnetMult', 0);
  for (let i = pickups.length - 1; i >= 0; i--) {
    const u = pickups[i];
    u.t += dt;
    u.life -= dt;
    u.x += (u.vx || 0) * dt;
    u.y += (u.vy || 0) * dt;
    u.vx = (u.vx || 0) + rand(-18, 18) * dt;
    u.vy = (u.vy || 0) + rand(-18, 18) * dt;
    const spd = Math.hypot(u.vx, u.vy);
    if (spd > 72) { u.vx *= 72 / spd; u.vy *= 72 / spd; }
    if (u.x < 50 || u.x > ARENA.w - 50) { u.vx *= -1; u.x = clamp(u.x, 50, ARENA.w - 50); }
    if (u.y < 50 || u.y > ARENA.h - 50) { u.vy *= -1; u.y = clamp(u.y, 50, ARENA.h - 50); }
    if (inObstacle(u.x, u.y, u.r + 6)) {
      u.vx *= -1; u.vy *= -1;
      u.x = clamp(u.x + u.vx * dt, 50, ARENA.w - 50);
      u.y = clamp(u.y + u.vy * dt, 50, ARENA.h - 50);
    }
    if (u.life <= 0) {
      burst(u.x, u.y, 8, u.color, 140, 2.4, 0.28);
      pickups.splice(i, 1);
      continue;
    }
    if (dist(u.x, u.y, p.x, p.y) < (u.r + p.r) * magnet) { take(u); pickups.splice(i, 1); }
  }
}

function tryWarp(p, dt) {
  if (p.gateCd > 0) p.gateCd -= dt;
  if (p.dead || p.gateCd > 0) return;
  for (const g of gates) {
    if (dist(p.x, p.y, g.x, g.y) >= g.r + p.r * 0.25) continue;
    const other = gates[g.pair];
    if (!other) continue;
    const out = warpExit(g, other, p.x, p.y, p.vx, p.vy, p.r);
    burst(g.x, g.y, 16, g.color, 280, 3.2, 0.32);
    burst(other.x, other.y, 16, other.color, 280, 3.2, 0.32);
    p.x = clamp(out.x, p.r, ARENA.w - p.r);
    p.y = clamp(out.y, p.r, ARENA.h - p.r);
    if (inObstacle(p.x, p.y, p.r + 4)) {
      let placed = false;
      for (let i = 0; i < 8 && !placed; i++) {
        const a = (i / 8) * TAU;
        const nx = other.x + Math.cos(a) * (other.r + p.r + 16);
        const ny = other.y + Math.sin(a) * (other.r + p.r + 16);
        if (!inObstacle(nx, ny, p.r + 4)) {
          p.x = clamp(nx, p.r, ARENA.w - p.r);
          p.y = clamp(ny, p.r, ARENA.h - p.r);
          placed = true;
        }
      }
    }
    resolveObstacles(p);
    p.gateCd = 0.55;
    p.iframe = Math.max(p.iframe, 0.16);
    SFX.warp();
    shake(5);
    floatText(other.x, other.y - 18, '任意门', g.color, 14);
    break;
  }
}

function fire(w) {
  const p = player;
  const rateMul = 1 - pval('rateMult', 0);
  const spreadMul = 1 - pval('spreadMult', 0);
  p.cool = w.rate * rateMul;
  if (p.ammo[w.id] !== Infinity) p.ammo[w.id]--;
  p.muzzle = 0.06;
  p.recoil = Math.min(1.0, p.recoil + w.recoil * 0.14);
  p.vx -= Math.cos(p.aim) * w.recoil * 12;
  p.vy -= Math.sin(p.aim) * w.recoil * 12;
  SFX.shot(w.id);
  shake(w.id === 'rocket' ? 5 : w.id === 'shotgun' ? 4 : 1.1);
  shotsFired++;
  runStats.gunsUsed[w.id] = 1;       /* 「铁手」成就：整局只用一把枪 */

  if (w.beam) { fireBeam(w, p); return; }

  const dmgMul = 1 + pval('dmgMult', 0);
  const pierceAdd = pval('pierceBonus', 0);
  for (let i = 0; i < w.count; i++) {
    const ang = p.aim + rand(-w.spread * spreadMul, w.spread * spreadMul) +
      (w.count > 1 ? (i / (w.count - 1) - 0.5) * w.spread * spreadMul * 1.4 : 0);
    pBullets.push({
      x: p.x + Math.cos(p.aim) * 20, y: p.y + Math.sin(p.aim) * 20,
      vx: Math.cos(ang) * w.speed, vy: Math.sin(ang) * w.speed,
      r: w.r, dmg: Math.round(w.dmg * dmgMul), life: w.life,
      pierce: w.pierce + pierceAdd, hitIds: null,
      color: w.color, knock: w.knock, explode: w.explode || null,
    });
  }
  const n = w.count > 1 ? 10 : 4;
  for (let i = 0; i < n; i++) {
    const a = p.aim + rand(-0.4, 0.4);
    particle(p.x + Math.cos(p.aim) * 22, p.y + Math.sin(p.aim) * 22,
             Math.cos(a) * rand(90, 300), Math.sin(a) * rand(90, 300), 0.18, w.color, 2.6, 0.85);
  }
}

function fireBeam(w, p) {
  const maxLen = 1500;
  let len = maxLen;
  for (let t = 14; t < maxLen; t += 7) {
    const px = p.x + Math.cos(p.aim) * t, py = p.y + Math.sin(p.aim) * t;
    if (px < 0 || py < 0 || px > ARENA.w || py > ARENA.h) { len = t; break; }
    if (inObstacle(px, py)) { len = t; break; }
  }
  const x2 = p.x + Math.cos(p.aim) * len, y2 = p.y + Math.sin(p.aim) * len;
  beams.push({ x1: p.x + Math.cos(p.aim) * 18, y1: p.y + Math.sin(p.aim) * 18,
               x2, y2, life: 0.09, max: 0.09, color: w.color });
  burst(x2, y2, 5, w.color, 160, 2.4, 0.22);
  const vx = x2 - p.x, vy = y2 - p.y, L2 = vx * vx + vy * vy;
  for (const e of enemies) {
    if (e.dead || e.spawnT > 0) continue;
    const t = L2 ? clamp(((e.x - p.x) * vx + (e.y - p.y) * vy) / L2, 0, 1) : 0;
    if (dist(p.x + vx * t, p.y + vy * t, e.x, e.y) < e.r + 12) damageEnemy(e, w.dmg, p.aim, 8, false);
  }
}

function switchWeapon(i) {
  if (i < 0 || i >= WEAPONS.length) return;
  const w = WEAPONS[i];
  if (!player.owned[w.id]) { showHint('尚未获得：' + w.name); return; }
  if (player.ammo[w.id] <= 0) { showHint(w.name + ' 弹药耗尽'); return; }
  if (player.wi !== i) SFX.ui();
  player.wi = i;
  player.cool = Math.max(player.cool, 0.12);
}

/* 循环切换武器：dir=1 下一把、-1 上一把，跳过未拥有 / 无弹药的槽位。
   桌面 Q/E、触屏 ◀▶ 按钮、滚轮都走这里，行为完全一致。 */
function cycleWeapon(dir) {
  if (state !== 'playing' || !player) return;
  let i = player.wi;
  for (let n = 0; n < WEAPONS.length; n++) {
    i = (i + dir + WEAPONS.length) % WEAPONS.length;
    if (player.owned[WEAPONS[i].id] && player.ammo[WEAPONS[i].id] > 0) break;
  }
  switchWeapon(i);
}

/* 跳过强化：+200 分直接进下一波（桌面 S 键 / 触屏跳过按钮共用） */
function skipPerk() {
  if (state !== 'perks') return;
  SFX.ui(); score += 200; setState('playing'); intermission = 1.0;
}

function take(u) {
  SFX.pickup();
  if (u.kind === 'heal') { player.hp = Math.min(player.hpMax, player.hp + 30); floatText(u.x, u.y, '+30 HP', '#9ae66e', 16); }
  else if (u.kind === 'shield') {
    player.sh = player.shMax;
    player.shPulse = 0.22;
    floatText(u.x, u.y, '护盾充能', '#eef7ff', 16);
  }
  else if (u.kind === 'ammo') {
    const m = SEC.mods.ammo || 1;
    for (const w of WEAPONS)
      if (player.owned[w.id] && w.ammoMax !== Infinity) {
        const cap = ammoMaxFor(w);
        player.ammo[w.id] = Math.min(cap, player.ammo[w.id] + Math.ceil(cap * 0.45 * m));
      }
    floatText(u.x, u.y, '弹药补给', '#ffe066', 16);
  } else if (u.kind === 'weapon') {
    player.owned[u.weapon] = true;
    const w = WEAPONS[WI[u.weapon]];
    player.ammo[u.weapon] = ammoMaxFor(w);
    player.wi = WI[u.weapon];
    floatText(u.x, u.y, '获得 ' + w.name, w.color, 19);
    showHint('新武器：' + w.name + (touchMode ? ' — 点底部武器条切换' : ' — 按 ' + w.key + ' 切换'));
  }
  burst(u.x, u.y, 16, u.color, 240, 3, 0.4);
}

/* 护盾在层上时吃掉全部伤害；扣到 0 的那一下只碎泡、不穿船体。
   默认 50 点：游荡者 11 伤 5 下、射手 9 伤 6 下、狙击 27 伤 2 下。 */
function absorbShield(sh, dmg) {
  if (!(dmg > 0)) return { sh: Math.max(0, sh), hull: 0, hit: false, broken: false };
  if (!(sh > 0)) return { sh: 0, hull: dmg, hit: false, broken: false };
  const next = Math.max(0, sh - dmg);
  return { sh: next, hull: 0, hit: true, broken: next <= 0 };
}

function popShield(p) {
  floatText(p.x, p.y - 30, '护盾击破', '#eef7ff', 16);
  if (parts.length <= Q.partMax)
    parts.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.34, max: 0.34,
                 color: '#eef7ff', size: p.r + 22, drag: 1, ring: true });
  burst(p.x, p.y, 24, '#f4fbff', 420, 2.1, 0.36);
  burst(p.x, p.y, 10, '#d4ecff', 240, 3.0, 0.28);
  SFX.shieldBreak();
  shake(7);
}

function hurtPlayer(dmg, fx, fy) {
  const p = player;
  if (p.iframe > 0 || p.dead) return;
  runStats.dmgTaken += dmg;          /* 无伤成就判定：护盾吃下的伤害也算受伤 */
  const abs = absorbShield(p.sh, dmg);
  p.sh = abs.sh;
  p.shRegenT = 5.0;
  combo = 0; comboTimer = 0;
  const a = Math.atan2(p.y - fy, p.x - fx);
  if (abs.hit) {
    p.shPulse = 0.22;
    burst(p.x, p.y, 8, '#e8f4ff', 200, 2.2, 0.24);
  }
  if (abs.broken) popShield(p);
  if (abs.hull <= 0) {
    p.iframe = 0.18;
    p.vx += Math.cos(a) * 90; p.vy += Math.sin(a) * 90;
    if (!abs.broken) SFX.shieldHit();
    shake(4); hitStop = Math.max(hitStop, 2);
    return;
  }
  p.hp -= abs.hull;
  p.iframe = 0.42; p.hurtFlash = 0.3;
  SFX.hurt(); shake(9); hitStop = Math.max(hitStop, 3);
  p.vx += Math.cos(a) * 190; p.vy += Math.sin(a) * 190;
  burst(p.x, p.y, 14, '#ff4d6d', 300, 3, 0.35);
  hitFog(p.x, p.y, '#ffe8f4', p.r * 1.55);
  if (p.hp <= 0) killPlayer();
}

function killPlayer() {
  player.hp = 0; player.dead = true;
  hitStop = Math.max(hitStop, 12);
  burst(player.x, player.y, 70, '#ff4d6d', 620, 4.5, 0.9);
  burst(player.x, player.y, 40, '#ffe066', 420, 3.5, 0.7);
  shake(26); SFX.die();
  setTimeout(() => { if (state === 'playing') gameOver(); }, 900);
}

/* ═══ 9. 敌人 AI ════════════════════════════════════════ */

/* Boss 出场（队列触发与调试 NA.spawnBoss 共用）：
   - 创建 boss 对象
   - 推入敌人池与传送门特效
   - 播放 Boss SFX + Boss 出场专属音（按名字哈希出不同特征音）
   - 加重屏震 + 触发 bossIntro 仪式横幅 */
function spawnBossFromQueue(sectorIdx) {
  boss = makeBoss(sectorIdx);
  enemies.push(boss);
  portals.push({ x: boss.x, y: boss.y, t: 0.8, max: 0.8, r: boss.r, boss: true });
  SFX.boss();
  SFX.bossIntro(boss.name);
  shake(22);
  bossIntro = { active: true, boss, t: 0 };
  showHint('BOSS：' + boss.name + ' / ' + boss.cn);
  return boss;
}

function updateEnemies(dt) {
  const p = player;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dead) { enemies.splice(i, 1); continue; }
    if (e.spawnT > 0) { e.spawnT -= dt; continue; }
    e.hitT -= dt; e.cool -= dt;

    const d = dist(e.x, e.y, p.x, p.y);
    const toA = Math.atan2(p.y - e.y, p.x - e.x);
    e.angle = angLerp(e.angle, toA, 1 - Math.pow(0.002, dt));

    if (e.air) { updateAir(e, dt, d, toA); continue; }   // 含空中 Boss
    if (e.boss) { updateBoss(e, dt, d, toA); continue; }

    const t = e.t;

    /* 视线检测：长期打不到玩家就放弃风筝、直接逼近，避免卡地形僵持 */
    let blocked = false;
    const seg = 26, nseg = Math.min(48, Math.ceil(d / seg));
    for (let i = 1; i < nseg; i++) {
      if (inObstacle(e.x + Math.cos(toA) * i * seg, e.y + Math.sin(toA) * i * seg, 2)) { blocked = true; break; }
    }
    e.noLosT = blocked ? e.noLosT + dt : 0;
    const chase = e.noLosT > 2.2;

    let mvx = 0, mvy = 0;
    if (chase) { mvx = Math.cos(toA); mvy = Math.sin(toA); }
    else if (t.prefer > 0) {
      e.strafeT -= dt;
      if (e.strafeT <= 0) { e.strafe = -e.strafe; e.strafeT = rand(0.7, 2.0); }
      const along = d > t.prefer + 40 ? 1 : d < t.prefer - 60 ? -1 : 0;
      mvx = Math.cos(toA) * along - Math.sin(toA) * 0.75 * e.strafe;
      mvy = Math.sin(toA) * along + Math.cos(toA) * 0.75 * e.strafe;
    } else { mvx = Math.cos(toA); mvy = Math.sin(toA); }

    const steered = steerAround(e, mvx, mvy, p.x, p.y, dt, obstacles);
    mvx = steered.x; mvy = steered.y;

    const sp = t.speed * (SEC.mods.spd || 1) * (e.type === 'runner' && d < 260 ? 1.25 : 1);
    const k = 1 - Math.pow(0.004, dt);
    e.vx = lerp(e.vx, mvx * sp, k);
    e.vy = lerp(e.vy, mvy * sp, k);
    e.x += e.vx * dt; e.y += e.vy * dt;
    e.x = clamp(e.x, e.r, ARENA.w - e.r);
    e.y = clamp(e.y, e.r, ARENA.h - e.r);

    if (t.fireRate > 0) {
      const fr = t.fireRate * (SEC.mods.rate || 1);
      e.fireT -= dt;
      if (t.charge) {
        if (e.cool <= 0 && d < 1200) {
          e.chargeT += dt;
          if (e.chargeT >= t.charge) {
            e.chargeT = 0; e.cool = fr;
            shootAt(e, toA, t.bSpeed, t.dmg, t.color, 4);
          }
        } else e.chargeT = Math.max(0, e.chargeT - dt);
      } else {
        if (e.cool <= 0 && d < 900 && e.burstLeft <= 0) { e.burstLeft = t.burst || 1; e.fireT = 0.11; }
        if (e.burstLeft > 0 && e.fireT <= 0) {
          e.burstLeft--;
          e.fireT = 0.11;
          if (e.burstLeft === 0) e.cool = fr;
          const sp2 = t.spread || 0.18;
          shootAt(e, toA + rand(-sp2, sp2), t.bSpeed, t.dmg, t.color, 4);
        }
      }
    }

    if (e.touchCd > 0) e.touchCd -= dt;
    if (t.contact && d < e.r + p.r + 2 && e.touchCd <= 0) {
      hurtPlayer(t.dmg, e.x, e.y); e.touchCd = 0.75;
    }
  }

  for (let i = 0; i < enemies.length; i++) {
    const a = enemies[i]; if (a.spawnT > 0) continue;
    for (let j = i + 1; j < enemies.length; j++) {
      const b = enemies[j]; if (b.spawnT > 0) continue;
      if (a.air !== b.air) continue;          // 空中与地面单位互不挤压
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
      if (d > 0.01 && d < min) {
        const push = (min - d) * 0.5;
        const ux = dx / d, uy = dy / d;
        if (!a.boss) { a.x -= ux * push; a.y -= uy * push; }
        if (!b.boss) { b.x += ux * push; b.y += uy * push; }
      }
    }
  }
  for (const e of enemies) if (!e.boss && !e.air) resolveObstacles(e);  // 飞行单位越过障碍
}

/* ═══ 8.5 空中单位 AI ════════════════════════════════════
   三种行为：
     orbit  — 保持距离绕玩家盘旋并点射
     strafe — 俯冲掠袭：接近后锁定方向全速穿过并扫射，再拉起脱离
     bomb   — 巡航投弹：绕行并定期投下带落点预警的航弹
   共性：不受障碍物阻挡、可越出赛场边缘后自动修正回场。
   ──────────────────────────────────────────────────────── */
function updateAir(e, dt, d, toA) {
  const p = player, t = e.t;
  /* 兜底：任何字段缺失导致坐标变成 NaN 时，宁可让它坠落消失，也不要变成打不到的幽灵 */
  if (!isFinite(e.x) || !isFinite(e.y) || !isFinite(e.vx) || !isFinite(e.vy)) {
    e.dead = true; burst(e.x || 0, e.y || 0, 10, e.color, 200, 2, 0.3); return;
  }
  e.bob += dt * 1.9;

  let mvx = 0, mvy = 0;
  const want = t.prefer || 240;

  if (t.mode === 'strafe') {
    e.stateT -= dt;
    if (e.state === 'enter') {
      mvx = Math.cos(toA); mvy = Math.sin(toA);
      if (d < 540 || e.stateT <= 0) { e.state = 'run'; e.stateT = 1.2; e.runA = toA; }
    } else if (e.state === 'run') {
      mvx = Math.cos(e.runA); mvy = Math.sin(e.runA);
      if (e.stateT <= 0) { e.state = 'exit'; e.stateT = 1.0; }
    } else {
      mvx = Math.cos(e.runA); mvy = Math.sin(e.runA);
      if (e.stateT <= 0) { e.state = 'enter'; e.stateT = rand(0.3, 0.9); }
    }
    e.angle = angLerp(e.angle, Math.atan2(mvy, mvx), 1 - Math.pow(0.0008, dt));
  } else {
    /* orbit / bomb：保持中距离绕圈 */
    e.state = t.mode === 'bomb' ? 'bomb' : 'orbit';
    e.strafeT -= dt;
    if (e.strafeT <= 0) { e.strafe = -e.strafe; e.strafeT = rand(0.9, 2.2); }
    const along = d > want + 70 ? 1 : d < want - 70 ? -1 : 0;
    mvx = Math.cos(toA) * along - Math.sin(toA) * 0.85 * e.strafe;
    mvy = Math.sin(toA) * along + Math.cos(toA) * 0.85 * e.strafe;
    e.angle = angLerp(e.angle, Math.atan2(mvy, mvx), 1 - Math.pow(0.004, dt));
  }

  /* 软边界：靠近边缘时向内修正，避免飞出场外不回来 */
  const m = 200;
  if (e.x < m)                 mvx += (m - e.x) / m * 1.7;
  if (e.x > ARENA.w - m)       mvx -= (e.x - (ARENA.w - m)) / m * 1.7;
  if (e.y < m)                 mvy += (m - e.y) / m * 1.7;
  if (e.y > ARENA.h - m)       mvy -= (e.y - (ARENA.h - m)) / m * 1.7;

  const ml = Math.hypot(mvx, mvy);
  if (ml > 0.001) { mvx /= ml; mvy /= ml; }

  const rush = (t.mode === 'strafe' && e.state === 'run') ? 1.6 : 1;
  const sp = t.speed * (SEC.mods.spd || 1) * rush;
  const k = 1 - Math.pow(0.02, dt);
  e.vx = lerp(e.vx, mvx * sp, k);
  e.vy = lerp(e.vy, mvy * sp, k);
  e.x += e.vx * dt; e.y += e.vy * dt;
  e.x = clamp(e.x, -280, ARENA.w + 280);
  e.y = clamp(e.y, -280, ARENA.h + 280);

  /* 引擎尾迹（画在机体后方，制造速度感） */
  if (Math.random() < 0.6) {
    particle(e.x - Math.cos(e.angle) * e.r * 0.85,
             e.y - Math.sin(e.angle) * e.r * 0.85,
             -e.vx * 0.14 + rand(-22, 22), -e.vy * 0.14 + rand(-22, 22),
             0.32, t.color, 2.2, 0.9);
  }

  /* 机炮点射 */
  if (t.bSpeed > 0 && d < 780) {
    const fr = t.fireRate * (SEC.mods.rate || 1);
    e.fireT -= dt;
    if (e.cool <= 0 && e.burstLeft <= 0) { e.burstLeft = t.burst || 1; e.fireT = 0.08; }
    if (e.burstLeft > 0 && e.fireT <= 0) {
      e.burstLeft--; e.fireT = 0.08;
      if (e.burstLeft === 0) e.cool = fr;
      shootAt(e, toA + rand(-t.spread, t.spread), t.bSpeed, t.dmg, t.color, 4);
    }
  }

  /* 投弹：炮艇不必贴脸，进入投弹圈就压着玩家落点砸 */
  if (t.mode === 'bomb') {
    e.bombCd -= dt;
    if (e.bombCd <= 0 && d < 1200) {
      e.bombCd = t.bombCd * (SEC.mods.rate || 1);
      dropBomb(e, p);
    }
  }

  /* 空中 Boss：额外环形弹幕 */
  if (e.boss) {
    e.pt -= dt;
    if (e.pt <= 0) {
      e.pt = 2.1;
      const n = 14, off = rand(0, TAU);
      for (let i = 0; i < n; i++) shootAt(e, off + i * TAU / n, 320, 13, e.color, 5);
    }
  }
}

/* ── 航弹：从投弹点飞向预测落点，落地爆炸 ── */
function dropBomb(e, p) {
  const lead = 0.55;
  const tx = clamp(p.x + p.vx * lead, 24, ARENA.w - 24);
  const ty = clamp(p.y + p.vy * lead, 24, ARENA.h - 24);
  const dist2 = dist(e.x, e.y, tx, ty);
  bombs.push({
    x: e.x, y: e.y, sx: e.x, sy: e.y, tx, ty, t: 0,
    dur: Math.max(0.62, dist2 / 580),
    dmg: e.t.dmg || 28, radius: e.t.bombR || 130, color: e.t.color || e.color,
  });
}

function updateBombs(dt) {
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i];
    b.t += dt;
    const k = Math.min(1, b.t / b.dur);
    b.x = lerp(b.sx, b.tx, k);
    b.y = lerp(b.sy, b.ty, k);
    if (k >= 1) {
      bombs.splice(i, 1);
      explode(b.tx, b.ty, b.dmg, b.radius, b.color);
    }
  }
}

function shootAt(e, a, speed, dmg, color, r) {
  eBullets.push({
    x: e.x + Math.cos(a) * (e.r + 4), y: e.y + Math.sin(a) * (e.r + 4),
    vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
    r: r || 4, dmg, life: 3.4, color: color || e.color,
  });
  SFX.tone(340, 150, 0.06, 'triangle', 0.045);
}

function updateBoss(b, dt, d, toA) {
  const p = player;
  b.pt -= dt;
  if (b.touchCd > 0) b.touchCd -= dt;

  if (b.phase === 0) {
    const along = d > 330 ? 1 : d < 220 ? -1 : 0;
    let mvx = Math.cos(toA) * along - Math.sin(toA) * 0.8;
    let mvy = Math.sin(toA) * along + Math.cos(toA) * 0.8;
    const steered = steerAround(b, mvx, mvy, p.x, p.y, dt, obstacles);
    mvx = steered.x; mvy = steered.y;
    const k = 1 - Math.pow(0.01, dt);
    b.vx = lerp(b.vx, mvx * b.speed, k);
    b.vy = lerp(b.vy, mvy * b.speed, k);
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.cool -= dt;
    if (b.cool <= 0) {
      b.cool = 0.3;
      for (let i = 0; i < 3; i++) shootAt(b, toA + rand(-0.14, 0.14), 420, 12, b.color, 6);
    }
    if (b.pt <= 0) { b.phase = randI(1, 3); b.pt = b.phase === 2 ? 1.9 : 2.6; b.sub = 0; b.subN = 0; }

  } else if (b.phase === 1) {
    b.vx *= 0.9; b.vy *= 0.9;
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.sub -= dt;
    if (b.sub <= 0) {
      b.sub = 0.055; b.subN += 0.34;
      shootAt(b, b.subN, 340, 11, b.color, 6);
      shootAt(b, b.subN + Math.PI, 340, 11, b.color, 6);
    }
    if (b.pt <= 0) { b.phase = 0; b.pt = 2.4; b.cool = 0.5; }

  } else if (b.phase === 2) {
    if (b.subN === 0) { b.chargeT = 0.7; b.subN = 1; b.cx = p.x; b.cy = p.y; }
    if (b.chargeT > 0) {
      b.chargeT -= dt;
      b.vx *= 0.85; b.vy *= 0.85;
      if (Math.random() < 0.6) particle(b.x + rand(-b.r, b.r), b.y + rand(-b.r, b.r), 0, 0, 0.3, b.color, 2.5, 0.9);
    } else {
      const a = Math.atan2(b.cy - b.y, b.cx - b.x);
      b.vx = Math.cos(a) * 640; b.vy = Math.sin(a) * 640;
      b.x += b.vx * dt; b.y += b.vy * dt;
      particle(b.x, b.y, rand(-60, 60), rand(-60, 60), 0.4, b.color, 4, 0.9);
      if (dist(b.x, b.y, b.cx, b.cy) < 40 || b.pt <= 0.35) {
        shake(13); SFX.boom();
        burst(b.x, b.y, 34, b.color, 480, 4, 0.5);
        for (let i = 0; i < 12; i++) shootAt(b, (i / 12) * TAU, 380, 13, b.color, 6);
        b.phase = 0; b.pt = 1.6; b.cool = 0.6; b.subN = 0;
      }
    }

  } else if (b.phase === 3) {
    b.vx *= 0.9; b.vy *= 0.9;
    if (b.subN < 4 && b.pt < 2.4 - b.subN * 0.45) {
      b.subN++;
      portals.push({
        x: clamp(b.x + rand(-260, 260), 60, ARENA.w - 60),
        y: clamp(b.y + rand(-260, 260), 60, ARENA.h - 60),
        t: 0.55, max: 0.55, r: 26, enemy: Math.random() < 0.5 ? 'runner' : 'grunt',
        scale: hpScale(),
      });
    }
    if (b.pt <= 0) { b.phase = 0; b.pt = 2.0; b.cool = 0.4; b.subN = 0; }
  }

  b.x = clamp(b.x, b.r, ARENA.w - b.r);
  b.y = clamp(b.y, b.r, ARENA.h - b.r);
  resolveObstacles(b);
  if (d < b.r + p.r + 2 && b.touchCd <= 0) { hurtPlayer(22, b.x, b.y); b.touchCd = 0.8; }
}

/* ═══ 10. 子弹 / 伤害 / 爆炸 ═════════════════════════════ */
function updateBullets(dt) {
  for (let i = pBullets.length - 1; i >= 0; i--) {
    const b = pBullets[i];
    b.life -= dt;
    if (b.life <= 0) { pBullets.splice(i, 1); continue; }
    /* 火箭弹拖曳烟迹 */
    if (b.explode && Math.random() < 0.95) {
      const a = Math.atan2(b.vy, b.vx);
      particle(b.x - Math.cos(a) * 12, b.y - Math.sin(a) * 12,
               -b.vx * 0.12 + rand(-18, 18), -b.vy * 0.12 + rand(-18, 18),
               0.42, '#9aa6bd', 3.2, 0.9);
    }
    const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 12));
    let dead = false;
    for (let s = 0; s < steps && !dead; s++) {
      b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
      if (b.x < 0 || b.y < 0 || b.x > ARENA.w || b.y > ARENA.h) { dead = true; break; }
      if (inObstacle(b.x, b.y, b.r)) { burst(b.x, b.y, 5, b.color, 150, 2, 0.2); dead = true; break; }
      for (const e of enemies) {
        if (e.dead || e.spawnT > 0) continue;
        if (b.hitIds && b.hitIds.has(e)) continue;
        if (dist(b.x, b.y, e.x, e.y) < e.r + b.r) {
          shotsHit++;
          const ang = Math.atan2(b.vy, b.vx);
          damageEnemy(e, b.dmg, ang, b.knock, b.explode ? false : Math.random() < 0.06);
          if (b.explode) { explode(b.x, b.y, b.explode.dmg, b.explode.radius, b.color); dead = true; }
          else if (b.pierce > 0) {
            b.pierce--;
            if (!b.hitIds) b.hitIds = new Set();
            b.hitIds.add(e);
          } else dead = true;
          break;
        }
      }
    }
    if (dead) pBullets.splice(i, 1);
  }

  for (let i = eBullets.length - 1; i >= 0; i--) {
    const b = eBullets[i];
    b.life -= dt;
    if (b.life <= 0) { eBullets.splice(i, 1); continue; }
    const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 12));
    let dead = false;
    for (let s = 0; s < steps && !dead; s++) {
      b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
      if (b.x < 0 || b.y < 0 || b.x > ARENA.w || b.y > ARENA.h) { dead = true; break; }
      if (inObstacle(b.x, b.y, b.r)) { burst(b.x, b.y, 4, b.color, 120, 2, 0.2); dead = true; break; }
      if (dist(b.x, b.y, player.x, player.y) < player.r + b.r) {
        hurtPlayer(b.dmg, b.x, b.y);
        burst(b.x, b.y, 8, b.color, 200, 2.4, 0.25);
        dead = true; break;
      }
    }
    if (dead) eBullets.splice(i, 1);
  }
}

function damageEnemy(e, dmg, angle, knock, forceCrit) {
  if (e.dead) return;
  const critBase = 0.08 + pval('critBonus', 0) + Math.min(0.12, combo / 80);
  const isCrit = forceCrit || (Math.random() < critBase);
  if (isCrit) dmg = Math.round(dmg * 1.75);
  e.hp -= dmg;
  e.hitT = 0.09;
  if (knock && !e.boss) { e.vx += Math.cos(angle) * knock; e.vy += Math.sin(angle) * knock; }
  burst(e.x + rand(-6, 6), e.y + rand(-6, 6), isCrit ? 6 : 3, e.color, isCrit ? 280 : 200, isCrit ? 3 : 2.2, 0.22);
  hitFog(e.x, e.y, e.color, e.r * (isCrit ? 1.35 : 1.0));
  SFX.hit();

  /* 浮动伤害数字 */
  const col = isCrit ? '#ffe066' : e.boss ? '#ff8a5c' : '#e8f1ff';
  floatText(e.x + rand(-10, 10), e.y - e.r - 4, (isCrit ? '暴击 ' : '') + dmg, col, isCrit ? 19 : 13, isCrit ? 'crit' : '');
  if (isCrit) hitStop = Math.max(hitStop, 2);

  if (e.hp > 0) return;

  e.dead = true;
  combo++; comboTimer = 3.0; kills++;
  if (combo > runStats.comboMax) runStats.comboMax = combo;   /* 连杀纪录用于成就 */
  bumpAch('kills', 1);
  if (e.air) bumpAch('airKills', 1);
  const mult = (1 + Math.floor(combo / 5) * 0.5) * (SEC.mods.score || 1);
  const gained = Math.round((e.boss ? 3000 : e.t.score) * mult);
  score += gained;
  floatText(e.x, e.y - e.r - 12, '+' + gained, e.boss ? '#ffe066' : '#c7f0ff', e.boss ? 26 : 15, 'score');
  earnGold(e.boss ? 80 : Math.max(2, Math.round((e.t.score || 100) / 40)), e.x, e.y);
  burst(e.x, e.y, e.boss ? 90 : 22, e.color, e.boss ? 720 : 380, e.boss ? 5 : 3.4, e.boss ? 0.9 : 0.45);

  if (e.boss) {
    shake(24); SFX.boom(); hitStop = Math.max(hitStop, 8);
    for (let i = 0; i < 4; i++) dropAt(e.x + rand(-110, 110), e.y + rand(-110, 110), i < 2 ? 'heal' : 'ammo');
    dropWeapon();
    boss = null;
    $('bossBar').classList.remove('on');
    runStats.bossKills++;
    bumpAch('bossKills', 1);
    /* 本局从未挨过打（护盾挡下的也算）→ 无伤猎杀 */
    if (runStats.dmgTaken === 0) bumpAch('flawlessBoss', 1);
  } else {
    SFX.kill(); shake(combo >= 10 ? 3.6 : 1.8);
    if (e.air) {                                   // 空中单位：凌空解体 + 坠落残骸
      burst(e.x, e.y, 30, '#ffb703', 560, 4.4, 0.55);
      burst(e.x, e.y, 16, e.color, 420, 3.6, 0.7);
      shake(3.4); SFX.boom();
      for (let i = 0; i < 5; i++)
        particle(e.x, e.y, rand(-160, 160), rand(-160, 160), 0.8, '#8a93a8', 2.6, 1.2);
    }
    if (combo % 5 === 0) floatText(player.x, player.y - 42, '×' + combo + ' 连杀!', '#ffe066', 22, 'combo');
    if (Math.random() < 0.18) {
      const roll = Math.random();
      dropAt(e.x, e.y, roll < 0.42 ? 'heal' : roll < 0.78 ? 'ammo' : 'shield');
    }
    const vamp = pval('vamp', 0);
    if (vamp > 0) {
      player.hp = Math.min(player.hpMax, player.hp + vamp);
      floatText(player.x, player.y - 20, '+' + vamp, '#9ae66e', 12);
    }
  }
}

function explode(x, y, dmg, radius, color) {
  SFX.boom(); shake(11); hitStop = Math.max(hitStop, 4);
  burst(x, y, 46, color, 520, 4, 0.65);
  burst(x, y, 22, '#ffe066', 300, 3, 0.5);
  for (const e of enemies) {
    if (e.dead || e.spawnT > 0) continue;
    const d = dist(x, y, e.x, e.y);
    if (d < radius + e.r) {
      const f = 1 - clamp(d / (radius + e.r), 0, 1);
      damageEnemy(e, Math.round(dmg * (0.4 + f * 0.6)), Math.atan2(e.y - y, e.x - x), 220 * f);
    }
  }
  if (dist(x, y, player.x, player.y) < radius * 0.7) hurtPlayer(18, x, y);
  if (parts.length <= Q.partMax)
    parts.push({ x, y, vx:0, vy:0, life:0.34, max:0.34, color, size:radius, drag:1, ring:true });
}

/* ═══ 11. 渲染 ══════════════════════════════════════════ */
function render() {
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = view.dpr >= 1.15 ? 'medium' : 'low';
  ctx.clearRect(0, 0, view.w, view.h);
  drawSky();

  ctx.save();
  ctx.translate(-Math.round(cam.x) + cam.sx, -Math.round(cam.y) + cam.sy);
  drawFloor();
  drawDecals();
  if (Q.fx) drawAuthorMark();        /* 角落地面喷漆，压在贴花上、被掩体挡住 */
  drawAirShadows();        /* 空中单位的地面投影（会被障碍物遮挡，更真实） */
  drawObstacles();
  drawGates();
  drawPortals();
  drawPickups();
  drawEnemyBullets();
  drawEnemies();
  if (player && !player.dead) drawPlayer();
  drawPlayerBullets();
  drawBeams();
  drawBombs();             /* 航弹与落点预警圈 */
  drawAir();               /* 空中单位画在最上层 */
  drawParticles();
  drawTexts();
  drawArenaEdge();
  ctx.restore();

  drawVignette();
  drawBossIntro();
  if (touchMode) drawTouchAim(); else drawCrosshair();
  drawAimLock();
  drawFlash();
}

/* 视差星空背景 */
function drawSky() {
  if (!skyPat) return;
  const ox = -cam.x * 0.22, oy = -cam.y * 0.22;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.fillStyle = skyPat;
  ctx.fillRect(-ox - 4, -oy - 4, view.w + 8, view.h + 8);
  ctx.restore();
}

function drawFloor() {
  const x0 = Math.max(0, cam.x - 80), y0 = Math.max(0, cam.y - 80);
  const x1 = Math.min(ARENA.w, cam.x + view.w + 80);
  const y1 = Math.min(ARENA.h, cam.y + view.h + 80);
  if (x1 <= x0 || y1 <= y0) return;

  ctx.save();
  ctx.fillStyle = floorPat;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  if (Q.fx) {
    /* 能量网格线（主题色） */
    const S = 200;
    const gx0 = Math.floor(cam.x / S) * S, gy0 = Math.floor(cam.y / S) * S;
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = TEX.rgba(theme.accent, 0.055);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = gx0; x < cam.x + view.w + S; x += S) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
    for (let y = gy0; y < cam.y + view.h + S; y += S) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
    ctx.stroke();

    /* 扫描光带 */
    const sweep = ((elapsed * 90) % (ARENA.h + 600)) - 300;
    const g = ctx.createLinearGradient(0, sweep - 90, 0, sweep + 90);
    g.addColorStop(0, TEX.rgba(theme.accent, 0));
    g.addColorStop(0.5, TEX.rgba(theme.accent, 0.055));
    g.addColorStop(1, TEX.rgba(theme.accent, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x0, sweep - 90, x1 - x0, 180);
  }
  ctx.restore();
}

function drawDecals() {
  for (const d of decals) {
    if (d.x + d.s < cam.x || d.x - d.s > cam.x + view.w) continue;
    if (d.y + d.s < cam.y || d.y - d.s > cam.y + view.h) continue;
    ctx.save();
    ctx.globalAlpha = d.a;
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);
    ctx.drawImage(TEX.decal(SEC.key, d.kind), -d.s / 2, -d.s / 2, d.s, d.s);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/* 离屏缓存作者喷漆：两行大字 + 喷雾颗粒 + 滴流，主题色换了才重画 */
function makeAuthorSpr() {
  if (authorSpr && authorSprAccent === theme.accent) return authorSpr;
  authorSprAccent = theme.accent;
  const W = 640, H = 280, dpr = 2;
  const c = document.createElement('canvas');
  c.width = W * dpr; c.height = H * dpr;
  const x = c.getContext('2d');
  x.scale(dpr, dpr);
  let s = 2166136261;
  const seed = theme.accent;
  for (let i = 0; i < seed.length; i++) { s ^= seed.charCodeAt(i); s = Math.imul(s, 16777619); }
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const col = theme.accent;
  const face = '800 {n}px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif';

  x.translate(W / 2, H / 2);

  /* 过喷底晕 */
  const g = x.createRadialGradient(0, 12, 16, 0, 12, 250);
  g.addColorStop(0, TEX.rgba(col, 0.18));
  g.addColorStop(1, TEX.rgba(col, 0));
  x.fillStyle = g;
  x.beginPath(); x.ellipse(0, 12, 270, 108, 0, 0, TAU); x.fill();

  /* 散落喷点（底层雾） */
  x.fillStyle = TEX.rgba(col, 1);
  for (let i = 0; i < 320; i++) {
    x.globalAlpha = 0.04 + r() * 0.2;
    x.fillRect((r() - 0.5) * 560, (r() - 0.5) * 210, 0.9 + r() * 3.2, 0.9 + r() * 3.2);
  }

  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillStyle = TEX.rgba(col, 1);

  const sprayLine = (str, y, size) => {
    x.font = face.replace('{n}', size);
    for (let i = 0; i < 48; i++) {
      x.globalAlpha = 0.03 + r() * 0.08;
      x.fillText(str, (r() - 0.5) * 14, y + (r() - 0.5) * 9);
    }
    x.globalAlpha = 0.58;
    x.fillText(str, 0, y);
    x.globalAlpha = 0.16;
    x.fillText(str, 2.6, y + 1.8);
  };
  sprayLine('Alex Xing', -32, 72);
  sprayLine('邢浩轩', 46, 62);

  /* 字边再喷一圈颗粒 */
  x.fillStyle = TEX.rgba(col, 1);
  for (let i = 0; i < 180; i++) {
    x.globalAlpha = 0.08 + r() * 0.22;
    const px = (r() - 0.5) * 420, py = (r() - 0.5) * 130;
    x.beginPath();
    x.arc(px, py, 0.6 + r() * 1.8, 0, TAU);
    x.fill();
  }

  /* 磨损掉皮 */
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 22; i++) {
    x.globalAlpha = 0.2 + r() * 0.45;
    x.beginPath();
    x.arc((r() - 0.5) * 260, (r() - 0.5) * 80, 1 + r() * 2.8, 0, TAU);
    x.fill();
  }
  x.globalCompositeOperation = 'source-over';

  /* 滴流 */
  x.fillStyle = TEX.rgba(col, 1);
  x.strokeStyle = TEX.rgba(col, 1);
  x.lineCap = 'round';
  const drips = [-220, -168, -110, -52, 8, 64, 122, 178, 228];
  for (let i = 0; i < drips.length; i++) {
    const len = 18 + (i * 13) % 34;
    const y0 = i % 2 === 0 ? 22 : 74;
    x.globalAlpha = 0.3 + r() * 0.22;
    x.lineWidth = 1.8 + r() * 1.8;
    x.beginPath();
    x.moveTo(drips[i], y0);
    x.lineTo(drips[i] + (r() - 0.5) * 4, y0 + len);
    x.stroke();
    x.beginPath();
    x.arc(drips[i], y0 + len, 1.8 + r() * 1.2, 0, TAU);
    x.fill();
  }

  authorSpr = c;
  return c;
}

function drawAuthorMark() {
  const m = authorMark;
  if (m.x + 280 < cam.x || m.x - 280 > cam.x + view.w) return;
  if (m.y + 130 < cam.y || m.y - 130 > cam.y + view.h) return;
  const spr = makeAuthorSpr();
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(m.rot);
  ctx.globalAlpha = 0.86;
  ctx.drawImage(spr, -250, -110, 500, 218);
  ctx.restore();
}

const OBS_H = 15;   // 掩体立体高度
function drawObstacles() {
  for (const o of obstacles) {
    if (o.x + o.w + 40 < cam.x || o.x - 40 > cam.x + view.w) continue;
    if (o.y + o.h + 40 < cam.y || o.y - 40 > cam.y + view.h) continue;

    /* 投影 */
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(o.x + 7, o.y + 9, o.w, o.h);

    /* 侧面 */
    ctx.fillStyle = TEX.shade(theme.panel[1], -0.45);
    ctx.fillRect(o.x, o.y + o.h, o.w, OBS_H);
    ctx.fillRect(o.x + o.w, o.y, OBS_H, o.h + OBS_H);
    ctx.fillStyle = TEX.shade(theme.panel[1], -0.62);
    ctx.fillRect(o.x, o.y + o.h + OBS_H - 3, o.w, 3);

    /* 顶面贴图 */
    ctx.save();
    ctx.beginPath(); ctx.rect(o.x, o.y, o.w, o.h); ctx.clip();
    ctx.translate(o.x, o.y);
    ctx.fillStyle = panelPat;
    ctx.fillRect(0, 0, o.w, o.h);
    ctx.restore();

    /* 顶部高光条 + 边缘 */
    ctx.fillStyle = TEX.rgba(theme.accent, 0.16);
    ctx.fillRect(o.x, o.y, o.w, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(o.x, o.y, o.w, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(o.x, o.y, 1.5, o.h);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(o.x + o.w - 1.5, o.y, 1.5, o.h);

    /* 霓虹描边 */
    ctx.strokeStyle = TEX.rgba(theme.accent, 0.42);
    ctx.lineWidth = 1.6;
    ctx.strokeRect(o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1);

    /* 角标 */
    ctx.strokeStyle = TEX.rgba(theme.accent, 0.75);
    ctx.lineWidth = 2;
    const L = 9;
    ctx.beginPath();
    ctx.moveTo(o.x + 1, o.y + L); ctx.lineTo(o.x + 1, o.y + 1); ctx.lineTo(o.x + L, o.y + 1);
    ctx.moveTo(o.x + o.w - L, o.y + 1); ctx.lineTo(o.x + o.w - 1, o.y + 1); ctx.lineTo(o.x + o.w - 1, o.y + L);
    ctx.moveTo(o.x + 1, o.y + o.h - L); ctx.lineTo(o.x + 1, o.y + o.h - 1); ctx.lineTo(o.x + L, o.y + o.h - 1);
    ctx.stroke();
  }
}

function drawArenaEdge() {
  const pulse = 0.30 + Math.sin(elapsed * 2) * 0.10;
  ctx.strokeStyle = TEX.rgba(theme.accent, pulse);
  ctx.lineWidth = 5;
  ctx.strokeRect(2, 2, ARENA.w - 4, ARENA.h - 4);
  if (!Q.fx) return;
  ctx.strokeStyle = TEX.rgba(theme.accent, pulse * 0.35);
  ctx.lineWidth = 16;
  ctx.strokeRect(2, 2, ARENA.w - 4, ARENA.h - 4);
}

function drawGates() {
  for (const g of gates) {
    if (!inView(g.x, g.y, g.r * 2 + 24)) continue;
    g.t += 0.035;
    ctx.save();
    ctx.translate(g.x, g.y);
    const pulse = 0.55 + Math.sin(g.t * 2.4) * 0.18;
    if (Q.fx) {
      const hg = ctx.createRadialGradient(0, 0, 2, 0, 0, g.r * 1.55);
      hg.addColorStop(0, TEX.rgba(g.color, 0.38 * pulse));
      hg.addColorStop(0.55, TEX.rgba(g.color, 0.10));
      hg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = hg;
      ctx.beginPath(); ctx.arc(0, 0, g.r * 1.55, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = g.color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.ellipse(0, 0, g.r * 0.55, g.r, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(0, 0, g.r * 0.32, g.r * 0.72, 0, 0, TAU); ctx.stroke();
    ctx.save();
    ctx.rotate(g.t);
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, g.r * 0.42, i * Math.PI + g.t, i * Math.PI + g.t + 1.15);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = g.color;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-g.r * 0.52, g.r * 0.15);
    ctx.lineTo(-g.r * 0.52, -g.r * 0.72);
    ctx.quadraticCurveTo(0, -g.r * 1.08, g.r * 0.52, -g.r * 0.72);
    ctx.lineTo(g.r * 0.52, g.r * 0.15);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawPortals() {
  for (const p of portals) {
    if (!inView(p.x, p.y, p.r * 2 + 20)) continue;
    const k = 1 - p.t / p.max;
    ctx.save();
    ctx.translate(p.x, p.y);
    const col = p.boss ? '#ff4d6d' : theme.accent;
    /* 地面能量池 */
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r * 1.6);
    g.addColorStop(0, TEX.rgba(col, 0.42 * k));
    g.addColorStop(1, TEX.rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, p.r * 1.6, 0, TAU); ctx.fill();

    ctx.strokeStyle = col;
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.35 + 0.5 * Math.sin(p.t * 26);
    ctx.beginPath(); ctx.arc(0, 0, p.r * (0.35 + k * 0.85), 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.rotate(p.t * 3);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(0, 0, p.r * 0.6, i * TAU / 3, i * TAU / 3 + 1.1); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawPickups() {
  for (const u of pickups) {
    if (u.life < 3.2 && ((u.life * 8) | 0) % 2 === 0) continue;
    if (!inView(u.x, u.y, 48)) continue;
    const bob = Math.sin(u.t * 3 + u.bob) * 4;
    ctx.save();
    ctx.translate(u.x, u.y);
    const gs = TEX.glow(u.color);
    if (Q.fx) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.30;
      ctx.drawImage(gs, -34, -30, 68, 68);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.translate(0, bob);
    ctx.strokeStyle = u.color; ctx.lineWidth = 2.2;
    ctx.fillStyle = 'rgba(4,8,16,0.82)';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * TAU / 6 - Math.PI / 2 + u.t * 0.9;
      const x = Math.cos(a) * u.r, y = Math.sin(a) * u.r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();

    if (Q.fx) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.55 + Math.sin(u.t * 5) * 0.2;
      ctx.drawImage(gs, -22, -22, 44, 44);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = u.color;
    ctx.strokeStyle = u.color;
    ctx.lineWidth = 1.6;
    if (u.kind === 'heal') {
      ctx.fillRect(-6, -1.6, 12, 3.2); ctx.fillRect(-1.6, -6, 3.2, 12);
    } else if (u.kind === 'ammo') {
      ctx.beginPath();
      ctx.moveTo(-3.5, -6); ctx.lineTo(3.5, -6); ctx.lineTo(2.2, 6); ctx.lineTo(-2.2, 6);
      ctx.closePath(); ctx.fill();
    } else if (u.kind === 'shield') {
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.45 + Math.sin(u.t * 6) * 0.2;
      ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.font = '700 11px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('W', 0, 0.5);
    }
    ctx.restore();
  }
}

function drawPlayer() {
  const p = player;

  /* 影子 */
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.beginPath(); ctx.ellipse(p.x + 5, p.y + 7, p.r * 1.05, p.r * 0.78, 0, 0, TAU); ctx.fill();
  ctx.restore();

  /* 冲刺残影 */
  if (p.dashT > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gs = TEX.glow('#c77dff');
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = 0.30 / i;
      const s = p.r * 3.4;
      ctx.drawImage(gs, p.x - p.vx * 0.012 * i - s / 2, p.y - p.vy * 0.012 * i - s / 2, s, s);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  const flash = p.hurtFlash > 0 && ((p.hurtFlash * 30) | 0) % 2 === 0;
  const blink = p.iframe > 0 && p.dashT <= 0 && ((p.iframe * 20) | 0) % 2 === 0;
  ctx.globalAlpha = blink ? 0.42 : 1;
  const R = p.r;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.aim);
  ctx.translate(-p.recoil * 10, 0);        /* 开火后坐力：整体向后挫 */

  /* 尾焰 */
  if (p.muzzle <= 0) {
    const th = clamp(Math.hypot(p.vx, p.vy) / p.speed, 0, 1);
    if (th > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gs = TEX.glow(theme.accent);
      ctx.globalAlpha = 0.30 + th * 0.5;
      const s = 22 + th * 14;
      ctx.drawImage(gs, -R - s * 0.55, -s / 2, s, s);
      ctx.restore();
      ctx.globalAlpha = blink ? 0.42 : 1;
    }
  }

  /* 玩家贴图：成功则直接用它替代下方的程序化三角/描边/能量核心；
     失败或未加载时自动回退到下面的几何体（保证不会因资源缺失露馅） */
  let usedSprite = false;
  if (SPR.has('player')) {
    /* 沿机体轮廓加一层轻霓虹，glow 只叠原图像素，不会刷出方形底 */
    usedSprite = SPR.draw(ctx, 'player', 0, 0, R * 3.4, 0, blink ? 0.42 : 1, (blink || !Q.fx) ? 0 : 0.22);
  }

  if (!usedSprite) {
  /* 机体阴影层 */
  ctx.beginPath();
  ctx.moveTo(R + 9, 0);
  ctx.lineTo(-R * 0.62, R * 0.90);
  ctx.lineTo(-R * 0.30, 0);
  ctx.lineTo(-R * 0.62, -R * 0.90);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(-R, -R, R * 2.2, R * 2);

  /* 机体 */
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(R + 9, 0);
  ctx.lineTo(-R * 0.62, R * 0.90);
  ctx.lineTo(-R * 0.30, 0);
  ctx.lineTo(-R * 0.62, -R * 0.90);
  ctx.closePath();
  ctx.clip();
  const hg = ctx.createLinearGradient(-R, -R, R, R);
  hg.addColorStop(0, flash ? '#ffffff' : '#26405e');
  hg.addColorStop(0.55, flash ? '#ffffff' : '#12203a');
  hg.addColorStop(1, flash ? '#ffffff' : '#070d18');
  ctx.fillStyle = hg;
  ctx.fillRect(-R, -R, R * 2.4, R * 2);
  /* 装甲分缝 */
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-R * 0.5, -R); ctx.lineTo(R * 0.4, 0); ctx.lineTo(-R * 0.5, R);
  ctx.moveTo(R * 0.1, -R * 0.4); ctx.lineTo(R + 9, 0);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(-R * 0.2, -R * 0.55, 2, R * 1.1);
  ctx.restore();

  /* 描边 */
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = flash ? '#ffffff' : theme.accent;
  ctx.stroke();

  /* 能量核心 */
  const cg = TEX.glow(flash ? '#ffffff' : theme.accent);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = (blink ? 0.4 : 1) * (0.75 + Math.sin(elapsed * 6) * 0.2);
  ctx.drawImage(cg, -11, -11, 22, 22);
  ctx.restore();
  ctx.globalAlpha = blink ? 0.42 : 1;
  }    /* ← !usedSprite 块结束 */

  /* 程序化机体才叠炮管；贴图本身已有机头，再描矩形会在开火时露出黄框 */
  if (!usedSprite) {
    ctx.fillStyle = '#0b1424';
    ctx.fillRect(R - 4, -3, 17, 6);
    ctx.strokeStyle = WEAPONS[p.wi].color; ctx.lineWidth = 1.4;
    ctx.strokeRect(R - 4, -3, 17, 6);
    ctx.fillStyle = WEAPONS[p.wi].color;
    ctx.fillRect(R + 9, -1.6, 5, 3.2);
  }

  /* 枪口闪光 */
  if (p.muzzle > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const s = 16 + p.muzzle * 340;
    ctx.globalAlpha = clamp(p.muzzle * 16, 0, 1);
    ctx.drawImage(TEX.glow(WEAPONS[p.wi].color), R + 12 - s / 2, -s / 2, s, s);
    ctx.restore();
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  /* 受击团雾：世界空间圆形，关掉 shadow，不跟机头旋转 */
  if (p.hurtFlash > 0) {
    const k = clamp(p.hurtFlash / 0.3, 0, 1);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.globalAlpha = 0.35 + k * 0.65;
    drawHitFog(R * (1.05 + (1 - k) * 0.55));
    ctx.restore();
  }

  drawShieldBubble();
}

/* 浅色皂泡：有护盾才画。不是旧的青色描边圈。 */
function drawShieldBubble() {
  const p = player;
  if (!p || p.sh <= 0.5) return;
  const k = clamp(p.sh / p.shMax, 0, 1);
  const hit = clamp((p.shPulse || 0) / 0.22, 0, 1);
  const rad = p.r + 16 + Math.sin(elapsed * 3.4) * 1.4 + hit * 5;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  const g = ctx.createRadialGradient(-rad * 0.28, -rad * 0.32, rad * 0.06, 0, 0, rad);
  g.addColorStop(0, 'rgba(255,255,255,' + (0.14 + hit * 0.12) + ')');
  g.addColorStop(0.42, 'rgba(236,248,255,0.07)');
  g.addColorStop(0.78, 'rgba(214,236,255,' + (0.16 + k * 0.12 + hit * 0.16) + ')');
  g.addColorStop(1, 'rgba(255,255,255,0.04)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, rad, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(245,252,255,' + (0.30 + k * 0.32 + hit * 0.22) + ')';
  ctx.lineWidth = 1.45 + hit;
  ctx.stroke();
  if (Q.fx) {
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.42 + k * 0.22) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-rad * 0.08, -rad * 0.10, rad * 0.78, -2.45, -0.72);
    ctx.stroke();
    ctx.globalAlpha = 0.32;
    ctx.beginPath();
    ctx.arc(rad * 0.14, rad * 0.20, rad * 0.52, 0.35, 1.38);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (k < 0.42) {
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.18 + (0.42 - k) * 0.7) + ')';
    ctx.lineWidth = 1;
    const n = k < 0.2 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const a = i * 1.92 + 0.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * rad * 0.18, Math.sin(a) * rad * 0.18);
      ctx.lineTo(Math.cos(a) * rad * 0.94, Math.sin(a) * rad * 0.94);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/* 受击团雾：径向羽化圆。调用方必须在未旋转、无 shadowBlur 的坐标系里画，
   否则 Canvas 会把阴影包围盒转成菱形白框 */
function drawHitFog(r) {
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  if (!Q.fx) {
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.beginPath(); ctx.arc(0, 0, r * 1.15, 0, TAU); ctx.fill();
    return;
  }
  const hg = ctx.createRadialGradient(0, 0, r * 0.08, 0, 0, r * 1.85);
  hg.addColorStop(0, 'rgba(255,255,255,0.72)');
  hg.addColorStop(0.28, 'rgba(255,220,230,0.28)');
  hg.addColorStop(0.62, 'rgba(180,220,255,0.10)');
  hg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.arc(0, 0, r * 1.85, 0, TAU); ctx.fill();
}

/* 地面敌人贴图：圆形光晕 + 外部 PNG。素材未就绪时返回 false，由调用方回退。 */
function paintGroundSprite(e, hit) {
  const spr = e.sprite || e.type;
  if (!SPR.has(spr)) return false;
  if (Q.fx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const hg = ctx.createRadialGradient(0, 0, e.r * 0.18, 0, 0, e.r * 1.55);
    hg.addColorStop(0, TEX.rgba(e.color, 0.28));
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(0, 0, e.r * 1.55, 0, TAU); ctx.fill();
    ctx.restore();
  }
  SPR.draw(ctx, spr, 0, 0, e.r * 3.2, e.angle, 1, (hit || !Q.fx) ? 0 : 0.16);
  if (hit) drawHitFog(e.r);
  if (e.t.charge && e.chargeT > 0) {
    const k = e.chargeT / e.t.charge;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const s = e.r * (0.85 + k * 0.7);
    const cg = ctx.createRadialGradient(0, 0, s * 0.15, 0, 0, s);
    cg.addColorStop(0, TEX.rgba(e.color, 0.40 + k * 0.45));
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(0, 0, s, 0, TAU); ctx.fill();
    ctx.restore();
  }
  return true;
}

function drawEnemies() {
  for (const e of enemies) {
    if (e.spawnT > 0) continue;
    /* 空中单位由 drawAir / drawAirShadows 负责，
       这里不跳过的话会掉进分支末尾的通用多边形，在地面位置留下一个"幽灵三角" */
    if (e.air) continue;
    if (!inView(e.x, e.y, e.r + 24)) continue;

    /* 影子 */
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.36)';
    ctx.beginPath(); ctx.ellipse(e.x + 5, e.y + 6, e.r * 1.0, e.r * 0.72, 0, 0, TAU); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(e.x, e.y);
    const hit = e.hitT > 0;
    const body = hit ? '#ffffff' : null;

    if (e.boss) {
      /* 外环：Boss 力场，转速由各 Boss 的 spin 决定 */
      const spin = e.spin || 0.5;
      ctx.save();
      ctx.rotate(elapsed * spin);
      ctx.strokeStyle = TEX.rgba(e.color, 0.35);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, e.r * 1.34, i * TAU / 3, i * TAU / 3 + 1.25);
        ctx.stroke();
      }
      ctx.restore();

      /* 贴图机体：优先用它替代下方的六芒星几何体；
         素材缺失时自动回退，保证不会因资源问题露出破绽 */
      const spr = e.sprite || (e.t && e.t.sprite) || '';
      let usedSprite = false;
      if (spr) {
        /* 机体下方垫一层同色辉光，暗色装甲在暗战场上也能一眼辨认 */
        if (Q.fx) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const hg = ctx.createRadialGradient(0, 0, e.r * 0.2, 0, 0, e.r * 1.7);
          hg.addColorStop(0, TEX.rgba(e.color, 0.35));
          hg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = hg;
          ctx.beginPath(); ctx.arc(0, 0, e.r * 1.7, 0, TAU); ctx.fill();
          ctx.restore();
        }

        ctx.save();
        usedSprite = SPR.draw(ctx, spr, 0, 0, e.r * 3.4, e.angle, 1, Q.fx ? 0.18 : 0);
        ctx.restore();
        if (usedSprite && hit) drawHitFog(e.r);
      }
      if (usedSprite) { ctx.restore(); continue; }

      /* 本体六芒 */
      ctx.save();
      ctx.rotate(-elapsed * 0.28);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6, R = e.r * (i % 2 ? 0.74 : 1);
        i ? ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R) : ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R);
      }
      ctx.closePath();
      const bg = ctx.createLinearGradient(-e.r, -e.r, e.r, e.r);
      bg.addColorStop(0, body || TEX.shade(e.color, -0.72));
      bg.addColorStop(1, body || '#08060f');
      ctx.fillStyle = bg; ctx.fill();
      ctx.lineWidth = 3.2; ctx.strokeStyle = body || e.color; ctx.stroke();
      /* 装甲棱线 */
      ctx.strokeStyle = TEX.rgba(e.color, 0.30); ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * e.r, Math.sin(a) * e.r); }
      ctx.stroke();
      ctx.restore();

      /* 核心眼 */
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const s = e.r * (1.5 + Math.sin(elapsed * 3) * 0.12);
      ctx.drawImage(TEX.glow(e.color), -s / 2, -s / 2, s, s);
      ctx.restore();
      ctx.fillStyle = body || '#0a0812';
      ctx.beginPath(); ctx.arc(0, 0, e.r * 0.30, 0, TAU); ctx.fill();
      ctx.strokeStyle = body || e.color; ctx.lineWidth = 2; ctx.stroke();

    } else if (!paintGroundSprite(e, hit)) {
      ctx.rotate(e.angle);
      const key = e.type === 'runner' ? 'runner'
        : e.type === 'tank' ? 'tank'
        : e.type === 'sniper' ? 'sniper'
        : e.type === 'shooter' ? 'shooter' : 'drone';
      const sc = (e.type === 'tank' || e.type === 'sniper') ? 1.45 : 1.55;
      ctx.drawImage(TEX.enemy(key, e.color), -e.r * sc, -e.r * sc, e.r * sc * 2, e.r * sc * 2);
      if (hit) drawHitFog(e.r);
    }
    ctx.restore();

    /* 狙击手蓄力射线预警 */
    if (e.t.charge && e.chargeT > 0) {
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.strokeStyle = '#ff4d6d';
      ctx.globalAlpha = 0.26 + 0.50 * (e.chargeT / e.t.charge);
      ctx.lineWidth = 1.6;
      ctx.setLineDash([10, 8]);
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(e.angle) * 1400, Math.sin(e.angle) * 1400);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    /* 血条 */
    if (!e.boss && e.hp < e.hpMax) {
      const w = e.r * 2.2;
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w, 4);
      ctx.fillStyle = e.color;
      ctx.fillRect(e.x - w / 2, e.y - e.r - 12, w * (e.hp / e.hpMax), 4);
    }
  }
  ctx.globalAlpha = 1;
}

/* ═══ 11.5 空中单位绘制 ══════════════════════════════════
   贴图缺失时自动回退到程序化绘制的飞机剪影，保证玩法不受影响。
   ──────────────────────────────────────────────────────── */
/* 地面投影：与机体分离，偏移量由飞行高度决定，用来传达"它在天上" */
function drawAirShadows() {
  for (const e of enemies) {
    if (!e.air || e.spawnT > 0) continue;
    if (!inView(e.x, e.y, e.r * 2 + 20)) continue;
    const s = e.r * (0.95 + e.alt * 0.55);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,' + (0.30 - e.alt * 0.07).toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(e.x + e.alt * 9, e.y + e.alt * 13, s, s * 0.6, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

/* 降级绘制：程序化后掠翼战机（机头朝右，与素材朝向一致）
   素材加载失败时才会走到这里，所以要尽量画得像一架真飞机，而不是一个三角形 */
function drawAirFallback(e, x, y, size) {
  const R = size * 0.5;
  const body = e.hitT > 0 ? '#ffffff' : TEX.shade(e.color, -0.42);
  const edge = e.hitT > 0 ? '#ffffff' : TEX.rgba(e.color, 0.95);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(e.angle);
  ctx.shadowColor = e.color;
  ctx.shadowBlur = Q.fx ? 8 : 0;
  ctx.lineJoin = 'round';
  ctx.fillStyle = body;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;

  /* 主翼：后掠三角翼，翼尖在尾部 */
  ctx.beginPath();
  ctx.moveTo(R * 0.30, 0);
  ctx.lineTo(-R * 0.34, R * 0.95);
  ctx.lineTo(-R * 0.62, R * 0.95);
  ctx.lineTo(-R * 0.30, R * 0.16);
  ctx.lineTo(-R * 0.30, -R * 0.16);
  ctx.lineTo(-R * 0.62, -R * 0.95);
  ctx.lineTo(-R * 0.34, -R * 0.95);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  /* 尾翼：两片小后掠安定面 */
  ctx.beginPath();
  ctx.moveTo(-R * 0.58, R * 0.10);
  ctx.lineTo(-R * 0.95, R * 0.46);
  ctx.lineTo(-R * 0.99, R * 0.20);
  ctx.lineTo(-R * 0.72, R * 0.06);
  ctx.lineTo(-R * 0.72, -R * 0.06);
  ctx.lineTo(-R * 0.99, -R * 0.20);
  ctx.lineTo(-R * 0.95, -R * 0.46);
  ctx.lineTo(-R * 0.58, -R * 0.10);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  /* 机身：尖头 + 收腰 + 方尾 */
  ctx.fillStyle = TEX.shade(e.color, -0.58);
  ctx.beginPath();
  ctx.moveTo(R, 0);
  ctx.lineTo(R * 0.30, R * 0.15);
  ctx.lineTo(-R * 0.55, R * 0.20);
  ctx.lineTo(-R * 0.80, R * 0.24);
  ctx.lineTo(-R * 0.82, -R * 0.24);
  ctx.lineTo(-R * 0.55, -R * 0.20);
  ctx.lineTo(R * 0.30, -R * 0.15);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  /* 座舱盖 */
  ctx.shadowBlur = Q.fx ? 4 : 0;
  ctx.fillStyle = e.hitT > 0 ? '#ffffff' : TEX.rgba(e.color, 0.85);
  ctx.beginPath();
  ctx.ellipse(R * 0.34, 0, R * 0.20, R * 0.10, 0, 0, TAU);
  ctx.fill();

  /* 尾部引擎口 */
  ctx.fillStyle = '#0d1119';
  ctx.fillRect(-R * 0.84, -R * 0.17, R * 0.12, R * 0.34);
  ctx.restore();
}

function drawAir() {
  for (const e of enemies) {
    if (!e.air || e.spawnT > 0) continue;
    if (!inView(e.x, e.y, e.r * 3 + 48)) continue;
    const lift = e.alt * AIR_LIFT + Math.sin(e.bob) * 2.6;
    const x = e.x + e.alt * 9, y = e.y - lift;
    const size = e.r * 2.6;
    const spr = e.sprite || (e.t && e.t.sprite) || '';
    /* 沿机体轮廓打一层同色霓虹辉光，深色机体在暗战场上也能一眼辨认 */
    let okd = false;
    if (spr) {
      ctx.save();
      okd = SPR.draw(ctx, spr, x, y, size, e.angle, 1, 0);
      ctx.restore();
      if (okd && e.hitT > 0) {
        ctx.save();
        ctx.translate(x, y);
        ctx.globalCompositeOperation = 'lighter';
        drawHitFog(e.r);
        ctx.restore();
      }
    }
    if (!okd) drawAirFallback(e, x, y, size);

    /* 引擎尾焰 */
    const fl = 5 + Math.abs(Math.sin(e.bob * 3.1)) * 4.5;
    const ex = x - Math.cos(e.angle) * e.r * 1.1;
    const ey = y - Math.sin(e.angle) * e.r * 1.1;
    ctx.save();
    if (Q.fx) ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(TEX.glow(e.color), ex - fl, ey - fl, fl * 2.4, fl * 2.4);
    ctx.restore();

    /* 重甲单位显示血条 */
    if (e.hp < e.hpMax) {
      const w = e.r * 2, hpk = clamp(e.hp / e.hpMax, 0, 1);
      const by = y - size * 0.62;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x - w / 2, by, w, 4);
      ctx.fillStyle = e.color;
      ctx.fillRect(x - w / 2, by, w * hpk, 4);
      ctx.restore();
    }
  }
}

/* ── 航弹：落点预警圈 + 抛物线弹体 + 地面阴影 ── */
function drawBombs() {
  for (const b of bombs) {
    if (!inView(b.x, b.y, 160) && !inView(b.tx, b.ty, b.radius + 24)) continue;
    const k = Math.min(1, b.t / b.dur);
    /* 落点预警：越接近落地闪烁越急促、范围收得越紧 */
    ctx.save();
    const pulse = 0.32 + 0.36 * Math.sin(b.t * (14 + 16 * k));
    ctx.strokeStyle = TEX.rgba(b.color, pulse + 0.18 * k);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(b.tx, b.ty, b.radius * (1 - 0.5 * k), 0, TAU); ctx.stroke();
    ctx.fillStyle = TEX.rgba(b.color, 0.08 + 0.07 * k);
    ctx.fill();
    ctx.restore();

    ctx.save();                                  // 地面阴影
    ctx.fillStyle = 'rgba(0,0,0,0.26)';
    ctx.beginPath(); ctx.ellipse(b.x, b.y + 8, 7 * (1 - 0.3 * k), 5 * (1 - 0.3 * k), 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    const hz = (1 - k) * 120 + Math.sin(k * Math.PI) * 18;
    const ang = Math.atan2(b.ty - b.sy, b.tx - b.sx);
    const sz = b.radius * 0.52;
    if (!SPR.draw(ctx, 'bomb', b.x, b.y - hz, sz, ang, 1, Q.fx ? 0.3 : 0)) {
      ctx.save();
      ctx.translate(b.x, b.y - hz); ctx.rotate(ang);
      ctx.fillStyle = '#ffb703';
      ctx.beginPath(); ctx.ellipse(0, 0, sz * 0.4, sz * 0.19, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.moveTo(sz * 0.4, 0); ctx.lineTo(sz * 0.16, sz * 0.17); ctx.lineTo(sz * 0.16, -sz * 0.17);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
}

function drawPlayerBullets() {
  /* 普通子弹：加色发光曳光 */
  ctx.save();
  if (Q.fx) ctx.globalCompositeOperation = 'lighter';
  for (const b of pBullets) {
    if (b.explode) continue;                       // 火箭弹单独绘制
    if (!inView(b.x, b.y, 28)) continue;
    const a = Math.atan2(b.vy, b.vx);
    const L = b.r * 7, W = b.r * 3.4;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(a);
    ctx.globalAlpha = 0.55;
    ctx.drawImage(TEX.glow(b.color), -L, -W / 2, L * 1.4, W);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.ellipse(0, 0, b.r * 1.15, b.r * 0.72, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  /* 火箭弹：仿真导弹贴图 + 尾焰 + 烟迹 */
  for (const b of pBullets) {
    if (!b.explode) continue;
    if (!inView(b.x, b.y, 40)) continue;
    const a = Math.atan2(b.vy, b.vx);
    const fl = 13 + Math.sin(elapsed * 42 + b.x * 0.05) * 3.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(TEX.glow('#ff8a5c'),
      b.x - Math.cos(a) * 13 - fl, b.y - Math.sin(a) * 13 - fl, fl * 2, fl * 2);
    ctx.restore();
    if (!SPR.draw(ctx, 'missile', b.x, b.y, 30, a, 1, 0)) {
      ctx.save();                                   // 降级：原发光弹体
      ctx.translate(b.x, b.y); ctx.rotate(a);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(0, 0, b.r * 1.7, b.r * 0.85, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

function drawEnemyBullets() {
  ctx.save();
  if (Q.fx) ctx.globalCompositeOperation = 'lighter';
  for (const b of eBullets) {
    if (!inView(b.x, b.y, 24)) continue;
    const s = b.r * 7;
    ctx.drawImage(TEX.glow(b.color), b.x - s / 2, b.y - s / 2, s, s);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.6, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawBeams() {
  ctx.save();
  if (Q.fx) ctx.globalCompositeOperation = 'lighter';
  for (const b of beams) {
    const k = b.life / b.max;
    ctx.globalAlpha = k;
    ctx.strokeStyle = b.color;
    ctx.lineWidth = 2 + 11 * k;
    ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1 + 3.5 * k;
    ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawParticles() {
  ctx.save();
  if (Q.fx) ctx.globalCompositeOperation = 'lighter';
  for (const p of parts) {
    if (!inView(p.x, p.y, 28)) continue;
    const k = clamp(p.life / p.max, 0, 1);
    if (p.ring) {
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = k * 0.8;
      ctx.lineWidth = 3 * k;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - k * 0.75), 0, TAU); ctx.stroke();
    } else {
      const s = p.size * (0.7 + k * 1.1) * 5.2;
      ctx.globalAlpha = k * 0.95;
      ctx.drawImage(TEX.glow(p.color), p.x - s / 2, p.y - s / 2, s, s);
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawGoldCoin(x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.32, y - r * 0.32, r * 0.08, x, y, r);
  g.addColorStop(0, '#fff8d4');
  g.addColorStop(0.42, '#ffe066');
  g.addColorStop(0.78, '#f0b429');
  g.addColorStop(1, '#b87a10');
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,236,170,0.9)'; ctx.lineWidth = Math.max(1, r * 0.18);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.58, 0, TAU);
  ctx.strokeStyle = 'rgba(255,248,200,0.55)'; ctx.lineWidth = Math.max(0.8, r * 0.12);
  ctx.stroke();
}

function drawTexts() {
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of texts) {
    if (!inView(t.x, t.y, 48)) continue;
    const k = clamp(t.life / t.max, 0, 1);
    ctx.globalAlpha = k;
    ctx.fillStyle = t.color;
    const scale = t.type === 'crit' ? 1 + (1 - k) * 0.35 : t.type === 'combo' ? 1 + Math.sin(k * Math.PI) * 0.2 : 1;
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(scale, scale);
    ctx.font = '800 ' + t.size + 'px system-ui,sans-serif';
    if (t.type === 'gold') {
      const w = ctx.measureText(t.txt).width;
      const r = t.size * 0.42;
      drawGoldCoin(-w / 2 - r - 3, 0, r);
    }
    if (t.type === 'crit') {
      ctx.strokeStyle = '#6e4b00'; ctx.lineWidth = 3; ctx.strokeText(t.txt, 0, 0);
    }
    ctx.fillText(t.txt, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawBossIntro() {
  if (!bossIntro.active) return;
  const p = bossIntro.t / BOSS_INTRO_DUR;                  /* 0 ~ 1 */
  const boss = bossIntro.boss;
  const col = boss.color;

  /* 透明度包络：快速进入 -> 稳定 -> 淡出 */
  let alpha;
  if (p < 0.12)      alpha = p / 0.12;
  else if (p > 0.72) alpha = (1 - p) / 0.28;
  else               alpha = 1;

  /* 缩放包络：0.7 → 1.15（弹性过头）→ 1.0（前 0.4 段完成）*/
  let scale;
  if (p < 0.30)      scale = 0.70 + 0.45 * (p / 0.30);
  else if (p < 0.40) scale = 1.15 - 0.15 * ((p - 0.30) / 0.10);
  else               scale = 1.0;

  ctx.save();
  /* 暗化背景 */
  ctx.fillStyle = 'rgba(0,0,0,' + (0.58 * alpha).toFixed(3) + ')';
  ctx.fillRect(0, 0, view.w, view.h);

  ctx.translate(view.w / 2, view.h * 0.30);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;

  /* 四角 L 形框，Boss 配色，霓虹辉光 */
  ctx.strokeStyle = col;
  ctx.lineWidth = 4;
  ctx.shadowColor = col;
  ctx.shadowBlur = Q.fx ? 22 : 0;
  const bx = 340, by = 88, k = 28;
  ctx.beginPath();
  ctx.moveTo(-bx, -by + k); ctx.lineTo(-bx, -by); ctx.lineTo(-bx + k, -by);
  ctx.moveTo( bx - k, -by); ctx.lineTo( bx, -by); ctx.lineTo( bx, -by + k);
  ctx.moveTo(-bx,  by - k); ctx.lineTo(-bx,  by); ctx.lineTo(-bx + k,  by);
  ctx.moveTo( bx - k,  by); ctx.lineTo( bx,  by); ctx.lineTo( bx,  by - k);
  ctx.stroke();
  ctx.shadowBlur = 0;

  /* WARNING 行 */
  ctx.font = '700 22px system-ui,sans-serif';
  ctx.fillStyle = col;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚠   WARNING   ⚠', 0, -52);

  /* Boss 英文名（大）+ 霓虹外发光 */
  ctx.font = '900 64px system-ui,sans-serif';
  ctx.shadowColor = col;
  ctx.shadowBlur = Q.fx ? 28 : 0;
  ctx.fillStyle = '#f5f7fb';
  ctx.fillText(boss.name, 0, 4);
  ctx.shadowBlur = 0;

  /* 中文小字 + 标签 */
  ctx.font = '700 18px system-ui,sans-serif';
  ctx.fillStyle = '#cdd6e3';
  ctx.fillText(boss.cn + '   ·   BOSS INCOMING', 0, 44);

  ctx.restore();
}

function drawVignette() {
  if (Q.fx) {
    const g = ctx.createRadialGradient(view.w / 2, view.h / 2, Math.min(view.w, view.h) * 0.34,
                                       view.w / 2, view.h / 2, Math.max(view.w, view.h) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.60)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, view.w, view.h);
  }

  if (player && state === 'playing' && !player.dead && player.hp / player.hpMax < 0.3) {
    ctx.fillStyle = 'rgba(255,45,85,' + (0.15 + Math.sin(elapsed * 5) * 0.07) + ')';
    ctx.fillRect(0, 0, view.w, view.h);
  }
}

/* 自动瞄准锁定框：桌面准星与触屏射线共用 */
function drawAimLock() {
  if (!autoAim || !touchLock || touchLock.dead || !player || player.dead) return;
  if (state !== 'playing') return;
  const col = WEAPONS[player.wi].color;
  const sx = touchLock.x - cam.x + cam.sx, sy = touchLock.y - cam.y + cam.sy;
  const R = touchLock.r + 13;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.strokeStyle = TEX.rgba(col, 0.9);
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
  ctx.strokeStyle = TEX.rgba(col, 0.55);
  ctx.setLineDash([5, 7]);
  ctx.beginPath(); ctx.arc(0, 0, R + 8, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate(i * TAU / 4 + elapsed * 1.6);
    ctx.beginPath();
    ctx.moveTo(R - 11, 0); ctx.lineTo(R, -8); ctx.lineTo(R, 8); ctx.closePath();
    ctx.fillStyle = TEX.rgba(col, 0.95); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/* 触屏瞄准指示：从玩家脚下射出一道渐隐的方向射线 */
function drawTouchAim() {
  if (!touchMode || !player || player.dead) return;
  if (!aimStick.active) return;
  const col = WEAPONS[player.wi].color;
  const len = 40 + Math.hypot(aimStick.x, aimStick.y) * 190;
  const sx = player.x + cam.x, sy = player.y + cam.y;
  const ex = sx + Math.cos(player.aim) * len, ey = sy + Math.sin(player.aim) * len;
  ctx.save();
  const g = ctx.createLinearGradient(sx, sy, ex, ey);
  g.addColorStop(0, TEX.rgba(col, 0));
  g.addColorStop(1, TEX.rgba(col, 0.55));
  ctx.strokeStyle = g; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.fillStyle = TEX.rgba(col, 0.85);
  ctx.beginPath(); ctx.arc(ex, ey, 3.4, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawCrosshair() {
  if (state !== 'playing' || !player || player.dead) return;
  const mx = mouse.x, my = mouse.y;
  const col = WEAPONS[player.wi].color;
  ctx.save();
  ctx.strokeStyle = TEX.rgba(col, 0.85);
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(mx, my, 11, 0, TAU); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mx - 19, my); ctx.lineTo(mx - 5, my);
  ctx.moveTo(mx + 5, my);  ctx.lineTo(mx + 19, my);
  ctx.moveTo(mx, my - 19); ctx.lineTo(mx, my - 5);
  ctx.moveTo(mx, my + 5);  ctx.lineTo(mx, my + 19);
  ctx.stroke();
  ctx.fillStyle = TEX.rgba(col, 0.9);
  ctx.fillRect(mx - 1, my - 1, 2, 2);
  ctx.restore();
}

function drawFlash() {
  if (flash <= 0.01) return;
  ctx.fillStyle = 'rgba(255,255,255,' + (flash * 0.75) + ')';
  ctx.fillRect(0, 0, view.w, view.h);
}

/* ═══ 12. HUD ═══════════════════════════════════════════ */
const weaponsEl = $('weapons');
const mm = $('minimap'), mmc = mm.getContext('2d');
let slotsBuilt = false;

function buildSlots() {
  weaponsEl.innerHTML = WEAPONS.map((w, i) =>
    '<div class="wslot" data-i="' + i + '" style="--c:' + w.color + '">' +
      '<div class="k">' + w.key + '</div>' +
      '<div class="w-ico"><canvas></canvas></div>' +
      '<div class="n">' + w.name + '</div>' +
      '<div class="a">–</div>' +
      '<div class="wbar"><i style="width:0%"></i></div>' +
    '</div>').join('');
  /* pointerdown：自动发射连发时 click 容易被当成拖动吃掉；
     stopPropagation 防止触点穿透到底下的瞄准/移动摇杆 */
  for (const el of weaponsEl.children) {
    const go = e => {
      e.preventDefault();
      e.stopPropagation();
      if (state === 'playing') switchWeapon(+el.dataset.i);
    };
    el.addEventListener('pointerdown', go);
  }
  weaponsEl.addEventListener('pointerdown', e => e.stopPropagation());
  drawSlotIcons();
}

/* 把武器贴图绘制到 HUD 槽位；素材缺失时回退为原来的霓虹色条 */
function drawSlotIcons() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  Array.prototype.forEach.call(weaponsEl.children, (el, i) => {
    const cv = el.querySelector('.w-ico canvas');
    if (!cv) return;
    /* 尺寸随槽位宽度自适应，移动端窄槽位也能完整显示 */
    const box = el.getBoundingClientRect();
    const ICON_W = Math.round(Math.max(40, Math.min(78, (box.width || 76) - 10)));
    const ICON_H = Math.round(ICON_W * 0.38);
    cv.width = ICON_W * dpr; cv.height = ICON_H * dpr;
    cv.style.width = ICON_W + 'px'; cv.style.height = ICON_H + 'px';
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, ICON_W, ICON_H);
    const w = WEAPONS[i];
    const im = SPR.raw('weapon_' + w.id);
    if (im) {
      const k = Math.min((ICON_W - 4) / im.naturalWidth, (ICON_H - 4) / im.naturalHeight);
      const dw = im.naturalWidth * k, dh = im.naturalHeight * k;
      c.save();
      c.shadowColor = w.color;
      c.shadowBlur = 9;
      c.globalAlpha = 0.95;
      c.drawImage(im, (ICON_W - dw) / 2, (ICON_H - dh) / 2, dw, dh);
      c.restore();
    } else {
      c.fillStyle = w.color;                       // 降级：原色条
      c.shadowColor = w.color; c.shadowBlur = 8;
      c.fillRect((ICON_W - w.ico * 1.6) / 2, ICON_H / 2 - 2, w.ico * 1.6, 4);
      c.shadowBlur = 0;
    }
  });
}

function syncHUD() {
  const p = player; if (!p) return;
  const hpK = clamp(p.hp / p.hpMax, 0, 1);
  $('hpFill').style.transform = 'scaleX(' + hpK + ')';
  $('shFill').style.transform = 'scaleX(' + clamp(p.sh / p.shMax, 0, 1) + ')';
  $('hpText').textContent = Math.ceil(Math.max(0, p.hp));
  $('shText').textContent = Math.ceil(p.sh);
  $('hpPct').textContent = Math.round(hpK * 100) + '%';
  const dk = clamp(1 - Math.max(0, p.dashCd) / 1.15, 0, 1);
  $('dashFill').style.transform = 'scaleX(' + dk + ')';
  $('dashState').textContent = dk >= 1 ? 'READY' : p.dashT > 0 ? 'DASH!' : '充能中';
  if (touchMode) { const db = $('touchDash'); if (db) db.classList.toggle('cool', dk < 1); }

  $('secNo').textContent = SEC.n;
  $('secCn').textContent = theme.cn;
  $('waveText').textContent = secWave() + ' / 5';
  $('enemyLeft').textContent = '敌军 ' + (enemies.length + spawnQueue.length + portals.length);
  $('scoreText').textContent = score.toLocaleString('en-US');
  $('bestText').textContent = 'BEST ' + Math.max(best, score).toLocaleString('en-US');
  const gEl = $('goldText');
  if (gEl) gEl.textContent = (save.gold | 0).toLocaleString('en-US');
  const mult = 1 + Math.floor(combo / 5) * 0.5;
  $('comboText').textContent = combo >= 2 ? combo + ' 连杀  ×' + mult.toFixed(1) : '';
  const cb = $('comboBar');
  if (combo >= 2 && comboTimer > 0) {
    cb.classList.add('on');
    cb.style.width = Math.min(180, combo * 12) + 'px';
    cb.style.opacity = String(0.35 + 0.65 * (comboTimer / 3));
  } else {
    cb.classList.remove('on'); cb.style.width = '0';
  }

  if (!slotsBuilt) { buildSlots(); slotsBuilt = true; }
  const slots = weaponsEl.children;
  for (let i = 0; i < slots.length; i++) {
    const w = WEAPONS[i], el = slots[i];
    el.classList.toggle('active', i === p.wi);
    el.classList.toggle('locked', !p.owned[w.id]);
    const a = p.owned[w.id] ? p.ammo[w.id] : 0;
    const cap = ammoMaxFor(w);
    el.classList.toggle('empty', p.owned[w.id] && a <= 0);
    el.querySelector('.a').textContent = !p.owned[w.id] ? '●' : a === Infinity ? '∞' : a;
    const ratio = !p.owned[w.id] ? 0 : a === Infinity ? 1 : clamp(a / cap, 0, 1);
    el.querySelector('.wbar i').style.width = (ratio * 100) + '%';
  }

  /* 已装备强化 */
  const ph = $('perksHud');
  if (perks.length) {
    ph.innerHTML = perks.map(p => {
      const def = PERKS[PI[p.id]];
      return '<div class="perk-chip" style="background:' + def.color + '">' + p.stacks + '</div>';
    }).join('');
  } else ph.innerHTML = '';

  if (boss && !boss.dead) {
    $('bossBar').classList.add('on');
    $('bossName').textContent = boss.name + ' / ' + boss.cn;
    $('bossFill').style.transform = 'scaleX(' + clamp(boss.hp / boss.hpMax, 0, 1) + ')';
  }

  drawMinimap();
}

function drawMinimap() {
  const W = mm.width, H = mm.height;
  const pad = 6;
  const sx = (W - pad * 2) / ARENA.w, sy = (H - pad * 2) / ARENA.h;
  const s = Math.min(sx, sy);
  const ox = pad + (W - pad * 2 - ARENA.w * s) / 2;
  const oy = pad + (H - pad * 2 - ARENA.h * s) / 2;
  const X = x => ox + x * s, Y = y => oy + y * s;

  mmc.clearRect(0, 0, W, H);
  mmc.fillStyle = 'rgba(3,7,14,0.72)';
  mmc.fillRect(0, 0, W, H);

  /* 场地 */
  mmc.fillStyle = 'rgba(10,20,36,0.85)';
  mmc.fillRect(X(0), Y(0), ARENA.w * s, ARENA.h * s);
  mmc.strokeStyle = TEX.rgba(theme.accent, 0.45);
  mmc.lineWidth = 1;
  mmc.strokeRect(X(0) + 0.5, Y(0) + 0.5, ARENA.w * s - 1, ARENA.h * s - 1);

  /* 掩体 */
  mmc.fillStyle = 'rgba(120,150,190,0.20)';
  for (const o of obstacles) mmc.fillRect(X(o.x), Y(o.y), o.w * s, o.h * s);

  /* 补给 */
  for (const u of pickups) {
    mmc.fillStyle = u.color;
    mmc.fillRect(X(u.x) - 1.5, Y(u.y) - 1.5, 3, 3);
  }
  /* 敌人 */
  for (const e of enemies) {
    if (e.spawnT > 0) continue;
    mmc.fillStyle = e.color;
    mmc.beginPath();
    mmc.arc(X(e.x), Y(e.y), e.boss ? 4.5 : 2.2, 0, TAU);
    mmc.fill();
  }
  /* 任意门 */
  for (const g of gates) {
    mmc.strokeStyle = g.color;
    mmc.lineWidth = 1.4;
    mmc.beginPath();
    mmc.ellipse(X(g.x), Y(g.y), 3.2, 5.2, 0, 0, TAU);
    mmc.stroke();
  }
  /* 玩家 */
  if (player && !player.dead) {
    mmc.save();
    mmc.translate(X(player.x), Y(player.y));
    mmc.rotate(player.aim);
    mmc.fillStyle = '#e8f1ff';
    mmc.beginPath();
    mmc.moveTo(5, 0); mmc.lineTo(-3.5, 3.4); mmc.lineTo(-3.5, -3.4);
    mmc.closePath(); mmc.fill();
    mmc.restore();
  }
  /* 视口框 */
  mmc.strokeStyle = 'rgba(255,255,255,0.22)';
  mmc.lineWidth = 1;
  mmc.strokeRect(X(cam.x) + 0.5, Y(cam.y) + 0.5, Math.min(view.w, ARENA.w) * s, Math.min(view.h, ARENA.h) * s);
}

function banner(t, s, color) {
  const b = $('banner');
  $('bannerT').textContent = t;
  $('bannerS').textContent = s || '';
  b.style.color = color || theme.accent;
  b.classList.remove('play'); void b.offsetWidth; b.classList.add('play');
}

function showHint(t) {
  const h = $('hint');
  h.textContent = t; h.classList.add('on'); hintTimer = 3.6;
}

/* ═══ 13. 主循环 ════════════════════════════════════════ */
let last = performance.now(), acc = 0, hudTick = 0;
const STEP = 1 / 60;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.25) dt = 0.25;

  /* 命中停顿：时间流速大幅减慢（按帧计数） */
  const timeScale = (state === 'playing' && hitStop > 0) ? 0.08 : 1;
  if (state === 'playing' && hitStop > 0) hitStop -= 1;

  elapsed += dt * timeScale;
  if (flash > 0) flash = Math.max(0, flash - dt * timeScale * 1.6);

  if (state === 'playing') {
    /* 竖屏时冻结模拟，避免旋转提示底下继续挨打 */
    if (touchMode && window.innerHeight > window.innerWidth) {
      acc = 0;
    } else {
      if (aimStick.active && player) {
        if (stickHasAim(aimStick)) {
          mouse.x = player.x - cam.x + aimStick.x * 260;
          mouse.y = player.y - cam.y + aimStick.y * 260;
        }
        mouse.down = true;
      }
      acc += dt * timeScale;
      let guard = 0;
      while (acc >= STEP && guard++ < 5) { step(STEP); acc -= STEP; }
      if (guard >= 5) acc = 0;
    }
  } else {
    acc = 0;
    if (state === 'menu' || state === 'levels' || state === 'shop') {
      cam.x += 26 * dt;
      if (cam.x > ARENA.w - view.w) cam.x = 0;
    }
  }

  if (player && state !== 'menu' && state !== 'levels' && state !== 'shop') {
    const tx = clamp(player.x - view.w / 2, 0, Math.max(0, ARENA.w - view.w));
    const ty = clamp(player.y - view.h / 2, 0, Math.max(0, ARENA.h - view.h));
    cam.x = lerp(cam.x, tx, 1 - Math.pow(0.0015, dt));
    cam.y = lerp(cam.y, ty, 1 - Math.pow(0.0015, dt));
  } else {
    cam.y = clamp(ARENA.h / 2 - view.h / 2, 0, Math.max(0, ARENA.h - view.h));
  }
  cam.shake *= Math.pow(0.0016, dt);
  cam.sx = rand(-1, 1) * cam.shake;
  cam.sy = rand(-1, 1) * cam.shake;

  render();
  adaptCanvas(dt);
  hudTick++;
  if (state !== 'menu' && state !== 'levels' && (hudTick % Q.hudEvery === 0)) syncHUD();
}

function step(dt) {
  if (state === 'perks') return; // 强化选择期间暂停世界推进
  updatePlayer(dt);
  if (player.dead) { updateWorld(dt); return; }

  crateT -= dt;
  if (crateT <= 0) {
    spawnDriftCrate();
    crateT = rand(7.5, 12.5);
  }

  for (let i = portals.length - 1; i >= 0; i--) {
    const pt = portals[i];
    pt.t -= dt;
    if (pt.t <= 0) {
      portals.splice(i, 1);
      if (!pt.boss && enemies.length < 70) {
        enemies.push(makeEnemy(pt.enemy, pt.x, pt.y, pt.scale));
        burst(pt.x, pt.y, 14, theme.accent, 260, 3, 0.35);
      }
    }
  }

  if (intermission > 0) {
    intermission -= dt;
    if (intermission <= 0) startWave();
  } else {
    pumpSpawns(dt);
    if (spawnQueue.length === 0 && enemies.length === 0 && portals.length === 0) {
      if (wave === 0) startWave(); else waveCleared();
    }
  }

  updateWorld(dt);

  if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0; }
  if (hintTimer > 0) { hintTimer -= dt; if (hintTimer <= 0) $('hint').classList.remove('on'); }
  if (bossIntro.active) { bossIntro.t += dt; if (bossIntro.t >= BOSS_INTRO_DUR) bossIntro.active = false; }
  achTick();                /* 单局最高分 / 最高连杀：随分数变化同步到成就计数器 */
}

function updateWorld(dt) {
  updateEnemies(dt);
  updateBullets(dt);
  updateBombs(dt);

  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    const f = Math.pow(p.drag, dt * 60);
    p.vx *= f; p.vy *= f;
  }
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i];
    t.life -= dt;
    if (t.life <= 0) { texts[i] = texts[texts.length - 1]; texts.pop(); continue; }
    t.x += (t.vx || 0) * dt; t.y += t.vy * dt;
    t.vy *= Math.pow(0.94, dt * 60);
    t.vx *= Math.pow(0.96, dt * 60);
  }
  for (let i = beams.length - 1; i >= 0; i--) {
    beams[i].life -= dt;
    if (beams[i].life <= 0) { beams[i] = beams[beams.length - 1]; beams.pop(); }
  }
}

/* ═══ 14. 流程控制 ══════════════════════════════════════ */
function newGame(sectorIdx) {
  const s = clamp(sectorIdx | 0, 0, SECTORS.length - 1);
  sector = -1;
  SEC = SECTORS[s];
  applyTheme(SEC.key);
  buildArena();

  player = makePlayer();
  perks = [];
  resetRunStats();
  achScoreMark = -1;
  /* 按关卡发放武器 */
  const guns = Math.min(WEAPONS.length, Math.max(2, SEC.guns));
  for (let i = 0; i < guns; i++) {
    const w = WEAPONS[i];
    player.owned[w.id] = true;
    player.ammo[w.id] = ammoMaxFor(w);
  }
  player.wi = 0;
  refreshPlayerStats();
  player.hp = player.hpMax;
  player.sh = player.shMax;

  enemies = []; eBullets = []; pBullets = []; parts = []; beams = [];
  pickups = []; portals = []; texts = []; boss = null; bombs = [];
  wave = s * 5; score = 0; kills = 0; shotsFired = 0; shotsHit = 0;
  combo = 0; comboTimer = 0; hitStop = 0; intermission = 0; spawnQueue = [];
  crateT = 3.5;
  runGold = 0;
  slotsBuilt = false;
  cam.x = clamp(player.x - view.w / 2, 0, Math.max(0, ARENA.w - view.w));
  cam.y = clamp(player.y - view.h / 2, 0, Math.max(0, ARENA.h - view.h));
  cam.shake = 0; flash = 0;
  $('bossBar').classList.remove('on');
  setState('playing');
  startWave();
}

function setState(s) {
  state = s;
  /* 注意：保留 touch 类，否则触屏布局会整体失效 */
  const cls = s === 'playing' ? 'playing' : s === 'paused' ? 'paused' : '';
  document.body.className = (touchMode ? 'touch ' : '') + cls;
  if (s === 'playing' || s === 'paused') $('overlay').classList.remove('on');
  else $('overlay').classList.add('on');
  if (s === 'playing') { last = performance.now(); acc = 0; mouse.down = false; mouse.drag = false; }
  else if (touchMode) releaseSticks();   // 离开战斗时收回摇杆，避免残留输入
}

function pause() {
  if (state !== 'playing') return;
  mouse.down = false;
  /* 中途退出到菜单时也要把本局纪录写盘，避免进度丢失 */
  bumpMaxAch('bestRun', score);
  bumpMaxAch('bestCombo', runStats.comboMax);
  persist();
  setState('paused');
  showPanel('paused');
}

function resume() {
  if (state !== 'paused') return;
  SFX.ui();
  setState('playing');
}

function gameOver() {
  const isBest = score > best;
  if (isBest) { best = score; save.best = best; }
  bumpMaxAch('bestRun', score);
  bumpMaxAch('bestCombo', runStats.comboMax);
  persist();
  setState('dead');
  showPanel('dead', isBest);
}

/* ═══ 14.5 辅助瞄准 / 发射开关 ═══════════════════════════
   两个开关独立：瞄准只管朝向，发射只管扣扳机。写入 na_save_v2。 */
function assistBtnsHtml() {
  return '<button class="mute' + (autoAim ? ' on' : '') + '" id="btnAutoAim">' +
    (autoAim ? '自动瞄准 开' : '自动瞄准 关') + '</button>' +
    '<button class="mute' + (autoFire ? ' on' : '') + '" id="btnAutoFire">' +
    (autoFire ? '自动发射 开' : '自动发射 关') + '</button>';
}
function syncAssistUI() {
  const pairs = [
    ['hudAim', autoAim, autoAim ? 'AIM 开' : 'AIM'],
    ['hudFire', autoFire, autoFire ? 'FIRE 开' : 'FIRE'],
    ['touchAim', autoAim, autoAim ? 'AIM 开' : 'AIM'],
    ['touchFire', autoFire, autoFire ? 'FIRE 开' : 'FIRE'],
  ];
  for (const [id, on, text] of pairs) {
    const el = $(id);
    if (!el) continue;
    el.classList.toggle('on', on);
    el.textContent = text;
  }
  const ov = $('overlay');
  if (!ov) return;
  const ba = ov.querySelector('#btnAutoAim');
  if (ba) { ba.classList.toggle('on', autoAim); ba.textContent = autoAim ? '自动瞄准 开' : '自动瞄准 关'; }
  const bf = ov.querySelector('#btnAutoFire');
  if (bf) { bf.classList.toggle('on', autoFire); bf.textContent = autoFire ? '自动发射 开' : '自动发射 关'; }
}
function toggleAutoAim() {
  autoAim = !autoAim;
  save.autoAim = autoAim; persist();
  if (!autoAim) touchLock = null;
  syncAssistUI();
  SFX.ui();
  if (state === 'playing') {
    showHint(autoAim
      ? '已开启自动瞄准：锁定最近敌人 · 按住鼠标或右半屏可手动接管'
      : '已关闭自动瞄准');
  }
}
function toggleAutoFire() {
  autoFire = !autoFire;
  save.autoFire = autoFire; persist();
  syncAssistUI();
  SFX.ui();
  if (state === 'playing') {
    showHint(autoFire
      ? '已开启自动发射：有敌人时持续开火'
      : '已关闭自动发射');
  }
}

/* ═══ 15. 面板 UI ═══════════════════════════════════════ */
const CORNERS = '<i class="corner tl"></i><i class="corner tr"></i>' +
                '<i class="corner bl"></i><i class="corner br"></i>';

function panelShell(inner) {
  return CORNERS + inner;
}

function shopHtml() {
  return SHOP_ITEMS.map(it => {
    const n = shopStacks(it.id);
    const maxed = n >= it.max;
    const price = shopPrice(it);
    const poor = !maxed && save.gold < price;
    return '<button class="shop-card' + (maxed ? ' maxed' : poor ? ' poor' : '') +
      '" data-id="' + it.id + '" style="--c:' + it.color + '"' +
      (maxed ? ' disabled' : '') + '>' +
      '<div class="shop-lv">' + (n ? 'Lv.' + n : '未购置') + (maxed ? ' · MAX' : '') + '</div>' +
      '<div class="shop-name">' + it.name + '</div>' +
      '<div class="shop-cn">' + it.cn + '</div>' +
      '<div class="shop-price">' + (maxed ? '已满级' : GOLD_ICO + price) + '</div>' +
    '</button>';
  }).join('');
}

/* 成就墙：进度条 + 稀有度着色。已解锁卡片点亮，未解锁灰掉但仍显示进度 */
function achWallHtml() {
  const total = ACHIEVEMENTS.length;
  const byRarity = [0, 0, 0, 0];
  ACHIEVEMENTS.forEach(a => { if (save.achGot[a.id]) byRarity[a.rarity]++; });
  const legend = RARITY.map((r, i) =>
    '<span class="ach-legend"><i style="background:' + r.color +
    ';box-shadow:0 0 10px ' + r.color + '"></i>' + r.cn + ' ' + byRarity[i] + '</span>').join('');

  const cards = ACHIEVEMENTS.map(a => {
    const R = RARITY[a.rarity];
    const on = !!save.achGot[a.id];
    const cur = Math.min(achProgress(a), a.goal);
    const pct = Math.round(cur / a.goal * 100);
    const prog = a.goal > 1
      ? '<div class="ach-bar"><span style="width:' + pct + '%"></span></div>' +
        '<div class="ach-prog">' + cur.toLocaleString('en-US') + ' / ' + a.goal.toLocaleString('en-US') + '</div>'
      : '<div class="ach-prog">' + (on ? '已达成' : '未达成') + '</div>';
    return '<div class="ach-card' + (on ? ' on' : '') + '" style="--c:' + R.color + '">' +
             '<div class="ach-badge">' + (on ? '★' : '☆') + '</div>' +
             '<div class="ach-cname">' + a.cn + '</div>' +
             '<div class="ach-ename">' + a.name + '</div>' +
             '<div class="ach-desc">' + a.desc + '</div>' +
             prog +
             '<div class="ach-rare">' + R.cn + '</div>' +
           '</div>';
  }).join('');

  return '<div class="ach-sum">' +
           '<div class="ach-sum-l"><b>' + achCount() + '</b><span>已解锁 / ' + total + '</span></div>' +
           '<div class="ach-legend-box">' + legend + '</div>' +
         '</div>' +
         '<div class="ach-grid">' + cards + '</div>';
}

function showPanel(mode, isBest) {
  const ov = $('overlay');
  let html = '';

  if (mode === 'menu') {
    html = panelShell(`
      <div class="menu-hero">
        <h1>霓虹突袭</h1>
        <div class="sub">NEON ASSAULT &nbsp;·&nbsp; 俯视角竞技场生存射击</div>
        <div class="menu-nav">
          <button class="btn" id="btnStart">开始游戏</button>
          <div class="menu-links">
            <button class="btn ghost" id="btnLevels">关卡选择</button>
            <button class="btn ghost" id="btnShop">商店</button>
            <a class="btn ghost" href="guide.html">游戏说明</a>
            <button class="btn ghost" id="btnAch">成就 ${achCount()}/${ACHIEVEMENTS.length}</button>
          </div>
        </div>
      </div>
      <div class="actions menu-foot">
        ${assistBtnsHtml()}
        <span class="spacer"></span>
        <span class="gold-chip">${GOLD_ICO}${(save.gold | 0).toLocaleString('en-US')}</span>
        <span style="font-size:11px;letter-spacing:.16em;color:#7d8aa5">
          历史最高 ${best.toLocaleString('en-US')}</span>
      </div>`);

  } else if (mode === 'levels') {
    html = panelShell(`
      <h1 style="font-size:32px">关卡选择</h1>
      <div class="sub">SELECT SECTOR &nbsp;·&nbsp; 已解锁 ${save.unlocked} / ${SECTORS.length}</div>
      <div class="lvbar">
        <span class="t">每关 5 波 · 第 5 波为 BOSS · 通关即解锁下一区域</span>
        <span class="t">历史最高 ${best.toLocaleString('en-US')}</span>
      </div>
      <div class="levels" id="lvGrid"></div>
      <div class="actions">
        <button class="btn ghost" id="btnBack">返回主菜单</button>
        <span class="spacer"></span>
        <span style="font-size:11px;letter-spacing:.16em;color:#7d8aa5">
          成就 ${achCount()} / ${ACHIEVEMENTS.length}</span>
        <button class="mute" id="btnAch">成就墙</button>
      </div>`);

  } else if (mode === 'shop') {
    html = panelShell(`
      <h1 style="font-size:32px">武器工坊</h1>
      <div class="sub">HANGAR SHOP &nbsp;·&nbsp; 永久强化，跨局保存</div>
      <div class="lvbar">
        <span class="t">击杀掉落金币 · 通关额外奖励 · 进度自动写入本地存档</span>
        <span class="gold-chip">${GOLD_ICO}${(save.gold | 0).toLocaleString('en-US')}</span>
      </div>
      <div class="shop-grid" id="shopGrid">${shopHtml()}</div>
      <div class="actions">
        <button class="btn ghost" id="btnBack">返回主菜单</button>
        <span class="spacer"></span>
        <span style="font-size:11px;letter-spacing:.16em;color:#7d8aa5">
          已保存至本机 localStorage</span>
      </div>`);

  } else if (mode === 'paused') {
    const perksHtml = perks.length ? perks.map(p => {
      const def = PERKS[PI[p.id]];
      return '<div style="display:flex;gap:12px;align-items:baseline;margin-bottom:6px">' +
        '<span style="color:' + def.color + ';font-weight:800;min-width:84px">' + def.name + (p.stacks > 1 ? ' ×' + p.stacks : '') + '</span>' +
        '<span style="color:#c3cee0">' + def.cn + ' · ' + def.desc + '</span></div>';
    }).join('') : '<p style="color:#7d8aa5">本局尚未获得强化。清完普通波次后可选。</p>';
    html = panelShell(`
      <h1 style="font-size:30px">已暂停</h1>
      <div class="sub">SECTOR ${SEC.n} · ${theme.cn} &nbsp;·&nbsp; WAVE ${secWave()} / 5 &nbsp;·&nbsp; 得分 ${score.toLocaleString('en-US')}</div>
      <p class="pause-hint">WASD 移动 · 方向键瞄准开火 · Shift / 空格冲刺 · 1–5 / Q E 换枪 · Esc 继续</p>
      <div class="lvbar"><span class="t">当前强化</span></div>
      <div class="perk-now">${perksHtml}</div>
      <div class="actions">
        <button class="btn" id="btnResume">继续游戏</button>
        <button class="btn ghost" id="btnRestart">重打本关</button>
        <button class="btn ghost" id="btnLevels2">切换关卡</button>
        <button class="btn ghost" id="btnMenu">返回主菜单</button>
        <span class="spacer"></span>
        ${assistBtnsHtml()}
        <button class="mute ${muted ? 'off' : ''}" id="btnMute">${muted ? '音效 关' : '音效 开'}</button>
      </div>`);

  } else if (mode === 'ach') {
    html = panelShell(`
      <h1 style="font-size:32px">成就墙</h1>
      <div class="sub">DOSSIER &nbsp;·&nbsp; ${achCount()} / ${ACHIEVEMENTS.length} 已解锁</div>
      ${achWallHtml()}
      <div class="actions">
        <button class="btn ghost" id="btnBack">返回主菜单</button>
        <a class="btn ghost" href="guide.html">游戏说明</a>
      </div>`);

  } else if (mode === 'perks') {
    html = panelShell(`
      <h1 style="font-size:30px">选择强化</h1>
      <div class="sub">WAVE ${secWave()} CLEAR &nbsp;·&nbsp; 选择一项强化进入下一波</div>
      <div class="perks" id="perkGrid">
        ${perkChoices.map((c, i) => {
          const def = c.def, owned = perks.find(p => p.id === def.id);
          return '<button class="perk-card" data-i="' + i + '" style="--c:' + def.color + '">' +
            '<div class="perk-icon">' + (owned ? '×' + owned.stacks : '+') + '</div>' +
            '<div class="perk-name">' + def.name + '</div>' +
            '<div class="perk-cn">' + def.cn + '</div>' +
            '<div class="perk-desc">' + def.desc + '</div>' +
            '</button>';
        }).join('')}
      </div>
      <div class="actions" style="justify-content:center;margin-top:6px">
        <button class="btn ghost" id="btnSkip">跳过（获得 200 分）</button>
      </div>`);

  } else {
    const acc = shotsFired ? Math.round(shotsHit / shotsFired * 100) : 0;
    html = panelShell(`
      <div class="go-title">任务失败</div>
      <div class="sub">SIGNAL LOST &nbsp;·&nbsp; SECTOR ${SEC.n} · ${theme.cn} &nbsp;·&nbsp; 第 ${secWave()} 波</div>
      ${isBest ? '<div class="newbest">★ 新的最高分</div>' : ''}
      <div class="stats">
        <div class="stat"><div class="l">最终得分</div><div class="v">${score.toLocaleString('en-US')}</div></div>
        <div class="stat"><div class="l">击杀数</div><div class="v">${kills}</div></div>
        <div class="stat"><div class="l">到达波次</div><div class="v">${secWave()}/5</div></div>
        <div class="stat"><div class="l">命中率</div><div class="v">${acc}%</div></div>
      </div>
      <div class="ach-run">本局达成：击杀 ${kills} · 最高连杀 ${runStats.comboMax} · BOSS ${runStats.bossKills}
        &nbsp;·&nbsp; ${GOLD_ICO}+${runGold}（余额 ${(save.gold | 0).toLocaleString('en-US')}）
        &nbsp;·&nbsp; 成就 ${achCount()} / ${ACHIEVEMENTS.length}</div>
      <div class="actions">
        <button class="btn" id="btnRetry">再来一局</button>
        <button class="btn ghost" id="btnLevels2">切换关卡</button>
        <button class="btn ghost" id="btnAch">成就墙</button>
        <button class="btn ghost" id="btnMenu">返回主菜单</button>
      </div>`);
  }

  ov.querySelector('#panel').innerHTML = html;
  ov.dataset.mode = mode;
  ov.classList.add('on');

  /* 关卡网格 */
  if (mode === 'levels') buildLevelGrid(ov);

  /* 按钮 */
  const bind = (id, fn) => { const el = ov.querySelector(id); if (el) el.addEventListener('click', fn); };
  const start = i => { SFX.init(); SFX.resume(); SFX.ui(); newGame(i); };
  bind('#btnStart',  () => start(0));
  bind('#btnLevels', () => { SFX.ui(); setState('levels'); showPanel('levels'); });
  bind('#btnShop',   () => { SFX.ui(); setState('shop'); showPanel('shop'); });
  bind('#btnLevels2',() => { SFX.ui(); setState('levels'); showPanel('levels'); });
  bind('#btnResume', resume);
  bind('#btnRestart',() => start(sector));
  bind('#btnRetry',  () => start(sector));
  bind('#btnBack',   () => { SFX.ui(); setState('menu'); showPanel('menu'); });
  bind('#btnMenu',   () => { SFX.ui(); setState('menu'); showPanel('menu'); });
  bind('#btnSkip',   skipPerk);
  bind('#btnAch',    () => { SFX.ui(); setState('ach'); showPanel('ach'); });
  ov.querySelectorAll('#perkGrid .perk-card').forEach((el, i) =>
    el.addEventListener('click', () => { SFX.ui(); pickPerk(i); }));
  ov.querySelectorAll('#shopGrid .shop-card').forEach(el => {
    el.addEventListener('click', () => {
      if (shopBuy(el.dataset.id)) showPanel('shop');
    });
  });
  bind('#btnMute',   () => {
    SFX.setMuted(!muted);
    save.muted = muted; persist();
    const el = ov.querySelector('#btnMute');
    el.textContent = muted ? '音效 关' : '音效 开';
    el.classList.toggle('off', muted);
    if (!muted) SFX.ui();
  });
  bind('#btnAutoAim', () => { toggleAutoAim(); });
  bind('#btnAutoFire', () => { toggleAutoFire(); });
}

function buildLevelGrid(ov) {
  const grid = ov.querySelector('#lvGrid');
  if (!grid) return;
  grid.innerHTML = SECTORS.map((s, i) => {
    const T = TEX.theme(s.key);
    const unlocked = i < save.unlocked;
    const cleared = !!save.sec[String(i)];
    const bst = save.sec[String(i)] || 0;
    return '<button class="scard' + (unlocked ? '' : ' locked') + (cleared ? ' cleared' : '') +
      '" data-i="' + i + '" style="--c:' + T.accent + '"' + (unlocked ? '' : ' disabled') + '>' +
      '<canvas width="248" height="118"></canvas>' +
      '<div class="sc-body">' +
        '<div class="sc-no">SECTOR ' + s.n + '</div>' +
        '<div class="sc-cn">' + T.cn + '</div>' +
        '<div class="sc-en">' + T.en + '</div>' +
        '<div class="sc-mod">' + s.mod + '</div>' +
        '<div class="sc-foot"><span>WAVE ' + (i * 5 + 1) + ' – ' + (i * 5 + 5) + '</span>' +
        '<span class="sc-best">' + (bst ? 'BEST ' + bst.toLocaleString('en-US') : '未通关') + '</span></div>' +
      '</div>' +
      (unlocked ? '' : '<div class="sc-lock"><span>🔒</span>通关 SECTOR ' + SECTORS[i - 1].n + ' 解锁</div>') +
    '</button>';
  }).join('');

  /* 绘制缩略图 */
  const cards = grid.querySelectorAll('.scard');
  cards.forEach((card, i) => {
    const cvs = card.querySelector('canvas');
    const src = TEX.thumb(SECTORS[i].key, cvs.width, cvs.height);
    cvs.getContext('2d').drawImage(src, 0, 0);
    card.addEventListener('click', () => {
      SFX.init(); SFX.resume(); SFX.ui();
      newGame(i);
    });
  });
}

/* ═══ 16. 输入 ══════════════════════════════════════════ */
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  keys[k] = true;
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  SFX.init(); SFX.resume();

  if (k === 'p' || k === 'escape') {
    if (state === 'playing') pause();
    else if (state === 'paused') resume();
    else if (state === 'levels') { SFX.ui(); setState('menu'); showPanel('menu'); }
    else if (state === 'shop') { SFX.ui(); setState('menu'); showPanel('menu'); }
    else if (state === 'ach') { SFX.ui(); setState('menu'); showPanel('menu'); }
    else if (state === 'dead') { SFX.ui(); setState('menu'); showPanel('menu'); }
  }
  if (k === 'r' && (state === 'playing' || state === 'paused' || state === 'dead')) newGame(sector);
  if (state === 'playing' && k >= '1' && k <= '5') switchWeapon(+k - 1);
  if (state === 'playing' && k === 'q') cycleWeapon(-1);
  if (state === 'playing' && k === 'e') cycleWeapon(1);
  /* Enter = 上下文主操作：菜单开新局 / 暂停继续 / 阵亡重开 */
  if (k === 'enter') {
    if (state === 'menu') { SFX.init(); SFX.resume(); newGame(0); }
    else if (state === 'paused') resume();
    else if (state === 'dead') newGame(sector);
  }
  /* 强化选择：1/2/3 直接选卡，S 跳过 */
  if (state === 'perks') {
    if (k >= '1' && k <= '3') {
      const i = +k - 1;
      if (i < perkChoices.length) pickPerk(i);
    } else if (k === 's' || k === 'escape') skipPerk();
  }
  /* 关卡选择：数字键 1-8 直达对应区域（未解锁的忽略） */
  if (state === 'levels' && k >= '1' && k <= '8') {
    const i = +k - 1;
    if (i < SECTORS.length && i < save.unlocked) { SFX.init(); SFX.resume(); newGame(i); }
    else SFX.ui();
  }
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  mouse.down = false;
  mouse.drag = false;
  if (touchMode) releaseSticks();
  if (state === 'playing') pause();
});

canvas.addEventListener('mousemove', e => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  if (mouse.down && Math.hypot(e.clientX - mouse.sx, e.clientY - mouse.sy) > AIM_DRAG_MIN)
    mouse.drag = true;
});
canvas.addEventListener('mousedown', e => {
  if (e.button === 0) {
    mouse.down = true;
    mouse.drag = false;
    mouse.sx = e.clientX; mouse.sy = e.clientY;
    mouse.x = e.clientX; mouse.y = e.clientY;
    SFX.init(); SFX.resume();
  }
});
window.addEventListener('mouseup', e => { if (e.button === 0) { mouse.down = false; mouse.drag = false; } });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => {
  if (state !== 'playing') return;
  e.preventDefault();
  cycleWeapon(e.deltaY > 0 ? 1 : -1);
}, { passive: false });

$('pauseBtn').addEventListener('click', () => {
  if (state === 'playing') pause();
  else if (state === 'paused') resume();
});

/* ═══ 16b. 触屏虚拟摇杆 ═════════════════════════════════
   左半屏 = 移动摇杆（浮动，手指按下处生成）
   右半屏 = 瞄准摇杆（拖动方向即射击方向，按住即开火）
   右下角 DASH 按钮 = 冲刺
   ───────────────────────────────────────────────────── */
const STICK_R = 54;                       // 摇杆最大偏移半径（CSS px）
const elMove = $('stickMove'), elAim = $('stickAim');
const knobMove = elMove && elMove.querySelector('.knob');
const knobAim  = elAim  && elAim.querySelector('.knob');

function stickShow(el, knob, cx, cy) {
  const r = (el.offsetWidth || 130) / 2;   // 自适应不同屏幕下的摇杆尺寸
  el.style.left = (cx - r) + 'px';
  el.style.top = (cy - r) + 'px';
  el.style.right = 'auto'; el.style.bottom = 'auto';
  if (knob) knob.style.transform = 'translate(0,0)';
  el.classList.add('on');
}
function stickHide(el, knob) {
  el.classList.remove('on');
  el.style.left = ''; el.style.top = ''; el.style.right = ''; el.style.bottom = '';
  if (knob) knob.style.transform = 'translate(0,0)';
}
/* 计算归一化方向向量（-1..1），带 6px 死区 */
function stickVec(s, t) {
  const dx = t.clientX - s.cx, dy = t.clientY - s.cy;
  const d = Math.hypot(dx, dy);
  if (d < 6) { s.x = 0; s.y = 0; return; }
  const k = Math.min(d, STICK_R) / d;
  s.x = (dx * k) / STICK_R;
  s.y = (dy * k) / STICK_R;
}
function stickKnob(knob, s) {
  if (knob) knob.style.transform = 'translate(' + (s.x * STICK_R) + 'px,' + (s.y * STICK_R) + 'px)';
}

function touchStart(e) {
  if (touchMode && window.innerHeight > window.innerWidth) return;
  SFX.init(); SFX.resume();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    const left = t.clientX < window.innerWidth * 0.45;
    if (left && !stick.active) {
      stick.active = true; stick.id = t.identifier;
      stick.cx = t.clientX; stick.cy = t.clientY;
      stick.x = 0; stick.y = 0;
      stickShow(elMove, knobMove, t.clientX, t.clientY);
    } else if (!left && !aimStick.active) {
      aimStick.active = true; aimStick.id = t.identifier;
      aimStick.cx = t.clientX; aimStick.cy = t.clientY;
      aimStick.x = 0; aimStick.y = 0;
      stickShow(elAim, knobAim, t.clientX, t.clientY);
    }
  }
  if (state === 'playing') e.preventDefault();
}
function touchMove(e) {
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    if (stick.active && t.identifier === stick.id) { stickVec(stick, t); stickKnob(knobMove, stick); }
    if (aimStick.active && t.identifier === aimStick.id) { stickVec(aimStick, t); stickKnob(knobAim, aimStick); }
  }
  if (state === 'playing') e.preventDefault();
}
function touchEnd(e) {
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    if (stick.active && t.identifier === stick.id) {
      stick.active = false; stick.id = null; stick.x = 0; stick.y = 0;
      stickHide(elMove, knobMove);
    }
    if (aimStick.active && t.identifier === aimStick.id) {
      aimStick.active = false; aimStick.id = null; aimStick.x = 0; aimStick.y = 0;
      stickHide(elAim, knobAim);
      mouse.down = false;
      if (player) player.firedPress = false;
    }
  }
}

if (isTouch()) {
  touchMode = true;
  document.body.classList.add('touch');
  const lockLandscape = () => {
    const ori = screen.orientation;
    if (ori && typeof ori.lock === 'function') {
      ori.lock('landscape').catch(() => {});
    }
  };
  lockLandscape();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') lockLandscape();
  });
  window.addEventListener('orientationchange', lockLandscape);
  if (elMove && elAim) {
    canvas.addEventListener('touchstart', touchStart, { passive: false });
    canvas.addEventListener('touchmove',  touchMove,  { passive: false });
    const end = e => { touchEnd(e); e.preventDefault(); };
    canvas.addEventListener('touchend',    end, { passive: false });
    canvas.addEventListener('touchcancel', end, { passive: false });
  }
  /* DASH 按钮 */
  const elDash = $('touchDash');
  if (elDash) {
    const on = e => { e.preventDefault(); SFX.init(); SFX.resume(); keys['shift'] = true; };
    const off = e => { e.preventDefault(); keys['shift'] = false; };
    elDash.addEventListener('touchstart', on, { passive: false });
    elDash.addEventListener('touchend', off, { passive: false });
    elDash.addEventListener('touchcancel', off, { passive: false });
    elDash.addEventListener('mousedown', on);
    elDash.addEventListener('mouseup', off);
    elDash.addEventListener('mouseleave', off);
  }
  /* 武器切换 ◀ ▶：夹在底部武器条两侧，对应手柄 L1 / R1 */
  const bindTouchTap = (id, fn) => {
    const el = $(id);
    if (!el) return;
    const on = e => { e.preventDefault(); SFX.init(); SFX.resume(); fn(); };
    el.addEventListener('touchstart', on, { passive: false });
    el.addEventListener('mousedown', on);
  };
  bindTouchTap('touchPrev', () => cycleWeapon(-1));
  bindTouchTap('touchNext', () => cycleWeapon(1));
  /* 部分浏览器（尤其 iOS Safari）只在用户手势后才允许 lock */
  window.addEventListener('touchend', lockLandscape, { once: true, passive: true });
}

/* AIM / FIRE：pointerdown 一次即可，避免 touchstart+mousedown 连点把开关打回去 */
['hudAim', 'hudFire', 'touchAim', 'touchFire'].forEach(id => {
  const el = $(id);
  if (!el) return;
  el.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    SFX.init(); SFX.resume();
    if (id === 'hudAim' || id === 'touchAim') toggleAutoAim();
    else toggleAutoFire();
  });
});
syncAssistUI();

/* ═══ 17. 启动 ══════════════════════════════════════════ */
applyTheme(SECTORS[0].key);
buildArena();
mouse.x = view.w / 2; mouse.y = view.h / 2;
showPanel('menu');

/* 异步加载飞行器 / 导弹 / 武器贴图。
   加载完成前游戏已可正常游玩（回退到程序化绘制），完成后自动切换为贴图。 */
SPR.load(() => {
  if (slotsBuilt) drawSlotIcons();
});

requestAnimationFrame(frame);

/* 调试句柄：供自动化测试读取内部状态，不影响正常游玩 */
window.__NA = {
  get state() { return state; },
  get player() { return player; },
  get enemies() { return enemies; },
  get boss() { return boss; },
  get wave() { return wave; },
  get sector() { return sector; },
  get score() { return score; },
  get kills() { return kills; },
  get perks() { return perks; },
  get pickups() { return pickups; },
  get cam() { return cam; },
  get authorMark() { return authorMark; },
  get arena() { return ARENA; },
  get mouse() { return mouse; },
  get keys() { return keys; },
  get weapons() { return WEAPONS; },
  get save() { return save; },
  get hitStop() { return hitStop; },
  get touchMode() { return touchMode; },
  get autoAim() { return autoAim; },
  get autoFire() { return autoFire; },
  get touchAuto() { return autoAim && autoFire; },
  get touchLock() { return touchLock; },
  get gates() { return gates; },
  stickHasAim, pointerAim, isManualAim, warpExit,
  setAutoAim: v => { autoAim = !!v; save.autoAim = autoAim; persist(); if (!autoAim) touchLock = null; syncAssistUI(); },
  setAutoFire: v => { autoFire = !!v; save.autoFire = autoFire; persist(); syncAssistUI(); },
  setTouchAuto: v => {
    autoAim = autoFire = !!v;
    save.autoAim = autoAim; save.autoFire = autoFire; persist();
    syncAssistUI();
  },
  cycleWeapon,
  shopBuy, earnGold,
  get gold() { return save.gold; },
  get shop() { return save.shop; },
  get runGold() { return runGold; },
  skipPerk,
  get stick() { return stick; },
  get aimStick() { return aimStick; },
  get bombs() { return bombs; },
  get air() { return enemies.filter(e => e.air); },
  get pBullets() { return pBullets; },
  get eBullets() { return eBullets; },
  get particles() { return parts; },
  get quality() { return view.dpr.toFixed(2); },
  get dpr() { return view.dpr; },
  get frameMs() { return Q.emaMs; },
  get sprites() { return SPR.progress(); },
  get runStats() { return runStats; },
  bumpAch, bumpMaxAch, achCheck, achCount,
  damageEnemy,
  achReset: () => {
    save.ach = {}; save.achGot = {};
    ACH_STATS.forEach(k => { save.ach[k] = 0; });
    persist();
  },
  spawnAir: t => { const e = makeAir(t || 'drone', hpScale()); enemies.push(e); return e; },
  spawnEnemy: (type, x, y, scale) => { const e = makeEnemy(type || 'runner', x, y, scale || hpScale()); enemies.push(e); return e; },
  dropAt, spawnDriftCrate, absorbShield, hurtPlayer,
  die: () => killPlayer(),
  spawnBoss: i => spawnBossFromQueue(i | 0),
  start: i => newGame(i | 0),
  pause, resume,
  pickPerk,
};

})();
