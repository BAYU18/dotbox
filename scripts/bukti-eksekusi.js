/* ============================================================
   BUKTI EKSEKUSI (p3) — bukti empiris three finding untuk proposal.

   Tujuan: mengubah klaim dokumen dari "asumsi" menjadi "tervalidasi",
   atau sebaliknya menjatuhkan klaim yang tidak didukung bukti.

   Struktur skrip ini SENGAJA dipecah jadi bagian yang saling
   independen dan TIDAK bergantung pada `setTimeout` asli:

     (1) analisis statis pipeline penjadwalan AI di script.js
         (jumlah jalur penjadwal makeAIMove, dan apakah aiMoveTimeout
          benar-benar dipakai)
     (2) `Rules.createBoard` memang tidak menghasilkan field `edges`
         pada Box, sedangkan script.js:142-147 menulis field itu
         tetapi tidak pernah dibaca kembali (dead write)
     (3) bukti dinamis dengan mengangkut `executeAIMove` nyata ke
         sandbox: bila `getBestMove` mengembalikan null, giliran
         menggantung (tidak ada fallback, tidak ada pergantian giliran)

   Jalankan:
       node scripts/bukti-eksekusi.js            # laporkan (exit 0)
       node scripts/bukti-eksekusi.js --strict   # exit != 0 bila ada yang gagal

   Skrip ini TIDAK mengubah kode produksi; ia hanya membaca dan
   mengeksekusi di memori.
   ============================================================ */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SKRIP = 'script.js';
const ATURAN = 'rules.js';

/* ---------- helper pelaporan ---------- */
const hasil = [];
function catat(nama, lulus, detail) {
    hasil.push({ nama, lulus, detail });
    const tanda = lulus ? 'BUKTI-KUAT' : 'BUKTI-GAGAL';
    console.log(`\n[${tanda}] ${nama}`);
    console.log(detail);
}

function baca(berkas) {
    return fs.readFileSync(path.join(ROOT, berkas), 'utf8');
}

function barisKeTeks(teksSumber) {
    return teksSumber.split('\n');
}

/* ============================================================
   BAGIAN 1 — Analisis statis penjadwalan AI di script.js
   ============================================================ */

console.log('='.repeat(72));
console.log('BAGIAN 1 — Jalur penjadwalan makeAIMove dan status aiMoveTimeout');
console.log('='.repeat(72));

const sumberSkrip = baca(SKRIP);
const baris = barisKeTeks(sumberSkrip);

// 1a. Definisi fungsi
const defMenjadwalkan = baris
    .map((t, i) => ({ t, n: i + 1 }))
    .filter(({ t }) => /setTimeout\(\s*\(\)\s*=>\s*makeAIMove\(\)/.test(t));

// 1b. Panggilan yang BUKAN lewat setTimeout (mis. makeAIMove() langsung)
const defPanggilLangsung = baris
    .map((t, i) => ({ t, n: i + 1 }))
    .filter(({ t }) => /(^|[^.\w])makeAIMove\(\s*\)/.test(t) && !/=>\s*makeAIMove/.test(t));

// 1c. Pembungkusan di dalam makeAIMove: setTimeout(() => executeAIMove(), ...)
const defPembungkus = baris
    .map((t, i) => ({ t, n: i + 1 }))
    .filter(({ t }) => /setTimeout\(\s*\(\)\s*=>\s*executeAIMove\(\)/.test(t));

// 1d. Apakah aiMoveTimeout dipakai lagi setelah deklarasinya?
const defAiMoveTimeout = baris
    .map((t, i) => ({ t, n: i + 1 }))
    .filter(({ t }) => /aiMoveTimeout/.test(t));

const nolBaris = (xs) => xs.map((x) => `${SKRIP}:${x.n}  ${x.t.trim()}`).join('\n');
const jalurJadwal = defMenjadwalkan.length;

catat(
    '1a. Jalur yang menjadwalkan makeAIMove',
    jalurJadwal >= 1 && defPembungkus.length >= 1,
    [
        `Jumlah jalur setTimeout(() => makeAIMove()) : ${jalurJadwal}`,
        nolBaris(defMenjadwalkan),
        '',
        `Panggilan langsung (tanpa setTimeout)         : ${defPanggilLangsung.length}`,
        nolBaris(defPanggilLangsung) || '(tidak ada)',
        '',
        'Catatan: jalur ke-3 (switchTurn) adalah penjadwalan BERSYARAT '
            + '(hanya saat pemain berikutnya isAI).'
    ].join('\n')
);

catat(
    '1b. Pembungkusan ganda setTimeout di dalam makeAIMove',
    defPembungkus.length === 1,
    [
        `Jumlah setTimeout(() => executeAIMove()) : ${defPembungkus.length}`,
        nolBaris(defPembungkus)
    ].join('\n')
);

catat(
    '1c. aiMoveTimeout: dideklarasikan tetapi TIDAK pernah dipakai',
    defAiMoveTimeout.length === 1,
    [
        `Semua kemunculan identifier 'aiMoveTimeout' di ${SKRIP}: ${defAiMoveTimeout.length}`,
        nolBaris(defAiMoveTimeout),
        '',
        'Kesimpulan: hanya ada deklarasi `let aiMoveTimeout = null;`, '
            + 'tidak ada penugasan, pembacaan, clearTimeout(aiMoveTimeout), '
            + 'maupun referensi lain -> variabel mati.'
    ].join('\n')
);

/* ============================================================
   BAGIAN 2 — Box tanpa field `edges` (Rules) vs dead write (script.js)
   ============================================================ */

console.log('\n' + '='.repeat(72));
console.log('BAGIAN 2 — Bentuk Box: Rules.createBoard vs inisialisasi script.js');
console.log('='.repeat(72));

const Rules = require(path.join(ROOT, ATURAN));
const papan = Rules.createBoard(3);

const kunciBoxAturan = [...new Set(papan.boxes.flat().map((b) => Object.keys(b).sort().join(',')))];
const kunciEdgeAturan = [...new Set(papan.edges.horizontal.flat().map((e) => Object.keys(e).sort().join(',')))];
const contohBoxAturan = JSON.stringify(papan.boxes[0][0]);

// Ekstrak contoh inisialisasi Box dari script.js saat runtime (bukan dari teks):
// jalankan paruh inisialisasi di sandbox tanpa DOM.
const potonganInisialisasi = (() => {
    const mulai = sumberSkrip.indexOf('gameState.boxes = Array(gridSize - 1)');
    const akhir = sumberSkrip.indexOf('// Initialize AI Engine', mulai);
    return sumberSkrip.slice(mulai, akhir);
})();
const sb = {};
vm.createContext(sb);
const kunci = '__boxesHasilSablon';
vm.runInContext(
    `const gridSize = 3; let gameState = {};\n${potonganInisialisasi}\n`
        + `globalThis.${kunci} = JSON.stringify(gameState.boxes);`,
    sb,
    { filename: `${SKRIP} (paruh inisialisasi boxes)` }
);
const boxesSablon = JSON.parse(sb[kunci]);
const kunciBoxSkrip = [...new Set(boxesSablon.flat()
    .flat()
    .map((b) => Object.keys(b).sort().join(',')))];
const contohBoxSkrip = JSON.stringify(boxesSablon[0][0]);

// Apakah field `edges` pada Box pernah dibaca? Cari akses `.edges` yang
// berindeks kotak, dan konstruksi eksplisit lain di luar inisialisasi.
const pembacaEdgesBox = baris
    .map((t, i) => ({ t, n: i + 1 }))
    .filter(({ t }) => /\.boxes\s*\[[^\]]+\]\s*\[[^\]]+\]\s*\.\s*edges/.test(t)
        || /\bbox\w*\.edges\b/.test(t));

