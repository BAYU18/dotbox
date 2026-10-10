# PROPOSAL PENGEMBANGAN LANJUTAN — PROYEK `dotbox`

**Tanggal:** 2026-10-10
**Penulis:** Architect (paket p4) — menyintesiskan hasil paket p1, p2, p3 + verifikasi ulang mandiri atas kode saat ini.
**Branch:** `babd/20261010-214601`
**Tujuan:** menjawab pertanyaan CEO "apa lagi yang harus dikembangkan dari proyek `dotbox`" dengan usulan konkret, berprioritas, dan jujur soal tingkat bukti.

> **Aturan kejujuran bukti (ADR-0002) yang dipakai dokumen ini.**
> - **[TERVERIFIKASI]** — saya **membaca langsung baris kode tersebut di workspace ini**, atau ada bukti eksekusi nyata (perintah + keluaran mentah) yang **disebutkan sumbernya**.
> - **[ASUMSI]** — masuk akal tetapi **belum** diuji/disetujui.
> **Tidak ada** klaim "selesai" di dokumen ini tanpa bukti. Semua usulan berstatus *usulan*, bukan *hasil*.

> **Catatan kejujuran: saya (penulis, p4) tidak punya akses shell di langkah ini.**
> Saya **tidak menjalankan** `node --test`. Karena itu angka suite di §7 saya sebut sebagai **sitasi** dari berkas bukti milik `developer`/`qa` (`docs/bukti/output-*.txt`, `docs/bukti/node-test-polos-qa.txt`, `docs/bukti/grep-p1-belum-terpasang.txt`). Yang bisa saya lakukan sendiri adalah **membaca kode dan memeriksa baris** — itulah dasar seluruh tabel §2.1.

> **Revisi penting dibanding draf sebelumnya.** Draf lama menulis "P2 masih RED / 43+4 gagal". Setelah paket p3, pekerjaan T2/T6, dan verifikasi QA, keadaan kode **berubah dan test sudah hijau**. Saya memverifikasi ulang satu per satu (lihat §2.1); **beberapa klaim kode di draf lama kini tidak akurat lagi** dan sudah saya perbaiki di sini. Perubahan status yang saya temukan:
> - **T2 (modul) selesai**: `turn-queue.js` **ada** di repo dan test-nya **hijau** ([TERVERIFIKASI], `turn-queue.js:1–111`; `docs/bukti/node-test-polos-qa.txt`).
> - **T6 (versi skema) selesai**: `version` + `versiDikenal()` **ada** dan test save-schema **hijau** ([TERVERIFIKASI], `script.js:756–766`).
> - **T3/T4/T7 (WIRING PRODUKSI) BELUM selesai**: `script.js` **masih memakai** 3 `setTimeout(() => makeAIMove(), …)` dan `aiMoveTimeout` masih ada; `index.html` **belum** memuat `turn-queue.js`. ([TERVERIFIKASI], §2.1 V6–V8, V17, V22)

---

## 1. Ringkasan untuk CEO (5 baris)

1. Jalur inti `dotbox` **sehat**: `node --test` polos **52/52 lulus** ([SITASI bukti QA], `docs/bukti/node-test-polos-qa.txt:266–275`, exit=0), dan game dimainkan end-to-end.
2. Celah **paling berisiko bagi pemain** masih terbuka: **giliran AI bisa menggantung** tanpa pesan (`script.js:746`), karena 3 jalur `setTimeout` tak terkoordinasi (`:181/:594/:631`) dan penjadwalan berlapis (`:722–725`) [TERVERIFIKASI].
3. Untuk **seluler & pembaca layar**, produk praktis **tertutup**: `user-scalable=no` (`index.html:5`) mematikan zoom dan **`aria-label` di `index.html` = 0** ([TERVERIFIKASI, dicek ulang]).
4. Ada utang teknis **murah**: `aiMoveTimeout` mati (`:720`), skema `Box` ganda (`rules.js:41` vs `script.js:144–145`), penulisan save tiap langkah (`:575`) [TERVERIFIKASI].
5. **Sudah dikerjakan tapi belum terpasang (temuan utama):** modul `turn-queue.js` dan `version` sudah ada dan **test-nya hijau (52/52)**, namun `script.js`/`index.html` **belum memakainya** — suite hijau **tidak** membuktikan P1 terpasang (bukti QA `docs/bukti/grep-p1-belum-terpasang.txt`). Ini pekerjaan **setengah jalan**, bukan nol.

**Saran urutan eksekusi:** P0 → P1 → P3 → P5 → P6 → P2 → P7 → P4 (§3). Tidak ada item yang boleh dianggap "selesai" tanpa keluaran perintah yang dilampirkan.

---

## 2. Kondisi saat ini

### 2.1 Terverifikasi — saya baca langsung dari workspace ini (2026-10-10)

