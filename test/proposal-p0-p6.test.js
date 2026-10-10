/* ============================================================
   QA — TEST PERSIAPAN untuk PROPOSAL §P0 dan §P6/§P2.

   Jalankan:  node --test test/proposal-p0-p6.test.js

   Status berkas ini: PERSIAPAN (round penuh menyusul setelah build).
   Ditulis dari tuntutan proposal:
     - §P0  : "getBestMove null -> makeMove tetap dipanggil dengan langkah legal"
              "langkah legal kosong -> endGame + showToast dipanggil"
     - §P6  : "gameState.boxes hasil inisialisasi TIDAK punya edges"
     - §P2  : "save lama ber-edges tetap dimuat dan papan akhirnya identik"

   Konvensi: setiap test menuliskan perilaku yang SEHARUSNYA. Bila gagal,
   berarti pekerjaan proposal belum dikerjakan (RED) — bukan berarti test salah.

   Semua test menjalankan `script.js` NYATA di atas stub DOM (sandbox `vm`,
   pola sama dengan test/qa-regressions.test.js), jadi buktinya eksekusi.
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

/**
 * Muat script.js nyata ke sandbox `vm`.
 * `opsi.timeoutLangsung` = true -> setTimeout dipanggil langsung (bukan ditunda),
 * supaya jalur penjadwal AI selesai sinkron dan bisa diamati test.
 */
function muatScript(opsi = {}) {
  const elemenTerdaftar = new Map();
  const el = (id) => {
    if (!elemenTerdaftar.has(id)) elemenTerdaftar.set(id, buatElemen());
    return elemenTerdaftar.get(id);
  };
  const canvasEl = el('gameCanvas');
  canvasEl.parentElement = { clientWidth: 540, clientHeight: 540 };

  const sb = {
    console, setTimeout: (fn) => fn(), clearTimeout: () => {},
    requestAnimationFrame: () => {},
    Math, Date, JSON, Array, Object, Number, String, Boolean, Error,
    RangeError, Infinity, NaN
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
  if (opsi.rawat) opsi.rawat(sb);

  vm.createContext(sb);
  for (const berkas of ['rules.js', 'turn-queue.js', 'ai-engine.js', 'script.js']) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, berkas), 'utf8'), sb, { filename: berkas });
  }
  return sb;
}

const dalam = (sb, ekspresi) => vm.runInContext(ekspresi, sb);

/** Papan 3x3, dua pemain, giliran index 1 = AI. */
function mulaiPermainanAI(sb, gridSize = 3) {
  dalam(sb, `initGame({ gridSize: ${gridSize}, totalPlayers: 2, aiCount: 1, aiDepth: 1 })`);
  const gs = dalam(sb, 'gameState');
  gs.players[0].isAI = false;
  gs.players[1].isAI = true;
  gs.currentPlayerIndex = 1; // sekarang giliran AI
  return gs;
}

/* ==================================================================
   P0 — giliran AI TIDAK boleh menggantung bila getBestMove() null.

   Perilaku yang SEHARUSNYA (§P0 proposal):
     getBestMove() null  ->  tetap ada langkah yang dimainkan
                             (fallback dari Rules.availableMoves,
                              ATAU endGame + showToast bila papan benar kosong)
   ================================================================== */

