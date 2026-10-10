# Desain & Spesifikasi — Eksekusi Seluruh Masukan Proposal `dotbox` + Push ke `master`

**Untuk:** CEO (dibaca manusia, bukan log)
**Dari:** Architect — Rancang Sistem
**Tanggal:** 2026-10-10 · **Cabang:** `babd/20261010-230647`
**Berkas desain teknis lengkap:** `docs/superpowers/specs/2026-10-10-eksekusi-r3-final-design.md`

---

## TL;DR (4 kalimat)

Permintaan Anda adalah **mengerjakan semua masukan proposal `dotbox` lalu push ke GitHub master**.
Saya membaca ulang kodenya **sendiri, baris per baris, di worktree ini** dan hasilnya menentukan ukuran
pekerjaan: **P1 (penjadwal giliran AI) dan P2 (versi skema save) sudah terpasang**, sementara
**P0, P3, P6, P2-sisa, P5, dan P4 belum**. Desain ini membagi sisanya menjadi **tiga gelombang yang tidak
saling menabrak** — G1 (perbaikan pemain + pembersihan data), G2 (ketajaman HiDPI), G3 (telemetri) —
dengan **P7 (PWA/uji E2E) sengaja tidak dikerjakan** karena proposal Anda sendiri menandainya butuh
keputusan Anda. Yang paling penting dari revisi ini: **saya menemukan dan mencabut satu nasihat di
desain sebelumnya yang bisa membuat tim membuang waktu**, dijelaskan di bagian "Koreksi" di bawah.

---

## 1. Apa yang saya lakukan di langkah ini

Saya **tidak menulis satu baris kode produksi pun**. Tugas saya merancang sistem, jadi yang saya lakukan:

1. **Membaca kode nyata** — `script.js` (1.257 baris), `index.html`, `rules.js`, `turn-queue.js`,
   `GLOSSARY.md`, seluruh ADR, dan dua revisi desain sebelumnya.
2. **Memverifikasi ulang setiap klaim baris** yang diwarisi dari desain lama, karena nomor baris
   bergeser setiap kali kode bertambah.
3. **Menulis spesifikasi revisi 3** ke repositori, dengan kontrak yang bisa langsung dieksekusi developer:
   potongan kode persis, nama test persis, dan perintah gerbang persis.
4. **Mengoreksi tiga hal** dari desain revisi 2 yang keliru (bagian 3).

Yang **tidak** saya lakukan, dan saya katakan terus terang: **saya tidak menjalankan `node --test`** —
langkah ini tidak punya akses shell. Karena itu semua angka "test hijau" yang beredar di dokumen tim
adalah **kutipan dari berkas bukti lama**, bukan hasil saya. Saya jadikan "jalankan baseline lebih dulu"
sebagai **langkah wajib pertama** developer dan QA.

---

## 2. Keadaan sebenarnya hari ini (hasil pembacaan saya sendiri)

| Item | Artinya bagi pemain | Status | Bukti |
|---|---|---|---|
| **P1** penjadwal giliran tunggal | AI tidak "bergerak dua kali" | ✅ **sudah ada** | `script.js:45–53`, `:734`, `:191`; `index.html:118` |
| **P2** versi skema save | save lama tidak merusak permainan | ✅ **sudah ada** | `script.js:768–776`, `:808` |
| **P0** giliran AI menggantung | **papan diam tanpa penjelasan — ini yang paling terlihat** | ❌ belum | `script.js:756` masih `if (!move) return;` |
| **P3** aksesibilitas | pembaca layar & pengguna zoom masih tertutup | ❌ belum | `index.html:5` masih `user-scalable=no`; jumlah `aria-label` = **0** |
| **P6** `Box.edges` mati | membingungkan pemelihara kode | ❌ belum | `script.js:152–157` |
| **P2-sisa** diagnosa save | dua sebab penolakan save tak bisa dibedakan | ❌ belum | `script.js:804` — tiga `return null` telanjang (`:805`, `:808`, `:811`) |
| **P5** ketajaman HiDPI | kanvas tampak kabur di layar Retina | ❌ belum | `script.js:206–207`, `:224–225`; `devicePixelRatio` = **0 hasil** |
| **P4** telemetri + hemat I/O | tulis `localStorage` setiap langkah | ❌ belum | `script.js:585` |
| **P7** PWA + uji E2E | belum bisa dipasang/di-offline-kan | ❌ belum | tidak ada manifest/service worker |

**Kabar baik yang perlu Anda tahu:** QA sudah menyiapkan **test penuntut perilaku** untuk P0/P6/P2 di
`test/proposal-p0-p6.test.js`. Jadi gerbang "gagal dulu, hijau sesudahnya" sudah tersedia — kita tidak
menulis test dari nol.

---

