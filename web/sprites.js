/* ══════════════════════════════════════════════════════════
   sprites.js — 外部图片素材（飞行器 / 导弹 / 武器）
   设计目标：渐进增强。图片异步加载，未就绪或缺失时由调用方
   回退到程序化绘制，绝不因为素材问题导致游戏崩溃或空白。
   ══════════════════════════════════════════════════════════ */
window.SPR = (function () {
  'use strict';

  const BASE = 'assets/';
  const MANIFEST = {
    /* 玩家机体 */
    player:      'player.png',
    /* 空中单位 */
    drone:       'drone.png',
    wasp:        'wasp.png',
    gunship:     'gunship.png',
    dreadnought: 'dreadnought.png',
    /* 地面 Boss */
    sentinel:    'sentinel.png',
    wraith:      'wraith.png',
    titan:       'titan.png',
    /* 弹药 */
    missile:     'missile.png',
    bomb:        'bomb.png',
    /* 武器（顺序与 WEAPONS 一致） */
    weapon_pistol:  'weapon_pistol.png',
    weapon_smg:     'weapon_smg.png',
    weapon_shotgun: 'weapon_shotgun.png',
    weapon_laser:   'weapon_laser.png',
    weapon_rocket:  'weapon_rocket.png',
  };

  const KEYS = Object.keys(MANIFEST);
  const imgs = Object.create(null);
  let done = 0, ok = 0, started = false;

  /* 开始加载。onDone 在全部（成功或失败）结束后回调一次。 */
  function load(onDone) {
    if (started) return;
    started = true;
    KEYS.forEach(k => {
      const im = new Image();
      imgs[k] = im;
      im.onload = () => { done++; ok++; tick(onDone); };
      im.onerror = () => {
        done++;
        console.warn('[SPR] 素材缺失，回退到程序化绘制：' + BASE + MANIFEST[k]);
        tick(onDone);
      };
      im.src = BASE + MANIFEST[k];
    });
  }
  function tick(onDone) {
    if (done >= KEYS.length && onDone) onDone(ok, KEYS.length);
  }

  /* 素材是否可用（已成功加载且已解码） */
  function has(name) {
    const im = imgs[name];
    return !!(im && im.complete && im.naturalWidth > 0);
  }

  /* 全部素材是否已结束加载（无论成功失败） */
  function settled() { return done >= KEYS.length; }
  function progress() { return { done: done, total: KEYS.length, ok: ok }; }

  /* 按名称取原图（供 HUD 等自行绘制） */
  function raw(name) { return has(name) ? imgs[name] : null; }

  /**
   * 绘制精灵（正方形，中心对齐，主体已居中）
   * @param c      2D 上下文
   * @param name   素材名
   * @param x,y    中心坐标（已含相机偏移）
   * @param size   目标边长
   * @param angle  旋转弧度（0 = 素材原朝向，即朝右）
   * @param alpha  透明度
   * @param glow   霓虹叠加强度 0~1，0 表示不叠加
   * @return 是否成功绘制（false 表示调用方应回退）
   */
  function draw(c, name, x, y, size, angle, alpha, glow) {
    const im = imgs[name];
    if (!im || !im.complete || !im.naturalWidth) return false;
    const a = alpha === undefined ? 1 : alpha;
    if (a <= 0.01) return true;
    const h = size / 2;
    c.save();
    c.translate(x, y);
    if (angle) c.rotate(angle);
    c.globalAlpha = a;
    if (glow > 0) {
      /* 加色叠加一层，强化霓虹发光感 */
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = a * glow;
      c.drawImage(im, -h, -h, size, size);
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = a;
    }
    c.drawImage(im, -h, -h, size, size);
    c.restore();
    return true;
  }

  /**
   * 受击白闪：先画原图，再用 source-atop 叠一层白色高光
   * 用于命中反馈，让贴图素材也有和程序化绘制一致的打击感
   */
  function drawFlash(c, name, x, y, size, angle, alpha, white) {
    if (!draw(c, name, x, y, size, angle, alpha, 0)) return false;
    if (!(white > 0.01)) return true;
    const im = imgs[name], h = size / 2;
    c.save();
    c.translate(x, y);
    if (angle) c.rotate(angle);
    c.globalAlpha = Math.min(1, white) * (alpha === undefined ? 1 : alpha);
    c.drawImage(im, -h, -h, size, size);          // 先铺形状
    c.globalCompositeOperation = 'source-atop';   // 只在实体范围内染色
    c.fillStyle = '#fff';
    c.fillRect(-h, -h, size, size);
    c.restore();
    return true;
  }

  return { load, has, settled, progress, raw, draw, drawFlash, KEYS };
})();