| # | Temuan | Bukti (berkas:baris) | Catatan |
|---|---|---|---|
| V1 | `user-scalable=no` + `maximum-scale=1.0` mematikan zoom | `index.html:5` | Dibaca langsung ulang; cocok laporan QA |
| V2 | Tombol mode gelap hanya `title`, tanpa `aria-label` | `index.html:15` | Dibaca langsung ulang |
| V3 | Blok tombol replay tanpa `aria-label` | `index.html:94–97` | `▶️ ⏮️ ⏭️ ❌`; baris **94–97** (koreksi QA benar) |
| V4 | `aria-label` di `index.html` = **0** (defisit sistemik) | pencarian `index.html` → 0 hasil | Konsisten dengan temuan QA (repo-wide = 0) |
| V5 | `playAgainBtn` juga tanpa label | `index.html:108` | Tidak ada `aria-label`/`title` |
| V6 | **3 jalur** penjadwalan `setTimeout(() => makeAIMove(), …)` tak terkoordinasi | `script.js:181` (500 ms), `:594` (400 ms), `:631` (400 ms) | Saya baca ketiganya langsung; `:630` bersyarat `currentPlayer.isAI` |
| V7 | `aiMoveTimeout` dideklarasikan, **tidak pernah dipakai** | `script.js:720` | Saya baca ulang: hanya 1 kemunculan → variabel mati |
| V8 | `makeAIMove` membungkus `executeAIMove` di `setTimeout` kedua | `script.js:722–725` | Penjadwalan berlapis, `:724` (`300 ms`) |
| V9 | `getBestMove() === null` → `return` tanpa fallback/pesan/giliran ulang → **giliran menggantung** | `script.js:746` | Dibaca langsung; juga dibuktikan dinamis oleh p3 |
| V10 | **`version` SUDAH ditulis** di `saveGame` (T6 selesai) | `script.js:758`, `:759–762`, `:766` | `SCHEMA_VERSION = 1`; `saveData.version = SCHEMA_VERSION` |
| V11 | **`versiDikenal()` SUDAH ada & dipanggil** | `script.js:759–762`, dan `buatKandidatState` menolak versi tak dikenal | Status draf lama ("belum menulis version") **tidak berlaku lagi** |
| V12 | Skema `Box` **ganda**: `rules.js` `{ owner }`; `script.js` menulis `{ owner, edges }` | `rules.js:41` vs `script.js:144–145` (+ reset `:1053–1054`) | `edges` di kotak = dead write (0 pembaca, dibuktikan p3) |
| V13 | `saveGame()` dipanggil di tengah `makeMove` — tiap langkah menulis `localStorage` | `script.js:575` | Dibaca langsung |
| V14 | `AudioContext` dibuat lazy dan di-`resume` | `script.js:63–101` | Dibaca langsung |
| V15 | Hit-test pointer memakai CSS px dan **tidak pernah** menyentuh `devicePixelRatio` | `script.js:436–438`, `:450–453`, `hitRadius = 30` di `:460` | Dibaca langsung |
| V16 | `canvas.width/height` ditulis sebagai CSS px langsung; **tidak ada** `ctx.scale` DPR | `script.js:196–197`, `:214–215` | Dibaca langsung |
| V17 | `index.html` memuat `rules.js → ai-engine.js → script.js`; **belum** memuat `turn-queue.js` | `index.html:117–119` | Urutan adalah kontrak (test ke-43) |
| V18 | Modul **`turn-queue.js` SUDAH ADA** dengan antarmuka kecil | `turn-queue.js:32–89`, `:93–103` | `createTurnQueue(deps?)`, `shouldScheduleAI(state)`; single-slot |
| V19 | **`script.js` belum memakai** `turnQueue` sama sekali (T3/T4 belum) | pencarian `turnQueue` di `script.js` → **0 hasil** | Modul ada, pemakaian belum |
| V20 | Suite baseline **43/43 lulus** (subset) | `docs/bukti/output-node-test.txt:223–231` (`1..43`, `# pass 43`, `# fail 0`) | **Sitasi** keluaran p3, bukan eksekusi saya |
| V21 | **`node --test` polos = 52/52 LULUS** (seluruh suite, termasuk test p1+p2) | `docs/bukti/node-test-polos-qa.txt:266–275` (`1..52`, `# pass 52`, `# fail 0`, `# exit=0`) | **Sitasi** keluaran QA pada commit `3d2eebc`; test ke-33..37 = save-schema hijau, ke-49..52 = turn-queue hijau |
| V22 | **P1 wiring produksi BELUM terpasang** meski suite hijau | `docs/bukti/grep-p1-belum-terpasang.txt:8–24`; saya baca ulang `script.js:181`, `:720`, `:724`, `index.html:117–119` | QA membuktikan: `script.js` 0 referensi `turnQueue`; `index.html` tak memuat `turn-queue.js` |

### 2.2 Asumsi (belum terbukti — jangan diperlakukan sebagai fakta)

| # | Asumsi | Kenapa belum terbukti | Yang harus membuktikan |
|---|---|---|---|
| A1 | Menghapus `user-scalable=no` memulihkan pinch-zoom di semua peramban sasaran | Belum diuji di perangkat nyata; sebagian peramban mengabaikan atribut ini | Uji manual peramban + QA |
| A2 | Menambah `aria-label` membuat tombol terbaca pembaca layar | Belum ada uji NVDA/VoiceOver | QA (walkthrough pembaca layar) |
| A3 | ARIA live region mengumumkan giliran/skor tanpa merebut fokus | Desain murni, belum ada implementasi | Implementasi + QA |
| A4 | `prefers-reduced-motion` yang dihormati memperbaiki pengalaman pengguna sensitif gerak | Belum ada kode yang memeriksa media query ini | Implementasi + QA |
| A5 | Perbaikan DPR adalah isu **ketajaman render**, **bukan** bug hit-test aktif | developer menyatakan rasio bitmap:CSS saat ini 1:1 sehingga `hitRadius=30` tidak meleset; dari pembacaan kode, bukan uji layar Retina | Uji perangkat HiDPI |
| A6 | Memasang `turnQueue` di `script.js` tidak mengubah perilaku yang sudah lulus tes | Modul **sudah ada** dan test-nya **sudah hijau (52/52)**, tetapi **belum ada** test yang **menuntut** wiring produksi (`script.js` masih 0 `turnQueue`) | `developer` menulis test wiring penuntut + `qa` menjalankannya (§7.3) |
| A7 | `version: 1` cukup untuk migrasi save lama | Implementasi **ada**, tetapi belum ada bukti bahwa save lama (tanpa `version`, ber-`edges`) tetap dimuat utuh | `developer` (test save-schema) + `qa` |
| A8 | Kesiapan PWA/E2E (P7) layak dikerjakan | Belum ada manifest/service worker; ini usulan, bukan temuan cacat | Keputusan CEO (§5.2) |

