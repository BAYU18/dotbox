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
- **Kedalaman AI (aiDepth)** — parameter konfigurasi tingkat kesulitan. **Perhatikan:** dalam kode saat ini parameter ini diterima dan **benar-benar** diteruskan ke `new AIEngine(config.aiDepth)`; pencarian memakai kedalaman itu sebagai batas ply. (Catatan lama di glosarium ini sempat keliru menyatakan parameter ini tidak berpengaruh; klaim itu tidak berlaku lagi sejak ADR-0002/plan Task 4 mendarat.)

## Riwayat & pemutaran ulang

- **Riwayat langkah (moveHistory)** — daftar gerakan berurutan beserta pemiliknya.
- **Mode replay** — mode hanya-baca yang merekonstruksi papan dari `moveHistory`, tanpa mengubah permainan berjalan.
- **Reset papan (resetBoardOnly)** — mengosongkan garis, kotak, skor, dan riwayat **tanpa** mengubah konfigurasi pemain.

## Penjadwalan giliran

- **Giliran AI tertunda (pending AI turn)** — giliran pemain AI yang **sudah dijadwalkan** tetapi belum dijalankan. Selama ada giliran tertunda, tidak boleh ada giliran tertunda kedua untuk papan yang sama.
- **Antrian giliran (turn queue)** — penampung **satu slot** untuk giliran AI tertunda. "Satu slot" berarti penjadwalan kedua **menggantikan** yang pertama, bukan menumpuknya. (Nama historis "queue" dipertahankan; secara perilaku ini bukan antrian FIFO.)
- **Eksekusi basi (stale execution)** — giliran AI tertunda yang dijalankan setelah papan berubah (reset / muat ulang), sehingga berlaku pada permainan yang sudah tidak relevan. Dibatalkan dengan `clear()`.
- **Akhir giliran (end of turn)** — momen ketika giliran berpindah ke pemain berikutnya (atau ketika giliran ekstra selesai dan pemain baru ditetapkan). **Bukan** setiap langkah di dalam satu giliran. Titik ini adalah batas di mana permainan dianggap berada pada keadaan yang stabil untuk disimpan.

## Data simpanan (save)

- **Versi skema save (save schema version)** — penanda yang menyatakan bentuk data `localStorage`. Versi terkini adalah `1`. Save yang ditulis sebelum ada penanda diperlakukan sebagai versi 1 (bentuknya identik).
- **Save warisan (legacy save)** — save tanpa field `version`. Diterima selama bentuknya cocok dengan versi terkini.
- **Versi tak dikenal (unknown version)** — penanda versi di luar rentang yang dikenali kode. Save seperti ini **ditolak** dan tidak boleh mengubah permainan berjalan (aturan atomik QA-2).
- **Kelas penolakan save (rejection class)** — kategori sebab sebuah save ditolak, supaya log bisa didiagnosis tanpa menebak: `bukan-objek` (data simpanan bukan objek), `versi-tak-dikenal`, dan `struktur-tak-valid` (kunci wajib tidak lengkap / nilai tidak sah). Ketiga kelas ini adalah kosakata tetap; jangan menambah kelas baru tanpa memperbarui ADR/spec.
- **Waktu tulis save (save write timing)** — aturan kapan data simpanan ditulis ke `localStorage`. Yang berlaku: **di akhir giliran**, plus penulisan penyelamat saat halaman akan ditinggalkan (`beforeunload`), plus sekali saat permainan baru dibuat/direset/dimuat. Menulis di tengah giliran bukan waktu tulis yang diakui (lihat ADR-0004).

## Alat diagnosa

- **Overlay status (dev-overlay)** — panel **hanya-baca** untuk pengembang/QA yang menampilkan keadaan runtime (FPS, `devicePixelRatio`, ukuran kanvas bitmap vs CSS, giliran, versi skema save, galat terakhir). Hanya aktif bila URL memuat `?dev=1`; di mode normal ia **tidak ada** (tidak membuat elemen, tidak menjalankan timer). Ia bukan fitur pemain.

## Bentuk data kanonik

- **Bentuk kotak kanonik (canonical box shape)** — sebuah kotak direpresentasikan **hanya** sebagai `{ owner }`. Field `edges` di dalam kotak adalah **dead write** (ditulis, tidak pernah dibaca) dan **tidak lagi ditulis**. Save lama yang masih memuat `edges` di dalam kotak **tetap diterima**; saat dimuat, hanya `owner` yang dibawa ke papan berjalan.
- **Langkah cadangan (fallback move)** — langkah yang dimainkan AI ketika `getBestMove()` gagal mengembalikan langkah (`null`). Sumbernya tetap himpunan **garis kosong** (`Rules.availableMoves`), dipilih **deterministik** (bukan acak) — lihat ADR-0003. Langkah cadangan bukan langkah ilegal dan bukan alasan untuk diam tanpa pemberitahuan.
- **Jalur cadangan (fallback path)** — cabang di `executeAIMove` yang diambil ketika pencarian gagal **atau** langkah pilihan ditolak papan. Karena satu kejadian hanya boleh memunculkan paling banyak satu pemberitahuan, jalur ini adalah satu-satunya tempat munculnya pesan "langkah cadangan dipakai"; jalur normal (pencarian berhasil) **tidak** memberi pesan apa pun.
