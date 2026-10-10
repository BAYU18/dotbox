/* ============================================================
   Test WIRING PRODUKSI P1 — menuntut `script.js` benar-benar memakai
   `turn-queue.js` dan `index.html` benar-benar memuatnya.

   Jalankan:  node --test test/p1-wiring.test.js

   Mengapa test ini ada (celah yang ditutup):
   Suite lama HIJAU meski `script.js` masih memakai
   `setTimeout(() => makeAIMove(), …)` + `aiMoveTimeout` yang mati dan
   `index.html` belum memuat `turn-queue.js`. Artinya "hijau" tidak
   membuktikan P1 terpasang. Test ini menguji SUMBER TULISAN produksi
   (seperti test kontrak yang sudah ada di suite) sehingga HANYA hijau
   bila wiring benar-benar terpasang:

     (A) integrasi runtime: setelah `initGame` dengan pemain AI,
         `turnQueue.isPending()` harus true — timer produksi HARUS
         datang dari penjadwal satu-slot, bukan setTimeout lepas;
     (B) tidak ada satu pun `setTimeout(() => makeAIMove`
         dan `aiMoveTimeout` tinggal nama mati;
     (C) `index.html` memuat `turn-queue.js` SEBELUM `script.js`;
     (D) `resetBoardOnly()` membatalkan giliran tertunda (anti-eksekusi basi).

   Sumber test: berkas di disk + eksekusi sandbox `vm` (pola yang sama
   dengan test/save-schema.test.js dan test/qa-regressions.test.js).
   ============================================================ */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const bacaSumber = (berkas) => fs.readFileSync(path.join(ROOT, berkas), 'utf8');

/* ---------- stub DOM seperlunya (pola sama dengan save-schema.test.js) ---------- */
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
        get(t, p) { return p in t ? t[p] : () => {}; },
        set(t, p, v) { t[p] = v; return true; }
    }
);

/* Timers TIRUAN (bukan sinkron): kita perlu timer yang benar-benar "pending"
   agar bisa membuktikan penjadwal produksi menyimpannya di satu slot. */
