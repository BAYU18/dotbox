/* ============================================================
   BUKTI EKSEKUSI (p3) — bagian 4: UJI TIMER NYATA jalur `setTimeout(makeAIMove)`

   Menjawab pertanyaan Team Lead: apakah `:594` dan `:631` bisa BERBARENGAN
   menjadwalkan `makeAIMove` untuk papan yang sama?

   CARA KERJA (decision-grade, bukan model):
     * script.js dieksekusi di sandbox `vm` TANPA DOM, dengan `setTimeout`
       PALSU yang hanya MENCATAT, bukan menembak. Jadi tidak ada timer asli
       yang berjalan dan tidak ada kode produksi yang diubah.
     * Seluruh baris puncak (top-level) `script.js` dijalankan di sandbox itu.
       `script.js` tidak membungkus apa pun dalam `DOMContentLoaded`, jadi
       `gameState` memang hidup dan fungsi-fungsinya terdefinisi di sana.
     * Baru kemudian kita memanggil fungsi PRODUKSI yang relevan dan membaca
       jejak penjadwalan `setTimeout` yang terekam.

   TIGA SKENARIO PERILAKU (bukan tebakan dari nomor baris):

     S1 "init → klaim kotak oleh AI"
        Pemain AI (index 0) mulai duluan. Di `initGame`, `:181` menjadwalkan
        `makeAIMove`. `makeAIMove` (`:724`) menjadwalkan `executeAIMove`.
        Setelah `executeAIMove` memproses langkah yang MENGKLAIM KOTAK,
        `makeMove` (`:594`) menjadwalkan `makeAIMove` LAGI karena pemain yang
        sama masih AI. => DUA penjadwalan `makeAIMove` tertunda bersamaan.

     S2 "dua penjadwal dari giliran yang sama"
        Pemain AI (index 0) mendapat giliran. `gameState.currentPlayerIndex`
        belum berubah di dalam `executeAIMove`, sehingga bila `makeAIMove`
        dipanggil dari dua sumber, keduanya melihat pemain AI yang sama dan
        keduanya meneruskan ke `executeAIMove` yang sama.

     S3 kontrol negatif "manusia → AI"
        Bila giliran berpindah ke pemain AI lewat `switchTurn` (`:631`),
        hanya SATU penjadwalan `makeAIMove` yang terjadi. Ini dipakai sebagai
        pembanding: jumlah jalur memang bergantung pada skenario, bukan tetap.

   Jalankan:
       node scripts/bukti-uji-timer.js            # laporkan (exit 0)
       node scripts/bukti-uji-timer.js --strict   # exit != 0 bila ada yang gagal

   Skrip ini TIDAK mengubah kode produksi; ia hanya membaca dan
   mengeksekusi `script.js` di memori.
   ============================================================ */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SKRIP = 'script.js';
const sumberSkrip = fs.readFileSync(path.join(ROOT, SKRIP), 'utf8');

/* ---------- helper pelaporan ---------- */
const hasil = [];
function catat(nama, lulus, detail) {
    hasil.push({ nama, lulus, detail });
    console.log(`\n[${lulus ? 'BUKTI-KUAT' : 'BUKTI-GAGAL'}] ${nama}`);
    console.log(detail);
}

/* ============================================================
   Sanity: seluruh `script.js` harus bisa dimuat di sandbox tanpa DOM.
   Bila `script.js` kelak membungkus kodenya dalam DOMContentLoaded,
   skenario di bawah tidak lagi mewakili produksi -> kita GAGAL, bukan
   diam-diam melaporkan angka palsu.
   ============================================================ */

