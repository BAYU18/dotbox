# Spesifikasi & Rencana Implementasi P1/P2 — Antrian Giliran AI (`turn-queue.js`) & Versi Skema Save

**Tanggal:** 2026-10-10
**Penulis:** architect (paket kerja p1)
**Workspace:** `/home/serverbot/aidev/workspace/worktrees/dotbox/20261010-214601`
**Branch:** `babd/20261010-214601`
**Status:** spesifikasi + rencana siap eksekusi (belum diimplementasikan). Implementasi = tugas `developer`.
**Untuk:** Team Lead (strategi), `developer` (eksekusi), `qa` (verifikasi)

> **Semua nomor baris diambil dari workspace INI** (`script.js`, 1221 baris), bukan dari
> `LAPORAN-REVIEW.md` yang berasal dari workspace lain (`20261010-194959`, 1118 baris).
> Baris pasca-perbaikan C1/C2/C3 sudah bergeser; §0 memuat bukti kutipan barisnya.

---

## 0. Verifikasi fakta (bukti mentah, wajib dibaca sebelum implementasi)

Klaim Team Lead menyebut `script.js:181, :594, :631, :724, :756, :785`. Saya memverifikasi
satu per satu dengan pembacaan langsung berkas di workspace ini. Hasilnya **semuanya benar**,
tetapi berikut kutipan mentahnya supaya `developer` dan `qa` tidak perlu mempercayai saya:

| Klaim | Baris nyata | Isi baris (kutipan apa adanya) |
|---|---|---|
| `setTimeout` giliran awal | `script.js:181` | `setTimeout(() => makeAIMove(), 500);` (di dalam `initGame`, cabang `players[0].isAI`) |
| `setTimeout` extra-turn | `script.js:594` | `setTimeout(() => makeAIMove(), 400);` (di dalam `makeMove`, cabang `completedBoxes.length > 0`) |
| `setTimeout` ganti giliran | `script.js:631` | `setTimeout(() => makeAIMove(), 400);` (di dalam `switchTurn`, cabang `currentPlayer.isAI`) |
| pembungkus AI | `script.js:724` | `setTimeout(() => executeAIMove(), 300);` (di dalam `makeAIMove`) |
| `saveGame` | `script.js:756` | `function saveGame() {` |
| lokasi migrasi | `script.js:785` | `function buatKandidatState(saveData) {` |
| `loadGame` | `script.js:857` | `function loadGame() {` |
| `SAVE_KEYS` | `script.js:783` | `const SAVE_KEYS = ['config', 'players', 'currentPlayerIndex', 'edges', 'boxes', 'scores', 'moveHistory', 'isGameOver'];` |

**Temuan tambahan (fakta baru, diverifikasi dengan `grep`):**

1. **`aiMoveTimeout` adalah dead variable.** Dideklarasikan di `script.js:720`
   (`let aiMoveTimeout = null;`) tetapi **tidak pernah** ditulis ulang maupun dibaca —
   satu-satunya kemunculan adalah deklarasinya. Jadi **tidak ada mekanisme pembatalan timer
   sama sekali** saat ini. Ini alasan tambahan mengapa `turn-queue.js` layak.
2. **Empat jalur masuk giliran AI, bukan tiga.** Selain `:181`, `:594`, `:631`,
   `executeAIMove` sendiri memanggil `makeMove` di `script.js:749`, yang bisa kembali
   menjadwalkan AI lewat `:594` → **re-entry berantai**. Tidak ada titik serialisasi tunggal.
3. **`replayTimeout` sudah punya pola yang benar** (`script.js:1005` menyimpan handle,
   dibatalkan dengan `clearTimeout`): ini **preseden gaya** yang harus diikuti `turn-queue.js`,
   bukan pola baru.
4. **Stub `setTimeout` di suite bersifat sinkron** (`setTimeout: (fn) => fn()` di
   `test/script-integration.test.js:85` dan `test/qa-regressions.test.js:77`). Konsekuensi
   desain: test `turn-queue.js` **tidak boleh** bergantung pada waktu nyata — harus
   menyuntikkan penjadwal tiruan (§1.3).
5. **`saveGame`/`loadGame` tanpa field versi.** `SAVE_KEYS` (`script.js:783`) memuat 8 kunci
   dan **tidak** memuat `version`; `saveData` (`:757-767`) juga tidak menulisnya. Save hari ini
   karenanya *tanpa penanda* — inilah masalah migrasi yang harus diselesaikan tanpa
   merusak save lama pengguna.

