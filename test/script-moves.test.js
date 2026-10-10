/* ============================================================
   Test lapisan gerakan `script.js` (tanpa DOM).

   Jalankan:  node --test test/script-moves.test.js

   Catatan: `script.js` berisi DOM, jadi tidak bisa di-require.
   Test di sini mengunci kontrak modul aturan yang kini dipakai
   `script.js` sebagai satu-satunya sumber kebenaran, PLUS
   memverifikasi secara statis bahwa `script.js` benar-benar
   mendelegasikan ke `Rules` dan tidak lagi memakai pola
   optional-chaining yang menimbulkan phantom edge.
   ============================================================ */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const Rules = require('../rules.js');

const BACA = (berkas) => fs.readFileSync(path.join(__dirname, '..', berkas), 'utf8');

test('garis yang sudah dimiliki tidak muncul di availableMoves', () => {
  const s = Rules.createBoard(3);
  const r = Rules.applyMove(s, { type: 'horizontal', row: 0, col: 0 }, 0);
  const stillThere = Rules.availableMoves(r.state)
    .some((m) => m.type === 'horizontal' && m.row === 0 && m.col === 0);
  assert.strictEqual(stillThere, false);
});

test('menerapkan garis yang sudah dimiliki tidak mengubah papan (guard klik ganda)', () => {
  const s = Rules.createBoard(3);
  const pertama = Rules.applyMove(s, { type: 'horizontal', row: 1, col: 1 }, 0);
  const kedua = Rules.applyMove(pertama.state, { type: 'horizontal', row: 1, col: 1 }, 1);

  assert.deepStrictEqual(kedua.boxesGained, [], 'klik ulang tidak boleh mengklaim kotak');
  assert.strictEqual(kedua.extraTurn, false, 'klik ulang tidak boleh memberi giliran ekstra');
  assert.strictEqual(
    kedua.state.edges.horizontal[1][1].owner,
    0,
    'pemilik garis pertama tidak boleh tertimpa'
  );
});

test('skor hasil Rules sama dengan hitung ulang manual dari papan', () => {
  let s = Rules.createBoard(3);
  s = Rules.applyMove(s, { type: 'horizontal', row: 0, col: 0 }, 0).state;
  s = Rules.applyMove(s, { type: 'horizontal', row: 1, col: 0 }, 0).state;
  s = Rules.applyMove(s, { type: 'vertical', row: 0, col: 0 }, 0).state;
  s = Rules.applyMove(s, { type: 'vertical', row: 0, col: 1 }, 0).state;

  const manual = [0, 0];
  for (const baris of s.boxes) {
    for (const box of baris) if (box.owner !== null) manual[box.owner]++;
  }
  assert.deepStrictEqual(Rules.score(s, 2), manual);
  assert.deepStrictEqual(manual, [1, 0]);
});

test('script.js mendelegasikan aturan kotak ke Rules (tidak ada aturan kedua)', () => {
  const src = BACA('script.js');
  assert.ok(/Rules\.applyMove\s*\(/.test(src), 'script.js harus memakai Rules.applyMove');
  assert.ok(/Rules\.isBoxComplete\s*\(/.test(src), 'script.js harus memakai Rules.isBoxComplete');
  assert.ok(/Rules\.score\s*\(/.test(src), 'script.js harus memakai Rules.score');
  assert.ok(
    /globalThis\.Rules\s*=/.test(src),
    'script.js harus memastikan global Rules tersedia (tanpa build step)'
  );
});

test('script.js tidak lagi mendeklarasikan gameState sebagai objek literal const', () => {
  const src = BACA('script.js');
  assert.ok(
    !/^\s*const gameState\s*=\s*\{/m.test(src),
    'gameState harus bisa ditimpa, bukan objek literal `const`'
  );
  assert.ok(/^\s*let state\s*=\s*\{/m.test(src), 'state harus `let` agar bisa dibangun ulang');
});

test('index.html memuat rules.js SEBELUM ai-engine.js dan script.js', () => {
  const html = BACA('index.html');
  const iRules = html.indexOf('rules.js');
  const iAi = html.indexOf('ai-engine.js');
  const iScript = html.indexOf('script.js');
  assert.ok(iRules >= 0, 'index.html belum memuat rules.js');
  assert.ok(iRules < iAi, 'rules.js harus dimuat sebelum ai-engine.js');
  assert.ok(iRules < iScript, 'rules.js harus dimuat sebelum script.js');
});
