/* ===================================
   DOTS AND BOXES - AI ENGINE

   Peran: DECISION POLICY saja (kebijakan memilih gerakan).
   Aturan papan sepenuhnya didelegasikan ke `rules.js` (ADR-0001),
   sehingga tidak ada lagi duplikasi aturan kotak dan tidak ada
   pola optional chaining yang menganggap garis tidak ada sebagai
   "terpasang" (hazard phantom edge).
   =================================== */

(function (root) {
    'use strict';

    const Aturan =
        (typeof globalThis !== 'undefined' && globalThis.Rules) ||
        (typeof module !== 'undefined' && module.exports ? require('./rules.js') : null);

    if (!Aturan) {
        throw new Error('rules.js harus dimuat lebih dulu daripada ai-engine.js');
    }

    const BATAS_WAKTU_CARI_MS = 1500; // time budget agar UI tidak membeku (7x7, depth 5)

    class AIEngine {
        constructor(depth = 3) {
            this.depth = Math.max(1, Number(depth) || 1);
        }

        /* ===============================
           BEST MOVE (pencarian berkedalaman)
        =============================== */

        getBestMove(gameState, playerIndex) {
            const legal = Aturan.availableMoves(gameState);
            if (legal.length === 0) return null;

            // Semua gerakan bernilai sama di papan kosong: tidak perlu mencari.
            if (legal.length === Aturan.totalBoxes(gameState) * 2) {
                return legal[Math.floor(Math.random() * legal.length)];
            }

            const waktuMulai = Date.now();
            const posisiAwal = this._toSearchState(gameState);
            const hasil = this.searchPilihGerakan(posisiAwal, playerIndex, this.depth, waktuMulai);

            if (hasil && hasil.move) return hasil.move;

            // Jaring pengaman: bila pencarian tidak menghasilkan apa pun, pakai heuristik aman.
            return this.pilihGerakanAman(gameState, playerIndex, legal);
        }

        /* ===============================
           MINIMAX + ALPHA-BETA
        =============================== */

        searchPilihGerakan(state, player, depth, waktuMulai) {
            const moves = this._urutkanPertama(Aturan.availableMoves(state), state, player);
            let best = null;
            let bestNilai = -Infinity;
            let bestMengklaim = false;

            for (const move of moves) {
                const r = Aturan.applyMove(state, move, player);
                // Setelah gerakan, giliran tetap `player` bila ia mengklaim kotak.
                const nilai = this.search(
                    r.state,
                    r.extraTurn ? player : this._berikutnya(state, player),
                    player,
                    depth,
                    -Infinity,
                    Infinity,
                    waktuMulai
                );

                // Tie-break eksplisit: mengklaim kotak menang atas gerakan bernilai sama.
                // Tanpa ini, beberapa kandidat bernilai sama membuat AI bisa melewatkan
                // kotak yang sudah tinggal satu sisi.
                const mengklaim = r.boxesGained.length > 0;
                const lebihBaik =
                    best === null ||
                    nilai > bestNilai ||
                    (nilai === bestNilai && mengklaim && !bestMengklaim);

                if (lebihBaik) {
                    bestNilai = nilai;
                    best = move;
                    bestMengklaim = mengklaim;
                }
            }

            return { move: best, score: bestNilai };
        }

        /* `state` = papan, `giliran` = pemain yang bergerak, `playerAkar` = pemain
           yang keputusannya sedang kita cari. Nilai selalu dari sudut `playerAkar`. */
        search(state, giliran, playerAkar, depth, alpha, beta, waktuMulai) {
            if (Date.now() - waktuMulai > BATAS_WAKTU_CARI_MS) {
                return this.evaluate(state, playerAkar); // habis waktu: nilai apa adanya
            }

            const moves = Aturan.availableMoves(state);
            if (moves.length === 0 || depth <= 0) {
                return this.evaluate(state, playerAkar);
            }

            const memaksimalkan = giliran === playerAkar;
            let best = memaksimalkan ? -Infinity : Infinity;

            for (const move of this._urutkanPertama(moves, state, giliran)) {
                const r = Aturan.applyMove(state, move, giliran);
                // Mengklaim kotak = giliran tetap; kalau tidak, giliran berpindah.
                const nilai = r.extraTurn
                    ? this.search(r.state, giliran, playerAkar, depth, alpha, beta, waktuMulai)
                    : this.search(r.state, this._berikutnya(state, giliran), playerAkar, depth - 1, alpha, beta, waktuMulai);

                if (memaksimalkan) {
                    best = Math.max(best, nilai);
                    alpha = Math.max(alpha, best);
                } else {
                    best = Math.min(best, nilai);
                    beta = Math.min(beta, best);
                }

                if (beta <= alpha) break; // alpha-beta pruning
            }

            return best;
        }

        evaluate(state, player) {
            const gridSize = state.config.gridSize;
            const lawan = this._berikutnya(state, player);
            let skor = 0;

            for (let r = 0; r < gridSize - 1; r++) {
                for (let c = 0; c < gridSize - 1; c++) {
                    const owner = state.boxes[r][c].owner;
                    if (owner === player) skor += 100;
                    else if (owner === lawan) skor -= 50;
                }
            }

            return skor;
        }

        /* ===============================
           HEURISTIK PENDUKUNG
        =============================== */

        getAvailableMoves(gameState) {
            return Aturan.availableMoves(gameState);
        }

        getBoxCompletingMoves(gameState) {
            return this.getAvailableMoves(gameState)
                .filter((move) => this.wouldCompleteBox(gameState, move));
        }

        /* Nama dipertahankan sebagai pembungkus tipis di atas `Rules`
           agar tidak ada perhitungan kotak kedua (lihat ledger Task 2). */
        isBoxAlmostComplete(state, r, c) {
            if (!this._kotakDalamPapan(state, r, c)) return false;
            if (state.boxes[r][c].owner !== null) return false;
            return this._jumlahSisi(state, r, c) === 3;
        }

        wouldCompleteBox(state, move) {
            const r = Aturan.applyMove(state, move, this._pemainBerjalan(state));
            return r.boxesGained.length > 0;
        }

        getSafeMoves(state, player) {
            const hasil = [];
            for (const move of Aturan.availableMoves(state)) {
                const r = Aturan.applyMove(state, move, player);
                if (r.boxesGained.length > 0) continue;           // menyelesaikan kotak: selalu aman
                if (this._memberiKotakLawan(r.state, player)) continue; // membuka kotak untuk lawan
                hasil.push(move);
            }
            return hasil;
        }

        wouldGiveOpponentBox(state, move, player) {
            const r = Aturan.applyMove(state, move, player);
            if (r.boxesGained.length > 0) return false;
            return this._memberiKotakLawan(r.state, player);
        }

        simulateMove(gameState, move, player) {
            const r = Aturan.applyMove(gameState, move, player);
            return { state: r.state, extraTurn: r.extraTurn, boxesGained: r.boxesGained };
        }

        evaluateMove(state, move, player) {
            const r = Aturan.applyMove(state, move, player);
            return this.evaluate(r.state, player);
        }

        cloneState(state) {
            return Aturan.copyState(state);
        }

        /* Jalur lama: sekarang memakai `Rules` dan berhenti sendiri.
           Mengembalikan { state, currentPlayer } seperti sebelumnya. */
        playAITurn(gameState, playerIndex) {
            let state = Aturan.copyState(gameState);
            let currentPlayer = playerIndex;
            const jumlahPemain = (gameState.players || []).length || 1;
            let keamanan = 0;

            while (keamanan++ < 1000) {
                const move = this.getBestMove(state, currentPlayer);
                if (!move) break;

                const hasil = Aturan.applyMove(state, move, currentPlayer);
                state = hasil.state;

                if (!hasil.extraTurn) {
                    currentPlayer = (currentPlayer + 1) % jumlahPemain;
                    break;
                }
            }

            return { state, currentPlayer };
        }

        /* ===============================
           INTERNAL
        =============================== */

        _toSearchState(gameState) {
            return gameState;
        }

        _berikutnya(state, player) {
            const jumlah = (state.players || []).length || 2;
            return (player + 1) % jumlah;
        }

        _pemainBerjalan(state) {
            return typeof state.currentPlayerIndex === 'number' ? state.currentPlayerIndex : 0;
        }

        _kotakDalamPapan(state, r, c) {
            const gridSize = state.config.gridSize;
            return r >= 0 && c >= 0 && r <= gridSize - 2 && c <= gridSize - 2;
        }

        _jumlahSisi(state, r, c) {
            let jumlah = 0;
            if (state.edges.horizontal[r][c].owner !== null) jumlah++;
            if (state.edges.horizontal[r + 1][c].owner !== null) jumlah++;
            if (state.edges.vertical[r][c].owner !== null) jumlah++;
            if (state.edges.vertical[r][c + 1].owner !== null) jumlah++;
            return jumlah;
        }

        /* Apakah ada kotak yang sudah tinggal 1 sisi di papan `state`
           (artinya lawan bisa mengklaimnya lebih dulu). */
        _memberiKotakLawan(state, player) {
            const gridSize = state.config.gridSize;
            for (let r = 0; r < gridSize - 1; r++) {
                for (let c = 0; c < gridSize - 1; c++) {
                    if (state.boxes[r][c].owner !== null) continue;
                    if (this._jumlahSisi(state, r, c) === 3) return true;
                }
            }
            return false;
        }

        /* Urutkan gerakan: yang mengklaim kotak dulu (mempercepat alpha-beta). */
        _urutkanPertama(moves, state, player) {
            const mengklaim = [];
            const lainnya = [];
            for (const move of moves) {
                const r = Aturan.applyMove(state, move, player);
                if (r.boxesGained.length > 0) mengklaim.push(move);
                else lainnya.push(move);
            }
            return mengklaim.concat(lainnya);
        }

        pilihGerakanAman(gameState, playerIndex, legal) {
            const kotak = this.getBoxCompletingMoves(gameState);
            if (kotak.length > 0) return kotak[0];

            const aman = this.getSafeMoves(gameState, playerIndex);
            if (aman.length > 0) return aman[0];

            const daftar = legal || Aturan.availableMoves(gameState);
            return daftar[Math.floor(Math.random() * daftar.length)];
        }
    }

    root.AIEngine = AIEngine;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = AIEngine;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