### 2.3 Satu koreksi angka yang wajib dipakai penulis & QA berikutnya

- **Suite baseline = 43/43 hijau**, sumber `docs/bukti/output-node-test.txt:223–231`. Ini **sitasi** dari p3.
- **Koreksi kedua (lebih baru): `node --test` polos = 52/52 LULUS, exit=0** — sumber `docs/bukti/node-test-polos-qa.txt:266–275` pada commit `3d2eebc`. Ini **membatalkan** kalimat draf lama "P2 masih RED / 43+4 gagal": test `test/save-schema.test.js` (ke-33..37) dan `test/turn-queue.test.js` (ke-49..52) **semuanya ok**. Statusnya **sitasi bukti eksekusi QA**, bukan asumsi lagi.
- **Peringatan tafsir (paling penting).** "52/52 hijau" **bukan** berarti P1 selesai. QA membuktikan (`docs/bukti/grep-p1-belum-terpasang.txt`) bahwa suite tetap hijau **meski** `script.js` belum memakai `turnQueue` (3 `setTimeout(() => makeAIMove(), …)` di `:181/:594/:631`, `aiMoveTimeout` di `:720`) dan `index.html` belum memuat `turn-queue.js` (`:117–119`). Jadi angka 52/52 menguji **`turn-queue.js` sebagai modul terpisah**, bukan **wiring produksinya**. **Jangan tulis "P1/P2 selesai" berdasarkan angka ini.**
- **Angka yang benar untuk dikutip:** "52/52 `node --test` polos lulus (bukti QA `docs/bukti/node-test-polos-qa.txt`), **tetapi** P1 (integrasi produksi `turnQueue`) belum terpasang dan P3/P5–P7 belum dikerjakan."

---

## 3. Roadmap prioritas P0–P3

**Legenda.** Dampak dinilai dari sudut pemain. Effort: **S** ≤ ½ hari, **M** ≈ 1–2 hari, **L** > 2 hari. Status: **[TVER]** = defisit/keadaan terverifikasi (saya baca kode), **[ASM]** = asumsi/desain.

| Prio | Item | Dampak bagi pemain | Effort | Dependency | Status |
|---|---|---|---|---|---|
| **P0** | Fallback bila `getBestMove()` `null` — jangan biarkan giliran menggantung | **Kritis**: permainan berhenti diam-diam tanpa penjelasan | **S** | tidak ada; sebaiknya di dalam antrean P1 | **[TVER]** (V9) |
| **P1** | **Selesaikan** pemasangan `turn-queue.js` di `script.js`+`index.html`, ganti 3 `setTimeout`, hapus `aiMoveTimeout` mati | **Tinggi**: hilangkan gerakan AI ganda/beruntun & timer basi | **M** | modul **sudah ada** (V18); butuh T3/T4/T7 | **[TVER]** (V6–V8, V17, V19) |
| **P3** | Aksesibilitas: hapus `user-scalable=no`, sapu `aria-label`, `:focus-visible` | **Tinggi**: membuka produk untuk pembaca layar & pengguna zoom | **M** | tidak ada | **[TVER]** (V1–V5) |
| **P5** | Ketajaman HiDPI: DPR scale + guard hit-test — **satu PR** | **Sedang**: kanvas tajam di Retina; cegah bug hit-test masa depan | **M** | tidak ada | **[TVER]** defisit render (V15–V16); hit-test **[ASM]** (A5) |
| **P6** | Hapus skema `Box` ganda (`edges` dead write) | Rendah langsung, **tinggi** untuk pemeliharaan: satu definisi Box | **S** | sebaiknya sebelum P2 | **[TVER]** (V12) |
| **P2** | (Sisa) migrasi & pengujian versi skema save | Sedang: melindungi pemain dari save rusak saat bentuk data berubah | **S** | `version` sudah ada (V10–V11); butuh keputusan bentuk Box (P6) | **[TVER]** implementasi ada; migrasi **[ASM]** (A7) |
| **P7** | Kesiapan E2E di peramban + PWA (manifest, service worker) | Sedang: bisa dipasang seperti aplikasi, offline, rilis lebih aman | **L** | perlu keputusan CEO | **[ASM]** (A8) |
| **P4** | Telemetri ringan: panel dev-overlay + hemat tulis save (`:575`) & rapatkan audio | Rendah–sedang: hemat I/O, alat diagnosa untuk QA | **M** | P5 (overlay menampilkan DPR) | **[TVER]** V13/V14; overlay **[ASM]** |

**Urutan disarankan:** **P0 → P1 → P3 → P5 → P6 → P2 → P7 → P4.**
Alasan: P0/P1 saling terkait (fallback diletakkan di dalam antrean), P3/P5 langsung terasa pemain, P6 membuka jalan P2, sisanya investasi jangka panjang.

---

## 4. Tiap usulan: masalah → bukti baris → perubahan → test → risiko

### P0 — Giliran AI menggantung bila `getBestMove()` `null`

