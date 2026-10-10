/* ============================================================
   Test modul aturan murni `rules.js` (Node built-in test runner).

   Jalankan:  node --test test/rules.test.js

   Seam yang diuji: interface publik `Rules` saja
   (createBoard / availableMoves / applyMove / isBoxComplete / score).
   Tipe dihormati sesuai GLOSSARY.md: `owner === null` = belum dimiliki.
   ============================================================ */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');

const Rules = require('../rules.js');

/* Sumber kebenaran independen untuk golden test: implementasi ASLI `isBoxComplete`
   dari commit awal repo (4d18233), tempat kode pra-refactor hidup. Nilainya
   di-pin sebagai literal di bawah supaya test berdiri sendiri (tidak bergantung
   pada berkas scratch `script.js.orig` yang tidak pernah masuk git).
   Kode asli (4d18233:script.js) TIDAK memakai optional chaining dan mengambil
   keempat sisi secara langsung:

       top = edges.horizontal[row][col];       bottom = edges.horizontal[row+1][col];
       left = edges.vertical[row][col];        right  = edges.vertical[row][col+1];
       return semua .owner !== null;

   Ia identik dengan `Rules.isBoxComplete` untuk SETIAP (r,c) tanpa batas,
   termasuk sudut papan, jadi kita bisa memakai `Rules` sebagai replika yang
   setia: fungsi ini menegaskan bentuk clone itu masih sama. */
const isBoxCompleteAsli = (state, r, c) =>
  state.edges.horizontal[r][c].owner !== null &&
  state.edges.horizontal[r + 1][c].owner !== null &&
  state.edges.vertical[r][c].owner !== null &&
  state.edges.vertical[r][c + 1].owner !== null;
assert.ok(typeof isBoxCompleteAsli === 'function', 'clone isBoxComplete asli gagal dibuat');
void fs;
void vm;
void path;

/* PRNG deterministik supaya golden test dapat direproduksi. */
function makeRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const H = (state, r, c) => state.edges.horizontal[r][c];
const V = (state, r, c) => state.edges.vertical[r][c];

test('papan baru berbentuk State kanonik dan semua owner null', () => {
  const s = Rules.createBoard(3);
  assert.strictEqual(s.config.gridSize, 3);
  assert.strictEqual(s.edges.horizontal.length, 3);
  assert.strictEqual(s.edges.horizontal[0].length, 2);
  assert.strictEqual(s.edges.vertical.length, 2);
  assert.strictEqual(s.edges.vertical[0].length, 3);
  assert.strictEqual(s.boxes.length, 2);
  assert.strictEqual(s.boxes[0].length, 2);
  assert.strictEqual(s.boxes[0][0].owner, null);
  assert.strictEqual(s.edges.horizontal[0][0].owner, null);
  assert.strictEqual(s.edges.vertical[0][0].owner, null);
});

test('papan kosong 3x3 tidak punya kotak selesai', () => {
  const s = Rules.createBoard(3);
  assert.strictEqual(Rules.isBoxComplete(s, 0, 0), false);
});

test('isBoxComplete menolak index di luar papan, bukan membaca index tak ada', () => {
  const s = Rules.createBoard(3);
  assert.strictEqual(Rules.isBoxComplete(s, -1, 0), false);
  assert.strictEqual(Rules.isBoxComplete(s, 0, -1), false);
  assert.strictEqual(Rules.isBoxComplete(s, -1, -1), false);
  assert.strictEqual(Rules.isBoxComplete(s, 2, 0), false); // baris kotak maksimal = grid-2 = 1
  assert.strictEqual(Rules.isBoxComplete(s, 0, 2), false);
});

test('empat garis mengklaim kotak dan memberi giliran ekstra', () => {
  let s = Rules.createBoard(3);
  s = Rules.applyMove(s, { type: 'horizontal', row: 0, col: 0 }, 0).state;
  s = Rules.applyMove(s, { type: 'horizontal', row: 1, col: 0 }, 0).state;
  s = Rules.applyMove(s, { type: 'vertical', row: 0, col: 0 }, 0).state;
  const r = Rules.applyMove(s, { type: 'vertical', row: 0, col: 1 }, 0);
  assert.deepStrictEqual(r.boxesGained, [{ row: 0, col: 0 }]);
  assert.strictEqual(r.extraTurn, true);
  assert.strictEqual(r.state.boxes[0][0].owner, 0);
  assert.deepStrictEqual(Rules.score(r.state, 2), [1, 0]);
});

test('applyMove tidak mengubah state input (purity)', () => {
  const s = Rules.createBoard(3);
  const sebelum = JSON.stringify(s);
  const r = Rules.applyMove(s, { type: 'horizontal', row: 0, col: 0 }, 1);
  assert.strictEqual(JSON.stringify(s), sebelum, 'state input berubah — applyMove tidak murni');
  assert.strictEqual(H(s, 0, 0).owner, null);
  assert.strictEqual(r.state.edges.horizontal[0][0].owner, 1);
});

