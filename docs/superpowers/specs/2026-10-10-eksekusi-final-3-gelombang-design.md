# Desain Final (Revisi 2) — Eksekusi Proposal `dotbox` dalam **3 Gelombang**: P0–P3 → P5 → P4

**Tanggal:** 2026-10-10
**Penyusun:** Architect (Rancang Sistem)
**Workspace:** `/home/serverbot/aidev/workspace/worktrees/dotbox/20261010-230647`
**Status:** **revisi 2** — menggantikan pembagian gelombang di `2026-10-10-eksekusi-p0-p5-dotbox-design.md` (yang memakai P6+P2s satu paket dan menahan P4). Isi teknis per-item **tidak berubah**; yang berubah hanya **pembagian gelombang** dan **cakupan**.
**Otoritas atas dokumen ini:**
- Spec lama (otoritas teknis per item): `2026-10-10-eksekusi-p0-p5-dotbox-design.md`, dan spec pendahulu P0/P3/P5/P2-sisa.
- Keputusan Lead (final, mengikat): **3 gelombang — G1: P0–P3, G2: P5, G3: P4; P7 ditunda penuh; §7 butir 4–5 jadi utang tercatat.**
- Plan turunan yang harus disesuaikan: `docs/superpowers/plans/2026-10-10-eksekusi-p0-p5-dotbox.md`.

> **Aturan kejujuran bukti (ADR-0002)** tetap berlaku: **[TERVERIFIKASI]** = saya membaca baris itu sendiri
> di worktree ini; **[KEPUTUSAN]** = saya tetapkan dengan alasan; **tidak ada** klaim "test hijau"
> di dokumen ini — langkah ini tidak punya bukti test yang dia jalankan sendiri.

---

## 0. Ringkasan perubahan dari revisi 1 (baca ini dulu)

Revisi 1 membagi pekerjaan menjadi **p0 → p3 → p6p2s → p5**, dengan P4 dan P7 keluar. Lead memutuskan
kembali setelah membaca §7 revisi 1:

| Hal | Revisi 1 | **Revisi 2 (mengikat sekarang)** |
|---|---|---|
| Pembagian gelombang | 4 gelombang serial (`p0 → p3 → p6p2s → p5`) | **3 gelombang: G1 = P0–P3, G2 = P5, G3 = P4** |
| P0, P3 | dua paket terpisah | **satu gelombang (G1)** — keduanya boleh jalan sekaligus |
| P6 + P2-sisa | satu paket `p6p2s` | tetap satu paket, **di dalam G1** |
| P5 | gelombang sendiri | tetap gelombang sendiri (**G2**) |
| P4 telemetri | ditahan, menunggu izin | **dikerjakan sebagai G3**, setelah P5 lulus |
| P7 PWA/E2E | di luar, menunggu CEO | **ditunda penuh** — dicatat sebagai follow-up, bukan scope |
| §7 butir 4 (overline fokus) | saya batalkan | **setuju dikeluarkan**, masuk catatan utang |
| §7 butir 5 (`turnQueue.runNow`) | saya biarkan | **setuju dikeluarkan**, masuk catatan utang |
| Aturan kalau ada blocker | — | **P4 yang di-drop otomatis, bukan P7**; Lead melaporkan itu ke CEO |

**Alasan Lead dan konsistensinya dengan proposal.** P4 adalah item proposal (§4 P4) yang memang belum
dikerjakan; menahannya permanen berarti proposal tidak tuntas. Tapi P4 **bergantung pada P5** (overlay-nya
menampilkan `devicePixelRatio` vs `canvas.width` — angka itu baru bermakna setelah G2) dan P4 mengubah
**kapan save ditulis**, jadi ia tidak boleh mendahului item yang sudah punya gerbang test. P7 berbeda:
proposalnya sendiri (§5.2) menandai P7 butuh keputusan CEO karena menambah dependensi uji (Playwright) ke
proyek yang kini nol dependensi — itu keputusan produk, bukan teknis.

---

## 1. Keputusan yang mengikat (delta dari revisi 1)

Semua K1–K12 di revisi 1 **tetap berlaku**. Yang berubah/ditambah:

| # | Keputusan | Alasan |
|---|---|---|
| **K11′** | **P4 masuk scope sebagai G3**; **P7 tetap keluar** (ditunda penuh, bukan "menunggu keputusan") | Lead final: P4 kerjakan setelah P5; P7 catat sebagai follow-up |
| **K13** | **G1 = P0 + P3 + P6 (dead-write) + P2-sisa dalam satu gelombang** | Lead final. Isi teknis per item tetap spec lama; yang berubah hanya bungkus gelombang. P6 dan P2-sisa tetap **satu paket, satu penulis**, karena keduanya mengubah bentuk data save (Ruling 3) |
| **K14** | **P4 tetap mengikat tiga jaminan**: (a) overlay **hanya** di `?dev=1`; (b) **tidak ada** kehilangan save — setiap akhir giliran tetap ditulis **dan** ada `beforeunload`; (c) audio dibatasi tanpa mengubah nada/tipe getaran | Proposal §4 P4 "risiko": menunda tulis save bisa kehilangan data; mitigasinya wajib `beforeunload` + tulis di akhir giliran |
| **K15** | **Aturan drop otomatis:** bila G1 atau G2 merah dan tidak bisa dibereskan dalam anggaran, **G3 (P4) yang di-drop**, dan itu yang dilaporkan ke CEO | Lead final. P7 tidak lagi kandidat drop karena sudah keluar dari plan |
| **K16** | **Dua utang teknis dicatat, tidak dikerjakan:** (a) overline fokus pemain di `drawBoard`; (b) `turnQueue.runNow()` | Lead final (§7 butir 4–5). Ditulis di §8 supaya tidak hilang |

---

## 2. Struktur 3 gelombang (yang mengikat untuk Lead & developer)

```
GELOMBANG 1 — G1 (P0 + P3 + P6 + P2-sisa)          [satu gelombang, 1 penulis script.js pada satu waktu]
  ├─ 1a. p0t  (QA)   : perbaiki 2 test yang salah (P0-b/P0-c)          → gerbang sebelum p0
  ├─ 1b. p0   (dev)  : fallback giliran AI        (script.js:737–763, test/bukti-eksekusi.test.js)
  ├─ 1c. p3   (dev)  : aksesibilitas              (index.html, style.css, updateUI, test/aksesibilitas)
  └─ 1d. p6p2s(dev)  : Box kanonik + migrasi save (script.js, test/p2-sisa.test.js)   ← setelah p0 & p3
        ── gerbang: `node --test` hijau ──

GELOMBANG 2 — G2 (P5)                              [satu paket, satu PR — Ruling 2]
  └─ 2a. p5   (dev)  : HiDPI + helper koordinat   (setupCanvas/handleResize/handler input, test/dpr.test.js)

GELOMBANG 3 — G3 (P4)                              [setelah G2 lulus]
  ├─ 3a. p4a  (dev)  : batasi tulis save + rapikan audio  (script.js)      ┐
  └─ 3b. p4b  (dev)  : overlay dev-status.js (?dev=1)      (berkas baru)   ┘ tiga jaminan K14 wajib
        ── gerbang: `node --test` hijau + mode normal bersih ──

VERIFIKASI & OPS
  ├─ QA     (qa)     : `node --test` penuh exit=0, probe grep, triase ber-bukti baris
  └─ DEVOPS (devops) : push ke `master` TANPA `--force`; lapor bila ditolak
```

**Aturan urutan di dalam G1 (jangan dilanggar):** `p0t → p0 → p3 → p6p2s`. Alasannya bukan gaya, tapi
berkas: `p0`, `p3` (`updateUI`), dan `p6p2s` semuanya menyunting `script.js`. Bila dua menyunting baris
berdekatan sekaligus, konflik suntingan membuat papan berantakan dan diff tak bisa ditinjau. `p0t`
mendahului `p0` karena dua test P0 (P0-b/P0-c) saat ini menyadap objek yang salah — tanpa perbaikan itu,
developer mengejar lampu merah palsu.

**Kenapa G2 (P5) bukan bagian G1.** P5 adalah satu paket, satu PR (Ruling 2) dan **menyentuh paling banyak
titik** di `script.js` (`setupCanvas`, `handleResize`, dua handler input, satu helper baru). Menyatukannya
ke G1 berarti satu penulis `script.js` dengan empat item bertumpuk. Lebih aman dan lebih mudah ditinjau
bila P5 berdiri sendiri setelah bentuk data dan jalur giliran stabil.