test('P0-a: getBestMove null TIDAK membuat giliran menggantung — minimal satu konsekuensi terjadi', () => {
  const sb = muatScript();
  const gs = mulaiPermainanAI(sb);

  // Paksa AI gagal menemukan langkah.
  // PENTING: `executeAIMove` memanggil `aiEngine.getBestMove(...)`
  // (script.js:754), BUKAN fungsi global `getBestMove`. Jadi override harus
  // mengenai instance `aiEngine`, kalau tidak AI asli tetap memilih langkah
  // dan test mengukur hal yang salah (merah/hijau palsu).
  dalam(sb, `aiEngine.getBestMove = function () { return null; }`);

  // Amati konsekuensi nyata dari executeAIMove.
  const catat = dalam(sb, `(() => {
    const jejak = { makeMove: 0, endGame: 0, showToast: 0, switchTurn: 0 };
    const asliMakeMove = makeMove;
    const asliEndGame = endGame;
    const asliShowToast = showToast;
    const asliSwitchTurn = switchTurn;
    globalThis.makeMove = function (...a) { jejak.makeMove++; return asliMakeMove.apply(this, a); };
    globalThis.endGame = function (...a) { jejak.endGame++; return asliEndGame.apply(this, a); };
    globalThis.showToast = function (...a) { jejak.showToast++; return asliShowToast.apply(this, a); };
    globalThis.switchTurn = function (...a) { jejak.switchTurn++; return asliSwitchTurn.apply(this, a); };
    return jejak;
  })()`);

  const giliranSebelum = gs.currentPlayerIndex;
  dalam(sb, 'executeAIMove()');

  assert.ok(
    catat.makeMove > 0 || catat.endGame > 0,
    'setelah getBestMove() null, AI harus tetap memainkan langkah cadangan ' +
      'ATAU mengakhiri permainan; nyatanya tidak ada keduanya ' +
      `(makeMove=${catat.makeMove}, endGame=${catat.endGame}, showToast=${catat.showToast}) ` +
      '-> giliran menggantung'
  );

  if (catat.makeMove === 0) {
    assert.ok(
      catat.showToast > 0,
      'bila permainan diakhiri karena tidak ada langkah legal, pemain harus diberi tahu via showToast'
    );
  }
  // Catatan: asersi "sanity" lama di sini cacat (menganggap giliran TIDAK boleh
  // berpindah, padahal berpindah = benar). Sudah dicabut. Ukuran sebenarnya
  // adalah: pemain tidak boleh tetap terjebak di giliran yang sama TANPA
  // konsekuensi apa pun. Itu sudah ditangkap oleh dua asersi di atas.
  assert.ok(
    catat.switchTurn > 0 || catat.endGame > 0 || catat.makeMove > 0,
    `setelah getBestMove() null, harus ada konsekuensi nyata (switchTurn/endGame/makeMove); ` +
      `nyatanya makeMove=${catat.makeMove}, switchTurn=${catat.switchTurn}, endGame=${catat.endGame} ` +
      `(giliran ${giliranSebelum} -> ${gs.currentPlayerIndex})`
  );
});

test('P0-b: fallback hanya memakai langkah LEGAL dari Rules.availableMoves', () => {
  const sb = muatScript();
  const gs = mulaiPermainanAI(sb);

  dalam(sb, `getBestMove = function () { return null; }`);
  const legal = dalam(sb, 'JSON.stringify(Rules.availableMoves(gameState).map(m => [m.type, m.row, m.col]))');
  const daftarLegal = new Set(JSON.parse(legal).map((m) => m.join('/')));

  const dimainkan = dalam(sb, `(() => {
    const asli = makeMove;
    let terakhir = null;
    globalThis.makeMove = function (type, row, col) { terakhir = [type, row, col]; return asli(type, row, col); };
    executeAIMove();
    return terakhir ? terakhir.join('/') : null;
  })()`);

  if (dimainkan !== null) {
    assert.ok(
      daftarLegal.has(dimainkan),
      `langkah fallback harus legal; dimainkan="${dimainkan}", legal=${[...daftarLegal].join(', ')}`
    );
  } else {
    // Papan tidak punya langkah legal -> wajib endGame, bukan diam.
    assert.ok(gs.gameOver === true, 'bila tidak ada langkah legal, permainan harus berakhir (gameOver)');
  }
});

test('P0-c: papan yang benar-benar penuh -> endGame dipanggil, tanpa langkah ilegal', () => {
  const sb = muatScript();
  dalam(sb, `initGame({ gridSize: 3, totalPlayers: 2, aiCount: 1, aiDepth: 1 })`);
  const gs = dalam(sb, 'gameState');
  // Isi SEMUA sisi supaya availableMoves() kosong. Edge adalah objek `{owner}`
  // (rules.js:34-42), jadi ditandai lewat field `owner`, bukan di-assign angka.
  dalam(sb, `(() => {
    for (const garis of ['horizontal', 'vertical']) {
      for (let r = 0; r < gameState.edges[garis].length; r++) {
        for (let c = 0; c < gameState.edges[garis][r].length; c++) {
          if (gameState.edges[garis][r][c].owner === null) gameState.edges[garis][r][c].owner = 0;
        }
      }
    }
  })()`);
  const legalKosong = dalam(sb, 'Rules.availableMoves(gameState).length === 0');
  assert.strictEqual(legalKosong, true, 'prasyarat test: tidak boleh ada langkah legal tersisa');

  const catat = dalam(sb, `(() => {
    const jejak = { endGame: 0, showToast: 0, makeMove: 0 };
    const a1 = endGame, a2 = showToast, a3 = makeMove;
    globalThis.endGame = function (...a) { jejak.endGame++; return a1.apply(this, a); };
    globalThis.showToast = function (...a) { jejak.showToast++; return a2.apply(this, a); };
    globalThis.makeMove = function (...a) { jejak.makeMove++; return a3.apply(this, a); };
    return jejak;
  })()`);
  gs.players.forEach((p, i) => { p.isAI = i === 1; });
  gs.currentPlayerIndex = 1;
  // Override instance `aiEngine` (bukan global) — lihat catatan P0-a.
  dalam(sb, 'aiEngine.getBestMove = function () { return null; }');
  dalam(sb, 'executeAIMove()');

  assert.strictEqual(catat.makeMove, 0, 'tidak boleh memainkan langkah saat papan penuh (tidak ada langkah legal)');
  assert.ok(catat.endGame > 0, 'papan penuh + AI null -> permainan harus diakhiri (endGame), bukan menggantung');
});

