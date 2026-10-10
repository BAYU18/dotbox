/* ============================================================
   Test `ai-engine.js` setelah pindah ke modul aturan `Rules`.

   Jalankan:  node --test test/ai-engine.test.js

   Fokus: AI memakai Rules sebagai sumber aturan tunggal
   (tidak ada lagi pola optional-chaining yang menganggap
   garis tidak ada sebagai "terpasang").
   ============================================================ */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const AIEngine = require('../ai-engine.js');
const Rules = require('../rules.js');

test('getBestMove mengembalikan null saat papan penuh', () => {
  let s = Rules.createBoard(3);
  let pemain = 0;
  while (true) {
    const moves = Rules.availableMoves(s);
    if (moves.length === 0) break;
    const r = Rules.applyMove(s, moves[0], pemain);
    s = r.state;
    if (!r.extraTurn) pemain = (pemain + 1) % 2;
  }
  assert.strictEqual(new AIEngine(3).getBestMove(s, 0), null);
});

test('AI mengambil kotak yang bisa diselesaikan', () => {
  let s = Rules.createBoard(3);
  s = Rules.applyMove(s, { type: 'horizontal', row: 0, col: 0 }, 0).state;
  s = Rules.applyMove(s, { type: 'horizontal', row: 1, col: 0 }, 0).state;
  s = Rules.applyMove(s, { type: 'vertical', row: 0, col: 0 }, 0).state; // kotak (0,0) tinggal 1 sisi
  const move = new AIEngine(3).getBestMove(s, 1);
  assert.deepStrictEqual(move, { type: 'vertical', row: 0, col: 1 });
});

test('simulateMove memakai aturan Rules (memasang garis + mengklaim kotak)', () => {
  const ai = new AIEngine(3);
  let s = Rules.createBoard(3);
  s = Rules.applyMove(s, { type: 'horizontal', row: 0, col: 0 }, 0).state;
  s = Rules.applyMove(s, { type: 'horizontal', row: 1, col: 0 }, 0).state;
  s = Rules.applyMove(s, { type: 'vertical', row: 0, col: 0 }, 0).state;

  const r = ai.simulateMove(s, { type: 'vertical', row: 0, col: 1 }, 1);
  assert.strictEqual(r.extraTurn, true);
  assert.strictEqual(r.state.boxes[0][0].owner, 1);
  assert.strictEqual(r.state.edges.vertical[0][1].owner, 1);
  // tidak mengubah input (clone)
  assert.strictEqual(s.boxes[0][0].owner, null);
});

test('playAITurn (jalur lama) tidak lagi ada, atau tidak berisi loop tak terbatas', () => {
  const ai = new AIEngine(3);
  if (typeof ai.playAITurn === 'function') {
    // Bila dipertahankan, ia harus memakai Rules & berhenti sendiri.
    let s = Rules.createBoard(3);
    const pemain = [{ id: 0, isAI: true }, { id: 1, isAI: true }];
    s.players = pemain;
    const hasil = ai.playAITurn(s, 0);
    assert.ok(hasil.state, 'playAITurn harus mengembalikan state');
    assert.ok(Rules.availableMoves(hasil.state).length < Rules.availableMoves(s).length);
  }
});

test('tidak ada pola optional-chaining `?.` di ai-engine.js', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'ai-engine.js'), 'utf8');
  assert.ok(
    !/\?\./.test(src),
    'ai-engine.js masih memakai optional chaining — hazard phantom edge belum dihapus'
  );
});