---

## 3. Kontrak per paket (tidak berubah dari revisi 1, diringkas + penajaman)

Kontrak teknis lengkap ada di `2026-10-10-eksekusi-p0-p5-dotbox-design.md` §3–§4 dan lampiran §A.
**Developer mengikuti dokumen itu sebagai otoritas kode.** Yang saya tambahkan di sini hanya bungkus
gelombang dan satu item baru (P4).

### 3.1 p0t (QA) — perbaiki test yang salah
- `test/proposal-p0-p6.test.js:192` (P0-b) masih memakai `getBestMove = function () { return null; }`
  **[TERVERIFIKASI]**. Ganti menjadi `aiEngine.getBestMove = ...`. *P0-a (`:143`) dan P0-c (`:244`)
  sudah benar* **[TERVERIFIKASI]** — jadi perbaikan ini hanya menyentuh **satu baris** (dan komentar
  `:139–142` yang sudah benar untuk P0-a; pastikan komentar P0-b sejalan).
- Gerbang: P0-b **tetap FAIL** tapi sekarang karena alasan yang benar (`makeMove` 0×), bukan karena AI asli
  tetap memilih langkah. Lampirkan keluaran mentah.

### 3.2 p0 (developer) — fallback giliran AI
Persis revisi 1 §3.1 dan lampiran §A.1. Tiga string toast Bahasa Indonesia, deterministik
`Rules.availableMoves(gameState)[0]`, tanpa `setTimeout` baru, `makeMove` tetap satu-satunya penulis papan.
Termasuk pembalikan dua test penjaga bug di `test/bukti-eksekusi.test.js` dan penambahan `sb.Rules`.

### 3.3 p3 (developer) — aksesibilitas
Persis revisi 1 §3.2, spec P3, dan lampiran §A.4/A.5. Enam `aria-label`, viewport tanpa pembatas zoom,
`:focus-visible`, `#liveStatus` (nullable-safe), `prefers-reduced-motion`. **Dilarang** menyentuh
`drawBoard`/`drawBoxes` (K16a).

### 3.4 p6p2s (developer) — Box kanonik + migrasi + pesan galat
Persis revisi 1 §3.3/§3.4 dan lampiran §A.3/A.6. Dua `({ owner: null })`, `buatKandidatState(saveData, alasan?)`
dengan tiga kode, `PESAN_PENOLAKAN`, pembalikan test bentuk Box di `test/bukti-eksekusi.test.js`.

### 3.5 p5 (developer) — HiDPI (G2)
Persis revisi 1 §3.5 dan lampiran §A.7. Satu helper murni `hitungKoordinatPointer`, `pasangUkuranCanvas`,
`hitRadius` tidak diubah, ruang gambar tetap CSS px.

### 3.6 p4 (developer) — Telemetri (G3) · **item baru di revisi ini**

P4 punya **dua bagian** yang boleh satu paket karena keduanya menyentuh `script.js` dan tidak ada yang
lain menyentuhnya di G3 (tidak ada penulis paralel).

**Bagian (a) — hemat tulis save + rapikan audio · berkas: `script.js`**

- **Masalah [TERVERIFIKASI].** `saveGame()` dipanggil di tengah `makeMove` (`script.js:585`) → setiap
  langkah menulis `localStorage` sinkron. `playSound` (`script.js:80–126`) membuat `OscillatorNode`
  baru tiap efek dan tidak pernah memutuskan koneksi.
- **Perubahan yang diminta:** pindahkan tulis save ke **akhir giliran** dan tambahkan penulisan
  penyelamat `beforeunload`. "Akhir giliran" = di akhir `updateUI()` **setelah** perubahan giliran
  diumumkan, dan **tetap** sekali di `initGame`/`resetBoardOnly`/`loadGame` (perilaku lama tetap).
  Audio: pakai ulang satu `AudioContext` (sudah ada), hentikan & putuskan node setelah selesai.
