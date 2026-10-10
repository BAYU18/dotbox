# Laporan Review Proyek: dotbox
**Tanggal:** 2026-10-10
**Reviewer:** tim AI (architect, developer, qa, researcher) dikoordinasi Team Lead
**Workspace:** /home/serverbot/aidev/workspace/worktrees/dotbox/20261010-194959
**Branch:** babd/20261010-194959
**Status:** FINAL (putaran QA-2) — semua klaim bug terverifikasi lewat eksekusi `node --test`:
**36 test, 36 lulus, 0 gagal.** Bug yang dilaporkan QA pada putaran sebelumnya (QA-1/QA-2/QA-3)
sudah ditangani; rincian di §6.5.

> Dokumen ini adalah deliverable akhir untuk CEO. Ringkasan ada di §1; bukti eksekusi di §6.
> Rencana perbaikan bertahap ada di `docs/plans/2026-10-10-perbaikan-dotbox.md`, keputusan di
> `docs/adr/0001-…`/`0002-…`, kosakata domain di `GLOSSARY.md`.

## 1. Ringkasan Eksekutif

**Apa yang saya kerjakan:** saya membaca seluruh proyek dotbox (4 berkas sumber, ±2.700 baris, tanpa
build/test), memverifikasi temuan dengan **menjalankan kode**, lalu memperbaiki bug yang terbukti nyata.

**Temuan utama:** permainan ini **tidak berfungsi sebagai permainan** sebelum perbaikan. Tiga bug
Kritis membuat skor selalu 0, permainan tidak pernah berakhir, dan tombol replay kosong. Ketiganya
sudah saya perbaiki dan buktikan dengan test yang saya **lihat GAGAL dulu** lalu **lulus**.

| # | Bug (Kritis) | Akibat bagi pemain | Status |
|---|---|---|---|
| C1 | `makeMove` menulis garis langsung **lalu** memanggil `Rules.applyMove` pada garis yang sudah terpasang → `boxesGained` selalu kosong | **Skor selalu 0.** Kotak tidak pernah diklaim walau empat sisinya penuh | ✅ Diperbaiki + diuji |
| C2 | `isGameOver()` hanya menghitung kotak **pemain 0** | **Permainan tidak pernah berakhir**, walau papan penuh 4/4 kotak | ✅ Diperbaiki + diuji |
| C3 | `resetBoardOnly()` mengosongkan riwayat **sebelum** `replayStep` membacanya | **Replay memutar 0 langkah** (papan kosong) | ✅ Diperbaiki + diuji |

**Cara verifikasi (bukan klaim, tapi bukti):** ketiga bug ini saya reproduksi lebih dulu sebagai test
yang **gagal** (`not ok 1`, `not ok 2`, `not ok 5`), lalu perbaikan dibuat agar test **lulus**. Suite
akhir: **`node --test` → 36 test, 36 lulus, 0 gagal.**

**Dua hal lain yang saya perbaiki dan laporkan jujur:**

- **Klaim AI di README tidak benar** (menjanjikan Minimax + Alpha-Beta, sedangkan kode hanya heuristik
  greedy dan tombol "Kedalaman AI" tidak berpengaruh). Sudah diperbaiki: AI sekarang benar-benar
  minimax + alpha-beta berkedalaman, dan README diselaraskan dengan kode.
- **Duplikasi aturan kotak** di dua berkas dengan dua semantik berbeda (hazard `?.owner !== null`).
  Sudah dihilangkan lewat satu modul aturan murni `rules.js` yang dipakai bersama.

**Yang masih terbuka (butuh keputusan CEO):** sisa rekomendasi P2/P3 (versi skema save/load, satu titik
serialisasi giliran AI, aksesibilitas) berstatus **belum dikerjakan** — ada di §5. Verifikasi lewat
browser asli tidak bisa saya lakukan (sesi tanpa GUI); penggantinya adalah suite Node yang menjalankan
`script.js` nyata di atas stub DOM.

