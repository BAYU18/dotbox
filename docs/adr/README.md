# Daftar Keputusan (ADR) — dotbox

Catatan keputusan arsitektur. Setiap ADR hanya dibuat bila: sulit dibalik, membingungkan tanpa konteks, dan merupakan hasil trade-off nyata.

- [ADR-0001](./0001-seam-aturan-murni.md) — Satu modul aturan murni sebagai *seam* tunggal untuk aturan kotak.
- [ADR-0002](./0002-jangan-janjikan-minimax.md) — Jangan janjikan Minimax sebelum benar-benar ada.
- [ADR-0003](./0003-fallback-giliran-ai-deterministik.md) — Langkah cadangan giliran AI deterministik, bukan acak ber-seed.
- [ADR-0004](./0004-tulis-save-di-akhir-giliran.md) — Save ditulis di akhir giliran (bukan di tengah `makeMove`), dengan penyelamat `beforeunload`.
