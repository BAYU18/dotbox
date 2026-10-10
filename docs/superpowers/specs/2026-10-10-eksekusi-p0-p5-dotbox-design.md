# Desain: Eksekusi Proposal `dotbox` P0–P5 — fallback giliran AI, aksesibilitas, bentuk Box kanonik, migrasi save, ketajaman HiDPI

**Tanggal:** 2026-10-10
**Penyusun:** Architect (Rancang Sistem)
**Status:** kontrak untuk implementasi (spec → plan → test). **Belum ada kode produksi yang diubah.**
**Plan turunan:** `docs/superpowers/plans/2026-10-10-eksekusi-p0-p5-dotbox.md`
**Spec pendahulu (otoritas per item):**
`docs/superpowers/specs/2026-10-10-p0-fallback-ai-design.md`,
`docs/superpowers/specs/2026-10-10-p3-aksesibilitas-design.md`,
`docs/superpowers/specs/2026-10-10-p5-hidpi-design.md`,
`docs/superpowers/specs/2026-10-10-p2-sisa-migrasi-save-design.md`
**Rencana kerja Lead:** `01-plan.md`
**ADR terkait:** `docs/adr/0001-seam-aturan-murni.md`, `docs/adr/0002-jangan-janjikan-minimax.md`

> **Aturan kejujuran bukti (ADR-0002) yang dipakai dokumen ini.**
> - **[TERVERIFIKASI]** — saya **membaca sendiri baris tersebut di worktree ini** (`20261010-230647`)
>   pada 2026-10-10, atau ada keluaran perintah yang saya sebutkan berkasnya.
> - **[SPEC]** — ditetapkan oleh spec pendahulu yang sudah disetujui Lead.
> - **[KEPUTUSAN]** — saya putuskan di dokumen ini, dengan alasan.
> - **Tidak ada** klaim "test hijau" di dokumen ini: **langkah ini tidak punya akses shell**, jadi
>   setiap warna merah/hijau adalah milik `developer`/`qa` yang menjalankannya.

---

## 0. Masalah & tujuan

`PROPOSAL-PENGEMBANGAN-DOTBOX.md` §3 menetapkan urutan **P0 → P3 → P6 → P2 → P5 → P4 → P7**.
Lead menugaskan eksekusinya (`01-plan.md`). Dokumen ini mengikat **apa** yang berubah, di **baris mana**,
dan **test mana** yang membuktikannya; langkah TDD ada di plan.

Masalah yang diselesaikan, satu per satu:

| # | Masalah | Bukti baris [TERVERIFIKASI] | Dampak |
|---|---|---|---|
| P0 | `getBestMove()` `null` → `executeAIMove` keluar tanpa langkah, toast, atau perpindahan giliran | `script.js:756` `if (!move) return;` | Pemain melihat papan diam; aplikasi terasa rusak |
| P3 | Zoom dimatikan; `aria-label` = 0; tidak ada `:focus-visible`; tidak ada pengumuman status | `index.html:5`, `:15`, `:94–97`, `:108`; `style.css` 0 hasil `:focus-visible`/`prefers-reduced-motion` | Produk praktis tertutup bagi pengguna low-vision & pembaca layar |
| P6 | Skema `Box` ganda; `edges` di dalam kotak ditulis tapi **0 pembaca** | `rules.js:42` `{ owner }` vs `script.js:152–157`, `:1075–1080` `{ owner, edges }` | Pembaca kode ditipu; satu bentuk data punya dua definisi |
| P2-sisa | Save warisan ber-`edges` belum diuji; tiga kelas penolakan save ditulis sebagai satu pesan | `script.js:808`, `:810–812` → `:900` | Save rusak tak bisa didiagnosis; asumsi A7 masih terbuka |
| P5 | Bitmap kanvas = CSS px (tidak pernah ×DPR) | `script.js:206–207`, `:224–225`; `grep dpr` = 0 | Kanvas kabur di layar HiDPI |

**Tujuan:** setelah P0–P5, (a) giliran AI **tidak pernah** menggantung, (b) pengguna bisa zoom, tombol
beremoji punya nama, fokus terlihat, dan giliran/skor diumumkan, (c) `Box` punya **satu** bentuk kanonik
`{ owner }` **tanpa** merusak save lama, (d) save yang ditolak bisa didiagnosis, (e) kanvas tajam di
layar HiDPI **tanpa** merusak hit-test.

