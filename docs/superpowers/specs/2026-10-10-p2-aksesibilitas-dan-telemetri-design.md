# Rancangan P3 (Aksesibilitas) + P4 (Telemetri/Kesehatan) — Proyek `dotbox` — REVISI 4 (final)

**Tanggal:** 2026-10-10
**Penulis:** Architect (paket **p2** — riset & rancangan)
**Workspace:** `/home/serverbot/aidev/workspace/worktrees/dotbox/20261010-214601`
**Branch:** `babd/20261010-214601`
**Peran dokumen:** **masukan bukti + spesifikasi eksekusi** untuk proposal akhir p4
(`PROPOSAL-PENGEMBANGAN-DOTBOX.md`) dan untuk `developer`. **Bukan** dokumen final untuk CEO — itu milik p4.
**Status revisi:** revisi ke-4 menambahkan §0bis (koreksi bukti), §3.8 (spesifikasi test statis `aria`),
dan §4bis (uji DPR yang dapat dijalankan tanpa perangkat Retina).

> **Aturan kejujuran dokumen ini (ADR-0002).** Setiap klaim diberi salah satu dari tiga tanda:
> **`[VERIFIED]`** = penulis sudah **membaca baris kode persisnya di branch ini** (sitasi `berkas:baris`)
> atau ada pencarian repo yang membuktikannya. **`[ASUMSI]`** = rancangan/prediksi yang **belum dijalankan**;
> warna hijau/merah sebuah test adalah milik `developer`/`qa` yang menjalankannya, **bukan** diklaim di sini.
> **`[SITASI]`** = keluaran perintah milik agen lain yang penulis **baca dari berkas bukti** (sumber disebut).
> Penulis p2 **tidak punya akses shell** di langkah ini; tidak ada `node --test` yang dijalankan oleh penulis.

---

## 0bis. Koreksi bukti pada revisi ini (hal-hal yang di draf sebelumnya SALAH)

1. **`style.css` TIDAK tanpa `@media`.** Draf sebelumnya menulis "tidak ada satu pun `@media` di
   `style.css`" — itu **salah**. Yang benar `[VERIFIED]`: ada **dua** `@media`, yaitu
   `style.css:593` `@media (max-width: 400px)` dan `style.css:618` `@media (hover: none)`.
   Yang memang **tidak ada** `[VERIFIED]` adalah `@media (prefers-reduced-motion)` dan aturan
   `:focus`/`:focus-visible`/`.sr-only` (pencarian `focus-visible|:focus|sr-only|prefers-reduced`
   di `style.css` → **0 hasil**). Kesimpulan usulan D/E **tidak berubah**, tetapi alasan
   "belum ada `@media` sama sekali" harus dicabut.
2. **Hit-test `devicePixelRatio` — sekarang `[VERIFIED]` sebagai *inert*, bukan lagi `[ASUMSI]`.**
   Penulis mencari `devicePixelRatio|dpr|setTransform|ctx.scale` di `script.js` → **0 hasil**;
   `canvas.width` ditulis langsung dalam CSS px (`script.js:206`/`:224`) tanpa `ctx.scale`.
   Karena rasio bitmap:CSS saat ini **1:1**, hit-test CSS px **konsisten** dan `hitRadius = 30`
   (`script.js:470`) **tidak meleset**. Jadi tidak ada bug hit-test aktif (ini **bukan** temuan
   cacat), tetapi juga bukan lagi "asumsi DPR diperhitungkan" — **DPR tidak diperhitungkan sama
   sekali**; yang menjadi asumsi hanyalah **ketajaman visual** di perangkat Retina nyata.
   Lihat §3.9 untuk uji yang membedakan keduanya tanpa perangkat mahal.
3. **Prioritas baris lama vs sekarang.** Semua nomor di brief lama sudah tidak berlaku:
   `index.html:5/:15/:94-97` **masih sama** (index.html tidak berubah), tetapi
   `script.js:436-438` → **`:446-448`**, `:450-453` → **`:460-463`**, `hitRadius` `:460` → **`:470`**,
   `devicePixelRatio` `:460` → **`:470`**, `saveGame` di `makeMove` `:575` → **`:585`**,
   `Box.edges` `:142` → **`:152-157`**, `rules.js:41` → **`rules.js:42`**,
   fallback AI `:746` → **`:756`** (P4 di brief = **P0** di proposal p4), `:756` skema save → **`:768`**.

---

## 0. Ringkasan p2 untuk penulis p4 (yang harus masuk ke proposal akhir)

1. **Aksesibilitas bukan "lima tombol" tapi defisit sistemik.** `[VERIFIED]` Pencarian repo
   `aria-\|role=\|:focus\|tabindex\|prefers-reduced\|sr-only` di `index.html`+`style.css` → **0 hasil**.
   Jadi perbaikannya harus sapuan repo, bukan tambalan satu-dua tombol.