- **Kontrak yang mengikat (K14b):** tidak boleh ada state akhir permainan yang tidak tertulis. Test wajib
  membuktikan: (1) satu langkah penuh → `localStorage.setItem` dipanggil **≤ 1×** untuk pola
  "langkah lalu giliran berakhir" (turn-around), (2) nilai yang tertulis **sama** dengan `gameState`
  terakhir, (3) `beforeunload` menulis sekali lagi.
- **Larangan:** memakai `requestIdleCallback` bila ia menunda tulis melewati akhir giliran; mengubah
  `SCHEMA_VERSION`/`SAVE_KEYS`; menghapus `saveGame()` dari jalur `initGame`.

**Bagian (b) — overlay dev-only · berkas baru: `dev-status.js` (+ satu `<script>` di `index.html`)**

- Aktif **hanya** via `?dev=1`; bila flag tidak ada, modul keluar lebih awal (**nol biaya produksi**,
  nol elemen tambahan di DOM). Kontrak K14a.
- Isi panel (read-only, tidak menyentuh `gameState`): `FPS`, `window.devicePixelRatio`,
  `canvas.width×canvas.height`, `canvas.style.width` (CSS), `viewport`, giliran sekarang, jumlah pemain,
  `SCHEMA_VERSION`, dan **error terakhir** (menangkap `console.error` terakhir, mis. pesan penolakan save
  dari p2s).
- Dimuat **setelah** `script.js` di `index.html` dan **tidak** masuk `test/p1-wiring.test.js` urutan
  kontrak (urutan `rules → turn-queue → ai-engine → script` tidak berubah; `dev-status.js` boleh sesudah
  `script.js`).
- **Test penentu (baru, RED dulu):** `test/dev-status.test.js` — (1) tanpa `?dev=1` modul tidak menambah
  elemen & tidak memanggil `setInterval`; (2) dengan `?dev=1` elemen dibuat dan memuat `devicePixelRatio`.

---

## 4. Review Focus (dilengkapi untuk G2/G3)

Lima baris dari revisi 1 §4 tetap berlaku untuk G1/G2. Dua tambahan untuk **G3 (P4)** — ini input yang
spec proposal diamkan tapi paling mungkin menggigit:

6. **Tab ditutup tepat setelah langkah terakhir sebelum giliran berakhir** → perilaku yang diharapkan:
   save **sudah** memuat langkah itu (karena ditulis di akhir giliran) ATAU `beforeunload` menulisnya.
   → test di **Task p4a** ("nilai tertulis sama dengan gameState terakhir" + "beforeunload menulis").
7. **Halaman dimuat **tanpa** `?dev=1`** → perilaku yang diharapkan: **tidak ada** elemen dev di DOM,
   tidak ada `setInterval` yang menggantung → test di **Task p4b** ("mode normal bersih").

---

## 5. Yang TIDAK diklaim (batas bukti — jangan ditulis "selesai")

Tetap berlaku semua dari revisi 1 §5. Tambahan untuk P4:

- **Overlay P4 bukan jaminan bebas bug**; ia hanya alat diagnosa. Menyalakan `?dev=1` dan melihat panel
  **tidak** membuktikan tidak ada bug di peramban nyata.
- **Penghematan tulis save tidak diukur dalam peramban nyata** (tidak ada profiler di sesi ini); yang
  dibuktikan test adalah **jumlah pemanggilan `setItem`** dan **kebenaran isi**, bukan jeda jank seluler.
- **P7 (E2E peramban)** tetap belum ada → semua yang berjalan **belum** diuji di peramban asli.

---

## 6. Risiko delta (revisi 2)

| Risiko | Dampak | Mitigasi |
|---|---|---|
| G1 melebar (empat item) dan salah satu merah | Gelombang tak pernah tutup | Urutan tegas `p0t→p0→p3→p6p2s`; tiap item punya gerbang test sendiri; QA memverifikasi |
| P4 menunda tulis save | Kehilangan data | **K14b**: tulis di akhir giliran **dan** `beforeunload`; test wajib |
| Overlay P4 bocor ke produksi | Fitur debug terlihat pemain | **K14a**: gate `?dev=1`; test mode-normal-bersih |
| Tim mengerjakan P7 di sela-sela | Menambah dependensi tanpa izin | **K11′**: P7 ditunda penuh, bukan scope; disebut sebagai follow-up |
| Blocker di G3 | Rilis P0–P5 tertahan | **K15**: P4 yang di-drop otomatis, dilaporkan ke CEO |

