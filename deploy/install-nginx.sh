#!/usr/bin/env bash
# ============================================================================
#  deploy/install-nginx.sh — pasang (atau lepas) rute /dotbox/ di nginx
#
#  KENAPA SKRIP INI ADA (dan bukan sekadar `scp` satu berkas):
#  vhost `default` di server ini sudah memegang `listen 80 default_server` dan
#  root /var/www/html. Situs dotbox harus hidup di sub-path /dotbox/ pada host
#  yang sama. Membuat `server {}` baru bernama `_` GAGAL: nginx menulis
#  "conflicting server name \"_\" ... ignored" dan /dotbox/ balas 404.
#  Jadi cara yang benar adalah menyisipkan SATU baris `include` ke dalam blok
#  `server {}` milik `default`, dengan penanda yang bisa dilepas kembali.
#
#  Idempoten: dijalankan berulang tidak menambah include ganda.
#  Reversibel: `--uninstall` melepas include dan mengembalikan nginx seperti
#  semula, tanpa menyentuh bagian lain berkas `default`.
#
#  Pakai:
#     deploy/install-nginx.sh              # pasang + nginx -t + reload
#     deploy/install-nginx.sh --uninstall  # lepas + nginx -t + reload
#     deploy/install-nginx.sh --dry-run    # tunjukkan rencana, tidak mengubah
# ============================================================================
set -euo pipefail

SNIPPET_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/nginx-dotbox.conf"
SNIPPET_DST="${DOTBOX_SNIPPET_DST:-/etc/nginx/snippets/dotbox.conf}"
DEFAULT_CONF="${DOTBOX_DEFAULT_CONF:-/etc/nginx/sites-available/default}"
MARK_BEGIN="# >>> dotbox (managed by deploy/install-nginx.sh) >>>"
MARK_END="# <<< dotbox <<<"
INCLUDE_LINE="include ${SNIPPET_DST};"

MODE="install"
case "${1:-}" in
  --uninstall) MODE="uninstall" ;;
  --dry-run)   MODE="dry-run" ;;
  "")          MODE="install" ;;
  *)           echo "opsi tidak dikenal: $1" >&2; exit 2 ;;
esac

log() { printf '[nginx-dotbox] %s\n' "$*" >&2; }
die() { printf '[nginx-dotbox][GALAT] %s\n' "$*" >&2; exit 1; }

[ -f "$SNIPPET_SRC" ] || die "snippet sumber tidak ada: $SNIPPET_SRC"
[ -f "$DEFAULT_CONF" ] || die "berkas vhost default tidak ditemukan: $DEFAULT_CONF"

has_block() { grep -qF "$MARK_BEGIN" "$DEFAULT_CONF"; }

configure_default() {
  local tmp
  tmp="$(mktemp)"
  if has_block; then
    log "include dotbox sudah terpasang di $DEFAULT_CONF (tidak diubah)"
    return 0
  fi
  # Sisipkan blok include TEPAT SEBELUM baris `location / {` — jadi berlaku di
  # dalam server block yang sama, dan urutannya sebelum catch-all.
  if ! grep -q 'location / {' "$DEFAULT_CONF"; then
    die "tidak menemukan 'location / {' di $DEFAULT_CONF; pasang manual (lihat deploy/DEPLOY.md)"
  fi
  awk -v b="$MARK_BEGIN" -v i="    $INCLUDE_LINE" -v e="$MARK_END" '
    !done && /location \/ \{/ { print b; print i; print e; done=1 }
    { print }
  ' "$DEFAULT_CONF" > "$tmp"
  # nginx butuh blok ini di dalam blok server; tulis ke lokasi aslinya.
  cat "$tmp" > "$DEFAULT_CONF"
  rm -f "$tmp"
  log "include dotbox disisipkan ke $DEFAULT_CONF"
}

unconfigure_default() {
  if ! has_block; then
    log "include dotbox tidak ada di $DEFAULT_CONF (tidak ada yang dilepas)"
    return 0
  fi
  local tmp; tmp="$(mktemp)"
  grep -vF "$MARK_BEGIN" "$DEFAULT_CONF" \
    | grep -vF "    $INCLUDE_LINE" \
    | grep -vF "$MARK_END" > "$tmp"
  cat "$tmp" > "$DEFAULT_CONF"
  rm -f "$tmp"
  log "include dotbox dilepas dari $DEFAULT_CONF"
}

install_snippet() {
  mkdir -p "$(dirname "$SNIPPET_DST")"
  cp "$SNIPPET_SRC" "$SNIPPET_DST"
  log "snippet disalin: $SNIPPET_SRC -> $SNIPPET_DST"
}

test_and_reload() {
  log "menguji konfigurasi: nginx -t"
  nginx -t || die "nginx -t GAGAL — tidak reload. Perbaiki dulu."
  log "nginx -t OK; memuat ulang nginx"
  systemctl reload nginx
  log "nginx dimuat ulang"
}

case "$MODE" in
  dry-run)
    log "MODE --dry-run: tidak mengubah apa pun."
    log "akan menyalin $SNIPPET_SRC -> $SNIPPET_DST"
    log "akan menyisipkan '$INCLUDE_LINE' ke $DEFAULT_CONF (bila belum ada)"
    nginx -t
    ;;
  install)
    install_snippet
    configure_default
    test_and_reload
    log "SELESAI. Cek: http://127.0.0.1/dotbox/health"
    ;;
  uninstall)
    unconfigure_default
    rm -f "$SNIPPET_DST"
    log "snippet dihapus: $SNIPPET_DST"
    test_and_reload
    log "SELESAI. Rute /dotbox/ dilepas."
    ;;
esac
