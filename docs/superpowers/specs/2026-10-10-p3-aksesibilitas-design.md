# Rancangan P3 — Aksesibilitas: zoom, nama tombol, fokus terlihat, live region

**Tanggal:** 2026-10-10
**Status:** kontrak untuk implementasi (spec → plan → test)
**Basis:** `PROPOSAL-PENGEMBANGAN-DOTBOX.md` §4 P3, `PROPOSAL-PENGEMBANGAN.md` §3.4 P3-1,
`docs/superpowers/specs/2026-10-10-p2-aksesibilitas-dan-telemetri-design.md`,
WCAG 2.2 SC 1.4.4 / 1.4.10 / 2.5.3, W3C ARIA APG (status pattern).

## 0. Keputusan yang mengikat (dibuat Lead, implementer tidak perlu bertanya)

- **Target = perbaikan terarah**, bukan sertifikasi "tanpa pelanggaran WCAG AA".
  Alasan: mengejar AA penuh menuntut audit pembaca layar nyata yang tidak bisa
  dilakukan sesi ini (tanpa GUI) — itu akan menjadi klaim tanpa bukti (ADR-0002).
- **`prefers-reduced-motion` masuk lingkup** (murah, dan animasi toast/replay
  memang bergerak). Bila implementer menemukan biayanya ternyata meluas,
  laporkan sebagai DONE_WITH_CONCERNS alih-alih diam-diam melebar.
- **i18n (ID/EN) TIDAK dikerjakan.** Di luar lingkup; semua string tetap Indonesia.

## 1. Masalah (bukti baris)

| # | Temuan | Lokasi |
|---|---|---|
| V1 | `maximum-scale=1.0, user-scalable=no` mematikan zoom | `index.html:5` |
| V2 | Tombol mode gelap hanya punya `title`, tanpa `aria-label` | `index.html:15` |
| V3 | Blok tombol replay tanpa `aria-label` (`▶️ ⏮️ ⏭️ ❌`) | `index.html:94-97` |
| V4 | `aria-label` di `index.html` = 0 hasil (defisit sistemik) | pencarian repo |
| V5 | `playAgainBtn` tanpa label | `index.html:108` |
| — | Tidak ada aturan `:focus`/`:focus-visible` | `style.css` |
| — | Tidak ada live region untuk giliran/skor | `index.html` |

## 2. Perubahan yang diinginkan (tepat)

1. **Viewport** — `index.html:5` menjadi:
   `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
   (hapus `maximum-scale=1.0` **dan** `user-scalable=no`).
2. **`aria-label`** pada kontrol yang **hanya** berisi emoji/simbol:
   - `#darkModeToggle` → `Ganti mode gelap`
   - `#replayPlayPause` → `Putar atau jeda replay`
   - `#replayPrev` → `Langkah replay ke belakang`
   - `#replayNext` → `Langkah replay ke depan`
   - `#replayClose` → `Tutup replay`
   - `#playAgainBtn` → `Main lagi` (isi teksnya "🎮 Main Lagi" — label harus
     **mengandung** teks yang terlihat itu, aturan WCAG 2.5.3 "Label in Name";
     tulis `aria-label="Main lagi"` **hanya bila** teks visibel tetap terbaca
     pembaca layar; bila ragu, pakai `aria-label="🎮 Main Lagi"`-nya dihilangkan
     dan biarkan teks visibel — **wajib dijelaskan pilihannya di laporan**).
   - **Jangan** memberi `aria-label` pada tombol yang sudah punya teks visibel
     jelas (`.btn-control`: "🔄 New Game", "↩️ Reset Board", "▶️ Continue",
     "📹 Replay") — itu melanggar aturan yang sama.
3. **`:focus-visible`** yang terlihat di `style.css` untuk **semua** elemen
   interaktif (`button`, `input`, `[tabindex]`): mis. `outline: 3px solid var(--accent)`
   dengan `outline-offset: 2px`. Keyword `:focus-visible` **bukan** `:focus`
   (jangan memunculkan cincin fokus saat klik tetikus).
4. **Live region** — tambah satu elemen status, mis.
   `<div id="liveStatus" role="status" aria-live="polite" class="visually-hidden"></div>`
   (kelas `visually-hidden` baru di `style.css`, pola clip standar), dan panggil
   pembaruannya dari `updateUI()` di `script.js` dengan **teks**, bukan emoji:
   `Giliran: <nama pemain>. Skor: <nama1> <skor1>, <nama2> <skor2>.`
   Region ini **hanya** menambah pemanggilan di `updateUI()` — jangan menambah
   titik pembaruan lain.
5. **`prefers-reduced-motion`** — di `style.css`, di dalam
   `@media (prefers-reduced-motion: reduce)` matikan transisi/animasi
   (`animation: none; transition: none;`) untuk `.toast`, highlight kotak, dan
   modal.

## 3. Titik uji (seam)

Uji **statis + DOM**, tanpa peramban: baca `index.html` sebagai teks/DOM dan
muat `style.css` sebagai teks. Ini pola yang sudah dipakai
`test/script-moves.test.js` (membaca `index.html`).

Test wajib (RED dulu, GREEN sesudahnya):

1. `index.html` **tidak** memuat `user-scalable=no` dan **tidak** memuat
   `maximum-scale=1.0`.
2. Setiap elemen dengan kelas `.icon-btn` dan `.btn-replay` punya `aria-label`
   yang tidak kosong (hitung: ≥ 1, dan daftar id-nya cocok dengan daftar pada §2.2).
3. `style.css` memuat `:focus-visible` **dan** memuat
   `@media (prefers-reduced-motion: reduce)`.
4. `index.html` memuat elemen `#liveStatus` dengan `role="status"` +
   `aria-live="polite"`; dan `script.js` memanggil pembaruan `#liveStatus` di
   dalam `updateUI()` (uji lewat stub DOM: jalankan `updateUI()`, periksa
   `textContent` region berisi "Giliran:" dan tidak berisi emoji).

## 4. Yang TIDAK diklaim

- Membaca `aria-label` oleh NVDA/VoiceOver **tidak** diuji di sini (tidak ada
  peramban/pembaca layar di sesi ini). Test di atas membuktikan **atribut ada
  dan benar bentuknya**, bukan bahwa pengalaman pembaca layar bagus. Laporan
  wajib menyatakan batas ini.
- Menghapus pembatas zoom bisa mengubah tata letak layar sempit — perlu
  pemeriksaan visual yang **belum** dilakukan; catat sebagai risiko terbuka.