- **Masalah.** Saat AI tidak menemukan langkah, fungsi keluar begitu saja. Pemain melihat papan diam, tanpa pesan, tanpa giliran berpindah — dari sudut pemain, aplikasi terasa rusak.
- **Bukti baris.** `script.js:746` `if (!move) return;` di dalam `executeAIMove`. Dibuktikan **dinamis** oleh p3 (bagian 3a): `makeMove` dipanggil **0×**, `switchTurn` **tidak**, `endGame` **tidak**, `showToast` **tidak**. Kontra-bukti 3b: pada `move` valid, `makeMove` dipanggil **1×** dengan `["horizontal",0,0]` → penyebabnya memang `null`.
- **Perubahan yang diusulkan.** Ganti `return` telanjang dengan: (1) ambil langkah cadangan dari `Rules.availableMoves` (acak ber-seed); (2) bila benar-benar kosong → `endGame()`; (3) beri tahu pemain via `showToast`. Diletakkan di dalam antrean P1, bukan `setTimeout` baru.
- **Test yang membuktikan.** Dua test: "`getBestMove` `null` → `makeMove` tetap dipanggil dengan langkah legal" dan "langkah legal kosong → `endGame` + `showToast` dipanggil". Pola sandbox mengikuti `test/qa-regressions.test.js`.
- **Risiko.** Fallback acak bisa memilih langkah sah tapi buruk; mitigasi: hanya dipakai saat AI gagal total, dan tetap lewat `Rules.availableMoves` agar aturan tidak diduplikasi.

### P1 — Selesaikan pemasangan satu turn-queue (modul sudah ada, pemakaian belum)

- **Masalah.** Penjadwalan giliran AI tersebar di **tiga** tempat dan masing-masing memasang timer sendiri; `makeAIMove` lalu memasang timer **kedua** di dalamnya (`:724`). Timer-timer ini tidak saling tahu → bisa menumpuk (AI "bergerak dua kali") atau basi (timer lama menyala setelah papan direset/dimuat).
- **Bukti baris.** `script.js:181` (init, 500 ms), `:594` (setelah kotak selesai, 400 ms), `:631` (setelah `switchTurn`, 400 ms — **bersyarat** `currentPlayer.isAI` di `:630`). Pembungkusan ganda `:722–725`. Variabel mati `:720`. Ketiganya dihitung ulang oleh skrip p3 (`7/7` bukti kuat). **Modul tujuan sudah ada**: `turn-queue.js:32–89` (`createTurnQueue(deps?)` single-slot) dan `shouldScheduleAI(state)` (`:93–103`). Rancangan rinci: `docs/superpowers/specs/2026-10-10-p1-turn-queue-dan-skema-save-design.md`.
- **Perubahan yang diusulkan (sisa pekerjaan T3/T4/T7).**
  1. `script.js` memperoleh modul meniru pola `Rules` (`script.js:40–43`): `const TurnQueue = globalThis.TurnQueue || require('./turn-queue.js');` lalu `const { createTurnQueue, shouldScheduleAI } = TurnQueue; const turnQueue = createTurnQueue();`.
  2. Ganti ketiga jalur: `if (shouldScheduleAI(gameState)) turnQueue.schedule(makeAIMove, <delay>);`; hapus `aiMoveTimeout` (`:720`) dan hapus pembungkusan ganda di `makeAIMove` (`:724`).
  3. Tambah `turnQueue.clear()` di `resetBoardOnly` (`:1029`) dan `loadGame` (`:857`) — **hari ini belum ada sama sekali**.
  4. Muat `turn-queue.js` di `index.html` **sebelum** `script.js`, tanpa melanggar kontrak urutan `rules.js` lebih dulu (test ke-43).
- **Test yang membuktikan.** `test/turn-queue.test.js` (4 test, sudah **ditulis** p1) **dan sudah HIJAU menurut bukti QA** (`docs/bukti/node-test-polos-qa.txt:246–265`, test ke-49..52 ok). Penting: ini membuktikan **modul**-nya benar, **bukan** bahwa `script.js` memakainya. QA mencatat gap: belum ada test yang **menuntut** `script.js` memakai `turnQueue` sebagai satu-satunya penjadwal AI dan `index.html` memuat `turn-queue.js` (`docs/bukti/grep-p1-belum-terpasang.txt:31–32`). **Test itulah yang harus ditulis** agar P1 tidak bisa "hijau" tanpa terpasang.
- **Risiko.** (1) Urutan muat `index.html` harus dijaga agar test ke-43 tetap hijau. (2) Menghapus `aiMoveTimeout` aman hanya karena tidak ada pembacanya — sudah terverifikasi 1 kemunculan. (3) **Risiko tafsir:** suite hijau dapat memberi kesan P1 selesai padahal wiring belum ada — tambahkan test wiring penuntut (di atas) agar hijau = benar-benar terpasang.

### P3 — Aksesibilitas: zoom, nama tombol, fokus terlihat

- **Masalah.** Pengguna pembaca layar tidak tahu fungsi tombol beremoji, dan pengguna low-vision tidak bisa memperbesar tampilan. Produk saat ini praktis tertutup bagi mereka.
- **Bukti baris.** `index.html:5` (`user-scalable=no`, `maximum-scale=1.0`); `index.html:15` (hanya `title`); `index.html:94–97` (`▶️ ⏮️ ⏭️ ❌`); `index.html:108` (`playAgainBtn`); dan `aria-label` di `index.html` = **0** ([TERVERIFIKASI, saya cek ulang]).
- **Perubahan yang diusulkan.** (a) Hapus `maximum-scale=1.0` & `user-scalable=no` → `width=device-width, initial-scale=1.0`. (b) Sapu `aria-label` **seluruh repo**, mis. `#darkModeToggle` "Ganti mode gelap", `#replayPlayPause` "Putar atau jeda replay", `#replayPrev` "Langkah replay ke belakang", `#replayNext` "Langkah replay ke depan", `#replayClose` "Tutup replay", `#playAgainBtn` "Main lagi". (c) Tambah `:focus-visible` yang terlihat. (d) Lanjutan (asumsi): live region `#liveStatus` (`role="status"`, `aria-live="polite"`) berisi **teks**, bukan emoji, mis. "Giliran biru. Skor 3–2." Rancangan penuh: `docs/superpowers/specs/2026-10-10-p2-aksesibilitas-dan-telemetri-design.md`.
- **Test yang membuktikan.** Test statis (`node --test` membaca `index.html`): assert tidak ada `user-scalable=no`, dan setiap `.icon-btn`/`.btn-replay` punya `aria-label` tak kosong. Keluaran bermakna: jumlah `aria-label` di `index.html` > 0. Ditambah walkthrough pembaca layar oleh QA (belum ada).
- **Risiko.** (1) `title` bukan pengganti `aria-label`. (2) Menghapus pembatas zoom dapat mengubah tata letak layar sempit → perlu pemeriksaan visual. (3) Jangan memberi `aria-label` pada tombol yang sudah punya teks visibel (mis. `.btn-control`) — bisa melanggar WCAG 2.5.3 "Label in Name".

