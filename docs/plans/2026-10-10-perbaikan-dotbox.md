# Perbaikan dotbox: modul aturan murni + kejujuran AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghapus duplikasi aturan kotak dan hazard laten `?.owner !== null`, menjadikan `aiDepth` benar-benar berpengaruh (minimax + alpha-beta ternilai rendah dulu), serta menegakkan giliran AI lewat satu titik serialisasi — tanpa mengubah cara pemain memakai game (tetap buka `index.html`).

**Architecture:** Satu modul aturan murni `rules.js` menjadi *seam* tunggal (interface kecil: `createBoard`, `availableMoves`, `applyMove`, `isBoxComplete`, `score`). `script.js` dan `ai-engine.js` menjadi konsumen modul itu. AI diubah dari greedy menjadi pencarian minimax + alpha-beta yang menghormati `aiDepth`. Automatisasi giliran AI dipindah ke satu antrian `pendingAITurn` agar tidak ada re-entry ganda.

**Tech Stack:** Vanilla JS (ES6), HTML5 Canvas, `localStorage`. Test: Node's built-in `node:test` (tanpa dependency eksternal, konsisten dengan "no build").

**Spec:** `docs/superpowers/specs/2026-10-10-perbaikan-dotbox-design.md` (desain) + `LAPORAN-REVIEW.md` §2 dan `docs/adr/0001-seam-aturan-murni.md`, `docs/adr/0002-jangan-janjikan-minimax.md`.

## Global Constraints

- Tetap **tanpa build step**: berkas dimuat lewat `<script src>`; modul aturan diekspos sebagai global `Rules` **dan** `module.exports` (pola yang sudah dipakai `ai-engine.js:338-340`).
- Bahasa komentar & pesan UI: **Indonesia**.
- Semua nama fungsi aturan kanonik (jangan diganti): `createBoard`, `availableMoves`, `applyMove`, `isBoxComplete`, `score`.
- Nilai kanonik "belum dimiliki" adalah `owner === null` (lihat `GLOSSARY.md`).
- Perilaku permainan untuk pemain manusia **tidak berubah** setelah Task 1–3 (refactor murni harus menghasilkan papan identik).
- Test command: `node --test` dari root repo.

## Review Focus

Input/kondisi yang tak diuji spec tapi berpotensi menggigit, paling mungkin dahulu — masing-masing mendapat test yang ditambatkan ke task pemiliknya:

1. Klik pada garis yang **sudah dimiliki** → harus ditolak, bukan bikin state korup (Task 3).
2. Papan penuh (`isGameOver`) lalu pemain/AI mencoba bergerak → tidak ada crash / tidak ada setTimeout AI nyangkut (Task 3, Task 5).
3. `gridSize` besar (7×7) + `aiDepth=5` → UI tidak membeku; pencarian punya batas (Task 4).
4. Save lama dimuat (`loadGame`) saat aplikasi baru (struktur edges sudah berubah) → tidak crash, fallback aman (Task 6).
5. Pemain semua-AI (`humanCount < 1`) → ditolak di konfigurasi (sudah ada guard `script.js:1054`); pastikan tetap berlaku setelah refactor (Task 5).

---

### Task 1: Buat modul aturan murni `rules.js` (tanpa mengubah `script.js`/`ai-engine.js`)

**Files:**
- Create: `rules.js`
- Test: `test/rules.test.js`

**Interfaces:**
- Consumes: tidak ada.
- Produces:
  - `Rules.createBoard(gridSize: number) -> State` — `State = { config:{gridSize}, edges:{horizontal:Edge[][], vertical:Edge[][]}, boxes:Box[][] }` dengan `Edge={owner:null}`, `Box={owner:null, edges:{top,bottom,left,right}}`.
  - `Rules.availableMoves(state) -> Move[]` — `Move={type:'horizontal'|'vertical', row, col}`.
  - `Rules.isBoxComplete(state, r, c) -> boolean`.
  - `Rules.applyMove(state, move, player) -> { state, boxesGained: {row,col}[], extraTurn: boolean }` (state baru; input tidak diubah).
  - `Rules.score(state, playerCount) -> number[]`.

- [ ] **Step 1: Tulis test yang gagal**

