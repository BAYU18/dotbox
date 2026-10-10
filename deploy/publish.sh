#!/usr/bin/env bash
# ============================================================================
#  deploy/publish.sh — publikasi situs statis dotbox ke nginx (idempoten)
#
#  Situs dotbox adalah berkas statis murni (HTML/CSS/JS, tanpa build, tanpa
#  dependensi). Karena itu "deploy" = menyalin berkas rilis ke docroot nginx
#  secara atomik + mempertahankan satu rilis sebelumnya untuk rollback.
#
#  Skrip ini DIJALANKAN OLEH DEVOPS di server setelah QA lulus dan CEO setuju.
#  Ia tidak melakukan `git push` (itu perintah terpisah, lihat deploy/push.sh).
#
#  Pakai:
#     deploy/publish.sh <versi>          # contoh: deploy/publish.sh 20261010-230647
#     deploy/publish.sh --rollback       # kembali ke rilis sebelumnya
#     deploy/publish.sh --status         # tunjukkan rilis aktif + rilis sebelumnya
#     deploy/publish.sh --verify [versi] # cek kesehatan rilis aktif (health check)
#
#  Idempoten: menjalankan ulang dengan versi yang sama tidak merusak apa pun;
#  ia hanya menyalin ulang dan mengaktifkan symlink yang sama.
# ============================================================================
set -euo pipefail

# --- Konfigurasi (bisa ditimpa lewat environment) ---------------------------
RELEASES_ROOT="${DOTBOX_RELEASES_ROOT:-/var/www/dotbox/releases}"
CURRENT_LINK="${DOTBOX_CURRENT_LINK:-/var/www/dotbox/current}"
SITE_URL="${DOTBOX_SITE_URL:-http://127.0.0.1/dotbox/}"
HEALTH_TIMEOUT="${DOTBOX_HEALTH_TIMEOUT:-5}"

# Berkas yang HARUS ada di setiap rilis. Sumber kanonik: cara memuat index.html.
REQUIRED_FILES=(index.html script.js rules.js ai-engine.js turn-queue.js style.css)

# Direktori/berkas yang TIDAK boleh ikut terbit. Diterapkan lewat `git archive`
# (pathspec), jadi berkas internal tidak pernah menyentuh docroot sama sekali.
# Ini penting: tanpa ini, dokumen internal (GLOSARY, PROPOSAL, docs/) akan
# menjadi publik di /dotbox/.
EXCLUDE_PATHSPECS=(
  ':(exclude).git*' ':(exclude).github' ':(exclude).babd'
  ':(exclude)test' ':(exclude)docs' ':(exclude)scripts' ':(exclude)deploy'
  ':(exclude)node_modules'
  ':(exclude)*.md' ':(exclude).gitignore' ':(exclude)test-push.txt'
)

log()  { printf '[publish] %s\n' "$*" >&2; }
die()  { printf '[publish][GALAT] %s\n' "$*" >&2; exit 1; }

# --- Repo harus bersih & ter-commit (jejak audit) ---------------------------
assert_git_state() {
  git rev-parse --git-dir >/dev/null 2>&1 || die "bukan repositori git"
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    die "ada perubahan yang belum di-commit. Commit dulu supaya rilis bisa diaudit."
  fi
}

# --- Sumber rilis: dari git archive pada commit HEAD ------------------------
# Kenapa git archive, bukan `cp -r`: ia menghasilkan isi commit yang bersih
# (tanpa .git, tanpa berkas tak terlacak, tanpa .DS_Store) sehingga rilis
# persis = apa yang di-review QA.
extract_release() {
  local versi="$1" tujuan="$2"
  mkdir -p "$tujuan"
  # `--` diikuti pathspec "exclude": git hanya menyertakan yang tidak dikecualikan.
  # Ini lebih aman daripada menyalin seluruh repo lalu menghapus belakangan.
  git archive --format=tar HEAD -- . "${EXCLUDE_PATHSPECS[@]}" | tar -x -C "$tujuan"
  log "isi rilis diekstrak dari commit $(git rev-parse --short HEAD) ke $tujuan"
}

