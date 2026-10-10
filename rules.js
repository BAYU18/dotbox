/* ===================================
   DOTS AND BOXES - ATURAN MURNI (RULES)

   Satu-satunya sumber kebenaran aturan kotak.
   Tanpa DOM, tanpa localStorage, tanpa Audio:
   bisa dijalankan di browser (<script src>) maupun di Node (test).

   Interface publik (lihat docs/adr/0001-seam-aturan-murni.md):
     Rules.createBoard(gridSize)          -> State
     Rules.availableMoves(state)          -> Move[]
     Rules.applyMove(state, move, player) -> { state, boxesGained, extraTurn }
     Rules.isBoxComplete(state, r, c)     -> boolean
     Rules.score(state, playerCount)      -> number[]

   Nilai kanonik "belum dimiliki" adalah `owner === null` (GLOSSARY.md).
   Catatan implementasi: berkas ini SENGAJA tidak memakai optional
   chaining (tanda tanya + titik), karena pola itu membuat garis yang
   tidak ada terbaca sebagai "terpasang" (undefined !== null === true).
   Batas papan selalu diperiksa lebih dulu dengan guard eksplisit.
   =================================== */

(function (root) {
    'use strict';

    /* ---------- PEMBUATAN PAPAN ---------- */

    function createBoard(gridSize) {
        if (!Number.isInteger(gridSize) || gridSize < 2) {
            throw new RangeError('gridSize harus bilangan bulat >= 2');
        }

        const edges = {
            horizontal: Array.from({ length: gridSize }, () =>
                Array.from({ length: gridSize - 1 }, () => ({ owner: null }))
            ),
            vertical: Array.from({ length: gridSize - 1 }, () =>
                Array.from({ length: gridSize }, () => ({ owner: null }))
            )
        };

        const boxes = Array.from({ length: gridSize - 1 }, () =>
            Array.from({ length: gridSize - 1 }, () => ({ owner: null }))
        );

        return { config: { gridSize }, edges, boxes };
    }

    /* ---------- GARIS ---------- */

    function getEdge(state, move) {
        if (!move || !isMoveInBounds(state, move)) return null;
        if (move.type === 'horizontal') return state.edges.horizontal[move.row][move.col];
        return state.edges.vertical[move.row][move.col];
    }

    function isMoveInBounds(state, move) {
        const gridSize = state.config.gridSize;
        if (!move || !Number.isInteger(move.row) || !Number.isInteger(move.col)) return false;
        if (move.row < 0 || move.col < 0) return false;
        if (move.type === 'horizontal') return move.row < gridSize && move.col < gridSize - 1;
        if (move.type === 'vertical') return move.row < gridSize - 1 && move.col < gridSize;
        return false;
    }

    function availableMoves(state) {
        const gridSize = state.config.gridSize;
        const moves = [];

        for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize - 1; col++) {
                if (state.edges.horizontal[row][col].owner === null) {
                    moves.push({ type: 'horizontal', row, col });
                }
            }
        }

        for (let row = 0; row < gridSize - 1; row++) {
            for (let col = 0; col < gridSize; col++) {
                if (state.edges.vertical[row][col].owner === null) {
                    moves.push({ type: 'vertical', row, col });
                }
            }
        }

        return moves;
    }

    /* ---------- KOTAK ---------- */

    function inBoxBounds(state, r, c) {
        const gridSize = state.config.gridSize;
        return r >= 0 && c >= 0 && r <= gridSize - 2 && c <= gridSize - 2;
    }

    function isBoxComplete(state, r, c) {
        // Guard batas lebih dulu: garis yang tidak ada tidak pernah dibaca.
        if (!inBoxBounds(state, r, c)) return false;

        const top = state.edges.horizontal[r][c];
        const bottom = state.edges.horizontal[r + 1][c];
        const left = state.edges.vertical[r][c];
        const right = state.edges.vertical[r][c + 1];

        return top.owner !== null && bottom.owner !== null &&
               left.owner !== null && right.owner !== null;
    }

    /* Kotak mana saja yang bersinggungan dengan `move`. */
    function boxesTouching(move) {
        if (move.type === 'horizontal') {
            return [{ row: move.row - 1, col: move.col }, { row: move.row, col: move.col }];
        }
        return [{ row: move.row, col: move.col - 1 }, { row: move.row, col: move.col }];
    }

    /* ---------- PENERAPAN GERAKAN ---------- */

    function copyState(state) {
        const gridSize = state.config.gridSize;
        return {
            config: { gridSize },
            edges: {
                horizontal: state.edges.horizontal.map((row) => row.map((e) => ({ owner: e.owner }))),
                vertical: state.edges.vertical.map((row) => row.map((e) => ({ owner: e.owner })))
            },
            boxes: state.boxes.map((row) => row.map((b) => ({ owner: b.owner })))
        };
    }

    function applyMove(state, move, player) {
        if (!isMoveInBounds(state, move)) {
            throw new RangeError(`move di luar papan: ${JSON.stringify(move)}`);
        }

        const berikutnya = copyState(state);
        const edge = getEdge(berikutnya, move);

        if (edge.owner !== null) {
            // Garis sudah dimiliki: tidak ada yang berubah, bukan giliran ekstra.
            return { state: berikutnya, boxesGained: [], extraTurn: false };
        }

        edge.owner = player;

        const boxesGained = [];
        for (const box of boxesTouching(move)) {
            if (isBoxComplete(berikutnya, box.row, box.col) &&
                berikutnya.boxes[box.row][box.col].owner === null) {
                berikutnya.boxes[box.row][box.col].owner = player;
                boxesGained.push({ row: box.row, col: box.col });
            }
        }

        return { state: berikutnya, boxesGained, extraTurn: boxesGained.length > 0 };
    }

    /* ---------- SKOR ---------- */

    function score(state, playerCount) {
        const jumlah = playerCount || 0;
        const hasil = new Array(jumlah).fill(0);
        const gridSize = state.config.gridSize;

        for (let row = 0; row < gridSize - 1; row++) {
            for (let col = 0; col < gridSize - 1; col++) {
                const owner = state.boxes[row][col].owner;
                if (owner !== null && owner >= 0 && owner < jumlah) hasil[owner]++;
            }
        }

        return hasil;
    }

    function totalBoxes(state) {
        const gridSize = state.config.gridSize;
        return (gridSize - 1) * (gridSize - 1);
    }

    const Rules = {
        createBoard,
        isMoveInBounds,
        getEdge,
        availableMoves,
        isBoxComplete,
        boxesTouching,
        copyState,
        applyMove,
        score,
        totalBoxes
    };

    root.Rules = Rules;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Rules;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
