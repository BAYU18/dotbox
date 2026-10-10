# Eksekusi Proposal `dotbox` P0–P5 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menutup lima defisit proposal `dotbox` (P0 giliran AI menggantung, P3 aksesibilitas, P6 `Box.edges` mati, P2-sisa migrasi & diagnosa save, P5 ketajaman HiDPI) dengan test yang dilihat MERAH lalu HIJAU, lalu menyiapkan push ke `master`.

**Architecture:** Satu berkas produksi (`script.js`) adalah adapter tunggal (DOM, canvas, input, `localStorage`, Audio); aturan papan hidup hanya di `rules.js` (ADR-0001) dan giliran AI diserilkan `turn-queue.js`. Pekerjaan ini **tidak** menambah modul baru: ia menambal satu jalur keluar yang hilang (P0), satu bentuk data ganda (P6/P2-sisa), dua jalur render/input (P5), dan menyapukan aksesibilitas ke permukaan statis (`index.html`, `style.css`) plus satu titik pembaruan UI.

**Tech Stack:** Vanilla JS (ES6+), HTML5 Canvas, CSS3, Node built-in test runner (`node --test`), sandbox `node:vm` + stub DOM. **Tanpa build step, tanpa dependensi baru.**

**Spec:** `docs/superpowers/specs/2026-10-10-eksekusi-p0-p5-dotbox-design.md` (otoritas utama); spec per item: `docs/superpowers/specs/2026-10-10-p0-fallback-ai-design.md`, `-p3-aksesibilitas-design.md`, `-p5-hidpi-design.md`, `-p2-sisa-migrasi-save-design.md`. Rencana kerja Lead: `01-plan.md`.

## Global Constraints

- **Tanpa dependensi baru** dan **tanpa build step**: semua modul dimuat via `<script src>` di
  `index.html`; Node memakainya via `require`/sandbox `vm`.
- **Urutan `<script>` adalah kontrak:** `rules.js` → `turn-queue.js` → `ai-engine.js` → `script.js`
  (`index.html:117–120`; dikunci `test/p1-wiring.test.js` test C dan `test/script-moves.test.js`).
- **`makeMove` adalah satu-satunya penulis papan** di jalur produksi; `Rules.applyMove` tidak boleh
  dipanggil dari `executeAIMove`.
- **Semua string yang dilihat pengguna berbahasa Indonesia**; hanya nama teknis yang bahasa Inggris.
- **Semua perubahan `script.js` menambah/merapikan nomor baris.** Setiap task **wajib** menutup dengan
  `grep -n` untuk baris yang dirujuk task berikutnya (lihat "Baris yang dipakai ulang").
- **Test baru wajib memakai pola suite yang ada**: `test/...` dengan `node:test` + `node:assert`,
  sandbox `vm` meniru `test/qa-regressions.test.js`.
- **Larangan:** tidak boleh `git push --force`; tidak boleh menyentuh `/home/serverbot/aidev`,
  `agents.json`, `.env`, `.git` instalasi, atau worktree/branch agen lain.
- **Kejujuran bukti (ADR-0002):** tidak ada klaim hijau tanpa keluaran mentah yang dilampirkan ke
  `docs/bukti/`.

### Baris yang dipakai ulang antar-task (worktree `20261010-230647`, sebelum perubahan)

| Rujukan | Baris saat ini | Isi |
|---|---|---|
| `executeAIMove` | `script.js:737–763` | guard `:739`, pilihan pemain `:742`, `aiState` `:744–752`, `getBestMove` `:754`, `if (!move) return;` `:756`, `makeMove` `:759` |
| `hitRadius` | `script.js:470` | `const hitRadius = 30;` (tidak diubah P5) |
| handler klik | `script.js:440–451` | `rect` `:446`, `clientX/clientY` `:447–448` |
| handler sentuh | `script.js:453–466` | `rect` `:460`, `touches[0]` `:461–463` |
| `setupCanvas` | `script.js:200–219` | tulis ukuran `:206–207` |
| `handleResize` | `script.js:221–228` | tulis ukuran `:224–225` |
| init Box | `script.js:152–157` | `{ owner: null, edges: {...} }` |
| reset Box | `script.js:1075–1080` | idem |
| `updateUI` | `script.js:708–727` | akhir fungsi `:726` |
| `buatKandidatState` | `script.js:804–877` | cek versi `:808`, cek kunci `:810–812` |
| `loadGame` | `script.js:879–937` | pesan gabungan `:900` |

## Review Focus

Lima input/kondisi yang spec tidak sebut eksplisit dan paling mungkin menggigit. Setiap baris punya test
di task yang memilikinya.