### P4 — Telemetri ringan: panel dev-overlay + hemat I/O

- **Masalah.** (a) Saat bug terjadi di peramban, tim tidak punya satu tempat melihat FPS, `devicePixelRatio`, ukuran kanvas, giliran, galat terakhir. (b) `saveGame()` dipanggil di tengah `makeMove` → tiap langkah menulis `localStorage` (I/O sinkron, bisa memicu jank di seluler).
- **Bukti baris.** `script.js:575` (`saveGame()` di jalur `makeMove`); `script.js:63–101` (AudioContext lazy + `resume`; tiap `playSound` membuat oscillator baru).
- **Perubahan yang diusulkan.** (a) Overlay status hanya-baca, aktif lewat `?dev=1`, tampil hanya di mode dev. (b) Batasi tulis save: tulis di akhir giliran (mis. di `updateUI`) alih-alih di tengah `makeMove`, atau coalesce dengan `requestIdleCallback`. (c) Rapatkan audio: pakai ulang satu `AudioContext` (sudah ada) dan batasi jumlah oscillator aktif.
- **Test yang membuktikan.** Untuk (b): test yang menghitung pemanggilan `localStorage.setItem` per langkah **dan** memastikan save akhir selalu merefleksikan state akhir. Untuk (a): test yang memastikan overlay tidak aktif saat `?dev=1` tidak ada.
- **Risiko.** Menunda tulis save bisa kehilangan data bila tab ditutup mendadak; mitigasi: selalu tulis saat giliran berakhir + `beforeunload`. Overlay berisiko bocor ke produksi bila salah gate.

### P5 — Ketajaman HiDPI (DPR scale + guard hit-test) — **satu item, satu PR**

- **Masalah.** Di layar HiDPI, kanvas tidak pernah di-render lebih tajam dari 1× karena `canvas.width` ditulis sebagai CSS px langsung → tampak kabur.
- **Bukti baris.** `script.js:196–197`, `:214–215` (tulis CSS px ke atribut bitmap, tanpa `ctx.scale`/`setTransform`); `script.js:436–438`, `:450–453` (CSS px); `hitRadius = 30` di `:460`. Dikonfirmasi developer: `grep dpr` = 0 hasil, tidak ada `canvas.style.width/height`.
- **Perubahan yang diusulkan.** `canvas.width = size*dpr`, `canvas.style.width = size + 'px'`, `ctx.setTransform(dpr,0,0,dpr,0,0)` **sebelum** `calculatePositions()`, plus konversi balik koordinat pointer bila diperlukan.
- **Status yang benar — jangan ditulis sebagai bug hit-test aktif.** `hitRadius = 30` **saat ini tidak meleset** (rasio bitmap:CSS = 1:1). Tapi ini **rapuh**: begitu bitmap di-×DPR setengah jalan (tanpa scale balik), hit-test langsung rusak. Karena itu guard-nya masuk **satu PR** dengan perbaikan DPR — bukan item terpisah, bukan klaim cacat aktif.
- **Test yang membuktikan.** Test dengan `devicePixelRatio` tiruan (mis. 2): ukuran bitmap = CSS × DPR, `getTransform()` menunjukkan skala DPR, dan pemetaan koordinat pointer tetap menghasilkan indeks garis yang sama. Uji layar Retina asli belum ada ([ASM] A5).
- **Risiko.** Bila hanya satu bagian dikerjakan (bitmap di-×DPR tanpa scale balik), hit-test **langsung rusak** — justru memperburuk. Karena itu **wajib satu PR**.

### P6 — Hapus skema `Box` ganda (`edges` dead write)

- **Masalah.** Ada dua definisi "Box". Satu menghasilkan `{ owner }`, satu lagi menulis `{ owner, edges }`. Field `edges` **tidak pernah dibaca**, jadi ia menipu pembaca kode menjadi percaya kotak menyimpan sisi-sisinya.
- **Bukti baris.** `rules.js:41` → `{ owner: null }`; `script.js:144–145` → `{ owner: null, edges: { top: null, bottom: null, left: null, right: null } }` (dan reset di `:1053–1054`). p3 membuktikan **0 pembaca** `box.edges` → **dead write**.
- **Perubahan yang diusulkan.** Buang `edges` dari inisialisasi `script.js:144–145` dan `:1053–1054` sehingga Box hanya `{ owner }`, sejalan dengan `Rules.createBoard`. Menyiapkan migrasi save P2: save lama ber-`edges` harus **tetap diterima** tetapi tidak disimpan kembali.
- **Test yang membuktikan.** Test yang memverifikasi `gameState.boxes` hasil inisialisasi tidak punya `edges`, dan test migrasi: save lama ber-`edges` tetap dimuat dan papan akhirnya identik.
- **Risiko.** Save lama (sudah terlanjur ber-`edges`) harus tetap bisa dimuat — karena itu urutannya **P6 sebelum P2**.

