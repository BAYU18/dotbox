/* ============================================================
   Test untuk `turn-queue.js` — penjadwal giliran AI satu-slot.

   Jalankan:  node --test test/turn-queue.test.js

   Alasan test ini ada (P1):
   Penjadwalan giliran AI hari ini tersebar di empat jalur `setTimeout`
   (`script.js:181`, `:594`, `:631` lewat `makeAIMove`, dan `:724`
   langsung ke `executeAIMove`). Tidak ada satu pun pembatalan timer:
   `aiMoveTimeout` (`script.js:720`) adalah variabel MATI. Akibatnya AI
   dapat bergerak dua kali untuk satu giliran logis, atau bergerak di
   papan yang sudah direset (eksekusi basi).

   Modul ini murni (tanpa DOM). Karena `setTimeout` host di suite
   integrasi bersifat SINKRON (`setTimeout: (fn) => fn()`), test di sini
   menyuntikkan penjadwal TIRUAN agar timer bisa benar-benar "pending".
   Ini sejalan dengan `codebase-design`: "accept dependencies, don't
   create them".
   ============================================================ */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const MODUL = path.join(__dirname, '..', 'turn-queue.js');
/* KEHORMATAN BUKTI (ADR-0002): berkas test ini DITULIS oleh architect tetapi
   BELUM PERNAH DIJALANKAN (langkah penulisan tidak punya akses shell).
   Hasil yang DIHARAPKAN sebelum T2:  node --test test/turn-queue.test.js
   -> "Cannot find module '.../turn-queue.js'". Warna hijau/merah sebenarnya
   dicatat oleh developer/qa yang menjalankannya, bukan diklaim di sini. */
const { createTurnQueue, shouldScheduleAI } = require(MODUL);

/* Penjadwal tiruan: menyimpan fungsi TANPA memanggilnya, sehingga timer
   dapat berada dalam keadaan "pending" secara deterministik. */
function penjadwalTiruan() {
    const timer = new Map();
    let id = 0;
    return {
        schedule(fn, delayMs) {
            const handle = ++id;
            timer.set(handle, { fn, delayMs });
            return handle;
        },
        cancel(handle) {
            timer.delete(handle);
        },
        aktif: () => timer.size,
        /* Jalankan satu-satunya timer yang (masih) pending, seperti
           peluncuran timer oleh event loop. */
        tembak() {
            const pending = [...timer.values()];
            timer.clear();
            pending.forEach(({ fn }) => fn());
        }
    };
}

test('hanya satu timer AI aktif', () => {
    const p = penjadwalTiruan();
    const q = createTurnQueue({ schedule: p.schedule, cancel: p.cancel });

    q.schedule(() => {}, 400);
    q.schedule(() => {}, 400);
    q.schedule(() => {}, 400);

    assert.strictEqual(p.aktif(), 1, 'tiga panggilan schedule harus menyisakan tepat satu timer');
    assert.strictEqual(q.isPending(), true, 'isPending() harus true selama timer belum lewat');

    q.clear();
    assert.strictEqual(p.aktif(), 0, 'clear() harus membatalkan timer yang tersisa');
    assert.strictEqual(q.isPending(), false, 'isPending() harus false setelah clear()');
});

test('schedule dipanggil dua kali menghasilkan satu eksekusi', () => {
    const p = penjadwalTiruan();
    const q = createTurnQueue({ schedule: p.schedule, cancel: p.cancel });

    let dipanggil = 0;
    q.schedule(() => { dipanggil++; }, 400);
    q.schedule(() => { dipanggil++; }, 400); // menggantikan slot, bukan menambah

    p.tembak(); // event loop menjalankan timer yang tersisa

    assert.strictEqual(dipanggil, 1, 'dua panggilan schedule harus menghasilkan satu eksekusi');
    assert.strictEqual(q.isPending(), false, 'setelah dijalankan, tidak ada timer pending');
});

/* test-4 di rencana: clear() mencegah eksekusi basi setelah papan direset. */
test('clear() mencegah eksekusi basi setelah papan direset', () => {
    const p = penjadwalTiruan();
    const q = createTurnQueue({ schedule: p.schedule, cancel: p.cancel });

    let dipanggil = 0;
    q.schedule(() => { dipanggil++; }, 400);
    q.clear();  // papan direset -> giliran tertunda dibatalkan
    p.tembak(); // seandainya timer tetap menyala

    assert.strictEqual(dipanggil, 0, 'fungsi yang sudah dibatalkan tidak boleh dijalankan');
});

test('shouldScheduleAI hanya true saat giliran pemain AI dan game berjalan', () => {
    const ai = (extra = {}) => ({
        isGameOver: false,
        isReplayMode: false,
        currentPlayerIndex: 1,
        players: [{ isAI: false }, { isAI: true }],
        ...extra
    });

    assert.strictEqual(shouldScheduleAI(ai()), true, 'giliran AI & game berjalan -> true');
    assert.strictEqual(shouldScheduleAI(ai({ isGameOver: true })), false, 'game over -> false');
    assert.strictEqual(shouldScheduleAI(ai({ isReplayMode: true })), false, 'mode replay -> false');
    assert.strictEqual(
        shouldScheduleAI(ai({ currentPlayerIndex: 0 })), false, 'giliran manusia -> false');
    assert.strictEqual(
        shouldScheduleAI(ai({ players: [] })), false, 'pemain tidak ada -> false (tanpa throw)');
    assert.strictEqual(shouldScheduleAI(null), false, 'state null -> false (tanpa throw)');
});
