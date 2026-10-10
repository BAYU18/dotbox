# Proposal Pengembangan Lanjutan — Proyek `dotbox`

**Tanggal:** 2026-10-10
**Penulis:** Team Lead (BABD) — disusun atas masukan architect, developer, QA, researcher
**Workspace:** `/home/serverbot/aidev/workspace/worktrees/dotbox/20261010-214601`
**Branch:** `babd/20261010-214601`
**Untuk:** CEO
**Status dokumen:** usulan (belum diimplementasikan). Semua prioritas di sini **belum** dikerjakan
kecuali yang ditandai ✅.
**Basis dokumen:** `LAPORAN-REVIEW.md` (audit + bug C1–C4), `docs/superpowers/specs/2026-10-10-p1-turn-queue-dan-skema-save-design.md`
(desain P1/P2), `docs/adr/0001`–`0002`, `GLOSSARY.md`, dan pembacaan langsung `script.js` (1221 baris),
`ai-engine.js` (299), `rules.js` (196), `index.html` (121), `style.css`.

---

## 0. Ringkasan satu halaman

**Kondisi hari ini:** permainan **sudah bisa dimainkan**. Bug kritis (C1 skor selalu 0, C2 game tak
pernah berakhir, C3 replay kosong) sudah diperbaiki dan diuji; aturan kotak sudah menjadi satu modul
murni `rules.js` (ADR-0001) dan AI benar-benar minimax + alpha-beta berkedalaman (ADR-0002).
Suite saat ini: `node --test` hijau.

Maka proposal ini **bukan** daftar "yang belum jadi" secara generik, tetapi tiga hal konkret yang
masih meninggalkan **kerusakan nyata yang belum diperbaiki**:

1. **Petunjuk yang sudah ditulis tapi belum ada implementasinya.** `GLOSSARY.md` sudah mendefinisikan
   *giliran AI tertunda*, *antrian giliran*, *eksekusi basi*, dan *versi skema save* — tetapi kode
   `script.js` **belum** memilikinya. Dokumentasi mendahului kode; itu utang kejujuran yang harus
   ditutup (ADR-0002).
2. **Tiga dead code / dead write terdeteksi dan terkunci sebagai bukti** di
   `test/bukti-eksekusi.test.js`: variabel mati `aiMoveTimeout` (`script.js:720`), field `Box.edges`
   yang ditulis tapi tak pernah dibaca (`script.js:142-147`, `:1039-1044`), dan
   `executeAIMove` yang **tanpa fallback** saat `getBestMove()` mengembalikan `null`
   (`script.js:746`) → giliran **menggantung tanpa pesan ke pemain**.
3. **Kualitas rilis:** tidak ada uji di browser asli (semua uji pakai stub DOM), tidak ada aksesibilitas
   (canvas, `user-scalable=no`, tanpa `:focus`/ARIA), tidak bisa dipasang offline (tanpa PWA).

**Prioritas yang saya usulkan:** kerjakan **P0 (3 item, ±1 hari)** dulu — semuanya memperbaiki
kerusakan yang terlihat pemain/tidak bisa dibuktikan, lalu **P1 (gameplay & mutu AI)**, dan
**P2/P3 (distribusi & aksesibilitas)**. Tidak ada item di sini yang menyentuh cara pakai dasar
("buka `index.html`").

**Keputusan cepat (penjelasan di §5):** §5.1 → **(A)**, tidak ada keputusan bisnis yang saya tahan —
proposal ini tidak memblokir apa pun.

---

## 1. Kondisi saat ini (apa yang sudah selesai)

| Area | Status | Bukti |
|---|---|---|
| Klaim kotak / skor | ✅ Selesai | C1 di `LAPORAN-REVIEW.md` §3.1 |
| Akhir permainan | ✅ Selesai | C2 §3.2 |
| Replay memutar langkah | ✅ Selesai | C3 §3.3 |
| Satu sumber aturan kotak | ✅ `rules.js` (ADR-0001) | `rules.js` dipakai `script.js` + `ai-engine.js` |
| Minimax + alpha-beta berkedalaman + time budget | ✅ `ai-engine.js:22,56-128` | ADR-0002, `test/ai-engine.test.js` |
| Uji Node tanpa dependency | ✅ `node --test` | 7 berkas di `test/` |

**Celah yang sudah tercatat sebagai utang, belum dikerjakan** (`LAPORAN-REVIEW.md` §5, roadmap P2–P3):

- `O1` giliran AI punya **4 jalur masuk** `setTimeout` (`script.js:181, :594, :631, :724`) → re-entry ganda.
- `O2` save/load **tanpa versi skema**.
- `O3` aksesibilitas (zoom, `:focus`, ARIA live, `prefers-reduced-motion`).
- `O4` `saveGame` menulis seluruh papan setiap langkah + `saveGameHistory` **tidak pernah dipanggil**.