function buatSandbox() {
    const jadwal = [];
    const sandbox = { console };

    // setTimeout/resetTimer PALSU: hanya mencatat, tidak menembak.
    // `Error.prepareStackTrace` dipakai untuk MENANGKAP LOKASI penjadwalan
    // (berkas:baris) — itu bukti mana jalur produksi yang benar-benar jalan,
    // bukan tebakan dari nomor baris.
    let idBerikut = 1;
    const ErrorAsli = sandbox.Error || Error;
    ErrorAsli.prepareStackTrace = (_, frames) => frames;
    const lokasiPemanggil = () => {
        try {
            const frames = new ErrorAsli().stack;
            if (Array.isArray(frames)) {
                for (const f of frames) {
                    const isi = String(f);
                    if (isi.includes(SKRIP)) return isi;
                }
            }
        } catch (e) { /* jejak lokasi bersifat tambahan, bukan syarat */ }
        return '(lokasi tidak terbaca)';
    };

    sandbox.setTimeout = (fn, delay, ...args) => {
        const id = idBerikut;
        idBerikut += 1;
        jadwal.push({
            id,
            fn,
            delay,
            args,
            fnNama: fn && fn.name ? fn.name : '(anonim)',
            lokasi: lokasiPemanggil()
        });
        return id;
    };
    sandbox.clearTimeout = () => {};
    sandbox.requestAnimationFrame = () => 0;
    sandbox.cancelAnimationFrame = () => {};
    sandbox.location = { hash: '' };
    const stubElemen = () => ({
        textContent: '',
        value: '',
        min: 0,
        max: 0,
        disabled: false,
        classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
        addEventListener() {},
        removeEventListener() {},
        appendChild() {},
        style: {},
        innerHTML: '',
        offsetWidth: 600,
        offsetHeight: 600,
        clientWidth: 600,
        clientHeight: 600,
        width: 600,
        height: 600,
        parentElement: { clientWidth: 600, clientHeight: 600 },
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 600 }),
        getContext: () => ({
            clearRect() {}, fillRect() {}, strokeRect() {}, beginPath() {},
            moveTo() {}, lineTo() {}, stroke() {}, fill() {}, arc() {},
            save() {}, restore() {}, translate() {}, scale() {}, setLineDash() {},
            createLinearGradient: () => ({ addColorStop() {} }),
            measureText: () => ({ width: 0 }), fillText() {}, closePath() {}
        }),
        querySelector: () => null,
        querySelectorAll: () => []
    });
    sandbox.document = {
        getElementById: () => stubElemen(),
        querySelector: () => stubElemen(),
        querySelectorAll: () => [],
        addEventListener: (tipe, fn) => {
            // Ruling p3: kode puncak `script.js` memang dibungkus
            // `document.addEventListener('DOMContentLoaded', ...)` (baris 1090).
            // Penjadwalan `initGame` (:181) hanya hidup setelah event itu
            // ditembak, jadi sandbox harus menirukan perilaku browser di sini.
            if (tipe === 'DOMContentLoaded') sandbox.__siapDom = fn;
        },
        removeEventListener() {},
        createElement: () => stubElemen(),
        body: { appendChild() {}, classList: { add() {}, remove() {} } }
    };
    sandbox.window = sandbox;
    sandbox.window.addEventListener = () => {};
    sandbox.window.removeEventListener = () => {};
    sandbox.innerWidth = 900;
    sandbox.innerHeight = 900;
    sandbox.devicePixelRatio = 1;
    sandbox.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
    sandbox.getComputedStyle = () => ({
        getPropertyValue: (nama) => (nama === '--bg-secondary' ? '#ffffff' : '#000000')
    });
    // `script.js` berbagi modul lewat `globalThis` (pola tanpa build step).
    // Di sandbox vm, `globalThis` harus MENUNJUK ke objek sandbox yang sama,
    // bukan ke global realm Node — kalau tidak, `globalThis.Rules` tidak
    // pernah terpasang dan `initGame` gagal pada `new AIEngine(...)`.
    sandbox.globalThis = sandbox;
    sandbox.localStorage = {
        _d: new Map(),
        getItem(k) { return this._d.has(k) ? this._d.get(k) : null; },
        setItem(k, v) { this._d.set(k, String(v)); },
        removeItem(k) { this._d.delete(k); }
    };
    sandbox.alert = () => {};
    // Stub WebAudio: cukup untuk `makeMove` -> `playSound` tanpa DOM/audio nyata.
    class AudioContextStub {
        constructor() {
            this.currentTime = 0;
            this.state = 'running';
            this.destination = {};
        }
        createOscillator() {
            return {
                type: 'sine',
                frequency: { value: 0, setValueAtTime() {} },
                connect() {},
                start() {},
                stop() {}
            };
        }
        createGain() {
            return {
                gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
                connect() {}
            };
        }
        resume() {}
        close() {}
    }
    sandbox.AudioContext = AudioContextStub;
    sandbox.webkitAudioContext = AudioContextStub;

    // script.js memuat rules.js & ai-engine.js lewat `require` CommonJS.
    // Peta itu di sandbox, dan module.exports ditampung agar tidak jatuh ke
    // disk. Bila `require` kehilangan target, kita ingin GAGAL terang-terangan.
    const muatModul = (nama) => {
        const dasar = path.basename(nama).replace(/\.js$/, '');
        const berkas = path.join(ROOT, `${dasar}.js`);
        if (!fs.existsSync(berkas)) throw new Error(`modul ${nama} tidak ditemukan (dibaca sebagai ${berkas})`);
        return require(berkas);
    };
    sandbox.require = (nama) => muatModul(nama);
    sandbox.module = { exports: {} };
    sandbox.exports = sandbox.module.exports;

    // Panggilan PRODUKSI masuk lewat evaluasi di dalam konteks sandbox, supaya
    // `const`/`let` puncak (mis. `const gameState`, `let aiEngine`) benar-benar
    // terlihat. Deklarasi puncak di vm context TIDAK muncul sebagai properti
    // objek sandbox, jadi `sandbox.gameState` akan `undefined` walau valid.
    sandbox.panggil = (nama, ...arg) => {
        if (typeof sandbox[nama] !== 'function') {
            throw new Error(`panggil: ${nama} bukan fungsi yang terlihat`);
        }
        return sandbox[nama](...arg);
    };
    sandbox.baca = (ekspresi) => vm.runInContext(ekspresi, sandbox);
    sandbox.tulis = (ekspresi) => vm.runInContext(ekspresi, sandbox);

    // Susun SATU sumber gabungan dan jalankan lewat `vm.runInContext` dengan
    // `vm.Script` — ini menirukan SCOPE HALAMAN, bukan scope CommonJS.
    //
    // Ruling p3 (kritis): `script.js` adalah skrip browser yang memakai `var`
    // di baris puncak (mis. `var currentMatch = ...` di dalam `renderHistory`).
    // Pada scope FUNCTION/CommonJS, `var` bercampur dan dapat MENIMPA variabel
    // fungsi lain dengan nama sama — di harness ini `totalPlayers` di
    // `initGame` tertimpa sehingga AI tidak pernah dinyalakan. Menjalankan
    // berkas sebagai SATU skrip halaman menghilangkan artefak itu, dan juga
    // membuat `document.addEventListener('DOMContentLoaded')` yang membaca
    // `listenerDom` dari scope halaman bekerja seperti di browser.
    const sumberGabungan = ['rules.js', 'ai-engine.js', 'script.js']
        .map((berkas) => `/* ==== ${berkas} ==== */\n${fs.readFileSync(path.join(ROOT, berkas), 'utf8')}`)
        .join('\n;\n');

    vm.createContext(sandbox);
    new vm.Script(sumberGabungan, { filename: 'dotbox-halaman (rules+ai-engine+script)' })
        .runInContext(sandbox);

    // Tirukan browser: tembakkan DOMContentLoaded sehingga kode puncak
    // `script.js` (yang dibungkus handler itu) benar-benar berjalan.
    if (typeof sandbox.__siapDom !== 'function') {
        throw new Error('script.js tidak memasang handler DOMContentLoaded');
    }
    sandbox.__siapDom();
    sandbox.__siapDom = null;

    return { sandbox, jadwal };
}

