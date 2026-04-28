/* ===================================
   DOTS AND BOXES - AI ENGINE
   FIXED: Extra turn when completing box
   Supports multi-player (4 players)
   =================================== */

class AIEngine {
    constructor(depth = 3) {
        this.depth = depth;
    }

    /* ===============================
       MAIN AI TURN (AUTO CHAIN PLAY)
    =============================== */
    playAITurn(gameState, playerIndex, callback) {
        let state = this.cloneState(gameState);
        let currentPlayer = playerIndex;

        while (true) {
            const move = this.getBestMove(state, currentPlayer);

            if (!move) break;

            const result = this.simulateMove(state, move, currentPlayer);
            state = result.state;

            // jika tidak dapat box → stop giliran
            if (!result.extraTurn) {
                currentPlayer = (currentPlayer + 1) % state.players.length;
                break;
            }

            // jika dapat box → AI lanjut lagi
        }

        callback(state, currentPlayer);
    }

    /* ===============================
       BEST MOVE
    =============================== */

    getBestMove(gameState, playerIndex) {
        const availableMoves = this.getAvailableMoves(gameState);

        if (availableMoves.length === 0) return null;

        // PRIORITY 1: complete box
        const boxMoves = this.getBoxCompletingMoves(gameState);
        if (boxMoves.length > 0) {
            return boxMoves[Math.floor(Math.random() * boxMoves.length)];
        }

        // PRIORITY 2: safe move
        const safeMoves = this.getSafeMoves(gameState, playerIndex);

        if (safeMoves.length > 0) {
            return this.pickBestMoveWithRandomness(
                gameState,
                safeMoves,
                playerIndex
            );
        }

        // PRIORITY 3: sacrifice
        return this.pickLeastDamagingMove(
            gameState,
            availableMoves,
            playerIndex
        );
    }

    /* ===============================
       AVAILABLE MOVES
    =============================== */