1. **Papan benar-benar penuh** (semua garis ber-`owner`) → `endGame()` dipanggil **dan** pemain diberi
   tahu; **tidak ada** langkah ilegal dimainkan. → **Task 2**, langkah "test papan penuh".
2. **`getBestMove` `null` padahal masih ada garis kosong** → langkah cadangan **legal** dimainkan,
   `owner` = pemain AI, dan toast muncul sekali. → **Task 2**, langkah "test fallback".
3. **Save warisan `{ owner, edges:{...} }` tanpa `version`** → dimuat, pemilik utuh, `edges` hilang dari
   `gameState.boxes`; dan save yang **ditolak** tidak mengubah `gameState`. → **Task 5**, langkah
   "test migrasi" dan "test alasan penolakan".
4. **DPR 2 dengan klik pada titik tengah garis yang sama** → garis terpilih **identik** dengan DPR 1;
   bitmap = CSS × 2 sementara `style` tetap CSS px. → **Task 6**, langkah "test hit-test DPR".
5. **`updateUI()` tanpa `#liveStatus`** (stub DOM test lain / lingkungan lama) → **tidak melempar**,
   hanya melewati pengumuman. → **Task 3**, langkah "test tanpa live region".

---

### Task 1: Perbaiki dua test yang salah (P0-b, P0-c) — tidak menyentuh kode produksi

**Files:**
- Modify: `test/proposal-p0-p6.test.js:188–213` (P0-b), `:215–249` (P0-c)

**Interfaces:**
- Consumes: pola override yang sudah benar di `test/proposal-p0-p6.test.js:143`
  (`dalam(sb, 'aiEngine.getBestMove = function () { return null; }')`).
- Produces: P0-b/P0-c sebagai gerbang yang **sah** bagi Task 2 (sekarang keduanya gagal karena menyadap
  objek yang salah, bukan karena P0 belum dikerjakan).

**Konteks yang sudah saya verifikasi [TERVERIFIKASI]:** `executeAIMove` memanggil
`aiEngine.getBestMove(...)` (`script.js:754`). Karena `aiEngine` adalah `let aiEngine = null;` di tingkat
atas (`script.js:56`), penugasan properti `aiEngine.getBestMove = ...` **berhasil**, sedangkan
`globalThis.getBestMove = ...` **tidak** menggantikan apa pun (deklarasi fungsi tidak menjadi properti
yang bisa ditimpa lewat `globalThis` dari luar). Komentar di `test/proposal-p0-p6.test.js:139–142`
menulis kebalikannya — **komentar itu yang salah, dan harus diperbaiki juga**.

- [ ] **Step 1: Ganti override di P0-b**

Di dalam test `P0-b: fallback hanya memakai langkah LEGAL dari Rules.availableMoves`, ubah:

```js
  dalam(sb, `getBestMove = function () { return null; }`);
```

menjadi

```js
  // PENTING: produksi memanggil `aiEngine.getBestMove` (script.js:754), bukan
  // fungsi global `getBestMove`. Override harus mengenai instance-nya.
  dalam(sb, 'aiEngine.getBestMove = function () { return null; }');
```

- [ ] **Step 2: Ganti override + perbaiki asersi papan-penuh di P0-c**

Di dalam test `P0-c: papan yang benar-benar penuh -> endGame dipanggil, tanpa langkah ilegal`, ubah
komentar `// ...lihat catatan P0-a` lalu override:

```js
  // Override instance `aiEngine` (bukan global) — produksi memanggil ini.
  dalam(sb, 'aiEngine.getBestMove = function () { return null; }');
```

Asersi yang sudah ada (`catat.makeMove === 0`, `catat.endGame > 0`) **dipertahankan** — itu perilaku
benar yang diminta §3.1.

- [ ] **Step 3: Jalankan test untuk memastikan ia GAGAL karena alasan yang benar**

Run: `node --test test/proposal-p0-p6.test.js`
Expected: `P0-a` **GAGAL** (P0 belum dikerjakan → tidak ada langkah cadangan), `P0-b` **GAGAL**
(`makeMove` tidak dipanggil), `P0-c` **GAGAL** (`endGame` tidak dipanggil). Yang harus berubah dari
sebelumnya: **P0-b sekarang benar-benar mengeksekusi `executeAIMove` dengan `getBestMove` null**, bukan
dengan AI asli. Buktikan dengan menyisipkan sementara `assert.strictEqual(catat.makeMove, 0)` yang
**lulus** — kalau ia gagal karena "AI asli tetap memilih langkah", override belum mengenai sasaran.

- [ ] **Step 4: Perbaiki komentar yang menyesatkan**

Ubah komentar `test/proposal-p0-p6.test.js:139–142` agar berbunyi benar (produksi memanggil
`aiEngine.getBestMove`, bukan `getBestMove` global; karena itu override **harus** mengenai instance).