## 3. Koreksi penting: desain sebelumnya menahan pekerjaan tanpa alasan yang sah

Revisi 2 desain menahan **seluruh paket P0 (perbaikan paling terlihat bagi pemain di belakang sebuah
paket QA** yang katanya harus memperbaiki dua test dulu, dengan alasan: *"kalau tidak, developer akan
mengejar lampu merah palsu."*

Saya membaca ketiga test itu **baris per baris**, dan **alasan itu tidak lagi berlaku**:

- `P0-a` (`test/proposal-p0-p6.test.js:143`) **sudah** menyadap objek yang benar (`aiEngine.getBestMove`).
- `P0-c` (`:244`) juga **sudah** benar.
- `P0-b` (`:192`) memang masih memakai bentuk global — **tetapi** test itu mengukur hasilnya lewat
  `makeMove` (`:199`), jadi ia **tetap mengukur hal yang benar**. Ini soal kerapian, bukan test rusak.

**Akibatnya saya ambil keputusan:** P0 **mulai sekarang**, tanpa menunggu paket QA. Perbaikan baris
`:192` saya turunkan menjadi **opsional dan tidak memblokir apa pun**. Ini **deviasi dari desain
sebelumnya**, dan saya sebut alasannya: menahan satu siklus review untuk sesuatu yang tidak rusak adalah
waktu yang dibuang.

Dua koreksi lain: sejumlah **nomor baris** di desain lama sudah **usang** (kode bertambah), jadi setiap
task sekarang **wajib menutup dengan `grep`** untuk baris yang dipakai task berikutnya; dan saya
menambahkan **satu test baru (P0-d)** karena asersi lama bisa **hijau tanpa memberi tahu pemain** —
padahal proposal Anda sendiri menuntut pemain diberi tahu bila langkah cadangan dipakai.

---

## 4. Rencana kerja: tiga gelombang, satu penulis per berkas

```
GELOMBANG 1 (G1) — perbaikan pemain + pembersihan data
   1. p0    : fallback giliran AI            → script.js (jalur eksekusi AI)
   2. p3    : aksesibilitas (zoom, label, fokus)  → index.html, style.css, updateUI
   3. p6p2s : Box kanonik + migrasi save + pesan galat terpisah → script.js
   ── gerbang: node --test hijau ──

GELOMBANG 2 (G2) — ketajaman HiDPI (satu PR, tidak dipecah)
   4. p5    : DPR scale + satu helper koordinat input   → script.js

GELOMBANG 3 (G3) — telemetri & hemat I/O
   5. p4a   : tulis save di akhir giliran + beforeunload + rapikan audio
   6. p4b   : panel diagnosa hanya aktif via ?dev=1

VERIFIKASI & OPS
   QA     : jalankan seluruh suite, probe grep, triase ber-bukti baris
   DEVOPS : push ke master TANPA --force; bila ditolak → berhenti dan lapor
```

**Mengapa berurutan, bukan serentak, di dalam G1.** Ketiga paket itu menyunting **berkas yang sama**
(`script.js`). Menjalankannya benar-benar bersamaan akan menabrakkan suntingan dan membuat diff tak bisa
ditinjau. Satu penulis `script.js` pada satu waktu. Ini keputusan teknis, bukan kehati-hatian berlebihan.

**Mengapa P5 berdiri sendiri.** Ia menyentuh paling banyak titik di `script.js` dan — ini yang penting —
**berbahaya bila setengah jalan**: bila ukuran bitmap dinaikkan DPR tetapi konversi koordinat input tidak
ikut, **hit-test sentuhan langsung rusak**. Karena itu P5 wajib satu PR, sesuai keputusan proposal
(Ruling 2).

---

## 5. Keputusan yang saya ambil (dan alasannya)

| Keputusan | Alasan singkat |
|---|---|
| **P0 mulai tanpa menunggu paket QA** | Bukti: P0-a/P0-c sudah benar; P0-b mengukur lewat `makeMove`. Tidak ada lampu merah palsu. |
| **Langkah cadangan AI deterministik, bukan acak** | Proposal menulis "acak ber-seed", tetapi **tidak ada RNG** di kode. Menambahkannya = menambah state global yang bisa bocor antar-test. Deterministik = satu baris, bisa diuji persis. Ini **deviasi sadar** dari kalimat proposal, dan saya sebut apa adanya. |
| **`if (!move) return;` dihapus total, bukan digabung** | `return` telanjang itu **adalah** bug-nya. Bila digabung dengan `&&`, satu `grep` penjaga tidak akan menemukannya lagi. |
| **Test baru P0-d** | Asersi lama bisa hijau walau pemain tetap tidak diberi tahu. Kita menuntut "pemain diberi tahu", bukan sekadar "ada sesuatu yang terjadi". |
| **P7 (PWA/E2E) tidak dikerjakan** | Proposal §5.2 menandainya butuh keputusan Anda, karena menambah dependensi uji (Playwright) ke proyek yang kini **nol dependensi**. Itu keputusan produk. |
| **P4 tetap dijalankan sebagai G3** | Sesuai keputusan Lead: P4 bergantung pada P5 (overlay menampilkan DPR) dan mengubah kapan data pemain disimpan. Bila anggaran habis, **P4 yang di-drop**, bukan P7 — dan itu dilaporkan. |
| **Push tanpa `--force`, remote diperiksa lebih dulu** | Perintah Anda eksplisit, tetapi menimpa riwayat orang lain bukan wewenang tim. Bila ditolak, kita **lapor**, bukan paksa. |

**Duabelas jaminan yang mengikat pada P4** (agar "hemat I/O" tidak diam-diam menghilangkan data pemain):
overlay **hanya** muncul pada `?dev=1`; save tetap ditulis di setiap akhir giliran **dan** ada penulisan
penyelamat saat halaman ditinggalkan (`beforeunload`); audio dirapikan **tanpa** mengubah nada.

---

## 6. Risiko utama & cara menahannya

| Risiko | Dampak | Penahan |
|---|---|---|
| Nomor baris usang | Developer menyunting baris salah | Tiap task wajib tutup dengan `grep` untuk baris yang dipakai task berikutnya |
| Test lama mengunci **bug** | Suite merah walaupun kode benar | Test disesuaikan **di paket yang sama** dengan perubahan kodenya, bukan "dilunakkan" |
| P5 dikerjakan setengah | Hit-test sentuhan **langsung rusak** | Satu PR + test yang gagal bila konversi input hilang |
| P4 menunda tulis save | Kehilangan permainan bila tab ditutup | `beforeunload` + tulis di akhir giliran; testnya wajib |
| Klaim "selesai" berlebihan | Laporan tidak jujur (melanggar ADR-0002) | Setiap laporan **wajib** menyebut apa yang **tidak** diuji (pembaca layar nyata, layar Retina nyata) |
| `git push` non-fast-forward | Menimpa riwayat orang lain | Tanpa `--force`; berhenti & lapor |

---

## 7. Status & langkah berikutnya

**Sudah selesai di langkah ini:** spesifikasi revisi 3 tertulis dan tersimpan
(`docs/superpowers/specs/2026-10-10-eksekusi-r3-final-design.md`); glosarium ditambah satu istilah
("jalur cadangan") agar bahasa tim tetap satu.

**Belum selesai (memang belum boleh):** seluruh kode produksi. Itu pekerjaan developer setelah Lead
membagi tiket.

**Langkah berikutnya:**

1. **Developer** menjalankan **baseline test** lebih dulu dan melampirkan keluaran mentahnya — bila
   hasilnya tidak sesuai harapan di desain, **berhenti dan lapor**, jangan menebak.
2. **Developer** mengerjakan G1 secara berurutan: `p0 → p3 → p6p2s`.
3. **QA** memverifikasi independen (bukan mengklaim) sebelum G2 dimulai, dan sekali lagi sebelum push.
4. **DevOps** memeriksa `git remote -v` **sebelum** push; bila tidak ada remote GitHub, syarat push
   **tidak terpenuhi** dan itu dilaporkan.

**Pertanyaan terbuka yang butuh keputusan Anda:**

1. **P7 (PWA/uji E2E)** — sekarang (a), tunda sampai ada pengguna nyata (b), atau hanya PWA minimal tanpa
   Playwright (c)? Rekomendasi saya: **(b) atau (c)**.
2. **Cakupan push** — kirim semua gelombang langsung ke `master`, atau satu pull request dulu untuk Anda
   tinjau sebelum masuk `master`?

**Tidak ada rahasia, token, atau kata sandi di dokumen ini.**

---

## Lampiran: cara menjalankan & memverifikasi

```bash
# 1. Baseline — WAJIB lebih dulu, sebelum menyentuh kode
node --test
grep -n "if (!move) return" script.js        # harapan awal: 1 hasil (baris 756)
grep -c "aria-label" index.html              # harapan awal: 0

# 2. Gerbang tiap paket
node --test test/proposal-p0-p6.test.js      # p0, p6p2s
node --test test/bukti-eksekusi.test.js      # p0, p6p2s
node --test test/aksesibilitas.test.js       # p3
node --test test/p2-sisa.test.js             # p6p2s
node --test test/dpr.test.js                 # p5

# 3. Gerbang tunggal akhir (QA)
node --test
```

**Batas jujur:** perintah-perintah di atas **belum saya jalankan** di langkah ini. Angka hasilnya harus
berasal dari keluaran mentah yang dilampirkan ke `docs/bukti/`, bukan dari ringkasan percakapan.