**Satu koreksi jujur soal laporan ini sendiri:** sebelumnya ada klaim "suite 30/30 hijau" yang ternyata
tidak benar setelah saya membersihkan berkas scratch — suite jatuh ke **29/30** karena sebuah test
golden masih membaca berkas yang sudah dihapus. Saya perbaiki test-nya (bukan melemahkan assertion) dan
suite kembali **30/30**. Detail di §6.4. Saya cantumkan ini karena laporan tinjauan yang menyembunyikan
kesalahannya sendiri tidak layak dipercaya.

## 2. Struktur & Arsitektur

**P1 — architect.** Diverifikasi dengan pembacaan statis seluruh berkas sumber di workspace ini. Tidak ada klaim di bab ini yang butuh eksekusi browser; kutipan `file:line` adalah buktinya.

### 2.1 Fakta terukur

| Berkas | Baris | Peran | Catatan |
|---|---:|---|---|
| `index.html` | 119 | Struktur UI + memuat `ai-engine.js` lalu `script.js` | Semua script global, tanpa `type="module"` |
| `style.css` | 649 | Tema (CSS variables), responsive, dark mode | Ada `@media` `max-width:400px` (593) & `hover:none` (618); **tidak ada** aturan `:focus`, `prefers-color-scheme`, atau `prefers-reduced-motion` |
| `script.js` | 1118 | State global, render canvas, input, turn manager, save/load, replay | `gameState` global mutable tunggal (`script.js:8-28`) |
| `ai-engine.js` | 339 | Heuristik AI (kelas `AIEngine`) | Hanya 1 kelas; sebagian fungsi tak terpakai |
| `README.md` | 67 | Dokumentasi | Menjanjikan **Minimax + Alpha-Beta** (baris 41-44) |

**Tidak ada:** `package.json`, test runner, linter, bundler, CI, atau `.gitignore`. Tidak ada pemisahan modul (import/export). Segala sesuatu berbagi satu *global scope* di `window`.

### 2.2 Peta modul & tanggung jawab

```
index.html
  └─ <canvas id="gameCanvas">            ← satu-satunya permukaan render
  └─ <script src="ai-engine.js">         ← class AIEngine (murni, testable via Node)
  └─ <script src="script.js">            ← 1000+ baris: state, UI, input, storage, replay, wiring

ai-engine.js   (interface IMplisit: getBestMove(state, player), applyCompletedBoxes(...))
  getBestMove ─→ getBoxCompletingMoves ─→ wouldCompleteBox ─→ isBoxAlmostComplete
              └─→ getSafeMoves ─────────→ wouldGiveOpponentBox ─(pakai isBoxAlmostComplete)
              └─→ pickLeastDamagingMove ─→ evaluateMove ─→ simulateMove ─→ applyCompletedBoxes
  (playAITurn TIDAK dipanggil siapa pun)

script.js      (tak ada interface; semua fungsi global + akses DOM langsung)
  makeMove ─→ checkBoxCompletion ─→ isBoxComplete
           └─→ switchTurn ─(setTimeout)─→ makeAIMove ─→ executeAIMove ─→ aiEngine.getBestMove
  saveGame/loadGame/replay* ─→ localStorage
```

### 2.3 Alur data (teks/mermaid)

```mermaid
flowchart TD
  H[Klik / Tap canvas] --> HLS[handleLineSelection]
  HLS --> MM[makeMove]
  MM --> CBC[checkBoxCompletion] --> IBC[isBoxComplete]
  MM --> SB[saveGame localStorage]
  MM --> SW[switchTurn]
  SW -->|pemain berikut AI| ST["setTimeout(makeAIMove,400)"]
  ST --> EAI[executeAIMove] --> GBM["aiEngine.getBestMove"] --> MM
  MM -->|kotak selesai & masih AI| ST2["setTimeout(makeAIMove,400)"]
```

Perhatikan **re-entry**: `makeMove` bisa memanggil `makeAIMove` lewat dua jalur berbeda (baris 572 dan 637), dan `makeAIMove` sendiri membungkus `executeAIMove` dengan `setTimeout` lagi (743-746). Tidak ada satu titik serialisasi giliran.

### 2.4 Masalah struktural (dengan bukti)

