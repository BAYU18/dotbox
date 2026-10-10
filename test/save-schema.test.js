/* ============================================================
   Test untuk versi skema save (P2).

   Jalankan:  node --test test/save-schema.test.js

   Alasan test ini ada:
   `saveGame` (`script.js:756`) menulis save TANPA field `version`, dan
   `buatKandidatState` (`script.js:785`) tidak dapat membedakan save lama
   yang sah dari save yang rusak/versi masa depan — keduanya ditolak
   dengan pesan yang sama. Test ini memaku tiga hal:
     (1) save warisan TANPA `version` tetap dapat dimuat (= v1),
     (2) save ber-`version` tak dikenal DITOLAK,
     (3) penolakan TIDAK merusak `gameState` yang sedang berjalan (QA-2).

   Pola stub DOM mengikuti `test/qa-regressions.test.js`; kita TIDAK
   menyalin ulang logika validasi — kita panggil `buatKandidatState`
   milik `script.js` sendiri lewat sandbox `vm`.

   KEHORMATAN BUKTI (ADR-0002): berkas ini DITULIS oleh architect tetapi
   BELUM PERNAH DIJALANKAN (langkah penulisan tidak punya akses shell).
   RED yang DIHARAPKAN sebelum T6 (prediksi dari pembacaan kode, bukan klaim):
     * test "save version=1 dimuat ..."      -> GAGAL (save belum menulis `version`)
     * test "save dengan version tak dikenal ditolak" -> GAGAL
       (buatKandidatState belum memeriksa versi)
   Setelah T6 ketujuh test harus hijau. Perintah: node --test test/save-schema.test.js
   ============================================================ */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

/* ---------- stub DOM seperlunya (sama semangatnya dengan qa-regressions) ---------- */
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

function muatScript() {
    const elemenTerdaftar = new Map();
    const el = (id) => {
        if (!elemenTerdaftar.has(id)) elemenTerdaftar.set(id, buatElemen());
        return elemenTerdaftar.get(id);
    };
    const canvasEl = el('gameCanvas');
    canvasEl.parentElement = { clientWidth: 540, clientHeight: 540 };

    const sb = {
        console,
        setTimeout: (fn) => fn(), // sinkron: giliran AI deterministik
        clearTimeout: () => {},
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
    /* `turn-queue.js` dimuat bila ada, agar urutan sama dengan index.html;
       test ini tidak bergantung padanya, jadi ketiadaannya tidak fatal
       (require di dalam try supaya test save tetap berjalan mandiri). */
    const berkas = ['rules.js', 'ai-engine.js', 'turn-queue.js', 'script.js'];
    for (const b of berkas) {
        const p = path.join(ROOT, b);
        if (!fs.existsSync(p)) continue;
        vm.runInContext(fs.readFileSync(p, 'utf8'), sb, { filename: b });
    }
    return sb;
}

const dalam = (sb, ekspresi) => vm.runInContext(ekspresi, sb);

function mulaiPermainan(sb, gridSize = 3) {
    dalam(sb, `initGame({ gridSize: ${gridSize}, totalPlayers: 2, aiCount: 1, aiDepth: 1 })`);
    const gs = dalam(sb, 'gameState');
    gs.currentPlayerIndex = 0;
    gs.players.forEach((p) => { p.isAI = false; }); // matikan AI: deterministik
    return gs;
}

/* Ambil save terakhir yang ditulis `saveGame`, sebagai objek nyata. */
const bacaSave = (sb) =>
    dalam(sb, "JSON.parse(localStorage.getItem('dotsandboxes_current'))");

/* ---------- Test 1: save tanpa version (warisan) diterima sebagai v1 ---------- */
test('save tanpa version (warisan) diterima sebagai versi 1', () => {
    const sb = muatScript();
    mulaiPermainan(sb);

    const save = bacaSave(sb);
    delete save.version; // simulasi save lama yang sudah ada di localStorage pengguna

    const kandidat = dalam(sb, `buatKandidatState(${JSON.stringify(save)})`);
    assert.notStrictEqual(
        kandidat, null,
        'save warisan tanpa `version` harus tetap dapat dimuat sebagai v1 (keputusan Q1-A)');
});

/* ---------- Test 2: save ber-version tak dikenal / rusak ditolak ---------- */
test('save dengan version tak dikenal ditolak sebagai kandidat', () => {
    const sb = muatScript();
    mulaiPermainan(sb);

    const save = bacaSave(sb);
    save.version = 99;

    assert.strictEqual(
        dalam(sb, `buatKandidatState(${JSON.stringify(save)})`), null,
        'versi masa depan (99) harus ditolak, bukan ditebak');
});

test('save dengan version bukan bilangan bulat yang sah ditolak', () => {
    const sb = muatScript();
    mulaiPermainan(sb);

    for (const buruk of ['"1"', 'null', 'true', '{}', '[]', '1.5', '-1', '0']) {
        const save = bacaSave(sb);
        save.version = JSON.parse(buruk);
        assert.strictEqual(
            dalam(sb, `buatKandidatState(${JSON.stringify(save)})`), null,
            `version=${buruk} harus ditolak`);
    }
});

/* ---------- Test 3: save version=1 ditulis & dimuat utuh ---------- */
test('save version=1 dimuat dan gameState terpasang utuh', () => {
    const sb = muatScript();
    mulaiPermainan(sb);

    const versi = bacaSave(sb).version;
    assert.strictEqual(versi, 1, 'saveGame harus menulis version: 1');

    const hasil = dalam(sb, 'loadGame()');
    assert.strictEqual(hasil, true, 'save versi 1 harus dimuat');
    assert.strictEqual(dalam(sb, 'gameState.config.gridSize'), 3, 'config terpasang benar');
    assert.doesNotThrow(() => dalam(sb, 'drawBoard()'),
        'papan harus dapat digambar setelah muat');
});

/* ---------- Test 4: versi tak dikenal TIDAK merusak state berjalan (QA-2) ---------- */
test('loadGame menolak versi tak dikenal TANPA merusak state berjalan', () => {
    const sb = muatScript();
    mulaiPermainan(sb);

    const configSebelum = JSON.stringify(dalam(sb, 'gameState.config'));
    const papanSebelum = JSON.stringify(dalam(sb, 'gameState.boxes'));

    const save = bacaSave(sb);
    save.version = 99;
    dalam(sb,
        `localStorage.setItem('dotsandboxes_current', ${JSON.stringify(JSON.stringify(save))})`);

    assert.strictEqual(dalam(sb, 'loadGame()'), false, 'versi 99 harus ditolak');
    assert.strictEqual(
        JSON.stringify(dalam(sb, 'gameState.config')), configSebelum,
        'config state berjalan tidak boleh berubah');
    assert.strictEqual(
        JSON.stringify(dalam(sb, 'gameState.boxes')), papanSebelum,
        'papan state berjalan tidak boleh berubah');
    assert.doesNotThrow(
        () => dalam(sb, "makeMove('horizontal', 0, 0)"),
        'permainan berjalan harus tetap dapat dilanjutkan setelah penolakan');
});