---

## 2. Temuan baru yang bisa diverifikasi sekarang

Berikut temuan yang saya angkat dari berkas bukti yang **sudah ada di repo** dan sudah dikunci
sebagai test (`test/bukti-eksekusi.test.js`, `scripts/bukti-eksekusi.js`) — jadi tidak perlu
dipercaya begitu saja, QA bisa menjalankannya ulang:

```bash
cd /home/serverbot/aidev/workspace/worktrees/dotbox/20261010-214601
node --test test/bukti-eksekusi.test.js
node scripts/bukti-eksekusi.js --strict
```

| # | Temuan | Lokasi | Sifat | Dampak pemain |
|---|---|---|---|---|
| N1 | **AI berhenti tanpa kabar saat `getBestMove()` mengembalikan `null`** — tidak ada fallback, tidak ada `switchTurn`, tidak ada toast | `script.js:746` | Bug ter-trigger (dibuktikan harness eksekusi) | Giliran menggantung; pemain menunggu AI yang tidak akan bergerak |
| N2 | `aiMoveTimeout` **dead variable** (dideklarasi, tak pernah ditulis/dibaca) | `script.js:720` | Dead code (terdeteksi statis) | Tidak langsung, tapi ini **mengklaim** ada pembatalan timer padahal tidak ada → stale execution |
| N3 | `Box.edges` **dead write**: ditulis di `initGame` & `resetBoardOnly`, `rules.js` tidak punya field itu, tak ada pembaca | `script.js:142-147`, `:1039-1044` | Dead write (terdeteksi statis) | Boros memori + membingungkan; sumber kebenaran bentuk `Box` jadi ganda |
| N4 | `saveGameHistory()` **dideklarasikan tapi tidak pernah dipanggil**; bila dipanggil pun `JSON.parse` tanpa `try` bisa melempar | `script.js:907-924` | Dead code + hazard | Tidak ada riwayat 10 pertandingan terakhir yang dijanjikan UI |
| N5 | `isGameOver()` tidak dipanggil lagi setelah **perubahan config** — guard hanya dari jumlah kotak terisi | `script.js:650-658` | Hazard | Bila save lama/rusak memberi `boxes` penuh tetapi `isGameOver:false`, baru ketahuan setelah langkah berikutnya |

> Catatan kejujuran: N2–N5 adalah temuan **statis** (dibaca dari kode / test yang sudah ada).
> N1 adalah temuan **dinamis** — dibuktikan dengan mengangkut `executeAIMove` **asli** ke sandbox VM.
> Saya tidak menaikkan temuan statis menjadi "bug kritis"; bahasanya sengaja dibedakan
> (mengikuti disiplin `LAPORAN-REVIEW.md` §7).

---

## 3. Proposal: apa lagi yang perlu dikembangkan

### 3.1 P0 — Perbaikan yang menutup celah "sudah diklaim tetapi belum ada kodenya" (±1 hari)

| # | Item | Kenapa (bukti) | Effort |
|---|---|---|---|
| **P0-1** | **Antrian giliran AI tunggal** (`turn-queue.js`): 4 jalur `setTimeout` → 1 titik, dengan `clear()` untuk mencegah *eksekusi basi* | `GLOSSARY.md` §Penjadwalan sudah mendefinisikan kontrak ini; `script.js:181, :594, :631, :724` + N2 (dead `aiMoveTimeout`) | S–M |
| **P0-2** | **Fallback + pemberitahuan saat `getBestMove()` `null`** (N1): pilih gerakan aman terakhir, atau minimal `showToast` + `switchTurn()` agar giliran tidak menggantung | `script.js:746` + `test/bukti-eksekusi.test.js` 3a | S |
| **P0-3** | **Versi skema save** (`SAVE_VERSION_TERKINI`, `versiDikenal()`), dengan aturan **save warisan tanpa `version` DITERIMA sebagai v1** | `GLOSSARY.md` §Data simpanan sudah menyatakannya; `script.js:783` `SAVE_KEYS` tanpa `version`; keputusan Lead §5.1 | S–M |

**Kriteria penerimaan P0:**
1. `grep -n "setTimeout(() => makeAIMove" script.js` → **0 hasil**; `grep -n "aiMoveTimeout" script.js` → **0 hasil**.
2. Ada test yang **dilihat GAGAL dulu** untuk N1 dan skema save, lalu lulus (`node --test` hijau).
3. Save lama (tanpa `version`) tetap bisa dimuat — dibuktikan test, bukan klaim.
4. Versi tak dikenal ditolak **tanpa memutasi** `gameState` yang sedang berjalan.

