# Bukti verifikasi independen QA — revisi ke-2 `PROPOSAL-PENGEMBANGAN-DOTBOX.md`

Worktree: /home/serverbot/aidev/workspace/worktrees/dotbox/20261010-214601
Branch: babd/20261010-214601
Commit saat verifikasi: da43ef4 (`feat(p1): wiring produksi turn-queue.js terpasang + test penuntut wiring`)
Node: v20.20.2
Waktu: 2026-10-10 (verifikasi QA ulang, setelah revisi architect)

Metode: setiap sitasi `berkas:baris` dibaca ulang langsung dengan `awk 'NR==...'` (bukan grep),
lalu suite dijalankan ulang oleh QA pada commit di atas.

## 1. Sitasi baris inti — SEMUA COCOK

| Sitasi di proposal | Isi baris sebenarnya | Verdict |
|---|---|---|
| `script.js:756` P0 fallback AI | `if (!move) return;` | ✅ |
| `script.js:768` `SCHEMA_VERSION` | `const SCHEMA_VERSION = 1;` | ✅ |
| `script.js:769–772` `versiDikenal()` | `function versiDikenal(version){ if (version===undefined) return true; return Number.isInteger(version) && version===SCHEMA_VERSION; }` | ✅ |
| `script.js:776` tulis `version` | `version: SCHEMA_VERSION,` | ✅ |
| `script.js:808` tolak versi tak dikenal | `if (!versiDikenal(saveData.version)) return null;` | ✅ |
| `script.js:585` `saveGame()` di `makeMove` | `saveGame();` (baris 585, di dalam `makeMove`) | ✅ |
| `script.js:470` `hitRadius` | `const hitRadius = 30;` | ✅ |
| `script.js:152–157` Box `{owner,edges}` | `boxes = ...map(() => ({ owner: null, edges: { top:null, bottom:null, left:null, right:null } }))` | ✅ |
| `rules.js:42` Box `{owner}` | `Array.from({ length: gridSize-1 }, () => ({ owner: null }))` | ✅ |
| `script.js:206–207` & `:224–225` ukuran kanvas | `canvas.width = size; canvas.height = size;` (dua tempat) | ✅ |
| `script.js:446–448`, `:460–463` hit-test | `getBoundingClientRect()` + `clientX/Y` (mouse) & `touches[0]` (touch), CSS px | ✅ |
| `index.html:5` P3 zoom | `... maximum-scale=1.0, user-scalable=no">` | ✅ |
| `index.html:15` dark toggle tanpa `aria-label` | `<button id="darkModeToggle" class="icon-btn" title="Toggle Dark Mode">` | ✅ |
| `index.html:94–97` tombol replay | 4 `<button class="btn-replay">` tanpa `aria-label` | ✅ |
| `index.html:108` `playAgainBtn` | `<button id="playAgainBtn" class="btn-primary">🎮 Main Lagi</button>` tanpa label | ✅ |

## 2. Sitasi P1 (klaim "P1 TERPASANG") — SEMUA COCOK

- `script.js:45–53` — impor seam tunggal + `const turnQueue = createTurnQueue();` ✅
- Empat jalur `turnQueue.schedule(...)`: `:191` (500), `:604` (400), `:641` (400), `:933` (400) ✅
- Satu penundaan eksekusi: `script.js:734` `turnQueue.schedule(executeAIMove, 300)` (di dalam `makeAIMove()`) ✅
- `aiMoveTimeout` di `script.js` → **0 hasil** (terhapus) ✅
- `turnQueue.clear()`: `:885` (`loadGame`) dan `:1064` (`resetBoardOnly`) ✅
- `index.html:118` memuat `turn-queue.js` **sebelum** `script.js:120` (urutan: rules → turn-queue → ai-engine → script) ✅

## 3. Bukti suite — angka yang dikutip BENAR, dan bisa direproduksi

Eksekusi ulang oleh QA (commit `da43ef4`):

```
$ node --test            # dijalankan QA, bukan sekadar mengutip berkas
1..56
# tests 56
# pass 56
# fail 0
# exit=0
```

Berkas bukti yang dikutip cocok kata demi kata:

- `docs/bukti/node-test-qa-polos.txt:288–294` → `# pass 56` / `# fail 0` / `exit=0` ✅
- `docs/bukti/p1-terpasang.txt:150–158` → `# pass 56` / `# fail 0` / `# exit=0` ✅
- `docs/bukti/node-test-p1-terpasang.txt` → `# tests 56` / `# pass 42` / `# fail 14` ✅ (ditulis persis "42 lulus/14 gagal", **tidak** tertukar)
- Nama berkas `node-test-polos-qa.txt` (52/52, tidak pernah ada) → sudah dihapus dari dokumen ✅

### 3a. Rincian 14 kegagalan `node-test-p1-terpasang.txt` (dikonfirmasi, sesuai §7.6)

| # | Nama test | Sebab |
|---|---|---|
| 6, 7, 8 | penjadwal lama `setTimeout(() => makeAIMove)`, `aiMoveTimeout` | mengassert kode **pra-P1** (memang sudah tidak ada) |
| 17, 18, 19 | QA-1/1b/1c handler `.grid-btn` & invarian papan | `require is not defined` di sandbox |
| 20, 21 | QA-2/2b `loadGame` tolak save tak valid | `require is not defined` |
| 22 | QA-3 replay deterministik | `require is not defined` |
| 42, 43, 44, 45, 46 | `makeMove`/papan penuh/replay di `script-integration` | `require is not defined` |

Jadi klaim proposal "3 test `bukti-eksekusi` + 11 `qa-regressions`/`script-integration`" **tepat**.
Ke-14 test itu **hijau** pada suite hari ini (`p1-terpasang.txt` 56/56, direproduksi).
Catatan pembeda waktu di §7.6 sah.

### 3b. Test kunci ada & benar-benar menuntut wiring

- `test/p1-wiring.test.js` → 4/4 hijau; isinya **5 rujukan** `aiMoveTimeout` (assert negatif) ✅
- Test ke-13..16 = wiring P1 `ok` ✅; ke-37..41 = save-schema `ok` ✅; ke-53..56 = perilaku `turn-queue` `ok` ✅

## 4. Klaim "nomor baris bergeser" — konsisten

Semua nomor **lama** yang disebut draf (`:746`, `:575`, `:460`, `:142`, `:196–197`) memang tidak
lagi menunjuk sasaran yang sama; versi **baru** (`:756`, `:585`, `:470`, `:152–157`, `:206–207`)
sudah diverifikasi di tabel §1. Perhitungan pergeseran tidak saling bertentangan.

## 5. Satu ketidaktepatan yang tersisa (koreksi kecil, bukan blokir)

§4 P2 butir (b) menulis pesan galat ada di **"`script.js:900` area"**. Baris 900 memang
`console.error('Save ditolak: struktur data tidak valid');` — **benar**, tetapi penyebabnya
bercampur: `buatKandidatState` (`:804–808`) mengembalikan `null` **baik** untuk versi tak dikenal
**maupun** struktur tak valid, sehingga `:900` tidak bisa membedakan keduanya. Itu justru
**membenarkan** usulan (b) — hanya kata "area" yang sebaiknya diganti angka pasti `:900`
(dan rujukkan `:804–808` sebagai sumber `null`).

## 6. Non-klaim yang tetap berlaku

"56/56" **tidak** membuktikan: (a) AI tidak pernah menggantung (V12 masih `return` telanjang —
dikonfirmasi di `:756`), (b) aksesibilitas (aria-label = **0 hasil** di seluruh repo, dicek ulang),
(c) ketajaman HiDPI (0 `dpr`/`setTransform`), (d) perilaku di peramban nyata (tidak ada harness E2E).

## 7. Kesimpulan

Revisi ke-2 **lolos verifikasi independen**: seluruh sitasi §2.1/§4 yang diminta diuji
(`script.js:756`, `:768`, `:776`, `:808`, `:585`, `:152–157`, `index.html:5`) **menunjuk baris yang
benar**; angka suite **56/56 `exit=0`** **direproduksi** oleh QA; `node-test-p1-terpasang.txt`
**benar** berisi 42/14; blok bukti §7.7 akurat. Status **P0 [TERVERIFIKASI]** dan **P3
[TERVERIFIKASI]** sah. Satu koreksi kosmetik: ganti "`:900` area" → "`:900`" dan tambahkan
rujukan `:804–808`. **Tidak ada temuan yang membatalkan kesimpulan proposal.**