### P2 — (Sisa) migrasi & pengujian versi skema save

- **Masalah.** Bentuk data bisa berubah (P6 akan mengubahnya); tanpa penjagaan versi, save lama bisa dimuat dengan asumsi bentuk baru.
- **Bukti baris (diperbarui).** Implementasi **sudah ada**: `script.js:758` `const SCHEMA_VERSION = 1;`, `:759–762` `versiDikenal()` (save tanpa `version` → true/warisan; selain itu harus `Number.isInteger` dan `=== SCHEMA_VERSION`), `:766` `version: SCHEMA_VERSION` ditulis `saveGame`, dan `buatKandidatState` memanggil `versiDikenal(saveData.version)` → `return null` bila tak dikenal.
- **Perubahan yang diusulkan (sisa).** Pisahkan pesan galat versi tak dikenal dari pesan struktur tak valid di `console.error` (`:874` area), dan **tulis test migrasi** untuk save lama ber-`edges` (lihat P6) supaya A7 terbukti.
- **Test yang membuktikan.** `test/save-schema.test.js` (5 test, sudah **ditulis** p1) **sudah HIJAU menurut bukti QA** (`docs/bukti/node-test-polos-qa.txt:165–190`, test ke-33..37 ok). Sisa yang belum terbukti: **test migrasi save lama ber-`edges`** (lihat P6) untuk memastikan A7.
- **Risiko.** Menolak versi tak dikenal bisa menutup pintu ke save masa depan; mitigasi: pesan galat yang membedakan kedua kasus agar dapat didiagnosis.

### P7 — Kesiapan E2E di peramban + PWA

- **Masalah.** Tidak ada tes yang menjalankan aplikasi di peramban sungguhan, dan aplikasi tidak bisa dipasang/di-offline-kan.
- **Bukti baris.** Tidak ada berkas manifest/service worker di repo; `index.html:117–119` adalah satu-satunya jalur muat. Ini **usulan**, bukan temuan cacat ([ASM] A8).
- **Perubahan yang diusulkan.** (a) Harness E2E peramban (mis. Playwright): muat `index.html`, mainkan satu permainan kecil, pastikan tidak ada galat konsol — berguna karena seluruh suite kini `node --test` + sandbox `vm`, sehingga input pointer/touch nyata tidak tercakup. (b) PWA minimal: `manifest.webmanifest`, ikon, service worker cache-first untuk aset lokal.
- **Test yang membuktikan.** Skrip E2E hijau di CI + pemeriksaan Lighthouse manual. Belum ada satu pun sekarang.
- **Risiko.** Menambah toolchain peramban memperbesar waktu CI & dependensi; proyek ini sengaja tanpa build step → PWA harus dibuat tanpa bundler.

---

## 5. Keputusan yang sudah diambil + yang masih terbuka

### 5.1 Keputusan yang sudah diambil (Ruling 1–4)

**Ruling 1 (bentuk Box → P6).** Bentuk kanonik `Box` adalah `{ owner }` (mengikuti `rules.js:41`). `edges` di `script.js:144–145` dan `:1053–1054` akan dibuang. Save lama ber-`edges` tetap dimuat.

**Ruling 2 (P5 tidak dipecah).** P5 tetap **satu item**: "Perbaikan Ketajaman HiDPI (DPR scale + guard hit-test)", **tanpa** klaim bug hit-test aktif. Memecahnya menjadi P5a/P5b akan menciptakan kesan dua cacat padahal hit-test saat ini benar. Satu PR, satu gerbang test.

**Ruling 3 (P2 diselesaikan setelah P6).** Sisa pekerjaan P2 (pesan galat + test migrasi) dikerjakan **setelah** P6 agar tidak ada dua perubahan bentuk data dalam satu langkah. P2 menerima save lama sebagai v1 — implementasinya (`versiDikenal`) sudah sesuai.

**Ruling 4 (bahasa & bukti).** Dokumen, komentar kode, dan pesan laporan dalam **Bahasa Indonesia**; hanya nama teknis (fungsi/file/perintah) tetap bahasa Inggris. Setiap klaim "terverifikasi" wajib menyertakan `berkas:baris` atau keluaran perintah mentah. Mengikuti ADR-0002 dan koreksi lintas-paket p3 (§2.3).

### 5.2 Masih terbuka — perlu keputusan CEO

1. **Cakupan rilis.** Rilis berikutnya fokus **perbaikan pemain** (P0+P1+P3, cepat) atau **kesiapan produk** (P7 PWA/E2E, lebih lama)?
   - Opsi: (a) Perbaikan pemain dulu (P0→P1→P3→P5) — cepat terasa; (b) Kesiapan produk dulu (P7 + P3); (c) Bertahap: P0/P1 hotfix dulu, lalu P7.
2. **Prioritas aksesibilitas.** Jadikan WCAG AA target formal ("tanpa pelanggaran AA pada rilis berikutnya"), atau cukup perbaikan terarah (zoom + label tombol)?
3. **PWA: sekarang atau nanti.** Service worker berarti memperkenalkan strategi cache yang harus dirawat. Sekarang, atau tunggu ada pengguna nyata?
4. **Anggaran toolchain.** Boleh menambah dependensi uji (Playwright) padahal proyek kini nol dependensi?

---

## 6. Yang masih kurang / terhambat

