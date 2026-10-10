# Rancangan P2-sisa — Migrasi save + pesan galat versi yang bisa didiagnosis

**Tanggal:** 2026-10-10
**Status:** kontrak untuk implementasi (spec → plan → test)
**Basis:** `PROPOSAL-PENGEMBANGAN-DOTBOX.md` §4 P2 + Ruling 1 & Ruling 3,
`GLOSSARY.md` §Data simpanan, `docs/superpowers/specs/2026-10-10-p1-turn-queue-dan-skema-save-design.md`.

## 1. Keadaan sekarang (terverifikasi baris)

- `script.js:768` `const SCHEMA_VERSION = 1;`
- `script.js:769-772` `versiDikenal(version)`: `undefined` → `true` (save warisan = v1);
  selain itu wajib `Number.isInteger(version) && version === SCHEMA_VERSION`.
- `script.js:776` `saveGame()` menulis `version: SCHEMA_VERSION`.
- `script.js:802` `SAVE_KEYS` (tanpa `version`); `script.js:808` cek versi lebih dulu,
  `script.js:810-812` cek kunci wajib.
- `script.js:899-902` **satu** pesan galat gabungan:
  `console.error('Save ditolak: struktur data tidak valid')`.
- Test `test/save-schema.test.js` (5 test) hijau — belum ada test migrasi save ber-`edges`.

## 2. Masalah

1. **Belum ada test** yang membuktikan save lama ber-`edges` (bentuk lama, P6 akan
   menghapus `edges`) tetap dimuat utuh — asumsi A7 masih terbuka.
2. **Pesan galat tidak bisa didiagnosis:** kasus "versi tak dikenal" (`:808`) dan
   "struktur tak valid" (`:810-812`) menghasilkan pesan `console.error` yang sama
   (`:900`), sehingga QA/CEO tidak bisa membedakan dari log mana pun yang salah.

## 3. Keputusan yang mengikat

- **Ruling 1:** bentuk kanonik `Box` adalah `{ owner }`. Save lama **ber-`edges` tetap
  diterima** dan `boxesGained`/papan hasilnya identik; `edges` di dalam box **tidak**
  disimpan kembali (kandidat state hanya menyalin `owner`, lihat `:872`).
- **Ruling 3:** P2-sisa dikerjakan **setelah** P6 (satu perubahan bentuk data per langkah).
  Urutan dalam rencana ini: p1 (dead write `edges`) → p3 (test migrasi + pesan galat).
- `SAVE_KEYS` **tidak** ditambahi `version` (supaya save warisan tetap lolos cek kunci);
  `version` selalu diperiksa lebih dulu lewat `versiDikenal()`.
- Save valid **tidak boleh** memutasi `gameState` bila ditolak (aturan atomik QA-2).

## 4. Perubahan yang diinginkan

### 4.1 Diagnosa alasan penolakan (tanpa mengubah perilaku)

`buatKandidatState(saveData)` tetap mengembalikan `null` pada penolakan (kontrak
publiknya tidak berubah — test lama bergantung padanya), tetapi **alasan** penolakan
harus tersedia untuk pesan log. Cara yang dipilih: fungsi ubahsuai menerima objek
opsional `alasan` (mis. `buatKandidatState(saveData, alasan)`) dan menulis salah satu
nilai berikut ke `alasan.kode`:

| `alasan.kode` | Kapan | Pesan yang dicetak `loadGame` |
|---|---|---|
| `'bukan-objek'` | `saveData` bukan objek / array | `Save ditolak: data simpanan bukan objek.` |
| `'versi-tak-dikenal'` | `versiDikenal()` `false` | `Save ditolak: versi skema tidak dikenal.` |
| `'struktur-tak-valid'` | kunci wajib hilang, ukuran papan salah, dll | `Save ditolak: struktur data tidak valid.` |

Nama/kunci (`kode`) bebas dipilih implementer **asalkan** tiga kelas berbeda itu bisa
dibedakan dari `console.error`, dan string pesan tetap Bahasa Indonesia.

### 4.2 Test migrasi save lama ber-`edges`

Test (RED dulu, GREEN sesudahnya) yang membangun save **tanpa `version`** dengan bentuk
**lama**: setiap box `{ owner: null, edges: { top: null, bottom: null, left: null, right: null } }`,
lalu memuatnya dan memastikan:

1. `loadGame()` / `buatKandidatState()` **menerima** save tersebut (hasil bukan `null`).
2. Setiap box pada state hasil hanya punya kunci `owner` (tanpa `edges`) — bentuk kanonik.
3. `gameState.boxes` yang terpasang **tidak** memuat `edges` (kunci `edges` di dalam box
   hilang setelah `loadGame`).
4. `gameState` **tidak berubah** bila save ditolak (sudah dicakup test QA-2; cukup
   dipastikan tidak regresi).

## 5. Risiko

| Risiko | Mitigasi |
|---|---|
| Mengubah `buatKandidatState` merusak test save-schema lama | Kontrak "return null bila ditolak" dipertahankan; parameter kedua opsional |
| Pesan galat menyentuh kasus JSON rusak (`:890-893`) | Kasus itu sudah punya pesan sendiri; jangan digabung |
| Menambah `version` ke `SAVE_KEYS` membuat save warisan ditolak | Dilarang — dinyatakan eksplisit di §3 |
