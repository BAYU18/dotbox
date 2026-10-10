# Desain: Perbaikan dotbox — modul aturan murni + kejujuran AI

**Tanggal:** 2026-10-10
**Penyusun:** Architect (Rancang Sistem)
**Status:** Disetujui untuk diimplementasikan (P0/P1). P2 ditunda.
**Plan turunan:** `docs/plans/2026-10-10-perbaikan-dotbox.md`
**ADR terkait:** `docs/adr/0001-seam-aturan-murni.md`, `docs/adr/0002-jangan-janjikan-minimax.md`
**Laporan induk:** `LAPORAN-REVIEW.md` §2 (Struktur & Arsitektur) dan §4 (Rekomendasi)

> Dokumen ini adalah spec desain. Ia menjawab **apa** yang berubah dan **mengapa**, dengan seam
> dan interface yang mengikat. Langkah implementasi bertahap (TDD) ada di plan, bukan di sini.

---

## 1. Masalah

Proyek dotbox adalah game Dots and Boxes vanilla JS: `index.html`, `style.css`, `script.js`
(~1118 baris), `ai-engine.js`, tanpa build/test/lint. Audit menemukan tiga kelas masalah:

1. **Aturan kotak diduplikasi.** `script.js` punya `isBoxComplete` (`script.js:616-623`, akses index
   langsung), `ai-engine.js` punya `isBoxAlmostComplete`/`applyCompletedBoxes` dengan pola
   `?.owner !== null` (`ai-engine.js:148-253`). Dua semantik berbeda untuk **garis yang tidak ada**.
2. **Hazard laten `?.owner !== null`.** Edge yang absen memberi `undefined !== null === true` →
   dianggap "terpasang". Saat ini **tidak ter-trigger** di call-site karena guard
   `move.row < grid-1` / `move.col < grid-1`, jadi ini **robustness**, bukan bug yang menggigit pemain.
   Tetap harus ditutup: satu guard tambahan bisa membukanya.
3. **Kontrak AI tidak benar.** `README.md:41-44` menjanjikan "Minimax" + "Alpha-Beta", tetapi
   `getBestMove` (`ai-engine.js:43-71`) hanya heuristik greedy dan `aiDepth` **tidak berpengaruh**.
   Pemain memilih tingkat kesulitan yang tidak mengubah apa pun.

Selain itu: `playAITurn` (`ai-engine.js:15-37`) adalah dead code, dan otomatisasi giliran AI masuk
lewat **dua** `setTimeout` (`script.js:572`, `script.js:637`) → berpotensi re-entry ganda.

## 2. Tujuan & Non-Tujuan

**Tujuan (P0/P1):**

- Satu sumber kebenaran aturan kotak, dapat diuji tanpa browser.
- Menghapus hazard laten `?.owner !== null`.
- `aiDepth` benar-benar mengubah keputusan AI (minimax + alpha-beta ber-time-budget).
- Satu titik serialisasi giliran AI (tidak ada re-entry ganda).
- Save/load punya versi skema + migrasi aman.
- Dokumentasi jujur (README ⇔ kode).

**Non-tujuan (sengaja di luar cakupan desain ini):**

- PWA, aksesibilitas ARIA, `prefers-reduced-motion`, i18n — ini **fitur**, bukan perbaikan hazard.
- Perubahan UX bagi pemain manusia. Cara pakai tetap "buka `index.html`".

## 3. Seam utama: modul aturan murni `rules.js`

**Keputusan (ADR-0001):** ekstrak **satu** modul aturan murni tanpa DOM / `localStorage` / `Audio`.
`script.js` dan `ai-engine.js` menjadi **konsumen** modul ini. Ini seam tunggal; tidak ada modul
aturan kedua.

### 3.1 Interface (mengikat — nama tidak boleh diganti)