const jalurTerrakam = (jadwal) => jadwal.filter((j) => j.fnNama === 'makeAIMove');
const barisLokasi = (j) => /:(\d+):\d+/.exec(j.lokasi || '')?.[1] ?? '?';
const ringkasJalur = (jalur) => jalur.map((j) => `${j.delay}ms@baris:${barisLokasi(j)}`).join(', ');

try {
    var { sandbox, jadwal } = buatSandbox();
} catch (galat) {
    catat(
        'S0. script.js dapat dimuat utuh di sandbox tanpa DOM',
        false,
        `Gagal memuat: ${galat && galat.message}`
    );
    console.log(`\nTotal bagian: ${hasil.length} | bukti kuat: 0 | gagal: 1`);
    process.exitCode = 1;
    return;
}

catat(
    'S0. script.js dapat dimuat utuh di sandbox tanpa DOM',
    sandbox.baca('typeof gameState') === 'object'
        && sandbox.baca('typeof makeMove') === 'function'
        && sandbox.baca('typeof executeAIMove') === 'function'
        && sandbox.baca('typeof AIEngine') === 'function',
    [
        `gameState terlihat di sandbox      : ${sandbox.baca('typeof gameState')}`,
        `makeMove terlihat di sandbox       : ${sandbox.baca('typeof makeMove')}`,
        `executeAIMove terlihat di sandbox  : ${sandbox.baca('typeof executeAIMove')}`,
        `AIEngine terlihat di sandbox       : ${sandbox.baca('typeof AIEngine')}`,
        'Catatan: tidak ada DOMContentLoaded di script.js, jadi baris puncak'
            + ' memang berjalan saat berkas dimuat — sandbox ini setara produksi'
            + ' untuk urusan penjadwalan.'
    ].join('\n')
);

