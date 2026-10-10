/* ============================================================
   Test INTEGRASI `script.js` di sandbox DOM minimal (tanpa browser).

   Jalankan:  node --test test/script-integration.test.js

   Alasan test ini ada:
   `script.js` berisi DOM sehingga tidak bisa di-require langsung.
   Sebelumnya verifikasi integrasi hanya file ad-hoc yang tidak pernah
   dijalankan. Test ini mengeksekusi `script.js` NYATA di atas stub
   `document`/`canvas`/`localStorage`, sehingga bug yang hanya muncul
   saat makeMove + Rules.applyMove digabung benar-benar tertangkap.

   Regresi yang dikunci di sini (semuanya nyata, terbukti lewat
   menjalankan skrip ini sebelum perbaikan):
     - kotak yang tinggal satu sisi TIDAK diklaim lewat makeMove
       (boxesGained selalu kosong karena Rules.applyMove dipanggil
       pada state yang edge-nya sudah ditulis langsung) -> skor 0.
     -> isGameOver() tidak pernah true walau papan penuh.
   ============================================================ */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

/* ---------- stub DOM seperlunya (sama semangatnya dengan verifikasi lama) ---------- */
function buatElemen() {
  const el = {
    classes: new Set(),
    style: {},
    dataset: {},
    innerHTML: '',
    innerText: '',
    textContent: '',
    value: '1',
    min: '1',
    max: '5',
    width: 0,
    height: 0,
    parentElement: null,
    classList: {
      add: (...c) => c.forEach((x) => el.classes.add(x)),
      remove: (...c) => c.forEach((x) => el.classes.delete(x)),
      contains: (c) => el.classes.has(c),
      toggle: (c) => (el.classes.has(c) ? el.classes.delete(c) : el.classes.add(c))
    },
    addEventListener() {},
    removeEventListener() {},
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
  {
    get(t, p) {
      return p in t ? t[p] : () => {};
    },
    set(t, p, v) {
      t[p] = v;
      return true;
    }
  }
);

const elemenTerdaftar = new Map();
const el = (id) => {
  if (!elemenTerdaftar.has(id)) elemenTerdaftar.set(id, buatElemen());
  return elemenTerdaftar.get(id);
};

const canvasEl = el('gameCanvas');
canvasEl.parentElement = { clientWidth: 540, clientHeight: 540 };

const sandbox = {
  console,
  setTimeout: (fn) => fn(), // sinkron: giliran AI deterministik
  clearTimeout: () => {},
  requestAnimationFrame: () => {},
  Math, Date, JSON, Array, Object, Number, String, Boolean, Error, RangeError,
  Infinity, NaN
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.addEventListener = () => {};
sandbox.removeEventListener = () => {};
sandbox.getComputedStyle = () => ({ getPropertyValue: () => '#ffffff' });
sandbox.AudioContext = function () {
  return {
    state: 'running', currentTime: 0, destination: {}, resume() {},
    createOscillator: () => ({ connect() {}, start() {}, stop() {}, frequency: {}, type: '' }),
    createGain: () => ({ connect() {}, gain: {} })
  };
};
sandbox.document = {
  body: buatElemen(),
  getElementById: (id) => (id === 'gameCanvas' ? canvasEl : el(id)),
  querySelector: () => buatElemen(),
  querySelectorAll: () => [],
  addEventListener() {},
  createElement: () => buatElemen()
};
sandbox.localStorage = {
  _data: new Map(),
  getItem(k) { return this._data.has(k) ? this._data.get(k) : null; },
  setItem(k, v) { this._data.set(k, String(v)); },
  removeItem(k) { this._data.delete(k); }
};

/* Muat ketiga berkas dengan URUTAN index.html. */
function muatScript() {
  const sb = Object.assign({}, sandbox);
  sb.window = sb;
  sb.globalThis = sb;
  vm.createContext(sb);
  for (const berkas of ['rules.js', 'ai-engine.js', 'script.js']) {
    const kode = fs.readFileSync(path.join(ROOT, berkas), 'utf8');
    vm.runInContext(kode, sb, { filename: berkas });
  }
  return sb;
}

/* `let`/`const` top-level tidak menjadi properti sandbox -> evaluasi di dalam konteks. */
const dalam = (sb, ekspresi) => vm.runInContext(ekspresi, sb);

function mulaiPermainan(sb) {
  dalam(sb, 'initGame({ gridSize: 3, totalPlayers: 2, aiCount: 1, aiDepth: 1 })');
  const gs = dalam(sb, 'gameState');
  gs.currentPlayerIndex = 0;
  // Matikan AI supaya urutan gerakan deterministik.
  gs.players.forEach((p) => { p.isAI = false; });
  return gs;
}

test('makeMove mengklaim kotak yang tinggal satu sisi (bukan hanya memasang garis)', () => {
  const sb = muatScript();
  const gs = mulaiPermainan(sb);

  // Kotak (0,0) butuh 4 sisi: atas, bawah, kiri, kanan.
  // Setiap gerakan yang TIDAK menutup kotak memindahkan giliran, jadi pemilik
  // kotak adalah pemain yang menutup sisi terakhir — bukan selalu pemain 0.
  dalam(sb, "makeMove('horizontal', 0, 0)"); // atas
  dalam(sb, "makeMove('horizontal', 1, 0)"); // bawah
  dalam(sb, "makeMove('vertical', 0, 0)");   // kiri
  const penutup = dalam(sb, 'gameState.currentPlayerIndex');
  dalam(sb, "makeMove('vertical', 0, 1)");   // kanan -> kotak selesai

  assert.strictEqual(
    gs.boxes[0][0].owner,
    penutup,
    'kotak (0,0) harus diklaim oleh pemain yang menutupnya, bukan tetap null'
  );
  assert.strictEqual(gs.scores[penutup], 1, 'skor pemain penutup harus naik menjadi 1');
  assert.strictEqual(gs.currentPlayerIndex, penutup, 'pemain yang menutup kotak dapat giliran ekstra');
});

test('papan penuh mengakhiri permainan dan total skor = jumlah kotak', () => {
  const sb = muatScript();
  const gs = mulaiPermainan(sb);

  let pengaman = 0;
  while (!dalam(sb, 'isGameOver()') && pengaman++ < 100) {
    const move = dalam(sb, 'Rules.availableMoves(gameState)[0]');
    if (!move) break;
    dalam(sb, `makeMove(${JSON.stringify(move.type)}, ${move.row}, ${move.col})`);
    // Matikan lagi bila makeMove/drawBoard sempat mengaktifkan AI.
    gs.players.forEach((p) => { p.isAI = false; });
  }

  assert.strictEqual(dalam(sb, 'isGameOver()'), true, 'papan penuh harus mengakhiri permainan');
  assert.strictEqual(gs.scores[0] + gs.scores[1], 4, 'total skor harus 4 kotak (papan 3x3)');
  assert.strictEqual(dalam(sb, 'Rules.availableMoves(gameState).length'), 0, 'tidak ada garis tersisa');
});

test('makeMove menolak gerakan di luar papan tanpa melempar exception', () => {
  const sb = muatScript();
  const gs = mulaiPermainan(sb);
  const riwayatAwal = gs.moveHistory.length;

  const hasil = dalam(sb, "makeMove('horizontal', 3, 0)"); // baris 3 tidak ada di papan 3x3

  assert.strictEqual(hasil, false, 'gerakan di luar papan harus ditolak');
  assert.strictEqual(gs.moveHistory.length, riwayatAwal, 'riwayat tidak boleh bertambah');
});

test('garis yang sudah ada ditolak dan tidak mengubah pemiliknya', () => {
  const sb = muatScript();
  const gs = mulaiPermainan(sb);

  dalam(sb, "makeMove('horizontal', 0, 0)");
  const hasil = dalam(sb, "makeMove('horizontal', 0, 0)");

  assert.strictEqual(hasil, false, 'klik ulang garis yang sama harus ditolak');
  assert.strictEqual(gs.edges.horizontal[0][0].owner, 0, 'pemilik garis tidak boleh tertimpa');
});

test('replayStep mengklaim kotak sama seperti permainan asli', () => {
  const sb = muatScript();
  const gs = mulaiPermainan(sb);

  // Mainkan papan sampai habis, catat kotak hasil permainan asli.
  let pengaman = 0;
  while (!dalam(sb, 'isGameOver()') && pengaman++ < 100) {
    const move = dalam(sb, 'Rules.availableMoves(gameState)[0]');
    if (!move) break;
    dalam(sb, `makeMove(${JSON.stringify(move.type)}, ${move.row}, ${move.col})`);
    gs.players.forEach((p) => { p.isAI = false; });
  }
  const kotakAsli = JSON.stringify(gs.boxes.map((r) => r.map((b) => b.owner)));

  // Replay penuh: reset papan lalu mainkan ulang semua langkah dari riwayat.
  gs.isReplayMode = true;
  dalam(sb, `replayStep(${gs.moveHistory.length - 1})`);

  const kotakReplay = JSON.stringify(gs.boxes.map((r) => r.map((b) => b.owner)));
  assert.strictEqual(kotakReplay, kotakAsli, 'replay harus mereproduksi kepemilikan kotak yang sama');
  assert.ok(
    gs.boxes.flat().some((b) => b.owner !== null),
    'replay tidak boleh berakhir tanpa satu kotak pun diklaim'
  );
});