# Bukti tidak ada bocor: tidak boleh ada berkas dokumentasi/test di docroot.
assert_no_leaks() {
  local dir="$1" bocor
  bocor="$(find "$dir" \( -name '*.md' -o -name '*.txt' -o -name '.gitignore' \) -print 2>/dev/null || true)"
  if [ -n "$bocor" ]; then
    printf '%s\n' "$bocor" | sed 's/^/    /' >&2
    die "ada berkas internal yang bocor ke rilis (lihat daftar di atas)"
  fi
  for d in test docs scripts deploy .github .babd; do
    [ -e "$dir/$d" ] && die "direktori internal bocor ke rilis: $d"
  done
  log "pemeriksaan kebocoran: bersih (tanpa .md/.txt/test/docs/scripts)"
}

require_files() {
  local dir="$1"
  for f in "${REQUIRED_FILES[@]}"; do
    [ -s "$dir/$f" ] || die "berkas wajib hilang/kosong di rilis: $f"
  done
  log "semua berkas wajib ada (${#REQUIRED_FILES[@]} berkas)"
}

# --- Health check: rilis baru harus bisa dijangkau & memuat penanda ---------
# Penanda = string yang harus ada di index.html hasil rilis. Dipakai sebagai
# "versi hidup" sederhana tanpa menambah dependensi.
health_check_dir() {
  local dir="$1"
  # 1. Penanda konten (bukan HTTP) — selalu bisa dijalankan.
  grep -q '<canvas' "$dir/index.html" || die "health: index.html tidak memuat <canvas>"
  grep -q 'turn-queue.js' "$dir/index.html" || die "health: index.html tidak memuat turn-queue.js (wiring P1 hilang?)"
  log "health (berkas): OK (canvas + turn-queue.js ada)"
}

health_check_http() {
  # 2. Health check HTTP — hanya bila server web memang sedang melayani.
  #    Pakai node (sudah ada di server ini) supaya tidak bergantung pada curl.
  node -e '
    const http = require("http");
    const url = process.argv[1];
    const req = http.get(url, { timeout: Number(process.argv[2]) * 1000 }, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => {
        const ok = res.statusCode === 200 && /<canvas/.test(body);
        console.log(`[publish] health (HTTP ${url}): status=${res.statusCode} canvas=${/<canvas/.test(body)}`);
        process.exit(ok ? 0 : 1);
      });
    });
    req.on("error", (e) => { console.log(`[publish] health (HTTP): gagal ${e.message}`); process.exit(1); });
    req.on("timeout", () => { req.destroy(); console.log("[publish] health (HTTP): timeout"); process.exit(1); });
  ' "$SITE_URL" "$HEALTH_TIMEOUT"
}

# --- Aktivasi atomik lewat symlink -----------------------------------------
# Kenapa symlink: peralihan rilis jadi satu operasi atomik (rename symlink),
# dan rollback cukup menunjuk kembali ke rilis sebelumnya. Tidak ada jendela
# waktu di mana docroot setengah terisi.
activate() {
  local versi="$1"
  local target="$RELEASES_ROOT/$versi"
  [ -d "$target" ] || die "rilis tidak ditemukan: $target"

  # Simpan penunjuk rilis sebelumnya agar rollback mungkin.
  if [ -L "$CURRENT_LINK" ]; then
    local prev
    prev="$(readlink -f "$CURRENT_LINK")"
    if [ "$prev" != "$target" ]; then
      ln -sfn "$prev" "$CURRENT_LINK.prev"
      log "rilis sebelumnya dicatat: $prev"
    fi
  fi

  # Tukar symlink secara atomik: buat di nama sementara lalu `mv -T`.
  ln -sfn "$target" "$CURRENT_LINK.tmp"
  mv -Tf "$CURRENT_LINK.tmp" "$CURRENT_LINK"
  log "rilis aktif -> $target"
}