**Keputusan yang sudah diterima (Q1, dari Team Lead):** save warisan **tanpa** `version`
**DITERIMA sebagai v1** (Opsi A). Ini menghilangkan ambiguitas R1 di draf saya sebelumnya;
§2.2 kini mengikat, bukan bertanya.

**Batasan yang dipatuhi:** ADR-0001 (satu seam aturan murni di `rules.js`) dan ADR-0002
(jangan mengklaim kemampuan yang tidak ada). Tidak ada deviasi.

---

## 1. P1 — Modul `turn-queue.js`

### 1.1 Masalah yang diselesaikan

Penjadwalan giliran AI tersebar di tiga call-site (`:181`, `:594`, `:631`) plus pembungkus di
`:724`. Setiap jalur memanggil `setTimeout` sendiri **tanpa pembatalan** (`aiMoveTimeout` mati,
§0.1). Akibat yang dapat terjadi:

- **AI bergerak dua kali** untuk satu giliran logis bila dua jalur terpicu berdekatan
  (mis. `makeMove` menutup kotak → `:594`, sementara `switchTurn` juga sempat berjalan).
- **Eksekusi basi (stale)** setelah papan di-reset / game dimuat ulang: timer lama tetap
  menyala dan AI bergerak di papan yang sudah berbeda.
- **Tidak ada satu tempat** untuk menjawab "apakah AI sedang dijadwalkan?".

### 1.2 Interface (dalam = *small interface, deep implementation*)

Modul murni tanpa DOM, mengikuti pola `rules.js:22-196` (browser `<script>` + Node `require`,
satu objek di `globalThis`). Empat metode kecil + satu predikat murni; seluruh kerumitan
(handle tunggal, pembatalan, penggantian slot) tersembunyi di belakang interface ini.

```
createTurnQueue(deps?)                  -> TurnQueue
  deps: { schedule?: (fn, delayMs) => handle,
          cancel?:   (handle) => void }
        opsional; default = setTimeout/clearTimeout milik host.

TurnQueue.schedule(fn, delayMs)         -> boolean
  true  = satu timer terpasang (menjalankan `fn`)
  false = permintaan diabaikan (sudah ada timer aktif yang belum lewat)

TurnQueue.clear()                       -> void      (idempoten)
TurnQueue.isPending()                   -> boolean   (seam observasi untuk test)
TurnQueue.runNow()                      -> void      (HANYA test: jalankan timer aktif sekarang)

shouldScheduleAI(state)                 -> boolean   (MURNI)
  true bila: state ada, bukan isGameOver, bukan isReplayMode,
  players[currentPlayerIndex] ada dan isAI === true.
```

**Keputusan desain penting — `schedule` bersifat "satu slot, bukan antrian FIFO".**
Kondisi di `script.js:723` berbunyi `// Always reset at start - allow multiple calls`; niat
penulis lama adalah **yang terakhir menang, bukan yang pertama**. Karena itu `schedule` yang
dipanggil dua kali **tidak** mengantre dua eksekusi — ia mengganti isi slot yang sama dan
menghasilkan **satu** eksekusi. Nama `turn-queue` dipertahankan demi kesinambungan dengan
rencana Team Lead, tetapi kontraknya adalah **single-slot scheduler**. Ini yang membuat test
"schedule dipanggil dua kali menghasilkan satu eksekusi" benar **secara sengaja**.

### 1.3 Mengapa menyuntikkan `deps`, bukan memakai `setTimeout` langsung

Suite nyata menjalankan `script.js` di atas stub DOM dengan `setTimeout` **sinkron**
(`test/script-integration.test.js:85`). Bila `turn-queue.js` memanggil `setTimeout` host
langsung, test "hanya satu timer AI aktif" **tidak bisa** dibuat (timer langsung dieksekusi,
tidak pernah "pending") dan test menjadi bergantung waktu nyata (lambat, rapuh). Karena itu
modul menerima `schedule`/`cancel` sebagai dependensi — *"accept dependencies, don't create
them"* (`codebase-design`). Di produksi `script.js` tidak menyuntikkan apa pun (default ke
`setTimeout`/`clearTimeout`); di test kita menyuntikkan penjadwal tiruan.

### 1.4 Test yang wajib ada (`node --test`) — **sudah ditulis di branch ini**