**Non-tujuan (eksplisit):** PWA, Playwright/E2E, i18n, grid tombol keyboard pada papan, P4 telemetri
(opsional, lihat §7), P7 (butuh keputusan CEO).

---

## 1. Keputusan yang mengikat

| # | Keputusan | Alasan |
|---|---|---|
| **K1** | Bentuk kanonik `Box` = `{ owner }`; `edges` di dalam kotak **dihapus** dari penulisan, tetapi save lama ber-`edges` **tetap diterima** | Ruling 1 proposal. Save lama pengguna tidak boleh hilang |
| **K2** | P5 adalah **satu item, satu PR**; `hitRadius` tidak diubah; hit-test hari ini **tidak** meleset | Ruling 2 proposal |
| **K3** | P2-sisa dikerjakan **setelah** P6, dalam **satu paket** (p6p2s) | Ruling 3; satu perubahan bentuk data per langkah, dan keduanya menyentuh `script.js` + `buatKandidatState` |
| **K4** | Fallback P0 memilih `Rules.availableMoves(gameState)[0]` — **deterministik, bukan acak** | Proposal §4 P0 menyebut "acak ber-seed", tetapi **RNG ber-seed tidak ada** di `script.js` (`grep`: tidak ada generator; `Math.random()` dipakai di `ai-engine.js:39`, `:291` saja). Menambah state RNG baru = risiko bocor antar-test dan satu konsep baru untuk satu jaring keselamatan. Efek pemain identik: jalur ini hanya aktif saat pencarian **gagal total** |
| **K5** | Jalur normal P0 **tidak** memunculkan toast; toast hanya di jalur fallback, **tepat satu kali** per kejadian | Spec P0 §2 butir 5 + §3 catatan |
| **K6** | `buatKandidatState(saveData)` **tetap** mengembalikan `State|null` dengan **satu** argumen; parameter kedua `alasan` **opsional** | Kontrak publik dipakai `test/save-schema.test.js:155`, `test/proposal-p0-p6.test.js:367` |
| **K7** | Test penjaga bug (`test/bukti-eksekusi.test.js:97–133` dan `:175–182`) **dibalik**, bukan dihapus | Keduanya mengunci perilaku yang kini salah. Menghapus test = kehilangan gerbang; membaliknya = gerbang yang benar |
| **K8** | Dua test yang **salah hari ini** (`test/proposal-p0-p6.test.js:192` P0-b, `:244` P0-c) diperbaiki **QA lebih dulu**, sebelum developer menyentuh `script.js` | Memanggil `getBestMove` **global** padahal produksi memanggil `aiEngine.getBestMove` (`script.js:754`). Kalau dibiarkan, developer mengejar merah yang bukan miliknya |
| **K9** | Satu helper murni `hitungKoordinatPointer(rect, clientX, clientY, canvas, dpr)` dipakai **kedua** handler input | Spec P5 §3 meminta "satu formula yang dipakai bersama"; dua salinan formula = dua tempat yang bisa melenceng |
| **K10** | `aria-label` hanya pada **kontrol beremoji tanpa teks** (enam id). Tidak pada `.btn-control`, `.grid-btn`, `-`/`+` | Spec P3 §2 + WCAG 2.5.3 "Label in Name" |
| **K11** | P4 (telemetri) dan P7 (PWA/E2E) **di luar** gelombang ini | P7 butuh keputusan CEO; P4 bergantung P5 dan menyentuh jaminan data save |
| **K12** | Bahasa: dokumen, komentar kode, dan pesan ke pengguna dalam **Bahasa Indonesia**; hanya nama teknis yang tetap Inggris | Ruling 4 proposal + instruksi tugas |

---

## 2. Interface & tipe (mengikat)

### 2.1 Entitas domain (tidak berubah kecuali `Box`)

```js
State = {
  config: { gridSize, totalPlayers, aiCount, aiDepth },
  players: Player[],                 // Player = { id, name, isAI, color }
  currentPlayerIndex: number,
  edges: { horizontal: Edge[][], vertical: Edge[][] },
  boxes: Box[][],
  scores: number[],
  moveHistory: Move[],
  isGameOver: boolean
}
Edge  = { owner: null | playerId }
Box   = { owner: null | playerId }     // <- `edges` DIHAPUS (K1)
Move  = { type: 'horizontal' | 'vertical', row: number, col: number }
```

