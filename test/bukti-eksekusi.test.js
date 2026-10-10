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

test('script.js punya 3 jalur penjadwal setTimeout(() => makeAIMove())', () => {
    const jalur = nomorBaris().filter(({ t }) =>
        /setTimeout\(\s*\(\)\s*=>\s*makeAIMove\(\)/.test(t));
    // Nilai harfiah, diverifikasi lewat reproduksi: 181, 594, 631.
    assert.deepStrictEqual(jalur.map((x) => x.n), [181, 594, 631]);
});

test('makeAIMove membungkus executeAIMove dalam setTimeout (1 tempat)', () => {
    const pembungkus = nomorBaris().filter(({ t }) =>
        /setTimeout\(\s*\(\)\s*=>\s*executeAIMove\(\)/.test(t));
    assert.deepStrictEqual(pembungkus.map((x) => x.n), [724]);
});

test('aiMoveTimeout hanya dideklarasikan dan tidak pernah dipakai', () => {
    const kemunculan = nomorBaris().filter(({ t }) => /aiMoveTimeout/.test(t));
    assert.deepStrictEqual(kemunculan.map((x) => x.n), [720],
        'aiMoveTimeout harus tepat satu kemunculan (deklarasi)');
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

test('inisialisasi script.js menulis Box.edges yang tidak pernah dibaca (dead write)', () => {
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
    assert.deepStrictEqual(kunci, ['edges,owner'], 'Box nyata di script.js membawa field edges');

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
   Bagian 3 — executeAIMove tanpa fallback
   ============================================================ */

const skripUntai = ambilFungsi(sumberSkrip, 'executeAIMove');

function jalankanKasusAIMove({ move, pemainAI }) {
    const sb = {};
    const jejak = { makeMove: [] };
    sb.console = console;
    sb.gameState = {
        isGameOver: false,
        isReplayMode: false,
        currentPlayerIndex: pemainAI ? 0 : 1,
        config: { gridSize: 3 },
        edges: { horizontal: [[{ owner: null }]], vertical: [[{ owner: null }]] },
        boxes: [[{ owner: null }]],
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

test('getBestMove()==null pada giliran AI: tidak ada fallback, giliran menggantung', () => {
    const jejak = jalankanKasusAIMove({ move: null, pemainAI: true });
    assert.strictEqual(jejak.getBestMoveDipanggil, true);
    assert.strictEqual(jejak.makeMove.length, 0, 'tidak boleh ada langkah pengganti');
    assert.strictEqual(jejak.switchTurnDipanggil, undefined, 'giliran tidak berpindah');
    assert.strictEqual(jejak.endGameDipanggil, undefined);
    assert.strictEqual(jejak.toast, undefined, 'pemain tidak diberi tahu apa pun');
});

test('kontra-bukti: getBestMove() valid tetap diteruskan ke makeMove', () => {
    const jejak = jalankanKasusAIMove({
        move: { type: 'horizontal', row: 0, col: 0 },
        pemainAI: true
    });
    assert.deepStrictEqual(jejak.makeMove, [['horizontal', 0, 0]],
        'harness harus membuktikan jalur sukses, bukan hanya jalur gagal');
});