2. **Tiga tindakan aksesibilitas berstatus `[VERIFIED]` (defisit terbukti baris):** hapus
   `user-scalable=no` (`index.html:5`), sapu `aria-label` (minimum `:15`, `:94–97`, `:108`, `:81–84`,
   `:27/:29/:36/:38/:54/:56`), tambah gaya `:focus-visible` (`style.css`).
3. **Dua tindakan aksesibilitas berstatus `[ASUMSI]` (rancangan, belum dijalankan):** ARIA live region
   untuk giliran/skor, dan `prefers-reduced-motion` untuk animasi replay
   (`script.js:1037` `setTimeout(playReplay, 600)`).
4. **P4 (dev-overlay status) murni `[ASUMSI]`** dan **sengaja dibuat tersembunyi di balik flag `?dev=1`**;
   usulan ini **bukan** fitur pemain — nilainya adalah alat diagnosa untuk `qa`/`developer`, terutama
   untuk melihat `devicePixelRatio` vs `canvas.width` di perangkat nyata (§3.9).
5. **Yang benar-benar memblokir pemain pembaca layar bukan tombol, melainkan papan.** Papan digambar
   seluruhnya di `<canvas id="gameCanvas">` (`index.html:76`) dan **tidak** punya `tabindex`,
   `role`, atau padanan DOM. Tanpa Usulan G, `aria-label` hanya membuat tombol *terbaca*, sementara
   **memilih garis tetap mustahil**. Proposal harus menyatakan ini apa adanya.

---

## 1. Konteks & metode

### 1.1 Ruang lingkup paket p2

Team Lead memecah usulan menjadi lima paket paralel. p2 bertanggung jawab atas **rancangan**:

- **P3 — Aksesibilitas:** navigasi keyboard pada permainan canvas, ARIA live untuk giliran/skor,
  `prefers-reduced-motion`, dan penanganan `devicePixelRatio` untuk input sentuh di layar DPI tinggi.
- **P4 — Telemetri/Kesehatan:** rancangan panel status (dev-overlay).

p4 menulis `PROPOSAL-PENGEMBANGAN-DOTBOX.md` (sudah ada di branch), p5 memverifikasi independen.
Maka dokumen ini adalah **masukan bukti + rancangan** yang dilipat p4, bukan proposal final.

### 1.2 Status verifikasi — dibaca ulang baris-per-baris oleh penulis p2 pada revisi ini

| Klaim | Hasil | Bukti |
|---|---|---|
| `user-scalable=no` di `index.html:5` | **`[VERIFIED]`** | `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">` |
| Tombol tanpa `aria-label` di `index.html:15` | **`[VERIFIED]`** | `<button id="darkModeToggle" class="icon-btn" title="Toggle Dark Mode">` — hanya `title` |
| Blok replay tanpa `aria-label` di `index.html:94–97` | **`[VERIFIED]`** | `▶️ Play`, `⏮️`, `⏭️`, `❌` tanpa `aria-label` |
| `#playAgainBtn` (`index.html:108`) tanpa `aria-label` | **`[VERIFIED]`** | `<button id="playAgainBtn" class="btn-primary">🎮 Main Lagi</button>` |
| Tombol kontrol `:81–84` tanpa `aria-label` | **`[VERIFIED]`** | `🔄 New Game`, `↩️ Reset Board`, `▶️ Continue`, `📹 Replay` (`.btn-control`) |
| Pencarian repo `aria-label` / `role=` / `:focus` / `tabindex` | **`[VERIFIED]`** | **0 hasil** di `index.html` + `style.css` |
| `@media` di `style.css` | **`[VERIFIED]`** | **ADA** — `style.css:593` `(max-width: 400px)`, `style.css:618` `(hover: none)` |
| `@media (prefers-reduced-motion)` & `:focus-visible` & `.sr-only` | **`[VERIFIED]`** | **0 hasil** (pencarian di `style.css`) |
| `devicePixelRatio` / `ctx.scale` di `script.js` | **`[VERIFIED]` (inert)** | **0 hasil**; `canvas.width` ditulis CSS px langsung (`script.js:206`, `:224`); hit-test CSS px (`:446-448`, `:460-463`); `hitRadius = 30` (`:470`) |
| Papan tidak punya padanan DOM/fokus | **`[VERIFIED]`** | `<canvas id="gameCanvas"></canvas>` (`index.html:76`) tanpa `tabindex`/`role` |
| Jeda animasi replay | **`[VERIFIED]`** | `script.js:1037` `setTimeout(playReplay, 600)` |
| `saveGame()` tiap langkah | **`[VERIFIED]`** | `script.js:585` (di dalam `makeMove`); juga `:187` (`initGame`), `:704` (`saveGameHistory`) |
| Skema `Box` ganda | **`[VERIFIED]`** | `rules.js:42` `{ owner: null }` vs `script.js:152–157` `{ owner, edges:{...} }` |
| Fallback AI `null` | **`[VERIFIED]`** | `script.js:756` `if (!move) return;` |