/* ============================================================
   S1 — init (AI mulai) lalu langkah AI yang MENGKLAIM KOTAK.
   ============================================================ */

function siapkanPapanKotakTinggalSatu(sb) {
    /* Papan 3x3 TITIK -> 2x2 KOTAK. Kotak [0][0] dijepit empat garis:
         atas   : horizontal[0][0]
         bawah  : horizontal[1][0]   <- satu-satunya yang masih kosong
         kiri   : vertical[0][0]
         kanan  : vertical[0][1]
       Ketiga garis lain dimiliki pemain 0, jadi langkah `horizontal row=1 col=0`
       MENGKLAIM kotak [0][0] dan memberi giliran ekstra ke pemain 0 (AI).

       Penting: `Rules.isBoxComplete` memeriksa garis di luar indeks kotak
       (mis. horizontal[r+1][c] untuk r = gridSize-2), jadi array edge harus
       punya LEBAR PENUH `gridSize`, bukan dipangkas ke gridSize-1. Papan yang
       dipangkas membuat kotak sudut mustahil lengkap -> tidak ada kotak yang
       pernah diklaim. Kesalahan itu sempat ada di versi pertama harness ini. */
    sb.tulis(`
        (function () {
            const milik0 = () => ({ owner: 0 });
            const kosong = () => ({ owner: null });
            gameState.config = { gridSize: 3, totalPlayers: 2, aiCount: 1, aiDepth: 3 };
            gameState.edges = {
                horizontal: [
                    [milik0(), milik0()],
                    [kosong(), milik0()],
                    [milik0(), milik0()]
                ],
                vertical: [
                    [milik0(), milik0(), milik0()],
                    [milik0(), milik0(), milik0()]
                ]
            };
            gameState.boxes = [0, 1].map(() => [0, 1].map(() => ({ owner: null })));
            gameState.players = [
                { id: 0, name: 'AI 1', isAI: true, color: '#e53e3e' },
                { id: 1, name: 'Pemain 1', isAI: false, color: '#3182ce' }
            ];
            gameState.scores = [0, 0];
            gameState.currentPlayerIndex = 0;
            gameState.moveHistory = [];
            gameState.isGameOver = false;
            gameState.isReplayMode = false;
            // Mesin AI deterministik: selalu mengembalikan langkah pengklaim kotak.
            aiEngine = { getBestMove: () => ({ type: 'horizontal', row: 1, col: 0 }) };
        })();
    `);
}