catat(
    '2a. Rules.createBoard menghasilkan Box TANPA field `edges`',
    kunciBoxAturan.length === 1 && kunciBoxAturan[0] === 'owner',
    [
        `Bentuk Box dari Rules.createBoard(3) : ${kunciBoxAturan.join(' | ')}`,
        `Contoh nyata                         : ${contohBoxAturan}`,
        `Bentuk Edge dari Rules.createBoard(3): ${kunciEdgeAturan.join(' | ')}`
    ].join('\n')
);

catat(
    '2b. Inisialisasi script.js menulis field `edges` yang tidak pernah dibaca',
    kunciBoxSkrip.length === 1 && kunciBoxSkrip[0] === 'edges,owner' && pembacaEdgesBox.length === 0,
    [
        `Bentuk Box dari inisialisasi ${SKRIP} : ${kunciBoxSkrip.join(' | ')}`,
        `Contoh nyata                          : ${contohBoxSkrip}`,
        '',
        `Pembaca field Box.edges ditemukan     : ${pembacaEdgesBox.length}`,
        nolBaris(pembacaEdgesBox) || '(tidak ada)',
        '',
        'Kesimpulan: field `edges` pada Box adalah DEAD WRITE; '
            + 'satu-satunya pembaca field milik Edge (state.edges.horizontal/vertical) '
            + 'yang punya bentuk { owner: null } dan memang dipakai.'
    ].join('\n')
);

/* ============================================================
   BAGIAN 3 — executeAIMove tanpa fallback saat getBestMove null
   ============================================================ */

console.log('\n' + '='.repeat(72));
console.log('BAGIAN 3 — getBestMove null => giliran menggantung (bukti dinamis)');
console.log('='.repeat(72));

/* Ambil SATU fungsi produksi utuh (definisi + body) dengan pencocokan
   kurung kurawal berimbang — bukan potong-berdasarkan-penanda, yang
   pernah memotong body secara salah. */
