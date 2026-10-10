/* ===================================
   DOTS AND BOXES - PENJADWAL GILIRAN AI (TURN QUEUE)

   Satu-satunya tempat giliran AI "tertunda" dijadwalkan dan dibatalkan.
   Tanpa DOM, tanpa localStorage, tanpa waktu nyata: bisa dijalankan di
   browser (<script src>) maupun di Node (test).

   Interface publik (lihat docs/superpowers/specs/
   2026-10-10-p1-turn-queue-dan-skema-save-design.md §1.2):

     createTurnQueue(deps?)             -> TurnQueue
     TurnQueue.schedule(fn, delayMs)    -> boolean
     TurnQueue.clear()                  -> void      (idempoten)
     TurnQueue.isPending()              -> boolean
     TurnQueue.runNow()                 -> void      (HANYA test)
     shouldScheduleAI(state)            -> boolean   (murni)

   Kontrak: SINGLE-SLOT, bukan antrian FIFO. `schedule` yang dipanggil dua
   kali MENGGANTI isi slot yang sama dan menghasilkan SATU eksekusi — niat
   penulis lama di `script.js:723` ("Always reset at start - allow multiple
   calls") adalah "yang terakhir menang". Nama historis "queue" dipertahankan
   demi kesinambungan; perilakunya adalah penjadwal satu-slot.

   Ketergantungan `schedule`/`cancel` disuntikkan (bukan memanggil
   setTimeout host langsung) supaya timer bisa "pending" secara deterministik
   di test — "accept dependencies, don't create them".
   =================================== */

(function (root) {
    'use strict';

    function createTurnQueue(deps) {
        const opsi = deps || {};
        const scheduleFn = opsi.schedule || function (fn, delayMs) {
            return setTimeout(fn, delayMs);
        };
        const cancelFn = opsi.cancel || function (handle) {
            clearTimeout(handle);
        };

        // Slot tunggal. `slot === null` berarti tidak ada giliran tertunda.
        let slot = null; // { h: handle, fn: Function, token: object }

        function jalankan(fn) {
            slot = null;
            fn();
        }

        function schedule(fn, delayMs) {
            if (typeof fn !== 'function') return false;

            // Satu slot: buang yang tertunda sebelum memasang yang baru.
            if (slot !== null) {
                cancelFn(slot.h);
                slot = null;
            }

            const token = {};
            const slotBaru = { h: null, fn, token };
            slot = slotBaru;

            slotBaru.h = scheduleFn(function () {
                // Timer host menyala. Abaikan bila slot sudah digantikan/dibersihkan.
                if (slot !== slotBaru) return;
                jalankan(fn);
            }, delayMs);

            return true;
        }

        function clear() {
            if (slot !== null) {
                cancelFn(slot.h);
                slot = null;
            }
        }

        function isPending() {
            return slot !== null;
        }

        // HANYA untuk test: jalankan giliran tertunda saat ini juga.
        function runNow() {
            if (slot === null) return;
            const fn = slot.fn;
            jalankan(fn);
        }

        return { schedule, clear, isPending, runNow };
    }

    /* MURNI: boleh dijadwalkan giliran AI? Tanpa efek samping, tanpa throw. */
    function shouldScheduleAI(state) {
        if (!state || typeof state !== 'object') return false;
        if (state.isGameOver === true) return false;
        if (state.isReplayMode === true) return false;

        const players = state.players;
        if (!Array.isArray(players)) return false;

        const pemain = players[state.currentPlayerIndex];
        return !!(pemain && pemain.isAI === true);
    }

    const TurnQueue = { createTurnQueue, shouldScheduleAI };

    root.TurnQueue = TurnQueue;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TurnQueue;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
