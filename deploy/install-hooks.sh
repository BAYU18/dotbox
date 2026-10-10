#!/usr/bin/env bash
# ============================================================================
#  deploy/install-hooks.sh — pasang penjaga pre-commit ke repo git ini
#
#  Idempoten: aman dijalankan berulang. Menyalin deploy/hooks/pre-commit ke
#  direktori hooks git yang aktif dan membuatnya dapat dieksekusi.
#
#  Pakai:  deploy/install-hooks.sh
# ============================================================================
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$(git rev-parse --git-path hooks)"

# Cari sumber relatif terhadap lokasi skrip ini, bukan cwd pemanggil: skrip
# bisa dijalankan dari mana saja dan tetap menemukan hook-nya sendiri.
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
for kandidat in "$SELF_DIR/hooks/pre-commit" "$ROOT/deploy/hooks/pre-commit"; do
  [ -f "$kandidat" ] && { SUMBER="$kandidat"; break; }
done
[ -n "${SUMBER:-}" ] || { echo "GALAT: hook pre-commit tidak ditemukan (dicari di $SELF_DIR/hooks dan $ROOT/deploy/hooks)" >&2; exit 1; }

mkdir -p "$HOOKS_DIR"
cp "$SUMBER" "$HOOKS_DIR/pre-commit"
chmod +x "$HOOKS_DIR/pre-commit"

echo "pre-commit dipasang di: $HOOKS_DIR/pre-commit"
echo "untuk melewatinya saat darurat: git commit --no-verify"
