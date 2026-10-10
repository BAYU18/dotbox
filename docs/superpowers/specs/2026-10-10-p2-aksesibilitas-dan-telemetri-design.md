# Rancangan P3 (Aksesibilitas) + P4 (Telemetri/Kesehatan) — Proyek `dotbox`

**Tanggal:** 2026-10-10
**Penulis:** Architect (paket **p2** — riset & rancangan)
**Workspace:** `/home/serverbot/aidev/workspace/worktrees/dotbox/20261010-214601`
**Branch:** `babd/20261010-214601`
**Peran dokumen:** **masukan** untuk penulis proposal akhir p4 (`PROPOSAL-PENGEMBANGAN-DOTBOX.md`), dan **spesifikasi** yang bisa langsung dieksekusi `developer` serta diverifikasi `qa`.
**Bukan** dokumen final untuk CEO — itu milik p4.

> **Aturan kejujuran dokumen ini (ADR-0002).** Setiap klaim diberi salah satu dari dua tanda:
> **`[TERVERIFIKASI]`** = penulis sudah membaca baris kode persisnya di branch ini (sitasi `berkas:baris`)
> atau ada pencarian repo yang membuktikannya.
> **`[ASUMSI]`** = rancangan/prediksi yang **belum dijalankan**. Warna hijau/merah sebuah test adalah
> milik `developer`/`qa` yang menjalankannya, **bukan** diklaim di sini. Penulis p2 **tidak punya akses shell**
> di langkah ini; tidak ada `node --test` yang dijalankan oleh penulis.

---

## 0. Ringkasan p2 untuk penulis p4 (yang harus masuk ke proposal akhir)

1. **Aksesibilitas bukan "lima tombol" tapi defisit sistemik.** `[TERVERIFIKASI]` Pencarian repo
   `aria-\|role=\|:focus\|tabindex` → **0 hasil**; `style.css` juga **tanpa** aturan `:focus`,
   `:focus-visible`, `@media (prefers-reduced-motion)`, atau `.sr-only`. Jadi perbaikannya harus
   sapuan repo, bukan tambalan satu-dua tombol.
2. **Tiga tindakan aksesibilitas berstatus `[TERVERIFIKASI]` (defisit terbukti baris):** hapus
   `user-scalable=no` (`index.html:5`), sapu `aria-label` (minimal `:15`, `:94–97`, `:108`, `:81–84`),
   tambah gaya `:focus-visible`.
3. **Dua tindakan aksesibilitas berstatus `[ASUMSI]` (rancangan, belum dijalankan):** ARIA live region
   untuk giliran/skor, dan `prefers-reduced-motion` untuk animasi.
4. **P4 (dev-overlay status) murni `[ASUMSI]`** dan **sengaja dibuat tersembunyi di balik flag `?dev=1`**;
   usulan ini **bukan** fitur pemain — nilainya adalah alat diagnosa untuk `qa`/`developer`, terutama
   untuk melihat `devicePixelRatio` (temuan A3 lintas-paket) di perangkat nyata.
5. **Temuan baru p2:** tidak ada satu pun `@media` di `style.css` `[TERVERIFIKASI]` — berarti
   `prefers-reduced-motion` **dan** penyesuaian tata letak layar kecil sama-sama belum ada.

---

## 1. Konteks & metode

### 1.1 Ruang lingkup paket p2
Team Lead memecah usulan menjadi lima paket paralel. p2 bertanggung jawab atas **rancangan**:

- **P3 — Aksesibilitas:** navigasi keyboard pada permainan canvas, ARIA live untuk giliran/skor,
  `prefers-reduced-motion`, dan penanganan `devicePixelRatio` untuk input sentuh di layar DPI tinggi.
- **P4 — Telemetri/Kesehatan:** rancangan panel status (dev-overlay).

p4 menulis `PROPOSAL-PENGEMBANGAN-DOTBOX.md` (sudah ada di branch), p5 memverifikasi independen.
Maka dokumen ini adalah **masukan bukti + rancangan** yang dilipat p4, bukan proposal final.

### 1.2 Status verifikasi (hasil QA + pembacaan ulang penulis)

QA sudah menjawab pertanyaan p2 pada commit `74dc26f`. Tabel berikut memakai hasil itu **sebagai
pemeriksaan otoritatif**, ditambah pembacaan ulang baris persis oleh penulis p2 di branch ini.

