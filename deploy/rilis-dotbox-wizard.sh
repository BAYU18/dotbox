#!/usr/bin/env bash
#
# Wizard rilis dotbox: menuntun Anda melalui langkah yang HANYA bisa dilakukan
# manusia — mengaktifkan push ke GitHub master dan memasang vhost nginx.
# Dibuat oleh skill /wizard.
#
# Semua di atas penanda "STAGES" adalah pustaka wizard: JANGAN diubah tangan.
# Susun tahap per langkah di bawah penanda itu.

set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────
# Wizard library: delightful, consistent UX, identical across every wizard.
# ──────────────────────────────────────────────────────────────────────────

if [[ -t 1 ]] && command -v tput >/dev/null 2>&1 && [[ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]]; then
  BOLD=$(tput bold); DIM=$(tput dim); RESET=$(tput sgr0)
  BLUE=$(tput setaf 4); GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3); RED=$(tput setaf 1)
else
  BOLD=""; DIM=""; RESET=""; BLUE=""; GREEN=""; YELLOW=""; RED=""
fi

# Author sets this at the top of the stages section.
TOTAL_STAGES=0

_STAGE_INDEX=0
ENV_FILE="${ENV_FILE:-.env}"
WRITTEN_ENV=()    # KEYs written to ENV_FILE this run
WRITTEN_SECRET=() # secret NAMEs set this run
SKIPPED=()        # things we couldn't do (e.g. gh missing)

# _clear wipes the terminal so only the current step is on screen. No-op when
# output isn't a terminal, so piped logs stay readable.
_clear() {
  [[ -t 1 ]] || return 0
  if command -v tput >/dev/null 2>&1; then tput clear; else printf '\033[2J\033[3J\033[H'; fi
}

# banner "Title" shows the opening frame: what this wizard does.
banner() {
  _clear
  printf '\n%s%s  %s%s\n' "$BOLD" "$BLUE" "$1" "$RESET"
  printf '%s  %s stages%s\n\n' "$DIM" "$TOTAL_STAGES" "$RESET"
  printf '%s  You drive the browser; this wizard tells you exactly what to do and\n' "$DIM"
  printf '  captures the values you copy back. Stop any time with Ctrl-C and re-run\n'
  printf '  later, since it remembers values already saved.%s\n' "$RESET"
  pause "Ready to start?"
}

# stage "Name" clears the screen, then announces a stage and shows progress.
# Clearing keeps only the current step on screen.
stage() {
  _clear
  _STAGE_INDEX=$((_STAGE_INDEX + 1))
  printf '\n%s%s▸ Stage %s/%s · %s%s\n' \
    "$BOLD" "$BLUE" "$_STAGE_INDEX" "$TOTAL_STAGES" "$1" "$RESET"
}

# say "..." prints a plain instruction line.
say()  { printf '  %s\n' "$1"; }
# step "..." is a numbered-feeling action the human takes in the browser.
step() { printf '  %s•%s %s\n' "$BLUE" "$RESET" "$1"; }
note() { printf '  %s%s%s\n' "$DIM" "$1" "$RESET"; }
warn() { printf '  %s⚠ %s%s\n' "$YELLOW" "$1" "$RESET"; }

# open_url URL opens it in the human's browser, cross-platform incl. WSL.
open_url() {
  local url="$1"
  printf '  %s↗ opening%s %s\n' "$GREEN" "$RESET" "$url"
  { if   command -v wslview     >/dev/null 2>&1; then wslview "$url"
    elif command -v explorer.exe >/dev/null 2>&1; then explorer.exe "$url"
    elif command -v xdg-open    >/dev/null 2>&1; then xdg-open "$url"
    elif command -v open        >/dev/null 2>&1; then open "$url"
    else warn "couldn't open a browser; visit it manually: $url"; fi
  } >/dev/null 2>&1 || warn "couldn't open a browser, so visit it manually: $url"
}

# pause "msg" waits for the human to confirm they've done the manual part.
pause() {
  printf '  %s%s%s ' "$DIM" "${1:-Press Enter to continue}" "$RESET"
  read -r _ || true
}

# confirm "question" is a y/N gate; returns success on yes.
confirm() {
  local reply=""
  printf '  %s? %s [y/N] ' "$YELLOW" "$1"
  read -r reply || true
  [[ "$reply" =~ ^[Yy] ]]
}

# _existing KEY: current value of KEY in ENV_FILE, if any.
_existing() {
  [[ -f "$ENV_FILE" ]] || return 1
  local line; line=$(grep -E "^${1}=" "$ENV_FILE" | tail -n1) || return 1
  printf '%s' "${line#*=}"
}

