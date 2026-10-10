# Rancangan P5 — Ketajaman HiDPI (DPR scale + guard hit-test)

**Tanggal:** 2026-10-10
**Status:** kontrak untuk implementasi (spec → plan → test)
**Basis:** `PROPOSAL-PENGEMBANGAN-DOTBOX.md` §4 P5 + Ruling 2,
`docs/superpowers/specs/2026-10-10-p2-aksesibilitas-dan-telemetri-design.md` §P5.

## 1. Aturan yang mengikat (Ruling 2 — jangan dibuka lagi)

- P5 adalah **satu item, satu PR, satu gerbang test**. Dilarang memecahnya
  menjadi "perbaikan render" + "perbaikan hit-test" terpisah.
- **Hit-test saat ini tidak meleset.** Rasio bitmap:CSS = 1:1, sehingga
  `hitRadius = 30` (`script.js:470`) bekerja benar hari ini. Karena itu laporan
  **tidak boleh** menyebut ada bug hit-test aktif.
- Yang benar: perbaikan render (bitmap × DPR) **wajib** disertai konversi
  koordinat pointer, karena begitu bitmap di-×DPR tanpa konversi balik,
  hit-test **langsung rusak** dan kita memperburuk produk.

## 2. Masalah

`setupCanvas()` (`script.js:200-219`) dan `handleResize()` (`script.js:221-228`)
menulis `canvas.width = size` / `canvas.height = size` sebagai CSS px langsung,
**tanpa** `ctx.setTransform`/`ctx.scale` DPR. Di layar HiDPI (DPR 2/3) kanvas
dirender pada resolusi bitmap 1× → tampak kabur. `grep dpr` di repo = 0 hasil.

## 3. Perubahan yang diinginkan

Di kedua tempat (`setupCanvas`, `handleResize`), dengan `dpr = window.devicePixelRatio || 1`:

```
ukuran CSS  = size (CSS px, tidak berubah: dipakai tata letak & hit-test lama)
bitmap      = size * dpr      -> canvas.width / canvas.height
style       = size + 'px'     -> canvas.style.width / canvas.style.height
konteks     = ctx.setTransform(dpr, 0, 0, dpr, 0, 0)   // SEBELUM calculatePositions()
```

Di jalur input (`handleCanvasClick` `:440-451`, `handleTouchStart` `:453-466`),
konversi koordinat perangkat → koordinat CSS:

```
const dpr = window.devicePixelRatio || 1;
const x = (event.clientX - rect.left) * (canvas.width  > 0 && rect.width  > 0
          ? (canvas.width / rect.width)  / dpr : 1);
```

yang secara aljabar sama dengan `(clientX - rect.left) * (CSSlebar/rectFisiklebar)`
— tulis dalam bentuk yang menurut implementer paling jelas, tetapi **satu
formula yang dipakai bersama** kedua handler (boleh diekstrak ke helper murni
`hitungKoordinatPointer(rect, clientX, clientY, canvas, dpr) -> {x, y}` supaya
bisa diuji tanpa DOM).

`hitRadius` **tidak diubah** oleh P5 kecuali ada bukti uji bahwa nilainya salah
setelah konversi (nilai CSS px-nya tetap 30).

## 4. Titik uji (seam)

Ekstrak perhitungan ke fungsi murni di `script.js` (diuji langsung, seperti
`handleLineSelection` di suite sekarang) **atau** uji lewat stub DOM yang
menyediakan `window.devicePixelRatio = 2` dan `getBoundingClientRect()` tiruan.

Tiga test wajib (RED dulu, GREEN sesudahnya):

1. **Ukuran bitmap.** Dengan DPR 2 dan `size` yang bisa diprediksi: `canvas.width === size * 2`
   dan `canvas.style.width === size + 'px'`.
2. **Transform konteks.** Stub konteks merekam pemanggilan `setTransform`;
   nilai yang terekam adalah `(2, 0, 0, 2, 0, 0)`.
3. **Hit-test tetap benar.** Dengan DPR 2, klik pada titik tengah garis
   horizontal `(0,0)` (dihitung dari `dotPositions` yang sudah dikonversi ke CSS px)
   memilih garis yang **sama** seperti pada kasus DPR 1 — bukan garis tetangga,
   bukan `null`.

## 5. Risiko

| Risiko | Mitigasi |
|---|---|
| Hanya bitmap yang di-×DPR, konversi input terlupa | Satu PR + test #3 yang gagal bila konversi tidak ada |
| `canvas.style.width` ditulis dengan nilai bitmap | Test #1 memisahkan keduanya |
| Uji perangkat Retina asli | **Belum ada** (sesi tanpa GUI). Test di sini menguji perhitungan, bukan ketajaman layar; nyatakan batas ini secara jujur di laporan |