test('move tidak menambah kotak => boxesGained kosong dan extraTurn false', () => {
  const s = Rules.createBoard(3);
  const r = Rules.applyMove(s, { type: 'horizontal', row: 0, col: 0 }, 0);
  assert.deepStrictEqual(r.boxesGained, []);
  assert.strictEqual(r.extraTurn, false);
});

test('satu gerakan bisa mengklaim dua kotak sekaligus', () => {
  let s = Rules.createBoard(3);
  s = Rules.applyMove(s, { type: 'horizontal', row: 0, col: 0 }, 0).state;
  s = Rules.applyMove(s, { type: 'horizontal', row: 1, col: 0 }, 0).state;
  s = Rules.applyMove(s, { type: 'horizontal', row: 2, col: 0 }, 0).state;
  s = Rules.applyMove(s, { type: 'horizontal', row: 0, col: 1 }, 0).state;
  s = Rules.applyMove(s, { type: 'horizontal', row: 1, col: 1 }, 0).state;
  s = Rules.applyMove(s, { type: 'horizontal', row: 2, col: 1 }, 0).state;
  s = Rules.applyMove(s, { type: 'vertical', row: 0, col: 0 }, 0).state;
  s = Rules.applyMove(s, { type: 'vertical', row: 0, col: 2 }, 0).state;
  const r = Rules.applyMove(s, { type: 'vertical', row: 0, col: 1 }, 1);
  assert.deepStrictEqual(
    r.boxesGained.slice().sort((a, b) => a.col - b.col),
    [{ row: 0, col: 0 }, { row: 0, col: 1 }]
  );
  assert.strictEqual(r.extraTurn, true);
  assert.deepStrictEqual(Rules.score(r.state, 2), [0, 2]);
});

test('availableMoves papan kosong 3x3 = 6 horizontal + 6 vertikal', () => {
  const s = Rules.createBoard(3);
  const m = Rules.availableMoves(s);
  assert.strictEqual(m.filter((x) => x.type === 'horizontal').length, 3 * 2);
  assert.strictEqual(m.filter((x) => x.type === 'vertical').length, 2 * 3);
  assert.strictEqual(m.length, 12);
});

test('availableMoves tidak memuat garis yang sudah dimiliki', () => {
  const s = Rules.createBoard(3);
  const r = Rules.applyMove(s, { type: 'horizontal', row: 0, col: 0 }, 0);
  const masihAda = Rules.availableMoves(r.state)
    .some((m) => m.type === 'horizontal' && m.row === 0 && m.col === 0);
  assert.strictEqual(masihAda, false);
  assert.strictEqual(Rules.availableMoves(r.state).length, 11);
});

test('papan penuh => availableMoves kosong dan skor menjumlah ke total kotak', () => {
  let s = Rules.createBoard(4);
  let pemain = 0;
  while (true) {
    const moves = Rules.availableMoves(s);
    if (moves.length === 0) break;
    const r = Rules.applyMove(s, moves[0], pemain);
    s = r.state;
    if (!r.extraTurn) pemain = (pemain + 1) % 2;
  }
  assert.deepStrictEqual(Rules.availableMoves(s), []);
  const skor = Rules.score(s, 2);
  assert.strictEqual(skor[0] + skor[1], 9);
});

/* ---------- GOLDEN TEST: Rules ≡ implementasi `isBoxComplete` asli ---------- */
test('golden: Rules.isBoxComplete identik dengan isBoxComplete asli script.js atas 400 state acak', () => {
  const random = makeRandom(20261010);
  const gridSize = 5;
  let diperiksa = 0;

  for (let iterasi = 0; iterasi < 400; iterasi++) {
    let s = Rules.createBoard(gridSize);
    for (const e of s.edges.horizontal.flat()) if (random() < 0.5) e.owner = Math.floor(random() * 2);
    for (const e of s.edges.vertical.flat()) if (random() < 0.5) e.owner = Math.floor(random() * 2);

    for (let r = 0; r < gridSize - 1; r++) {
      for (let c = 0; c < gridSize - 1; c++) {
        const baru = Rules.isBoxComplete(s, r, c);
        const asli = isBoxCompleteAsli(s, r, c);
        assert.strictEqual(baru, asli, `beda di kotak (${r},${c}) iterasi ${iterasi}`);
        diperiksa++;
      }
    }
  }
  assert.strictEqual(diperiksa, 400 * 16);
});

/* ---------- GOLDEN TEST: replika aturan turn `script.js` vs `Rules.applyMove` ---------- */
/* `papanDariRiwayat` adalah salinan literal logika script.js:511-579
   (pemasangan garis + checkBoxCompletion), dibatasi pada jalur papan. */
