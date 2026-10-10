# Desain & Spesifikasi (Revisi 3) — Eksekusi Proposal `dotbox` + Push ke `master`

**Tanggal:** 2026-10-10
**Penulis:** Architect (Rancang Sistem)
**Workspace:** `/home/serverbot/aidev/workspace/worktrees/dotbox/20261010-230647`
**Branch:** `babd/20261010-230647`
**Status:** spesifikasi siap eksekusi. **Belum ada satu pun baris produksi yang saya ubah di langkah ini.**
**Menggantikan:** `2026-10-10-eksekusi-final-3-gelombang-design.md` (revisi 2) — isi teknis per item tetap
sah; yang saya koreksi di revisi 3 adalah **nomor baris yang sudah bergeser**, **status test yang berubah**,
dan **satu kesalahan revisi 2 yang bisa menyesatkan developer**.

> **Aturan kejujuran bukti (ADR-0002).** **[TERVERIFIKASI]** = saya membaca baris itu sendiri di worktree
> ini pada sesi ini. **[KEPUTUSAN]** = saya tetapkan dengan alasan. **[BELUM-DIVERIFIKASI]** = belum saya
> buktikan; **tidak ada** klaim "test hijau" di dokumen ini, karena saya tidak menjalankan `node --test`
> di langkah ini (lihat §0.3).

---

## 0. Koreksi wajib sebelum developer mulai (baca ini dulu)

### 0.1 Faktanya tidak sesuai dengan draf revisi 2 di tiga tempat

| # | Draf revisi 2 bilang | Saya baca ulang di sesi ini (TERVERIFIKASI) | Dampak |
|---|---|---|---|
| **C1** | `script.js:152–157` adalah init Box ber-`edges` | **BENAR**, tapi nomornya **tidak bergeser**: `script.js:152–157` masih `owner: null, edges: { top, bottom, left, right }` | P6 aman dikerjakan seperti direncanakan |
| **C2** | P0-b/P0-c di `test/proposal-p0-p6.test.js` **menyadap objek yang salah** dan **akan gagal hari ini pun** | **SEBAGIAN SALAH.** `P0-a` (`:143`) dan `P0-c` (`:244`) **sudah** memakai `aiEngine.getBestMove` — sudah diperbaiki. Hanya `P0-b` (`:192`) yang masih menulis `getBestMove = function(){...}` global. **Dan itu TIDAK mematikan test**, karena P0-b menyadap **`makeMove`** (`:199`), bukan menyadap `getBestMove` untuk mengukur hasil | **Paket `p0t` menciut drastis**: tinggal **satu baris kosmetik** di `:192`, dan itu **bukan blocker**. Developer **boleh mulai P0 tanpa menunggu p0t** |
| **C3** | "Suite kini 56/56" sebagai keadaan awal | Angka itu **[SITASI] dari berkas bukti lama**, bukan hasil saya. Yang **TERVERIFIKASI** hari ini: `if (!move) return;` masih ada di `script.js:756`, `index.html:5` masih `user-scalable=no`, `aria-label` di `index.html` = **0**, `devicePixelRatio`/`setTransform` di `script.js` = **0 hasil** | Baseline test **wajib dijalankan ulang** oleh QA/developer sebelum klaim apa pun (§9) |

> **Kenapa C2 penting dan harus dikatakan terus terang.** Revisi 2 menahan seluruh gelombang P0 di
> belakang paket `p0t` (QA memperbaiki test) dengan alasan "kalau tidak, developer mengejar lampu merah
> palsu". Setelah saya baca sendiri ketiga test itu baris per baris, **alasan itu tidak lagi berlaku**:
> P0-a dan P0-c sudah benar, dan P0-b mengukur lewat `makeMove`. Menahan P0 di belakang `p0t` sekarang
> hanya **menambah satu siklus review tanpa manfaat**. Ini keputusan saya (D9 di §1), dan saya sebut
> sebagai **deviasi dari revisi 2** dengan alasannya.

### 0.2 Yang TIDAK berubah dari revisi 2

Semua keputusan Lead yang mengikat tetap berlaku:

- **K11′** — P4 masuk scope sebagai gelombang terakhir (G3); **P7 ditunda penuh**.
- **K13** — G1 = P0 + P3 + P6 + P2-sisa, satu gelombang, **satu penulis `script.js` pada satu waktu**.
- **K14** — tiga jaminan P4: overlay hanya `?dev=1`; tidak ada kehilangan save (tulis di akhir giliran
  **dan** `beforeunload`); audio dirapikan tanpa mengubah nada.
- **K15** — aturan drop: bila G1/G2 merah dan tak bisa dibereskan dalam anggaran, **G3 (P4) yang di-drop**,
  dan itu dilaporkan ke CEO. P7 bukan kandidat drop karena sudah di luar scope.
