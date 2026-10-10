/* ============================================================
   UJI REGRESI "BUKTI EKSEKUSI" (p3)

   Mengunci tiga temuan yang dipakai proposal pengembangan dotbox
   agar tidak bisa lagi diklaim tanpa bukti — dan agar QA bisa
   mengulangnya sendiri.

   Semua uji MENGAMATI KODE PRODUKSI yang ada; tidak ada kode
   produksi yang diubah oleh berkas ini.

   Jalankan:  node --test test/bukti-eksekusi.test.js
   ============================================================ */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const sumberSkrip = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
const barisSkrip = sumberSkrip.split('\n');
const nomorBaris = (t) => barisSkrip.map((x, i) => ({ t: x, n: i + 1 }));

/* Ambil satu fungsi produksi utuh dengan kurung kurawal berimbang. */
function ambilFungsi(sumber, namaFungsi) {
    const kepala = `function ${namaFungsi}(`;
    const mulai = sumber.indexOf(kepala);
    assert.ok(mulai >= 0, `${namaFungsi} harus ada di script.js`);
    const buka = sumber.indexOf('{', mulai);
    let kedalaman = 0;
    for (let i = buka; i < sumber.length; i += 1) {
        if (sumber[i] === '{') kedalaman += 1;
        else if (sumber[i] === '}') {
            kedalaman -= 1;
            if (kedalaman === 0) return sumber.slice(mulai, i + 1);
        }
    }
    throw new Error(`${namaFungsi}: kurung kurawal tidak berimbang`);
}

/* ============================================================
   Bagian 1 — penjadwalan AI
   ============================================================ */

/* DIPERBARUI (P1 terpasang): tiga jalur `setTimeout(() => makeAIMove())` lama
   (181, 594, 631) dan pembungkus `setTimeout(() => executeAIMove())` (724)
   SUDAH diganti `turnQueue.schedule(...)`. Assertion lama mengunci bug yang
   kini hilang, jadi test ini sekarang menuntut pola BARU dan menolak pola lama.
   Bukti lama yang mengklaim 181/594/631/724 tersimpan di docs/bukti/*;
   kontrak wiring penuh ada di test/p1-wiring.test.js. */