Nilai kanonik "belum dimiliki" tetap `owner === null` (`GLOSSARY.md`).

### 2.2 Fungsi produksi yang berubah (signature stabil kecuali yang baru)

| Fungsi | Signature setelah perubahan | Catatan |
|---|---|---|
| `executeAIMove()` | tidak berubah (`:737`) | isi berubah: blok fallback P0 (§3.1) |
| `buatKandidatState(saveData, alasan?)` | `-> State \| null` | `alasan` opsional; `alasan.kode ∈ {'bukan-objek','versi-tak-dikenal','struktur-tak-valid'}` |
| `hitungKoordinatPointer(rect, clientX, clientY, canvas, dpr)` **(baru)** | `-> { x, y }` | murni, tanpa DOM sendiri (menerima semua yang dibutuhkan) |
| `pasangUkuranCanvas(size)` **(baru)** | `-> void` | satu tempat menulis `canvas.width/height`, `style`, dan `setTransform` |
| `updateUI()` | tidak berubah (`:708`) | +3 baris di akhir untuk `#liveStatus` |

### 2.3 Interface test (seam — tidak menambah seam baru)

- **`buatKandidatState`** adalah seam publik yang sudah ada; ia **harus tetap murni** (tidak menyentuh
  `gameState`).
- **Sandbox `vm` + stub DOM** adalah seam yang sudah dipakai seluruh suite (`test/qa-regressions.test.js`,
  `test/save-schema.test.js`, `test/proposal-p0-p6.test.js`). Test baru mengikuti pola yang sama.
- **`#liveStatus`** diakses lewat `document.getElementById`, dan **wajib nullable-safe** di
  `updateUI` (`if (liveStatus)`), karena stub DOM test lain mengembalikan elemen generik.

---

## 3. Perilaku target per item (kontrak)

### 3.1 P0 — `executeAIMove` tidak boleh diam

```
guard lama (isGameOver / isReplayMode / !aiEngine / bukan AI)   -> return   (tidak berubah)

move <- aiEngine.getBestMove(aiState, gameState.currentPlayerIndex)

bila move ada DAN makeMove(move.*)  === true  -> return       (tanpa toast)

fallback:
  kandidat <- Rules.availableMoves(gameState)          // MURNI, menerima gameState nyata
  bila kandidat kosong:
      showToast('Tidak ada langkah tersisa. Permainan selesai.')
      endGame()
      return
  pilihan <- kandidat[0]                                // deterministik (K4)
  showToast('AI: langkah cadangan dipakai karena pencarian gagal.')
  bila makeMove(pilihan.*) === false:
      switchTurn()
      showToast('AI tidak dapat bergerak; giliran dialihkan.')
```

**Larangan:** `setTimeout` baru; `Rules.applyMove` langsung; memutasi `gameState` sebelum `makeMove`;
loop atas kandidat; `Math.random()`.

**Bukti RED yang sudah ada** (dari harness `scripts/bukti-eksekusi.js` bagian 3a, dikutip
`docs/bukti/output-bukti-eksekusi.txt`): `makeMove` 0×, `switchTurn` tidak, `endGame` tidak,
`showToast` tidak — jadi penyebabnya memang `null`, bukan jalur lain.

### 3.2 P3 — aksesibilitas

Kontrak penuh: `docs/superpowers/specs/2026-10-10-p3-aksesibilitas-design.md` §2. Ditambah penajaman:

1. `index.html:5` → `<meta name="viewport" content="width=device-width, initial-scale=1.0">`.
2. Enam `aria-label` (§4 A.5 dokumen `02-architect.md`); teks persis ditetapkan.
3. `:focus-visible` untuk `button, input, [tabindex]` di `style.css`; **bukan** `:focus`.
4. `#liveStatus` (`role="status"`, `aria-live="polite"`, `aria-atomic="true"`, `class="visually-hidden"`)
   di `index.html`, diperbarui **hanya** dari akhir `updateUI()` dengan **teks tanpa emoji**:
   `Giliran: <nama>. Skor: <nama1> <skor1>, <nama2> <skor2>.`