### 3.2 P1 — Gameplay & mutu AI (±2–3 hari)

| # | Item | Kenapa | Effort |
|---|---|---|---|
| **P1-1** | **Rantai pengorbanan (chain awareness)**: AI saat ini hanya menghindari "memberi satu kotak"; di papan padat, mengorbankan rantai 2 kotak bisa lebih baik daripada membuka rantai 6 kotak (parity / *double-cross*) | `ai-engine.js:172-187` (`getSafeMoves`, `_memberiKotakLawan`) hanya melihat kotak 3-sisi individual | M–L |
| **P1-2** | **Mode lawan manusia–manusia yang lebih kaya**: undo langkah terakhir (hanya di mode tanpa AI), hint "gerakan terbaik untukmu" | `moveHistory` sudah ada; tidak ada undo/hint di UI | M |
| **P1-3** | **Perbaikan UI/UX kecil**: hapus dua dead write/berat N3 & O4 (berhenti menulis `Box.edges`; tulis save hanya saat langkah/akhir giliran), tampilkan "AI sedang berpikir…" selama `BATAS_WAKTU_CARI_MS` (max 1,5 s) | N3; `script.js:756-770`; `ai-engine.js:22` | S–M |
| **P1-4** | **Statistik pemain** (win/loss per jumlah pemain & ukuran papan) dari `saveGameHistory()` yang selama ini mati | N4 | M |

### 3.3 P2 — Pengujian & rilis (±2 hari)

| # | Item | Kenapa | Effort |
|---|---|---|---|
| **P2-1** | **Uji E2E di browser asli (Playwright)**: ukuran canvas, DPI, event sentuh nyata, alur klik→skor→akhir | `LAPORAN-REVIEW.md` §6.4: semua uji Node berjalan di **stub DOM**, bukan browser | L |
| **P2-2** | **CI ringan** (mis. skrip `npm test` + GitHub Action `node --test`) | Saat ini tak ada otomatisasi; regresi bisa lolos tanpa disadari | S |
| **P2-3** | **Ikon HP → desktop & pencapaian** (sound/vibrasi halus) | `navigator.vibrate` + `playSound` sudah ada, belum diuji | S |

### 3.4 P3 — Aksesibilitas & distribusi (±2–3 hari)

| # | Item | Kenapa | Effort |
|---|---|---|---|
| **P3-1** | **Aksesibilitas canvas**: hapus `user-scalable=no` (`index.html:5`), tambah `:focus` terlihat, `aria-live` untuk giliran/skor, alt-teks papan, hormati `prefers-reduced-motion` | `LAPORAN-REVIEW.md` §2.5; tidak ada `:focus`/ARIA di `style.css`/`index.html` | M |
| **P3-2** | **PWA** (manifest + service worker) agar bisa dipasang & jalan offline | Game statis tanpa backend — kandidat alami | M |
| **P3-3** | **i18n** sederhana (ID/EN) | Saat ini semua string Indonesia di kode | M |

---

## 4. Urutan kerja & pembagian peran

```text
Iterasi 1 (P0, ±1 hari)   : developer → turn-queue + fallback AI + skema save
                            qa        → test regresi (RED dulu) untuk N1, save lama
                            architect → review seam turn-queue vs ADR-0001/0002
Iterasi 2 (P1, ±2–3 hari) : developer → chain awareness, undo/hint, berhenti menulis Box.edges
                            researcher → rujukan algoritma chain/parity (dukung keputusan AI)
Iterasi 3 (P2, ±2 hari)   : devops    → Playwright + CI; developer bantu fixture
Iterasi 4 (P3, ±2–3 hari) : developer → a11y; devops → PWA; lead → rilis
```

Aturan tetap tim: **bukti, bukan klaim** — setiap perbaikan wajib punya test yang dilihat GAGAL
lebih dulu, dan setiap perubahan perilaku dicatat di laporan dengan nomor baris yang nyata di
workspace ini (bukan dari workspace lain).

---

## 5. Keputusan & pertanyaan terbuka

### 5.1 Keputusan yang saya ambil sendiri (tidak menunggu CEO)

