/* ============================================================
   QA — SUITE PENERIMAAN (acceptance) untuk hasil BUILD.

   Jalankan:  node --test test/qa-acceptance.test.js

   Berkas ini DITULIS SEBELUM implementasi selesai (TDD: RED dulu).
   Ia menyatakan perilaku yang SEHARUSNYA ada setelah P0/P2-sisa/P3/P5/P4
   dikerjakan. Bila test di sini merah HARI INI, itu bukti pekerjaan belum
   selesai — bukan bukti test salah.

   Aturan yang saya pegang (skill tdd):
     - Menguji di SEAM publik / perilaku yang teramati pemain, bukan internal.
     - Nilai harapan berasal dari spec & proposal (sumber independen), bukan
       dihitung ulang dari kode produksi.
     - Tidak menulis test untuk implementasi yang tidak ada (mis. nama helper
       internal) tanpa menjaga alternatif perilaku yang setara.

   Rujukan kontrak:
     - P0      : PROPOSAL §P0 + ADR-0003 (fallback deterministik)
     - P2-sisa : docs/superpowers/specs/2026-10-10-p2-sisa-migrasi-save-design.md
     - P3      : docs/superpowers/specs/2026-10-10-p3-aksesibilitas-design.md
     - P5      : docs/superpowers/specs/2026-10-10-p5-hidpi-design.md
     - P4      : docs/adr/0004-tulis-save-di-akhir-giliran.md
   ============================================================ */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const baca = (berkas) => fs.readFileSync(path.join(ROOT, berkas), 'utf8');

/* ==================================================================
   SANDBOX DOM — pola sama dengan test/proposal-p0-p6.test.js, tetapi
   `opsi.devicePixelRatio` & `opsi.rekamTransform` ditambahkan supaya P5
   bisa diuji, dan `opsi.returnFalseSetTimeout` ditambahkan untuk P4.
   ================================================================== */

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
  { canvas: null, globalAlpha: 1, setTransformDicatat: [], set font(v) {}, get font() { return ''; } },
  {
    get(t, p) {
      if (p === 'setTransform') {
        return (...a) => { t.setTransformDicatat.push(a); };
      }
      return p in t ? t[p] : () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  }
);

function buatLocalStorage() {
  return {
    _data: new Map(),
    setItemCount: 0,
    getItem(k) { return this._data.has(k) ? this._data.get(k) : null; },
    setItem(k, v) { this.setItemCount++; this._data.set(k, String(v)); },
    removeItem(k) { this._data.delete(k); }
  };
}

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
  if (opsi.devicePixelRatio) sb.devicePixelRatio = opsi.devicePixelRatio;
  if (opsi.rawat) opsi.rawat(sb, { canvasEl, el });

  vm.createContext(sb);
  for (const berkas of ['rules.js', 'turn-queue.js', 'ai-engine.js', 'script.js']) {
    vm.runInContext(baca(berkas), sb, { filename: berkas });
  }
  return sb;
}

const dalam = (sb, ekspresi) => vm.runInContext(ekspresi, sb);

/* `initGame()` TIDAK mengembalikan nilai (mengembalikan undefined). Jadi state
   harus dibaca lewat `gameState`, bukan dari nilai kembalian initGame. */
function initDanAmbilState(sb, gridSize = 3, aiCount = 0) {
  dalam(sb, `initGame({ gridSize: ${gridSize}, totalPlayers: 2, aiCount: ${aiCount}, aiDepth: 1 })`);
  return dalam(sb, 'gameState');
}

function mulaiPermainanAI(sb, gridSize = 3) {
  dalam(sb, `initGame({ gridSize: ${gridSize}, totalPlayers: 2, aiCount: 1, aiDepth: 1 })`);
  const gs = dalam(sb, 'gameState');
  gs.players[0].isAI = false;
  gs.players[1].isAI = true;
  gs.currentPlayerIndex = 1;
  return gs;
}

