# ADR-0003 — Langkah cadangan giliran AI bersifat deterministik, bukan acak ber-seed

**Status:** Diusulkan (menunggu persetujuan Team Lead/CEO).
**Konteks:** `PROPOSAL-PENGEMBANGAN-DOTBOX.md` §4 P0 mengusulkan bahwa bila `aiEngine.getBestMove()`
mengembalikan `null`, `executeAIMove` mengambil langkah cadangan dari `Rules.availableMoves` dengan
**pemilihan acak ber-seed**. Saat diperiksa langsung di worktree `20261010-230647`, **tidak ada RNG
ber-seed** di `script.js`; satu-satunya keacakan hidup di `ai-engine.js:39` dan `:291` (`Math.random()`
polos, tanpa seed), dan `getBestMove` untuk papan kosong juga memakai `Math.random()`.

Jadi "acak ber-seed" bukan satu baris — ia berarti memperkenalkan **state global RNG baru** ke
`script.js`, satu-satunya berkas yang saat ini tidak punya state implisit di luar `gameState`, plus
mekanisme seed untuk test. Semua itu untuk sebuah jalur yang hanya aktif saat pencarian gagal total.

**Keputusan:** Langkah cadangan di `executeAIMove` memilih `Rules.availableMoves(gameState)[0]` —
**deterministik**. Tidak ada RNG baru di `script.js`. Alasan:

- **Deterministik = dapat diuji.** Test bisa menuntut garis tertentu tanpa menyuntikkan seed, dan
  jalur fallback tidak menambah ketergantungan waktu/acak ke suite.
- **Efek pemain identik.** Jalur ini hanya dijalankan saat AI gagal menghasilkan langkah apa pun; pada
  saat itu kualitas pemilihan bukan lagi variabel yang berarti, karena alternatifnya adalah **papan
  diam**.
- **Aturan tetap satu sumber (ADR-0001).** Kandidat tetap berasal dari `Rules.availableMoves`, bukan
  daftar yang disusun ulang di `script.js`.

**Konsekuensi:**

- (+) Satu baris, tanpa state baru, tanpa perubahan pada `rules.js`/`ai-engine.js`.
- (+) Test `test/proposal-p0-p6.test.js` (`P0-b`) tetap sah apa adanya: ia memeriksa bahwa langkah yang
  dimainkan **anggota** himpunan `Rules.availableMoves`, bukan langkah tertentu — jadi keputusan ini
  tidak memaksa test diubah.
- (−) Bila kelak kita ingin fallback yang lebih pintar (mis. memilih langkah **aman** terakhir seperti
  usulan `PROPOSAL-PENGEMBANGAN.md` §5.1 "N1 fallback"), keputusan ini harus diganti. Ambang penggantinya
  jelas: **bila ada bukti pemain melihat fallback dan langkahnya buruk.** Sampai itu ada, ini YAGNI.
- (−) Menyimpang dari teks proposal §4 P0 ("acak ber-seed"). Penyimpangan ini **dicatat**, bukan
  disembunyikan; spec eksekusi (`2026-10-10-eksekusi-p0-p5-dotbox-design.md` §1 K4) memuat alasannya.

**Alternatif yang ditolak:** (a) menambah RNG ber-seed ke `script.js` — state global baru demi jalur
jaring keselamatan; (b) memakai `Math.random()` seperti di `ai-engine.js` — bukan "ber-seed", jadi lebih
buruk dari (a) karena tidak dapat direproduksi test; (c) langsung `switchTurn()` tanpa memainkan langkah —
membuang satu giliran AI secara tidak sah padahal masih ada garis kosong, dan tidak sesuai kontrak
`Rules.availableMoves` sebagai satu-satunya daftar langkah legal.