```js
// test/rules.test.js
const test = require('node:test');
const assert = require('node:assert');
const Rules = require('../rules.js');

test('papan kosong 3x3 tidak punya kotak selesai', () => {
  const s = Rules.createBoard(3);
  assert.strictEqual(Rules.isBoxComplete(s, 0, 0), false);
});

test('sudut (0,0) tidak boleh dianggap selesai walau index tidak ada', () => {
  const s = Rules.createBoard(3);
  // isBoxComplete harus menolak r<0 / c<0 / r>grid-2 / c>grid-2, bukan baca index undefined
  assert.strictEqual(Rules.isBoxComplete(s, -1, 0), false);
  assert.strictEqual(Rules.isBoxComplete(s, 0, -1), false);
});

test('empat garis mengklaim kotak dan memberi giliran ekstra', () => {
  const s = Rules.createBoard(3);
  Rules.applyMove(s, { type: 'horizontal', row: 0, col: 0 }, 0);
  Rules.applyMove(s, { type: 'horizontal', row: 1, col: 0 }, 0);
  Rules.applyMove(s, { type: 'vertical', row: 0, col: 0 }, 0);
  const r = Rules.applyMove(s, { type: 'vertical', row: 0, col: 1 }, 0);
  assert.deepStrictEqual(r.boxesGained, [{ row: 0, col: 0 }]);
  assert.strictEqual(r.extraTurn, true);
  assert.deepStrictEqual(Rules.score(r.state, 2), [1, 0]);
});

test('move tidak menambah kotak -> extraTurn false', () => {
  const s = Rules.createBoard(3);
  const r = Rules.applyMove(s, { type: 'horizontal', row: 0, col: 0 }, 0);
  assert.deepStrictEqual(r.boxesGained, []);
  assert.strictEqual(r.extraTurn, false);
});

test('availableMoves papan kosong 3x3 = 12 horizontal + 12 vertikal', () => {
  const s = Rules.createBoard(3);
  const m = Rules.availableMoves(s);
  assert.strictEqual(m.filter(x => x.type === 'horizontal').length, 3 * 2);
  assert.strictEqual(m.filter(x => x.type === 'vertical').length, 2 * 3);
});
```

- [ ] **Step 2: Jalankan test, pastikan GAGAL**

Run: `node --test test/rules.test.js`
Expected: FAIL — `Cannot find module '../rules.js'`.

- [ ] **Step 3: Implementasi `rules.js`**

Hanya tulis badan bila signature+test belum menentukannya. Kunci: **tidak memakai `?.`**; selalu cek batas lebih dulu dengan guard eksplisit (`r < 0 || c < 0 || r > grid-2 || c > grid-2` → `false`), sehingga garis yang tidak ada tak pernah dibaca. `applyMove` meng-clone state (deep-copy edges/boxes) supaya pemanggil murni.

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `node --test test/rules.test.js`
Expected: PASS (5 test).

- [ ] **Step 5: Commit**

```bash
git add rules.js test/rules.test.js
git commit -m "feat: modul aturan murni rules.js dengan test Node"
```

---

### Task 2: Pindahkan `ai-engine.js` memakai `Rules` (hapus `?.`)

**Files:**
- Modify: `ai-engine.js:148-253` (`isBoxAlmostComplete`, `applyCompletedBoxes`), `:208-220` (`simulateMove`)
- Test: `test/ai-engine.test.js`

**Interfaces:**
- Consumes: `Rules` dari Task 1 (`require('./rules.js')`).
- Produces (tak berubah dari konsumen): `AIEngine.getBestMove(state, player) -> Move|null`; `AIEngine.cloneState(state) -> State`. `isBoxAlmostComplete(state,r,c)` **dihapus** dari interface publik (diganti panggilan `Rules`).

- [ ] **Step 1: Tulis test yang gagal**