cmd_status() {
  echo "releases root : $RELEASES_ROOT"
  echo "current link  : $CURRENT_LINK"
  if [ -L "$CURRENT_LINK" ]; then
    echo "current  -> $(readlink -f "$CURRENT_LINK")"
  else
    echo "current  -> (belum ada rilis aktif)"
  fi
  if [ -L "$CURRENT_LINK.prev" ]; then
    echo "previous -> $(readlink -f "$CURRENT_LINK.prev")"
  else
    echo "previous -> (belum ada rilis sebelumnya)"
  fi
  echo "tersedia:"
  ls -1 "$RELEASES_ROOT" 2>/dev/null | sed 's/^/  - /' || echo "  (kosong)"
}

cmd_verify() {
  local versi="${1:-}"
  local dir
  if [ -n "$versi" ]; then dir="$RELEASES_ROOT/$versi"; else dir="$(readlink -f "$CURRENT_LINK")"; fi
  [ -d "$dir" ] || die "tidak ada rilis untuk diverifikasi: $dir"
  assert_no_leaks "$dir"
  require_files "$dir"
  health_check_dir "$dir"
  health_check_http || log "PERINGATAN: health HTTP gagal (server web mungkin tidak aktif)."
  log "verifikasi selesai untuk $dir"
}

cmd_publish() {
  local versi="$1"
  [ -n "$versi" ] || die "versi wajib (contoh: 20261010-230647)"
  [[ "$versi" =~ ^[A-Za-z0-9._-]+$ ]] || die "versi tidak aman: $versi"

  assert_git_state
  local staging="$RELEASES_ROOT/.staging-$versi-$$"
  rm -rf "$staging"
  extract_release "$versi" "$staging"
  assert_no_leaks "$staging"
  require_files "$staging"
  health_check_dir "$staging"

  local final="$RELEASES_ROOT/$versi"
  rm -rf "$final"
  mv -T "$staging" "$final"          # atomik: rilis lengkap atau tidak sama sekali
  log "rilis terversi tersimpan: $final"

  activate "$versi"
  cmd_verify "$versi" || die "verifikasi pasca-aktivasi gagal — pertimbangkan --rollback"
  log "SELESAI. Situs aktif dari $final"
}

cmd_rollback() {
  [ -L "$CURRENT_LINK.prev" ] || die "tidak ada rilis sebelumnya untuk di-rollback"
  local prev current
  prev="$(readlink -f "$CURRENT_LINK.prev")"
  [ -d "$prev" ] || die "rilis sebelumnya hilang: $prev"
  current="$(readlink -f "$CURRENT_LINK")"
  # Tukar posisi: sesudah rollback, "previous" menjadi rilis yang baru saja
  # kita tinggalkan. Jadi --rollback berulang bisa bolak-balik A<->B.
  ln -sfn "$current" "$CURRENT_LINK.prev.tmp"
  mv -Tf "$CURRENT_LINK.prev.tmp" "$CURRENT_LINK.prev"
  ln -sfn "$prev" "$CURRENT_LINK.tmp"
  mv -Tf "$CURRENT_LINK.tmp" "$CURRENT_LINK"
  log "ROLLBACK: rilis aktif -> $prev"
  cmd_verify || die "verifikasi rilis hasil rollback gagal"
  log "ROLLBACK SELESAI"
}

case "${1:-}" in
  --status)   cmd_status ;;
  --verify)   shift; cmd_verify "${1:-}" ;;
  --rollback) cmd_rollback ;;
  "")         die "pakai: publish.sh <versi> | --status | --verify | --rollback" ;;
  -*)         die "opsi tidak dikenal: $1" ;;
  *)          cmd_publish "$1" ;;
esac