- [ ] **Step 5: Commit**

```bash
git add test/proposal-p0-p6.test.js
git commit -m "test(p0): perbaiki override getBestMove — sadap aiEngine, bukan fungsi global"
```

---

### Task 2: P0 — fallback giliran AI (+ balik dua test penjaga bug)

**Files:**
- Modify: `script.js:756` (blok `if (!move) return;` … `:759`)
- Modify: `test/bukti-eksekusi.test.js:139–191` (harness + dua test `getBestMove()==null`)
- Test: `test/proposal-p0-p6.test.js` (P0-a/b/c — tidak diubah lagi di task ini)

**Interfaces:**
- Consumes: `Rules.availableMoves(state) -> Move[]` (`rules.js:65–86`); `makeMove(type,row,col) -> boolean`
  (`script.js:536`); `switchTurn()` (`:629`); `endGame()` (`:670`); `showToast(msg)` (`:1093`).
- Produces: perilaku "tidak pernah diam" yang dipakai Task 3 sebagai prasyarat (test P0 menyuntikkan
  `setTimeout` sinkron, jadi giliran AI ikut berjalan saat `gameArea` berubah).

- [ ] **Step 1: Tulis test yang menuntut fallback (sudah ada, pastikan RED)**

Fixture P0-a/b/c ada di `test/proposal-p0-p6.test.js`. Jalankan:

Run: `node --test test/proposal-p0-p6.test.js`
Expected: P0-a, P0-b, P0-c **FAIL** dengan pesan "setelah getBestMove() null, AI harus tetap memainkan
langkah cadangan ATAU mengakhiri permainan" / "permainan harus berakhir".

- [ ] **Step 2: Implementasikan blok fallback di `executeAIMove`**

Ganti baris `script.js:756` (`    if (!move) return;`) beserta blok `:757–763` dengan kode di lampiran
`02-architect.md` §A.1 (teks persis). Ringkas: `if (move && makeMove(...)) return;` lalu
`const kandidat = Rules.availableMoves(gameState);` → bila kosong `showToast('Tidak ada langkah
tersisa. Permainan selesai.')` + `endGame()` + `return`; selain itu
`showToast('AI: langkah cadangan dipakai karena pencarian gagal.')` + `makeMove(kandidat[0])`, dan bila
`makeMove` mengembalikan `false` → `switchTurn()` + `showToast('AI tidak dapat bergerak; giliran
dialihkan.')`.

- [ ] **Step 3: Jalankan test P0 sampai hijau**

Run: `node --test test/proposal-p0-p6.test.js`
Expected: P0-a, P0-b, P0-c **PASS**.

- [ ] **Step 4: Jalankan `test/bukti-eksekusi.test.js` untuk melihat test penjaga bug MERAH**

Run: `node --test test/bukti-eksekusi.test.js`
Expected: **FAIL** pada `getBestMove()==null pada giliran AI: tidak ada fallback, giliran menggantung`
dengan `tidak boleh ada langkah pengganti` (kini `makeMove.length === 1`). Ini **diharapkan** — test itu
mengunci bug.

- [ ] **Step 5: Balik test penjaga bug menjadi test penuntut perilaku**

Di `test/bukti-eksekusi.test.js`, ganti test `getBestMove()==null ...` (`:175–182`) dengan:

```js
test('getBestMove()==null pada giliran AI: langkah cadangan tetap dimainkan', () => {
    const jejak = jalankanKasusAIMove({ move: null, pemainAI: true });
    assert.strictEqual(jejak.getBestMoveDipanggil, true);
    assert.strictEqual(jejak.makeMove.length, 1,
        'setelah pencarian gagal, tepat satu langkah cadangan harus dimainkan');
    assert.match(jejak.toast, /cadangan/i,
        'pemain harus diberi tahu bahwa langkah cadangan dipakai');
    assert.strictEqual(jejak.endGameDipanggil, undefined,
        'papan fixture masih punya langkah legal -> permainan tidak boleh berakhir');
});
```

dan perkuat test kontra-bukti (`:184–191`) dengan satu asersi tambahan:

```js
    assert.strictEqual(jejak.toast, undefined, 'jalur normal tidak boleh memunculkan toast');
```

- [ ] **Step 6: Pastikan `Rules` tersedia di sandbox test itu**

`test/bukti-eksekusi.test.js` mengeksekusi `executeAIMove` di `sb = {}` **tanpa** memuat `rules.js`.
Tambahkan sebelum `vm.runInContext`:

```js
    sb.Rules = require(path.join(ROOT, 'rules.js'));
```

dan pastikan `sb.gameState.edges`/`boxes` fixture konsisten dengan papan 3×3 (`edges.horizontal` = 2×2,
`edges.vertical` = 2×2, `boxes` = 2×2) supaya `Rules.availableMoves` mengembalikan dua garis dan
`makeMove` palsu menerima `kandidat[0]`.