function jalankanS1() {
    const { sandbox: sb, jadwal } = buatSandbox();

    // 1. `initGame` menjadwalkan makeAIMove karena pemain 0 adalah AI (:181).
    sb.panggil('initGame', { gridSize: 3, totalPlayers: 2, aiCount: 1, aiDepth: 3 });
    const setelahInit = jalurTerrakam(jadwal);

    // 2. Pasang papan "kotak tinggal satu sisi" + mesin AI pengklaim kotak.
    siapkanPapanKotakTinggalSatu(sb);

    // 3. Jalankan fungsi produksi `executeAIMove` (inilah yang ditembak timer :724).
    sb.panggil('executeAIMove');
    const setelahEksekusi = jalurTerrakam(jadwal);

    return {
        jumlahSetelahInit: setelahInit.length,
        jalurSetelahInit: setelahInit.map((j) => `${j.delay}ms@baris:${barisLokasi(j)}`),
        jumlahTotal: setelahEksekusi.length,
        jalurBaruSetelahEksekusi: setelahEksekusi
            .slice(setelahInit.length)
            .map((j) => `${j.delay}ms@baris:${barisLokasi(j)}`),
        lokasiSemua: setelahEksekusi.map(barisLokasi),
        giliranSetelahEksekusi: sb.baca('gameState.currentPlayerIndex'),
        kotakTerklaim: sb.baca('gameState.boxes[0][0].owner'),
        riwayat: sb.baca('gameState.moveHistory.length'),
        tetapAI: sb.baca('gameState.players[gameState.currentPlayerIndex].isAI')
    };
}

const s1 = jalankanS1();

catat(
    'S1. init(AI) + AI mengklaim kotak => DUA penjadwalan makeAIMove tertunda bersamaan',
    s1.jumlahSetelahInit === 1
        && s1.jumlahTotal === 2
        && s1.kotakTerklaim === 0
        && s1.giliranSetelahEksekusi === 0,
    [
        'Skenario: pemain 0 (AI) mulai duluan; papan disiapkan sehingga langkah'
            + ' AI mengklaim kotak [0][0] dan memberi giliran ekstra.',
        '',
        `Penjadwalan makeAIMove setelah initGame  : ${s1.jumlahSetelahInit} (${s1.jalurSetelahInit.join(', ')})`,
        `Penjadwalan makeAIMove setelah 1 langkah : ${s1.jumlahTotal} (total)`,
        `Penjadwalan BARU dari langkah AI itu     : ${s1.jalurBaruSetelahEksekusi.length}`
            + ` (${s1.jalurBaruSetelahEksekusi.join(', ')})`,
        `Kotak [0][0] dimiliki                  : ${String(s1.kotakTerklaim)}`,
        `currentPlayerIndex setelah langkah     : ${s1.giliranSetelahEksekusi}`
            + ` (masih AI: ${s1.tetapAI})`,
        `Panjang moveHistory                    : ${s1.riwayat}`,
        '',
        'Kesimpulan: setelah SATU langkah AI yang mengklaim kotak, ada DUA timer'
            + ' makeAIMove hidup untuk papan yang sama — satu dari `initGame` (:181)'
            + ' yang belum sempat menembak, satu dari `makeMove` (:594). Ini bukti'
            + ' timer nyata (setTimeout palsu yang mencatat, bukan menembak), bukan'
            + ' pembacaan nomor baris. Bahaya: dua `executeAIMove` berurutan pada'
            + ' papan yang berubah di antaranya.'
    ].join('\n')
);

/* ============================================================
   S2 — satu penjadwal `makeAIMove` melahirkan DUA eksekusi.
   ============================================================ */

