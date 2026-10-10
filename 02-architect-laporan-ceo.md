# Desain Sistem — Eksekusi Seluruh Masukan Proposal `dotbox` + Push ke `master`

**Untuk:** CEO (dibaca manusia, bukan log)
**Dari:** Architect — Rancang Sistem
**Tanggal:** 2026-10-10 · **Cabang:** `babd/20261010-230647`

---

## TL;DR

Tugasnya **mengerjakan semua masukan proposal `dotbox` lalu push ke GitHub master**. Saya membaca ulang
kodenya sendiri, baris per baris, dan hasilnya menentukan ukuran pekerjaan: **P1 (penjadwal giliran AI)
dan P2 (versi skema save) sudah terpasang**; yang **belum** adalah **P0, P3, P6, P2-sisa, P5, dan P4**.
Desain ini membaginya menjadi **tiga gelombang yang tidak saling menabrak**, dengan **P7 (PWA/uji E2E)
sengaja tidak dikerjakan** karena proposal Anda sendiri menandainya butuh keputusan Anda.

**Temuan paling berharga di langkah ini:** desain sebelumnya **menahan paket P0 (perbaikan yang paling
terlihat pemain) di belakang pekerjaan QA yang ternyata tidak perlu** — saya membaca testnya sendiri dan
mencabut penahan itu (§3).

---

## 1. Keadaan sebenarnya hari ini (pembacaan sendiri, bukan kutipan)

| Item | Artinya bagi pemain | Status | Bukti baris |
|---|---|---|---|
| **P1** penjadwal giliran tunggal | AI tidak "bergerak dua kali" | ✅ **ada** | `script.js:45–53`, `:734`; `index.html:118` |
| **P2** versi skema save | save lama tidak merusak permainan | ✅ **ada** | `script.js:768–776`, `:808` |
| **P0** giliran AI menggantung | **papan diam tanpa penjelasan — paling terlihat** | ❌ belum | `script.js:756` `if (!move) return;` |
| **P3** aksesibilitas | pembaca layar & pengguna zoom tertutup | ❌ belum | `index.html:5` `user-scalable=no`; `aria-label` = **0** |
| **P6** `Box.edges` mati | membingungkan pemelihara kode | ❌ belum | `script.js:152–157` |
| **P2-sisa** diagnosa save | dua sebab penolakan tak bisa dibedakan | ❌ belum | `script.js:804` (tiga `return null` telanjang) |
| **P5** ketajaman HiDPI | kanvas kabur di layar Retina | ❌ belum | `script.js:206–207`, `:224–225`; `devicePixelRatio` 0 hasil |
| **P4** telemetri + hemat I/O | tulis `localStorage` tiap langkah | ❌ belum | `script.js:585` |
| **P7** PWA + uji E2E | belum bisa dipasang/offline | ❌ belum | tidak ada manifest/service worker |

QA sudah menyiapkan test penuntut perilaku untuk P0/P6/P2 di `test/proposal-p0-p6.test.js` — gerbang
"gagal dulu, hijau sesudahnya" sudah ada.

---

## 2. Rencana tiga gelombang (satu penulis per berkas)

```
GELOMBANG 1 — perbaikan pemain + pembersihan data
   p0    : fallback giliran AI                     → script.js
   p3    : aksesibilitas (zoom, label, fokus)      → index.html, style.css, updateUI
   p6p2s : Box kanonik + migrasi save + pesan galat → script.js
   ── gerbang: node --test hijau ──

GELOMBANG 2 — ketajaman HiDPI (satu PR, tidak dipecah)
   p5    : DPR scale + satu helper koordinat input → script.js

GELOMBANG 3 — telemetri & hemat I/O
   p4a   : save di akhir giliran + beforeunload + rapikan audio
   p4b   : panel diagnosa hanya via ?dev=1

VERIFIKASI & OPS
   QA     : suite penuh, probe grep, triase ber-bukti baris
   DEVOPS : push ke master TANPA --force; bila ditolak → berhenti & lapor
```

**Mengapa berurutan di dalam G1.** Ketiga paket menyunting **berkas yang sama** (`script.js`); paralel
akan menabrakkan suntingan. **Mengapa P5 sendiri.** P5 paling berbahaya bila setengah jalan: bitmap
di-×DPR tanpa konversi input = **hit-test sentuhan langsung rusak**. Wajib satu PR.

---

## 3. Koreksi terhadap desain sebelumnya (penting)

Revisi 2 menahan **seluruh P0** di belakang paket QA dengan alasan *"kalau tidak, developer mengejar
lampu merah palsu"*. Saya membaca ketiga test itu sendiri:

- `P0-a` (`test/proposal-p0-p6.test.js:143`) dan `P0-c` (`:244`) **sudah** menyadap objek yang benar.
- `P0-b` (`:192`) masih memakai bentuk global, **tetapi** mengukur hasil lewat `makeMove` (`:199`) — jadi
  tetap mengukur hal yang benar. Ini soal kerapian, bukan test rusak.

**Keputusan saya:** P0 mulai **tanpa menunggu**. Perbaikan `:192` diturunkan menjadi **opsional, tidak
memblokir apa pun**. Ini **deviasi sadar** dari desain sebelumnya, dan saya sebut alasannya: menahan satu
siklus review untuk sesuatu yang tidak rusak adalah waktu yang dibuang.

Koreksi lain: nomor baris di desain lama **usang** (kode bertambah) → setiap task sekarang **wajib menutup
dengan `grep`**. Dan saya menambahkan **satu test baru (P0-d)**: asersi lama bisa **hijau walau pemain tetap
tidak diberi tahu**, padahal proposal menuntut pemain diberi tahu bila langkah cadangan dipakai.

