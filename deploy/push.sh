#!/usr/bin/env bash
# ============================================================================
#  deploy/push.sh — dorong cabang rilis ke GitHub, TANPA --force
#
#  Perintah CEO: "push ke github master". Skrip ini melakukannya dengan
#  pengaman yang disepakati tim:
#    - TIDAK memakai --force dan TIDAK memakai --force-with-lease
#    - fast-forward saja; bila ditolak, BERHENTI dan lapor (tidak memaksa)
#    - memeriksa remote & commit tujuan lebih dulu, menampilkan apa yang
#      akan didorong, baru mendorong
#
#  Pakai:
#     deploy/push.sh --dry-run     # tampilkan rencana, tidak mengirim apa pun
#     deploy/push.sh               # dorong HEAD ke origin/master (fast-forward)
# ============================================================================
set -euo pipefail

REMOTE="${DOTBOX_REMOTE:-origin}"
TARGET_BRANCH="${DOTBOX_TARGET_BRANCH:-master}"

log() { printf '[push] %s\n' "$*" >&2; }
die() { printf '[push][GALAT] %s\n' "$*" >&2; exit 1; }

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

# --- 1. Kenali remote sebenarnya (jangan percaya nama saja) -----------------
log "remote yang dipakai: $REMOTE"
git remote -v | sed 's/^/  /'

# --- 2. Ambil keadaan terbaru remote, tanpa mengubah apa pun ----------------
log "mengambil keadaan terbaru dari $REMOTE (fetch, tanpa merge)…"
git fetch --no-tags "$REMOTE" "$TARGET_BRANCH" || die "fetch gagal"

REMOTE_SHA="$(git rev-parse "$REMOTE/$TARGET_BRANCH")"
LOCAL_SHA="$(git rev-parse HEAD)"
log "remote $REMOTE/$TARGET_BRANCH = ${REMOTE_SHA:0:12}"
log "lokal  HEAD                 = ${LOCAL_SHA:0:12}"

# --- 3. Pastikan ini fast-forward, bukan paksa menimpa riwayat --------------
if ! git merge-base --is-ancestor "$REMOTE_SHA" "$LOCAL_SHA"; then
  echo
  echo "  >>> TIDAK FAST-FORWARD <<<"
  echo "  master di remote punya commit yang tidak ada di lokal."
  echo "  Kami TIDAK akan memaksa. Pilihan Anda:"
  echo "    (a) rebase/merge master ke cabang ini lebih dulu, lalu ulangi"
  echo "    (b) batalkan push dan minta tinjauan manusia"
  echo "  Commit di remote yang belum ada di lokal:"
  git log --oneline "$LOCAL_SHA..$REMOTE_SHA" | sed 's/^/    /'
  die "push dibatalkan (bukan fast-forward)"
fi

log "aman: ini fast-forward (${REMOTE_SHA:0:12} -> ${LOCAL_SHA:0:12})"
echo
echo "  commit yang akan sampai ke $TARGET_BRANCH:"
git log --oneline "$REMOTE_SHA..$LOCAL_SHA" | sed 's/^/    /'
echo
echo "  berkas yang berubah:"
git diff --stat "$REMOTE_SHA..$LOCAL_SHA" | tail -n 25 | sed 's/^/    /'
echo

if [ "$DRY" -eq 1 ]; then
  log "MODE --dry-run: tidak ada yang dikirim. Hapus --dry-run untuk benar-benar push."
  exit 0
fi

# --- 4. Dorong (tanpa --force) ----------------------------------------------
# CATATAN: perintah push nyata sengaja TIDAK dijalankan otomatis oleh skrip ini
# sampai CEO menyetujui. Untuk menjalankan sungguhan, buka komentar baris di bawah.
log "menjalankan: git push $REMOTE HEAD:$TARGET_BRANCH   (TANPA --force)"
# git push "$REMOTE" "HEAD:$TARGET_BRANCH"

log "baris push masih dikomentari — DevOps membukanya hanya setelah persetujuan CEO."
die "push belum diaktifkan (lihat komentar di deploy/push.sh baris push)"