- [ ] **Step 7: Jalankan kedua berkas test sampai hijau**

Run: `node --test test/bukti-eksekusi.test.js test/proposal-p0-p6.test.js`
Expected: **semua PASS** kecuali test P6-a (bentuk Box) yang masih merah — itu milik Task 5.

- [ ] **Step 8: Lampirkan bukti mentah**

Simpan keluaran Step 3 dan Step 7 ke `docs/bukti/p0-red.txt` dan `docs/bukti/p0-green.txt`.

- [ ] **Step 9: Commit**

```bash
git add script.js test/bukti-eksekusi.test.js docs/bukti/p0-red.txt docs/bukti/p0-green.txt
git commit -m "feat(p0): fallback giliran AI — jangan biarkan permainan menggantung tanpa pesan"
```

---

### Task 3: P3 — aksesibilitas (viewport, nama tombol, fokus, live region, reduced motion)

**Files:**
- Modify: `index.html:5`, `:15`, `:94–97`, `:108`, `:113`
- Modify: `style.css` (tambah tiga blok di akhir, setelah `:649`)
- Modify: `script.js:708–727` (`updateUI`)
- Create: `test/aksesibilitas.test.js`

**Interfaces:**
- Consumes: tidak ada (task ini tidak bergantung task lain).
- Produces: `#liveStatus` berisi `Giliran: <nama>. Skor: ...` — dipakai Task 3a (opsional) sebagai
  kanal pengumuman.

- [ ] **Step 1: Tulis test yang gagal**

Buat `test/aksesibilitas.test.js`:

```js
/* Test aksesibilitas statis + satu test DOM (pola suite: baca berkas + sandbox vm). */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');

const WAJIB_LABEL = ['darkModeToggle', 'replayPlayPause', 'replayPrev', 'replayNext', 'replayClose', 'playAgainBtn'];

test('viewport tidak lagi mematikan zoom (WCAG 1.4.4 / 1.4.10)', () => {
  assert.ok(!/user-scalable\s*=\s*no/.test(html), 'index.html masih memuat user-scalable=no');
  assert.ok(!/maximum-scale\s*=\s*1/.test(html), 'index.html masih membatasi maximum-scale');
  assert.match(html, /<meta\s+name="viewport"\s+content="width=device-width, initial-scale=1\.0">/);
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
```

- [ ] **Step 2: Jalankan test untuk memastikan ia gagal**

Run: `node --test test/aksesibilitas.test.js`
Expected: **5 FAIL** (viewport masih mengunci zoom, tidak ada `aria-label`, tidak ada `:focus-visible`).

- [ ] **Step 3: Sunting `index.html`**

Terapkan §A.5 dokumen `02-architect.md`: baris 5 → viewport tanpa pembatas; keenam `aria-label`
(`darkModeToggle` → `Ganti mode gelap`; `replayPlayPause` → `Putar atau jeda replay`; `replayPrev` →
`Langkah replay ke belakang`; `replayNext` → `Langkah replay ke depan`; `replayClose` → `Tutup replay`;
`playAgainBtn` → `Main Lagi`); tambah `<div id="liveStatus" class="visually-hidden" role="status"
aria-live="polite" aria-atomic="true"></div>` setelah `#toast`.

- [ ] **Step 4: Tambah tiga blok `style.css`**

Tambahkan persis blok dari §A.4 dokumen `02-architect.md` (`:focus-visible`, `.visually-hidden`,
`@media (prefers-reduced-motion: reduce)`).

- [ ] **Step 5: Perbarui `updateUI()` — tepat tiga baris di akhir**

Tambahkan di akhir `updateUI()` (sebelum `}` penutup, `script.js:726`):

```js
    // Pengumuman status untuk pembaca layar (P3). Nullable-safe: stub DOM test
    // lain dan lingkungan lama boleh tidak punya #liveStatus.
    const liveStatus = document.getElementById('liveStatus');
    if (liveStatus) {
        liveStatus.textContent = `Giliran: ${currentPlayer.name}. Skor: ${
            gameState.players.map((p, i) => `${p.name} ${gameState.scores[i]}`).join(', ')}.`;
    }
```