---

## 4. Keputusan kunci & alasannya

| Keputusan | Alasan |
|---|---|
| P0 mulai tanpa menunggu QA | P0-a/P0-c sudah benar; P0-b mengukur lewat `makeMove`. Tidak ada merah palsu. |
| Langkah cadangan **deterministik**, bukan acak | Proposal menulis "acak ber-seed", tetapi **tidak ada RNG** di kode; menambahkannya = state global baru yang bisa bocor antar-test. Ini deviasi sadar, saya sebut apa adanya. |
| `if (!move) return;` **dihapus total** | `return` telanjang itu **adalah** bug-nya; bila digabung `&&`, `grep` penjaga tidak menemukannya lagi. |
| Test baru **P0-d** | Menuntut "pemain diberi tahu", bukan sekadar "ada sesuatu yang terjadi". |
| **P7 tidak dikerjakan** | Proposal §5.2 menandainya butuh keputusan Anda (menambah Playwright ke proyek **nol dependensi**). |
| **P4 dijalankan sebagai G3**, dan **P4 yang di-drop** bila anggaran habis | P4 bergantung P5 (overlay menampilkan DPR) dan mengubah kapan data pemain disimpan. |
| Push tanpa `--force`, remote diperiksa dulu | Menimpa riwayat orang lain bukan wewenang tim; bila ditolak kita **lapor**. |

**Jaminan mengikat pada P4:** overlay **hanya** di `?dev=1`; save tetap ditulis tiap akhir giliran **dan**
ada `beforeunload`; audio dirapikan tanpa mengubah nada.

---

## 5. Risiko & penahannya

| Risiko | Dampak | Penahan |
|---|---|---|
| Nomor baris usang | menyunting baris salah | tiap task tutup dengan `grep` |
| Test lama mengunci **bug** | suite merah walau kode benar | test disesuaikan di paket yang sama |
| P5 setengah jalan | **hit-test rusak** | satu PR + test konversi input |
| P4 menunda tulis save | kehilangan permainan | `beforeunload` + akhir giliran; test wajib |
| Klaim "selesai" berlebihan | laporan tidak jujur | laporan **wajib** sebut yang tidak diuji |
| `push` non-fast-forward | menimpa riwayat orang lain | tanpa `--force`; berhenti & lapor |

---

## 6. Status & langkah berikutnya

**Selesai di langkah ini:** spesifikasi revisi 3 tersimpan di repositori
(`docs/superpowers/specs/2026-10-10-eksekusi-r3-final-design.md`); glosarium ditambah istilah "jalur
cadangan".

**Belum selesai (memang belum boleh):** seluruh kode produksi. Itu pekerjaan developer setelah Lead
membagi tiket.

**Satu hal yang perlu dibersihkan.** Langkah desain ini secara tidak sengaja meninggalkan satu berkas stub
kosong (`scripts/run-tests-verify.js`, tanpa kode produksi) dan **saya tidak bisa menghapusnya sendiri**
karena langkah desain tidak punya akses shell. Berkas itu sekarang dibuat **berteriak** bila dijalankan,
dan spek mencatat perintah bersihnya: `rm scripts/run-tests-verify.js`. Developer/DevOps wajib
menghapusnya sebelum commit.

**Status verifikasi (jujur).** Saya **tidak bisa menjalankan test** di langkah ini. Yang bisa saya lakukan:
menambahkan satu skrip tanpa dependensi, `scripts/bukti-klaim-desain.js`, yang memeriksa **setiap klaim
`berkas:baris`** di desain terhadap kode nyata — dan saya **membaca ulang satu per satu baris yang
di-assert** (`script.js:756`, `:585`, `test/proposal-p0-p6.test.js:199`) untuk memastikan skripnya sendiri
benar. **Angka hasil suite masih belum diketahui** sampai developer/QA menjalankannya; itu sebabnya
"jalankan baseline lebih dulu" adalah langkah wajib pertama.

**Langkah berikutnya:**

1. **Developer** jalankan **baseline test** lebih dulu, lampirkan keluaran mentah; bila ≠ harapan,
   **berhenti dan lapor**.
2. **Developer** kerjakan G1 berurutan: `p0 → p3 → p6p2s`.
3. **QA** verifikasi independen sebelum G2, dan sekali lagi sebelum push.
4. **DevOps** periksa `git remote -v` **sebelum** push.

**Pertanyaan terbuka untuk Anda:**

1. **P7 (PWA/uji E2E)** — sekarang (a), tunda sampai ada pengguna nyata (b), atau PWA minimal tanpa
   Playwright (c)? Rekomendasi saya: **(b) atau (c)**.
2. **Cakupan push** — semua gelombang langsung ke `master`, atau satu pull request dulu untuk ditinjau?

---

## Lampiran: perintah verifikasi

```bash
# 1. Baseline — WAJIB lebih dulu, sebelum menyentuh kode
node --test
grep -n "if (!move) return" script.js        # harapan awal: 1 hasil (baris 756)
grep -c "aria-label" index.html              # harapan awal: 0

# 2. Gerbang tiap paket
node --test test/proposal-p0-p6.test.js
node --test test/bukti-eksekusi.test.js
node --test test/aksesibilitas.test.js
node --test test/p2-sisa.test.js
node --test test/dpr.test.js

# 3. Gerbang tunggal akhir (QA)
node --test
```

**Batas jujur:** perintah di atas **belum saya jalankan** di langkah ini (tanpa akses shell). Angka
hasilnya harus berasal dari keluaran mentah di `docs/bukti/`, bukan ringkasan percakapan.

**Tidak ada rahasia, token, atau kata sandi di dokumen ini.**
