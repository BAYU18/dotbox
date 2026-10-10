/* ============================================================
   Test P5 — ketajaman HiDPI: bitmap × DPR + konversi koordinat pointer.

   Jalankan:  node --test test/dpr.test.js

   Ditulis SEBELUM implementasi (TDD: RED dulu). Tuntutannya berasal dari
   docs/superpowers/specs/2026-10-10-p5-hidpi-design.md §3–§4.

   Invarian yang dijaga: ukuran gambar tetap dalam CSS px (karena
   `setTransform`), sehingga `dotPositions` + `hitRadius` tidak berubah; yang
   berubah hanya resolusi bitmap. Bila konversi input terlupa, test ketiga
   (hit-test di DPR 2) GAGAL — itulah gunanya satu paket/satu PR (Ruling 2).

   Batas jujur: ketajaman di layar Retina NYATA tidak diuji di sini; test ini
   menguji perhitungan, bukan piksel di panel.
   ============================================================ */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const baca = (berkas) => fs.readFileSync(path.join(ROOT, berkas), 'utf8');

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

/** Stub konteks: merekam argumen setTransform supaya bisa diperiksa. */
const ctxCanvas = new Proxy(
    {
        canvas: null, globalAlpha: 1,
        __setTransform: null,
        set font(v) {}, get font() { return ''; }
    },
    {
        get(t, p) {
            if (p === 'setTransform') return (...a) => { t.__setTransform = a; };
            if (p === 'scale') return (...a) => { t.__scale = a; };
            return p in t ? t[p] : () => {};
        },
        set(t, p, v) { t[p] = v; return true; }
    }
);

function buatLocalStorage() {
    return {
        _data: new Map(),
        getItem(k) { return this._data.has(k) ? this._data.get(k) : null; },
        setItem(k, v) { this._data.set(k, String(v)); },
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
    sb.devicePixelRatio = opsi.devicePixelRatio || 1;
    if (opsi.rawat) opsi.rawat(sb);

    vm.createContext(sb);
    for (const berkas of ['rules.js', 'turn-queue.js', 'ai-engine.js', 'script.js']) {
        vm.runInContext(baca(berkas), sb, { filename: berkas });
    }
    return sb;
}

const dalam = (sb, ekspresi) => vm.runInContext(ekspresi, sb);

test('ukuran bitmap = CSS x DPR, ukuran CSS tetap dalam px', () => {
    const sb = muatScript({ devicePixelRatio: 2 });
    // parent 540 -> size = min(540-32, 540-32, 500) = 500
    dalam(sb, `initGame({ gridSize: 3, totalPlayers: 2, aiCount: 0, aiDepth: 1 })`);

    assert.strictEqual(dalam(sb, 'canvas.width'), 1000, 'bitmap harus size*DPR (500*2)');
    assert.strictEqual(dalam(sb, 'canvas.height'), 1000, 'bitmap tinggi harus size*DPR');
    assert.strictEqual(dalam(sb, 'canvas.style.width'), '500px', 'lebar CSS tetap 500px');
    assert.strictEqual(dalam(sb, 'canvas.style.height'), '500px', 'tinggi CSS tetap 500px');
    // Invarian ruang gambar: dotPositions tetap CSS px (padding 50, spacing 200).
    assert.strictEqual(dalam(sb, 'dotPositions[0][0].x'), 50, 'titik pertama tetap di CSS px 50');
    assert.strictEqual(dalam(sb, 'dotPositions[2][2].x'), 450, 'titik terakhir tetap di CSS px 450');
});

test('konteks di-setTransform(dpr,0,0,dpr,0,0)', () => {
    const sb = muatScript({ devicePixelRatio: 2 });
    dalam(sb, `initGame({ gridSize: 3, totalPlayers: 2, aiCount: 0, aiDepth: 1 })`);
    assert.deepStrictEqual(dalam(sb, 'JSON.stringify(ctx.__setTransform)'), '[2,0,0,2,0,0]',
        'konteks harus di-transform DPR agar gambar tidak diperbesar dua kali');
});

test('hit-test tetap memilih garis yang sama pada DPR 1 dan DPR 2', () => {
    // Geometri 3x3 pada size 500 CSS px: padding 50, spacing = (500-100)/2 = 200.
    // Titik tengah garis horizontal (0,0) = (50 + 100, 50) = (150, 50) CSS px.
    // Posisi fisik ini sama di DPR 1 maupun DPR 2 (rect = 500 CSS px).
    function pilih(dpr) {
        const sb = muatScript({ devicePixelRatio: dpr });
        dalam(sb, `initGame({ gridSize: 3, totalPlayers: 2, aiCount: 0, aiDepth: 1 })`);
        return dalam(sb, `(() => {
            let dipilih = null;
            const asli = makeMove;
            globalThis.makeMove = function (type, row, col) {
                dipilih = [type, row, col].join('/');
                return asli(type, row, col);
            };
            handleCanvasClick({ clientX: 150, clientY: 50 });
            return dipilih;
        })()`);
    }

    const dpr1 = pilih(1);
    const dpr2 = pilih(2);
    assert.strictEqual(dpr1, 'horizontal/0/0', 'prasyarat: DPR 1 memilih garis (0,0)');
    assert.strictEqual(dpr2, dpr1,
        'konversi DPR hilang -> garis tetangga / null terpilih saat DPR 2');
});