test('script.js tidak lagi memakai setTimeout lepas untuk giliran AI (P1 terpasang)', () => {
    const jalurLama = nomorBaris().filter(({ t }) =>
        /setTimeout\(\s*\(\)\s*=>\s*makeAIMove\(\)/.test(t));
    assert.deepStrictEqual(jalurLama.map((x) => x.n), [],
        'semua jalur giliran AI harus lewat turnQueue.schedule(makeAIMove, …)');

    const pembungkusLama = nomorBaris().filter(({ t }) =>
        /setTimeout\(\s*\(\)\s*=>\s*executeAIMove\(\)/.test(t));
    assert.deepStrictEqual(pembungkusLama.map((x) => x.n), [],
        'makeAIMove harus memakai turnQueue.schedule(executeAIMove, 300)');

    for (const { t: baris } of nomorBaris()) {
        if (/makeAIMove|executeAIMove/.test(baris) && /setTimeout/.test(baris)) {
            assert.fail(`baris masih memakai setTimeout untuk giliran AI: ${baris.trim()}`);
        }
    }
});

test('script.js memakai turnQueue.schedule di semua jalur giliran AI', () => {
    const jalurBaru = nomorBaris().filter(({ t }) =>
        /turnQueue\.schedule\(\s*makeAIMove/.test(t));
    assert.strictEqual(jalurBaru.length, 4,
        'harus ada 4 jalur turnQueue.schedule(makeAIMove, …) (init, kotak, ganti giliran, muat)');
    const pembungkus = nomorBaris().filter(({ t }) =>
        /turnQueue\.schedule\(\s*executeAIMove/.test(t));
    assert.strictEqual(pembungkus.length, 1, 'makeAIMove = 1 turnQueue.schedule(executeAIMove, 300)');
});

test('aiMoveTimeout sudah dihapus (digantikan turnQueue)', () => {
    const kemunculan = nomorBaris().filter(({ t }) => /aiMoveTimeout/.test(t));
    assert.deepStrictEqual(kemunculan.map((x) => x.n), [],
        'variabel mati aiMoveTimeout harus hilang setelah P1 terpasang');
});

/* ============================================================
   Bagian 2 — bentuk Box
   ============================================================ */

test('Rules.createBoard menghasilkan Box TANPA field edges', () => {
    const Rules = require(path.join(ROOT, 'rules.js'));
    const papan = Rules.createBoard(3);
    const kunci = [...new Set(papan.boxes.flat().map((b) => Object.keys(b).sort().join(',')))];
    assert.deepStrictEqual(kunci, ['owner']);
});

test('inisialisasi script.js TIDAK lagi menulis Box.edges (dead write dibuang)', () => {
    const mulai = sumberSkrip.indexOf('gameState.boxes = Array(gridSize - 1)');
    assert.ok(mulai >= 0, 'inisialisasi boxes harus ditemukan');
    const akhir = sumberSkrip.indexOf('// Initialize AI Engine', mulai);
    const potongan = sumberSkrip.slice(mulai, akhir);

    const sb = {};
    vm.createContext(sb);
    vm.runInContext(
        `const gridSize = 3; let gameState = {};\n${potongan}\n`
            + 'globalThis.__boxes = JSON.stringify(gameState.boxes);',
        sb,
        { filename: 'script.js (paruh inisialisasi boxes)' }
    );
    const boxes = JSON.parse(sb.__boxes);
    const kunci = [...new Set(boxes.flat().map((b) => Object.keys(b).sort().join(',')))];
    // DIPERBARUI (P6 terpasang): Box kanonik adalah { owner }. Test ini dulu
    // MENGUNCI BUG — ia menuntut `edges,owner`. Sekarang ia menuntut bentuk kanonik.
    assert.deepStrictEqual(kunci, ['owner'], 'Box nyata harus kanonik { owner }');

    // Deteksi pembacaan field `edges` PADA BOX. Jalur resmi Edge adalah
    // `gameState.edges` / `state.edges` / `hasil.state.edges` dan harus
    // dikecualikan; yang dihitung hanyalah:
    //   (a) akses berantai langsung  `...boxes[r][c].edges`
    //   (b) variabel penampung kotak `const b = gameState.boxes[..][..]; b.edges`
    const aliasesKotak = new Set(
        nomorBaris()
            .map(({ t }) => /(?:const|let|var)\s+(\w+)\s*=\s*\w+\.boxes\s*\[/.exec(t))
            .filter(Boolean)
            .map((m) => m[1])
    );
    const pembaca = nomorBaris().filter(({ t, n }) => {
        if (/\.boxes\s*\[[^\]]+\]\s*\[[^\]]+\]\s*\.\s*edges/.test(t)) return true;
        const m = /\b(\w+)\.edges\b/.exec(t);
        return m !== null && aliasesKotak.has(m[1]);
    });
    assert.deepStrictEqual(pembaca.map((x) => x.n), [],
        'tidak boleh ada pembaca Box.edges');
});

/* ============================================================
   Bagian 3 — executeAIMove DENGAN fallback (P0 terpasang)

   DIPERBARUI: dua test di bawah dulu MENGUNCI BUG — mereka menuntut agar
   `getBestMove()==null` membuat `makeMove` 0× dan tanpa pesan apa pun
   ("tidak ada fallback, giliran menggantung"). Itu memang keadaan yang
   dilaporkan proposal §P0 sebagai cacat, jadi test itu sekarang menuntut
   perilaku yang BENAR: langkah cadangan tetap dimainkan + pemain diberi tahu.

   Fixture papan harus BERBENTUK VALID bagi `Rules.availableMoves`: gridSize 3
   berarti `edges.horizontal` 3 baris × 2 kolom (rules.js:69-75 menelusuri
   `row < gridSize` dan `col < gridSize - 1`), jadi fixture 1 baris membuat
   `undefined[0]` — bukan pesan kegagalan yang bermakna. Urutan
   `availableMoves`: horizontal dulu (baris lalu kolom), jadi `kandidat[0]`
   adalah horizontal/0/0.
   ============================================================ */

const skripUntai = ambilFungsi(sumberSkrip, 'executeAIMove');

/* Papan 3×3 kosong yang sah untuk `Rules.availableMoves` (3×2 + 2×3 = 12 garis). */
const garisKosong = () => ({ owner: null });
const papanKosong3 = () => ({
    horizontal: [[garisKosong(), garisKosong()], [garisKosong(), garisKosong()], [garisKosong(), garisKosong()]],
    vertical: [[garisKosong(), garisKosong(), garisKosong()], [garisKosong(), garisKosong(), garisKosong()]]
});

function jalankanKasusAIMove({ move, pemainAI }) {
    const sb = {};
    const jejak = { makeMove: [] };
    sb.console = console;
    // Jalur fallback memanggil `Rules.availableMoves`, jadi `Rules` WAJIB ada di
    // sandbox (sebelum P0 tidak dibutuhkan karena jalur itu tidak pernah jalan).
    sb.Rules = require(path.join(ROOT, 'rules.js'));
    sb.gameState = {
        isGameOver: false,
        isReplayMode: false,
        currentPlayerIndex: pemainAI ? 0 : 1,
        config: { gridSize: 3 },
        edges: papanKosong3(),
        boxes: [[{ owner: null }, { owner: null }], [{ owner: null }, { owner: null }]],
        players: pemainAI
            ? [{ isAI: true }, { isAI: false }]
            : [{ isAI: false }, { isAI: false }],
        moveHistory: []
    };
    sb.aiEngine = {
        getBestMove: () => {
            jejak.getBestMoveDipanggil = true;
            return move;
        }
    };
    sb.makeMove = (...args) => { jejak.makeMove.push(args); return true; };
    sb.switchTurn = () => { jejak.switchTurnDipanggil = true; };
    sb.showToast = (pesan) => { jejak.toast = pesan; };
    sb.endGame = () => { jejak.endGameDipanggil = true; };

    vm.createContext(sb);
    vm.runInContext(`${skripUntai}\nexecuteAIMove();`, sb, {
        filename: 'script.js (executeAIMove disadur)'
    });
    return jejak;
}

test('getBestMove()==null pada giliran AI: langkah cadangan tetap dimainkan', () => {
    const jejak = jalankanKasusAIMove({ move: null, pemainAI: true });
    assert.strictEqual(jejak.getBestMoveDipanggil, true);
    assert.deepStrictEqual(jejak.makeMove, [['horizontal', 0, 0]],
        'setelah pencarian gagal, tepat satu langkah cadangan legal harus dimainkan');
    assert.match(jejak.toast, /cadangan/i,
        'pemain harus diberi tahu bahwa langkah cadangan dipakai');
    assert.strictEqual(jejak.endGameDipanggil, undefined,
        'fixture papan masih punya langkah legal -> permainan tidak boleh berakhir');
});

test('getBestMove()==null + papan benar-benar penuh: endGame dipanggil, bukan diam', () => {
    // Fixture papan kosong diganti papan 3×3 yang SEMUA sisinya sudah terisi,
    // supaya `Rules.availableMoves` benar-benar kosong (bentuknya harus lengkap:
    // 3 baris horizontal × 2 kolom dan 2 baris vertical × 3 kolom).
    const terisi = () => ({ owner: 1 });
    const sb = {};
    const jejak = { makeMove: 0, endGame: 0, toast: undefined };
    sb.console = console;
    sb.Rules = require(path.join(ROOT, 'rules.js'));
    sb.gameState = {
        isGameOver: false,
        isReplayMode: false,
        currentPlayerIndex: 0,
        config: { gridSize: 3 },
        edges: {
            horizontal: [[terisi(), terisi()], [terisi(), terisi()], [terisi(), terisi()]],
            vertical: [[terisi(), terisi(), terisi()], [terisi(), terisi(), terisi()]]
        },
        boxes: [[{ owner: 1 }, { owner: 1 }], [{ owner: 1 }, { owner: 1 }]],
        players: [{ isAI: true }, { isAI: false }],
        moveHistory: []
    };
    assert.deepStrictEqual(
        sb.Rules.availableMoves(sb.gameState), [],
        'prasyarat: fixture harus benar-benar tidak punya langkah legal'
    );
    sb.aiEngine = { getBestMove: () => null };
    sb.makeMove = () => { jejak.makeMove++; return true; };
    sb.switchTurn = () => {};
    sb.showToast = (pesan) => { jejak.toast = pesan; };
    sb.endGame = () => { jejak.endGame++; };

    vm.createContext(sb);
    vm.runInContext(`${skripUntai}\nexecuteAIMove();`, sb, {
        filename: 'script.js (executeAIMove disadur, papan penuh)'
    });

    assert.strictEqual(jejak.makeMove, 0, 'papan penuh: tidak boleh ada langkah ilegal dimainkan');
    assert.strictEqual(jejak.endGame, 1, 'papan penuh + pencarian gagal -> endGame(), bukan diam');
    assert.match(String(jejak.toast), /tidak ada langkah|selesai/i,
        'pemain harus diberi tahu bahwa tidak ada langkah tersisa');
});

test('kontra-bukti: getBestMove() valid tetap diteruskan ke makeMove', () => {
    const jejak = jalankanKasusAIMove({
        move: { type: 'horizontal', row: 0, col: 0 },
        pemainAI: true
    });
    assert.deepStrictEqual(jejak.makeMove, [['horizontal', 0, 0]],
        'harness harus membuktikan jalur sukses, bukan hanya jalur gagal');
    assert.strictEqual(jejak.toast, undefined, 'jalur normal tidak boleh memunculkan toast');
});