5. `@media (prefers-reduced-motion: reduce)` mematikan animasi `.toast`, `.box-highlight`, `.modal`,
   `.modal-content`, `.turn-indicator`.
6. **Dilarang** menyentuh `drawBoard`/`drawBoxes` (rencana "overline fokus pemain" dibatalkan; butuh
   keputusan desain sendiri, lihat §7).

### 3.3 P6 — bentuk Box kanonik

- `script.js:152–157` dan `:1075–1080` → `({ owner: null })`.
- Jalur baca tetap: `drawBoxes` (`:293`), `Rules.applyMove`, `replayMove` (`:1004–1010`),
  `ai-engine._memberiKotakLawan` (`:264`) semuanya hanya menyentuh `owner` — jadi **tidak ada** pembaca
  yang rusak. Ini yang membuat penghapusan aman.
- `aiState` (`:750`) menyalin kotak dengan `{ ...b }`; setelah sumbernya bersih, salinannya bersih.

### 3.4 P2-sisa — diagnosa penolakan save + migrasi

Peta kode → kalimat (mengikat):

| `alasan.kode` | Kalimat `console.error` |
|---|---|
| `'bukan-objek'` | `Save ditolak: data simpanan bukan objek.` |
| `'versi-tak-dikenal'` | `Save ditolak: versi skema tidak dikenal.` |
| `'struktur-tak-valid'` | `Save ditolak: struktur data tidak valid.` |

- `SAVE_KEYS` **tidak** ditambahi `version` (save warisan harus tetap lolos cek kunci).
- Pesan JSON rusak (`script.js:892`) **tidak** disentuh.
- Migrasi: save **tanpa** `version` dengan kotak `{ owner, edges:{...} }` **diterima**; kandidat hasil
  hanya memuat `owner` (`:872` sudah begitu), sehingga `loadGame` memasang papan kanonik. Test mengunci
  bahwa `gameState.boxes` **tidak** memuat `edges` setelah muat.
- **Aturan atomik QA-2 dipertahankan:** save ditolak → `gameState` **tidak** berubah.

### 3.5 P5 — ketajaman HiDPI

Di `setupCanvas` dan `handleResize`: `bitmap = size × dpr`, `style = size + 'px'`,
`ctx.setTransform(dpr,0,0,dpr,0,0)` **sebelum** `calculatePositions()`.
Di jalur input: satu helper murni (K9). `hitRadius` tidak berubah. Ruang gambar tetap CSS px, sehingga
`dotPositions`/`lineSegments`/`handleLineSelection` **tidak berubah**.

---

## 4. Review Focus — lima input/kondisi yang spec diamkan tetapi paling mungkin menggigit

Ini daftar yang saya tulis **sebelum** memecah task, supaya tiap baris punya test di task yang
memilikinya.

1. **Papan benar-benar penuh (semua garis ber-`owner`)** → perilaku yang diharapkan: `endGame()`
   dipanggil **dan** pemain diberi tahu; **tidak ada** langkah ilegal dimainkan. → test di **Task 1**
   (P0-c) dan **Task 2**.
2. **`getBestMove` mengembalikan `null` padahal papan masih punya garis kosong** → langkah cadangan
   **legal** dimainkan dan `owner` diberikan kepada pemain AI. → test di **Task 1** (P0-a/P0-b).
3. **Save warisan `{ owner, edges:{...} }` tanpa `version`** → dimuat, pemilik kotak utuh, `edges`
   hilang dari `gameState.boxes`, dan state lama **tidak** rusak bila save ditolak. → test di **Task 5**
   (P2-a..d + `p2-sisa`).
4. **DPR = 2 dengan klik pada titik tengah garis yang sama** → garis yang dipilih **identik** dengan
   DPR = 1, dan ukuran bitmap = CSS × 2 sementara `style` tetap CSS px. → test di **Task 6**.
5. **`updateUI()` dipanggil di lingkungan tanpa `#liveStatus`** (stub DOM test lama, browser lama) →
   **tidak melempar**, hanya melewati pengumuman. → test di **Task 3**.

---

## 5. Yang TIDAK diklaim (batas bukti)

