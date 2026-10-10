# Rancangan P0 — Fallback giliran AI + pemberitahuan pemain

**Tanggal:** 2026-10-10
**Status:** kontrak untuk implementasi (spec → plan → test)
**Basis:** `PROPOSAL-PENGEMBANGAN-DOTBOX.md` §4 P0, `PROPOSAL-PENGEMBANGAN.md` §3.1 P0-2,
`GLOSSARY.md` §Penjadwalan giliran, `docs/adr/0001-seam-aturan-murni.md`.

## 1. Masalah

`script.js:756` berisi `if (!move) return;` di dalam `executeAIMove()`. Bila
`aiEngine.getBestMove()` mengembalikan `null`, fungsi keluar **tanpa** memanggil
`makeMove`, `switchTurn`, `endGame`, atau `showToast`. Akibatnya dari sudut pemain:
papan diam, tidak ada pesan, giliran tidak berpindah — aplikasi terasa rusak.

Dibuktikan **dinamis** (harness `scripts/bukti-eksekusi.js` bagian 3a): `makeMove`
dipanggil 0×, `switchTurn` tidak, `endGame` tidak, `showToast` tidak.

## 2. Keputusan desain (sudah diambil di proposal §5.1 — tidak dibuka lagi)

1. **Jangan pernah diam.** Setiap jalur keluar dari `executeAIMove()` harus
   berakhir di salah satu dari tiga: gerakan benar-benar dilakukan, giliran
   berpindah dengan pemberitahuan, atau permainan dinyatakan selesai.
2. **Fallback memakai `Rules.availableMoves`, bukan daftar gerakan sendiri.**
   Satu sumber aturan (ADR-0001). Dilarang menduplikasi aturan papan di
   `script.js`.
3. **Aturan kemenangan validasi fallback tetap `makeMove`.** `executeAIMove`
   **tidak** boleh memanggil `Rules.applyMove` dan menulis papan sendiri —
   jalur tulis papan tunggal tetap `makeMove` → `checkBoxCompletion` →
   `Rules.applyMove`.
4. **Tidak ada `setTimeout` baru.** Penjadwalan tetap lewat `turnQueue`.
5. **Giliran yang tidak bergerak wajib memberi tahu pemain** lewat `showToast`
   (Bahasa Indonesia).

## 3. Perilaku target (kontrak, bukan saran)

`executeAIMove()` setelah perubahan:

```
guard lama (isGameOver / isReplayMode / !aiEngine / bukan AI)  -> return (tidak berubah)

move <- aiEngine.getBestMove(aiState, gameState.currentPlayerIndex)

bila move benar-benar ada dan makeMove(move.type, move.row, move.col) === true:
    selesai (perilaku lama; giliran ekstra & penjadwalan lanjutan ditangani makeMove)

selain itu (move null/undefined ATAU makeMove mengembalikan false):
    kandidat <- Rules.availableMoves(gameState)      // MURNI, tidak mengubah papan
    bila kandidat.length > 0:
        pilih satu secara deterministik (indeks 0)
        showToast('AI: langkah cadangan dipakai karena pencarian gagal.')
        makeMove(pilihan.type, pilihan.row, pilihan.col)
        tapi bila makeMove ini JUSTRU mengembalikan false:
            switchTurn()
            showToast('AI tidak dapat bergerak; giliran dialihkan.')
    selain itu (tidak ada gerakan legal = papan penuh):
        showToast('Tidak ada langkah tersisa. Permainan selesai.')
        endGame()
```

Catatan penting:

- **Jangan menguji "sisa langkah" dengan `isGameOver()` sebagai pengganti
  `Rules.availableMoves`.** `isGameOver()` menghitung kotak terisi, dan ada
  keadaan di mana kotak belum penuh tetapi `availableMoves` kosong — justru
  keadaan itulah yang membuat `getBestMove()` mengembalikan `null`.
- `Rules.availableMoves(gameState)` menerima `gameState` nyata (bukan `aiState`
  salinan) dan tidak boleh memutasi apa pun.
- Pemberitahuan wajib muncul **tepat satu kali** per kejadian; jangan
  menumpuk tiga toast sekaligus pada keadaan yang sama.
- `makeMove` yang mengembalikan `false` karena garis sudah dimiliki tidak boleh
  membuat loop tak berujung: fallback mencoba **satu** kandidat, tidak menelusuri
  daftar berulang-ulang.

## 4. Titik uji (seam) — sudah ada, tidak perlu yang baru

Titik uji yang dipakai test adalah stub DOM yang sudah dipakai suite sekarang
(`test/script-integration.test.js`, `test/qa-regressions.test.js`): jalankan
`script.js` di sandbox, suntikkan `AIEngine` palsu, lalu panggil `executeAIMove()`
dan periksa `gameState` + spionase `showToast`/`switchTurn`/`endGame`.

Dua test wajib (RED dulu, GREEN sesudahnya):

1. **`getBestMove` mengembalikan `null`, papan MASIH punya garis kosong** →
   `makeMove` efektif terjadi: `gameState.moveHistory.length === 1`, garis yang
   dipilih ber-`owner === 0` (pemain AI), dan `showToast` dipanggil.
2. **Tidak ada gerakan legal** (semua garis terisi) → `endGame` dipanggil
   **atau** `gameState.isGameOver` menjadi `true`, dan `showToast` dipanggil.

## 5. Risiko

| Risiko | Mitigasi |
|---|---|
| Fallback acak/deterministik memilih langkah legal tapi buruk | Hanya dipakai saat AI gagal total, dan selalu lewat `Rules.availableMoves` |
| Fallback dianggap "perbaikan AI" lalu diubah menjadi pemilihan cerdas | **Di luar lingkup**: fallback adalah jaring keselamatan, bukan strategi. Pembelajaran strategi ada di P1 (chain awareness) |
| Perubahan `executeAIMove` merusak jalur giliran ekstra | `makeMove` tetap satu-satunya pemanggil penjadwalan; fallback hanya dipakai saat `makeMove` tidak terjadi/gagal |