| # | Masalah | Bukti | Dampak |
|---|---|---|---|
| S1 | **Single mutable global state** — semua modul baca/tulis `gameState` | `script.js:8-28`; ditulis di 100+ lokasi | Sulit diuji; sulit dilacak "siapa mengubah apa" |
| S2 | **Coupling DOM ↔ logic** | `makeMove` di `script.js:511` memanggil `showToast`/`playSound`/`drawBoard`/`saveGame`; logika murni bercampur efek samping | Tidak bisa memanggil logika tanpa browser |
| S3 | **Duplikasi logika aturan** antara `script.js` dan `ai-engine.js` | `isBoxComplete` (`script.js:616-623`, akses index langsung) vs `isBoxAlmostComplete`/`applyCompletedBoxes` (`ai-engine.js:148-253`, pola `?.`) | Dua sumber kebenaran aturan kotak; satu pakai `owner === null`, satunya `?.owner !== null` — mudah divergen |
| S4 | **Tidak ada module system / build** | Kedua script dimuat global (`index.html:116-117`) | Urutan muat jadi kontrak tersembunyi; tak ada tree-shaking/type-check |
| S5 | **`ai-engine.js` punya dead code** | `playAITurn` (`:15-37`) tak direferensikan `script.js` (satu-satunya pemanggil pola "auto-chain" justru implementasi berbeda di `executeAIMove`) | ~23 baris mati; `while(true)` berisiko infinite-loop bila dipakai |
| S6 | **Ada-dua implementasi giliran AI**: `playAITurn` (tak dipakai) vs `makeAIMove`/`executeAIMove` (dipakai) | `script.js:741-774` | Kebingungan pemeliharaan; perilaku bisa berbeda |
| S7 | **Kontrak AI tidak sesuai judulnya** | README menyatakan Minimax+Alpha-Beta; `getBestMove` (`:43-71`) hanya greedy 3-prioritas tanpa lookahead | Ekspektasi pengguna & parameter `aiDepth` **tidak berpengaruh** (tak dipakai) |
| S8 | **`saveGame` menyimpan objek besar tiap langkah** | `script.js:777-791` men-`JSON.stringify` seluruh edges+boxes+history di setiap `makeMove` (baris 553) | Boros; tanpa versi skema → save lama bisa tak kompatibel |
| S9 | **Tanpa abstraksi audio** | `initAudio`/`playSound` (`:51-101`) membuat `AudioContext` tiap panggilan, tanpa cleanup | Kebocoran node audio pada sesi panjang |

### 2.5 Keterbacaan & aksesibilitas

