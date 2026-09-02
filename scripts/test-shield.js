#!/usr/bin/env node
/* 护盾吸收：有泡时不穿血；游荡者 11 伤需 5 下击破。 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '../web/game.js'), 'utf8');
const start = src.indexOf('function absorbShield');
const end = src.indexOf('function popShield');
assert.ok(start >= 0 && end > start, '找不到 absorbShield');
const A = new Function(src.slice(start, end) + '; return { absorbShield };')();

function hitsToBreak(sh, dmg) {
  let n = 0, s = sh;
  while (s > 0) {
    const r = A.absorbShield(s, dmg);
    assert.strictEqual(r.hull, 0, '护盾还在时不穿船体');
    assert.strictEqual(r.hit, true);
    s = r.sh;
    n++;
    assert.ok(n < 40, '击破次数异常');
  }
  return n;
}

assert.deepStrictEqual(A.absorbShield(50, 11), { sh: 39, hull: 0, hit: true, broken: false });
assert.deepStrictEqual(A.absorbShield(6, 11), { sh: 0, hull: 0, hit: true, broken: true });
assert.deepStrictEqual(A.absorbShield(0, 11), { sh: 0, hull: 11, hit: false, broken: false });
assert.deepStrictEqual(A.absorbShield(50, 0), { sh: 50, hull: 0, hit: false, broken: false });

assert.strictEqual(hitsToBreak(50, 11), 5, '游荡者 11 伤应 5 下击破');
assert.strictEqual(hitsToBreak(50, 9), 6, '射手 9 伤应 6 下击破');
assert.strictEqual(hitsToBreak(50, 27), 2, '狙击 27 伤应 2 下击破');
assert.strictEqual(hitsToBreak(50, 15), 4, '突袭者 15 伤应 4 下击破');

console.log('test-shield: ok');
