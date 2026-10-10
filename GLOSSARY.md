# GLOSSARY — dotbox (Dots and Boxes)

Kosakata domain permainan. Murni istilah; **tanpa** detail implementasi.

## Papan

- **Titik (dot)** — persimpangan pada grid `N×N` titik. Titik tidak pernah berubah; ia hanya jangkar visual.
- **Garis (edge)** — sisi yang menghubungkan dua titik bertetangga. Ada dua orientasi:
  - **Garis horizontal** — baris `r` (0..N-1), kolom `c` (0..N-2).
  - **Garis vertikal** — baris `r` (0..N-2), kolom `c` (0..N-1).
- **Kotak (box)** — unit skor, dibentuk oleh 4 garis (atas, bawah, kiri, kanan). Ada `(N-1)×(N-1)` kotak.
- **Owner** — pemain yang telah **mengklaim** sebuah garis atau kotak. Nilai kanonik: suatu garis/kotak **belum dimiliki** jika `owner === null`.

## Aturan main

- **Garis kosong (bare edge)** — garis yang `owner === null`; satu-satunya jenis gerakan legal.
- **Mengklaim kotak (completing a box)** — momen ketika sebuah gerakan membuat keempat sisi sebuah kotak ber-owner. Kotak itu langsung menjadi milik pemain yang bergerak.
- **Giliran ekstra (extra turn)** — hak bergerak lagi segera setelah pemain **mengklaim minimal satu kotak**. Bila tidak mengklaim, giliran berpindah.
- **Siklus giliran (turn cycle)** — urutan pemain tetap `0 → 1 → … → (N-1) → 0`, kecuali dipotong oleh giliran ekstra.
- **Akhir permainan (game over)** — kondisi ketika **semua** kotak ber-owner. Pemenang = pemilik kotak terbanyak; seri bila ada skor maksimum yang sama.
- **Skor** — jumlah kotak yang dimiliki pemain. Skor dihitung ulang dari papan, bukan diinkremen terpisah.

## AI (khusus)

- **Pemain manusia vs AI** — flag `isAI` pada pemain. AI adalah pemain yang gilirannya dijalankan otomatis.
- **Move yang menyelesaikan kotak** — gerakan yang, setelah diterapkan, mengklaim minimal satu kotak.
- **Move yang aman (safe move)** — gerakan yang **tidak** memberi lawan kotak yang bisa diklaim pada giliran berikutnya.
- **Move pengorbanan (sacrifice)** — gerakan yang memberi lawan kotak (dipilih hanya bila tak ada move aman).
- **Kedalaman AI (aiDepth)** — parameter konfigurasi tingkat kesulitan. **Perhatikan:** dalam kode saat ini parameter ini diterima namun **tidak** mengubah keputusan (tidak ada penelusuran berkedalaman). Dicatat di sini agar tidak diasumsikan sebagai kedalaman pencarian.

## Riwayat & pemutaran ulang

- **Riwayat langkah (moveHistory)** — daftar gerakan berurutan beserta pemiliknya.
- **Mode replay** — mode hanya-baca yang merekonstruksi papan dari `moveHistory`, tanpa mengubah permainan berjalan.
- **Reset papan (resetBoardOnly)** — mengosongkan garis, kotak, skor, dan riwayat **tanpa** mengubah konfigurasi pemain.