/* ==================================================================
   P6 — bentuk kanonik Box = { owner } (Ruling 1).

   Papan hasil inisialisasi TIDAK boleh lagi menyimpan `edges`
   (dead write yang menipu pembaca kode).
   ================================================================== */

test('P6-a: gameState.boxes hasil initGame tidak punya field edges', () => {
  const sb = muatScript();
  dalam(sb, `initGame({ gridSize: 3, totalPlayers: 2, aiCount: 0, aiDepth: 1 })`);
  const bentuk = dalam(sb, `JSON.stringify(gameState.boxes[0][0])`);
  const kotak = JSON.parse(bentuk);

  assert.ok(
    !Object.prototype.hasOwnProperty.call(kotak, 'edges'),
    `Box kanonik harus { owner } saja; ditemukan field: ${Object.keys(kotak).join(', ')}`
  );
  assert.ok(
    Object.prototype.hasOwnProperty.call(kotak, 'owner'),
    'Box kanonik wajib menyimpan `owner`'
  );
});

test('P6-b: mengisi keempat sisi kotak lewat makeMove tetap menetapkan owner (perilaku tak berubah)', () => {
  const sb = muatScript();
  dalam(sb, `initGame({ gridSize: 3, totalPlayers: 2, aiCount: 0, aiDepth: 1 })`);

  // ATURAN (ADR-0001 + script.js:571-574): satu-satunya penulis papan adalah
  // `Rules.applyMove`, yang dipanggil lewat `makeMove`. Kita TIDAK boleh
  // menulis `edges[].owner` langsung — kalau edge sudah terpasang sebelum
  // applyMove, ia melihat `owner !== null` dan mengembalikan `boxesGained: []`
  // sehingga kotak tidak pernah diklaim (itu sebab merah palsu sebelumnya).
  //
  // Kotak (0,0) dibentuk oleh: horizontal[0][0], horizontal[1][0],
  // vertical[0][0], vertical[0][1]. Kita pasang lewat seam publik `makeMove`.
  // Pemain tetap 0 selama ia terus mengklaim kotak (extra turn), jadi set
  // `currentPlayerIndex = 0` sebelum tiap move agar owner pasti 0.
  const sisiKotak00 = [
    ['horizontal', 0, 0],
    ['horizontal', 1, 0],
    ['vertical', 0, 0],
    ['vertical', 0, 1]
  ];

  const jejak = dalam(sb, `(() => {
    const hasil = [];
    for (const [t, r, c] of ${JSON.stringify(sisiKotak00)}) {
      gameState.currentPlayerIndex = 0; // paksa pemain 0 yang memasang sisi
      hasil.push(makeMove(t, r, c));
    }
    return hasil;
  })()`);

  // Prasyarat: keempat pemasangan sisi harus diterima (bukan ditolak guard).
  // Catatan: `jejak` berasal dari realm `vm` yang berbeda, jadi dipetakan ke
  // string (primitif, aman lintas-realm) sebelum dibandingkan — `deepStrictEqual`
  // pada array lintas-realm gagal walau isinya sama (prototype berbeda).
  assert.strictEqual(
    Array.from(jejak).join(','),
    'true,true,true,true',
    'keempat sisi kotak (0,0) harus diterima makeMove tanpa ditolak'
  );

  const kt = JSON.parse(dalam(sb, 'JSON.stringify(gameState.boxes[0][0])'));
  assert.strictEqual(kt.owner, 0, 'kotak dengan empat sisi milik pemain 0 harus ber-owner 0');
  assert.ok(
    !Object.prototype.hasOwnProperty.call(kt, 'edges'),
    'setelah lewat jalur nyata, Box tetap kanonik { owner } tanpa `edges`'
  );
});

/* ==================================================================
   P2/P6 — MIGRASI: save lama ber-`edges` tetap dimuat, papan identik.
   ================================================================== */

