#!/usr/bin/env bash
# ============================================================================
#  deploy/install-monitor.sh — pasang pemantauan dotbox (cron tiap 5 menit)
#
#  Memasang /etc/cron.d/dotbox-monitor yang menjalankan deploy/monitor.sh.
#  Salinan monitor dipasang di /usr/local/bin/dotbox-monitor agar cron tidak
#  bergantung pada lokasi worktree.
#
#  Idempoten dan reversibel:
#     deploy/install-monitor.sh              # pasang
#     deploy/install-monitor.sh --uninstall  # lepas
# ============================================================================
set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$SELF_DIR/monitor.sh"
BIN_DST="${DOTBOX_MONITOR_BIN:-/usr/local/bin/dotbox-monitor}"
CRON_FILE="${DOTBOX_CRON_FILE:-/etc/cron.d/dotbox-monitor}"
LOG_DIR="${DOTBOX_LOG_DIR:-/var/log/dotbox}"
LOGROTATE_FILE="${DOTBOX_LOGROTATE_FILE:-/etc/logrotate.d/dotbox}"

log() { printf '[install-monitor] %s\n' "$*" >&2; }
die() { printf '[install-monitor][GALAT] %s\n' "$*" >&2; exit 1; }

[ -f "$SRC" ] || die "monitor.sh tidak ditemukan: $SRC"

case "${1:-}" in
  --uninstall)
    rm -f "$CRON_FILE" "$BIN_DST" "$LOGROTATE_FILE"
    log "cron, biner & logrotate dihapus ($CRON_FILE, $BIN_DST, $LOGROTATE_FILE)"
    log "SELESAI. Log di $LOG_DIR dibiarkan (hapus manual bila perlu)."
    exit 0
    ;;
  "") ;;
  *) die "opsi tidak dikenal: $1" ;;
esac

mkdir -p "$(dirname "$BIN_DST")" "$(dirname "$CRON_FILE")" "$(dirname "$LOGROTATE_FILE")" "$LOG_DIR"
install -m 0755 "$SRC" "$BIN_DST"
log "monitor dipasang: $BIN_DST"

# Entri cron.d: jalankan tiap 5 menit. cron.d butuh field user.
cat > "$CRON_FILE" <<EOF
# Pemantauan dotbox — dipasang oleh deploy/install-monitor.sh
# Tiap 5 menit: periksa nginx + rilis + HTTP, catat ke $LOG_DIR/health.log
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
*/5 * * * * root $BIN_DST >/dev/null 2>&1
EOF
chmod 0644 "$CRON_FILE"
log "cron dipasang: $CRON_FILE (tiap 5 menit)"

# Logrotate: batasi pertumbuhan log supaya tidak mengisi disk.
# Tiap 5 menit = 288 baris/hari untuk health.log; tanpa rotasi berkas ini
# tumbuh tanpa batas. Kita jaga 14 hari (health) & 30 hari (alert, hanya terisi
# saat gagal) lalu di-gzip.
cat > "$LOGROTATE_FILE" <<EOF
# Logrotate dotbox — dipasang oleh deploy/install-monitor.sh
$LOG_DIR/health.log {
    weekly
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
$LOG_DIR/alert.log {
    monthly
    rotate 12
    compress
    missingok
    notifempty
    create 0644 root root
}
EOF
chmod 0644 "$LOGROTATE_FILE"
if command -v logrotate >/dev/null 2>&1; then
  logrotate --debug "$LOGROTATE_FILE" >/dev/null 2>&1 \
    && log "logrotate dipasang & validasi lolos: $LOGROTATE_FILE" \
    || log "PERINGATAN: logrotate --debug menolak konfigurasi (periksa $LOGROTATE_FILE)"
else
  log "PERINGATAN: logrotate tidak ada; konfigurasi ditulis tapi tidak aktif"
fi

# Jalankan sekali sekarang supaya log langsung terbentuk.
"$BIN_DST" >/dev/null 2>&1 && log "pemeriksaan pertama: SEMUA OK" || log "PERINGATAN: pemeriksaan pertama menemukan kegagalan (lihat $LOG_DIR/health.log)"

log "SELESAI. Cek status: $BIN_DST --status"