---

## 2. Praktik terkini (sumber yang bisa dicek, tanggal akses 2026-10-10)

### 2.1 Navigasi keyboard pada permainan canvas

Elemen `<canvas>` tidak fokusable secara native, tidak mengekspos anak ke accessibility tree, dan
menggambar primitif yang tidak bisa dibaca screen reader
([MDN — Canvas accessibility, diakses 2026-10-10](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas#accessibility)).
Praktik terbaik: bangun **lapisan kontrol DOM paralel** — grid `<button>` nyata yang mencerminkan
keadaan papan dan memicu aksi yang sama ([WebAIM — Accessibility of Canvas, diakses 2026-10-10](https://webaim.org/articles/accessibility-of-canvas/)).
Pola konkret untuk papan titik seperti dotbox:

- **Roving tabindex** pada grid (satu stop Tab untuk seluruh grid, panah di dalamnya) mengurangi
  jumlah tab stop dan meniru semantik grid ([WAI-ARIA APG — Grid pattern, diakses 2026-10-10](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)).
- **Navigasi panah + tombol "pilih/commit"** adalah pengganti standar klik pointer
  ([WebAIM, diakses 2026-10-10](https://webaim.org/articles/accessibility-of-canvas/)).
- Indikator fokus harus terlihat; jangan hapus `outline` tanpa pengganti
  ([WCAG 2.2 SC 2.4.7 / 2.4.11, diakses 2026-10-10](https://www.w3.org/WAI/WCAG22/quickref/)).

> **Catatan jujur untuk dotbox.** Grid tombol dotbox **belum ada sama sekali** — papan digambar
> seluruhnya di canvas (`index.html:76`). Karena itu aksesibilitas penuh (main penuh via keyboard)
> termasuk pekerjaan **L**, bukan S. §3.7 memecahnya menjadi tiga langkah kecil.

### 2.2 ARIA live region untuk giliran & skor

Perubahan giliran/skor itu asinkron. `aria-live="polite"` + `role="status"` adalah teknik standar
untuk mengumumkannya tanpa merebut fokus
([WAI-ARIA APG — Alert & Status, diakses 2026-10-10](https://www.w3.org/WAI/ARIA/apg/patterns/alert/)).
Karena UI dotbox beremoji, pengumuman harus **teks**, bukan emoji. Region tersembunyi
(`class="sr-only"`) yang menerima teks seperti `"Giliran Pemain 2. Skor 3–2."` adalah rancangan yang
direkomendasikan.

### 2.3 `prefers-reduced-motion`

Pengguna dengan gangguan vestibular harus bisa memilih keluar dari animasi
([MDN — prefers-reduced-motion, diakses 2026-10-10](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)).
Kaidah relevan: WCAG 2.2 SC 2.3.3 (AAA) dan SC 2.2.2 (A)
([W3C WCAG 2.2, diakses 2026-10-10](https://www.w3.org/WAI/WCAG22/quickref/)).

### 2.4 `devicePixelRatio` & input sentuh di layar DPI tinggi

Di layar high-DPI, `devicePixelRatio` biasanya 2 atau 3. Bila canvas diberi ukuran CSS px tetapi
`canvas.width` diset sama, hasilnya **buram**; perbaikannya: `canvas.width = cssWidth * dpr` lalu
`ctx.scale(dpr, dpr)` ([MDN — devicePixelRatio, diakses 2026-10-10](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio)).

**Penting (dan inilah kesimpulan §0bis butir 2):** begitu konteks di-scale, koordinat pointer CSS px
dari `getBoundingClientRect()` **sudah selaras** dengan ruang gambar — **tidak perlu** pembagian
`devicePixelRatio` manual di hit-test. Di dotbox, **belum ada** `ctx.scale` maupun DPR (0 hasil),
sehingga rasio bitmap:CSS **1:1** dan hit-test CSS px **konsisten**. Risiko sesungguhnya bukan bug
hari ini, melainkan **jebakan regresi**: menaikkan `canvas.width` ke `×dpr` **tanpa** `ctx.scale`
akan langsung merusak hit-test. Karena itu §3.9 memasukkan guard-nya ke PR yang sama.

### 2.5 Skala viewport (`user-scalable=no`)

WCAG 2.2 SC 1.4.4 (AA) & SC 1.4.10 (AA) praktis melarang menonaktifkan pinch-zoom; panduan
aksesibilitas utama menyarankan **menghapus `user-scalable=no` dan `maximum-scale=1.0`**
([W3C WCAG 2.2, diakses 2026-10-10](https://www.w3.org/WAI/WCAG22/quickref/);
[WebAIM, diakses 2026-10-10](https://webaim.org/articles/accessibility-of-canvas/)).

---

## 3. Usulan konkret untuk dotbox

### 3.1 Usulan A — Perbaikan viewport (`index.html:5`) — `[VERIFIED]` defisit

```html
<!-- SEKARANG -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">

<!-- USULAN -->
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

Menghapus `maximum-scale=1.0` + `user-scalable=no` memulihkan pinch-zoom (SC 1.4.4 / 1.4.10).
**Tanda verifikasi:** baris diperbaiki di artefak + test statis §3.8 butir (1); uji manual di ponsel.

### 3.2 Usulan B — Sapuan `aria-label` pada tombol — `[VERIFIED]` defisit

Defisit **global** (`aria-label` = 0 di `index.html`). Tabel berikut daftar minimum; sapuan harus
mencakup seluruh tombol beremoji.

| Lokasi | Sekarang | Usulan `aria-label` |
|---|---|---|
| `index.html:15` | `#darkModeToggle`, hanya `title="Toggle Dark Mode"` | `aria-label="Ganti mode gelap"` |
| `index.html:94` | `#replayPlayPause` — `▶️ Play` | `aria-label="Putar atau jeda replay"` |
| `index.html:95` | `#replayPrev` — `⏮️` | `aria-label="Langkah replay ke belakang"` |
| `index.html:96` | `#replayNext` — `⏭️` | `aria-label="Langkah replay ke depan"` |
| `index.html:97` | `#replayClose` — `❌` | `aria-label="Tutup replay"` |
| `index.html:108` | `#playAgainBtn` — `🎮 Main Lagi` | `aria-label="Main lagi"` |
| `index.html:81–84` | `🔄 New Game`, `↩️ Reset Board`, `▶️ Continue`, `📹 Replay` | **jangan** ditimpa `aria-label`; ini sudah punya **teks visibel** (lihat risiko di bawah) |
| `index.html:27,29,36,38,54,56` | tombol `-` / `+` selektor angka | `aria-label="Kurangi <nama>"` / `"Tambah <nama>"` (atau `aria-labelledby` ke `<label>` terkait) |

`title` **bukan** pengganti `aria-label`; perhitungan accessible name mendahulukan `aria-label`,
tetapi `title` tidak andal antar-assistive-tech
([WAI-ARIA APG — Names and descriptions, diakses 2026-10-10](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/)).

> **Koreksi penting terhadap daftar "`aria-label` untuk semua tombol".** Tombol `:81–84`
> **sudah punya teks visibel** ("New Game", "Reset Board", …) yang **diucapkan** screen reader
> sebagai nama. Menambahkan `aria-label` yang berbeda dari teks itu melanggar **WCAG 2.2 SC 2.5.3
> Label in Name**: pengguna pembaca layar yang mengaktifkan kontrol lewat **suara** akan menyebut
> teks yang terlihat, bukan `aria-label`. Karena itu untuk `:81–84` gunakan teks visibel apa adanya
> (cukup **hapus emoji** dari nama aksesibel bila perlu, mis. `aria-label="New Game"` **sama**
> persis dengan teks visibel minus emoji). Aturan umum: `aria-label` hanya untuk kontrol yang
> **tidak punya teks** (ikon/emoji saja) — `:15`, `:27–56` (`+`/`-`), `:94–97`, `:108`.

**Tanda verifikasi:** test statis §3.8 butir (2)+(3) hijau; `grep -n "aria-label" index.html` > 0.

### 3.3 Usulan C — Indikator fokus yang terlihat (`style.css`) — `[VERIFIED]` defisit

`style.css` **tidak punya** aturan `:focus`/`:focus-visible` (pencarian → 0 hasil).

```css
:focus-visible {
    outline: 3px solid var(--accent-primary);
    outline-offset: 2px;
}
```

**Tanda verifikasi:** menekan Tab memperlihatkan cincin fokus pada setiap tombol; test statis
§3.8 butir (4).

### 3.4 Usulan D — ARIA live region untuk giliran/skor — `[ASUMSI]` (rancangan)

Titik sisip di `updateUI()` (`script.js:698–717`), yang sudah dipanggil pada setiap perubahan giliran.

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
**Tanda verifikasi:** walkthrough screen reader (NVDA/VoiceOver) oleh QA — perubahan giliran
diumumkan tanpa kehilangan fokus. **Belum dijalankan; tandai `[ASUMSI]`.**

### 3.5 Usulan E — `prefers-reduced-motion` — `[ASUMSI]` (rancangan)

Animasi dotbox adalah `--transition-*` dan replay berjadwal tetap **600 ms** di
`script.js:1037` `setTimeout(playReplay, 600)` `[VERIFIED]`. `style.css` **sudah** punya dua
`@media` (`:593`, `:618`) tetapi **bukan** ini `[VERIFIED]`.

```css
/* style.css — tambahkan sebagai blok @media ketiga */
@media (prefers-reduced-motion: reduce) {
    * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
```

```js
/* script.js */
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
// jeda antar langkah replay: reduceMotion ? 0 : 600
```

**Tanda verifikasi:** QA mengaktifkan setelan OS reduced-motion → replay selesai tanpa animasi.

### 3.6 Usulan F — Dev-overlay status (P4) — `[ASUMSI]` (rancangan)

Panel **dev-only** di balik flag URL `?dev=1`, tidak pernah tampil di mode normal:

```
FPS | dpr | canvas {w×h} | viewport {w×h} | giliran | pemain | error terakhir | version save
```

- Menampilkan `window.devicePixelRatio` dan `canvas.width/height` **berdampingan** supaya `qa` bisa
  memverifikasi ulang §3.9 di perangkat nyata (ini nilai utama P4).
- Mencatat `console.error` terakhir (mis. `script.js:900` menulis pesan penolakan save)
  sebagai "error terakhir" agar kegagalan load-save terlihat, bukan tersembunyi.
- Dipisah sebagai modul kecil `dev-status.js` yang dimuat **setelah** `script.js` dan **tidak**
  menyentuh state permainan (read-only terhadap `window.gameState`).
- Bila `?dev=1` tidak ada, modul keluar lebih awal (`return`) — nol biaya produksi.

**Tanda verifikasi:** `index.html?dev=1` menampilkan panel; tanpa flag, tidak ada elemen tambahan.

### 3.7 Usulan G — Grid kontrol keyboard (navigasi canvas) — `[ASUMSI]`, effort **L**

Item terbesar dan **tidak** boleh masuk gesekan P3 cepat. Rancangan bertahap:

1. **Langkah 1 (S):** `<canvas id="gameCanvas">` diberi `tabindex="0"`, `role="application"`,
   `aria-label="Papan Dots and Boxes"`, dan handler panah yang memindahkan "kursor" garis terpilih;
   Enter/Space memilih. `aria-label` diperbarui saat kursor bergerak ("Garis horizontal baris 2 kolom 3").
2. **Langkah 2 (M):** petakan seleksi ke `makeMove(type,row,col)` yang **sudah menerima** gerakan
   terprogram — tidak perlu jalur baru.
3. **Langkah 3 (L, opsional):** grid `<button>` paralel `role="grid"` + roving tabindex bila
   step 1–2 belum cukup untuk screen reader.

**Ketergantungan:** langkah 1–2 hanya bergantung pada `makeMove` yang stabil (sudah ada) dan
**tidak** bergantung pada P1.

### 3.8 Spesifikasi test statis untuk Usulan A/B/C (dapat dijalankan `developer` tanpa peramban)

Sepakat dengan pola suite yang ada: `node --test` + sandbox `vm`/pembacaan berkas
(`test/qa-regressions.test.js`). Berkas usulan: `test/aksesibilitas-statis.test.js`.
Empat assertion yang mengunci A/B/C:

```js
// (1) A: viewport tidak lagi mematikan zoom
//     baca index.html sebagai teks
assert.ok(!/user-scalable\s*=\s*no/.test(html), 'index.html masih memuat user-scalable=no');
assert.ok(!/maximum-scale\s*=\s*1/.test(html), 'index.html masih membatasi maximum-scale');
// dan pastikan baris pengganti tetap ada
assert.match(html, /<meta\s+name="viewport"\s+content="width=device-width, initial-scale=1\.0">/);

// (2) B: setiap tombol IKON/emoji punya aria-label tidak kosong
//     daftar id yang wajib: darkModeToggle, replayPlayPause, replayPrev,
//     replayNext, replayClose, playAgainBtn
for (const id of WAJIB_LABEL) {
    const m = html.match(new RegExp(`<button[^>]*id="${id}"[^>]*>`));
    assert.ok(m, `tombol #${id} tidak ditemukan`);
    assert.match(m[0], /aria-label="[^"]+"/, `#${id} belum punya aria-label tidak kosong`);
}

// (3) B: JANGAN menimpa tombol berteks visibel (guard WCAG 2.5.3)
//     tombol :81–84 sudah punya teks; aria-label (bila ada) harus memuat teks visibel itu
const kontrol = html.match(/<button[^>]*class="btn-control"[^>]*>([^<]*)<\/button>/g) || [];
assert.ok(kontrol.length >= 4, 'blok kontrol :81–84 berubah bentuk');
for (const b of kontrol) {
    const teks = b.replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}\s]/gu, '').trim(); // buang emoji
    if (!/aria-label="/.test(b)) continue;            // tanpa aria-label = aman (nama dari teks)
    const label = (b.match(/aria-label="([^"]+)"/) || [])[1] || '';
    assert.ok(label.includes(teks), `aria-label "${label}" tidak memuat teks visibel "${teks}" (SC 2.5.3)`);
}

// (4) C: style.css punya indikator fokus yang terlihat
const css = fs.readFileSync(path.join(__DIR, '..', 'style.css'), 'utf8');
assert.match(css, /:focus-visible\s*\{[^}]*outline:/, 'tidak ada aturan :focus-visible dengan outline');
```

**Status warna test ini `[ASUMSI]`:** penulis **belum menjalankannya**. Yang **diharapkan** (RED,
prediksi dari pembacaan kode di §1.2): keempatnya **GAGAL sekarang** karena (1) `index.html:5`
masih `user-scalable=no`, (2) `aria-label` = 0, (4) `style.css` tanpa `:focus-visible`.
Perintah: `node --test test/aksesibilitas-statis.test.js`.

### 3.9 Uji DPR yang jujur — dapat dijalankan **tanpa** perangkat Retina — `[ASUMSI]`

Menjawab §0bis butir 2. Jangan menunggu perangkat HiDPI; buktikan invariannya di `node --test`:

```js
// test/dpr-invarian.test.js  (pola sandbox vm + canvas tiruan)
// Invarian 1 — ukuran bitmap mengikuti DPR, ukuran CSS tetap:
//   dengan window.devicePixelRatio = 2:
//     canvas.width  === ukuran CSS * 2
//     ctx.getTransform().a === 2   (menuntut ctx.setTransform(dpr,0,0,dpr,0,0) dipanggil)
// Invarian 2 — hit-test tetap benar SETELAH DPR aktif:
//   panggil handleLineSelection(x, y) memakai koordinat CSS px yang sama seperti hari ini,
//   diuji pada dpr = 1 DAN dpr = 2 → indeks garis terpilih WAJIB IDENTIK.
```

**Invarian 2 inilah yang membedakan "DPR benar" dari "DPR setengah jalan".** Hari ini (tanpa DPR,
rasio 1:1) ia lulus secara sepele; setelah perbaikan DPR ia tetap harus lulus. Karena itu kedua
invarian harus berada di **satu PR** dan **satu berkas test**. **Status warna `[ASUMSI]`** — penulis
belum menjalankan; yang tersisa sebagai asumsi hanyalah **ketajaman visual** di layar Retina nyata
(hanya bisa dikonfirmasi mata/manual, bukan oleh test).

---

## 4. Matriks prioritas p2

| # | Item | Dampak | Effort | Status | Tanda verifikasi |
|---|---|---|---|---|---|
| A | Hapus `user-scalable=no` (`index.html:5`) | Tinggi (WCAG AA) | S | `[VERIFIED]` defisit | test §3.8(1) hijau; pinch-zoom jalan |
| B | Sapuan `aria-label` (`:15`,`:94–97`,`:108`,`:27–56`; **bukan** `:81–84`) | Tinggi | S–M | `[VERIFIED]` defisit | test §3.8(2)(3) hijau |
| C | `:focus-visible` di `style.css` | Tinggi | S | `[VERIFIED]` defisit | test §3.8(4) hijau; Tab memperlihatkan cincin |
| D | ARIA live giliran/skor | Tinggi | M | `[ASUMSI]` | diumumkan via NVDA/VoiceOver |
| E | `prefers-reduced-motion` | Sedang | S | `[ASUMSI]` | replay tanpa animasi |
| F | Dev-overlay status (P4) | Sedang (kualitas dev) | M | `[ASUMSI]` | `?dev=1` menampilkan panel |
| G | Grid kontrol keyboard (canvas) | Tinggi | L | `[ASUMSI]` | main penuh via keyboard saja |
| H | Invarian DPR (§3.9) | Sedang (cegah regresi) | M | `[ASUMSI]` | invarian 1+2 hijau di dpr 1 & 2 |

**Urutan rekomendasi untuk proposal:** **C → A → B → D → E → F → G**, dengan **H** dikerjakan
bersamaan/di dalam item DPR milik p4 (satu PR).
Alasan: C/A/B adalah perbaikan murah yang defisitnya sudah terbukti baris (paling mudah
dipertanggungjawabkan); D/E/F rancangan; G pekerjaan besar yang sebaiknya ditahan setelah paket
utama proposal stabil; H tidak boleh terpisah dari perubahan DPR mana pun.

### 4bis. Yang **tidak** boleh dilakukan (jebakan yang sudah terbukti)

1. **Jangan menaikkan `canvas.width` ke `×dpr` tanpa `ctx.scale`.** Rasio 1:1 hari ini membuat
   hit-test benar; menaikkan bitmap saja akan **langsung merusak** pemilihan garis di semua perangkat
   (faktor `dpr`). Karena itu §3.9 invarian 2 wajib ada di PR yang sama.
2. **Jangan menimpa `aria-label` pada tombol berteks visibel** (`:81–84`) — melanggar SC 2.5.3 dan
   merusak kontrol suara. Lihat §3.2 catatan koreksi.
3. **Jangan mengklaim "aksesibilitas selesai" setelah A/B/C.** A/B/C hanya membuat *tombol* terbaca
   dan halaman bisa di-zoom; **memilih garis di papan tetap mustahil** tanpa G (§0 butir 5).

---

## 5. Keputusan yang sudah diambil (p2) & yang masih terbuka

**Ruling p2 (diputuskan, tidak menunggu CEO):**

1. **R1 — Perbaikan aksesibilitas "murah" dipisah dari "kanvas penuh".** A/B/C masuk jalur cepat
   (S–M, defisit terverifikasi); G ditandai L dan ditahan. Ini menaati `codebase-design`:
   pecah antarmuka besar menjadi langkah kecil yang dapat diuji sendiri.
2. **R2 — P4 adalah alat diagnosa, bukan fitur.** Selalu di balik `?dev=1`, read-only, tidak
   menyentuh state permainan. Dipisah jadi modul sendiri (`dev-status.js`).
3. **R3 — Rancangan DPR tidak diimplementasikan oleh p2.** p2 hanya menetapkan **invarian test**
   (§3.9) dan menegaskan guard-nya masuk PR yang sama.
4. **R4 — Semua string `aria-label` dalam Bahasa Indonesia**, konsisten dengan `lang="id"`
   (`index.html:2`) dan label UI yang berbahasa Indonesia. Pengecualian: `:81–84` mempertahankan
   teks visibel apa adanya (SC 2.5.3).
5. **R5 (BARU) — `aria-label` **tidak** dipasang pada tombol berteks visibel.** Aturan: `aria-label`
   hanya untuk kontrol tanpa teks (ikon/emoji saja). Ini koreksi langsung atas draf sebelumnya yang
   menyuruh menyapu `:81–84`.

**Masih terbuka untuk `developer`/`qa` (bukan CEO):**

- **Q-FOCUS:** apakah fokus harus dipulihkan ke tombol pemicu setelah modal game-over ditutup?
  (Rekomendasi p2: ya, sebagai bagian dari G langkah 1.)
- **Q-LIVE-SCOPE:** apakah live region juga mengumumkan **skor** setiap langkah, atau hanya
  **giliran**? Rekomendasi p2: giliran selalu; skor hanya saat berubah, agar tidak berisik.
- **Q-DEV-OVERLAY:** bolehkah `dev-status.js` memakai `requestAnimationFrame` untuk FPS, atau
  cukup `setInterval(1000)` agar nol biaya saat tab tidak aktif? Rekomendasi p2: `setInterval`.

**Terbuka untuk CEO (keputusan bisnis):**

- Prioritas: apakah G (aksesibilitas penuh via keyboard, effort **L**) dikerjakan sekarang demi
  jangkauan pemain, atau ditunda demi fitur permainan baru? Ini pilihan produk, bukan teknis.

---

## 6. Lampiran: perintah verifikasi (belum dijalankan oleh p2)

> p2 **tidak punya akses shell**; perintah di bawah adalah yang **harus** dijalankan
> `developer`/`qa` dan dilampirkan keluaran mentahnya.

```bash
# 1. Defisit aksesibilitas (harapan SEKARANG: 0 hasil untuk aria/role/focus/tabindex)
grep -rn "aria-label\|role=\|:focus\|tabindex" index.html style.css script.js

# 2. Setelah Usulan A/B/C (harapan: > 0 hasil)
grep -n "aria-label" index.html
grep -n ":focus-visible" style.css

# 3. Buktikan tidak ada DPR (harapan SEKARANG: 0 hasil)
grep -n "devicePixelRatio\|setTransform\|ctx.scale" script.js

# 4. Setelah test baru ditulis
node --test test/aksesibilitas-statis.test.js    # §3.8
node --test test/dpr-invarian.test.js            # §3.9

# 5. Regresi suite
node --test
```

**Catatan lintas-paket (koreksi dari p3, jangan salah tafsir).** Ketika p2 pertama menulis draf ini,
`node --test` polos menghasilkan **4 fail** dari `test/save-schema.test.js` karena P2 (versioning)
**belum** diimplementasikan. **Keadaan itu sudah berubah:** pada HEAD branch ini, P1 (wiring
`turn-queue`) **dan** P2 (versi skema save) **sudah mendarat** — `script.js:768` `SCHEMA_VERSION`,
`:769–772` `versiDikenal()`, `:776` `version: SCHEMA_VERSION`, `:808` cek versi — dan angka suite
terkini adalah **56/56 pass** (dikutip p4 sebagai `[SITASI]` dari `docs/bukti/p1-terpasang.txt:150–158`
dan `docs/bukti/node-test-qa-polos.txt:285–294`). p2 **tidak menjalankan** suite itu; p2 hanya
**mencatat** bahwa angka lama "4 fail / 43/43" **sudah usang** dan tidak boleh dikutip lagi.

---

## 6bis. Hubungan dengan `PROPOSAL-PENGEMBANGAN-DOTBOX.md` (p4) — batas paket

`PROPOSAL-PENGEMBANGAN-DOTBOX.md` **sudah ada** di branch ini dan **sudah memuat ringkasan P3**
(viewport + `aria-label` + fokus, beserta usulan test statis). Maka **p2 tidak menulis ulang
proposal** (itu paket p4 dan dilarang diduplikasi).

Yang **p2 tambahkan** pada revisi ini untuk dilipat p4 (bukan pengganti):

- **Koreksi WCAG 2.5.3 (§3.2):** usulan lama "sapu `aria-label` ke `:81–84`" **salah** — tombol itu
  sudah punya teks visibel. Ringkasan P3 di proposal p4 sebaiknya menambahkan pengecualian ini.
- **Rancangan P4 dev-overlay** (p2 §3.6) yang belum dirinci di proposal p4.
- **Detail `:focus-visible`** sebagai defisit `style.css` yang terbukti 0 hasil (p2 §3.3),
  **dengan koreksi** bahwa `style.css` sudah punya dua `@media` (`:593`, `:618`).
- **Rancangan tangga grid kontrol keyboard** (p2 §3.7 / Usulan G) yang di proposal p4 belum dirinci.
- **§3.9 invarian DPR** — jawaban yang bisa dijalankan atas pertanyaan DPR, sehingga item P5 di
  proposal p4 tidak lagi berstatus "tunggu perangkat": invarian 1+2 bisa dibuktikan di `node --test`.
- **Koreksi status DPR:** bukan "hit-test DPR itu `[ASUMSI]`", melainkan **"DPR sama sekali tidak
  dipakai → hit-test konsisten 1:1; yang tersisa sebagai asumsi hanyalah ketajaman visual"**.

**Keputusan p2:** tidak mengubah `PROPOSAL-PENGEMBANGAN-DOTBOX.md` agar tidak bertabrakan dengan
penulis p4. p5 (QA) memverifikasi keduanya.

---

## 7. Risiko untuk agen berikutnya

1. **Jangan klaim P3/P4 "selesai".** Semua item D–H `[ASUMSI]` sampai ada keluaran test/walkthrough.
2. **`aria-label` saja tidak membuat game bisa dimainkan screen reader** (§4bis butir 3).
3. **Jangan naikkan bitmap kanvas tanpa `ctx.scale`** (§4bis butir 1) — ini regresi paling mudah
   terjadi saat mengerjakan item DPR.
4. **Perubahan `style.css` menyentuh tata letak mobile.** `user-scalable=no` saat ini ikut menopang
   tampilan layar sempit; menghapusnya (Usulan A) **wajib** diuji pada `@media (max-width: 400px)`
   (`style.css:593`) agar tata letak tidak rusak saat di-zoom.
5. **Dev-overlay jangan ter-ship terlihat.** Wajib `?dev=1`; QA mengecek mode normal bersih.
6. **Angka suite usang beredar di dokumen lama.** Kutip **56/56** (dengan sumber berkas bukti),
   bukan 43/43 atau 52/52 atau "4 fail".

---

## Referensi (tanggal akses 2026-10-10)

- MDN Web Docs. *The Canvas element — Accessibility.* https://developer.mozilla.org/en-US/docs/Web/HTML/Element/canvas#accessibility
- MDN Web Docs. *Window: devicePixelRatio property.* https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
- MDN Web Docs. *prefers-reduced-motion.* https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- W3C. *WAI-ARIA Authoring Practices Guide — Alert and Status patterns.* https://www.w3.org/WAI/ARIA/apg/patterns/alert/
- W3C. *WAI-ARIA Authoring Practices Guide — Grid (Interactive Tabular Data) Pattern.* https://www.w3.org/WAI/ARIA/apg/patterns/grid/
- W3C. *WAI-ARIA Authoring Practices Guide — Accessible Names and Descriptions.* https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/
- W3C. *Web Content Accessibility Guidelines (WCAG) 2.2 — Quick Reference* (SC 1.4.4, 1.4.10, 2.2.2, 2.3.3, 2.4.7, 2.4.11, 2.5.3). https://www.w3.org/WAI/WCAG22/quickref/
- WebAIM. *Accessibility of Canvas.* https://webaim.org/articles/accessibility-of-canvas/