Berkas: `test/turn-queue.test.js`. Sudah saya tulis di branch ini dan **sudah saya tinjau
baris-per-baris terhadap suite nyata** (pola `vm` + penjadwal tiruan mengikuti
`test/qa-regressions.test.js:102-109`).

> **Koreksi kejujuran penting (ADR-0002).** Draf sebelumnya mengatakan test ini "sudah
> dilihat GAGAL". Itu **tidak benar**: pada langkah ini saya **tidak punya akses shell**,
> jadi saya **belum pernah menjalankan `node --test`**. Yang benar: hasil yang **diharapkan**
> (RED) adalah `Cannot find module '../turn-queue.js'` karena `turn-queue.js` baru ada di
> commit T2. Klaim hijau/merah adalah milik `developer`/`qa` yang menjalankannya. Saya
> mencatat ini alih-alih mengklaim bukti yang tidak saya miliki.

Perintah verifikasi yang **harus** dijalankan `developer` setelah T2:

```
node --test test/turn-queue.test.js
```

Empat test yang dikunci di sana:

1. **`hanya satu timer AI aktif`** — 3× `schedule` menyisakan tepat 1 timer; `clear()`
   membatalkannya dan `isPending()` menjadi `false`.
2. **`schedule dipanggil dua kali menghasilkan satu eksekusi`** — dua `schedule`, satu
   eksekusi (slot diganti, bukan ditumpuk).
3. **`clear() mencegah eksekusi basi setelah papan direset`** — fungsi yang dibatalkan
   tidak pernah dijalankan.
4. **`shouldScheduleAI hanya true saat giliran pemain AI dan game berjalan`** — table-driven:
   AI & berjalan → `true`; game over → `false`; replay → `false`; giliran manusia → `false`;
   `players: []` → `false` (tanpa throw); `null` → `false` (tanpa throw).

### 1.5 Perubahan di `script.js` (peta baris, bukan kode jadi)

`developer` mengubah **tepat** titik ini; tidak ada refactor lain:

| Baris | Sebelum | Sesudah |
|---|---|---|
| `:720` | `let aiMoveTimeout = null;` | `const TurnQueue = globalThis.TurnQueue \|\| require('./turn-queue.js');` lalu `const { createTurnQueue, shouldScheduleAI } = TurnQueue;` dan `const turnQueue = createTurnQueue();` (meniru pola `Rules` di `script.js:40-43`; dihapus `aiMoveTimeout` yang mati) |
| `:181` | `setTimeout(() => makeAIMove(), 500);` | `if (shouldScheduleAI(gameState)) turnQueue.schedule(makeAIMove, 500);` |
| `:594` | `setTimeout(() => makeAIMove(), 400);` | `if (shouldScheduleAI(gameState)) turnQueue.schedule(makeAIMove, 400);` |
| `:631` | `setTimeout(() => makeAIMove(), 400);` | ganti kondisi `if (currentPlayer.isAI)` menjadi `shouldScheduleAI(gameState)`, lalu `turnQueue.schedule(makeAIMove, 400)` |
| `:724` | `setTimeout(() => executeAIMove(), 300);` | `turnQueue.schedule(executeAIMove, 300);` |

Pemuatan modul: sisipkan `turn-queue.js` **setelah `rules.js`** di `index.html:117` (sebelum
`ai-engine.js`), karena `script.js` memakainya saat dievaluasi. **Baris `index.html` saat ini:**
`:117` = `rules.js`, `:118` = `ai-engine.js`, `:119` = `script.js` — jadi sisipan menjadi
`:118`, dan berkas lain bergeser satu baris.

**Tempat pembatalan (yang hari ini tidak ada sama sekali):** `resetBoardOnly` (`script.js:1029`)
dan `loadGame` (`script.js:857`) adalah titik di mana eksekusi basi paling berbahaya. Keduanya
harus memanggil `turnQueue.clear()` sebelum membangun ulang papan. Ini **wajib** — tanpa itu,
modul hanya memindahkan `setTimeout` tanpa menutup bug "AI bergerak di papan yang sudah direset".

**Test integrasi opsional (hanya bila deterministik).** Melalui `muatScript()` yang sudah ada:
jadwalkan dua kali ke `turnQueue` dan pastikan hanya satu eksekusi. **Catatan jujur:** test ini
tetap **lemah** karena penjadwal asli `setTimeout` host sinkron di suite ini; kekuatan bukti ada
di `test/turn-queue.test.js` §1.4 yang memakai penjadwal tiruan penuh. Bila test integrasi tidak
deterministik setelah dicoba, **hapus** dan catat alasannya di pesan commit — jangan memalsukan
kekuatan yang tidak ada (ADR-0002).