- **Akses shell.** Paket p4 (saya) tidak dapat menjalankan perintah. Semua angka eksekusi di §7 adalah **sitasi** dari berkas bukti `developer`/`qa`, bukan hasil saya.
- **P1 setengah jalan (temuan utama, terbukti).** Modul `turn-queue.js` **sudah ada** dan test-nya **hijau (52/52)**, tetapi `script.js` **belum** memakainya (0 hasil `turnQueue`) dan `index.html` **belum** memuatnya — dibuktikan QA (`docs/bukti/grep-p1-belum-terpasang.txt`) dan saya konfirmasi ulang (`script.js:181/:720/:724`, `index.html:117–119`). Ini **bukan** "selesai".
- **Gap acceptance criteria P1.** Belum ada test yang **menuntut** wiring produksi (`script.js` memakai `turnQueue` sebagai satu-satunya penjadwal AI; `index.html` memuat `turn-queue.js`), sehingga suite bisa hijau tanpa P1 terpasang. Test ini **harus** ditambahkan.
- **Test E2E peramban belum ada satu pun** → jalur input pointer/touch nyata belum tercakup CI mana pun.
- **Uji perangkat HiDPI nyata** dan **walkthrough pembaca layar** belum ada.

**ASK: qa**
**QUESTION:** Jalankan `node --test` polos di worktree ini, lampirkan keluaran mentahnya (jumlah `# tests/# pass/# fail`) dan simpan ke `docs/bukti/`. Konfirmasi dua hal: (1) apakah benar 52/52 hijau seperti klaim developer, dan (2) apakah suite hijau itu masih mengizinkan `script.js` yang **belum** memakai `turnQueue` — karena `script.js` saat ini masih memiliki 3 `setTimeout(() => makeAIMove(), …)` (`:181/:594/:631`), `aiMoveTimeout` (`:720`), dan `index.html` belum memuat `turn-queue.js`, sehingga "4 test turn-queue hijau" tidak membuktikan P1 terpasang di aplikasi.

---

## 7. Lampiran perintah & output nyata

### 7.1 Suite baseline — 43/43 ([SITASI p3], bukan eksekusi saya)

```
$ node --test test/ai-engine.test.js test/qa-regressions.test.js test/rules.test.js \
      test/script-integration.test.js test/script-moves.test.js test/bukti-eksekusi.test.js
1..43
# tests 43
# suites 0
# pass 43
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 639.58678
```

Sumber: `docs/bukti/output-node-test.txt:223–231`.

### 7.1b Seluruh suite — **52/52 LULUS** ([SITASI qa], bukan eksekusi saya)

```
$ node --test        # worktree 20261010-214601, commit 3d2eebc
1..52
# tests 52
# suites 0
# pass 52
# fail 0
# cancelled 0
# skipped 0
# todo 0
# exit=0
```

Sumber: `docs/bukti/node-test-polos-qa.txt:266–275`. Di dalamnya: test ke-33..37 (save-schema, P2) **ok**, test ke-49..52 (turn-queue, P1) **ok**. **Catatan penting:** angka ini **tidak** membuktikan P1 terpasang di produksi — lihat §7.1c.

### 7.1c Bukti QA — suite hijau **≠** P1 terpasang ([SITASI qa])

```
# docs/bukti/grep-p1-belum-terpasang.txt
script.js -> 3x setTimeout(() => makeAIMove()): :181, :594, :631 ; aiMoveTimeout :720 ;
             referensi turnQueue/TurnQueue = 0
index.html:117-119 -> rules.js, ai-engine.js, script.js ; grep 'turn-queue' = 0 hit
Kesimpulan: 52/52 hijau tetap hijau meski turn-queue.js BELUM dimuat & script.js BELUM memakainya.
```

Saya **memverifikasi ulang baris-baris ini langsung** di workspace (`script.js:181`, `:720`, `:724`; `index.html:5`, `:15`, `:117–119`) — semuanya masih cocok dengan kode saat ini.

Test relevan di baseline 43/43: test ke-6 "script.js punya 3 jalur penjadwal `setTimeout(() => makeAIMove())`" → **ok**; test ke-8 "`aiMoveTimeout` hanya dideklarasikan dan tidak pernah dipakai" → **ok**; test ke-9 "`Rules.createBoard` menghasilkan Box TANPA field `edges`" → **ok**; test ke-10 "inisialisasi `script.js` menulis `Box.edges` yang tidak pernah dibaca (dead write)" → **ok**; test ke-11 "`getBestMove()==null` pada giliran AI: tidak ada fallback, giliran menggantung" → **ok**; test ke-43 "`index.html` memuat `rules.js` SEBELUM `ai-engine.js` dan `script.js`" → **ok** (baris 218–219).

### 7.2 Bukti eksekusi temuan — 7/7 bukti kuat ([SITASI p3], bukan eksekusi saya)

```
$ node scripts/bukti-eksekusi.js --strict        # exit=0
BAGIAN 1 — Jalur penjadwalan makeAIMove dan status aiMoveTimeout
[BUKTI-KUAT] 1a. Jalur yang menjadwalkan makeAIMove : 3  (script.js:181, :594, :631)
[BUKTI-KUAT] 1b. setTimeout(() => executeAIMove())  : 1  (script.js:724)
[BUKTI-KUAT] 1c. aiMoveTimeout: 1 kemunculan saja -> variabel mati (script.js:720)
BAGIAN 2 — Bentuk Box
[BUKTI-KUAT] 2a. Rules.createBoard(3) -> {"owner":null}
[BUKTI-KUAT] 2b. script.js -> {"owner":null,"edges":{...}} ; pembaca Box.edges: 0 -> dead write
BAGIAN 3 — getBestMove null => giliran menggantung
[BUKTI-KUAT] 3a. makeMove dipanggil 0x, switchTurn tidak, endGame tidak, showToast tidak
[BUKTI-KUAT] 3b. Kontra-bukti: move valid -> makeMove dipanggil 1x ["horizontal",0,0]
RINGKASAN: Total bagian 7 | bukti kuat 7 | gagal 0
```

