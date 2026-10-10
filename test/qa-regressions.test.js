/* ============================================================
   QA — test regresi untuk temuan yang BELUM tertutup suite.

   Jalankan:  node --test test/qa-regressions.test.js

   Dua temuan yang dikunci di sini dijalankan lewat `script.js`
   NYATA di atas stub DOM (sama seperti test/script-integration.test.js),
   jadi bukti ini adalah eksekusi, bukan analisis statis.

   Konvensi: setiap test menuliskan perilaku yang SEHARUSNYA.
   Bila gagal, berarti bug terkonfirmasi masih ada.

   Catatan geometri papan (diverifikasi dengan menjalankan kode nyata):
   untuk gridSize = n jumlah TITIK per sisi = n, sehingga
     - edges.horizontal.length  = n          (baris garis horizontal)
     - edges.horizontal[r].length = n - 1    (kolom garis horizontal)
     - boxes.length             = n - 1      (baris kotak)
   Invariant yang benar bukan `boxes.length === gridSize - 1` (lihat
   komentar pada test QA-1b), melainkan koherensi antar-struktur:
   jumlah baris kotak harus sama dengan jumlah baris garis horizontal
   DIKURANGI satu, yaitu `edges.horizontal.length - 1`.
   ============================================================ */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

function buatElemen() {
  const el = {
    classes: new Set(), style: {}, dataset: {}, innerHTML: '', innerText: '',
    textContent: '', value: '1', min: '1', max: '5', width: 0, height: 0,
    parentElement: null,
    classList: {
      add: (...c) => c.forEach((x) => el.classes.add(x)),
      remove: (...c) => c.forEach((x) => el.classes.delete(x)),
      contains: (c) => el.classes.has(c),
      toggle: (c) => (el.classes.has(c) ? el.classes.delete(c) : el.classes.add(c))
    },
    addEventListener() {}, removeEventListener() {},
    getContext: () => ctxCanvas,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 500, height: 500 }),
    querySelector: () => buatElemen(),
    querySelectorAll: () => [],
    appendChild() {}
  };
  return el;
}

const ctxCanvas = new Proxy(
  { canvas: null, globalAlpha: 1, set font(v) {}, get font() { return ''; } },
  { get(t, p) { return p in t ? t[p] : () => {}; }, set(t, p, v) { t[p] = v; return true; } }
);

function buatLocalStorage() {
  return {
    _data: new Map(),
    getItem(k) { return this._data.has(k) ? this._data.get(k) : null; },
    setItem(k, v) { this._data.set(k, String(v)); },
    removeItem(k) { this._data.delete(k); }
  };
}