### 1.6 Kriteria penerimaan P1

1. `node --test` hijau, termasuk 4 test baru di `test/turn-queue.test.js`.
2. `grep -n "setTimeout(() => makeAIMove" script.js` → **0 hasil**.
3. `grep -n "aiMoveTimeout" script.js` → **0 hasil** (dead variable dihapus).
4. `resetBoardOnly` **dan** `loadGame` memanggil `turnQueue.clear()`.
5. `ai-engine.js` **tidak berubah** (batas modul tetap).
6. Tidak ada test lama yang melemah atau dihapus tanpa catatan.

**Satu pintu verifikasi (ad-hoc, bukan suite hijau).** Jalankan kedua berkas test p1; sebelum
T2/T6 MERAH itu **diharapkan**, setelah implementasi HIJAU:

```
node --test test/turn-queue.test.js
node --test test/save-schema.test.js
```

Skrip pembantu `/tmp/hermes-verify-p1.js` **dihapus**: `node --test <berkas>` sudah cukup dan
lebih sedikit bagian yang bisa salah. Lampirkan keluaran mentahnya di laporan.

---

## 2. P2 — Versi skema pada save/load

### 2.1 Masalah yang diselesaikan

`saveGame` (`script.js:756-770`) menulis `saveData` dengan `timestamp` tetapi **tanpa**
`version`. `buatKandidatState` (`script.js:785-855`) memvalidasi 8 kunci (`SAVE_KEYS`) dan
menolak apa pun yang tidak cocok. Akibatnya save lama yang **masih sah** tidak dapat dibedakan
dari save **rusak/versi masa depan** — keduanya ditolak dengan pesan generik yang sama, dan
tidak ada jalur migrasi. Setiap perubahan bentuk save = pengguna kehilangan permainan tersimpan.

### 2.2 Keputusan: nilai versi (MENGIKAT — Q1 sudah dijawab Team Lead = Opsi A)

| `version` | Arti | Aksi `buatKandidatState` |
|---|---|---|
| `undefined` (tidak ada field) | Save warisan; bentuknya identik v1 | **Diterima** sebagai v1 (Q1-A) |
| `1` | Bentuk saat ini: `SAVE_KEYS` + `version` | Diterima |
| angka bulat > `SAVE_VERSION_TERKINI` | Masa depan / tak dikenal | **Ditolak**, pesan jelas |
| bukan bilangan bulat sah (`"1"`, `null`, `true`, `{}`, `1.5`, `-1`, `0`) | Rusak | **Ditolak** |

`SAVE_VERSION_TERKINI = 1` adalah satu-satunya konstanta versi yang boleh ada. Menaikkannya
kelak **wajib** disertai fungsi migrasi eksplisit (`migrasiV1KeV2`), bukan tambalan di dalam
`buatKandidatState`. Mengapa save lama = v1 (bukan v0 terpisah): memetakannya ke v1 menghindari
kode migrasi yang tidak melakukan apa pun (YAGNI), sekaligus tetap mencatat `undefined` sebagai
input yang diuji supaya ketika v2 ada, jalur "tanpa version" tidak diam-diam berubah arti.

### 2.3 Interface tambahan

```
SAVE_VERSION_TERKINI           = 1              (konstanta, script.js)
versiDikenal(saveData)         -> number|null
  null = versi tak dikenal / rusak / bukan objek
  1    = diterima (termasuk `version` undefined)

buatKandidatState(saveData)    -> State|null    (signature tidak berubah)
  Sekarang: menolak bila versiDikenal(saveData) !== 1. Tetap fungsi MURNI
  (tidak menyentuh gameState global).
```

`loadGame` (`script.js:857-905`) **tidak berubah strukturnya** — ia sudah atomik
(`:872` bangun kandidat → `:873` tolak → `:879` pasang). Yang berubah hanya pesan
`console.error` di `:874` agar membedakan "versi tak dikenal" dari "struktur tak valid".
Pemisahan pesan ini penting supaya QA dapat menguji dua kasus secara terpisah.

### 2.4 Test yang wajib ada (`node --test`) — **sudah ditulis di branch ini**

Berkas: `test/save-schema.test.js`. Sudah saya tulis di branch ini. Test memanggil
`buatKandidatState` milik `script.js` melalui sandbox `vm`, **tidak menyalin ulang** logika
validasi.