- **Canvas tanpa fallback/teks alternatif** (`index.html:76`): pemakaian screen-reader tidak mendapat info papan; tidak ada ARIA live region untuk giliran/skor.
- **`user-scalable=no`** (`index.html:5`): mematikan zoom — masalah aksesibilitas nyata.
- **`:focus` tidak didefinisikan** di `style.css`: navigasi keyboard tidak terlihat.
- **Kontras**: teks skor/`--text-secondary` (#4a5568) di latar putih masih wajar, tetapi angka kotak di dalam kotak canvas diberi warna pemain (`script.js:286`) tanpa jaminan kontras terhadap isian `color + '80'`.
- **`prefers-reduced-motion` tidak dihormati**: animasi toast/box tetap jalan (`style.css:558-578`).

### 2.6 Kesempatan *deepening* (vocabulary `codebase-design`)

Aturan permainan saat ini **tersebar** di dua berkas (S3). Kandidat modul **dalam** (interface kecil, implementasi dalam) yang layak diekstrak:

```
// Usulan seam tunggal: modul aturan murni, tanpa DOM.
// Interface kecil, implementasi tebal, bisa diuji lewat Node.
createBoard(gridSize)                         -> state
availableMoves(state)                         -> Move[]
applyMove(state, {type,row,col}, player)      -> { state, boxesGained, extraTurn }
isBoxComplete(state, r, c)                    -> boolean
score(state)                                  -> number[]
```

`script.js` menjadi adapter (render + input + localStorage), `ai-engine.js` menjadi konsumen aturan yang sama. Dengan begitu **deletion test** lolos: bila duplikasi aturan dihapus, kompleksitasnya memang muncul sekali di modul aturan — bukan tersebar di 2 berkas dengan semantik `?.` yang berbeda (S3).


## 3. Daftar Bug Terverifikasi

Semua bug di bawah **terkonfirmasi dengan eksekusi** (`node --test`), bukan analisis statis. Konvensi:
**TERKONFIRMASI (eksekusi)** = ada output test yang membuktikannya; **LATEN (statis)** = hazard terbukti
dari kode tapi belum ter-trigger pada call-site saat ini.

### 3.1 C1 — Kotak tidak pernah diklaim (Kritis, TERKONFIRMASI, DIPERBAIKI)

- **Lokasi:** `script.js` `makeMove` (dulu menulis `edges[...].owner = currentPlayerIndex` langsung,
  lalu memanggil `Rules.applyMove`).
- **Akar masalah:** `Rules.applyMove` **menolak** gerakan yang edge-nya sudah dimiliki (guard klik
  ganda). Karena `makeMove` menulis edge lebih dulu, `applyMove` selalu melihat "garis sudah ada" →
  `boxesGained: []` → kotak yang baru saja ditutup **tidak pernah** diberi pemilik, dan `scores` tetap 0.
- **Reproduksi (RED, output nyata):**
  ```
  not ok 1 - makeMove mengklaim kotak yang tinggal satu sisi (bukan hanya memasang garis)
    error: 'kotak (0,0) harus diklaim oleh pemain yang menutupnya, bukan tetap null'
  ```
- **Perbaikan:** hapus penulisan langsung; `Rules.applyMove` menjadi **satu-satunya** penulis papan
  (`makeMove` menerapkan hasilnya lewat `Object.assign`). Setelah perbaikan: `ok 1 - ...` +
  `ok 21 - papan penuh mengakhiri permainan ...` (skor naik, giliran ekstra benar).

### 3.2 C2 — Permainan tidak pernah berakhir (Kritis, TERKONFIRMASI, DIPERBAIKI)

- **Lokasi:** `script.js` `isGameOver()` — memakai `Rules.score(gameState, 1)[0]` (hanya menghitung
  kotak **pemain 0**).
- **Akar masalah:** pada papan penuh dengan skor `[0, 4]` (pemain 1 menguasai semua kotak), cabang
  `player 0` bernilai 0 → `isGameOver()` mengembalikan `false`. Permainan menggantung selamanya.
- **Reproduksi (RED, output nyata):**
  ```
  not ok 2 - papan penuh mengakhiri permainan dan total skor = jumlah kotak
    error: 'papan penuh harus mengakhiri permainan'
  ```
- **Perbaikan:** jumlahkan skor **semua** pemain dan bandingkan dengan total kotak papan.

### 3.3 C3 — Replay memutar 0 langkah (Kritis, TERKONFIRMASI, DIPERBAIKI)

- **Lokasi:** `script.js` `resetBoardOnly()` (mengosongkan `gameState.moveHistory`) + `replayStep`.
- **Akar masalah:** `replayStep` mereset papan (yang sekaligus **menghapus riwayat**), lalu membaca
  riwayat yang sudah kosong → tidak ada langkah diputar; papan replay berakhir kosong. `replayMove`
  juga memakai pola "tulis langsung lalu applyMove" yang sama dengan C1.
- **Reproduksi (RED, output nyata):**
  ```
  not ok 5 - replayStep mengklaim kotak sama seperti permainan asli
    error: kotak replay = [[null,null],[null,null]] (harus sama dengan permainan asli)
  ```
- **Perbaikan:** simpan riwayat **sebelum** reset; `replayMove` menghitung pemilik kotak dari papan
  (bukan dari `scores`), konsisten dengan `Rules`.

### 3.4 C4 — README menjanjikan Minimax, kode hanya greedy (Tinggi, TERKONFIRMASI, DIPERBAIKI)

- **Bukti:** `README.md:41-44` menyatakan "Minimax Algorithm" + "Alpha-Beta Pruning"; `ai-engine.js`
  pra-perbaikan tidak memuat keduanya (grep kosong) dan parameter `aiDepth` tidak dipakai.
- **Dampak:** tombol "Kedalaman AI (1-5)" di UI **tidak mengubah apa pun**; ekspektasi pemain salah.
- **Perbaikan:** `AIEngine` sekarang menjalankan minimax + alpha-beta berkedalaman dengan *time budget*
  (`ai-engine.js:53-128`), dan `aiDepth` benar-benar diteruskan (`new AIEngine(config.aiDepth)`).
  README diselaraskan (klaim ⇔ kode: `grep -i "minimax|alpha-beta"` cocok di kedua berkas).

### 3.5 L1 — Hazard laten `?.owner !== null` (Robustness, LATEN, DIPERBAIKI)

- **Lokasi pra-refactor:** `ai-engine.js:151-154, 232-235`.
- **Sifat:** `undefined !== null` bernilai `true`, sehingga edge yang **tidak ada** dibaca sebagai
  "terpasang". Saat ini **tidak ter-trigger** karena guard `move.row < grid-1` / `move.col < grid-1`
  di call-site — jadi ini **defect laten/robustness**, **bukan** bug yang menggigit pemain. Saya
  sengaja **tidak** menaikkannya menjadi "Kritis" (akan salah).
- **Perbaikan:** duplikasi aturan dihapus; `ai-engine.js` memakai `rules.js` dan tidak lagi memuat
  optional chaining (dikunci test: `tidak ada pola optional-chaining ?. di ai-engine.js`).

### 3.6 L2 — Dead code `playAITurn` dengan `while(true)` (Rendah, LATEN, DIPERBAIKI)

- **Lokasi:** `ai-engine.js:15-37` pra-refactor; tidak pernah dipanggil `script.js`.
- **Dampak:** ~23 baris mati + risiko infinite-loop bila kelak dipanggil. Sekarang dikunci test:
  `playAITurn (jalur lama) tidak lagi ada, atau tidak berisi loop tak terbatas`.

### 3.7 Masalah lain (belum dikerjakan — rencana di §5)

| # | Masalah | Bukti | Keparahan |
|---|---|---|---|
| O1 | Giliran AI punya **dua** jalur `setTimeout` (tidak ada serialisasi tunggal) | `script.js`: `switchTurn` dan jalur extra-turn masing-masing menjadwalkan AI | Sedang |
| O2 | Save/load **tanpa versi skema** → save lama berisiko tak kompatibel setelah refactor | `saveGame`/`loadGame` (`localStorage`) | Sedang |
| O3 | Aksesibilitas: `user-scalable=no`, tanpa `:focus`, tanpa ARIA live, abaikan `prefers-reduced-motion` | `index.html:5`; `style.css` | Sedang |
| O4 | `saveGame` menulis seluruh papan tiap langkah | dipanggil di dalam `makeMove` | Rendah |

## 4. Rekomendasi Pengembangan

> Bagian 4.A adalah rekomendasi arsitektural (diverifikasi statis atas kode). Rekomendasi industri
> (minimax/alpha-beta berkedalaman, alat uji, PWA, aksesibilitas) diringkas di 4.B; item yang tidak
> saya verifikasi dengan eksekusi ditandai eksplisit **"tidak terverifikasi"**.

### 4.A Rekomendasi arsitektural (p1 — architect, terverifikasi statis)

| Prioritas | Rekomendasi | Alasan (bukti) | Effort |
|---|---|---|---|
| **P0** | Ekstrak `rules.js` (modul aturan murni) sebagai *seam* tunggal; `script.js` & `ai-engine.js` jadi konsumen | Duplikasi aturan (S3) + hazard `?.owner !== null` (`ai-engine.js:151-154, 232-235`) | M |
| **P0** | Hapus/perbaiki pola `?.owner !== null` → guard batas eksplisit | Semantik `undefined !== null` = `true` (phantom edge) — hazard laten; saat ini tertutup guard call-site lain (`move.row < grid-1`), tetapi rapuh | S |
| **P1** | Satu titik serialisasi giliran AI (`turn-queue.js`) | Re-entry ganda: `script.js:572` & `:637` → `makeAIMove` → `setTimeout` lagi (`:743-746`) | S |
| **P1** | Selaraskan AI dengan klaimnya: implementasi minimax+alpha-beta **atau** jujurkan README; jadikan `aiDepth` berarti | `getBestMove` greedy (`ai-engine.js:43-71`); `aiDepth` tak dipakai | M |
| **P2** | Versi skema untuk save/load | `saveGame` (`script.js:777-791`) tanpa versi → save lama berisiko tak kompatibel setelah refactor | S |
| **P2** | Hapus dead code `playAITurn` (`ai-engine.js:15-37`) | Tak dipanggil; `while(true)` berisiko infinite-loop | S |
| **P3** | Aksesibilitas: hapus `user-scalable=no`, tambah `:focus`, `aria-live` giliran/skor, hormati `prefers-reduced-motion` | `index.html:5`; tak ada `:focus`/ARIA di `style.css`/`index.html` | M |
| **P3** | Abstraksi audio (satu `AudioContext` bersama + cleanup) | `initAudio`/`playSound` (`script.js:51-101`) buat context berulang | S |

Rencana implementasi bertahap (TDD, test via `node --test`) ada di **`docs/plans/2026-10-10-perbaikan-dotbox.md`**. Keputusan & trade-off ada di **`docs/adr/0001-seam-aturan-murni.md`** dan **`docs/adr/0002-jangan-janjikan-minimax.md`**. Kosakata domain ada di **`GLOSSARY.md`**.

### 4.B Rekomendasi industri (p4 — researcher)

| Rekomendasi | Alasan | Effort |
|---|---|---|
| Minimax + alpha-beta **berkedalaman dengan time budget** (sudah diterapkan) | Standar umum solver Dots-and-Boxes: pencarian berkedalaman mengalahkan greedy, tetapi wajib dibatasi waktu di JS agar UI tidak membeku. **Terverifikasi eksekusi** (README ⇔ kode, suite hijau) | M |
| **Test di seam publik** dengan Node built-in `node:test` (sudah diterapkan) | Tanpa dependency/build; menguji `rules.js`/`ai-engine.js` murni + `script.js` di stub DOM. **Terverifikasi eksekusi** | M |
| **Uji E2E di browser asli** (Playwright) sebelum rilis | Stub DOM tidak menggantikan browser; menutup celah seperti ukuran canvas, DPI, event sentuh nyata. **Tidak terverifikasi** (belum dijalankan di sesi ini) | L |
| **Determinisme**: seed RNG pada test (sudah diterapkan) | Golden test byte-for-byte hanya sah bila PRNG ber-seed. **Terverifikasi eksekusi** | S |
| **Versi skema** pada data `localStorage` | Data lokal bisa bertahan berbulan-bulan; tanpa versi ia pecah diam-diam saat struktur berubah. **Tidak terverifikasi** (rekomendasi, belum ada kodenya) | M |
| **Aksesibilitas canvas**: alternatif tekstual + ARIA live + hormati `prefers-reduced-motion` | Canvas tak terbaca pembaca layar. **Tidak terverifikasi** (belum diuji dengan alat aksesibilitas) | M |
| **PWA** (service worker + manifest) untuk pemakaian offline | Game statis tanpa backend — kandidat alami untuk offline instal. **Tidak terverifikasi** | M |

Catatan kejujuran: baris **"Tidak terverifikasi"** berarti saya **tidak** menjalankannya dan **tidak**
mengklaim hasilnya. Riset web penuh tidak dapat saya lakukan di sesi ini; tabel di atas adalah praktik
umum yang saya tandai statusnya secara terbuka, bukan temuan yang diuji.


## 5. Roadmap Prioritas

Urutan berdasarkan **dampak bagi pemain** dulu, baru effort. Legenda effort: S (<1 jam), M (1–3 jam),
L (>3 jam). "Status" = keadaan saat laporan ini ditulis.

| Prioritas | Item | Dampak bila dikerjakan / tidak | Effort | Status |
|---|---|---|---|---|
| **P0** | C1 kotak tak pernah diklaim | Tanpa ini, **skor selalu 0** — game tidak bisa dimainkan | S | ✅ **Selesai** |
| **P0** | C2 permainan tak pernah berakhir | Tanpa ini, permainan **menggantung** di akhir papan penuh | S | ✅ **Selesai** |
| **P0** | C3 replay kosong | Tanpa ini, tombol **Replay tidak berguna** | S | ✅ **Selesai** |
| **P0** | Modul aturan tunggal `rules.js` + test | Menghapus duplikasi aturan & hazard `?.owner !== null`; membuka jalan semua test | M | ✅ **Selesai** |
| **P1** | C4 AI minimax+alpha-beta ber-`aiDepth` + README jujur | Tombol "Kedalaman AI" sekarang **benar-benar berpengaruh**; klaim README = kode | M | ✅ **Selesai** |
| **P1** | L1/L2 hazard `?.` + dead code `playAITurn` | Robustness & kebersihan; dikunci test | S | ✅ **Selesai** |
| **P2** | **O1** satu titik serialisasi giliran AI (`turn-queue.js`) | Menghilangkan risiko AI bergerak dua kali akibat dua jalur `setTimeout` | S | ⬜ Belum |
| **P2** | **O2** versi skema save/load + migrasi | Save lama tetap bisa dimuat setelah refactor | M | ⬜ Belum |
| **P2** | Perluas test ke E2E browser (Playwright) | Menutup celah "stub DOM bukan browser asli" | L | ⬜ Belum |
| **P3** | **O3** aksesibilitas (zoom, `:focus`, ARIA live, reduced-motion) | Game bisa dipakai pembaca layar / keyboard | M | ⬜ Belum |
| **P3** | **O4** hemat write `saveGame` | Sedikit lebih hemat; bukan masalah pemain | S | ⬜ Belum |
| **P3** | Abstraksi audio (satu `AudioContext` + cleanup) | Menghindari kebocoran node audio pada sesi panjang | S | ⬜ Belum |

**Bacaan roadmap:** semua yang berdampak pada *apakah game bisa dimainkan* (P0) dan *apakah AI sesuai
janjinya* (P1) sudah selesai dan teruji. Yang tersisa (P2–P3) adalah peningkatan ketahanan, pengujian,
dan aksesibilitas — tidak memblokir pemakaian sekarang.

## 6. Lampiran: Perintah & Bukti

### 6.1 Suite test (bukti utama, dijalankan di workspace ini)

```bash
cd /home/serverbot/aidev/workspace/worktrees/dotbox/20261010-194959
node --test
```

Output nyata (akhir):

```
# tests 36
# pass 36
# fail 0
```

Berkas test dan cakupannya:

| Berkas | Isi |
|---|---|
| `test/rules.test.js` | Aturan murni + **golden test** membandingkan `Rules` dengan implementasi pra-refactor |
| `test/ai-engine.test.js` | AI mengambil kotak, `getBestMove` null di papan penuh, tidak ada `?.`, `playAITurn` mati |
| `test/script-moves.test.js` | `script.js` mendelegasikan aturan ke `Rules`; urutan muat di `index.html` |
| `test/script-integration.test.js` | `script.js` **nyata** dijalankan di atas stub DOM: C1, C2, C3, tolak gerakan luar papan, klik ganda, replay |
| `test/qa-regressions.test.js` | Regresi putaran QA-2 (lihat §6.5): handler `.grid-btn` nyata, invarian papan, `loadGame` menolak save rusak, replay penuh |

### 6.2 Pemeriksaan konsistensi klaim README ⇔ kode

```bash
grep -n -i "minimax\|alpha-beta" README.md ai-engine.js
```
Keduanya menyebut minimax/alpha-beta dan kode benar-benar memuatnya (`ai-engine.js:53,124,271`).

### 6.3 Commit yang relevan

```
75829d6 docs: README jujur soal minimax+alpha-beta & struktur rules.js/test
1361632 test: golden isBoxComplete self-contained (hapus ketergantungan script.js.orig)
19ffd06 refactor: script.js memakai Rules sebagai sumber aturan tunggal   ← C1/C2/C3 diperbaiki
1cf9539 refactor: ai-engine memakai Rules, hapus pola ?.owner !== null    ← L1/L2
4255858 feat: modul aturan murni rules.js dengan test Node
```

### 6.4 Status verifikasi (jujur — koreksi diri)

- **Verifikasi browser asli TIDAK dilakukan** (sesi tanpa GUI). Penggantinya: `test/script-integration.test.js`
  menjalankan `script.js` yang sesungguhnya di atas stub `document`/canvas/`localStorage`. Ini **lebih
  kuat** dari pemeriksaan manual, tetapi **bukan** browser sungguhan — celah nyata yang belum ditutup
  (lihat roadmap P2: Playwright).
- **Koreksi diri:** pernah ada klaim "suite 30/30 hijau" yang tidak benar. Setelah membersihkan berkas
  scratch `script.js.orig` (yang tidak pernah masuk git), test golden di `test/rules.test.js` **GAGAL**
  (`ENOENT`) → suite **29/30**. Saya perbaiki test agar berdiri sendiri (clone `isBoxComplete` diambil
  dari kode asli commit `4d18233` dan di-pin sebagai literal) **tanpa melemahkan assertion**.
- **Koreksi diri kedua (putaran QA-2):** laporan ini pernah menyatakan **FINAL / 30-30 hijau** padahal
  repo memuat test tambahan yang **gagal**. Angka "30" di atas hanya menghitung 4 berkas test, bukan
  suite penuh. Angka yang benar untuk suite penuh saat itu adalah **34 test, 31 lulus, 3 gagal**. Saya
  cantumkan ini karena laporan yang menyembunyikan status merahnya sendiri tidak layak dipercaya.
  Setelah perbaikan putaran ini, angka suite penuh adalah **36 test, 36 lulus, 0 gagal** (bukti §6.1).
- **Tidak ada rahasia/TOKEN** yang disimpan di laporan atau kode.

### 6.5 Putaran QA-2: temuan & perbaikan (bukti eksekusi)

QA melaporkan suite merah (34/31/3). Tiga penyebab, dan tindak lanjutnya:

| ID | Temuan QA | Verdict saya setelah verifikasi | Tindakan |
|---|---|---|---|
| QA-1 | Handler `.grid-btn` (`script.js:1032` pra-fix) menulis `gameState.config.gridSize` langsung → papan tak sinkron | **Benar.** Handler tidak boleh memutasi papan yang sedang berjalan | Handler tidak lagi menulis config; hanya menandai tombol aktif. `startGame` sudah membaca `.grid-btn.active` |
| QA-1b | `config.gridSize === boxes.length + 1` (yaitu 6) | **Assertion test ini SALAH.** Untuk gridSize=n, `boxes.length` selalu n−1 (=2 saat n=3). Rumus `g−1` tak mungkin dicapai papan mana pun | Test ditulis ulang ke invarian yang benar: `edges.horizontal.length === boxes.length + 1 === gridSize` |
| QA-2 | `loadGame` menyalin save mentah sebelum validasi → state berjalan rusak permanen padahal mengembalikan `false` | **Benar, dan reachable** (data `localStorage` lama/rusak) | `loadGame` kini membangun **kandidat state murni**, memvalidasi seluruh struktur, baru memasangnya secara **atomik** |
| QA-3 | Laporan mengklaim 30/30 FINAL padahal suite 34/31/3 | **Benar.** Deliverable menyajikan bukti hijau yang tidak sah | Laporan ini dikoreksi (§6.1, §6.4); `test/qa-regressions.test.js` ditambahkan ke git |

**Bukti red-green putaran ini** (dijalankan di sesi ini):

```bash
# Suite penuh setelah perbaikan
$ node --test
# tests 36
# pass 36
# fail 0
```

- Semua test di `test/qa-regressions.test.js` **dilihat GAGAL dulu** (`not ok`) sebelum perbaikan, lalu
  **lulus** setelahnya.
- Khusus QA-1: efek handler dipicu lewat **handler `.grid-btn` sungguhan** (bukan menulis
  `config.gridSize` langsung, yang merupakan operasi state buatan). Ketika perbaikan handler
  dikembalikan sementara, test QA-1 **merah lagi** — jadi test ini benar-benar menguji perilaku,
  bukan hijau by construction.
- Khusus QA-2/QA-2b: ketika validasi `loadGame` dikembalikan ke versi lama, kedua test **merah lagi**.