# ask KEY "Prompt" reads a value into $KEY. Offers the existing .env value as
# a default on re-runs (Enter keeps it). Visible input (non-secret).
ask() {
  local key="$1" prompt="$2" current input
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then
    printf '  %s%s%s %s[Enter keeps current]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  read -r input || true
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

# ask_secret KEY "Prompt" is like ask, but input is hidden.
ask_secret() {
  local key="$1" prompt="$2" current input
  current=$(_existing "$key" || true)
  if [[ -n "$current" ]]; then
    printf '  %s%s%s %s[Enter keeps current]%s ' "$BOLD" "$prompt" "$RESET" "$DIM" "$RESET"
  else
    printf '  %s%s%s ' "$BOLD" "$prompt" "$RESET"
  fi
  read -rs input || true
  printf '\n'
  [[ -z "$input" && -n "$current" ]] && input="$current"
  printf -v "$key" '%s' "$input"
}

# write_env KEY VALUE upserts KEY=VALUE into ENV_FILE (creates it; replaces
# any existing line). Idempotent.
write_env() {
  local key="$1" value="$2" tmp
  touch "$ENV_FILE"
  tmp=$(mktemp)
  grep -vE "^${key}=" "$ENV_FILE" > "$tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$ENV_FILE"
  WRITTEN_ENV+=("$key")
  printf '  %s✓ wrote%s %s → %s\n' "$GREEN" "$RESET" "$key" "$ENV_FILE"
}

# set_secret NAME VALUE sets a GitHub Actions repo secret via gh. Falls back
# to a warning (and records it) if gh is unavailable or unauthenticated.
set_secret() {
  local name="$1" value="$2"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if printf '%s' "$value" | gh secret set "$name" >/dev/null 2>&1; then
      WRITTEN_SECRET+=("$name")
      printf '  %s✓ set%s GitHub secret %s\n' "$GREEN" "$RESET" "$name"
      return
    fi
  fi
  SKIPPED+=("GitHub secret $name (set it manually: gh secret set $name)")
  warn "skipped GitHub secret $name: gh not ready; set it later"
}

# set_var NAME VALUE sets a GitHub Actions repo variable (non-secret).
set_var() {
  local name="$1" value="$2"
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if gh variable set "$name" --body "$value" >/dev/null 2>&1; then
      printf '  %s✓ set%s GitHub variable %s\n' "$GREEN" "$RESET" "$name"
      return
    fi
  fi
  SKIPPED+=("GitHub variable $name")
  warn "skipped GitHub variable $name, gh not ready; set it later"
}

# finish clears, then shows a closing summary of everything configured.
finish() {
  _clear
  printf '\n%s%s  ✓ Setup complete%s\n' "$BOLD" "$GREEN" "$RESET"
  (( ${#WRITTEN_ENV[@]} ))    && note "wrote ${#WRITTEN_ENV[@]} value(s) to $ENV_FILE: ${WRITTEN_ENV[*]}"
  (( ${#WRITTEN_SECRET[@]} )) && note "set ${#WRITTEN_SECRET[@]} GitHub secret(s): ${WRITTEN_SECRET[*]}"
  if (( ${#SKIPPED[@]} )); then
    printf '\n'; warn "still to do by hand:"
    for s in "${SKIPPED[@]}"; do note "  - $s"; done
  fi
  printf '\n'
}

# ──────────────────────────────────────────────────────────────────────────
# STAGES: author this section. One stage() per step the human takes.
# Replace the example below. Set TOTAL_STAGES to match the stages you write.
# ──────────────────────────────────────────────────────────────────────────

TOTAL_STAGES=6

banner "Rilis dotbox: push ke master + pasang di nginx"

# ── Stage 1: Prasyarat yang tidak bisa dilewati ────────────────────────────
# Gerbang ini bersifat keras: rilis tidak boleh jalan bila QA belum lulus atau
# CEO belum menyetujui. Wizard menolak, bukan sekadar mengingatkan.
stage "Prasyarat: QA lulus & CEO setuju"
say "Rilis hanya boleh jalan setelah DUA hal ini benar. Kami periksa dulu."
note "1) QA sudah melaporkan suite HIJAU (62 dari 65 lulus -> 65/65, 0 gagal)."
note "2) CEO sudah menyetujui isi rilis (opsi P4/P7 dan cakupan push)."

if ! confirm "Sudahkah QA melaporkan 0 gagal DAN CEO menyetujui rilis ini?"; then
  warn "Berhenti. Jangan men-deploy sebelum QA hijau dan CEO setuju."
  warn "Wizard ini sengaja menolak melanjutkan."
  exit 1
fi
say "Baik. Lanjut."

# ── Stage 2: Konfirmasi keadaan repo sebelum push ──────────────────────────
# Kenapa manusia: hanya CEO yang boleh memutuskan mendorong ke master, dan
# hanya dia yang tahu apakah ada pekerjaan lain di master.
stage "Repo bersih & cabang benar"
say "Kami akan push HEAD dari worktree ini ke origin/master. Periksa dulu:"
step "Jalankan perintah ini di worktree dan baca keluarannya:"
printf '\n    git status --short\n    git log --oneline -3\n    git rev-parse --short HEAD\n\n'
say "Yang harus Anda lihat: tidak ada perubahan penting yang belum di-commit,"
say "dan commit teratas adalah kode yang sudah lulus QA."
if ! confirm "Repo sudah siap di-push?"; then
  warn "Batalkan. Rapikan dulu (commit / perbaiki), lalu jalankan wizard lagi."
  exit 1
fi

# ── Stage 3: Push ke master, tanpa --force ─────────────────────────────────
# Skrip push memeriksa fast-forward lebih dulu dan MENOLAK memaksa. Bila ini
# bukan fast-forward, skrip berhenti dan Anda harus memutuskan sendiri.
stage "Push ke GitHub master (tanpa --force)"
say "Kita cek dulu apakah ini fast-forward — dry-run tidak mengirim apa pun:"
step "Jalankan:  deploy/push.sh --dry-run"
say "Bila tertulis 'aman: ini fast-forward', kirim sungguhan dengan"
say "membuka komentar baris push di deploy/push.sh, lalu:"
step "Jalankan:  deploy/push.sh"
note "Skrip TIDAK memakai --force. Bila master punya commit yang belum ada di"
note "lokal, ia berhenti dan melapor — bukan menimpa pekerjaan orang lain."
pause "Tekan Enter setelah push selesai."

# ── Stage 4: Pasang vhost nginx ────────────────────────────────────────────
# Hanya manusia yang boleh mengubah konfigurasi nginx server bersama, karena
# port 80 melayani layanan lain. Kami siapkan berkasnya, Anda yang pasang.
stage "Pasang vhost nginx (situs statis)"
say "Server dotbox TIDAK punya build dan TIDAK punya dependensi. Deploy ="
say "menyalin berkas statis. Kami sajikan di sub-path /dotbox/ supaya tidak"
say "menabrak vhost default yang sudah ada di port 80."
step "Salin konfigurasi ke server (dari worktree):"
printf '\n    scp -F /home/serverbot/aidev/workspace/.babd-ssh/config \\\n        deploy/nginx-dotbox.conf aidev:/etc/nginx/sites-available/dotbox.conf\n\n'
step "Buat docroot rilis & aktifkan symlink yang sudah disiapkan publish.sh:"
printf '\n    ssh -F /home/serverbot/aidev/workspace/.babd-ssh/config aidev \\\n      "mkdir -p /var/www/dotbox/releases"\n\n'
step "Uji konfigurasi LEBIH DULU sebelum menerapkannya:"
printf '\n    ssh -F ... aidev "nginx -t"\n\n'
note "Kalau 'nginx -t' gagal, JANGAN reload. Perbaiki dulu berkasnya."
step "Uji dan aktifkan hanya bila 'nginx -t' sukses:"
printf '\n    ssh -F ... aidev "ln -sfn /etc/nginx/sites-available/dotbox.conf \\\n        /etc/nginx/sites-enabled/dotbox.conf && nginx -t && systemctl reload nginx"\n\n'
pause "Tekan Enter setelah nginx memuat konfigurasi baru."

# ── Stage 5: Health check & asap ───────────────────────────────────────────
# Bukti sebelum klaim: kita tidak bilang "deploy berhasil" tanpa respons 200.
stage "Health check: bukti situs hidup"
say "Kami panggil health endpoint dan halaman utama, lalu menampilkan hasilnya."
step "Jalankan health check dari dalam worktree:"
printf '\n    deploy/publish.sh --verify\n\n'
step "Cek juga langsung dari server (tanpa curl, pakai node):"
printf '\n    ssh -F ... aidev \x27node -e "require(\x27http\x27).get(\x27http://127.0.0.1/dotbox/health\x27,r=>{console.log(r.statusCode);r.resume()})"\x27\n\n'
say "Yang harus Anda lihat: status 200 pada halaman dan endpoint health."
note "Bila gagal: JANGAN panik. Rollback ada di stage berikutnya."

# ── Stage 6: Rollback (hanya bila perlu) ───────────────────────────────────
stage "Rollback bila ada masalah"
say "Bila situs rusak setelah rilis, kembalikan ke rilis sebelumnya dalam satu"
say "perintah. Ia menukar symlink kembali lalu memverifikasi ulang."
step "Jalankan:  deploy/publish.sh --rollback"
step "Lihat keadaan kapan saja dengan:  deploy/publish.sh --status"
note "Ini menyelamatkan rilis sebelumnya, jadi tidak ada kehilangan data."
pause "Tekan Enter untuk menutup."

# ──────────────────────────────────────────────────────────────────────────

finish