```js
// test/ai-engine.test.js
const test = require('node:test');
const assert = require('node:assert');
const AIEngine = require('../ai-engine.js');
const Rules = require('../rules.js');

test('getBestMove mengembalikan null saat papan penuh', () => {
  const s = Rules.createBoard(3);
  for (const m of Rules.availableMoves(s)) Rules.applyMove(s, m, 0);
  assert.strictEqual(new AIEngine(3).getBestMove(s, 0), null);
});

test('AI mengambil kotak yang bisa diselesaikan', () => {
  const s = Rules.createBoard(3);
  Rules.applyMove(s, { type: 'horizontal', row: 0, col: 0 }, 0);
  Rules.applyMove(s, { type: 'horizontal', row: 1, col: 0 }, 0);
  Rules.applyMove(s, { type: 'vertical', row: 0, col: 0 }, 0);
  const move = new AIEngine(3).getBestMove(s, 1);
  assert.deepStrictEqual(move, { type: 'vertical', row: 0, col: 1 });
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

Run: `node --test test/ai-engine.test.js`
Expected: FAIL — `Cannot find module '../rules.js'` (Task 1 belum di-commit ke checkout ini) **atau** assertion AI memilih move lain.

- [ ] **Step 3: Refactor `ai-engine.js`**

Ganti badan `isBoxAlmostComplete`/`applyCompletedBoxes`/`simulateMove` agar memakai `Rules.isBoxComplete` dan `Rules.applyMove`. Hapus pola `?.owner !== null` sepenuhnya. Jaga `getBestMove` tetap memanggil `this.getBoxCompletingMoves` (perilaku "selalu ambil kotak").

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `node --test test/ai-engine.test.js`
Expected: PASS (2 test).

- [ ] **Step 5: Commit**

```bash
git add ai-engine.js test/ai-engine.test.js
git commit -m "refactor: ai-engine memakai Rules, hapus pola ?.owner !== null"
```

---

### Task 3: Pindahkan `script.js` memakai `Rules` (server adapter)

**Files:**
- Modify: `script.js:511-623` (`makeMove`, `checkBoxCompletion`, `isBoxComplete`), `:652-679` (`updateScores`, `isGameOver`)
- Modify: `index.html:116-117` (tambah `<script src="rules.js">` **sebelum** `ai-engine.js`)
- Test: `test/script-moves.test.js` (ekstrak fungsi murni — bukan DOM)

**Interfaces:**
- Consumes: `Rules` (Task 1).
- Produces: `gameState` tetap bentuk yang sama; fungsi papan (`isBoxComplete`) delegasi ke `Rules`.

- [ ] **Step 1: Tulis test yang gagal** untuk aturan "klik garis yang sudah dimiliki ditolak" pada lapisan murni:

```js
// test/script-moves.test.js
const test = require('node:test');
const assert = require('node:assert');
const Rules = require('../rules.js');

test('garis yang sudah dimiliki tidak muncul di availableMoves', () => {
  const s = Rules.createBoard(3);
  Rules.applyMove(s, { type: 'horizontal', row: 0, col: 0 }, 0);
  const stillThere = Rules.availableMoves(s)
    .some(m => m.type === 'horizontal' && m.row === 0 && m.col === 0);
  assert.strictEqual(stillThere, false);
});
```

- [ ] **Step 2: Jalankan, pastikan LULUS** (test ini mengunci kontrak `Rules`; ini penjaga agar `script.js` tak bisa diam-diam meregresi).

Run: `node --test test/script-moves.test.js`
Expected: PASS.

- [ ] **Step 3: Ubah `script.js`**

- `isBoxComplete(row,col)` → delegasi: `return Rules.isBoxComplete(gameState, row, col);`
- `checkBoxCompletion(type,row,col)` → `const r = Rules.applyMove(gameState, {type,row,col}, gameState.currentPlayerIndex); gameState = Object.assign(gameState, { edges: r.state.edges, boxes: r.state.boxes }); return r.boxesGained;` (ganti `const gameState` global mutable dengan pola yang konsisten; bila terlalu besar, minimal delegasikan perhitungan kotak).
- `updateScores` → `gameState.scores = Rules.score(gameState, gameState.players.length);`
- `isGameOver` → hitung dari `Rules.score` atau helper `Rules.allBoxesFilled(state)`.

- [ ] **Step 4: Verifikasi manual** dengan membuka `index.html` di browser: 2 pemain, grid 3×3, klaim kotak → giliran ekstra masih berlaku, skor benar, tidak ada error di console.

- [ ] **Step 5: Commit**

```bash
git add script.js index.html test/script-moves.test.js
git commit -m "refactor: script.js memakai Rules sebagai sumber aturan tunggal"
```

---

### Task 4: Ganti heuristik greedy dengan minimax + alpha-beta ber-`aiDepth`

**Files:**
- Modify: `ai-engine.js:43-311` (ganti `getBestMove`, `pickBestMoveWithRandomness`, `pickLeastDamagingMove`, `evaluateMove`)
- Test: `test/ai-search.test.js`

**Interfaces:**
- Consumes: `Rules` (Task 1).
- Produces: `AIEngine.search(state, player, depth, alpha, beta) -> number` (internal); `AIEngine.getBestMove(state, player) -> Move|null` (publik, tak berubah). `this.depth` dari `aiDepth` kini **berpengaruh**.

- [ ] **Step 1: Tulis test yang gagal**

```js
// test/ai-search.test.js
const test = require('node:test');
const assert = require('node:assert');
const AIEngine = require('../ai-engine.js');
const Rules = require('../rules.js');