- **K16** — dua utang teknis dicatat, tidak dikerjakan: overline fokus di `drawBoard`, dan
  `turnQueue.runNow()`.
- **Ruling 1–5 proposal** — Box kanonik `{ owner }`; P5 satu PR; P2-sisa setelah P6; Bahasa Indonesia;
  P1/P2 sudah terpasang.

### 0.3 Batas bukti di dokumen ini

Saya **tidak punya akses shell** di langkah ini, jadi saya **tidak menjalankan** `node --test`.
Karena itu:

- Setiap nomor baris di §2 saya tandai **TERVERIFIKASI** karena itu hasil **pembacaan saya sendiri**
  (bukan kutipan).
- Setiap pernyataan tentang test (merah/hijau) saya tulis sebagai **yang harus dibuktikan**, dan
  perintahnya ada di §9 — **bukan** sebagai klaim saya.
- **Aksi pertama developer dan QA**: jalankan baseline (§9.1) dan lampirkan keluaran mentahnya sebelum
  menyentuh kode. Kalau baseline ≠ harapan, **berhenti dan lapor** — jangan menebak.

---

## 1. Keputusan saya di revisi 3 (delta, mengikat)

| # | Keputusan | Alasan |
|---|---|---|
| **D9** | **`p0` tidak menunggu `p0t`.** Urutan G1 menjadi `p0 → p3 → p6p2s`, dengan `p0t` sebagai **perbaikan kosmetik paralel** yang tidak memblokir apa pun | Bukti C2: P0-a/P0-c sudah benar; P0-b mengukur lewat `makeMove`, bukan lewat `getBestMove` global. Menahan P0 tidak lagi membeli keamanan |
| **D10** | **`p0t` diturunkan menjadi opsional** dan **hanya** menyentuh `test/proposal-p0-p6.test.js:192` (ganti ke `aiEngine.getBestMove`) + komentar `:139–142` diselaraskan | Konsistensi pola saja; fungsional tidak berubah. Bila anggaran ketat, ini boleh dilewati tanpa memalsukan bukti |
| **D11** | **Test P0 wajib menambah asersi "pemain diberi tahu".** Asersi "minimal satu konsekuensi" (P0-a) saja **tidak cukup** — ia bisa hijau padahal pemain masih melihat papan diam tanpa pesan (mis. hanya `switchTurn`) | Proposal P0 sendiri menuntut "beri tahu pemain via `showToast`". P0-a sudah punya asersi toast, tapi **hanya bercabang saat `makeMove === 0`**; saya minta satu asersi eksplisit di jalur fallback (§4.1) |
| **D12** | **Blok fallback P0 dipasang sebagai satu blok di `executeAIMove`, bukan menggabung kondisi lama.** `if (!move) return;` **dihapus total** | `return` telanjang **itulah** bug P0. Menggabungnya dengan `&&` akan menyembunyikan bug-nya dari `grep` penjaga. Gerbang: `grep -n "if (!move) return" script.js` = **0 hasil** |
| **D13** | **P5 tetap satu PR (Ruling 2) dan ruang gambar tetap CSS px** | Ini yang membuat invarian "garis terpilih identik di DPR 1 dan DPR 2" masuk akal; memecahnya = risiko hit-test rusak separuh jalan |
| **D14** | **Push tetap tanpa `--force`, dan `git remote -v` wajib diperiksa lebih dulu** | Revisi 2 sudah mencatat ini; saya pertahankan. **Belum saya verifikasi** apakah worktree ini punya remote (§7) |

---

## 2. Keadaan sekarang — dibaca sendiri di sesi ini (TERVERIFIKASI)

| Item | Status | Bukti baris (dibaca sesi ini) |
|---|---|---|
| **P1** penjadwal giliran tunggal | ✅ **TERPASANG** | `script.js:45–53`, `:191`, `:604`, `:641`, `:933`, `:734`; `turnQueue.clear()` di `:885`, `:1064`; `index.html:118` sebelum `:120` |
| **P2** versi skema save | ✅ **TERPASANG** | `script.js:768` `SCHEMA_VERSION = 1`, `:769–772` `versiDikenal`, `:776` `version:`, `:808` tolak versi tak dikenal |
| **P0** fallback AI | ❌ **BELUM** | `script.js:756` `if (!move) return;` — dibaca persis |
| **P3** aksesibilitas | ❌ **BELUM** | `index.html:5` `maximum-scale=1.0, user-scalable=no`; `:15` hanya `title`; `:94–97`; `:108`; **`aria-label` di `index.html` = 0** |
| **P6** hapus `Box.edges` | ❌ **BELUM** | `script.js:152–157` → `{ owner: null, edges: { top, bottom, left, right } }` |
| **P2-sisa** migrasi + pesan galat | ❌ **BELUM** | `script.js:804` `function buatKandidatState(saveData) {` (tanpa parameter `alasan`); `:805`, `:808`, `:811` semua `return null` telanjang |
| **P5** ketajaman HiDPI | ❌ **BELUM** | `script.js:206–207`, `:224–225` tulis CSS px ke bitmap; `devicePixelRatio`/`setTransform` = **0 hasil** di `script.js` |
| **P4** telemetri + hemat I/O | ❌ **BELUM** | `script.js:585` `saveGame()` di dalam `makeMove` |
| **P7** E2E/PWA | ❌ **BELUM** | tidak ada manifest/service worker |
| Formulir `alasan` di `saveGame` | ✅ terpasang | `script.js:774–789` sudah menulis `version: SCHEMA_VERSION` ([TERVERIFIKASI]) |