function ambilFungsi(sumber, namaFungsi) {
    const kepala = `function ${namaFungsi}(`;
    const mulai = sumber.indexOf(kepala);
    if (mulai < 0) throw new Error(`${namaFungsi} tidak ditemukan di ${SKRIP}`);
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

const skripUntai = [ambilFungsi(sumberSkrip, 'executeAIMove'), ''].join('\n');

function jalankanKasusAIMove({ nama, move, pemainAI }) {
    const sb = {};
    const jejak = { makeMove: [], sudahSelesai: false };
    sb.console = console;
    sb.gameState = {
        isGameOver: false,
        isReplayMode: false,
        currentPlayerIndex: pemainAI ? 0 : 1,
        config: { gridSize: 3 },
        edges: {
            horizontal: [[{ owner: null }]],
            vertical: [[{ owner: null }]]
        },
        boxes: [[{ owner: null }]],
        // Harness WAJIB mengikuti kondisi `isAI` yang diminta kasus.
        // Versi pertama selalu menandai pemain 0 sebagai AI, sehingga
        // kasus non-AI keluar lebih awal dan kontra-buktinya palsu.
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
    sb.makeMove = (...args) => {
        jejak.makeMove.push(args);
        return true;
    };
    sb.switchTurn = () => { jejak.switchTurnDipanggil = true; };
    sb.showToast = (pesan) => { jejak.toast = pesan; };
    sb.endGame = () => { jejak.endGameDipanggil = true; };

    // `makeMove`, `switchTurn`, `showToast`, `endGame` adalah identifier
    // BEBAS di dalam executeAIMove (bukan `sb.makeMove`), jadi ia harus
    // di-resolve lewat global context. Di VM non-strict, `var` pada fungsi
    // bersarang-langsung punya cakupan FUNCTION scope, bukan context global —
    // resolusinya tetap lewat global object, jadi deklarasi di sini aman dan
    // yang perlu benar adalah pemetaan `sb.*`.
    vm.createContext(sb);
    vm.runInContext(
        `${skripUntai}\n${nama}`,
        sb,
        { filename: `${SKRIP} (executeAIMove disadur)` }
    );
    return jejak;
}

const kasusNull = jalankanKasusAIMove({
    nama: 'globalThis.__hasil = executeAIMove();',
    move: null,
    pemainAI: true
});

catat(
    '3a. getBestMove() === null pada giliran AI => tidak ada fallback',
    kasusNull.makeMove.length === 0
        && kasusNull.switchTurnDipanggil !== true
        && kasusNull.endGameDipanggil !== true
        && kasusNull.toast === undefined,
    [
        'Skenario: pemain AI aktif, papan masih punya langkah legal, '
            + 'tetapi mesin AI mengembalikan null.',
        'Fungsi yang dieksekusi: executeAIMove() ASLI dari script.js '
            + '(disadur ke sandbox VM, tidak diubah).',
        '',
        `getBestMove dipanggil        : ${kasusNull.getBestMoveDipanggil === true}`,
        `makeMove dipanggil berapa x  : ${kasusNull.makeMove.length}`,
        `switchTurn dipanggil         : ${kasusNull.switchTurnDipanggil === true}`,
        `endGame dipanggil            : ${kasusNull.endGameDipanggil === true}`,
        `pesan ke pemain (showToast)  : ${kasusNull.toast === undefined ? '(tidak ada)' : kasusNull.toast}`,
        '',
        'Kesimpulan: pada `if (!move) return;` (script.js:746) fungsi keluar '
            + 'TANPA memilih ulang, TANPA berpindah giliran, dan TANPA '
            + 'memberi tahu pemain. Pemain yang sudah terlanjur gilirannya '
            + 'tidak punya jalur pemulihan di dalam satu snapshot kode ini; '
            + 'satu-satunya harapan adalah efek samping setTimeout yang masih '
            + 'tertunda.'
    ].join('\n')
);

/* Kontra-bukti: bila move valid, makeMove memang dipanggil -> skenario
   di atas spesifik null, bukan kegagalan setup.
   `pemainAI: true` WAJIB: versi pertama lupa argumen ini sehingga pemain 0
   tidak ditandai AI dan eksekusi berhenti di guard `!currentPlayer.isAI`
   (kontra-bukti palsu, bukan perilaku produksi). */
const kasusValid = jalankanKasusAIMove({
    nama: 'globalThis.__hasil = executeAIMove();',
    move: { type: 'horizontal', row: 0, col: 0 },
    pemainAI: true
});
catat(
    '3b. Kontra-bukti: move valid tetap diproses (setup benar)',
    kasusValid.makeMove.length === 1,
    [
        `makeMove dipanggil berapa x : ${kasusValid.makeMove.length}`,
        `Argumen                     : ${JSON.stringify(kasusValid.makeMove[0])}`,
        '',
        'Ini menunjukkan kasus 3a bukan artefak setup: bedanya hanya '
            + 'nilai kembalian getBestMove (null vs move).'
    ].join('\n')
);

/* ============================================================
   Ringkasan
   ============================================================ */

console.log('\n' + '='.repeat(72));
console.log('RINGKASAN');
console.log('='.repeat(72));
for (const h of hasil) {
    console.log(`${h.lulus ? 'BUKTI-KUAT ' : 'BUKTI-GAGAL'} - ${h.nama.split('\n')[0]}`);
}
const gagal = hasil.filter((h) => !h.lulus);
console.log(`\nTotal bagian: ${hasil.length} | bukti kuat: ${hasil.length - gagal.length} | gagal: ${gagal.length}`);

if (process.argv.includes('--strict') && gagal.length > 0) {
    process.exitCode = 1;
}