```js
// rules.js
Rules.createBoard(gridSize)               -> State
Rules.availableMoves(state)               -> Move[]
Rules.applyMove(state, move, player)      -> { state, boxesGained, extraTurn }
Rules.isBoxComplete(state, r, c)          -> boolean
Rules.score(state, playerCount)           -> number[]
```

Tipe (mengikat):

```js
State = {
  config: { gridSize: number },
  edges: { horizontal: Edge[][], vertical: Edge[][] },
  boxes: Box[][],
}
Edge  = { owner: null | playerId }
Box   = { owner: null | playerId }
Move  = { type: 'horizontal' | 'vertical', row: number, col: number }
```

Aturan kanonik "belum dimiliki" adalah `owner === null` (`GLOSSARY.md:12`).

### 3.2 Kontrak perilaku (deep module — implementasi tebal di dalam)

- **Purity:** `applyMove` **meng-clone** state; input tidak berubah. Pemanggil memegang state baru.
- **Guard batas lebih dulu:** `isBoxComplete` mengembalikan `false` bila
  `r < 0 || c < 0 || r > gridSize-2 || c > gridSize-2`. **Tidak pernah** membaca index yang tidak ada.
  Ini menghapus pola `?.` secara total, bukan menyamarkannya.
- **Skor dihitung ulang** dari papan (`score`), bukan diinkremen terpisah — mencegah drift.
- **Giliran ekstra** diturunkan dari `boxesGained.length > 0`, bukan dari flag terpisah.
- **Tanpa build step:** modul diekspos sebagai global `Rules` **dan** `module.exports`
  (pola `ai-engine.js:338-340`). Urutan `<script>` menjadi kontrak eksplisit di `index.html`.

### 3.3 Seam & deletion test

Bertanya: "Bila `rules.js` dihapus, apakah duplikasi kembali?" — **ya**, aturan kotak akan kembali
tersebar ke `script.js` dan `ai-engine.js`. Karena itu seam ini **lolos** deletion test (menghapusnya
menyebarkan kompleksitas kembali), tepat sebagai modul, bukan sebagai utang.

## 4. Debugging seam: `turn-queue.js`

Modul kecil, satu tanggung jawab: memutuskan & menyerilkan giliran AI.

```js
// turn-queue.js
shouldScheduleAI(gameState) -> boolean   // false bila isGameOver || isReplayMode || !players[current].isAI
createTurnQueue()           -> { schedule, clear }   // jamin hanya satu setTimeout AI aktif
```

- `schedule` menolak bila `shouldScheduleAI` false.
- `script.js` mengganti kedua `setTimeout(() => makeAIMove(), ...)` (`script.js:572`, `:637`) dan
  pemanggilan di `initGame` (`script.js:166`) menjadi `scheduleAITurn()`.
- Guard input yang **sudah ada** (`script.js:415-419`, `handleCanvasClick` menolak `currentPlayer.isAI`)
  tetap dipertahankan — race bukan di lubang input, tapi di **re-entry** via dua `setTimeout`.

## 5. Skema save/load: `save-schema.js`

```js
// save-schema.js
SAVE_SCHEMA_VERSION = 2
migrateSave(raw) -> State | null   // null bila versi tak dikenal/tidak ada → loadGame() tolak dengan pesan, bukan crash
```

- `loadGame` memanggil `migrateSave`; bila `null` → `showToast('Save lama tidak kompatibel, mulai baru')`
  dan `return false`.
- Struktur `edges`/`boxes` yang berubah antar-versi harus ditangani di sini, **bukan** disebar ke UI.

## 6. Keputusan AI: minimax ber-`aiDepth` (ADR-0002)

**Arah perbaikan (mengikat):** kode yang naik ke klaim README, **bukan** README yang turun.
`README.md:41-44` tetap menjanjikan Minimax + Alpha-Beta; targetnya implementasi, bukan pencabutan janji.

- `evaluate(state, player) = 100*myBoxes - 50*oppBoxes`.
- `search(state, player, depth, alpha, beta)`: bila `depth===0` atau tak ada move → evaluasi.
  Bila move mengklaim kotak, giliran tetap `player` (rantai kotak dituntaskan tanpa turun depth).