| Klaim | Hasil | Bukti |
|---|---|---|
| `user-scalable=no` di `index.html:5` | **TERVERIFIKASI** | `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">` |
| Tombol tanpa `aria-label` di `index.html:15` | **TERVERIFIKASI** | `<button id="darkModeToggle" class="icon-btn" title="Toggle Dark Mode">` — hanya `title` |
| Blok replay tanpa `aria-label` di `index.html:94–97` | **TERVERIFIKASI** | `▶️ Play`, `⏮️`, `⏭️`, `❌` tanpa `aria-label` |
| `#playAgainBtn` (`index.html:108`) tanpa `aria-label` | **TERVERIFIKASI** | `<button id="playAgainBtn" class="btn-primary">🎮 Main Lagi</button>` |
| Pencarian repo `aria-label` | **TERVERIFIKASI** | **0 hasil** (juga untuk `role=`, `:focus`, `tabindex`) |
| `devicePixelRatio` di hit-test | **ASUMSI (klaim lama dianggap SALAH)** | `script.js:436-438`, `:450-453` memakai `getBoundingClientRect()` tapi **tidak pernah** menyentuh `devicePixelRatio` |

### 1.3 Satu koreksi & satu pertanyaan terbuka
- **Koreksi:** pernyataan "hit-test sudah memperhitungkan `devicePixelRatio`" **salah** dan harus
  ditandai **`[ASUMSI]`**, bukan temuan. Bukti tekstualnya: kata `devicePixelRatio` tidak muncul di
  handler; koordinat dihitung dengan `clientX - rect.left` (CSS px) dan `hitRadius = 30`
  (`script.js:460`, juga CSS px).
- **Pertanyaan terbuka (`ASK: developer`):** apakah koordinat CSS px itu di-scale balik ke backing
  store yang DPR-aware? p3/QA sudah menanyakan hal yang sama. **Rancangan P5 di bawah sengaja tidak
  menyentuh DPR sampai jawaban itu ada** — kalau `canvas.width` sudah DPR-aware *dengan* transform
  balik, hit-test sekarang justru **benar** dan tidak ada yang perlu diubah.

---

## 2. Praktik terkini (sumber yang bisa dicek)