- [ ] **Step 6: Tulis test DOM untuk `#liveStatus` (Review Focus #5)**

Tambahkan ke `test/aksesibilitas.test.js` satu test yang mengeksekusi `script.js` di sandbox `vm`
(pola `test/proposal-p0-p6.test.js:68–111`), memanggil `initGame({ gridSize: 3, totalPlayers: 2,
aiCount: 0, aiDepth: 1 })`, lalu:

```js
  const teks = dalam(sb, "document.getElementById('liveStatus').textContent");
  assert.match(teks, /^Giliran: /, 'live region harus mengumumkan giliran dalam teks');
  assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(teks), 'live region tidak boleh berisi emoji');
```

dan satu test **tanpa** `#liveStatus` di stub (`getElementById` mengembalikan `null` untuk id itu):

```js
  assert.doesNotThrow(() => dalam(sb, 'updateUI()'),
    'updateUI() tidak boleh melempar bila #liveStatus tidak ada');
```

- [ ] **Step 7: Jalankan sampai hijau, lalu suite penuh**

Run: `node --test test/aksesibilitas.test.js`
Expected: **PASS** semua.
Run: `node --test`
Expected: hanya test P6-a/P2 (Task 5) yang masih merah.

- [ ] **Step 8: Commit**

```bash
git add index.html style.css script.js test/aksesibilitas.test.js
git commit -m "feat(p3): aksesibilitas — zoom, nama tombol, fokus terlihat, live region, reduced motion"
```

---

### Task 5: P6 + P2-sisa — bentuk Box kanonik, migrasi save, diagnosa penolakan

> **Urutan:** Task ini berjalan setelah Task 3 (semua penulis `script.js` sebelumnya selesai).
> Nomor barisnya **wajib** dicari ulang dengan `grep -n` karena Task 2 dan 3 sudah menggesernya.

**Files:**
- Modify: `script.js` (init Box, reset Box, `buatKandidatState`, `loadGame`)
- Modify: `test/bukti-eksekusi.test.js:97–133` (test bentuk Box)
- Create: `test/p2-sisa.test.js`
- Test: `test/proposal-p0-p6.test.js` (P6-a/b, P2-a..d — sudah ada, tidak diubah)

**Interfaces:**
- Consumes: `versiDikenal(version) -> boolean`; `SAVE_KEYS`; `Rules.applyMove`, `Rules.availableMoves`.
- Produces: `buatKandidatState(saveData, alasan?) -> State|null` dengan
  `alasan.kode ∈ {'bukan-objek','versi-tak-dikenal','struktur-tak-valid'}`;
  `PESAN_PENOLAKAN` (peta kode → kalimat) dipakai `loadGame`.

- [ ] **Step 1: Jalankan test P6/P2 untuk melihat RED yang sudah ada**

Run: `node --test test/proposal-p0-p6.test.js`
Expected: `P6-a` FAIL (`Box` masih punya `edges`), `P6-b` FAIL, P2-a..d PASS (versi sudah terpasang).

- [ ] **Step 2: Hapus `edges` dari kedua inisialisasi Box**

Cari ulang:

```bash
grep -n "edges: { top: null" script.js
```

Ubah kedua tempat (init + `resetBoardOnly`) menjadi `({ owner: null })` (§A.3 dokumen
`02-architect.md`).

- [ ] **Step 3: Jalankan test P6 sampai hijau + lihat test penjaga bug merah**

Run: `node --test test/proposal-p0-p6.test.js` → `P6-a`, `P6-b` **PASS**.
Run: `node --test test/bukti-eksekusi.test.js` → **FAIL** pada
`inisialisasi script.js menulis Box.edges yang tidak pernah dibaca (dead write)`
(`expected [ 'owner' ] to deeply equal [ 'edges,owner' ]`).

- [ ] **Step 4: Balik test bentuk Box menjadi test kanonik**

Di `test/bukti-eksekusi.test.js` rename test itu dan ubah asersi:

```js
test('inisialisasi script.js TIDAK lagi menulis Box.edges (dead write dibuang)', () => {
    // ... bagian slicing/potongan SAMA ...
    assert.deepStrictEqual(kunci, ['owner'], 'Box nyata harus kanonik { owner }');
    // ... bagian "tidak boleh ada pembaca Box.edges" DIPERTAHANKAN apa adanya ...
});
```

- [ ] **Step 5: Jalankan test P6 + pembaca sampai hijau**

Run: `node --test test/bukti-eksekusi.test.js test/proposal-p0-p6.test.js`
Expected: kedua test P6 dan kedua test `bukti-eksekusi` **PASS**.

- [ ] **Step 6: Tulis test `test/p2-sisa.test.js` (RED dulu)**

Satu berkas berisi empat test, pola sandbox `vm` + stub DOM seperti `test/save-schema.test.js`:

```js
test('penolakan save: data bukan objek -> pesan "bukan objek"', () => {
  const sb = muatScript();
  const pesan = [];
  dalam(sb, 'console.error = (m) => globalThis.__pesan.push(String(m))');
  dalam(sb, "globalThis.__pesan = []");
  dalam(sb, "localStorage.setItem('dotsandboxes_current', JSON.stringify('bukan objek'))");
  assert.strictEqual(dalam(sb, 'loadGame()'), false);
  assert.ok(dalam(sb, '__pesan.join(" ")').includes('bukan objek'),
    'pesan harus menyebut data bukan objek');
});

test('penolakan save: versi tak dikenal -> pesan "versi skema tidak dikenal"', () => { /* version = 99 */ });
test('penolakan save: struktur tak valid -> pesan "struktur data tidak valid"', () => { /* kunci hilang */ });
test('migrasi: save warisan ber-edges diterima, boxes ternormalisasi, state lama tidak rusak bila ditolak', () => { /* ... */ });
```

Detail penting untuk test keempat: bangun save **tanpa `version`** dengan setiap kotak
`{ owner, edges: { top: null, bottom: null, left: null, right: null } }`, tulis ke `localStorage`
**setelah** `initGame()` (karena `initGame` memanggil `saveGame` di `script.js:187`), panggil
`loadGame()`, lalu pastikan `gameState.boxes[0][0]` **tidak** punya kunci `edges` dan `owner`-nya utuh.

- [ ] **Step 7: Jalankan test baru untuk memastikan ia gagal**

Run: `node --test test/p2-sisa.test.js`
Expected: `FAIL` pada tiga test pesan (satu pesan gabungan) dan `PASS`/`FAIL` pada test migrasi
tergantung kotak sudut yang diperiksa (`edges` masih ada di jalur `initGame`).

- [ ] **Step 8: Implementasikan `alasan` + peta pesan**

Terapkan §A.6 dokumen `02-architect.md`:
`buatKandidatState(saveData, alasan)` dengan helper `tolak(kode)`; **setiap** `return null` diganti
`return tolak('...')` sesuai kelasnya; `SAVE_KEYS` **tidak** diubah; `loadGame` memakai
`PESAN_PENOLAKAN[alasan.kode]`.

- [ ] **Step 9: Jalankan sampai hijau**

Run: `node --test test/p2-sisa.test.js test/proposal-p0-p6.test.js test/save-schema.test.js`
Expected: **semua PASS** (termasuk 5 test `save-schema` lama — kontrak "return null" tidak berubah).

- [ ] **Step 10: Lampirkan bukti + commit**

Simpan keluaran ke `docs/bukti/p6p2s-red.txt` dan `docs/bukti/p6p2s-green.txt`.

```bash
git add script.js test/bukti-eksekusi.test.js test/p2-sisa.test.js docs/bukti/p6p2s-*.txt
git commit -m "refactor(p6)+feat(p2-sisa): Box kanonik { owner }, migrasi save, pesan penolakan terpisah"
```

---

### Task 6: P5 — ketajaman HiDPI (satu paket, satu PR)

**Files:**
- Modify: `script.js` (`setupCanvas`, `handleResize`, `handleCanvasClick`, `handleTouchStart`)
- Create: `test/dpr.test.js`

**Interfaces:**
- Consumes: `calculatePositions()`; `handleLineSelection(x, y)` (`script.js:468`); `hitRadius` (`:470`).
- Produces: `hitungKoordinatPointer(rect, clientX, clientY, canvas, dpr) -> {x, y}` (murni) dan
  `pasangUkuranCanvas(size)` (menulis bitmap, `style`, dan `setTransform`).

- [ ] **Step 1: Tulis test yang gagal**

Buat `test/dpr.test.js` dengan tiga test (pola sandbox `vm` + kanvas stub yang merekam `setTransform`):

```js
test('ukuran bitmap = CSS x DPR, ukuran CSS tetap dalam px', () => {
  // window.devicePixelRatio = 2; container 540x540 -> size = min(508, 508, 500) = 500
  assert.strictEqual(dalam(sb, 'canvas.width'), 1000);
  assert.strictEqual(dalam(sb, 'canvas.style.width'), '500px');
});

test('konteks di-setTransform(dpr,0,0,dpr,0,0)', () => {
  assert.deepStrictEqual(dalam(sb, 'JSON.stringify(ctx.__setTransform)'), '[2,0,0,2,0,0]');
});

test('hit-test tetap memilih garis yang sama pada DPR 1 dan DPR 2', () => {
  // titik tengah garis horizontal (0,0) dalam CSS px: x = (dot[0][0].x + dot[0][1].x)/2, y = dot[0][0].y
  const dipilih1 = dalam(sbDpr1, 'JSON.stringify(pilihGarisDiTitikTengah())');
  const dipilih2 = dalam(sbDpr2, 'JSON.stringify(pilihGarisDiTitikTengah())');
  assert.strictEqual(dipilih2, dipilih1, 'konversi DPR hilang -> garis tetangga / null terpilih');
});
```

Untuk stub kanvas, `ctx` harus benar-benar menyimpan argumen `setTransform` (mis.
`setTransform: (...a) => { ctx.__setTransform = a; }`), dan `canvas.getBoundingClientRect()` harus
mengembalikan `{ left: 0, top: 0, width: 500, height: 500 }` (CSS px) supaya invariannya bermakna.
`pilihGarisDiTitikTengah()` dijalankan di dalam sandbox dan memanggil `handleLineSelection(x, y)`.

- [ ] **Step 2: Jalankan test untuk memastikan ia gagal**

Run: `node --test test/dpr.test.js`
Expected: `FAIL` pada test 1 (`canvas.width` masih 500) dan test 2 (`__setTransform` `undefined`).

- [ ] **Step 3: Implementasikan `pasangUkuranCanvas` + konversi input**

Terapkan §A.7 dokumen `02-architect.md`. `setupCanvas()` dan `handleResize()` memanggil
`pasangUkuranCanvas(size)` **sebelum** `calculatePositions()`. Kedua handler input memakai
`hitungKoordinatPointer(rect, clientX, clientY, canvas, window.devicePixelRatio || 1)`.
`hitRadius` **tidak diubah**.

- [ ] **Step 4: Jalankan sampai hijau**

Run: `node --test test/dpr.test.js`
Expected: **PASS** ketiganya.

- [ ] **Step 5: Jalankan suite penuh — gerbang gelombang**

Run: `node --test`
Expected: **`# pass` = `# tests`, `# fail 0`, `exit=0`**. Lampirkan ke `docs/bukti/gelombang-penuh.txt`.

- [ ] **Step 6: Commit**

```bash
git add script.js test/dpr.test.js docs/bukti/gelombang-penuh.txt
git commit -m "feat(p5): ketajaman HiDPI + konversi koordinat pointer (satu PR, satu gerbang test)"
```

---

### Task 7 (QA): Verifikasi independen gelombang penuh

**Files:**
- Create: `docs/bukti/qa-gelombang-penuh.txt`, `03-qa-test-plan.md`, `04-qa-round0.md`

**Interfaces:**
- Consumes: seluruh hasil Task 1–6.
- Produces: vonis PASS/FAIL + daftar temuan ber-`berkas:baris`.

- [ ] **Step 1: Jalankan suite penuh dari worktree (bukan mengutip)**

Run: `node --test`
Expected: `# fail 0`, `exit=0`. Simpan keluaran mentah.

- [ ] **Step 2: Jalankan per-berkas untuk gerbang per item**

```bash
node --test test/proposal-p0-p6.test.js
node --test test/bukti-eksekusi.test.js
node --test test/aksesibilitas.test.js
node --test test/p2-sisa.test.js
node --test test/dpr.test.js
node --test test/p1-wiring.test.js
node --test test/save-schema.test.js
```

- [ ] **Step 3: Probe statis (nilai target)**

```bash
grep -n "if (!move) return" script.js                 # 0 hasil
grep -n "edges: { top" script.js                      # 0 hasil
grep -c "aria-label" index.html                       # >= 6
grep -n "user-scalable=no\|maximum-scale" index.html  # 0 hasil
grep -n ":focus-visible\|prefers-reduced-motion" style.css   # keduanya ada
grep -n "devicePixelRatio\|setTransform" script.js    # >= 3 hasil
grep -rn "aria-label" script.js                       # 0 hasil (label HANYA di index.html)
```

- [ ] **Step 4: Triase**

Setiap kegagalan dikembalikan ke `developer` dengan bukti `berkas:baris` **dan** keluaran perintah
mentah — bukan opini. Tulis vonis di `04-qa-round0.md`.

---

### Task 8 (DevOps): Push ke GitHub `master`

**Files:**
- Create: `03-devops-prep.md`, `05-devops.md`, `docs/bukti/push-mentah.txt`

**Interfaces:**
- Consumes: vonis PASS dari Task 7.
- Produces: bukti push mentah + commit hash yang dikirim.

- [ ] **Step 1: Periksa kondisi (jangan menebak)**

```bash
git status --short
git log --oneline -n 20
git remote -v
git branch -a
```

Bila `git remote -v` **kosong** atau tidak menunjuk repo GitHub yang dimaksud: **berhenti** dan
laporkan ke Lead. Jangan menambah remote atas inisiatif sendiri.

- [ ] **Step 2: Push tanpa force**

```bash
git push origin HEAD:master
```

Bila ditolak non-fast-forward: **berhenti**, lampirkan keluaran mentah, laporkan. `--force` dilarang.

- [ ] **Step 3: Lampirkan bukti**

Simpan keluaran `git push` (disunting dari token bila ada) ke `docs/bukti/push-mentah.txt`, lalu tulis
`05-devops.md`: commit hash, branch, hasil, dan risiko.

---

## Self-Review (dijalankan sendiri, bukan dispatch subagent)

**1. Cakupan spec.** Spec `2026-10-10-eksekusi-p0-p5-dotbox-design.md` §3.1 → Task 2; §3.2 → Task 3;
§3.3 → Task 5; §3.4 → Task 5; §3.5 → Task 6. Rencana kerja Lead (`01-plan.md`) p0 → Task 2, p3 → Task 3,
p6 → Task 5, p2s → Task 5, p5 → Task 6, qa → Task 7, devops → Task 8, **p4 dan p7 → di luar** (sesuai
K11 dan pertanyaan terbuka §7 spec). **Gap yang saya temukan dan tutup:** `01-plan.md` §3 meminta p3
berjalan "setelah p0" **dan** §3 p3 memerintahkan `updateUI()` menyentuh `#liveStatus`; keduanya sudah
ditampung Task 3. `01-plan.md` juga mewajibkan pembalikan `test/bukti-eksekusi.test.js` "bersamaan dengan
p6" — di plan ini pembalikan **P0** ada di Task 2 Step 5 dan pembalikan **P6** di Task 5 Step 4, karena
keduanya mengunci perilaku berbeda.

**2. Scan langkah.** Setiap langkah menyebut berkas/ekspresi persis, perintah yang dijalankan, dan
keluaran yang menandakan lulus/gagal. Tidak ada langkah "tangani kasus tepi" atau "tulis test yang
sesuai". Satu hal **tidak** saya tuliskan badannya: isi lengkap test `test/p2-sisa.test.js` (empat test)
dan `test/dpr.test.js` (tiga test) — saya tuliskan nama, fixture, dan asersinya; tiga test aksesibilitas
ditulis penuh. Alasan: badan penuhnya bergantung pada bentuk stub yang sudah ada dan akan jadi transkrip
program, bukan rencana.

**3. Konsistensi tipe/nama.** `alasan.kode` memakai **tiga kode yang sama** di spec §2.2, Task 5, dan
lampiran §A.6 (`'bukan-objek'`, `'versi-tak-dikenal'`, `'struktur-tak-valid'`). `PESAN_PENOLAKAN`
memakai kunci yang sama. Helper DPR bernama `hitungKoordinatPointer` (spec §2.2, §3.5, Task 6,
lampiran §A.7) dan `pasangUkuranCanvas` (spec §2.2, Task 6, lampiran §A.7). `#liveStatus` konsisten
di spec §2.3, §3.2, Task 3, dan test.

**4. Review Focus.** Kelima baris §4 spec sudah ditambatkan: #1 dan #2 → Task 2 (Step 1, Step 5);
#3 → Task 5 (Step 6, Step 9); #4 → Task 6 (Step 1 test ketiga); #5 → Task 3 (Step 6 test kedua).
Kelimanya punya test, bukan hanya catatan.

**5. Proporsi.** Panjang plan ± 2× spec; tidak ada blok kode yang menyalin badan program **kecuali** dua
blok yang memang ditetapkan spec sebagai salinan persis (tiga string toast P0, tiga kalimat pesan
penolakan) dan potongan test yang sudah ada (`test/proposal-p0-p6.test.js` satu baris override). Sisanya
adalah signature, nama berkas, dan asersi.

**Catatan koreksi yang saya temukan saat self-review dan perbaiki inline:** (a) Task 2 Step 6 —
`test/bukti-eksekusi.test.js` mengeksekusi `executeAIMove` tanpa `Rules`; tanpa `sb.Rules` fallback P0
akan melempar `Rules is not defined`, jadi langkah itu wajib. (b) Task 3 Step 6 — saya tambahkan test
"tanpa `#liveStatus`" karena saya sendiri menetapkan `if (liveStatus)` di produksi; tanpa test, guard itu
tidak terjaga. (c) Saya hapus rencana "overline fokus pemain" dari p3 karena itu menyentuh
`drawBoard`/`drawBoxes` dan memerlukan keputusan desain sendiri (spec §7 butir 4).

---

## Execution Handoff

Plan lengkap tersimpan di `docs/superpowers/plans/2026-10-10-eksekusi-p0-p5-dotbox.md`.

Metode eksekusi sudah ditetapkan oleh Lead di `01-plan.md` §2: **satu paket = satu agen**, dijalankan
**berurutan** untuk `script.js`, dengan QA memverifikasi sebagai gerbang sebelum DevOps. Karena itu plan
ini memakai **subagent-driven** (REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`), bukan
native: tiap task punya penyerahan vertikal sendiri (test + bukti + commit), dan kesalahan pada satu task
(resiko terbesar: test penjaga bug yang tidak dibalik) akan menular ke suite berikutnya kalau tidak
diperiksa oleh review segar.