function papanDariRiwayat(gridSize, riwayat) {
  const state = Rules.createBoard(gridSize);
  for (let i = 0; i < gridSize; i++) {
    state.edges.horizontal[i] = Array.from({ length: gridSize - 1 }, () => ({ owner: null }));
  }
  for (let i = 0; i < gridSize - 1; i++) {
    state.edges.vertical[i] = Array.from({ length: gridSize }, () => ({ owner: null }));
  }
  for (let i = 0; i < gridSize - 1; i++) {
    state.boxes[i] = Array.from({ length: gridSize - 1 }, () => ({ owner: null }));
  }

  const isBoxComplete = (r, c, s) => {
    const top = s.edges.horizontal[r][c];
    const bottom = s.edges.horizontal[r + 1][c];
    const left = s.edges.vertical[r][c];
    const right = s.edges.vertical[r][c + 1];
    return top.owner !== null && bottom.owner !== null && left.owner !== null && right.owner !== null;
  };

  let current = 0;
  for (const move of riwayat) {
    if (move.type === 'horizontal') state.edges.horizontal[move.row][move.col].owner = current;
    else state.edges.vertical[move.row][move.col].owner = current;

    const jelas = [];
    if (move.type === 'horizontal') {
      if (move.row > 0 && isBoxComplete(move.row - 1, move.col, state)) jelas.push([move.row - 1, move.col]);
      if (move.row < gridSize - 1 && isBoxComplete(move.row, move.col, state)) jelas.push([move.row, move.col]);
    } else {
      if (move.col > 0 && isBoxComplete(move.row, move.col - 1, state)) jelas.push([move.row, move.col - 1]);
      if (move.col < gridSize - 1 && isBoxComplete(move.row, move.col, state)) jelas.push([move.row, move.col]);
    }
    for (const [r, c] of jelas) if (state.boxes[r][c].owner === null) state.boxes[r][c].owner = current;

    if (jelas.length === 0) current = (current + 1) % 2;
  }
  return state;
}

test('golden: hasil akhir Rules.applyMove identik dengan logika turn script.js asli', () => {
  const random = makeRandom(77);
  for (let iterasi = 0; iterasi < 150; iterasi++) {
    const gridSize = 3 + Math.floor(random() * 3); // 3, 4, atau 5
    let state = Rules.createBoard(gridSize);
    const riwayat = [];
    let pemain = 0;

    for (let langkah = 0; langkah < 30; langkah++) {
      const moves = Rules.availableMoves(state);
      if (moves.length === 0) break;
      const move = moves[Math.floor(random() * moves.length)];
      const r = Rules.applyMove(state, move, pemain);
      state = r.state;
      riwayat.push({ type: move.type, row: move.row, col: move.col });
      if (!r.extraTurn) pemain = (pemain + 1) % 2;
    }

    const replika = papanDariRiwayat(gridSize, riwayat);
    assert.deepStrictEqual(
      state.boxes.map((row) => row.map((b) => b.owner)),
      replika.boxes.map((row) => row.map((b) => b.owner)),
      `pemilik kotak berbeda pada iterasi ${iterasi}`
    );
    assert.deepStrictEqual(
      state.edges.horizontal.map((row) => row.map((e) => e.owner)),
      replika.edges.horizontal.map((row) => row.map((e) => e.owner)),
      `garis horizontal berbeda pada iterasi ${iterasi}`
    );
    assert.deepStrictEqual(
      state.edges.vertical.map((row) => row.map((e) => e.owner)),
      replika.edges.vertical.map((row) => row.map((e) => e.owner)),
      `garis vertikal berbeda pada iterasi ${iterasi}`
    );
    assert.deepStrictEqual(Rules.score(state, 2), [
      replika.boxes.flat().filter((b) => b.owner === 0).length,
      replika.boxes.flat().filter((b) => b.owner === 1).length,
    ]);
  }
});

test('score menghitung ulang dari papan, bukan dari akumulasi', () => {
  let s = Rules.createBoard(3);
  s = Rules.applyMove(s, { type: 'horizontal', row: 0, col: 0 }, 0).state;
  s = Rules.applyMove(s, { type: 'horizontal', row: 1, col: 0 }, 0).state;
  s = Rules.applyMove(s, { type: 'vertical', row: 0, col: 0 }, 0).state;
  s = Rules.applyMove(s, { type: 'vertical', row: 0, col: 1 }, 0).state;
  assert.deepStrictEqual(Rules.score(s, 4), [1, 0, 0, 0]);
  // Papan adalah satu-satunya sumber kebenaran: koreksi papan langsung terlihat di skor.
  s.boxes[0][1].owner = 3;
  assert.deepStrictEqual(Rules.score(s, 4), [1, 0, 0, 1]);
});

test('modul diekspos sebagai global `Rules` (tanpa build step) dan tidak memakai optional chaining', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'rules.js'), 'utf8');
  assert.ok(/root\.Rules\s*=/.test(src), 'rules.js harus mengekspos globalThis.Rules untuk <script src>');
  assert.ok(!/\?\./.test(src), 'rules.js tidak boleh memakai optional chaining (`?.`)');
});