test('depth lebih dalam tidak melemahkan hasil (move legal)', () => {
  const s = Rules.createBoard(4);
  Rules.applyMove(s, { type: 'horizontal', row: 0, col: 0 }, 0);
  const m = new AIEngine(4).getBestMove(s, 1);
  assert.ok(Rules.availableMoves(s).some(x => JSON.stringify(x) === JSON.stringify(m)));
});

test('pencarian depth=5 pada 7x7 selesai < 2 detik', () => {
  const s = Rules.createBoard(7);
  const t0 = Date.now();
  new AIEngine(5).getBestMove(s, 0);
  assert.ok(Date.now() - t0 < 2000, 'pencarian terlalu lambat');
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL** (test kedua timeout karena depth diabaikan tidak relevan; setelah implementasi harus lulus).

Run: `node --test test/ai-search.test.js`
Expected: FAIL pada test kedua bila implementasi naif, atau PASS keduanya setelah dibatasi waktu.

- [ ] **Step 3: Implementasi minimax + alpha-beta**

`evaluate(state, player) = 100*myBoxes - 50*oppBoxes`. `search(state, player, depth, alpha, beta)`: bila `depth===0` atau tak ada move → kembalikan evaluasi. Bila move mengklaim kotak, giliran tetap `player` (recurse pada `player` yang sama, jangan turunkan depth untuk langkah berantai agar rantai kotak dituntaskan dalam satu langkah-langkah pemain). Wajib ada **time budget** (mis. `Date.now() - t0 > 1500ms` → berhenti, kembalikan best-so-far) agar Review Focus #3 aman.

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `node --test test/ai-search.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ai-engine.js test/ai-search.test.js
git commit -m "feat: minimax + alpha-beta dengan aiDepth dan time budget"
```

---

### Task 5: Satu titik serialisasi giliran AI (hapus re-entry ganda)

**Files:**
- Modify: `script.js:164-167`, `:570-573`, `:625-639`, `:741-774`
- Test: `test/turn.test.js` (uji helper antrian murni, tanpa browser)

**Interfaces:**
- Consumes: tidak ada.
- Produces: `scheduleAITurn()` — satu-satunya jalan masuk otomatisasi AI; menolak bila `gameState.isGameOver || gameState.isReplayMode || !players[current].isAI`.

- [ ] **Step 1: Tulis test yang gagal** untuk guard murni:

```js
// test/turn.test.js
const test = require('node:test');
const assert = require('node:assert');
const { shouldScheduleAI } = require('../turn-queue.js');

test('tidak menjadwalkan AI saat game over', () => {
  const gs = { isGameOver: true, isReplayMode: false, currentPlayerIndex: 0,
    players: [{ isAI: true }] };
  assert.strictEqual(shouldScheduleAI(gs), false);
});

test('menjadwalkan AI saat giliran AI normal', () => {
  const gs = { isGameOver: false, isReplayMode: false, currentPlayerIndex: 0,
    players: [{ isAI: true }] };
  assert.strictEqual(shouldScheduleAI(gs), true);
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

Run: `node --test test/turn.test.js`
Expected: FAIL — `Cannot find module '../turn-queue.js'`.

- [ ] **Step 3: Implementasi `turn-queue.js`** (`shouldScheduleAI(gs)` + `createTurnQueue()` yang memastikan hanya satu `setTimeout` AI aktif) dan pakai di `script.js`: ganti kedua `setTimeout(() => makeAIMove(), ...)` (baris 572, 637) dan pemanggilan di `initGame` (166) menjadi `scheduleAITurn()`.

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `node --test test/turn.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add turn-queue.js script.js test/turn.test.js
git commit -m "fix: satu titik serialisasi giliran AI via turn-queue"
```

---

### Task 6: Skema versi untuk save/load + guard Review Focus #4

**Files:**
- Modify: `script.js:777-830` (`saveGame`, `loadGame`)
- Test: `test/save-schema.test.js`

**Interfaces:**
- Consumes: `Rules.createBoard`.
- Produces: `SAVE_SCHEMA_VERSION = 2`; `loadGame()` menolak save dengan `version !== 2` dengan pesan toast, tidak crash.

- [ ] **Step 1: Tulis test yang gagal**

```js
// test/save-schema.test.js
const test = require('node:test');
const assert = require('node:assert');
const { migrateSave } = require('../save-schema.js');

test('save lama tanpa version ditolak dengan aman', () => {
  assert.strictEqual(migrateSave({ edges: {}, boxes: {} }), null);
});

test('save versi 2 diterima', () => {
  const s = { version: 2, config: { gridSize: 3 } };
  assert.deepStrictEqual(migrateSave(s), s);
});
```

- [ ] **Step 2: Jalankan, pastikan GAGAL**

Run: `node --test test/save-schema.test.js`
Expected: FAIL — modul tidak ada.

- [ ] **Step 3: Implementasi `save-schema.js`** dan pakai di `saveGame`/`loadGame`; `loadGame` memanggil `migrateSave`, bila `null` → `showToast('Save lama tidak kompatibel, mulai baru')` dan `return false`.

- [ ] **Step 4: Jalankan test, pastikan LULUS**

Run: `node --test test/save-schema.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add save-schema.js script.js test/save-schema.test.js
git commit -m "feat: versi skema save/load + migrasi aman"
```

---

### Task 7: Rapikan dokumentasi (tutup ADR-0002 jalur b)

**Files:**
- Modify: `README.md:38-52`

- [ ] **Step 1: Perbarui README** — bila Task 4 sudah mendarat, deskripsikan minimax + alpha-beta **dengan benar** (sebutkan kedalaman dihormati & time budget); sekaligus **hapus penanda status jujur** bila ada. Bila Task 4 **belum** mendarat, README **wajib** memuat penanda status jujur (mis. "AI masih heuristik; minimax dalam pengerjaan") dan hapus kata "Minimax/Alpha-Beta". Penanda ini **wajib** selama masa transisi P0→P2 (lihat spec §6); jangan pernah membiarkan README menjanjikan minimax sementara kode belum memilikinya.
- [ ] **Step 2: Verifikasi** bahwa `grep -n -i "minimax\|alpha-beta" README.md ai-engine.js` konsisten (klaim ⇔ kode) — bila kode belum memiliki minimax, README tidak boleh memuat kata itu tanpa penanda status. Perilaku AI diuji lewat `test/ai-search.test.js` (≥95% pilih edge penutup kotak); `grep` hanya informational, bukan gate.
- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: selaraskan README dengan implementasi AI"
```

---

## Self-Review

**1. Cakupan spec:** ADR-0001 (seam tunggal) → Task 1–3. ADR-0002 (kejujuran AI) → Task 4 + Task 7. Hazard laten `?.` → Task 1–2. Re-entry giliran → Task 5. Save/load → Task 6. Semua rekomendasi inti punya task. Item non-blokir (PWA, ARIA, prefers-reduced-motion) **di luar** plan ini dengan sengaja — itu fitur, bukan perbaikan hazard.

**2. Step scan:** tiap langkah menghasilkan satu hal yang bisa dicek (test gagal → implementasi → test lulus → commit).

**3. Konsistensi tipe:** nama fungsi kanonik (`createBoard`/`availableMoves`/`applyMove`/`isBoxComplete`/`score`) dipakai identik di Task 1–6; `Move` konsisten `{type,row,col}`; `applyMove` selalu mengembalikan `{state,boxesGained,extraTurn}`.

**4. Review Focus:** 5 input risiko masing-masing ditambatkan (Task 3, Task 3+5, Task 4, Task 6, Task 5).

**5. Proporsi:** plan ≈ 2× spec (LAPORAN §2 + 2 ADR); blok kode dibatasi pada test & signature, bukan transkrip program.