    getAvailableMoves(gameState) {
        const gridSize = gameState.config.gridSize;
        const moves = [];

        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize - 1; c++) {
                if (gameState.edges.horizontal[r][c].owner === null) {
                    moves.push({ type: "horizontal", row: r, col: c });
                }
            }
        }

        for (let r = 0; r < gridSize - 1; r++) {
            for (let c = 0; c < gridSize; c++) {
                if (gameState.edges.vertical[r][c].owner === null) {
                    moves.push({ type: "vertical", row: r, col: c });
                }
            }
        }

        return moves;
    }

    /* ===============================
       BOX COMPLETING
    =============================== */

    getBoxCompletingMoves(gameState) {
        const moves = [];

        for (const move of this.getAvailableMoves(gameState)) {
            if (this.wouldCompleteBox(gameState, move)) {
                moves.push(move);
            }
        }

        return moves;
    }

    wouldCompleteBox(state, move) {
        const grid = state.config.gridSize;

        if (move.type === "horizontal") {
            if (
                move.row > 0 &&
                this.isBoxAlmostComplete(state, move.row - 1, move.col)
            )
                return true;

            if (
                move.row < grid - 1 &&
                this.isBoxAlmostComplete(state, move.row, move.col)
            )
                return true;
        } else {
            if (
                move.col > 0 &&
                this.isBoxAlmostComplete(state, move.row, move.col - 1)
            )
                return true;

            if (
                move.col < grid - 1 &&
                this.isBoxAlmostComplete(state, move.row, move.col)
            )
                return true;
        }

        return false;
    }

    isBoxAlmostComplete(state, r, c) {
        let count = 0;

        if (state.edges.horizontal[r][c]?.owner !== null) count++;
        if (state.edges.horizontal[r + 1]?.[c]?.owner !== null) count++;
        if (state.edges.vertical[r]?.[c]?.owner !== null) count++;
        if (state.edges.vertical[r]?.[c + 1]?.owner !== null) count++;

        return count === 3;
    }

    /* ===============================
       SAFE MOVES
    =============================== */

    getSafeMoves(state, player) {
        return this.getAvailableMoves(state).filter(
            (m) => !this.wouldGiveOpponentBox(state, m, player)
        );
    }

    wouldGiveOpponentBox(state, move, player) {
        const result = this.simulateMove(state, move, player);
        const s = result.state;

        const grid = s.config.gridSize;

        if (move.type === "horizontal") {
            if (
                move.row > 0 &&
                this.isBoxAlmostComplete(s, move.row - 1, move.col)
            )
                return true;

            if (
                move.row < grid - 1 &&
                this.isBoxAlmostComplete(s, move.row, move.col)
            )
                return true;
        } else {
            if (
                move.col > 0 &&
                this.isBoxAlmostComplete(s, move.row, move.col - 1)
            )
                return true;

            if (
                move.col < grid - 1 &&
                this.isBoxAlmostComplete(s, move.row, move.col)
            )
                return true;
        }

        return false;
    }

    /* ===============================
       SIMULATE MOVE (FIXED)
    =============================== */

    simulateMove(gameState, move, player) {
        const state = this.cloneState(gameState);

        if (move.type === "horizontal") {
            state.edges.horizontal[move.row][move.col].owner = player;
        } else {
            state.edges.vertical[move.row][move.col].owner = player;
        }

        const extraTurn = this.applyCompletedBoxes(state, move, player);

        return { state, extraTurn };
    }

    /* ===============================
       APPLY BOXES (RETURN BOOL)
    =============================== */

    applyCompletedBoxes(state, move, player) {
        const grid = state.config.gridSize;
        let completed = false;

        const check = (r, c) => {
            if (
                state.edges.horizontal[r][c]?.owner !== null &&
                state.edges.horizontal[r + 1]?.[c]?.owner !== null &&
                state.edges.vertical[r]?.[c]?.owner !== null &&
                state.edges.vertical[r]?.[c + 1]?.owner !== null
            ) {
                if (state.boxes[r][c].owner === null) {
                    state.boxes[r][c].owner = player;
                    completed = true;
                }
            }
        };

        if (move.type === "horizontal") {
            if (move.row > 0) check(move.row - 1, move.col);
            if (move.row < grid - 1) check(move.row, move.col);
        } else {
            if (move.col > 0) check(move.row, move.col - 1);
            if (move.col < grid - 1) check(move.row, move.col);
        }

        return completed;
    }

    /* ===============================
       MOVE EVALUATION
    =============================== */

    evaluateMove(state, move, player) {
        const result = this.simulateMove(state, move, player);
        const s = result.state;

        let score = 0;
        const grid = s.config.gridSize;

        for (let r = 0; r < grid - 1; r++) {
            for (let c = 0; c < grid - 1; c++) {
                const owner = s.boxes[r][c].owner;

                if (owner === player) score += 100;
                else if (owner !== null) score -= 50;
            }
        }

        score += Math.random() * 5;

        return score;
    }

    pickBestMoveWithRandomness(state, moves, player) {
        const scored = moves.map((m) => ({
            move: m,
            score: this.evaluateMove(state, m, player),
        }));

        scored.sort((a, b) => b.score - a.score);

        const best = scored[0].score;

        const bestMoves = scored
            .filter((m) => m.score >= best - 5)
            .map((m) => m.move);

        return bestMoves[Math.floor(Math.random() * bestMoves.length)];
    }

    pickLeastDamagingMove(state, moves, player) {
        let best = moves[0];
        let bestScore = this.evaluateMove(state, best, player);

        for (let i = 1; i < moves.length; i++) {
            const score = this.evaluateMove(state, moves[i], player);

            if (score > bestScore) {
                bestScore = score;
                best = moves[i];
            }
        }

        return best;
    }

    /* ===============================
       UTIL
    =============================== */

    cloneState(state) {
        return {
            config: { ...state.config },

            edges: {
                horizontal: state.edges.horizontal.map((r) =>
                    r.map((e) => ({ ...e }))
                ),

                vertical: state.edges.vertical.map((r) =>
                    r.map((e) => ({ ...e }))
                ),
            },

            boxes: state.boxes.map((r) => r.map((b) => ({ ...b }))),

            players: state.players.map((p) => ({ ...p })),
        };
    }
}

if (typeof module !== "undefined") {
    module.exports = AIEngine;
}