/** Rekam pemanggilan fungsi global apa pun yang terdaftar. */
function rekamJejak(sb, fungsi) {
  const daftar = fungsi.map((f) => `'${f}'`).join(', ');
  return dalam(sb, `(() => {
    const jejak = {};
    for (const nama of [${daftar}]) {
      jejak[nama] = 0;
      const asli = globalThis[nama];
      globalThis[nama] = function (...a) { jejak[nama]++; return asli ? asli.apply(this, a) : undefined; };
    }
    return jejak;
  })()`);
}

/* ==================================================================
   P0 — GILIRAN AI TIDAK BOLEH MENGGANTUNG (tuntutan §P0 + ADR-0003)

   Aturan:
     1. getBestMove() null DAN masih ada garis kosong  -> AI WAJIB memainkan
        langkah cadangan legal, dan pemain WAJIB diberi tahu (showToast),
        karena "AI diam tanpa penjelasan" itulah bug-nya.
     2. getBestMove() null DAN papan benar-benar penuh -> endGame() dipanggil
        (bukan diam), dan TIDAK ada langkah ilegal.
     3. Langkah cadangan DETERMINISTIK: dua permainan identik memilih langkah
        yang sama (ADR-0003), bukan acak.
     4. Pemberitahuan TIDAK muncul di jalur normal (pencarian berhasil),
        supaya tidak jadi kebisingan.
     5. Gerbang statis: `if (!move) return;` sudah tidak ada di script.js
        (keputusan D12 Architect — return telanjang itu adalah bug-nya).
   ================================================================== */

test('P0-1: getBestMove null + masih ada garis kosong -> langkah cadangan DIMAINKAN dan pemain diberi tahu', () => {
  const sb = muatScript();
  const gs = mulaiPermainanAI(sb);
  const legalSebelum = dalam(sb, 'Rules.availableMoves(gameState).length');
  assert.ok(legalSebelum > 0, 'prasyarat: harus ada garis kosong');

  dalam(sb, 'aiEngine.getBestMove = function () { return null; }');
  const jejak = rekamJejak(sb, ['makeMove', 'endGame', 'showToast']);

  dalam(sb, 'executeAIMove()');

  assert.ok(
    jejak.makeMove > 0,
    `getBestMove() null TIDAK boleh menggantung: AI harus memainkan langkah cadangan legal. ` +
      `(makeMove=${jejak.makeMove}, showToast=${jejak.showToast})`
  );
  assert.ok(
    jejak.showToast > 0,
    `pemain harus diberi tahu saat langkah cadangan dipakai (§P0 "beri tahu pemain via showToast"). ` +
      `(showToast=${jejak.showToast})`
  );
  assert.ok(
    dalam(sb, 'gameState.moveHistory.length') > 0,
    'langkah cadangan harus tercatat di moveHistory (bukti gerakan nyata, bukan sekadar pemanggilan)'
  );
});

test('P0-2: getBestMove null + papan penuh -> endGame dipanggil, tanpa langkah ilegal', () => {
  const sb = muatScript();
  dalam(sb, 'initGame({ gridSize: 3, totalPlayers: 2, aiCount: 1, aiDepth: 1 })');
  const gs = dalam(sb, 'gameState');
  dalam(sb, `(() => {
    for (const garis of ['horizontal', 'vertical']) {
      for (let r = 0; r < gameState.edges[garis].length; r++) {
        for (let c = 0; c < gameState.edges[garis][r].length; c++) {
          if (gameState.edges[garis][r][c].owner === null) gameState.edges[garis][r][c].owner = 0;
        }
      }
    }
  })()`);
  assert.strictEqual(dalam(sb, 'Rules.availableMoves(gameState).length'), 0, 'prasyarat: papan penuh');

  gs.players.forEach((p, i) => { p.isAI = i === 1; });
  gs.currentPlayerIndex = 1;
  dalam(sb, 'aiEngine.getBestMove = function () { return null; }');
  const jejak = rekamJejak(sb, ['makeMove', 'endGame']);

  dalam(sb, 'executeAIMove()');

  assert.strictEqual(jejak.makeMove, 0, 'papan penuh: tidak boleh ada langkah (ilegal) yang dimainkan');
  assert.ok(jejak.endGame > 0, 'papan penuh + getBestMove null -> endGame(), bukan menggantung');
});

