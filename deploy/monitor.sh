#!/usr/bin/env bash
# ============================================================================
#  deploy/monitor.sh — pemeriksaan kesehatan dotbox + catatan waktu
#
#  APA YANG DIPANTAU (empat pemeriksaan, semuanya murah dan tanpa dependensi):
#    1. nginx hidup          (systemctl is-active)
#    2. symlink rilis valid  (/var/www/dotbox/current menunjuk direktori nyata
#                             yang memuat 6 berkas wajib)
#    3. HTTP halaman utama   (status 200 + ada <canvas>)
#    4. HTTP health endpoint (status 200 "dotbox ok")
#
#  HASIL dicatat satu baris per pemeriksaan ke log (default
#  /var/log/dotbox/health.log) dengan format:
#      <ISO-8601> <OK|GAGAL> <nama-pemeriksaan> <detail>
#  Ini memudahkan `tail`/`grep GAGAL` tanpa alat tambahan.
#
#  Dipasang sebagai cron setiap 5 menit: /etc/cron.d/dotbox-monitor
#  (lihat deploy/install-monitor.sh).
#
#  Pakai:
#     deploy/monitor.sh            # periksa sekali, catat, exit 0 bila semua OK
#     deploy/monitor.sh --check    # periksa + cetak ringkas ke stdout (tanpa tulis log)
#     deploy/monitor.sh --status   # tunjukkan 20 baris log terakhir + ringkasan
#
#  Kode keluar: 0 = semua OK, 1 = ada kegagalan (berguna untuk cron alerting).
# ============================================================================
set -uo pipefail

SITE_URL="${DOTBOX_SITE_URL:-http://127.0.0.1/dotbox/}"
HEALTH_URL="${DOTBOX_HEALTH_URL:-http://127.0.0.1/dotbox/health}"
CURRENT_LINK="${DOTBOX_CURRENT_LINK:-/var/www/dotbox/current}"
LOG_DIR="${DOTBOX_LOG_DIR:-/var/log/dotbox}"
LOG_FILE="$LOG_DIR/health.log"
TIMEOUT="${DOTBOX_HEALTH_TIMEOUT:-5}"
REQUIRED_FILES=(index.html script.js rules.js ai-engine.js turn-queue.js style.css)

MODE="${1:---run}"
mkdir -p "$LOG_DIR" 2>/dev/null || true

ts() { date -u +%Y-%m-%dT%H:%M:%SZ; }
FAILS=0
LINES=()

record() { # record <OK|GAGAL> <nama> <detail>
  local status="$1" name="$2" detail="$3"
  LINES+=("$(ts) $status $name $detail")
  [ "$status" = "GAGAL" ] && FAILS=$((FAILS + 1))
  return 0
}

# http_get <url> -> cetak "STATUS BODY_HEAD", exit 0 bila 200 (pakai node, tanpa curl)
http_probe() {
  node -e '
    const http = require("http");
    const url = process.argv[1], ms = Number(process.argv[2]) * 1000;
    const req = http.get(url, { timeout: ms }, (res) => {
      let body = "";
      res.on("data", (d) => (body += d));
      res.on("end", () => { console.log(res.statusCode + " " + (body.length)); });
    });
    req.on("error", () => { console.log("000 0"); });
    req.on("timeout", () => { req.destroy(); console.log("000 0"); });
  ' "$1" "$TIMEOUT" 2>/dev/null
}

check_nginx() {
  if systemctl is-active --quiet nginx; then
    record OK nginx "aktif"
  else
    record GAGAL nginx "systemctl is-active -> tidak aktif"
  fi
}

check_release() {
  if [ ! -L "$CURRENT_LINK" ]; then
    record GAGAL rilis "symlink current tidak ada ($CURRENT_LINK)"
    return
  fi
  local dir; dir="$(readlink -f "$CURRENT_LINK")"
  if [ ! -d "$dir" ]; then
    record GAGAL rilis "current menunjuk non-direktori: $dir"
    return
  fi
  local miss=() f
  for f in "${REQUIRED_FILES[@]}"; do
    [ -s "$dir/$f" ] || miss+=("$f")
  done
  if [ "${#miss[@]}" -eq 0 ]; then
    record OK rilis "versi $(basename "$dir"), 6 berkas lengkap"
  else
    record GAGAL rilis "berkas hilang/kosong: ${miss[*]}"
  fi
}

check_http() {
  local out status
  out="$(http_probe "$SITE_URL")"; status="${out%% *}"
  if [ "$status" = "200" ]; then
    record OK http "GET $SITE_URL -> 200"
  else
    record GAGAL http "GET $SITE_URL -> $status"
  fi
}

check_health_endpoint() {
  local out status
  out="$(http_probe "$HEALTH_URL")"; status="${out%% *}"
  if [ "$status" = "200" ]; then
    record OK health "GET $HEALTH_URL -> 200"
  else
    record GAGAL health "GET $HEALTH_URL -> $status"
  fi
}

run_checks() {
  check_nginx
  check_release
  check_http
  check_health_endpoint
}

finish() {
  local line
  for line in "${LINES[@]}"; do printf '%s\n' "$line"; done
  if [ "$MODE" != "--check" ]; then
    for line in "${LINES[@]}"; do printf '%s\n' "$line" >> "$LOG_FILE"; done
  fi
  return "$FAILS"
}

case "$MODE" in
  --status)
    printf '=== 20 baris log terakhir (%s) ===\n' "$LOG_FILE"
    tail -n 20 "$LOG_FILE" 2>/dev/null || echo "(belum ada log)"
    printf '\n=== ringkasan jumlah GAGAL (seluruh log) ===\n'
    printf 'total baris : %s\n' "$(wc -l < "$LOG_FILE" 2>/dev/null || echo 0)"
    printf 'GAGAL       : %s\n' "$(grep -c ' GAGAL ' "$LOG_FILE" 2>/dev/null || echo 0)"
    printf '\n=== pemeriksaan langsung sekarang ===\n'
    run_checks; MODE=--check; finish; exit $?
    ;;
  --check)
    run_checks; finish; exit $?
    ;;
  *)
    run_checks; finish
    exit "$FAILS"
    ;;
esac