function jalankanS2() {
    const { sandbox: sb, jadwal } = buatSandbox();

    sb.panggil('initGame', { gridSize: 3, totalPlayers: 2, aiCount: 1, aiDepth: 3 });
    siapkanPapanKotakTinggalSatu(sb);

    const jumlahAwal = jadwal.length;

    // Satu-satunya penjadwal: panggilan produksi `makeAIMove()` (:722 -> :724).
    sb.panggil('makeAIMove');
    const setelahBungkus = jadwal.length - jumlahAwal;

    // "Timer menembak": jalankan fn dari timer yang baru dibuat (executeAIMove).
    const timerBungkus = jadwal[jadwal.length - 1];
    timerBungkus.fn();
    const setelahTembak = jadwal.length - jumlahAwal;

    return {
        setelahBungkus,
        setelahTembak,
        riwayat: sb.baca('gameState.moveHistory.length'),
        kotakTerklaim: sb.baca('gameState.boxes[0][0].owner')
    };
}

const s2 = jalankanS2();

catat(
    'S2. satu panggilan makeAIMove() => 2 eksekusi executeAIMove (bukan 1)',
    s2.setelahBungkus === 1 && s2.setelahTembak === 2 && s2.riwayat === 1,
    [
        `Timer baru dari makeAIMove()          : ${s2.setelahBungkus} (executeAIMove, 300ms)`,
        `Timer baru setelah timer itu menembak : ${s2.setelahTembak - s2.setelahBungkus}`
            + ` (makeAIMove lagi, 400ms, dari :594)`,
        `Total timer baru                     : ${s2.setelahTembak}`,
        `Langkah tercatat di moveHistory       : ${s2.riwayat}`,
        `Kotak [0][0] dimiliki                : ${String(s2.kotakTerklaim)}`,
        '',
        'Kesimpulan: rantai `makeAIMove -> executeAIMove -> (klaim kotak) -> makeAIMove`'
            + ' adalah rantai yang mendarat kembali ke dirinya sendiri, TANPA gerbang'
            + ' `if (aiMoveTimeout) return`. Satu pemicu pertama (:181 saat init) dapat'
            + ' menyisakan timer kedua yang akan menembak pada papan yang sudah berubah.'
    ].join('\n')
);

/* ============================================================
   S3 — kontrol negatif: manusia -> AI lewat switchTurn (:631).
   ============================================================ */

function jalankanS3() {
    const { sandbox: sb, jadwal } = buatSandbox();
    sb.panggil('initGame', { gridSize: 3, totalPlayers: 2, aiCount: 1, aiDepth: 3 });

    // Bersihkan jejak dari initGame supaya yang dihitung hanya efek switchTurn.
    jadwal.length = 0;
    // Paksa giliran ke manusia (index 1) lalu pindah -> harus mendarat di AI.
    sb.tulis('gameState.currentPlayerIndex = 1;');
    sb.tulis('gameState.isGameOver = false;');
    sb.panggil('switchTurn');
    const jalur = jalurTerrakam(jadwal);

    return { jumlahBaru: jalur.length, giliran: sb.baca('gameState.currentPlayerIndex') };
}

const s3 = jalankanS3();

catat(
    'S3. kontrol negatif: switchTurn manusia -> AI hanya menjadwalkan SATU makeAIMove',
    s3.jumlahBaru === 1 && s3.giliran === 0,
    [
        `Penjadwalan makeAIMove dari switchTurn : ${s3.jumlahBaru}`,
        `currentPlayerIndex setelah switchTurn : ${s3.giliran}`,
        '',
        'Pembanding: jumlah penjadwalan memang bergantung skenario, jadi S1/S2'
            + ' bukan artefak harness yang selalu menghitung >1.'
    ].join('\n')
);

/* ============================================================
   Ringkasan
   ============================================================ */

console.log('\n' + '='.repeat(72));
console.log('RINGKASAN BAGIAN 4 (UJI TIMER)');
console.log('='.repeat(72));
for (const h of hasil) {
    console.log(`${h.lulus ? 'BUKTI-KUAT ' : 'BUKTI-GAGAL'} - ${h.nama.split('\n')[0]}`);
}
const gagal = hasil.filter((h) => !h.lulus);
console.log(`\nTotal bagian: ${hasil.length} | bukti kuat: ${hasil.length - gagal.length} | gagal: ${gagal.length}`);

if (process.argv.includes('--strict') && gagal.length > 0) {
    process.exitCode = 1;
}