test('P0-3: langkah cadangan DETERMINISTIK (dua permainan identik memilih langkah sama)', () => {
  const pilih = () => {
    const sb = muatScript();
    mulaiPermainanAI(sb);
    dalam(sb, 'aiEngine.getBestMove = function () { return null; }');
    return dalam(sb, `(() => {
      const asli = makeMove;
      let terakhir = null;
      globalThis.makeMove = function (type, row, col) { terakhir = [type, row, col].join('/'); return asli(type, row, col); };
      executeAIMove();
      return terakhir;
    })()`);
  };

  const a = pilih();
  const b = pilih();
  assert.ok(a !== null, 'harus ada langkah cadangan pada papan kosong (bukan null)');
  assert.strictEqual(a, b, `langkah cadangan harus deterministik (ADR-0003); nyatanya "${a}" vs "${b}"`);
});

test('P0-4: jalur normal (pencarian berhasil) TIDAK memunculkan pesan cadangan', () => {
  const sb = muatScript();
  mulaiPermainanAI(sb);
  // Biarkan aiEngine asli bekerja: ia HARUS menemukan langkah pada papan kosong.
  const jejak = rekamJejak(sb, ['makeMove', 'showToast']);

  dalam(sb, 'executeAIMove()');

  assert.ok(jejak.makeMove > 0, 'prasyarat: AI asli harus memainkan langkah di papan kosong');
  assert.strictEqual(
    jejak.showToast,
    0,
    'pesan "langkah cadangan dipakai" hanya untuk jalur cadangan; jalur normal tidak boleh berisik'
  );
});

test('P0-5 (statis): `if (!move) return;` sudah dihapus dari script.js', () => {
  const script = baca('script.js');
  assert.ok(
    !/if\s*\(\s*!move\s*\)\s*return\s*;/.test(script),
    'gerbang D12: return telanjang `if (!move) return;` itulah bug P0 dan harus hilang total'
  );
});

/* ==================================================================
   P2-sisa — SAVE WARISAN BER-`edges` DIMIGRASIKAN; ALASAN PENOLAKAN BISA DIBEDAKAN
   ================================================================== */

/** Save warisan: TANPA `version`, box berbentuk LAMA `{ owner, edges }`. */
function saveWarisanBerEdges() {
  const garis = () => ({ owner: null });
  const garisH = () => [[garis(), garis()], [garis(), garis()], [garis(), garis()]];
  const garisV = () => [[garis(), garis(), garis()], [garis(), garis(), garis()]];
  const kotakLama = (owner) => ({ owner, edges: { top: null, bottom: null, left: null, right: null } });
  return {
    config: { gridSize: 3, totalPlayers: 2, aiCount: 0, aiDepth: 1 },
    players: [
      { name: 'Pemain 1', color: '#3b82f6', score: 0, isAI: false },
      { name: 'Pemain 2', color: '#ef4444', score: 0, isAI: false }
    ],
    currentPlayerIndex: 0,
    edges: { horizontal: garisH(), vertical: garisV() },
    boxes: [[{ owner: 0, edges: { top: true, bottom: true, left: true, right: true } }, kotakLama(null)], [kotakLama(null), kotakLama(null)]],
    scores: [1, 0],
    moveHistory: [],
    isGameOver: false
  };
}

test('P2s-1: save warisan (tanpa version, box ber-edges) DITERIMA', () => {
  const sb = muatScript();
  const hasil = dalam(sb, `(() => {
    const kandidat = buatKandidatState(${JSON.stringify(saveWarisanBerEdges())});
    return kandidat === null || kandidat === undefined ? 'ditolak' : 'diterima';
  })()`);
  assert.strictEqual(hasil, 'diterima', 'save warisan harus diperlakukan sebagai v1 dan diterima');
});

