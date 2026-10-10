# ADR-0001 — Satu modul aturan murni sebagai *seam* tunggal untuk aturan kotak

**Status:** Diusulkan (menunggu persetujuan CEO/Team Lead).

**Konteks:** Saat ini aturan kotak diduplikasi: `script.js` punya `isBoxComplete` (akses index langsung, `script.js:616-623`), sementara `ai-engine.js` punya `isBoxAlmostComplete`/`applyCompletedBoxes` dengan pola `?.owner !== null` (`ai-engine.js:148-253`). Dua implementasi ini punya semantik berbeda untuk garis yang tidak ada, dan tidak ada test yang mengunci perilakunya. Akibatnya AI dan permainan nyata bisa berdivergensi, dan tidak ada cara menguji aturan tanpa browser.

**Keputusan:** Ekstrak satu modul aturan murni (tanpa DOM, tanpa `localStorage`, tanpa `Audio`) dengan interface kecil: `createBoard`, `availableMoves`, `applyMove`, `isBoxComplete`, `score`. `script.js` dan `ai-engine.js` sama-sama menjadi konsumen modul ini.

**Konsekuensi:**

- (+) Satu sumber kebenaran aturan; divergensi hilang; aturan dapat diuji via Node tanpa browser.
- (+) `ai-engine.js` menyusut menjadi *decision policy* saja (kebijakan memilih gerakan).
- (−) Refactor menyentuh ketiga berkas sekaligus → butuh langkah bertahap + test penjaga agar perilaku tidak berubah.
- (−) Bila proyek sengaja tetap "no-build, buka-file-langsung", modul harus dimuat via `<script>` global tambahan (bukan ESM), jadi urutan muat tetap jadi kontrak.

**Alternatif yang ditolak:** (a) hanya memperbaiki pola `?.` di `ai-engine.js` — tidak menghapus duplikasi, hanya menyamarkan divergensi; (b) menyerap `ai-engine.js` ke dalam `script.js` — memperburuk berkas yang sudah 1118 baris.