- **Time budget wajib** (mis. > 1500 ms → hentikan, kembalikan best-so-far) agar 7×7 + `aiDepth=5`
  tidak membekukan UI.
- `this.depth` dari `aiDepth` kini berpengaruh. `getBestMove(state, player) -> Move|null` tetap publik.
- `playAITurn` (dead code) dihapus atau disatukan ke jalur `turn-queue`.

**Aturan transisi (mengikat selama P0 → P2):** sampai minimax mendarat, `README.md` **wajib** memuat
penanda status jujur (mis. "AI masih heuristik; minimax dalam pengerjaan"). Ini menutup ADR-0002
jalur (b) sementara. Verifikasi: `grep -n -i "minimax\|alpha-beta" README.md ai-engine.js` harus konsisten
(klaim ⇔ kode).

**Acceptance ditulis sebagai perilaku, bukan string:** dari papan dengan satu kotak "3-sisi", AI harus
memilih edge penutup kotak pada **≥ 95%** posisi uji. `grep minimax` hanya **informational**, bukan gate.

## 7. Hazard laten vs bug: bahasa yang dipakai

Kejujuran status wajib di seluruh laporan dan spesifikasi ini:

- **Hazard laten** = semantik fungsi (`?.owner !== null` menganggap edge hilang "terpasang";
  `isBoxAlmostComplete` tidak memeriksa `boxes[r][c].owner`). Terbukti secara statis, **tidak**
  ter-trigger di call-site sekarang.
- **Bug ter-trigger** = ada output/runtime yang salah pada pemakaian nyata. Untuk `LATEN-A`/`LATEN-B`,
  ini **bukan** kategori ini.

Konsekuensi untuk laporan: `LATEN-A`/`LATEN-B` = hazard laten; `verifikasi-ai.js` V1/V2 = perilaku
**benar** (bukti guard bekerja). Keduanya **tidak** digabung menjadi "bug kritis".

## 8. Perubahan skema index & perilaku yang harus dijaga

- `script.js:8-28` mendeklarasikan `gameState` sebagai `const` → tidak boleh ada `gameState = {...}`;
  pakai `Object.assign(gameState, { ... })`.
- `index.html:116-117` memuat `ai-engine.js` sebelum `script.js` → `<script src="rules.js">` harus
  disisipkan **sebelum keduanya**.
- Perilaku pemain manusia **tidak berubah** setelah refactor Task 1–3 (refactor murni → papan identik).

## 9. Risiko & mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Refactor menyentuh 3 berkas sekaligus | regresi perilaku | Task 1 murni + test Node sebelum konsumen dipindah; perilaku pemain dibekukan |
| Minimax 7×7 lambat | UI membeku | time budget + batas kedalaman (Review Focus #3) |
| Save lama tidak kompatibel | crash saat load | `migrateSave` mengembalikan `null` → fallback aman (Review Focus #4) |
| Urutan `<script>` salah | `Rules` undefined di browser | catat urutan di `index.html`; test Node mengunci kontrak modul |
| Dua `setTimeout` AI re-entry | AI jalan dobel / nyangkut | satu titik `scheduleAITurn()` (Task 5) |

## 10. Sisa/terbuka

- **Tombstone ADR duplikat:** `docs/adr/0001-atas-seam-aturan-murni.md` masih ada (sesi tanpa akses
  shell untuk `git rm`). Isinya dibuat tombstone, bukan ADR. Lead wajib menghapusnya.
- **ADR-0001 & 0002 berstatus "Diusulkan"** — menunggu persetujuan CEO/Team Lead. Desain ini
  mengasumsikan keduanya diterima; bila tidak, Task 1–4 di plan batal.
- Batas kedalaman default `aiDepth` yang "aman" untuk 7×7 belum diberi angka final; ditentukan saat
  Task 4 dari hasil pengukuran time budget.