test('P2s-2: setelah dimuat, box dimigrasikan ke bentuk kanonik { owner } dan owner utuh', () => {
  const sb = muatScript();
  dalam(sb, 'initGame({ gridSize: 3, totalPlayers: 2, aiCount: 0, aiDepth: 1 })');
  const ok = dalam(sb, `(() => {
    localStorage.setItem('dotsandboxes_current', ${JSON.stringify(JSON.stringify(saveWarisanBerEdges()))});
    return loadGame();
  })()`);
  assert.strictEqual(ok, true, 'loadGame() harus mengembalikan true untuk save warisan yang sah');

  const boxes = JSON.parse(dalam(sb, 'JSON.stringify(gameState.boxes)'));
  assert.strictEqual(boxes[0][0].owner, 0, 'owner kotak (0,0) harus utuh = 0');
  assert.strictEqual(boxes[0][1].owner, null, 'owner kotak (0,1) harus tetap null');
  assert.ok(
    !Object.prototype.hasOwnProperty.call(boxes[0][0], 'edges'),
    'setelah migrasi, box TIDAK boleh lagi menyimpan `edges` (bentuk kanonik { owner })'
  );
});

test('P2s-3: alasan penolakan bisa DIBEDAKAN: versi tak dikenal vs struktur tak valid', () => {
  const sb = muatScript();
  // Rekam semua console.error supaya pesan nyata bisa diperiksa (bukan mock perilaku).
  const pesan = dalam(sb, `(() => {
    const daftar = [];
    const asli = console.error;
    globalThis.__pesanError = daftar;
    console.error = function (...a) { daftar.push(a.map(String).join(' ')); if (asli) asli.apply(this, a); };
    return daftar.length;
  })()`);
  assert.strictEqual(pesan, 0, 'prasyarat: buffer pesan kosong');

  // (a) versi tak dikenal
  dalam(sb, `(() => {
    const s = ${JSON.stringify(saveWarisanBerEdges())};
    s.version = 999;
    localStorage.setItem('dotsandboxes_current', JSON.stringify(s));
    loadGame();
  })()`);

  // (b) struktur tak valid (kunci wajib dihapus)
  dalam(sb, `(() => {
    const s = ${JSON.stringify(saveWarisanBerEdges())};
    delete s.scores;
    localStorage.setItem('dotsandboxes_current', JSON.stringify(s));
    loadGame();
  })()`);

  const daftar = dalam(sb, '__pesanError');
  assert.strictEqual(daftar.length, 2, `dua penolakan harus menghasilkan dua pesan; nyatanya ${daftar.length}`);
  assert.notStrictEqual(
    daftar[0], daftar[1],
    'pesan "versi tak dikenal" dan "struktur tak valid" tidak boleh identik — kalau sama, log tidak bisa didiagnosis'
  );
  for (const p of daftar) {
    assert.match(p, /versi|struktur|ditolak/i, `pesan penolakan harus deskriptif: "${p}"`);
  }
});

test('P2s-4: save rusak TIDAK mengubah gameState (atomik, tidak ada regresi)', () => {
  const sb = muatScript();
  dalam(sb, 'initGame({ gridSize: 3, totalPlayers: 2, aiCount: 0, aiDepth: 1 })');
  dalam(sb, "makeMove('horizontal', 0, 0)");
  const sebelum = dalam(sb, 'JSON.stringify(gameState.moveHistory)');

  const ok = dalam(sb, `(() => {
    localStorage.setItem('dotsandboxes_current', '{"config":{}}');
    return loadGame();
  })()`);

  assert.strictEqual(ok, false, 'save rusak harus ditolak (return false)');
  assert.strictEqual(
    dalam(sb, 'JSON.stringify(gameState.moveHistory)'), sebelum,
    'gameState tidak boleh tersentuh saat save ditolak (aturan atomik QA-2)'
  );
});

/* ==================================================================
   P3 — AKSESIBILITAS (uji statis + DOM, tanpa peramban)
   ================================================================== */