> **Koreksi kejujuran (ADR-0002).** Draf sebelumnya mengklaim test ini "sudah dilihat GAGAL".
> Saya **tidak** mengklaim itu: saya belum bisa menjalankannya (tanpa akses shell di langkah
> ini). RED yang **diharapkan** (diprediksi dari pembacaan kode, bukan dari eksekusi):
> `saveGame` (`script.js:757-767`) hari ini tidak menulis `version`, sehingga
> `assert.strictEqual(versi, 1, 'saveGame harus menulis version: 1')` (test no. 4) **harus
> GAGAL sekarang** (`versi` = `undefined`); dan test no. 2 (`version=99` ditolak) juga
> **harus GAGAL** karena `buatKandidatState` belum memeriksa versi. Kedua kegagalan itu
> menghilang setelah T6. Bila setelah T6 masih ada yang merah, itu bug implementasi —
> bukan bug test. Ini prediksi yang dapat dipalsukan, bukan klaim bukti.

Perintah verifikasi:

```
node --test test/save-schema.test.js
```

Test yang dikunci (5 test):

1. **`save tanpa version (warisan) diterima sebagai versi 1`** — hapus `version` dari save,
   `buatKandidatState` harus mengembalikan objek (bukan `null`).
2. **`save dengan version tak dikenal ditolak sebagai kandidat`** — `version = 99` → `null`.
3. **`save dengan version bukan bilangan bulat yang sah ditolak`** — `"1"`, `null`, `true`,
   `{}`, `[]`, `1.5`, `-1`, `0` → semuanya `null`.
4. **`save version=1 dimuat dan gameState terpasang utuh`** — `version` tertulis `1`,
   `loadGame()` → `true`, `config.gridSize` terpasang, `drawBoard()` tidak melempar.
5. **`loadGame menolak versi tak dikenal TANPA merusak state berjalan`** — setelah penolakan
   `version=99`: `config` dan `boxes` tidak berubah, permainan masih dapat dilanjutkan
   (`makeMove` tidak melempar). Ini memperkuat aturan atomik QA-2.

### 2.5 Perubahan di `script.js` (peta baris)

| Baris | Perubahan |
|---|---|
| `:757-767` | Tambahkan `version: SAVE_VERSION_TERKINI` sebagai kunci **pertama** `saveData` |
| `:783` | Tambahkan `const SAVE_VERSION_TERKINI = 1;` **di atas** `SAVE_KEYS`; `SAVE_KEYS` **tidak** ditambah `version` (agar save warisan tanpa `version` tetap lolos pemeriksaan kunci) |
| `:785-790` | Tambahkan `versiDikenal()` dan panggil di awal `buatKandidatState` — **sebelum** loop `SAVE_KEYS` |
| `:874` | Pisahkan pesan: `'Save ditolak: versi tidak dikenal'` vs `'Save ditolak: struktur data tidak valid'` |

Arah implementasi `versiDikenal()` yang **mengikat**:

```js
const SAVE_VERSION_TERKINI = 1;

function versiDikenal(saveData) {
    if (!saveData || typeof saveData !== 'object' || Array.isArray(saveData)) return null;
    const v = saveData.version;                         // undefined = save warisan
    if (v === undefined) return 1;                      // (Q1-A): legacy diterima sebagai v1
    if (!Number.isInteger(v) || v < 1) return null;     // "1", null, 1.5, -1, 0 -> rusak
    if (v > SAVE_VERSION_TERKINI) return null;          // versi masa depan -> tolak, jangan tebak
    return v;
}
```

### 2.6 Kriteria penerimaan P2

1. `node --test` hijau, termasuk 5 test baru di `test/save-schema.test.js`.
2. `grep -n "SAVE_VERSION_TERKINI" script.js` → didefinisikan **sekali**, dipakai menulis
   **dan** memeriksa.
3. Save lama (tanpa `version`) di `localStorage` **tetap dimuat** — test §2.4 no. 1.
4. Versi tak dikenal **ditolak tanpa mutasi** `gameState` — test §2.4 no. 5.
5. `buatKandidatState` tetap fungsi murni.

---

## 3. Urutan implementasi (TDD, satu perilaku per commit)