---

## 7. Urutan & gerbang (ringkas untuk Lead/QA)

| ID | Paket | Agen | Gel. | `depends_on` | Gerbang |
|---|---|---|---|---|---|
| p0t | perbaiki test P0-b | qa | G1 | — | P0-b FAIL karena alasan benar |
| p0 | fallback AI | developer | G1 | p0t | P0-a/b/c hijau; 2 test fallback hijau |
| p3 | aksesibilitas | developer | G1 | p0 | 4 test aksesibilitas hijau; probe grep |
| p6p2s | Box kanonik + migrasi | developer | G1 | p3 | P6-a/b, P2-a..d, p2-sisa hijau |
| p5 | HiDPI | developer | G2 | p6p2s | 3 test DPR hijau |
| p4a | hemat save + audio | developer | G3 | p5 | test setItem + beforeunload hijau |
| p4b | overlay `?dev=1` | developer | G3 | p5 | test mode-normal-bersih + panel muncul |
| QA | verifikasi penuh | qa | — | p0..p4b | `node --test` exit=0; bukti mentah |
| DEVOPS | push `master` | devops | — | QA | push berhasil/cholak dilaporkan; tanpa `--force` |

---

## 8. Utang teknis tercatat (tidak dikerjakan, jangan hilang)

Lead menyetujui keduanya keluar dari scope. **Developer tidak menyentuhnya.** Ditulis di sini supaya
tugas berikutnya bisa mengambilnya.

1. **Overline fokus pemain di `drawBoard`** (`script.js`, rencana lama `02-architect.md` §5 p3a) —
   menggambar penanda pemain yang sedang giliran di kanvas. Dibatalkan karena menyentuh jalur gambar
   yang berisiko visual dan butuh keputusan desain sendiri. **Rencana laskar:** ambil sebagai tugas
   UI tersendiri dengan uji tangkapan kanvas.
2. **`turnQueue.runNow()`** (`turn-queue.js:84–88`) — tidak dipakai test mana pun dan **tidak**
   menjalankan timer host; namanya menjanjikan lebih daripada yang dilakukan. Dianjurkan: rename
   (`flushNow`) atau hapus, sebagai tugas kecil pada modul yang sudah stabil.

---

## 9. Yang saya tahan / masih terbuka

Tidak ada lagi keputusan yang memblokir eksekusi. Dua hal tersisa hanya **informasi**, bukan pertanyaan:

1. **P7 (PWA + E2E Playwright)** — ditunda penuh (K11′). Bila kelak diambil, opsi termurah adalah
   **PWA minimal tanpa Playwright** (`manifest.webmanifest` + service worker cache-first, tanpa build
   step, satu berkas baru + satu `<link>`), sedangkan Playwright memerlukan persetujuan karena menambah
   dependensi uji ke proyek nol dependensi.
2. **Aksesibilitas papan penuh (grid tombol/keyboard, effort L)** — di luar gelombang. P3 di sini hanya
   perbaikan terarah; **memilih garis di papan lewat keyboard/pembaca layar tetap mustahil**. Ini
   keputusan produk (jangkauan pemain vs fitur permainan), bukan keputusan teknis.

---

## 10. Lampiran C — perintah verifikasi untuk G3 (P4), untuk QA

```bash
# gerbang tunggal
node --test

# per paket baru
node --test test/dev-status.test.js        # p4b: mode normal bersih + panel `?dev=1`
node --test test/p4-save-io.test.js        # p4a: jumlah setItem + isi save terakhir + beforeunload

# probe statis
grep -n "saveGame()" script.js                 # harus tetap ada, tapi TIDAK di dalam makeMove
grep -n "createOscillator" script.js           # harus <= 1 lokasi (dipakai ulang, bukan per efek)
grep -n "dev-status.js" index.html             # harus ADA, setelah script.js
grep -rn "?dev=1\|dev=1" dev-status.js         # gate harus terbaca
```

Ekspektasi jujur: perintah di atas **belum dijalankan** oleh saya.

---

Tidak ada rahasia, token, atau kata sandi di dokumen ini.