test('P3-1: index.html tidak lagi mematikan zoom (tanpa user-scalable=no & maximum-scale=1.0)', () => {
  const html = baca('index.html');
  const viewport = (html.match(/<meta[^>]*name=["']viewport["'][^>]*>/i) || [''])[0];
  assert.ok(viewport.length > 0, 'index.html harus punya meta viewport');
  assert.ok(!/user-scalable\s*=\s*no/i.test(viewport), 'user-scalable=no mematikan zoom (WCAG 1.4.4)');
  assert.ok(!/maximum-scale\s*=\s*1(\.0)?/i.test(viewport), 'maximum-scale=1.0 juga memblokir zoom');
});

test('P3-2: setiap tombol ikon/replay punya aria-label tidak kosong', () => {
  const html = baca('index.html');
  const wajib = ['darkModeToggle', 'replayPlayPause', 'replayPrev', 'replayNext', 'replayClose', 'playAgainBtn'];
  for (const id of wajib) {
    // Cari tag pembuka yang memuat id tersebut, lalu periksa aria-label di dalam tag itu.
    const re = new RegExp(`<[^>]*id=["']${id}["'][^>]*>`, 'i');
    const tag = (html.match(re) || [])[0];
    assert.ok(tag, `elemen #${id} harus ada di index.html`);
    const label = (tag.match(/aria-label=["']([^"']*)["']/i) || [])[1];
    assert.ok(
      label && label.trim().length > 0,
      `#${id} harus punya aria-label tidak kosong (WCAG 2.5.3 / ARIA APG); tag="${tag}"`
    );
  }
});

test('P3-3: style.css punya :focus-visible dan prefers-reduced-motion', () => {
  const css = baca('style.css');
  assert.ok(/:focus-visible/.test(css), 'harus ada gaya :focus-visible (bukan hanya :focus)');
  assert.ok(
    /prefers-reduced-motion\s*:\s*reduce/.test(css),
    'harus ada @media (prefers-reduced-motion: reduce) untuk mematikan animasi'
  );
});

test('P3-4: ada live region #liveStatus dan diperbarui dari updateUI() dengan teks (tanpa emoji)', () => {
  const html = baca('index.html');
  const tag = (html.match(/<[^>]*id=["']liveStatus["'][^>]*>/) || [])[0];
  assert.ok(tag, 'index.html harus punya elemen #liveStatus');
  assert.match(tag, /role=["']status["']/i, '#liveStatus harus role="status"');
  assert.match(tag, /aria-live=["']polite["']/i, '#liveStatus harus aria-live="polite"');

  // DOM nyata: jalankan updateUI() dan periksa isi region.
  const sb = muatScript();
  dalam(sb, 'initGame({ gridSize: 3, totalPlayers: 2, aiCount: 0, aiDepth: 1 })');
  dalam(sb, 'updateUI()');
  const isi = dalam(sb, "String(document.getElementById('liveStatus').textContent || '')");
  assert.ok(isi.length > 0, 'updateUI() harus mengisi #liveStatus dengan teks status');
  assert.match(isi, /Giliran:/i, `teks live region harus menyebut giliran; nyatanya "${isi}"`);
  assert.ok(
    !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(isi),
    `live region untuk pembaca layar tidak boleh berisi emoji; nyatanya "${isi}"`
  );
});

/* ==================================================================
   P5 — KETAJAMAN HiDPI (satu PR; render + hit-test harus konsisten)
   ================================================================== */

test('P5-1: DPR 2 -> bitmap = size*2, style CSS = size px', () => {
  const sb = muatScript({ devicePixelRatio: 2 });
  // parentElement 540 -> size = min(540-32, 540-32, 500) = 500
  dalam(sb, 'initGame({ gridSize: 3, totalPlayers: 2, aiCount: 0, aiDepth: 1 })');
  const c = dalam(sb, 'document.getElementById("gameCanvas")');
  assert.strictEqual(c.width, 500 * 2, 'bitmap harus size*DPR (500*2=1000)');
  assert.strictEqual(c.height, 500 * 2, 'bitmap tinggi harus size*DPR');
  assert.strictEqual(c.style.width, '500px', 'lebar CSS harus tetap ukuran logis (500px)');
  assert.strictEqual(c.style.height, '500px', 'tinggi CSS harus tetap ukuran logis (500px)');
});

test('P5-2: konteks menerima setTransform(DPR,0,0,DPR,0,0)', () => {
  const sb = muatScript({ devicePixelRatio: 2 });
  const sebelum = dalam(sb, 'document.getElementById("gameCanvas")'); // pastikan kanvas ada
  void sebelum;
  dalam(sb, 'initGame({ gridSize: 3, totalPlayers: 2, aiCount: 0, aiDepth: 1 })');
  const catatan = ctxCanvas.setTransformDicatat;
  assert.ok(
    catatan.some((a) => a[0] === 2 && a[1] === 0 && a[2] === 0 && a[3] === 2 && a[4] === 0 && a[5] === 0),
    `canvas harus di-scale DPR via setTransform(2,0,0,2,0,0); terekam=${JSON.stringify(catatan)}`
  );
});

test('P5-3: hit-test tetap benar di DPR 2 — klik pada posisi fisik yang sama memilih garis yang sama', () => {
  // Cara berpikirnya: `dotPositions` sengaja TIDAK dipakai untuk menentukan
  // titik klik, karena ia hidup di dalam state yang sama dengan yang diuji —
  // memakainya membuat test tautologis (selalu menyesuaikan diri, termasuk saat
  // P5 setengah-jalan). Sebagai gantinya kita memakai SATU posisi fisik tetap
  // dalam koordinat clientRect yang sama untuk DPR 1 dan DPR 2, lalu menuntut
  // garis yang dipilih sama. Itulah keluhan pemain: "ketukan di titik yang sama
  // harus memilih garis yang sama, apa pun jenis layarnya".
  //
  // Geometri papan 3x3 pada size 500 px CSS: padding 50, spacing 250.
  // Titik tengah garis horizontal (0,0) = (50 + 250/2, 50) = (175, 50) CSS px.
  // Kanvas mengisi rect dari (0,0) dengan lebar = size CSS px, jadi posisi fisik
  // titik itu adalah (175, 50) juga. Angka-angka ini berasal dari rumus
  // `calculatePositions` (padding 50, spacing = (500-100)/2 = 200)... koreksi:
  // spacing = (size - 2*padding)/(gridSize-1) = (500-100)/2 = 200, jadi
  // titik tengah = (50 + 100, 50) = (150, 50). Kita ambil dari rect + rumus spec,
  // bukan dari dotPositions runtime.
  const SIZE = 500;
  const PADDING = 50;
  const SPACING = (SIZE - 2 * PADDING) / (3 - 1); // 200
  const cx = PADDING + SPACING / 2; // 150 => di tengah garis horizontal (0,0)
  const cy = PADDING;               // 50  => tepat di garis horizontal (0,0)

  function pilihGarisLewatKlik(dpr) {
    const sb = muatScript(dpr ? { devicePixelRatio: dpr } : {});
    // Ukuran CSS kanvas harus benar-benar SIZE px supaya koordinat fisik konsisten.
    dalam(sb, `(() => {
      const c = document.getElementById('gameCanvas');
      c.getBoundingClientRect = () => ({ left: 0, top: 0, width: ${SIZE}, height: ${SIZE} });
    })()`);
    dalam(sb, 'initGame({ gridSize: 3, totalPlayers: 2, aiCount: 0, aiDepth: 1 })');
    const ukuran = dalam(sb, `(() => {
      const c = document.getElementById('gameCanvas');
      return JSON.stringify({ w: c.width, sw: c.style.width || '' });
    })()`);
    const pilihan = dalam(sb, `(() => {
      const asli = makeMove;
      let dipilih = null;
      globalThis.makeMove = function (type, row, col) { dipilih = [type, row, col].join('/'); return asli(type, row, col); };
      // Klik fisik pada titik yang sama; handler-lah yang harus mengonversi.
      handleCanvasClick({ clientX: ${cx}, clientY: ${cy} });
      return dipilih;
    })()`);
    return { ukuran: JSON.parse(ukuran), pilihan };
  }

  const dpr1 = pilihGarisLewatKlik(1);
  const dpr2 = pilihGarisLewatKlik(2);

  assert.strictEqual(dpr1.ukuran.sw, '500px', 'prasyarat: lebar CSS kanvas harus 500px');
  assert.strictEqual(dpr1.pilihan, 'horizontal/0/0', 'prasyarat: di DPR 1, klik (150,50) harus memilih garis (0,0)');
  assert.strictEqual(
    dpr2.pilihan, dpr1.pilihan,
    `di DPR 2, klik fisik di titik yang sama harus memilih garis yang SAMA; ` +
      `nyatanya "${dpr2.pilihan}" vs "${dpr1.pilihan}" (bitmap DPR2=${dpr2.ukuran.w}, CSS=${dpr2.ukuran.sw})`
  );
});

/* ==================================================================
   P4 — HEMAT I/O: save di akhir giliran + penyelamat beforeunload
   (ADR-0004). Isi save harus BENAR, bukan sekadar frekuensi turun.
   ================================================================== */

test('P4-1: satu langkah (tanpa klaim kotak) menulis save paling banyak sekali, bukan per langkah internal', () => {
  const sb = muatScript();
  const gs = initDanAmbilState(sb, 3, 0);
  gs.players.forEach((p) => { p.isAI = false; });
  gs.currentPlayerIndex = 0;

  const sebelum = sb.localStorage.setItemCount;
  dalam(sb, "makeMove('horizontal', 0, 0)");
  const setelah = sb.localStorage.setItemCount;
  const jumlah = setelah - sebelum;

  assert.ok(jumlah >= 1, 'langkah yang selesai harus tetap menyimpan (tidak kehilangan data)');
  assert.ok(
    jumlah <= 1,
    `satu langkah tidak boleh menulis save lebih dari sekali (hemat I/O, ADR-0004); nyatanya ${jumlah} kali`
  );
});

test('P4-2: isi save terakhir SAMA dengan gameState terakhir (hemat I/O tidak boleh merusak data)', () => {
  const sb = muatScript();
  const gs = initDanAmbilState(sb, 3, 0);
  gs.players.forEach((p) => { p.isAI = false; });
  gs.currentPlayerIndex = 0;

  dalam(sb, "makeMove('horizontal', 0, 0)");
  dalam(sb, "makeMove('horizontal', 1, 0)");

  const tersimpan = JSON.parse(dalam(sb, "localStorage.getItem('dotsandboxes_current')"));
  const hidup = JSON.parse(dalam(sb, 'JSON.stringify(gameState)'));

  assert.deepStrictEqual(tersimpan.config, hidup.config, 'config pada save harus sama dengan state hidup');
  assert.strictEqual(tersimpan.currentPlayerIndex, hidup.currentPlayerIndex, 'indeks giliran pada save harus terkini');
  assert.deepStrictEqual(tersimpan.scores, hidup.scores, 'skor pada save harus terkini');
  assert.strictEqual(tersimpan.moveHistory.length, hidup.moveHistory.length, 'riwayat langkah pada save harus lengkap');
});

test('P4-3: ada penyelamat beforeunload yang menulis save (tidak kehilangan data saat tab ditutup)', () => {
  const script = baca('script.js');
  assert.ok(
    /beforeunload/.test(script),
    'ADR-0004: harus ada penulisan penyelamat pada beforeunload, kalau tidak aturan "tidak kehilangan data" tidak terpenuhi'
  );
});

/* ==================================================================
   P6 — GERBANG DATA KANONIK (regresi tak boleh balik)
   ================================================================== */

test('P6-1: initGame tidak lagi menulis Box.edges (dead write hilang)', () => {
  const sb = muatScript();
  dalam(sb, 'initGame({ gridSize: 3, totalPlayers: 2, aiCount: 0, aiDepth: 1 })');
  const box0 = JSON.parse(dalam(sb, 'JSON.stringify(gameState.boxes[0][0])'));
  assert.ok(!Object.prototype.hasOwnProperty.call(box0, 'edges'), 'Box kanonik hanya { owner }');
  assert.ok(Object.prototype.hasOwnProperty.call(box0, 'owner'), 'Box wajib punya owner');
});

test('P6-2: pemilik kotak tetap benar setelah jalur nyata makeMove (perilaku tidak berubah)', () => {
  const sb = muatScript();
  const gs = initDanAmbilState(sb, 3, 0);
  gs.players.forEach((p) => { p.isAI = false; });
  const sisi = [['horizontal', 0, 0], ['horizontal', 1, 0], ['vertical', 0, 0], ['vertical', 0, 1]];
  for (const [t, r, c] of sisi) {
    gs.currentPlayerIndex = 0;
    dalam(sb, `makeMove('${t}', ${r}, ${c})`);
  }
  assert.strictEqual(gs.boxes[0][0].owner, 0, 'kotak dengan 4 sisi milik pemain 0 harus ber-owner 0');
});