| # | Langkah | Berkas | Bukti |
|---|---|---|---|
| T1 | Tulis `test/turn-queue.test.js` | `test/turn-queue.test.js` | ✅ berkas **ditulis**; RED (prediksi) = `Cannot find module` (§1.4) |
| T2 | Buat `turn-queue.js` agar T1 hijau | `turn-queue.js` (baru) | commit |
| T3 | Pakai `turnQueue` di `script.js:181/:594/:631/:724`; hapus `aiMoveTimeout` `:720` | `script.js` | test integrasi lama tetap hijau |
| T4 | Tambah `turnQueue.clear()` di `resetBoardOnly` `:1029` + `loadGame` `:857` | `script.js` | test basi baru |
| T5 | Tulis `test/save-schema.test.js` | `test/save-schema.test.js` | ✅ berkas **ditulis**; RED (prediksi) = `version: 1` gagal (§2.4) |
| T6 | Tambah `version` + `versiDikenal()` di `script.js` | `script.js` | commit |
| T7 | Muat `turn-queue.js` di `index.html:118` | `index.html` | test urutan muat |

Setiap commit hanya menyentuh satu berkas utama + test-nya.

---

## 4. Risiko & keputusan (tanpa pertanyaan terbuka)

| # | Risiko | Dampak bila salah | Penanganan (sudah diputuskan) |
|---|---|---|---|
| R2 | `turn-queue` dinamai "queue" tetapi kontraknya single-slot | `developer` salah mengimplementasikan FIFO | Ditegaskan §1.2; dikunci test §1.4 no. 2 |
| R3 | Test integrasi P1 lemah karena stub `setTimeout` sinkron | Bukti hijau menyesatkan (langgar ADR-0002) | §1.5: hapus bila tidak deterministik, catat alasannya |
| R4 | `version` menambah ukuran objek yang ditulis setiap langkah | +~14 byte; tidak signifikan | Terima; item O4 (hemat write) di luar lingkup p1 |
| R5 | `turnQueue.clear()` di `loadGame` mematikan giliran AI yang **baru** dimuat | AI tidak bergerak setelah muat bila saat itu giliran AI | **Wajib**: setelah `loadGame` memasang state, panggil `if (shouldScheduleAI(gameState)) turnQueue.schedule(makeAIMove, 400)` di akhir fungsi. Urutan: `clear()` di awal (buang basi) → pasang state → `schedule()` baru |

Tidak ada pertanyaan terbuka. Q1 (save warisan) sudah dijawab Team Lead = **Opsi A**.
R5 saya putuskan sendiri: bersihkan lalu jadwalkan ulang, bukan sekadar bersihkan.

---

## 5. Tabel prioritas singkat (untuk dipakai penulis proposal)

| Item | Dampak | Effort | Tanda verifikasi |
|---|---|---|---|
| P1 `turn-queue.js` | Bug: AI ganda & eksekusi basi | ~0.5 hari | 4 test `test/turn-queue.test.js` + `grep` §1.6 |
| P2 versi skema save | Bug: save rusak vs lama tak terbedakan | ~0.3 hari | 5 test `test/save-schema.test.js` §2.6 |

---

## 6. Ringkasan yang tidak boleh hilang

- **P1** menyatukan empat jalur `setTimeout` (`script.js:181`, `:594`, `:631`, `:724`) ke satu
  modul `turn-queue.js` dengan interface 4 metode kecil + satu predikat murni, plus
  `turnQueue.clear()` di `resetBoardOnly`/`loadGame` yang **hari ini tidak ada sama sekali**.
- **P2** menambah `version` pada `saveGame` (`:757`) dan penolakan versi tak dikenal di
  `buatKandidatState` (`:785`), tanpa merusak save lama (Q1-A) dan tanpa menyentuh state berjalan.
- **Bukti vs klaim, dipisahkan tegas:** 9 test baru (`node --test`) **sudah DITULIS** di
  branch ini dan sudah ditinjau terhadap pola suite nyata, tetapi **belum pernah dijalankan**
  (langkah ini tidak punya akses shell) — RED-nya adalah **prediksi yang dapat dipalsukan**
  (§1.4, §2.4), bukan klaim bukti. Sisa pekerjaan T2/T3/T4/T6/T7 menjadi tugas `developer`;
  warna hijau/merahnya milik `developer`/`qa` yang menjalankan `node --test`.
- **Temuan baru p1:** dead variable `aiMoveTimeout` (`script.js:720`) dan keharusan
  `turnQueue.clear()` ( tidak ada di rencana awal) — lihat R5.
- Tidak ada rahasia/token dalam dokumen ini atau dalam kode usulan.
