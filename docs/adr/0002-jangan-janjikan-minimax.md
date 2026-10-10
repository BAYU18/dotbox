# ADR-0002 — Jangan janjikan Minimax sebelum benar-benar ada

**Status:** Diusulkan.

**Konteks:** README (`README.md:41-44`) menjanjikan "Minimax Algorithm" dan "Alpha-Beta Pruning", tetapi `getBestMove` (`ai-engine.js:43-71`) adalah heuristik greedy 3-prioritas tanpa lookahead, dan `aiDepth` tidak berpengaruh. Ini kontrak yang tidak benar — pengguna memilih tingkat kesulitan yang sebenarnya tidak mengubah apa pun.

**Keputusan:** Pilih salah satu, jangan keduanya: **(a)** implementasikan minimax + alpha-beta berkedalaman `aiDepth` sehingga `aiDepth` benar-benar berarti, atau **(b)** perbaiki README/nama parameter agar jujur menyebut heuristik greedy, dan ganti `aiDepth` menjadi sesuatu yang nyata (mis. varian heuristik). Rekomendasi: mulai dari (b) untuk jujur cepat, lanjut (a) sebagai fitur bernilai.

**Konsekuensi:**

- (+) Menghapus kebohongan dokumentasi; ekspektasi pengguna akurat.
- (−) (a) menambah biaya kinerja; pada grid 7×7 perlu batas kedalaman & time budget agar UI tidak membeku.
- (−) Perubahan ke (a) mengubah kekuatan AI → perlu diuji main ulang (regresi kekuatan permainan).

**Alternatif yang ditolak:** membiarkan README dan kode tidak sinkron — ini hazard kepercayaan (bug dokumentasi), bukan trade-off.