Sumber: `docs/bukti/output-bukti-eksekusi.txt`. **Saya sudah memverifikasi ulang baris-baris yang dikutip** (§2.1 V6–V9, V12) — semuanya masih cocok dengan kode saat ini.

### 7.3 Perintah yang **harus dijalankan** penanggung jawab berikutnya

```
# P1 turn-queue (modul sudah ada; test hijau — tapi wiring produksi BELUM):
node --test test/turn-queue.test.js

# P2 versi skema save (implementasi + test sudah ada & hijau):
node --test test/save-schema.test.js

# Seluruh suite (sudah terbukti 52/52, exit=0 — sumber docs/bukti/node-test-polos-qa.txt):
node --test
```

**Ekspektasi jujur (berdasarkan bukti QA, bukan tebakan).** Ketiga perintah di atas **sudah dijalankan QA** dan **hijau** (`docs/bukti/node-test-polos-qa.txt`). Karena itu tidak ada lagi RED yang saya perkirakan. Yang **belum terbukti** dan wajib ditambahkan: **test yang menuntut wiring produksi P1** — yaitu test yang **gagal** selama `script.js` masih memakai `setTimeout(() => makeAIMove(), …)` / `aiMoveTimeout` dan `index.html` belum memuat `turn-queue.js`. Tanpa test itu, hijau ≠ P1 terpasang (`docs/bukti/grep-p1-belum-terpasang.txt:31–32`).

### 7.4 Berkas spesifikasi, bukti, dan modul terkait

- `docs/superpowers/specs/2026-10-10-p1-turn-queue-dan-skema-save-design.md` — rancangan P1/P2.
- `docs/superpowers/specs/2026-10-10-p2-aksesibilitas-dan-telemetri-design.md` — rancangan P3/P4.
- `turn-queue.js` — modul P1 (**sudah ada**, belum terpasang di `script.js`).
- `test/turn-queue.test.js`, `test/save-schema.test.js` — test p1 (**sudah ditulis & HIJAU**, sumber `docs/bukti/node-test-polos-qa.txt`).
- `docs/bukti/output-node-test.txt` (baseline 43/43), `docs/bukti/output-bukti-eksekusi.txt` (7/7) — keluaran mentah p3.
- `docs/bukti/node-test-polos-qa.txt` (52/52), `docs/bukti/grep-p1-belum-terpasang.txt` — keluaran mentah QA.
- `docs/adr/0001-seam-aturan-murni.md`, `docs/adr/0002-jangan-janjikan-minimax.md` — keputusan arsitektur.

### 7.5 Rujukan praktik aksesibilitas & DPR (dipakai paket p2; tanggal akses: 2026-10-10)

- MDN Web Docs. *Window: devicePixelRatio property.* https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
- MDN Web Docs. *prefers-reduced-motion.* https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- MDN Web Docs. *Canvas API tutorial: Optimizing canvas.* https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- W3C. *WCAG 2.2 Quick Reference* (SC 1.4.4, 1.4.10, 2.2.2, 2.3.3, 2.5.3). https://www.w3.org/WAI/WCAG22/quickref/
- W3C. *WAI-ARIA Authoring Practices: Alert and status patterns.* https://www.w3.org/WAI/ARIA/apg/patterns/alert/
- W3C. *WAI-ARIA Authoring Practices: Accessible names and descriptions.* https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/
- WebAIM. *Accessibility of canvas.* https://webaim.org/articles/accessibility-of-canvas/

---

## Skills applied:
- brainstorming: Menyatakan ulang pemahaman (tujuan CEO = proposal pengembangan) dan memisahkan tegas mana **[TERVERIFIKASI]** (V1–V22, tiap baris saya baca ulang di workspace ini) dan mana **[ASUMSI]** (A1–A8), serta menaruh empat keputusan yang hanya boleh dijawab CEO di §5.2 alih-alih memutuskan sendiri.
- writing-plans: Menyusun roadmap P0–P3 dengan kolom dampak bagi pemain / effort S-M-L / dependency / status verifikasi, dan tiap usulan sebagai urutan masalah → bukti baris → perubahan → test yang membuktikan → risiko, sehingga penanggung jawab berikutnya punya langkah yang dapat diperiksa tanpa menebak.
- domain-modeling: Memperbaiki model domain yang bertabrakan — istilah **Box** punya dua definisi (`rules.js:41` vs `script.js:144–145`) dan saya tetapkan bentuk kanonik `{ owner }` (Ruling 1); istilah "versi skema" dan "giliran menggantung" dipakai konsisten dengan GLOSSARY dan ADR-0002.
- codebase-design: Menilai `turn-queue.js` sebagai modul dalam — antarmuka kecil (`createTurnQueue(deps?)`, `shouldScheduleAI(state)`) menyembunyikan perilaku single-slot dan menyuntikkan dependensi penjadwal (dibenarkan oleh prinsip "accept dependencies, don't create them"), dengan seam yang sama untuk pemanggil (`script.js`) dan test; saya juga menandai **gap acceptance criteria** (hijau tanpa wiring) yang justru menunjukkan seam produksi belum dipakai.
- grilling: Menekan titik yang paling mungkin membuat dokumen ini menyesatkan — (1) memperbarui angka dari "43/43 + 4 RED" menjadi **52/52 hijau berbasis bukti QA** sehingga tidak ada klaim basi; (2) tetap menolak menyimpulkan "P1 selesai" karena `script.js` masih 0 `turnQueue` dan `index.html` belum memuat `turn-queue.js` (V22); (3) mempertahankan P5 sebagai satu item tanpa klaim bug hit-test aktif (Ruling 2); dan (4) memisahkan hasil eksekusi orang lain (sitasi bertanda sumber) dari prediksi/asumsi saya.