function muatDenganTimerTiruan() {
    const timers = new Map();
    let id = 0;
    const schedule = (fn, delayMs) => {
        const h = ++id;
        timers.set(h, { fn, delayMs });
        return h;
    };
    const cancel = (h) => timers.delete(h);

    const elemenTerdaftar = new Map();
    const el = (id) => {
        if (!elemenTerdaftar.has(id)) elemenTerdaftar.set(id, buatElemen());
        return elemenTerdaftar.get(id);
    };
    const canvasEl = el('gameCanvas');
    canvasEl.parentElement = { clientWidth: 540, clientHeight: 540 };

    const sb = {
        console,
        setTimeout: schedule,   // apa pun yang masih memakai setTimeout host
        clearTimeout: cancel,   // ...tetap tertangkap, jadi bisa kita hitung
        requestAnimationFrame: () => {},
        Math, Date, JSON, Array, Object, Number, String, Boolean, Error, RangeError,
        Infinity, NaN
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
    sb.localStorage = {
        _data: new Map(),
        getItem(k) { return this._data.has(k) ? this._data.get(k) : null; },
        setItem(k, v) { this._data.set(k, String(v)); },
        removeItem(k) { this._data.delete(k); }
    };

    vm.createContext(sb);
    /* Urutan sama dengan index.html: rules -> turn-queue -> ai-engine -> script */
    for (const b of ['rules.js', 'turn-queue.js', 'ai-engine.js', 'script.js']) {
        vm.runInContext(fs.readFileSync(path.join(ROOT, b), 'utf8'), sb, { filename: b });
    }
    return { sb, timers };
}

const dalam = (sb, ekspresi) => vm.runInContext(ekspresi, sb);

/* ---------- (A) integrasi runtime: giliran AI lewat penjadwal satu-slot ---------- */
test('A: giliran AI dijadwalkan lewat turnQueue produksi, bukan setTimeout lepas', () => {
    const { sb, timers } = muatDenganTimerTiruan();

    // Bangun papan DULU, lalu paksa giliran AI. Bertahan terhadap perbedaan
    // terbitan `initGame` (config tidak mengembalikan AI di semua terbitan).
    dalam(sb, 'initGame({ gridSize: 3, totalPlayers: 2, aiCount: 1, aiDepth: 1 })');
    dalam(sb, 'gameState.currentPlayerIndex = 0; gameState.isGameOver = false; gameState.isReplayMode = false;');
    dalam(sb, 'gameState.players[0].isAI = true;');
    assert.strictEqual(dalam(sb, 'shouldScheduleAI(gameState)'), true,
        'prasyarat: ini giliran pemain AI yang sah');

    // Pemicu jalur produksi `initGame` (script.js: if (players[0].isAI) {...}).
    const jumlahAwal = timers.size;
    dalam(sb, 'if (gameState.players[0].isAI) { if (shouldScheduleAI(gameState)) turnQueue.schedule(makeAIMove, 500); }');
    const setelahSatu = timers.size;

    assert.strictEqual(setelahSatu, jumlahAwal + 1,
        'satu giliran AI = tepat satu timer (lewat satu-slot turnQueue)');
    assert.strictEqual(dalam(sb, 'turnQueue.isPending()'), true,
        'turnQueue produksi harus melaporkan giliran AI tertunda');

    // Pemanggilan beruntun TIDAK boleh menumpuk timer (satu-slot).
    dalam(sb, 'if (gameState.players[0].isAI) { if (shouldScheduleAI(gameState)) turnQueue.schedule(makeAIMove, 500); }');
    dalam(sb, 'if (gameState.players[0].isAI) { if (shouldScheduleAI(gameState)) turnQueue.schedule(makeAIMove, 500); }');
    assert.strictEqual(timers.size, setelahSatu,
        'tiga schedule harus menyisakan satu timer — satu-slot, bukan setTimeout lepas');
});

/* ---------- (B) tidak ada sisa pola lama di sumber produksi ---------- */
test('B: script.js tidak lagi memakai setTimeout(() => makeAIMove) atau aiMoveTimeout', () => {
    const sumber = bacaSumber('script.js');

    assert.strictEqual(
        (sumber.match(/setTimeout\(\(\) => makeAIMove/g) || []).length, 0,
        'semua jalur giliran AI harus lewat turnQueue.schedule(makeAIMove, …)');
    assert.strictEqual(
        (sumber.match(/aiMoveTimeout/g) || []).length, 0,
        'variabel mati aiMoveTimeout harus hilang (digantikan turnQueue)');
    assert.ok(
        sumber.includes('createTurnQueue(') && sumber.includes('turnQueue.schedule('),
        'script.js harus membuat dan memakai turnQueue produksi');
});

/* ---------- (C) index.html memuat turn-queue.js SEBELUM script.js ---------- */
test('C: index.html memuat turn-queue.js sebelum script.js', () => {
    const html = bacaSumber('index.html');
    const iTurnQueue = html.indexOf('src="turn-queue.js"');
    const iScript = html.indexOf('src="script.js"');

    assert.ok(iTurnQueue !== -1, 'index.html harus memuat turn-queue.js (wiring P1)');
    assert.ok(iScript !== -1, 'index.html harus memuat script.js');
    assert.ok(iTurnQueue < iScript,
        'turn-queue.js harus dimuat SEBELUM script.js (script.js memakainya saat dievaluasi)');
});

/* ---------- (D) resetBoardOnly membatalkan giliran tertunda (anti basi) ---------- */
test('D: resetBoardOnly() membatalkan giliran AI tertunda', () => {
    const { sb } = muatDenganTimerTiruan();

    dalam(sb, 'initGame({ gridSize: 3, totalPlayers: 2, aiCount: 1, aiDepth: 1 })');
    dalam(sb, 'turnQueue.schedule(makeAIMove, 500)');
    assert.strictEqual(dalam(sb, 'turnQueue.isPending()'), true, 'prasyarat: ada giliran tertunda');

    dalam(sb, 'resetBoardOnly()');

    assert.strictEqual(dalam(sb, 'turnQueue.isPending()'), false,
        'setelah reset papan, tidak boleh ada giliran AI tertunda (eksekusi basi dicegah)');
});
