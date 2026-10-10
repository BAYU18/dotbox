/* ============================================================
   Test P2-sisa — diagnosa alasan penolakan save + migrasi save
   warisan ber-`edges`.

   Jalankan:  node --test test/p2-sisa.test.js

   Ditulis SEBELUM implementasi (TDD: RED dulu). Tuntutannya berasal dari
   docs/superpowers/specs/2026-10-10-p2-sisa-migrasi-save-design.md §4.

   Kontrak yang dipegang:
     - `buatKandidatState(saveData)` tetap mengembalikan `null` bila ditolak
       (signature lama tidak berubah; parameter `alasan` opsional).
     - Tiga kelas penolakan bisa DIBEDAKAN dari `console.error`:
       bukan-objek / versi-tak-dikenal / struktur-tak-valid.
     - Save warisan `{ owner, edges:{...} }` TANPA `version` tetap diterima;
       `gameState.boxes` ternormalisasi ke bentuk kanonik `{ owner }`.
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

function muatScript() {
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

    vm.createContext(sb);
    for (const berkas of ['rules.js', 'turn-queue.js', 'ai-engine.js', 'script.js']) {
        vm.runInContext(baca(berkas), sb, { filename: berkas });
    }
    return sb;
}

const dalam = (sb, ekspresi) => vm.runInContext(ekspresi, sb);

/**
 * Save warisan: bentuk LAMA (tiap kotak `{ owner, edges }`), TANPA `version`.
 * Dimensi mengikuti validator: boxes = (gridSize-1) x (gridSize-1) = 2x2,
 * edges.horizontal = 3x2, edges.vertical = 2x3.
 */
function saveWarisanBerEdges() {
    const garis = () => ({ owner: null });
    const kotakLama = (owner) => ({ owner, edges: { top: null, bottom: null, left: null, right: null } });
    return {
        config: { gridSize: 3, totalPlayers: 2, aiCount: 0, aiDepth: 1 },
        players: [
            { name: 'Pemain 1', color: '#3b82f6', score: 0, isAI: false },
            { name: 'Pemain 2', color: '#ef4444', score: 0, isAI: false }
        ],
        currentPlayerIndex: 0,
        edges: {
            horizontal: [[garis(), garis()], [garis(), garis()], [garis(), garis()]],
            vertical: [[garis(), garis(), garis()], [garis(), garis(), garis()]]
        },
        boxes: [[kotakLama(null), kotakLama(null)], [kotakLama(null), kotakLama(null)]],
        scores: [0, 0],
        moveHistory: [],
        isGameOver: false
    };
}

/** Rekam semua pesan console.error di dalam sandbox. */
function pasangPerekamPesan(sb) {
    dalam(sb, `(() => {
        globalThis.__pesan = [];
        const asli = console.error;
        console.error = function () {
            globalThis.__pesan.push(Array.prototype.map.call(arguments, String).join(' '));
            if (asli) asli.apply(this, arguments);
        };
    })()`);
}

test('penolakan save: data bukan objek -> pesan "bukan objek"', () => {
    const sb = muatScript();
    pasangPerekamPesan(sb);
    dalam(sb, `localStorage.setItem('dotsandboxes_current', JSON.stringify('bukan objek'))`);

    assert.strictEqual(dalam(sb, 'loadGame()'), false, 'save berupa string harus ditolak');
    const pesan = dalam(sb, '__pesan.join(" ")');
    assert.match(pesan, /bukan objek/i, `pesan harus menyebut data bukan objek; nyatanya "${pesan}"`);
});

test('penolakan save: versi tak dikenal -> pesan "versi" (berbeda dari struktur)', () => {
    const sb = muatScript();
    pasangPerekamPesan(sb);
    dalam(sb, `(() => {
        const s = ${JSON.stringify(saveWarisanBerEdges())};
        s.version = 999;
        localStorage.setItem('dotsandboxes_current', JSON.stringify(s));
    })()`);

    assert.strictEqual(dalam(sb, 'loadGame()'), false, 'versi 999 harus ditolak');
    const pesan = dalam(sb, '__pesan.join(" ")');
    assert.match(pesan, /versi/i, `pesan harus menyebut versi; nyatanya "${pesan}"`);
});

test('penolakan save: struktur tak valid -> pesan "struktur" (berbeda dari versi)', () => {
    const sb = muatScript();
    pasangPerekamPesan(sb);
    dalam(sb, `(() => {
        const s = ${JSON.stringify(saveWarisanBerEdges())};
        delete s.scores;
        localStorage.setItem('dotsandboxes_current', JSON.stringify(s));
    })()`);

    assert.strictEqual(dalam(sb, 'loadGame()'), false, 'save tanpa `scores` harus ditolak');
    const pesan = dalam(sb, '__pesan.join(" ")');
    assert.match(pesan, /struktur/i, `pesan harus menyebut struktur; nyatanya "${pesan}"`);
});

test('migrasi: save warisan ber-edges diterima, boxes ternormalisasi ke { owner }', () => {
    const sb = muatScript();
    // Tulis save SETELAH initGame (initGame memanggil saveGame yang menimpa).
    dalam(sb, `initGame({ gridSize: 3, totalPlayers: 2, aiCount: 0, aiDepth: 1 })`);
    dalam(sb, `localStorage.setItem('dotsandboxes_current', ${JSON.stringify(JSON.stringify(saveWarisanBerEdges()))})`);

    assert.strictEqual(dalam(sb, 'loadGame()'), true, 'save warisan ber-edges harus DITERIMA');

    const kotak = JSON.parse(dalam(sb, 'JSON.stringify(gameState.boxes)'));
    for (const baris of kotak) {
        for (const b of baris) {
            assert.ok(!Object.prototype.hasOwnProperty.call(b, 'edges'),
                `boxes hasil migrasi harus kanonik { owner }; nyatanya ${JSON.stringify(b)}`);
            assert.ok(Object.prototype.hasOwnProperty.call(b, 'owner'), 'owner harus utuh');
        }
    }
});

test('migrasi: save yang DITOLAK tidak mengubah gameState (atomik)', () => {
    const sb = muatScript();
    dalam(sb, `initGame({ gridSize: 3, totalPlayers: 2, aiCount: 0, aiDepth: 1 })`);
    const sebelum = dalam(sb, 'JSON.stringify(gameState.scores)');

    dalam(sb, `(() => {
        const s = ${JSON.stringify(saveWarisanBerEdges())};
        s.scores = 'bukan array';
        localStorage.setItem('dotsandboxes_current', JSON.stringify(s));
    })()`);

    assert.strictEqual(dalam(sb, 'loadGame()'), false, 'skor bukan array harus ditolak');
    assert.strictEqual(dalam(sb, 'JSON.stringify(gameState.scores)'), sebelum,
        'gameState tidak boleh berubah bila save ditolak');
});