- **Q1 dari architect — save lama tanpa `version`: (A) diterima sebagai v1.**
  Alasan: *backward compatibility* lebih penting daripada kekakuan skema; pengguna tidak boleh
  kehilangan permainan tersimpan. Ini juga sudah konsisten dengan `GLOSSARY.md` §Data simpanan
  ("save warisan diterima selama bentuknya cocok"). Syaratnya: `version` mulai ditulis untuk semua
  save baru, dan **versi tak dikenal** (mis. `99`, `"1"`, `null`) tetap ditolak **secara atomik**
  (tanpa memutasi `gameState`). Migrasi v1→v2 kelak wajib berupa fungsi eksplisit, bukan tambalan.

  ```js
  // script.js — arah implementasi yang mengikat (bagian dari P0-3)
  const SAVE_VERSION_TERKINI = 1;

  function versiDikenal(saveData) {
      if (!saveData || typeof saveData !== 'object' || Array.isArray(saveData)) return null;
      const v = saveData.version;             // undefined = save warisan (bentuknya = v1)
      if (v === undefined) return 1;          // (A): legacy diterima sebagai v1
      if (!Number.isInteger(v) || v < 1) return null;   // "1", null, 1.5, -1 -> rusak
      if (v > SAVE_VERSION_TERKINI) return null;        // versi masa depan -> tolak, jangan tebak
      return v;
  }
  ```

  `SAVE_KEYS` (`script.js:783`) **tidak** ditambahi `version` supaya save warisan tetap lolos
  pemeriksaan kunci; `version` diperiksa lebih dulu lewat `versiDikenal()`.

- **N1 fallback:** AI boleh memilih gerakan aman terakhir; jika tetap tak ada gerakan legal, papan
  penuh → `endGame()` dan beri tahu pemain. Dilarang "diam-diam menggantung".
- **N2/N3:** hapus, bukan dipertahankan sebagai "cadangan". Dead code yang mengklaim kemampuan
  (pembatalan timer padahal tidak ada) lebih berbahaya daripada tidak ada.

### 5.2 Pertanyaan yang hanya CEO dapat menjawabnya

Tidak ada keputusan bisnis yang memblokir proposal ini — semua item di atas bisa saya prioritaskan
sendiri. Yang berikut **bukan** pertanyaan teknis, melainkan arah produk; saya cantumkan agar
CEO bisa memutuskan sambil kami jalan di P0:

- **Arah produk:** apakah dotbox diposisikan sebagai (a) game lokal ringan untuk dipakai cepat,
  (b) PWA offline yang bisa dipasang, atau (c) basis multi-pemain online (butuh backend)? Ini
  menentukan apakah P3-2 dinaikkan ke P1.
- **Target rilis:** apakah P0 saja cukup untuk dipakai luas sekarang, atau harus menunggu P2-1
  (uji browser asli) sebelum dipromosikan?

---

## 6. Estimasi & dampak

| Prioritas | Item | Perkiraan | Dampak bagi pengguna |
|---|---|---|---|
| P0 | 3 item | ±1 hari | Hilangnya 3 sumber kerusakan nyata/dead code yang mengklaim kemampuan |
| P1 | 4 item | ±2–3 hari | AI terasa lebih pintar; ada undo/hint; statistik |
| P2 | 3 item | ±2 hari | Rilis lebih aman (uji browser asli + CI) |
| P3 | 3 item | ±2–3 hari | Bisa dipakai pembaca layar/keyboard; bisa dipasang offline |

---

## 7. Risiko

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Refactor penjadwalan AI menyentuh `script.js` + test integrasi | Regresi perilaku | Satu perilaku per commit; test lama wajib tetap hijau; `ai-engine.js` tidak disentuh (batas modul, kriteria P0) |
| Test E2E Playwright menambah dependency (bertentangan "no build") | Repo jadi lebih berat | Playwright hanya untuk `test/e2e/`, terpisah dari `node --test`; produksi tetap tanpa dependency |
| "Chain awareness" mengubah `evaluate`/`search` | AI jadi lambat di 7×7 | Wajib diukur terhadap `BATAS_WAKTU_CARI_MS = 1500` (`ai-engine.js:22`); batas waktu tetap menjadi jaring pengaman |
| Aksesibilitas canvas | Tidak bisa diuji di sesi tanpa GUI | Uji lewat DOM di stub (aria/atribut) + tandai "perlu uji browser asli" secara jujur |

---

## 8. Lampiran jujur — batas proposal ini

- Semua temuan statis (N2–N5) **belum** saya reproduksi sebagai test baru di sesi ini; bukti yang
  saya pakai adalah test/harness yang sudah ada di repo (`test/bukti-eksekusi.test.js`,
  `scripts/bukti-eksekusi.js`). QA wajib mengubah N2–N5 menjadi test RED-green di Iterasi 1.
- Tidak ada verifikasi di browser asli pada sesi ini (tanpa GUI). Semua klaim "perilaku" berdasar
  suite Node di atas stub DOM.
- Tidak ada rahasia/TOKEN di dokumen ini.
- Estimasi hari adalah perkiraan sesi kerja, bukan komitmen tanggal.