### 2.1 Navigasi keyboard pada permainan canvas
Elemen `<canvas>` tidak fokusable secara native, tidak mengekspos anak ke accessibility tree, dan
menggambar primitif yang tidak bisa dibaca screen reader
([MDN — Canvas accessibility, diakses 2026-10-10](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas#accessibility)).
Praktik terbaik: bangun **lapisan kontrol DOM paralel** — grid `<button>` nyata yang mencerminkan
keadaan papan dan memicu aksi yang sama ([WebAIM — Accessibility of Canvas, diakses 2026-10-10](https://webaim.org/articles/accessibility-of-canvas/)).
Pola konkret untuk papan titik seperti dotbox:
- **Roving tabindex** pada grid (satu stop Tab untuk seluruh grid, panah di dalamnya) mengurangi
  jumlah tab stop dan meniru semantik grid. Kalau grid dibuat `<div role="grid">`, pola roving
  tabindex adalah rekomendasi resmi ([WAI-ARIA APG — Grid pattern, diakses 2026-10-10](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)).
- **Navigasi panah + tombol "pilih/commit"** adalah pengganti standar klik pointer
  ([WebAIM, diakses 2026-10-10](https://webaim.org/articles/accessibility-of-canvas/)).
- Indikator fokus harus terlihat; jangan hapus `outline` tanpa pengganti
  ([WCAG 2.2 SC 2.4.7 / 2.4.11, diakses 2026-10-10](https://www.w3.org/WAI/WCAG22/quickref/)).

> **Catatan jujur untuk dotbox.** Grid tombol dotbox **belum ada sama sekali** — papan digambar
> seluruhnya di canvas. Karena itu, aksesibilitas penuh (setara main penuh via keyboard) termasuk
> pekerjaan **L**, bukan S. Lihat §3 untuk pemecahannya menjadi langkah kecil.

### 2.2 ARIA live region untuk giliran & skor
Perubahan giliran/skor itu asinkron. `aria-live="polite"` + `role="status"` adalah teknik standar
untuk mengumumkannya tanpa merebut fokus
([WAI-ARIA APG — Alert & Status, diakses 2026-10-10](https://www.w3.org/WAI/ARIA/apg/patterns/alert/)).
Karena UI dotbox beremoji, pengumuman harus **teks**, bukan emoji — screen reader bisa membaca "▶️"
sebagai "tombol putar" atau melewatkannya. Region tersembunyi (`class="sr-only"`) yang menerima teks
seperti `"Giliran Pemain 2. Skor 3–2."` adalah rancangan yang direkomendasikan.

### 2.3 `prefers-reduced-motion`
Pengguna dengan gangguan vestibular harus bisa memilih keluar dari animasi
([MDN — prefers-reduced-motion, diakses 2026-10-10](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)).
Kaidah relevan: WCAG 2.2 SC 2.3.3 (Animation from Interactions, AAA) dan SC 2.2.2 (Pause, Stop, Hide, A)
([W3C WCAG 2.2, diakses 2026-10-10](https://www.w3.org/WAI/WCAG22/quickref/)).

### 2.4 `devicePixelRatio` & input sentuh di layar DPI tinggi
Di layar high-DPI, `devicePixelRatio` biasanya 2 atau 3. Bila canvas diberi ukuran CSS px tetapi
`canvas.width` diset sama, hasilnya **buram**. Perbaikannya: set backing store ke `cssWidth * dpr`
lalu `ctx.scale(dpr, dpr)`
([MDN — devicePixelRatio, diakses 2026-10-10](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio)).
**Penting:** begitu konteks di-scale, koordinat pointer CSS px dari `getBoundingClientRect()` **sudah
selaras** dengan ruang gambar — **tidak perlu** pembagian `devicePixelRatio` manual di hit-test.
Inilah kenapa temuan QA penting: hit-test dotbox memakai CSS px, dan benar/salahnya **bergantung
sepenuhnya** pada apakah backing store DPR-aware. Ini persis pertanyaan terbuka ke `developer`.

### 2.5 Skala viewport (`user-scalable=no`)
WCAG 2.2 SC 1.4.4 (Resize Text, AA) & SC 1.4.10 (Reflow, AA) praktis melarang menonaktifkan
pinch-zoom; panduan aksesibilitas utama menyarankan **menghapus `user-scalable=no` dan
`maximum-scale=1.0`** ([W3C WCAG 2.2, diakses 2026-10-10](https://www.w3.org/WAI/WCAG22/quickref/);
[WebAIM, diakses 2026-10-10](https://webaim.org/articles/accessibility-of-canvas/)). Versi
Android/iOS modern juga mengabaikan `user-scalable=no` demi aksesibilitas.

---

## 3. Usulan konkret untuk dotbox

### 3.1 Usulan A — Perbaikan viewport (`index.html:5`) — `[TERVERIFIKASI]` defisit

```html
<!-- SEKARANG -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">

<!-- USULAN -->
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```
Menghapus `maximum-scale=1.0` + `user-scalable=no` memulihkan pinch-zoom (SC 1.4.4 / 1.4.10).
**Tanda verifikasi:** baris diperbaiki di artefak; uji manual di ponsel → zoom bekerja.

### 3.2 Usulan B — Sapuan `aria-label` pada tombol — `[TERVERIFIKASI]` defisit

Defisit **global** (`grep aria-label` = 0). Tabel berikut daftar minimum; sapuan harus mencakup
seluruh tombol beremoji.

| Lokasi | Sekarang | Usulan `aria-label` |
|---|---|---|
| `index.html:15` | `#darkModeToggle`, hanya `title="Toggle Dark Mode"` | `aria-label="Ganti mode gelap"` |
| `index.html:94` | `#replayPlayPause` — `▶️ Play` | `aria-label="Putar atau jeda replay"` |
| `index.html:95` | `#replayPrev` — `⏮️` | `aria-label="Langkah replay ke belakang"` |
| `index.html:96` | `#replayNext` — `⏭️` | `aria-label="Langkah replay ke depan"` |
| `index.html:97` | `#replayClose` — `❌` | `aria-label="Tutup replay"` |
| `index.html:108` | `#playAgainBtn` — `🎮 Main Lagi` | `aria-label="Main lagi"` |
| `index.html:27,29,36,38,54,56` | tombol `-` / `+` selektor angka | `aria-label="Kurangi <nama>"/"Tambah <nama>"` (atau `aria-labelledby` ke `<label>` terkait) |
| `index.html:81–84` | `🔄 New Game`, `↩️ Reset Board`, `▶️ Continue`, `📹 Replay` | `aria-label` teks murni untuk tiap tombol |

`title` **bukan** pengganti `aria-label`; perhitungan accessible name mendahulukan `aria-label`,
tetapi `title` tidak andal antar-assistive-tech
([WAI-ARIA APG — Names and descriptions, diakses 2026-10-10](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/)).
**Tanda verifikasi:** `grep -rn aria-label index.html` > 0; screen reader membacakan nama tombol.

### 3.3 Usulan C — Indikator fokus yang terlihat (`style.css`) — `[TERVERIFIKASI]` defisit

`style.css` **tidak punya** aturan `:focus`/`:focus-visible` (pencarian repo → 0 hasil).
```css
:focus-visible {
    outline: 3px solid var(--accent-primary);
    outline-offset: 2px;
}
```
**Tanda verifikasi:** menekan Tab memperlihatkan cincin fokus pada setiap tombol.

### 3.4 Usulan D — ARIA live region untuk giliran/skor — `[ASUMSI]` (rancangan)

Titik sisip di `script.js:updateUI()` (`:698-717`) yang sudah dipanggil pada setiap perubahan giliran.
```html
<!-- index.html, di dalam .container -->
<div id="liveStatus" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>
```
```css
/* style.css */
.sr-only {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}
```
```js
/* script.js, dipanggil di akhir updateUI() */
function announceTurn() {
    const el = document.getElementById('liveStatus');
    if (!el) return; // tetap aman di lingkungan test tanpa DOM
    const p = gameState.players[gameState.currentPlayerIndex];
    el.textContent = `Giliran ${p.name}. Skor ${gameState.scores.join('–')}.`;
}
```
`role="status"` sudah menyiratkan `aria-live="polite"`; kombinasinya valid.
**Tanda verifikasi:** QA melakukan walkthrough layar pembaca (NVDA/VoiceOver) — perubahan giliran
diumumkan tanpa kehilangan fokus. **Ini belum dijalankan; tandai `[ASUMSI]`.**

### 3.5 Usulan E — `prefers-reduced-motion` — `[ASUMSI]` (rancangan)

`style.css` tidak punya `@media` sama sekali (`[TERVERIFIKASI]`). Animasi dotbox adalah
`--transition-*` (`style.css:38-40`) dan replay berjadwal tetap **600 ms** di
`script.js:997-1010` (`setTimeout(playReplay, 600)` di `:1005`).
```css
@media (prefers-reduced-motion: reduce) {
    * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
```
Untuk replay, hormati preferensi di JS:
```js
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
// jeda antar langkah replay: reduceMotion ? 0 : JEDA_NORMAL
```
**Tanda verifikasi:** QA mengaktifkan setelan OS reduced-motion → replay selesai tanpa animasi.

### 3.6 Usulan F — Dev-overlay status (P4) — `[ASUMSI]` (rancangan)

Panel **dev-only** di balik flag URL `?dev=1`, tidak pernah tampil di mode normal:
```
FPS | dpr | canvas {w×h} | viewport {w×h} | giliran | pemain | error terakhir | version save
```
- Menampilkan `window.devicePixelRatio` dan `canvas.width/height` berdampingan supaya `qa` bisa
  **menjawab pertanyaan terbuka §1.3 di perangkat nyata** (ini nilai utama P4).
- Mencatat `console.error` terakhir (mis. `script.js:866,:874` sudah menulis pesan penolakan save)
  sebagai "error terakhir" agar kegagalan load-save terlihat, bukan tersembunyi.
- Dipisah sebagai modul kecil `dev-status.js` yang dimuat **setelah** `script.js` dan **tidak**
  menyentuh state permainan (read-only terhadap `window.gameState`).
- Bila `?dev=1` tidak ada, modul keluar lebih awal (`return`) — nol biaya produksi.
**Tanda verifikasi:** `index.html?dev=1` menampilkan panel; tanpa flag, tidak ada elemen tambahan.

### 3.7 Usulan G — Grid kontrol keyboard (navigasi canvas) — `[ASUMSI]`, effort **L**

Ini item terbesar dan **tidak** boleh masuk gesekan P3 cepat. Rancangan bertahap:
1. **Langkah 1 (S):** `canvas` diberi `tabindex="0"`, `role="application"`, `aria-label="Papan Dots and Boxes"`,
   dan handler panah yang memindahkan "kursor" garis terpilih; Enter/Space memilih. `aria-label`
   diperbarui saat kursor bergerak ("Garis horizontal baris 2 kolom 3").
2. **Langkah 2 (M):** petakan seleksi ke `makeMove(type,row,col)` yang **sudah menerima** gerakan
   terprogram (`script.js:526`) — tidak perlu jalur baru.
3. **Langkah 3 (L, opsional):** grid `<button>` paralel `role="grid"` + roving tabindex bila
   step 1–2 belum cukup untuk screen reader.
**Ketergantungan:** step 1–2 bergantung pada `makeMove` yang stabil (sudah ada) dan **tidak**
bergantung pada P1.

---

## 4. Matriks prioritas p2

| # | Item | Dampak | Effort | Status | Tanda verifikasi |
|---|---|---|---|---|---|
| A | Hapus `user-scalable=no` (`index.html:5`) | Tinggi (WCAG AA) | S | TERVERIFIKASI defisit | baris diperbaiki; pinch-zoom jalan |
| B | Sapuan `aria-label` (`:15`,`:94–97`,`:108`,`:81–84`, repo) | Tinggi | S–M | TERVERIFIKASI defisit | `grep aria-label` > 0 |
| C | `:focus-visible` di `style.css` | Tinggi | S | TERVERIFIKASI defisit | Tab memperlihatkan cincin fokus |
| D | ARIA live giliran/skor | Tinggi | M | ASUMSI | diumumkan via NVDA/VoiceOver |
| E | `prefers-reduced-motion` | Sedang | S | ASUMSI | replay tanpa animasi |
| F | Dev-overlay status (P4) | Sedang (kualitas dev) | M | ASUMSI | `?dev=1` menampilkan panel |
| G | Grid kontrol keyboard (canvas) | Tinggi | L | ASUMSI | main penuh via keyboard saja |

**Urutan rekomendasi untuk proposal:** **C → A → B → D → E → F → G**.
Alasan: C/A/B adalah perbaikan murah yang defisitnya sudah terbukti baris (paling mudah
dipertanggungjawabkan); D/E/F rancangan; G pekerjaan besar yang sebaiknya ditahan setelah P1–P2
proposal utama stabil.

---

## 5. Keputusan yang sudah diambil (p2) & yang masih terbuka

**Ruling p2 (diputuskan, tidak menunggu CEO):**
1. **R1 — Perbaikan aksesibilitas "murah" dipisah dari "kanvas penuh".** A/B/C masuk jalur cepat
   (S–M, defisit terverifikasi); G ditandai L dan ditahan. Ini menaati `codebase-design`:
   pecah antarmuka besar menjadi langkah kecil yang dapat diuji sendiri.
2. **R2 — P4 adalah alat diagnosa, bukan fitur.** Selalu di balik `?dev=1`, read-only, tidak
   menyentuh state permainan. Dipisah jadi modul sendiri (`dev-status.js`) agar tidak menambah
   beban `script.js`.
3. **R3 — Rancangan DPR (P5) tidak diimplementasikan oleh p2.** p2 hanya mencatat pertanyaan
   terbuka §1.3; mengubah DPR tanpa jawaban berisiko merusak hit-test yang sudah benar.
4. **R4 — Semua string `aria-label` dalam Bahasa Indonesia**, konsisten dengan `lang="id"`
   (`index.html:2`) dan label UI yang sudah berbahasa Indonesia.

**Masih terbuka untuk `developer`/`qa` (bukan CEO):**
- Q-DPR (§1.3): apakah `canvas.width` di-scale balik? Menentukan apakah P5 itu perbaikan atau bukan.
- Q-FOCUS: apakah fokus harus dipulihkan ke `#gameCanvas` setelah modal game-over ditutup?
  (Rekomendasi p2: ya, ke tombol pemicu, sebagai bagian dari G step 1.)

**Terbuka untuk CEO (keputusan bisnis):**
- Prioritas: apakah aksesibilitas (G) dikerjakan sekarang demi jangkauan pemain, atau ditunda
  demi fitur permainan baru? Ini pilihan produk, bukan teknis.

---

## 6. Lampiran: perintah verifikasi (belum dijalankan oleh p2)

> p2 **tidak punya akses shell**; perintah di bawah adalah yang **harus** dijalankan
> `developer`/`qa` dan dilampirkan keluaran mentahnya.

```bash
# 1. Defisit aksesibilitas (harapan SEKARANG: 0 hasil untuk aria/role/focus/tabindex)
grep -rn "aria-label\|role=\|:focus\|tabindex" index.html style.css script.js

# 2. Setelah Usulan A/B/C (harapan: > 0 hasil)
grep -rn "aria-label" index.html
grep -rn ":focus-visible" style.css

# 3. Regresi suite (setelah perubahan apa pun)
node --test test/*.test.js
```

**Catatan lintas-paket (dari p3, jangan salah tafsir):** `node --test` **polos** saat ini
menghasilkan **4 fail** yang **hanya** berasal dari `test/save-schema.test.js` (P2 versioning belum
diimplementasikan). **Bukan** regresi aksesibilitas. Suite baseline: **43/43 hijau**
(`docs/bukti/output-node-test.txt`).

---

## 6bis. Hubungan dengan `PROPOSAL-PENGEMBANGAN-DOTBOX.md` (p4) — batas paket

`PROPOSAL-PENGEMBANGAN-DOTBOX.md` **sudah ada** di branch ini dan **sudah memuat ringkasan P3**
(`PROPOSAL-PENGEMBANGAN-DOTBOX.md:78`, `:148-160`: viewport + `aria-label` + fokus, beserta usulan
test statis). Maka **p2 tidak menulis ulang proposal** (itu paket p4 dan dilarang diduplikasi).

Yang **p2 tambahkan** untuk dilipat p4 (bukan pengganti):
- Rancangan **P4 dev-overlay** yang **belum ada** di proposal p4 (p2 §3.6) — beserta alasan nilainya
  (menjawab pertanyaan terbuka DPR di perangkat nyata).
- Detail **`:focus-visible`** sebagai defisit `style.css` yang terbukti 0 hasil (p2 §3.3).
- Tangga **grid kontrol keyboard** (p2 §3.7 / Usulan G) yang di proposal p4 belum dirinci.
- Koreksi nada pada DPR: **hit-test DPR tetap `[ASUMSI]`**, jangan ditulis sebagai cacat
  (selaras dengan jawaban `developer` di paket p1: `getBestMove()===null` ⟺ papan penuh, jadi
  `script.js:746` adalah **hardening/assertion**, bukan "AI menyerah saat langkah legal ada").

**Keputusan p2:** tidak mengubah `PROPOSAL-PENGEMBANGAN-DOTBOX.md` agar tidak bertabrakan dengan
penulis p4. p5 (QA) memverifikasi keduanya.

---

## 7. Risiko untuk agen berikutnya

1. **Jangan klaim P4/P3 "selesai".** Semua item D–G `[ASUMSI]` sampai ada keluaran test/walkthrough.
2. **`aria-label` saja tidak membuat game bisa dimainkan screen reader.** Tanpa B **dan** G, penanda
   hanya membuat tombol *terbaca*; memilih garis di canvas tetap tak mungkin. Proposal harus jujur
   soal ini.
3. **Perubahan `style.css` menyentuh tata letak `@media` yang belum ada.** Menambahkan aturan
   `:focus-visible` aman; menambahkan `@media` baru harus diuji di lebar layar kecil agar tidak
   merusak tata letak mobile (yang kini bertumpu pada `user-scalable`).
4. **Dev-overlay jangan ikut ter-ship terlihat.** Wajib `?dev=1`; QA mengecek mode normal bersih.

---

## Referensi (tanggal akses 2026-10-10)

- MDN Web Docs. *The Canvas element — Accessibility.* https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas#accessibility
- MDN Web Docs. *Window: devicePixelRatio property.* https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
- MDN Web Docs. *prefers-reduced-motion.* https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- W3C. *WAI-ARIA Authoring Practices Guide — Alert and Status patterns.* https://www.w3.org/WAI/ARIA/apg/patterns/alert/
- W3C. *WAI-ARIA Authoring Practices Guide — Grid (Interactive Tabular Data) Pattern.* https://www.w3.org/WAI/ARIA/apg/patterns/grid/
- W3C. *WAI-ARIA Authoring Practices Guide — Accessible Names and Descriptions.* https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/
- W3C. *Web Content Accessibility Guidelines (WCAG) 2.2 — Quick Reference.* https://www.w3.org/WAI/WCAG22/quickref/
- WebAIM. *Accessibility of Canvas.* https://webaim.org/articles/accessibility-of-canvas/