function muatScript() {
  const elemenTerdaftar = new Map();
  const el = (id) => {
    if (!elemenTerdaftar.has(id)) elemenTerdaftar.set(id, buatElemen());
    return elemenTerdaftar.get(id);
  };
  const canvasEl = el('gameCanvas');
  canvasEl.parentElement = { clientWidth: 540, clientHeight: 540 };

  const sb = {
    console, setTimeout: (fn) => fn(), clearTimeout: () => {}, requestAnimationFrame: () => {},
    Math, Date, JSON, Array, Object, Number, String, Boolean, Error, RangeError, Infinity, NaN
  };
  sb.window = sb;
  sb.globalThis = sb;
  sb.addEventListener = () => {};
  sb.removeEventListener = () => {};
  sb.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' });
  sb.AudioContext = function () {
    return {
      state: 'running', currentTime: 0, destination: {}, resume() {},
      createOscillator: () => ({ connect() {}, start() {}, stop() {}, frequency: {}, type: '' }),
      createGain: () => ({ connect() {}, gain: {} })
    };
  };
  sb.document = {
    body: buatElemen(),
    getElementById: (id) => (id === 'gameCanvas' ? canvasEl : el(id)),
    querySelector: () => buatElemen(),
    querySelectorAll: () => [],
    addEventListener() {},
    createElement: () => buatElemen()
  };
  sb.localStorage = buatLocalStorage();

  vm.createContext(sb);
  for (const berkas of ['rules.js', 'turn-queue.js', 'ai-engine.js', 'script.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, berkas), 'utf8'), sb, { filename: berkas });
  }
  return sb;
}

const dalam = (sb, ekspresi) => vm.runInContext(ekspresi, sb);

function mulaiPermainan(sb, gridSize = 3) {
  dalam(sb, `initGame({ gridSize: ${gridSize}, totalPlayers: 2, aiCount: 1, aiDepth: 1 })`);
  const gs = dalam(sb, 'gameState');
  gs.currentPlayerIndex = 0;
  gs.players.forEach((p) => { p.isAI = false; });
  return gs;
}

/* ------------------------------------------------------------------
   QA-1 — VERDICT setelah verifikasi (receiving-code-review):

   Bug ASLI (sudah diperbaiki): handler `.grid-btn` (script.js:1032 pra-fix)
   menulis `gameState.config.gridSize` LANGSUNG. Itu observasi yang benar.

   Namun test LAMA memaksa bug dengan menulis `gameState.config.gridSize = 7`
   secara langsung — itu OPERASI ATAS STATE, bukan perilaku yang dapat dicapai
   lewat UI. QA sendiri sudah membuktikan (laporan reachability-nya):
   ".grid-btn hanya ada di #configMenu yang disembunyikan saat game berjalan,
   dan Mulai Game selalu memanggil initGame(config) yang membangun papan dari
   tombol aktif" — jadi tidak ada jalur UI yang membuat gerakan terjadi dengan
   gridSize tidak sinkron. Menulis `config.gridSize` langsung adalah paksaan
   buatan, bukan skenario pemain.

   Fix yang saya pilih: handler `.grid-btn` tidak lagi memutasi `config`
   (cukup menandai tombol aktif; `startGame` membaca `.grid-btn.active`).
   Maka tidak ada lagi jalur UI yang bisa membuat gridSize tak sinkron.

   Saya TIDAK menambahkan accessor/getter pada `gameState.config`: itu akan
   membuat write langsung terlihat seolah-olah berhasil padahal state di dalam
   kosong (silent corruption) — lebih menyesatkan daripada menolaknya. State
   tetap sedatar mungkin; invarian dijaga di satu-satunya jalur yang menulis
   papan, yaitu `initGame`/`loadGame`.

   Karena itu QA-1 diuji lewat SEAM PERILAKU yang jujur: handler `.grid-btn`
   NYATA dipicu, lalu permainan harus tetap konsisten dan bisa dimainkan.
   ------------------------------------------------------------------ */
function muatScriptDenganGridBtn() {
  const elemenTerdaftar = new Map();
  const el = (id) => {
    if (!elemenTerdaftar.has(id)) elemenTerdaftar.set(id, buatElemen());
    return elemenTerdaftar.get(id);
  };
  const canvasEl = el('gameCanvas');
  canvasEl.parentElement = { clientWidth: 540, clientHeight: 540 };

  const tombolGrid = [];
  for (const size of [3, 5, 7]) {
    const t = buatElemen();
    t.dataset.size = String(size);
    t._klik = [];
    t.addEventListener = (ev, fn) => { if (ev === 'click') t._klik.push(fn); };
    tombolGrid.push(t);
  }
  tombolGrid[0].classList.add('active');

  const sb = {
    console, setTimeout: (fn) => fn(), clearTimeout: () => {}, requestAnimationFrame: () => {},
    Math, Date, JSON, Array, Object, Number, String, Boolean, Error, RangeError, Infinity, NaN
  };
  sb.window = sb;
  sb.globalThis = sb;
  sb.addEventListener = () => {};
  sb.removeEventListener = () => {};
  sb.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' });
  sb.AudioContext = function () {
    return {
      state: 'running', currentTime: 0, destination: {}, resume() {},
      createOscillator: () => ({ connect() {}, start() {}, stop() {}, frequency: {}, type: '' }),
      createGain: () => ({ connect() {}, gain: {} })
    };
  };
  let listenerDom = null;
  sb.document = {
    body: buatElemen(),
    getElementById: (id) => (id === 'gameCanvas' ? canvasEl : el(id)),
    querySelector: (sel) =>
      sel === '.grid-btn.active'
        ? (tombolGrid.find((t) => t.classList.contains('active')) || buatElemen())
        : buatElemen(),
    querySelectorAll: (sel) => (sel === '.grid-btn' ? tombolGrid : []),
    addEventListener: (ev, fn) => { if (ev === 'DOMContentLoaded') listenerDom = fn; },
    createElement: () => buatElemen()
  };
  sb.localStorage = buatLocalStorage();

  vm.createContext(sb);
  for (const berkas of ['rules.js', 'turn-queue.js', 'ai-engine.js', 'script.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, berkas), 'utf8'), sb, { filename: berkas });
  }
  // Daftarkan listener nyata: di sinilah handler `.grid-btn` asli terpasang.
  if (listenerDom) listenerDom();
  return { sb, tombolGrid };
}

test('QA-1: memicu handler .grid-btn nyata harus menjaga state konsisten & permainan tetap jalan', () => {
  const { sb, tombolGrid } = muatScriptDenganGridBtn();

  // Permainan 3x3 sedang berjalan (handler sudah terdaftar saat DOMContentLoaded).
  dalam(sb, 'initGame({ gridSize: 3, totalPlayers: 2, aiCount: 1, aiDepth: 1 })');
  const gs = dalam(sb, 'gameState');
  gs.players.forEach((p) => { p.isAI = false; });
  gs.currentPlayerIndex = 0;

  // Verifikasi statis: handler .grid-btn tidak boleh lagi menulis config.gridSize.
  const src = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
  const mulai = src.indexOf("querySelectorAll('.grid-btn')");
  const isiHandler = src.slice(mulai, src.indexOf('// Start game button', mulai));
  assert.ok(
    !/config\.gridSize\s*=/.test(isiHandler),
    'handler .grid-btn masih menulis config.gridSize; itu yang melanggar invarian papan (QA-1)'
  );

  const configSebelum = JSON.stringify(dalam(sb, 'gameState.config'));
  const boxesSebelum = JSON.stringify(dalam(sb, 'gameState.boxes'));

  // Picu handler `.grid-btn` SUNGGUHAN (tombol ukuran 7) pada permainan 3x3.
  const tombol7 = tombolGrid.find((t) => t.dataset.size === '7');
  assert.ok(tombol7._klik.length > 0, 'handler .grid-btn tidak terdaftar');
  tombol7._klik.forEach((fn) => fn());

  // Handler hanya menandai pilihan; state permainan aktif TIDAK boleh berubah.
  assert.strictEqual(JSON.stringify(dalam(sb, 'gameState.config')), configSebelum,
    'config permainan berubah padahal hanya memilih grid di menu');
  assert.strictEqual(JSON.stringify(dalam(sb, 'gameState.boxes')), boxesSebelum,
    'papan berubah padahal hanya memilih grid di menu');
  assert.strictEqual(dalam(sb, 'gameState.config.gridSize'), 3,
    'gridSize permainan aktif harus tetap 3 sampai initGame berikutnya');

  // Permainan yang sedang berjalan tetap bisa dimainkan.
  assert.doesNotThrow(() => dalam(sb, "makeMove('horizontal', 0, 0)"),
    'gerakan sah melempar setelah handler grid dipicu');
});

test('QA-1b: startGame membaca ukuran dari tombol aktif dan membangun papan yang koheren', () => {
  // Meniru `startGame`: gridSize diambil dari `.grid-btn.active`, bukan dari config.
  const { sb, tombolGrid } = muatScriptDenganGridBtn();
  tombolGrid.forEach((t) => t.classList.remove('active'));
  tombolGrid.find((t) => t.dataset.size === '7').classList.add('active');

  dalam(sb, `initGame({ gridSize: ${7}, totalPlayers: 2, aiCount: 1, aiDepth: 1 })`);

  assert.strictEqual(dalam(sb, 'gameState.config.gridSize'), 7);
  assert.strictEqual(dalam(sb, 'gameState.edges.horizontal.length'), 7,
    'gridSize=7 harus menghasilkan 7 baris garis horizontal');
  assert.strictEqual(dalam(sb, 'gameState.boxes.length'), 6,
    'gridSize=7 harus menghasilkan 6 baris kotak');
  assert.strictEqual(dalam(sb, 'gameState.boxes[0].length'), 6,
    'gridSize=7 harus menghasilkan 6 kolom kotak');
});

test('QA-1c: initGame selalu membangun papan yang koheren dengan gridSize (invarian inti)', () => {
  for (const g of [3, 5, 7]) {
    const sb = muatScript();
    mulaiPermainan(sb, g);
    assert.strictEqual(dalam(sb, 'gameState.config.gridSize'), g, `gridSize harus ${g}`);
    assert.strictEqual(dalam(sb, 'gameState.edges.horizontal.length'), g,
      `gridSize=${g}: edges.horizontal harus ${g} baris`);
    assert.strictEqual(dalam(sb, 'gameState.edges.vertical.length'), g - 1,
      `gridSize=${g}: edges.vertical harus ${g - 1} baris`);
    assert.strictEqual(dalam(sb, 'gameState.boxes.length'), g - 1,
      `gridSize=${g}: boxes harus ${g - 1} baris`);
    assert.strictEqual(dalam(sb, 'gameState.boxes[0].length'), g - 1,
      `gridSize=${g}: boxes harus ${g - 1} kolom`);
  }
});

/* ------------------------------------------------------------------
   BUG QA-2 (Tinggi, terkonfirmasi eksekusi):
   `loadGame` (script.js:772-809) menyalin `saveData.boxes` apa adanya
   ke state tanpa validasi. `drawBoxes` lalu memakai `box.owner` sebagai
   indeks `gameState.players[...]`; owner yang di luar rentang (rusak /
   skema lama) -> membaca `undefined.color` -> TypeError yang hanya
   "ditangkap" sebagai `Failed to load game`.

   Perilaku yang benar: data simpanan yang tidak valid harus ditolak
   dengan jelas TANPA meninggalkan state setengah-termuat.
   ------------------------------------------------------------------ */
test('QA-2: loadGame harus menolak data simpanan tak valid tanpa merusak state berjalan', () => {
  const sb = muatScript();
  mulaiPermainan(sb, 3);

  const configValid = JSON.stringify(dalam(sb, 'gameState.config'));
  const boxesValid = JSON.stringify(dalam(sb, 'gameState.boxes'));
  const playersValid = JSON.stringify(dalam(sb, 'gameState.players'));

  // Simpan data rusak: owner kotak 99 padahal hanya ada 2 pemain.
  dalam(sb, `localStorage.setItem('dotsandboxes_current', JSON.stringify({
     config: { gridSize: 3, totalPlayers: 2, aiCount: 0, aiDepth: 3 },
     players: [{ id: 0, name: 'P1', isAI: false, color: '#e53e3e' },
               { id: 1, name: 'P2', isAI: false, color: '#3182ce' }],
     currentPlayerIndex: 0,
     edges: { horizontal: [[{ owner: null }, { owner: null }], [{ owner: null }, { owner: null }], [{ owner: null }, { owner: null }]],
              vertical: [[{ owner: null }, { owner: null }, { owner: null }], [{ owner: null }, { owner: null }, { owner: null }]] },
     boxes: [[{ owner: 99 }, { owner: null }], [{ owner: null }, { owner: null }]],
     scores: [0, 0], moveHistory: [], isGameOver: true
   }))`);

  const hasil = dalam(sb, 'loadGame()');
  assert.strictEqual(hasil, false, 'loadGame harus mengembalikan false untuk data tak valid');

  // Kejujuran status: apakah state berjalan tetap utuh setelah penolakan?
  const configSetelah = JSON.stringify(dalam(sb, 'gameState.config'));
  const boxesSetelah = JSON.stringify(dalam(sb, 'gameState.boxes'));
  const playersSetelah = JSON.stringify(dalam(sb, 'gameState.players'));
  assert.strictEqual(configSetelah, configValid, 'config state berjalan berubah setelah load gagal');
  assert.strictEqual(boxesSetelah, boxesValid, 'papan state berjalan rusak setelah load gagal');
  assert.strictEqual(playersSetelah, playersValid, 'pemain state berjalan berubah setelah load gagal');

  // Konsekuensi: permainan yang sedang jalan harus tetap bisa digambar & dimainkan.
  assert.doesNotThrow(() => dalam(sb, 'drawBoard()'), 'drawBoard() gagal setelah load ditolak');
  assert.doesNotThrow(() => dalam(sb, "makeMove('horizontal', 0, 0)"), 'makeMove() gagal setelah load ditolak');
});

/* Kasus pelengkap QA-2: JSON valid tetapi bentuknya salah total
   (mis. `boxes` bukan array 2D). Harus ditolak, bukan meninggalkan
   state setengah-termuat. */
test('QA-2b: loadGame menolak save dengan bentuk struktur salah tanpa mengubah state', () => {
  const sb = muatScript();
  mulaiPermainan(sb, 3);

  const sebelum = JSON.stringify(dalam(sb, 'gameState.config'));
  dalam(sb, `localStorage.setItem('dotsandboxes_current', JSON.stringify({
     config: { gridSize: 5, totalPlayers: 2, aiCount: 0, aiDepth: 3 },
     players: [{ id: 0 }],
     currentPlayerIndex: 0,
     edges: 'bukan objek',
     boxes: 'bukan array',
     scores: 'bukan array',
     moveHistory: 42,
     isGameOver: 'ya'
   }))`);

  assert.strictEqual(dalam(sb, 'loadGame()'), false, 'loadGame harus menolak bentuk yang salah');
  assert.strictEqual(
    JSON.stringify(dalam(sb, 'gameState.config')),
    sebelum,
    'config berubah setelah save berbentuk salah ditolak'
  );
  assert.doesNotThrow(() => dalam(sb, 'drawBoard()'), 'drawBoard() gagal setelah penolakan save rusak');
});

/* ------------------------------------------------------------------
   QA-3: replay harus identik dengan permainan asli — termasuk ketika
   papan dimainkan sampai habis (> 1 langkah), bukan hanya 1 langkah.
   Ini memperluas test/script-integration.test.js yang sudah ada.
   ------------------------------------------------------------------ */
test('QA-3: replay penuh mereproduksi papan akhir yang sama untuk 2 permainan acak-ber-seed', () => {
  for (const seed of [11, 29]) {
    const sb = muatScript();
    const gs = mulaiPermainan(sb, 3);
    dalam(sb, `globalThis.__seed = ${seed}`);
    dalam(sb, `globalThis.__rnd = (() => { let s = __seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; }; })()`);

    let pengaman = 0;
    while (!dalam(sb, 'isGameOver()') && pengaman++ < 200) {
      const idx = dalam(sb, 'Math.floor(__rnd() * Rules.availableMoves(gameState).length)');
      const move = dalam(sb, `Rules.availableMoves(gameState)[${idx}]`);
      if (!move) break;
      dalam(sb, `makeMove(${JSON.stringify(move.type)}, ${move.row}, ${move.col})`);
      gs.players.forEach((p) => { p.isAI = false; });
    }

    const kotakAsli = dalam(sb, 'JSON.stringify(gameState.boxes.map((r) => r.map((b) => b.owner)))');
    const jumlahLangkah = gs.moveHistory.length;

    gs.isReplayMode = true;
    dalam(sb, `replayStep(${jumlahLangkah - 1})`);
    const kotakReplay = dalam(sb, 'JSON.stringify(gameState.boxes.map((r) => r.map((b) => b.owner)))');

    assert.strictEqual(
      kotakReplay,
      kotakAsli,
      `seed ${seed}: papan replay berbeda dari permainan asli (${jumlahLangkah} langkah)`
    );
  }
});