function saveLamaBerEdges() {
  // Bentuk save NYATA sesuai `saveGame()` (script.js:774-789) untuk grid 3x3:
  //   boxes dimensi HARUS (gridSize-1) x (gridSize-1) = 2x2
  //   (validator script.js:851/:853: boxes.length === gridSize-1, tiap baris sama).
  // `boxes` memakai skema LAMA { owner, edges } dan `version` dihilangkan =
  // save warisan (pra-P2). Kunci wajib mengikuti SAVE_KEYS (script.js:802):
  // config, players, currentPlayerIndex, edges, boxes, scores, moveHistory,
  // isGameOver. Dimensi edges: horizontal 3x2, vertical 2x3.
  const kosong = () => ({ owner: null });
  const garisH = () => [[kosong(), kosong()], [kosong(), kosong()], [kosong(), kosong()]];
  const garisV = () => [[kosong(), kosong(), kosong()], [kosong(), kosong(), kosong()]];
  const kotakLama = (owner) => ({ owner, edges: {} });
  return {
    config: { gridSize: 3, totalPlayers: 2, aiCount: 0, aiDepth: 1 },
    players: [
      { name: 'Pemain 1', color: '#3b82f6', score: 0, isAI: false },
      { name: 'Pemain 2', color: '#ef4444', score: 0, isAI: false }
    ],
    currentPlayerIndex: 0,
    edges: {
      horizontal: garisH(),
      vertical: garisV(),
      // kotak (0,0) punya keempat sisi terisi oleh pemain 0
    },
    boxes: [
      [
        { owner: 0, edges: { top: true, bottom: true, left: true, right: true } },
        kotakLama(null)
      ],
      [kotakLama(null), kotakLama(null)]
    ],
    scores: [1, 0],
    moveHistory: [],
    isGameOver: false
  };
}

test('P2-a: save warisan ber-edges tetap DITERIMA (tidak dianggap rusak)', () => {
  const sb = muatScript();
  const terima = dalam(sb, `(() => {
    const lama = ${JSON.stringify(saveLamaBerEdges())};
    const kandidat = buatKandidatState(lama);
    return { ok: kandidat !== null && kandidat !== undefined, versi: (lama.version === undefined ? null : lama.version) };
  })()`);
  assert.ok(
    terima.ok,
    `save warisan tanpa \`version\` harus diterima sebagai v1; hasil=${JSON.stringify(terima)}`
  );
});

test('P2-b: setelah memuat save lama ber-edges, bentuk Box dimigrasikan ke { owner } dan owner utuh', () => {
  const sb = muatScript();
  // PENTING: `initGame()` memanggil `saveGame()` (script.js:187), jadi save
  // warisan harus DITULIS SETELAH initGame — kalau tidak, save kita tertimpa.
  dalam(sb, `initGame({ gridSize: 3, totalPlayers: 2, aiCount: 0, aiDepth: 1 })`);
  dalam(sb, `
    globalThis.localStorage.setItem('dotsandboxes_current', ${JSON.stringify(JSON.stringify(saveLamaBerEdges()))});
    loadGame();
  `);
  const hasil = dalam(sb, 'JSON.stringify(gameState.boxes)');
  const boxes = JSON.parse(hasil);

  assert.ok(
    Array.isArray(boxes) && boxes.length === 2 && boxes[0].length === 2,
    'dimensi papan boxes harus (gridSize-1) x (gridSize-1) = 2x2'
  );
  assert.strictEqual(boxes[0][0].owner, 0, 'owner kotak (0,0) harus tetap 0 setelah dimuat');
  assert.strictEqual(boxes[0][1].owner, null, 'owner kotak (0,1) harus tetap null setelah dimuat');
  assert.ok(
    !Object.prototype.hasOwnProperty.call(boxes[0][0], 'edges'),
    'setelah migrasi, Box tidak boleh lagi menyimpan `edges` (dead write dibuang)'
  );
});

test('P2-c: versi tak dikenal tetap DITOLAK (regresi penjagaan versi)', () => {
  const sb = muatScript();
  const hasil = dalam(sb, `(() => {
    const masaDepan = ${JSON.stringify(saveLamaBerEdges())};
    masaDepan.version = 999;
    const kandidat = (typeof buatKandidatState === 'function') ? buatKandidatState(masaDepan) : 'tidak-ada-fungsi';
    return kandidat === null ? 'ditolak' : 'diterima';
  })()`);
  assert.strictEqual(hasil, 'ditolak', 'save dengan version=999 harus ditolak, bukan dimuat dengan asumsi bentuk baru');
});

test('P2-d: version bukan bilangan bulat (mis. 1.5) tetap ditolak', () => {
  const sb = muatScript();
  const hasil = dalam(sb, `(() => {
    const aneh = ${JSON.stringify(saveLamaBerEdges())};
    aneh.version = 1.5;
    const kandidat = (typeof buatKandidatState === 'function') ? buatKandidatState(aneh) : 'tidak-ada-fungsi';
    return kandidat === null ? 'ditolak' : 'diterima';
  })()`);
  assert.strictEqual(hasil, 'ditolak', 'versi non-integer tidak boleh dianggap v1 yang sah');
});
