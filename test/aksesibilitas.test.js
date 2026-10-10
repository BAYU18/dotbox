/* ============================================================
   Test aksesibilitas (P3) — statis (baca berkas) + satu test DOM.

   Jalankan:  node --test test/aksesibilitas.test.js

   Ditulis SEBELUM implementasi (TDD: RED dulu). Tuntutannya berasal
   dari docs/superpowers/specs/2026-10-10-p3-aksesibilitas-design.md §2
   dan WCAG 2.2 SC 1.4.4 / 1.4.10 / 2.5.3.

   Batas jujur: test ini membuktikan ATRIBUT ada dan berbentuk benar.
   Ia TIDAK membuktikan pengalaman pembaca layar nyata (NVDA/VoiceOver)
   bagus — tidak ada peramban di sesi ini.
   ============================================================ */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const baca = (berkas) => fs.readFileSync(path.join(ROOT, berkas), 'utf8');
const html = baca('index.html');
const css = baca('style.css');

const WAJIB_LABEL = ['darkModeToggle', 'replayPlayPause', 'replayPrev', 'replayNext', 'replayClose', 'playAgainBtn'];

test('viewport tidak lagi mematikan zoom (WCAG 1.4.4 / 1.4.10)', () => {
    assert.ok(!/user-scalable\s*=\s*no/.test(html), 'index.html masih memuat user-scalable=no');
    assert.ok(!/maximum-scale\s*=\s*1/.test(html), 'index.html masih membatasi maximum-scale');
    assert.match(
        html,
        /<meta\s+name="viewport"\s+content="width=device-width, initial-scale=1\.0">/
    );
});

test('setiap kontrol beremoji punya aria-label tidak kosong, berbahasa Indonesia', () => {
    for (const id of WAJIB_LABEL) {
        const m = html.match(new RegExp(`<button[^>]*id="${id}"[^>]*>`));
        assert.ok(m, `tombol #${id} tidak ditemukan`);
        assert.match(m[0], /aria-label="[^"]+"/, `#${id} belum punya aria-label tidak kosong`);
    }
});

test('tombol berteks visibel TIDAK ditimpa aria-label (WCAG 2.5.3)', () => {
    const kontrol = html.match(/<button[^>]*class="btn-control"[^>]*>/g) || [];
    assert.ok(kontrol.length >= 4, 'blok kontrol berubah bentuk');
    for (const b of kontrol) assert.ok(!/aria-label=/.test(b), `jangan timpa nama tombol berteks: ${b}`);
});

test('style.css memuat :focus-visible dan prefers-reduced-motion', () => {
    assert.match(css, /:focus-visible\s*\{[^}]*outline:/, 'tidak ada :focus-visible dengan outline');
    assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'tidak ada prefers-reduced-motion');
});

test('index.html memuat #liveStatus sebagai live region status', () => {
    const m = html.match(/<div[^>]*id="liveStatus"[^>]*>/);
    assert.ok(m, '#liveStatus tidak ada di index.html');
    assert.match(m[0], /role="status"/);
    assert.match(m[0], /aria-live="polite"/);
});

/* ------------------------------------------------------------------
   Test DOM: `updateUI()` mengisi #liveStatus dengan TEKS (tanpa emoji),
   dan tidak melempar bila live region tidak ada (Review Focus #5).
   ------------------------------------------------------------------ */

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

/** Muat script.js nyata (pola sama dengan test/proposal-p0-p6.test.js). */
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
        getElementById: (id) => {
            if (opsi.tanpaLiveStatus && id === 'liveStatus') return null;
            return id === 'gameCanvas' ? canvasEl : el(id);
        },
        querySelector: () => buatElemen(),
        querySelectorAll: () => [],
        addEventListener() {},
        createElement: () => buatElemen()
    };
    sb.localStorage = buatLocalStorage();
    if (opsi.rawat) opsi.rawat(sb);

    vm.createContext(sb);
    for (const berkas of ['rules.js', 'turn-queue.js', 'ai-engine.js', 'script.js']) {
        vm.runInContext(baca(berkas), sb, { filename: berkas });
    }
    return sb;
}

const dalam = (sb, ekspresi) => vm.runInContext(ekspresi, sb);

test('updateUI() mengisi #liveStatus dengan teks giliran tanpa emoji', () => {
    const sb = muatScript();
    dalam(sb, `initGame({ gridSize: 3, totalPlayers: 2, aiCount: 0, aiDepth: 1 })`);
    dalam(sb, 'updateUI()');
    const teks = dalam(sb, "document.getElementById('liveStatus').textContent");
    assert.match(String(teks), /^Giliran: /, 'live region harus mengumumkan giliran dalam teks');
    assert.ok(
        !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(String(teks)),
        `live region tidak boleh berisi emoji; nyatanya "${teks}"`
    );
});

test('updateUI() tidak melempar bila #liveStatus tidak ada (Review Focus #5)', () => {
    const sb = muatScript({ tanpaLiveStatus: true });
    dalam(sb, `initGame({ gridSize: 3, totalPlayers: 2, aiCount: 0, aiDepth: 1 })`);
    assert.doesNotThrow(() => dalam(sb, 'updateUI()'),
        'updateUI() tidak boleh melempar bila #liveStatus tidak ada');
});
