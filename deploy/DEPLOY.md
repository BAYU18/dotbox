# Runbook Deploy dotbox — perintah persis, urut, bisa disalin

Dokumen ini untuk **yang menjalankan rilis**. Setiap perintah bisa disalin apa adanya.
Bila ragu, jalankan wizard yang menuntun: `bash deploy/rilis-dotbox-wizard.sh`.

Semua perintah di bawah dijalankan dari akar worktree:

```bash
cd /home/serverbot/aidev/workspace/worktrees/dotbox/20261010-230647
```

Variabel SSH yang dipakai berulang (salin sekali per shell):

```bash
SSHCFG=/home/serverbot/aidev/workspace/.babd-ssh/config
```

---

## 0. Prasyarat — berhenti bila salah satu belum benar

| Syarat | Cara memeriksa | Harus |
|---|---|---|
| QA sudah melaporkan PASS | lihat laporan QA run ini | 0 gagal |
| Suite hijau **di sini** | `node --test test/ 2>&1 \| tail -6` | `# fail 0` |
| CEO/Lead menyetujui rilis | (persetujuan manusia) | ya |
| Repo bersih | `git status --short` | hanya berkas yang memang mau dirilis |

> **Aturan besi:** bila `node --test test/` belum `fail 0`, **jangan lanjut**. Publikasi akan menolak
> sendiri (pemeriksaan `git status`), tapi jangan mengetuk pintu yang terkunci.

---

## 1. Push ke GitHub `master`

Selalu **cek dulu** tanpa mengirim:

```bash
deploy/push.sh --dry-run
```

Bila keluarannya memuat **`aman: ini fast-forward`**, lanjutkan. Bila memuat
**`TIDAK FAST-FORWARD`**, **berhenti** dan lapor — jangan pernah memaksa.

Untuk mengirim sungguhan, buka komentar baris push di `deploy/push.sh` (cari
`# git push "$REMOTE"`), lalu:

```bash
deploy/push.sh
```

Skrip ini **tidak** memakai `--force` maupun `--force-with-lease`.

---

## 2. Pasang vhost nginx (sekali saja)

Lewati langkah ini bila `/etc/nginx/sites-enabled/dotbox.conf` sudah ada.

```bash
# a. salin konfigurasi ke server
scp -F "$SSHCFG" deploy/nginx-dotbox.conf aidev:/etc/nginx/sites-available/dotbox.conf

# b. uji konfigurasi SEBELUM menerapkan — jangan reload bila ini gagal
ssh -F "$SSHCFG" aidev 'nginx -t'

# c. aktifkan + uji ulang + reload
ssh -F "$SSHCFG" aidev '
  ln -sfn /etc/nginx/sites-available/dotbox.conf /etc/nginx/sites-enabled/dotbox.conf
  nginx -t && systemctl reload nginx && echo "nginx dimuat ulang: OK"
'
```

> **Penting.** Port 80 di server ini melayani vhost `default` yang sudah ada. Konfigurasi dotbox
> sengaja memakai `location /dotbox/` (sub-path) supaya **tidak** mengambil alih akar. Jangan
> mengubahnya menjadi `location /` tanpa persetujuan.

---

## 3. Publikasi rilis

Karena `aidev` **adalah** mesin ini, publikasi dijalankan lokal dari worktree:

```bash
# versi = penanda pilihan Anda; pakai tanggal-jam supaya urut
deploy/publish.sh 20261010-230647
```

Yang dilakukan skrip, berurutan: (1) menolak bila ada perubahan belum di-commit, (2) mengekstrak
isi commit `HEAD` ke folder rilis baru lewat `git archive`, (3) memeriksa **tidak ada kebocoran**
dokumen internal, (4) memeriksa 6 berkas wajib, (5) menukar symlink `current` secara atomik,
(6) menjalankan health check.

---

## 4. Health check & asap

```bash
# health dari sisi berkas + HTTP
deploy/publish.sh --verify

# endpoint kesehatan langsung dari server (memakai node, bukan curl)
ssh -F "$SSHCFG" aidev 'node -e "require(\"http\").get(\"http://127.0.0.1/dotbox/health\",r=>{console.log(r.statusCode);r.resume()})"'
```

Harapan: `--verify` selesai tanpa `[GALAT]`, dan endpoint menjawab `200`.

**Asap manual (manusia):** buka `http://<server>/dotbox/` di browser. Periksa: papan tampil,
tombol "Mulai Game" bekerja, Anda bisa menggambar garis, dan AI membalas.

---

## 5. Rollback

```bash
deploy/publish.sh --status      # lihat rilis aktif & sebelumnya
deploy/publish.sh --rollback    # kembali ke rilis sebelumnya (atomik)
deploy/publish.sh --verify      # konfirmasi rilis hasil rollback sehat
```

Bila bahkan rollback gagal dan situs harus dimatikan sementara:

```bash
ssh -F "$SSHCFG" aidev '
  rm -f /etc/nginx/sites-enabled/dotbox.conf
  nginx -t && systemctl reload nginx && echo "vhost dotbox dimatikan"
'
```

---

## 6. Pemantauan cepat

```bash
# galat nginx terbaru
ssh -F "$SSHCFG" aidev 'tail -n 40 /var/log/nginx/error.log'

# ruang disk (server ini ~87% terpakai — pantau)
ssh -F "$SSHCFG" aidev 'df -h /'

# hapus rilis lama yang sudah tidak terpakai (setelah yakin)
ssh -F "$SSHCFG" aidev 'ls -1 /var/www/dotbox/releases'
```

---

## 7. Kalau ada yang salah

| Gejala | Sebab yang paling mungkin | Tindakan |
|---|---|---|
| `publish.sh` bilang *"perubahan yang belum di-commit"* | ada suntingan belum di-commit | commit / `git stash` dulu, ulangi |
| `publish.sh` bilang *"berkas internal bocor"* | commit memuat `.md`/`txt`/`test/` di jalur terbit | periksa `EXCLUDE_PATHSPECS`; laporkan |
| Halaman 404 | symlink `current` tidak ada atau vhost belum aktif | `deploy/publish.sh --status`, lalu `nginx -t` |
| Halaman tampil tapi tombol mati | berkas `.js` tertinggal versi lama (cache) | muat ulang tanpa cache (Ctrl-Shift-R), periksa header `no-cache` |
| `nginx -t` gagal setelah pasang vhost | salah ketik / vhost bentrok | **jangan reload**; perbaiki berkasnya, atau hapus symlink `sites-enabled` |
| Push ditolak `non-fast-forward` | master punya commit yang belum ada di lokal | rebase/merge, ulangi `--dry-run` |