- **Pembaca layar nyata (NVDA/VoiceOver) tidak diuji**; test membuktikan atribut/teks ada dan berbentuk
  benar, bukan bahwa pengalaman pembaca layar bagus. Laporan wajib menyatakan ini.
- **Layar Retina nyata tidak diuji**; test membuktikan perhitungan, bukan ketajaman visual.
- **Peramban nyata tidak diuji** (tidak ada harness E2E; itu P7). Semua test berjalan di Node + stub DOM.
- **Hit-test hari ini tidak meleset** (rasio bitmap:CSS = 1:1). P5 adalah pencegahan regresi + ketajaman,
  **bukan** perbaikan bug aktif. Laporan tidak boleh menulis sebaliknya.
- **P3 bukan "aksesibilitas selesai"**: memilih garis di papan lewat keyboard/pembaca layar **tetap
  mustahil** tanpa pekerjaan L (grid tombol / kursor papan) yang tidak ada di gelombang ini.

---

## 6. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Test penjaga bug tidak dibalik | Suite merah walau kode benar | K7: pembalikan test **bagian dari paket**, bukan follow-up |
| Test P0-b/P0-c menyadap objek salah | Merah palsu hari ini, hijau palsu besok | K8: paket `p0t` (QA) sebelum developer |
| Lima paket menyunting `script.js` | Konflik suntingan | Urutan tegas p0 → p3 → p6p2s → p5 (satu penulis per waktu) |
| Fallback P0 memilih langkah sah tapi buruk | AI terlihat bodoh sekali | Hanya saat pencarian **gagal total**; lewat `Rules.availableMoves` supaya aturan tidak diduplikasi |
| Menambah `version` ke `SAVE_KEYS` | Save warisan ditolak | Dilarang eksplisit (§3.4) |
| P5 setengah jalan (bitmap ×DPR tanpa konversi input) | Hit-test **langsung rusak** | Satu paket + test #3 di Task 6 (masuk **Review Focus #4**) |
| `:focus-visible` memakai `var(--accent-primary)` | Cincin tak terlihat di salah satu tema | Nilai terverifikasi kontras pada kedua tema (`style.css:15`, `:50`); QA memeriksa tangkapan keluaran CSS yang ada |
| `#liveStatus` di `updateUI` merebut fokus | Pengalaman memburuk | Dilarang `focus()`/`scrollIntoView`; `role="status"` + `aria-live="polite"` sendiri tidak merebut fokus |
| Push non-fast-forward | Menimpa riwayat orang lain | **Tanpa `--force`**; dilaporkan, bukan dipaksa |

---

## 7. Pertanyaan terbuka

**Untuk CEO (keputusan produk/anggaran):**

1. **P4 (telemetri `?dev=1` + hemat tulis save + rapikan audio)** — kerjakan sebagai gelombang lanjutan
   setelah P5, atau tunda ke tugas berikutnya? Rekomendasi saya: **tunda**, supaya P0–P5 bisa push lebih
   cepat; P4 tidak memperbaiki apa pun yang dilihat pemain.
2. **P7 (PWA + E2E Playwright)** — butuh persetujuan karena menambah dependensi uji ke proyek nol
   dependensi. Opsi: (a) PWA minimal **tanpa** Playwright; (b) PWA + Playwright; (c) tunda. Rekomendasi
   saya: **(c) tunda** sampai ada pengguna nyata.
3. **Aksesibilitas papan penuh (grid tombol/keyboard, effort L)** — sekarang atau sesudah? Ini yang
   benar-benar membuka produk untuk pembaca layar; P3 di gelombang ini hanya perbaikan terarah.

**Untuk Lead/developer (teknis, tidak memblokir gelombang ini):**

4. Rencana "overline fokus pemain" di `drawBoard` (`02-architect.md` §5 p3a) saya **batalkan**:
   menambah gambar di kanvas adalah pekerjaan berisiko visual yang butuh keputusan desain sendiri.
   Setuju dikerjakan terpisah?
5. `turnQueue.runNow()` (`turn-queue.js:84–88`) tidak dipakai test mana pun dan **tidak** menjalankan
   timer host (namanya menjanjikan lebih dari yang dilakukan). Saya **tidak** menghapusnya di gelombang
   ini (luar cakupan, dan menyentuh modul yang sudah stabil). Setuju dibiarkan sebagai utang?