**Temuan tambahan saya (bukan dari draf mana pun):**

1. **`buatKandidatState` punya TIGA `return null` telanjang yang dekat:** `:805` (bukan objek),
   `:808` (versi), `:811` (kunci wajib). Ketiganya adalah **kelas penolakan berbeda** yang hari ini
   kolaps jadi satu `null`. Inilah inti P2-sisa, dan sekarang saya punya nomor baris pastinya.
2. **`saveGame()` di `script.js:585` berada di dalam `makeMove`, sebelum `switchTurn()` (`:609`)** —
   artinya urutannya: langkah diterapkan → `drawBoard` → `updateScores` → `playSound` → **tulis save** →
   `isGameOver` → `switchTurn`. Memindahkan tulis ke akhir giliran (P4a) berarti memindahkannya
   **setelah `:609`**, bukan sekadar memindahkan posisinya sedikit.
3. **Test P0-b (`test/proposal-p0-p6.test.js:192`) menyadap `getBestMove` global**, tetapi **mengukur
   lewat `makeMove`** (`:199`). Jadi test itu **tidak "menyadap objek yang salah"** dalam arti yang
   merusak pengukuran — klaim revisi 2 (§2 temuan #3, dua kali diulang) **terlalu keras**. Ini saya
   koreksi, karena developer yang mempercayainya akan "memperbaiki" sesuatu yang tidak rusak.
4. **Asersi P0-a bercabang** (`:170` `if (catat.makeMove === 0) { assert toast > 0 }`). Artinya bila
   implementasi fallback memilih `switchTurn()` sebagai satu-satunya konsekuensi, P0-a bisa **hijau
   tanpa toast** — padahal proposal menuntut pemain diberi tahu. Ini yang D11 perbaiki.

---

## 3. Struktur & aliran setelah semua paket (desain)

### 3.1 Peta modul (tidak berubah — tidak ada modul baru selain `dev-status.js` opsional)

```
index.html  (urutan <script> adalah kontrak, tanpa build step)
  rules.js ──> turn-queue.js ──> ai-engine.js ──> script.js ──> dev-status.js (opsional, G3)
     │              │                 │                │
     │              │                 │                └─ adapter: DOM, canvas, localStorage, Audio, UI
     │              │                 └─ decision policy (minimax + alpha-beta)
     │              └─ penjadwal giliran AI satu-slot
     └─ aturan papan MURNI (satu-satunya penulis papan lewat applyMove)   [ADR-0001]
```

Aturan yang **tidak berubah** oleh paket mana pun:
> `makeMove` (`script.js:536`) adalah **satu-satunya penulis papan** di jalur produksi. Ia memanggil
> `checkBoxCompletion` (`:575`) → `Rules.applyMove`. `executeAIMove` **tidak boleh** menyentuh papan
> sendiri, termasuk di jalur fallback P0.

### 3.2 Alur giliran AI setelah P0 (target perilaku)

```
guard lama (isGameOver / isReplayMode / !aiEngine / bukan pemain AI)  -> return   (TIDAK berubah)
        │
        ▼
move ← aiEngine.getBestMove(aiState, currentPlayerIndex)
        │
        ├─ move ada  &&  makeMove(...) === true      -> selesai, TANPA toast (perilaku lama)
        │
        └─ selain itu (move null ATAU makeMove false)
               │
               ├─ kandidat ← Rules.availableMoves(gameState)        (MURNI, tidak mengubah papan)
               │
               ├─ kandidat.length > 0:
               │      pilih kandidat[0]                             (deterministik, BUKAN acak)
               │      showToast('AI: langkah cadangan dipakai karena pencarian gagal.')   (tepat 1×)
               │      bila makeMove(pilihan) === false:
               │          switchTurn()
               │          showToast('AI tidak dapat bergerak; giliran dialihkan.')          (tepat 1×)
               │
               └─ kandidat.length === 0 (papan benar-benar penuh):
                      showToast('Tidak ada langkah tersisa. Permainan selesai.')
                      endGame()
```

Tiga kontrak mengikat (§3 revisi 1 dipertahankan, + D11):

1. **Deterministik** — `kandidat[0]`, bukan `Math.random()`. Alasan saya: RNG ber-seed **tidak ada** di
   `script.js`; menambahkannya berarti menambah state global yang bisa bocor antar-test. Deterministik =
   satu baris, teruji byte-for-byte, tanpa state baru. **Deviasi dari proposal** (§4 P0 menulis "acak
   ber-seed") dan alasannya saya sebut di sini — **dengan alasan yang sah untuk mengganti kalimat itu**
   agar tidak dibaca sebagai bug.
2. **Toast jalur sukses = 0** — satu kejadian = paling banyak satu toast.
3. **`makeMove` yang mengembalikan `false` masuk jalur fallback** (persis seperti spec P0 §3).

### 3.3 Bentuk data setelah P6

```
Edge = { owner: null | playerId }
Box  = { owner: null | playerId }      ← `edges` DIHAPUS dari Box (Ruling 1)
```

Save lama ber-`edges` **tetap diterima**; `buatKandidatState` sudah menyalin hanya `owner`, jadi
migrasinya gratis. Yang kita lakukan di P6 hanya **berhenti menulis** field mati itu.

### 3.4 Seam yang dipakai test (tidak ada seam baru kecuali yang sudah disetujui)

| Seam | Dipakai oleh |
|---|---|
| `buatKandidatState(saveData, alasan?)` | `test/save-schema.test.js`, `test/proposal-p0-p6.test.js` — **signature lama tetap bekerja** |
| `gameState` (objek hidup) + stub DOM `vm` | semua test integrasi |
| `hitungKoordinatPointer(rect, clientX, clientY, canvas, dpr)` **(baru, murni)** | `test/dpr.test.js` |
| `#liveStatus` (`role="status"`) | `test/aksesibilitas.test.js` |
| gate `?dev=1` | `test/dev-status.test.js` |

---

## 4. Spesifikasi per paket (kontrak untuk developer)

### 4.1 `p0` — Fallback giliran AI (KRITIS) · dev · `script.js:737–763` + 2 test

**Kode produksi:** satu blok di `executeAIMove`. Ganti **baris `756`** (`if (!move) return;`) dengan:

```js
    if (move && makeMove(move.type, move.row, move.col)) {
        // Jalur normal: pencarian berhasil dan papan menerimanya. TANPA toast.
        return;
    }

    // P0 — giliran TIDAK boleh menggantung. Satu-satunya sumber langkah legal
    // adalah `Rules.availableMoves` (ADR-0001). Fallback ini TIDAK menulis papan
    // sendiri, TIDAK memanggil Rules.applyMove, dan TIDAK membuat timer baru.
    const kandidat = Rules.availableMoves(gameState);

    if (kandidat.length === 0) {
        showToast('Tidak ada langkah tersisa. Permainan selesai.');
        endGame();
        return;
    }

    const pilihan = kandidat[0]; // deterministik, BUKAN acak (lihat §3.2 catatan 1)
    showToast('AI: langkah cadangan dipakai karena pencarian gagal.');

    if (!makeMove(pilihan.type, pilihan.row, pilihan.col)) {
        // Kandidat dari Rules seharusnya selalu diterima makeMove. Bila tidak,
        // minimal giliran berpindah supaya pemain tidak terjebak selamanya.
        switchTurn();
        showToast('AI tidak dapat bergerak; giliran dialihkan.');
    }
```

**Dilarang:** `setTimeout` baru, `Math.random()`, memanggil `Rules.applyMove` langsung, mengubah
`makeMove`, mengubah `ai-engine.js`, mengubah guard lama (`:739`, `:742`) atau perakitan `aiState`
(`:744–752`).

**Test (dipakai bersama P0):**

- `test/proposal-p0-p6.test.js` → **P0-a, P0-b, P0-c** harus hijau (**RED hari ini**).
- **D11 — tambahkan satu test baru** di berkas yang sama, namanya
  `P0-d: jalur fallback selalu memberi tahu pemain (toast tepat 1×, tidak diam)`:
  paksa `aiEngine.getBestMove` → `null` pada papan yang masih punya garis kosong, panggil `executeAIMove()`,
  lalu assert `jejak.showToast === 1` **dan** `jejak.makeMove === 1`. Ini menutup celah asersi bercabang
  di P0-a (`:170`) yang bisa hijau tanpa toast.
- `test/bukti-eksekusi.test.js:175–182` masih **menuntut bug** (`getBestMove()==null` → `makeMove` 0×,
  tanpa toast). **Wajib dibalik** jadi dua test penuntut perilaku benar; **wajib** menambahkan
  `sb.Rules = require('../rules.js')` bila sandbox itu belum memuat `rules.js`, karena jalur fallback
  memanggil `Rules.availableMoves`.

**Gerbang penerimaan:**

```bash
node --test test/proposal-p0-p6.test.js     # P0-a/b/c/d hijau
node --test test/bukti-eksekusi.test.js     # dua test fallback hijau
grep -n "if (!move) return" script.js       # WAJIB 0 hasil  (D12)
```

### 4.2 `p3` — Aksesibilitas · dev · `index.html`, `style.css`, `script.js` (`updateUI`), test baru

Kontrak lengkap ada di `docs/superpowers/specs/2026-10-10-p3-aksesibilitas-design.md` §2. Penajaman
mengikat:

1. **Viewport:** `index.html:5` → `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
   (buang `maximum-scale=1.0` **dan** `user-scalable=no`; WCAG 2.2 SC 1.4.4/1.4.10).
2. **Enam `aria-label`** persis pada `#darkModeToggle`, `#replayPlayPause`, `#replayPrev`, `#replayNext`,
   `#replayClose`, `#playAgainBtn` (string dari spec P3 §2.2, Bahasa Indonesia). **JANGAN** menimpa
   `aria-label` pada `.btn-control` (`:81–84`) yang berteks visibel — itu melanggar WCAG 2.2 SC 2.5.3.
3. **`:focus-visible`** (bukan `:focus`): `outline: 3px solid var(--accent-primary); outline-offset: 2px;`
   untuk `button, input, [tabindex]`.
4. **`#liveStatus`** `role="status"` `aria-live="polite"` dengan **teks** (tanpa emoji), kelas
   `visually-hidden` (kelas baru di `style.css`, pola clip standar). Diisi **tiga baris di akhir
   `updateUI`** (`script.js:708–727`), nullable-safe (`if (liveStatus)`).
5. **`prefers-reduced-motion: reduce`** mematikan animasi `.toast`, `.box-highlight`, `.modal`,
   `.modal-content`, `.turn-indicator`.
6. **Dilarang** menyentuh `drawBoard`/`drawBoxes` (K16a) dan **dilarang** `scrollIntoView`/`focus()` di
   `updateUI`.

**Test baru (RED dulu):** `test/aksesibilitas.test.js` — statis (baca teks `index.html` + `style.css`):
tidak ada `user-scalable=no`/`maximum-scale`, tiap kontrol beremoji punya `aria-label` tak kosong,
`:focus-visible` ada, `prefers-reduced-motion` ada; **plus** satu test `vm` yang memanggil `updateUI()`
dan memeriksa `#liveStatus.textContent` berisi nama giliran tanpa emoji.

**Gerbang:** test hijau; `grep -c "aria-label" index.html` ≥ 6.

**Batas jujur wajib di laporan:** pembaca layar nyata (NVDA/VoiceOver) **tidak** diuji; yang terbukti hanya
atribut/teks ada dan berbentuk benar.

### 4.3 `p6p2s` — Box kanonik + migrasi save + pesan galat terpisah · dev · `script.js` + 3 test

**p6 (produksi):** `script.js:152–157` → `({ owner: null })`. Cari juga penulisan ulang Box lain
(draf menyebut `:1075–1080`; **developer wajib `grep` mengkonfirmasi nomor barisnya sendiri** karena
sudah bergeser). **Jangan** menyentuh jalur load (`buatKandidatState` sudah kanonik) dan jangan
menyentuh `aiState` (`:750` menyalin dari papan yang sudah kanonik).

**Test lama yang wajib disesuaikan:** test di `test/bukti-eksekusi.test.js` yang **menuntut** `edges,owner`
di init Box sekarang mengunci bug → ubah namanya menjadi
`inisialisasi script.js tidak lagi menulis Box.edges (dead write dibuang)` dan assert
`deepStrictEqual(Object.keys(kotak), ['owner'])`; **pertahankan** bagian "tidak boleh ada pembaca
`Box.edges`".

**p2s (produksi) — kontrak `buatKandidatState`:**

```js
// Signature lama TETAP berlaku: buatKandidatState(saveData) -> State|null
function buatKandidatState(saveData, alasan) {
    if (!saveData || typeof saveData !== 'object' || Array.isArray(saveData)) {
        if (alasan) alasan.kode = 'bukan-objek';
        return null;
    }
    if (!versiDikenal(saveData.version)) {
        if (alasan) alasan.kode = 'versi-tak-dikenal';
        return null;
    }
    // SETIAP `return null` berikutnya juga menulis 'struktur-tak-valid'
}
```

**Setiap** `return null` di fungsi itu **wajib** mengisi `alasan.kode` (mulai dari `:805`, `:808`, `:811`,
lalu sisanya). Helper `tolak(kode)` juga boleh, **asalkan** kontrak "return `null` bila ditolak" dan
kemurnian fungsi tidak berubah. `SAVE_KEYS` **tidak** boleh ditambahi `version`.

**Pemetaan pesan galat (mengikat)** di `loadGame`:

| `alasan.kode` | Kalimat `console.error` |
|---|---|
| `'bukan-objek'` | `Save ditolak: data simpanan bukan objek.` |
| `'versi-tak-dikenal'` | `Save ditolak: versi skema tidak dikenal.` |
| `'struktur-tak-valid'` | `Save ditolak: struktur data tidak valid.` |

**Test baru (RED dulu):** `test/p2-sisa.test.js` — (a) ketiga kelas galat bisa dibedakan lewat spionase
`console.error`; (b) save warisan `{ owner, edges:{...} }` **tanpa** `version` diterima dan
`gameState.boxes` ternormalisasi ke `{ owner }`.

**Gerbang:** `test/proposal-p0-p6.test.js` P6-a, P6-b, P2-a..d hijau; `test/p2-sisa.test.js` hijau;
`test/bukti-eksekusi.test.js` sudah menuntut bentuk kanonik.

### 4.4 `p5` — Ketajaman HiDPI (satu PR) · dev · `script.js` + `test/dpr.test.js`

Kontrak lengkap di `docs/superpowers/specs/2026-10-10-p5-hidpi-design.md` §3. Penajaman mengikat:

1. **`setupCanvas` (`:200–219`)** dan **`handleResize` (`:221–228`)**:
   `const dpr = window.devicePixelRatio || 1;` → `canvas.width = size * dpr; canvas.height = size * dpr;
   canvas.style.width = size + 'px'; canvas.style.height = size + 'px';` lalu
   `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` **sebelum** `calculatePositions()`.
2. **Satu helper murni**, dipakai **kedua** handler input:
   ```js
   function hitungKoordinatPointer(rect, clientX, clientY, canvas, dpr) {
       const skalaX = (canvas.width > 0 && rect.width > 0) ? (canvas.width / rect.width) / dpr : 1;
       const skalaY = (canvas.height > 0 && rect.height > 0) ? (canvas.height / rect.height) / dpr : 1;
       return { x: (clientX - rect.left) * skalaX, y: (clientY - rect.top) * skalaY };
   }
   ```
   `handleCanvasClick` (`:446–448`) dan `handleTouchStart` (`:460–463`) **wajib** memakai helper ini.
   **Tidak boleh** ada dua formula berbeda. (**Nomor baris handler ini dari draf lama — developer
   `grep` sendiri.**)
3. **`hitRadius` (`:470`) TIDAK diubah.**
4. **Satuan ruang gambar tetap CSS px** (karena `setTransform`) — jadi `dotPositions` tetap CSS px dan
   `handleLineSelection` (`:507–509`) tidak berubah.
5. **Dilarang** memecah P5 jadi dua PR (Ruling 2).

**Test baru (RED dulu):** `test/dpr.test.js` dengan `window.devicePixelRatio = 2`:
(a) `canvas.width === ukuranCSS * 2` dan `canvas.style.width === ukuranCSS + 'px'`;
(b) stub konteks merekam `setTransform(2,0,0,2,0,0)`;
(c) koordinat CSS px yang sama memilih **garis yang sama** seperti DPR 1.

**Batas jujur wajib di laporan:** ketajaman di layar Retina nyata **tidak** diuji.

### 4.5 `p4a` + `p4b` — Telemetri + hemat I/O (G3) · dev · `script.js`, `dev-status.js` (baru), `index.html`

Kontrak di `2026-10-10-eksekusi-final-3-gelombang-design.md` §3.6 dan **ADR-0004** (sudah ditulis di repo).

- **p4a:** pindahkan `saveGame()` dari `script.js:585` ke **akhir giliran** (akhir `updateUI()` setelah
  giliran/skor berubah), tambahkan `beforeunload`, dan **tetap** panggil sekali di
  `initGame`/`resetBoardOnly`/`loadGame`. Audio: pakai ulang `AudioContext` yang ada, hentikan & putuskan
  node setelah selesai.
- **p4b:** `dev-status.js` aktif **hanya** via `?dev=1`; tanpa flag keluar lebih awal (**nol elemen, nol
  timer**). Dimuat **setelah** `script.js`. Isi: FPS, `devicePixelRatio`, `canvas.width×height`,
  `canvas.style.width`, giliran, jumlah pemain, `SCHEMA_VERSION`, error terakhir.
- **Kontrak K14b (mengikat):** test wajib membuktikan (1) satu giliran penuh → `localStorage.setItem`
  **≤ 1×**, (2) isi yang tertulis **sama** dengan `gameState` terakhir, (3) `beforeunload` menulis sekali lagi.
- **Gerbang:** `test/p4-save-io.test.js` + `test/dev-status.test.js` hijau; **mode normal bersih**.

---

## 5. Ledger paket & urutan (mengikat untuk Lead/QA)

| ID | Paket | Agen | `depends_on` | Gerbang penerimaan |
|---|---|---|---|---|
| **p0** | Fallback AI + balik 2 test penjaga bug + test P0-d | developer | baseline §9.1 | P0-a/b/c/d hijau; `grep "if (!move) return"` = 0 |
| **p0t** | *(opsional)* `:192` → `aiEngine.getBestMove`, selaraskan komentar | qa | — | pola konsisten; **tidak memblokir apa pun** (D9/D10) |
| **p3** | Aksesibilitas | developer | p0 | 4+ test aksesibilitas hijau; `aria-label` ≥ 6 |
| **p6p2s** | Box kanonik + migrasi + pesan galat | developer | p3 | P6-a/b, P2-a..d, `p2-sisa` hijau |
| **p5** | HiDPI satu PR | developer | p6p2s | 3 test DPR hijau; `handleLineSelection` tak berubah |
| **p4a** | Hemat save + audio | developer | p5 | test `setItem` + isi + `beforeunload` hijau |
| **p4b** | Overlay `?dev=1` | developer | p5 | mode normal bersih + panel muncul |
| **QA** | Verifikasi independen penuh | qa | p0..p4b | `node --test` **exit=0** + probe grep + triase ber-bukti |
| **DEVOPS** | Push ke `master` | devops | QA | `git push origin HEAD:master` sukses **atau** alasan penolakan; **tanpa `--force`** |

**Urutan mutlak di dalam G1:** `p0 → p3 → p6p2s`. Alasannya berkas, bukan gaya: ketiganya menyunting
`script.js`. Satu penulis pada satu waktu.

**Gerbang kualitas ("selesai" hanya bila semua benar):**

1. Test perilaku dilihat **MERAH dulu**, lalu **HIJAU** — keluaran mentah dilampirkan ke `docs/bukti/`.
2. `node --test` penuh di worktree **exit=0**, dijalankan QA (bukan diklaim).
3. Tidak ada klaim "terverifikasi" tanpa `berkas:baris` (ADR-0002).
4. Tidak ada rahasia (token/key/password) di dokumen atau laporan.
5. Setiap laporan menyebut **apa yang tidak diuji**.

---

## 6. Matriks risiko (delta revisi 3)

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Nomor baris sudah bergeser dari draf | Developer menyunting baris yang salah | Setiap task menutup dengan `grep -n` untuk baris yang dirujuk task berikutnya (Global Constraints plan) |
| `p0t` dianggap blocker padahal tidak | Satu siklus review terbuang | **D9/D10**: p0t diturunkan jadi opsional; bukti C2 |
| Test P0-a hijau tanpa toast | Pemain tetap melihat papan diam | **D11**: test P0-d menuntut `showToast === 1` |
| Test penjaga bug (`bukti-eksekusi.test.js`) tak disesuaikan | Suite merah walau kode benar | Disatukan ke paket pemiliknya (p0, p6p2s) |
| P5 setengah jalan (bitmap ×DPR tanpa konversi input) | Hit-test **langsung rusak** | Satu paket + test (c) (Ruling 2) |
| P4 menunda tulis save | Kehilangan data bila tab ditutup | **K14b**: akhir giliran + `beforeunload`; test wajib |
| `push` non-fast-forward | Menimpa riwayat orang lain | Tanpa `--force`; **berhenti dan lapor** |
| Aksesibilitas/HiDPI diklaim "selesai" | Klaim berlebih (langgar ADR-0002) | Laporan **wajib** menyebut yang tidak diuji |
| `git remote` tidak ada / tidak menunjuk GitHub | Push mustahil | DevOps periksa `git remote -v` **lebih dulu** (§7); lapor, jangan menebak |

---

## 7. Push ke GitHub `master` (untuk DevOps) — perintah & aturan

```bash
git status --short                 # harus bersih (BABD yang commit/merge)
git log --oneline -n 20            # bukti apa yang akan dikirim
git remote -v                      # WAJIB: apakah ada remote GitHub?
git branch -a
# Bila remote ada dan menunjuk repo yang benar:
git push origin HEAD:master        # TANPA --force
```

**Aturan mengikat:** dilarang `--force`/`--force-with-lease` tanpa persetujuan CEO/Lead. Bila push ditolak
**non-fast-forward**: **berhenti**, lampirkan keluaran mentah, lapor — jangan merge paksa, jangan rebase,
jangan hapus branch siapa pun. Jangan menyentuh instalasi BABD di `/home/serverbot/aidev`. Jangan tempel
URL remote yang memuat token di laporan.

**Belum saya verifikasi:** apakah worktree ini punya remote. Bila `git remote -v` kosong, syarat push
**tidak terpenuhi** dan itu dilaporkan, bukan dikira-kira.

---

## 8. Yang saya tahan / masih terbuka

1. **P7 (PWA + E2E Playwright)** — ditunda penuh (K11′). Bila kelak diambil, opsi termurah adalah PWA
   minimal **tanpa** Playwright (`manifest.webmanifest` + service worker cache-first, tanpa build step,
   satu berkas baru + satu `<link>`); Playwright butuh persetujuan karena menambah dependensi uji.
2. **Aksesibilitas papan penuh (grid tombol/keyboard, effort L)** — di luar gelombang. P3 = perbaikan
   terarah; memilih garis di papan lewat keyboard/pembaca layar tetap mustahil (keputusan produk).
3. **`aria-label` pada selektor angka `+`/`-`** — tidak masuk (spec P3 membatasi ke enam kontrol beremoji).
   Bila QA ingin cakupan lebih luas, ini satu-berkas di `index.html` tanpa risiko.
4. **`turnQueue.runNow()`** — utang penamaan; tidak dihapus (di luar cakupan).
5. **Override fokus pemain di `drawBoard`** — utang UI; butuh keputusan desain sendiri.

---

## 9. Lampiran — perintah verifikasi (untuk developer & QA)

### 9.1 Baseline (WAJIB dijalankan lebih dulu, sebelum menyentuh kode)

```bash
node --test                     # catat angka & exit code apa adanya
grep -n "if (!move) return" script.js          # harapan awal: 1 hasil (baris 756) = P0 belum
grep -c "aria-label" index.html                # harapan awal: 0 = P3 belum
grep -n "devicePixelRatio\|setTransform" script.js   # harapan awal: 0 hasil = P5 belum
grep -n "function buatKandidatState" script.js       # harapan: tanpa parameter `alasan`
```

Lampirkan keluaran mentah ke `docs/bukti/` (mis. `baseline-r3.txt`). **Bila baseline ≠ harapan di atas,
berhenti dan lapor** — jangan menebak.

### 9.1b Verifikasi klaim baris desain ini (`scripts/bukti-klaim-desain.js`)

Saya menyertakan satu skrip tanpa dependensi yang **memeriksa setiap klaim `berkas:baris`** di §2 dokumen
ini terhadap kode nyata, lalu menjalankan `node --test`:

```bash
node scripts/bukti-klaim-desain.js    # exit 0 = semua klaim cocok DAN suite exit=0
```

Gunanya: nomor baris di desain ini akan bergeser begitu developer mulai menyunting `script.js`. Skrip ini
adalah alarm untuk pembaca berikutnya, bukan gerbang QA.

> **Batas jujur.** Saya **tidak dapat menjalankan** skrip ini di langkah desain (tanpa akses shell). Yang
> saya lakukan sebagai gantinya: **membaca satu per satu baris yang di-assert** (`script.js:756` =
> `if (!move) return;`, `:585` = `saveGame();`, `test/proposal-p0-p6.test.js:199` memuat `makeMove`) untuk
> memastikan skripnya sendiri benar. **Angka hasil suite tetap belum saya ketahui** sampai dev/QA
> menjalankannya.

> **Bersihkan satu berkas sisa.** Langkah desain ini secara tidak sengaja meninggalkan
> `scripts/run-tests-verify.js` (stub kosong, tanpa kode produksi) dan **tidak bisa menghapusnya sendiri**.
> **Developer/DevOps wajib menghapusnya** sebelum commit: `rm scripts/run-tests-verify.js`.

### 9.2 Gerbang setelah tiap paket

```bash
node --test test/proposal-p0-p6.test.js         # p0, p6p2s
node --test test/bukti-eksekusi.test.js         # p0, p6p2s
node --test test/aksesibilitas.test.js          # p3 (baru)
node --test test/p2-sisa.test.js                # p6p2s (baru)
node --test test/dpr.test.js                    # p5 (baru)
node --test test/dev-status.test.js             # p4b (baru)
node --test test/p4-save-io.test.js             # p4a (baru)
node --test                                     # gerbang tunggal akhir (QA)
```

### 9.3 Probe statis akhir

```bash
grep -n "if (!move) return" script.js            # 0 hasil
grep -c "aria-label" index.html                  # >= 6
grep -n "focus-visible\|prefers-reduced-motion" style.css   # keduanya ADA
grep -n "devicePixelRatio\|setTransform" script.js          # >= 3 hasil
grep -n "hitungKoordinatPointer" script.js                  # 1 definisi + 2 pemakaian
grep -n "createOscillator" script.js             # <= 1 lokasi
grep -n "dev-status.js" index.html               # ADA, setelah script.js
git status --short                               # bersih sebelum push
```

**Ekspektasi jujur:** perintah di §9 **belum saya jalankan** di langkah ini.

---

Tidak ada rahasia, token, atau kata sandi di dokumen ini.
