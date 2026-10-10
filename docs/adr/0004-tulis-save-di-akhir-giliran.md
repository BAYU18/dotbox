# ADR-0004 — Save ditulis di **akhir giliran**, bukan di tengah `makeMove`, dengan penyelamat `beforeunload`

**Status:** Diusulkan (menunggu persetujuan Team Lead/CEO). Dibuat oleh Architect pada gelombang G3 (P4).

**Konteks.** Hari ini `saveGame()` dipanggil di tengah `makeMove` (`script.js:585`) **[TERVERIFIKASI]**.
Artinya setiap langkah menulis `localStorage` secara sinkron — di seluler, I/O sinkron per langkah adalah
kandidat jank, dan proposal §4 P4 mencatatnya sebagai masalah ("hemat I/O"). Alternatifnya terlihat
sederhana: **hapus** panggilan itu dan tulis hanya sekali saat permainan berakhir. Tetapi cara itu salah
untuk dotbox: pemain boleh menutup tab kapan saja di tengah permainan, dan save-lah satu-satunya cara
melanjutkan. Menunda tulis **sampai game over** berarti membuang seluruh fitur "lanjutkan permainan" yang
sudah ada.

Jadi keputusan ini punya trade-off nyata: **lebih sedikit tulis** (kurangi I/O) versus **jendela kehilangan
data** (bila tab ditutup di antara dua tulis).

**Keputusan.** Save ditulis di **akhir giliran** (di akhir `updateUI()`, setelah giliran/skor berubah),
**bukan** di tengah `makeMove`; ditambah satu penulisan penyelamat pada `beforeunload`; dan `saveGame()`
tetap dipanggil sekali di `initGame`/`resetBoardOnly`/`loadGame` (perilaku lama dipertahankan). Fraksi
"giliran" adalah unit yang benar karena ia adalah satuan perubahan state yang **selesai** dan
**bermakna bagi pemain**: setelah giliran berpindah, permainan berada di keadaan yang stabil untuk
dilanjutkan.

Alasan:

- **Menutup jendela kehilangan data.** Tulis di akhir giliran + `beforeunload` membuat jumlah maksimum
  langkah yang bisa hilang = langkah yang belum menutup gilirannya, dan `beforeunload` menutup bahkan itu.
- **Unitnya bermakna.** Langkah di tengah giliran (pemain mengklaim kotak → giliran ekstra) bukan titik
  pulih yang berarti; menulis di sana hanya menambah I/O tanpa menambah keamanan.
- **Tidak menambah dependensi.** `beforeunload` adalah API peramban standar; proyek tetap nol dependensi,
  tanpa build step.

**Konsekuensi:**

- (+) I/O per langkah turun (satu giliran = satu tulis, bukan tiap langkah internal).
- (+) State yang tertulis selalu state giliran yang **konsisten** (bukan snapshot di tengah update UI).
- (−) Satu jalur baru (`beforeunload`) harus ada; tanpa itu, aturan "tidak kehilangan data" bohong.
- (−) Test wajib membuktikan **isi** save akhir sama dengan `gameState` terakhir, bukan hanya menghitung
  pemanggilan — kalau tidak, "hemat I/O" bisa dicapai dengan cara yang merusak data.
- (−) Jalur `initGame` tetap memanggil `saveGame`; itu sengaja, supaya permainan baru langsung punya
  titik pulih.

**Alternatif yang ditolak.** (a) Tulis hanya saat game over — menghapus fitur continue, dan kehilangan
seluruh permainan bila tab ditutup lebih awal. (b) `requestIdleCallback` saja — menunda tulis melewati
akhir giliran, justru **menambah** jendela kehilangan data, dan tidak dijamin berjalan saat tab ditutup.
(c) Membiarkan tulis di `makeMove` — I/O sinkron per langkah, persis masalah yang dilaporkan proposal.
(d) Pindah ke `sessionStorage`/IndexedDB — perubahan penyimpanan yang jauh lebih besar dari masalah yang
diselesaikan (YAGNI), dan tidak memperbaiki "kapan menulis".

**Ambang penggantian.** Bila ada bukti nyata bahwa `beforeunload` tidak dapat diandalkan di peramban
sasaran (mis. peramban seluler tertentu yang tidak memicu `beforeunload`), keputusan ini harus diganti
menjadi "tulis di akhir giliran **dan** di setiap langkah yang mengklaim kotak" — kompromi I/O vs
keamanan. Sampai bukti itu ada, ini sengaja tetap sederhana.
