/* ===================================
   DOTS AND BOXES - GAME LOGIC
   Mobile-friendly implementation
   Uses AIEngine for AI moves
   =================================== */

// ============ GAME STATE ============
// `let` (bukan `const`) supaya modul bisa dibangun ulang dari `Rules.createBoard`
// dan ditimpa dengan `_mutableState = Object.assign(_mutableState, ...)`.
let state = {
    config: {
        gridSize: 5,
        totalPlayers: 2,
        aiCount: 1,
        aiDepth: 3
    },
    players: [],
    currentPlayerIndex: 0,
    edges: {
        horizontal: [],
        vertical: []
    },
    boxes: [],
    scores: [],
    moveHistory: [],
    isGameOver: false,
    isReplayMode: false,
    isReplayPlaying: false,
    replayTimeout: null
};

/* Alias historis: nama yang dipakai di seluruh berkas ini dan di test.
   Satu objek, dua nama — tidak ada state kedua. */
const _mutableState = state;
const gameState = _mutableState;

// ============ ATURAN (SEAM TUNGGAL) ============
// Semua perhitungan aturan kotak didelegasikan ke modul `rules.js` (ADR-0001).
// Di browser `Rules` datang dari <script src="rules.js">; di Node, dari require.
if (typeof globalThis !== 'undefined' && !globalThis.Rules) {
    globalThis.Rules = require('./rules.js');
}
const Rules = globalThis.Rules;

// ============ PENJADWAL GILIRAN AI (SEAM TUNGGAL) ============
// Satu-satunya tempat giliran AI tertunda dijadwalkan/dibatalkan (P1).
// Di browser `TurnQueue` datang dari <script src="turn-queue.js"> (dimuat
// SEBELUM script.js); di Node, dari require.
if (typeof globalThis !== 'undefined' && !globalThis.TurnQueue) {
    globalThis.TurnQueue = require('./turn-queue.js');
}
const { createTurnQueue, shouldScheduleAI } = globalThis.TurnQueue;
const turnQueue = createTurnQueue();

// AI Engine instance
let aiEngine = null;

// Player color palette
const PLAYER_COLORS = [
    '#e53e3e', // Red
    '#3182ce', // Blue
    '#38a169', // Green
    '#805ad5'  // Purple
];

const PLAYER_NAMES = [
    'Pemain 1',
    'Pemain 2',
    'Pemain 3',
    'Pemain 4'
];

// ============ AUDIO SYSTEM ============
let audioContext = null;

function initAudio() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

function playSound(type) {
    if (!audioContext) initAudio();
    
    // Resume audio context if suspended
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        switch(type) {
            case 'line':
                oscillator.frequency.value = 440;
                oscillator.type = 'sine';
                gainNode.gain.value = 0.1;
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.1);
                break;
            case 'box':
                oscillator.frequency.value = 523;
                oscillator.type = 'sine';
                gainNode.gain.value = 0.15;
                oscillator.start();
                setTimeout(() => {
                    oscillator.frequency.value = 659;
                }, 100);
                oscillator.stop(audioContext.currentTime + 0.2);
                break;
            case 'win':
                oscillator.frequency.value = 523;
                oscillator.type = 'sine';
                gainNode.gain.value = 0.2;
                oscillator.start();
                setTimeout(() => oscillator.frequency.value = 659, 150);
                setTimeout(() => oscillator.frequency.value = 784, 300);
                oscillator.stop(audioContext.currentTime + 0.5);
                break;
        }
    } catch (e) {
        // Silently fail if audio not available
    }
}

// ============ INITIALIZATION ============
function initGame(config) {
    gameState.config = { ...config };
    gameState.currentPlayerIndex = 0;
    gameState.moveHistory = [];
    gameState.isGameOver = false;
    gameState.isReplayMode = false;
    gameState.isReplayPlaying = false;
    
    if (gameState.replayTimeout) {
        clearTimeout(gameState.replayTimeout);
    }
    
    const gridSize = config.gridSize;
    
    // Initialize edges
    gameState.edges.horizontal = Array(gridSize).fill(null).map(() => 
        Array(gridSize - 1).fill(null).map(() => ({ owner: null }))
    );
    gameState.edges.vertical = Array(gridSize - 1).fill(null).map(() => 
        Array(gridSize).fill(null).map(() => ({ owner: null }))
    );
    
    // Initialize boxes
    gameState.boxes = Array(gridSize - 1).fill(null).map(() => 
        Array(gridSize - 1).fill(null).map(() => ({
            owner: null,
            edges: { top: null, bottom: null, left: null, right: null }
        }))
    );
    
    // Initialize AI Engine
    aiEngine = new AIEngine(config.aiDepth);
    
    // Initialize players
    const humanCount = config.totalPlayers - config.aiCount;
    const totalPlayers = config.totalPlayers;
    gameState.players = [];
    gameState.scores = [];
    
    for (let i = 0; i < totalPlayers; i++) {
        gameState.players.push({
            id: i,
            name: i < humanCount ? PLAYER_NAMES[i] : `AI ${i - humanCount + 1}`,
            isAI: i >= humanCount,
            color: PLAYER_COLORS[i]
        });
        gameState.scores.push(0);
    }
    
    // Setup canvas and show game
    setupCanvas();
    drawBoard();
    updateUI();
    
    document.getElementById('configMenu').classList.add('hidden');
    document.getElementById('gameArea').classList.remove('hidden');
    document.getElementById('replayControls').classList.add('hidden');
    
    saveGame();
    
    // Start AI turn if needed
    if (gameState.players[0].isAI) {
        if (shouldScheduleAI(gameState)) turnQueue.schedule(makeAIMove, 500);
    }
}

// ============ CANVAS SETUP ============
let canvas, ctx;
let dotPositions = [];
let lineSegments = [];

function setupCanvas() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    const container = canvas.parentElement;
    const size = Math.min(container.clientWidth - 32, container.clientHeight - 32, 500);
    canvas.width = size;
    canvas.height = size;
    
    calculatePositions();
    
    canvas.removeEventListener('click', handleCanvasClick);
    canvas.removeEventListener('touchstart', handleTouchStart);
    
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    
    window.removeEventListener('resize', handleResize);
    window.addEventListener('resize', handleResize);
}

function handleResize() {
    const container = canvas.parentElement;
    const size = Math.min(container.clientWidth - 32, container.clientHeight - 32, 500);
    canvas.width = size;
    canvas.height = size;
    calculatePositions();
    drawBoard();
}

function calculatePositions() {
    const gridSize = gameState.config.gridSize;
    const padding = 50;
    const availableSize = Math.min(canvas.width, canvas.height) - padding * 2;
    const spacing = availableSize / (gridSize - 1);
    
    dotPositions = [];
    lineSegments = { horizontal: [], vertical: [] };
    
    // Calculate dot positions
    for (let row = 0; row < gridSize; row++) {
        dotPositions[row] = [];
        for (let col = 0; col < gridSize; col++) {
            dotPositions[row][col] = {
                x: padding + col * spacing,
                y: padding + row * spacing
            };
        }
    }
    
    // Horizontal edges
    for (let row = 0; row < gridSize; row++) {
        lineSegments.horizontal[row] = [];
        for (let col = 0; col < gridSize - 1; col++) {
            lineSegments.horizontal[row][col] = {
                start: dotPositions[row][col],
                end: dotPositions[row][col + 1],
                index: { row, col }
            };
        }
    }
    
    // Vertical edges
    for (let row = 0; row < gridSize - 1; row++) {
        lineSegments.vertical[row] = [];
        for (let col = 0; col < gridSize; col++) {
            lineSegments.vertical[row][col] = {
                start: dotPositions[row][col],
                end: dotPositions[row + 1][col],
                index: { row, col }
            };
        }
    }
}

// ============ DRAWING ============
function drawBoard() {
    const gridSize = gameState.config.gridSize;
    
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--bg-secondary');
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    drawBoxes();
    drawEdges();
    drawDots();
    drawPotentialLines();
}

function drawBoxes() {
    const gridSize = gameState.config.gridSize;
    
    for (let row = 0; row < gridSize - 1; row++) {
        for (let col = 0; col < gridSize - 1; col++) {
            const box = gameState.boxes[row][col];
            if (box.owner !== null) {
                const topLeft = dotPositions[row][col];
                const bottomRight = dotPositions[row + 1][col + 1];
                const width = bottomRight.x - topLeft.x;
                const height = bottomRight.y - topLeft.y;
                
                ctx.fillStyle = gameState.players[box.owner].color + '80';
                ctx.fillRect(topLeft.x + 2, topLeft.y + 2, width - 4, height - 4);
                
                ctx.strokeStyle = gameState.players[box.owner].color;
                ctx.lineWidth = 2;
                ctx.strokeRect(topLeft.x + 2, topLeft.y + 2, width - 4, height - 4);
                
                ctx.fillStyle = gameState.players[box.owner].color;
                ctx.font = 'bold 16px Poppins, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(box.owner + 1, topLeft.x + width/2, topLeft.y + height/2);
            }
        }
    }
}

function drawEdges() {
    const gridSize = gameState.config.gridSize;
    
    // Draw horizontal edges
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize - 1; col++) {
            const edge = gameState.edges.horizontal[row][col];
            if (edge.owner !== null) {
                const line = lineSegments.horizontal[row][col];
                drawSingleLine(line.start, line.end, gameState.players[edge.owner].color);
            }
        }
    }
    
    // Draw vertical edges
    for (let row = 0; row < gridSize - 1; row++) {
        for (let col = 0; col < gridSize; col++) {
            const edge = gameState.edges.vertical[row][col];
            if (edge.owner !== null) {
                const line = lineSegments.vertical[row][col];
                drawSingleLine(line.start, line.end, gameState.players[edge.owner].color);
            }
        }
    }
}

function drawSingleLine(start, end, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
}

function drawDots() {
    const gridSize = gameState.config.gridSize;
    
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const pos = dotPositions[row][col];
            
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.beginPath();
            ctx.arc(pos.x + 2, pos.y + 2, 10, 0, Math.PI * 2);
            ctx.fill();
            
            // Main dot
            ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--dot-color');
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
            ctx.fill();
            
            // Highlight
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath();
            ctx.arc(pos.x - 3, pos.y - 3, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawPotentialLines() {
    // Only show hints when it's a human player's turn and not in replay/game over
    if (gameState.isReplayMode || gameState.isGameOver) return;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.isAI) return;
    
    // Only show subtle hints if game just started or few moves made
    // Don't show all lines if player just completed a box (they should know their turn)
    const moveCount = gameState.moveHistory.length;
    
    // Show very subtle hints only in early game (first 5 moves per player)
    if (moveCount > 5 * gameState.players.length) return;
    
    const gridSize = gameState.config.gridSize;
    
    ctx.globalAlpha = 0.2; // Very subtle
    ctx.strokeStyle = currentPlayer.color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    
    // Only show a few potential moves, not all
    let shownCount = 0;
    const maxShow = 4;
    
    // Horizontal edges - limit display
    outer: for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize - 1; col++) {
            if (gameState.edges.horizontal[row][col].owner === null) {
                const line = lineSegments.horizontal[row][col];
                ctx.beginPath();
                ctx.moveTo(line.start.x, line.start.y);
                ctx.lineTo(line.end.x, line.end.y);
                ctx.stroke();
                shownCount++;
                if (shownCount >= maxShow) break outer;
            }
        }
    }
    
    // Vertical edges
    outer2: for (let row = 0; row < gridSize - 1 && shownCount < maxShow; row++) {
        for (let col = 0; col < gridSize; col++) {
            if (gameState.edges.vertical[row][col].owner === null) {
                const line = lineSegments.vertical[row][col];
                ctx.beginPath();
                ctx.moveTo(line.start.x, line.start.y);
                ctx.lineTo(line.end.x, line.end.y);
                ctx.stroke();
                shownCount++;
                if (shownCount >= maxShow) break outer2;
            }
        }
    }
    
    ctx.globalAlpha = 1;
}

// ============ INPUT HANDLING ============
function handleCanvasClick(event) {
    if (gameState.isReplayMode || gameState.isGameOver) return;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.isAI) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    handleLineSelection(x, y);
}

function handleTouchStart(event) {
    event.preventDefault();
    if (gameState.isReplayMode || gameState.isGameOver) return;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.isAI) return;
    
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    handleLineSelection(x, y);
}

function handleLineSelection(x, y) {
    const gridSize = gameState.config.gridSize;
    const hitRadius = 30; // Hit area for better mobile precision
    
    let bestMatch = null;
    let bestDistance = Infinity;
    
    // Find the closest available line (both horizontal and vertical)
    // Check horizontal edges
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize - 1; col++) {
            if (gameState.edges.horizontal[row][col].owner !== null) continue;
            
            const line = lineSegments.horizontal[row][col];
            const distance = getDistanceToLine(x, y, line.start, line.end);
            
            if (distance < bestDistance && distance < hitRadius) {
                bestDistance = distance;
                bestMatch = { type: 'horizontal', row, col, distance };
            }
        }
    }
    
    // Check vertical edges
    for (let row = 0; row < gridSize - 1; row++) {
        for (let col = 0; col < gridSize; col++) {
            if (gameState.edges.vertical[row][col].owner !== null) continue;
            
            const line = lineSegments.vertical[row][col];
            const distance = getDistanceToLine(x, y, line.start, line.end);
            
            if (distance < bestDistance && distance < hitRadius) {
                bestDistance = distance;
                bestMatch = { type: 'vertical', row, col, distance };
            }
        }
    }
    
    // Make the best match if found
    if (bestMatch) {
        makeMove(bestMatch.type, bestMatch.row, bestMatch.col);
    }
}

function getDistanceToLine(px, py, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lineLength = Math.sqrt(dx * dx + dy * dy);
    
    if (lineLength === 0) return Infinity;
    
    // Calculate perpendicular distance from point to line
    const distance = Math.abs(dy * px - dx * py + end.x * start.y - end.y * start.x) / lineLength;
    
    // Calculate how far along the line the closest point is
    const dotProduct = ((px - start.x) * dx + (py - start.y) * dy) / (lineLength * lineLength);
    
    // If closest point is outside the line segment, return distance to nearest endpoint
    if (dotProduct < 0) {
        return Math.sqrt((px - start.x) ** 2 + (py - start.y) ** 2);
    } else if (dotProduct > 1) {
        return Math.sqrt((px - end.x) ** 2 + (py - end.y) ** 2);
    }
    
    return distance;
}

// ============ GAME LOGIC ============
function makeMove(type, row, col) {
    const currentPlayer = gameState.currentPlayerIndex;

    // Validate move. Guard batas dipakai LEBIH DULU supaya indeks di luar
    // papan tidak pernah menyentuh array (sebelumnya `edges.horizontal[row][col]`
    // bisa melempar TypeError) dan supaya `Rules.applyMove` tidak melempar
    // RangeError di tengah makeMove (dulu kotak sudah diklaim padahal fungsi
    // keluar lewat exception -> riwayat & giliran tidak sinkron).
    const move = { type, row, col };
    if (!Rules.isMoveInBounds(gameState, move)) {
        showToast('Garis di luar papan!');
        return false;
    }

    if (type === 'horizontal' && gameState.edges.horizontal[row][col].owner !== null) {
        showToast('Garis sudah ada!');
        return false;
    }
    if (type === 'vertical' && gameState.edges.vertical[row][col].owner !== null) {
        showToast('Garis sudah ada!');
        return false;
    }
    
    // Record the move (riwayat untuk replay)
    const record = {
        type,
        row,
        col,
        player: currentPlayer,
        timestamp: Date.now()
    };
    gameState.moveHistory.push(record);

    playSound('line');

    // Satu-satunya penulis papan adalah `Rules.applyMove` (ADR-0001).
    // JANGAN menulis edge secara langsung di sini: kalau edge sudah terpasang
    // sebelum applyMove dipanggil, applyMove melihat `owner !== null` dan
    // mengembalikan `boxesGained: []` -> kotak tidak pernah diklaim.
    const completedBoxes = checkBoxCompletion(type, row, col);
    
    drawBoard();
    updateScores();
    
    if (completedBoxes.length > 0) {
        completedBoxes.forEach(box => highlightBox(box.row, box.col));
        playSound('box');
    }
    
    saveGame();
    
    if (isGameOver()) {
        endGame();
        return true;
    }
    
    if (completedBoxes.length > 0) {
        // Player got a box - they get another turn
        updateUI();
        
        // Check if game is over
        if (isGameOver()) {
            endGame();
            return true;
        }
        
        // If it's AI's turn, AI should make another move after a delay
        if (gameState.players[gameState.currentPlayerIndex].isAI) {
            if (shouldScheduleAI(gameState)) turnQueue.schedule(makeAIMove, 400);
        }
        return true;
    }
    
    switchTurn();
    return true;
}

function checkBoxCompletion(type, row, col) {
    // Klaim kotak dihitung `Rules.applyMove`; di sini kita hanya menyelaraskan papan.
    const hasil = Rules.applyMove(gameState, { type, row, col }, gameState.currentPlayerIndex);

    _mutableState.edges.horizontal = hasil.state.edges.horizontal;
    _mutableState.edges.vertical = hasil.state.edges.vertical;
    _mutableState.boxes = hasil.state.boxes;
    Object.assign(state, _mutableState);

    return hasil.boxesGained;
}

function isBoxComplete(row, col) {
    return Rules.isBoxComplete(gameState, row, col);
}

function switchTurn() {
    gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    updateUI();
    
    // Check if game is over
    if (isGameOver()) {
        endGame();
        return;
    }
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer.isAI) {
        if (shouldScheduleAI(gameState)) turnQueue.schedule(makeAIMove, 400);
    }
}

function highlightBox(row, col) {
    const topLeft = dotPositions[row][col];
    const bottomRight = dotPositions[row + 1][col + 1];
    const width = bottomRight.x - topLeft.x;
    const height = bottomRight.y - topLeft.y;
    
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 4;
    ctx.strokeRect(topLeft.x + 2, topLeft.y + 2, width - 4, height - 4);
}

function updateScores() {
    gameState.scores = Rules.score(gameState, gameState.players.length);
}

function isGameOver() {
    const totalBoxes = Rules.totalBoxes(gameState);
    // Jumlahkan kotak SEMUA pemain. Versi lama memakai `Rules.score(gameState, 1)[0]`
    // yang hanya menghitung kotak pemain 0 -> permainan tidak pernah berakhir bila
    // pemain lain memiliki kotak.
    const terisi = Rules.score(gameState, gameState.players.length)
        .reduce((jumlah, kotak) => jumlah + kotak, 0);
    return terisi === totalBoxes;
}

function endGame() {
    gameState.isGameOver = true;
    playSound('win');
    
    const maxScore = Math.max(...gameState.scores);
    const winners = [];
    
    gameState.scores.forEach((score, index) => {
        if (score === maxScore) {
            winners.push(index);
        }
    });
    
    const winnerDisplay = document.getElementById('winnerDisplay');
    const finalScores = document.getElementById('finalScores');
    
    if (winners.length === 1) {
        winnerDisplay.innerHTML = `🏆 Pemenang: <span style="color: ${gameState.players[winners[0]].color}">${gameState.players[winners[0]].name}</span>`;
    } else {
        const winnerNames = winners.map(i => `<span style="color: ${gameState.players[i].color}">${gameState.players[i].name}</span>`).join(' & ');
        winnerDisplay.innerHTML = `🏆 Pemenang Seri: ${winnerNames}`;
    }
    
    finalScores.innerHTML = gameState.scores.map((score, index) => {
        const isWinner = winners.includes(index);
        return `
            <div class="final-score-item ${isWinner ? 'winner' : ''}">
                <span style="color: ${gameState.players[index].color}">${gameState.players[index].name}</span>
                <span>${score} kotak</span>
            </div>
        `;
    }).join('');
    
    document.getElementById('gameOverModal').classList.remove('hidden');
    saveGameHistory();
}

// ============ UI UPDATES ============
function updateUI() {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    
    const turnIndicator = document.querySelector('.turn-indicator');
    const turnText = document.querySelector('.turn-text');
    turnIndicator.style.backgroundColor = currentPlayer.color;
    turnText.textContent = `Giliran: ${currentPlayer.name}`;
    
    const scoresContainer = document.getElementById('scores');
    scoresContainer.innerHTML = gameState.scores.map((score, index) => {
        const isActive = index === gameState.currentPlayerIndex;
        return `
            <div class="score-item ${isActive ? 'active' : ''}">
                <div class="score-dot" style="background-color: ${gameState.players[index].color}"></div>
                <span class="score-value">${score}</span>
                <span class="score-label">${gameState.players[index].name}</span>
            </div>
        `;
    }).join('');
}

// ============ AI ============
function makeAIMove() {
    // Satu-satunya penundaan eksekusi AI. Penjadwal satu-slot: pemanggilan
    // beruntun MENGGANTI giliran tertunda sebelumnya (yang terakhir menang),
    // sehingga AI tidak pernah bergerak dua kali untuk satu giliran logis.
    turnQueue.schedule(executeAIMove, 300);
}

function executeAIMove() {
    // Guard conditions
    if (gameState.isGameOver || gameState.isReplayMode || !aiEngine) return;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer || !currentPlayer.isAI) return;
    
    const aiState = {
        config: { ...gameState.config },
        edges: {
            horizontal: gameState.edges.horizontal.map(r => r.map(e => ({ ...e }))),
            vertical: gameState.edges.vertical.map(r => r.map(e => ({ ...e })))
        },
        boxes: gameState.boxes.map(r => r.map(b => ({ ...b }))),
        players: gameState.players
    };
    
    const move = aiEngine.getBestMove(aiState, gameState.currentPlayerIndex);
    
    if (!move) return;
    
    // Make the move directly
    makeMove(move.type, move.row, move.col);
    
    // Note: makeMove handles box completion - if AI gets a box, it stays same player's turn
    // So we need to check if AI should continue
}

// ============ STORAGE ============
/* Versi skema save yang dikenal. Save TANPA `version` dianggap v1
   (warisan, keputusan Q1-A); versi lain/rusak DITOLAK, tidak ditebak. */
const SCHEMA_VERSION = 1;
function versiDikenal(version) {
    if (version === undefined) return true; // save warisan -> diperlakukan v1
    return Number.isInteger(version) && version === SCHEMA_VERSION;
}

function saveGame() {
    const saveData = {
        version: SCHEMA_VERSION,
        config: gameState.config,
        players: gameState.players,
        currentPlayerIndex: gameState.currentPlayerIndex,
        edges: gameState.edges,
        boxes: gameState.boxes,
        scores: gameState.scores,
        moveHistory: gameState.moveHistory,
        isGameOver: gameState.isGameOver,
        timestamp: Date.now()
    };
    
    localStorage.setItem('dotsandboxes_current', JSON.stringify(saveData));
}

/* ============ VALIDASI DATA SIMPANAN ============
   `loadGame` sebelumnya menyalin `saveData.*` apa adanya ke `gameState`.
   Bila data rusak (skema lama, edit manual, penulisan sebagian), state
   permainan yang sedang berjalan ikut rusak TANPA bisa dipulihkan, dan
   `catch` yang menelan error membuat `loadGame()` mengembalikan `false`
   seolah-olah tidak terjadi apa-apa. (QA-2.)

   Aturan sekarang: bangun dulu seluruh state dari data simpanan ke kandidat
   MURNI, validasi, baru pasang ke `gameState` secara atomik. Bila ada satu
   saja yang tidak valid -> tolak, dan `gameState` tidak tersentuh. */

const SAVE_KEYS = ['config', 'players', 'currentPlayerIndex', 'edges', 'boxes', 'scores', 'moveHistory', 'isGameOver'];

function buatKandidatState(saveData) {
    if (!saveData || typeof saveData !== 'object' || Array.isArray(saveData)) return null;

    // --- versi skema ---
    if (!versiDikenal(saveData.version)) return null;

    for (const key of SAVE_KEYS) {
        if (!(key in saveData)) return null;
    }

    const { config, players, currentPlayerIndex, edges, boxes, scores, moveHistory, isGameOver } = saveData;

    // --- config ---
    if (!config || typeof config !== 'object') return null;
    const gridSize = config.gridSize;
    const totalPlayers = config.totalPlayers;
    const aiCount = config.aiCount;
    const aiDepth = config.aiDepth;
    if (!Number.isInteger(gridSize) || gridSize < 2) return null;
    if (!Number.isInteger(totalPlayers) || totalPlayers < 1 || totalPlayers > PLAYER_COLORS.length) return null;
    if (!Number.isInteger(aiCount) || aiCount < 0 || aiCount >= totalPlayers) return null;
    if (!Number.isInteger(aiDepth) || aiDepth < 1) return null;

    // --- pemain ---
    if (!Array.isArray(players) || players.length !== totalPlayers) return null;
    const pemainValid = players.every((p, i) =>
        p && typeof p === 'object' && typeof p.name === 'string' && typeof p.color === 'string' &&
        (typeof p.isAI === 'boolean') && (p.id === undefined || p.id === i));
    if (!pemainValid) return null;

    // --- indeks giliran ---
    if (!Number.isInteger(currentPlayerIndex) || currentPlayerIndex < 0 || currentPlayerIndex >= totalPlayers) return null;

    // --- papan (edges) ---
    if (!edges || typeof edges !== 'object' || !Array.isArray(edges.horizontal) || !Array.isArray(edges.vertical)) return null;
    if (edges.horizontal.length !== gridSize) return null;
    if (edges.vertical.length !== gridSize - 1) return null;

    const ownerSah = (owner) => owner === null || (Number.isInteger(owner) && owner >= 0 && owner < totalPlayers);
    const barisGarisSah = (baris, panjang) =>
        Array.isArray(baris) && baris.length === panjang &&
        baris.every((e) => e && typeof e === 'object' && ownerSah(e.owner));

    if (!edges.horizontal.every((baris) => barisGarisSah(baris, gridSize - 1))) return null;
    if (!edges.vertical.every((baris) => barisGarisSah(baris, gridSize))) return null;

    // --- kotak ---
    if (!Array.isArray(boxes) || boxes.length !== gridSize - 1) return null;
    const barisBoxSah = (baris) =>
        Array.isArray(baris) && baris.length === gridSize - 1 &&
        baris.every((b) => b && typeof b === 'object' && ownerSah(b.owner));
    if (!boxes.every(barisBoxSah)) return null;

    // --- skor, riwayat, selesai ---
    if (!Array.isArray(scores) || scores.length !== totalPlayers) return null;
    if (!scores.every((s) => Number.isInteger(s) && s >= 0)) return null;
    if (!Array.isArray(moveHistory)) return null;
    if (typeof isGameOver !== 'boolean') return null;

    // Kandidat murni: salinan siap dipasang ke gameState.
    return {
        config: { gridSize, totalPlayers, aiCount, aiDepth },
        players: players.map((p, i) => ({ id: i, name: p.name, isAI: p.isAI, color: p.color })),
        currentPlayerIndex,
        edges: {
            horizontal: edges.horizontal.map((baris) => baris.map((e) => ({ owner: e.owner }))),
            vertical: edges.vertical.map((baris) => baris.map((e) => ({ owner: e.owner })))
        },
        boxes: boxes.map((baris) => baris.map((b) => ({ owner: b.owner }))),
        scores: scores.slice(),
        moveHistory: moveHistory.slice(),
        isGameOver
    };
}

function loadGame() {
    const saved = localStorage.getItem('dotsandboxes_current');
    if (!saved) return false;

    // Buang giliran AI tertunda dari papan LAMA sebelum menyentuh state:
    // mencegah eksekusi basi bila muat gagal atau papan berbeda.
    turnQueue.clear();

    let saveData;
    try {
        saveData = JSON.parse(saved);
    } catch (e) {
        // JSON rusak: bukan exception yang ditelan, tapi penolakan yang jelas.
        console.error('Save tidak dapat di-parse sebagai JSON:', e.message);
        return false;
    }

    // Validasi SELESAI sebelum menyentuh gameState (QA-2): tidak ada state
    // setengah-termuat walau validasi gagal di tengah.
    const kandidat = buatKandidatState(saveData);
    if (!kandidat) {
        console.error('Save ditolak: struktur data tidak valid');
        return false;
    }

    // Pasang secara atomik setelah semua bagian terbukti sah.
    gameState.config = kandidat.config;
    gameState.players = kandidat.players;
    gameState.currentPlayerIndex = kandidat.currentPlayerIndex;
    gameState.edges = kandidat.edges;
    gameState.boxes = kandidat.boxes;
    gameState.scores = kandidat.scores;
    gameState.moveHistory = kandidat.moveHistory;
    gameState.isGameOver = kandidat.isGameOver;
    gameState.isReplayMode = false;

    // Reinitialize AI engine
    aiEngine = new AIEngine(gameState.config.aiDepth);

    setupCanvas();
    drawBoard();
    updateUI();

    document.getElementById('configMenu').classList.add('hidden');
    document.getElementById('gameArea').classList.remove('hidden');

    if (gameState.isGameOver) {
        endGame();
    }

    // R5: bila giliran AI yang BARU dimuat, jadwalkan ulang. `turnQueue.clear()`
    // di awal loadGame sudah membuang giliran basi dari papan lama; di sini kita
    // memasang giliran baru untuk state yang baru dipasang.
    // Urutan: clear() -> pasang state -> schedule().
    if (shouldScheduleAI(gameState)) turnQueue.schedule(makeAIMove, 400);

    showToast('Game dimuat dari save terakhir');
    return true;
}

function saveGameHistory() {
    const history = JSON.parse(localStorage.getItem('dotsandboxes_history') || '[]');
    
    const gameRecord = {
        id: Date.now(),
        config: gameState.config,
        players: gameState.players,
        moveHistory: gameState.moveHistory,
        scores: gameState.scores,
        winner: gameState.scores.indexOf(Math.max(...gameState.scores)),
        timestamp: Date.now()
    };
    
    history.unshift(gameRecord);
    if (history.length > 10) history.pop();
    
    localStorage.setItem('dotsandboxes_history', JSON.stringify(history));
}

// ============ REPLAY SYSTEM ============
function startReplay() {
    if (gameState.moveHistory.length === 0) {
        showToast('Tidak ada history untuk diputar');
        return;
    }
    
    gameState.isReplayMode = true;
    gameState.isReplayPlaying = false;
    
    resetBoardOnly();
    
    document.getElementById('replayControls').classList.remove('hidden');
    document.getElementById('replaySlider').max = gameState.moveHistory.length;
    document.getElementById('replaySlider').value = 0;
    updateReplayStep();
    
    drawBoard();
}

function replayStep(stepIndex) {
    // Simpan riwayat SEBELUM reset: `resetBoardOnly()` mengosongkan moveHistory,
    // jadi membacanya setelah reset membuat replay tidak pernah memutar langkah apa pun.
    const riwayat = gameState.moveHistory.slice();
    resetBoardOnly();
    gameState.moveHistory = riwayat;

    for (let i = 0; i <= stepIndex && i < riwayat.length; i++) {
        replayMove(riwayat[i]);
    }
    
    updateReplayStep();
    drawBoard();
}

function replayMove(move) {
    if (move.type === 'horizontal') {
        gameState.edges.horizontal[move.row][move.col].owner = move.player;
    } else {
        gameState.edges.vertical[move.row][move.col].owner = move.player;
    }

    // Klaim kotak dihitung ulang langsung dari papan (bukan lewat Rules.applyMove,
    // karena edge SUDAH ditulis di atas -> applyMove akan melihat `owner !== null`
    // dan mengembalikan `boxesGained: []` sehingga kotak tak pernah diklaim saat replay).
    const pemilik = move.player;
    for (let r = 0; r < gameState.boxes.length; r++) {
        for (let c = 0; c < gameState.boxes[r].length; c++) {
            if (gameState.boxes[r][c].owner === null && Rules.isBoxComplete(gameState, r, c)) {
                gameState.boxes[r][c].owner = pemilik;
            }
        }
    }
}

function toggleReplayPlay() {
    if (gameState.isReplayPlaying) {
        gameState.isReplayPlaying = false;
        if (gameState.replayTimeout) clearTimeout(gameState.replayTimeout);
        document.getElementById('replayPlayPause').textContent = '▶️ Play';
    } else {
        if (parseInt(document.getElementById('replaySlider').value) >= gameState.moveHistory.length) {
            document.getElementById('replaySlider').value = 0;
        }
        
        gameState.isReplayPlaying = true;
        document.getElementById('replayPlayPause').textContent = '⏸️ Pause';
        playReplay();
    }
}

function playReplay() {
    if (!gameState.isReplayPlaying || !gameState.isReplayMode) return;
    
    const currentStep = parseInt(document.getElementById('replaySlider').value);
    
    if (currentStep < gameState.moveHistory.length) {
        document.getElementById('replaySlider').value = currentStep + 1;
        replayStep(currentStep + 1);
        gameState.replayTimeout = setTimeout(playReplay, 600);
    } else {
        gameState.isReplayPlaying = false;
        document.getElementById('replayPlayPause').textContent = '▶️ Play';
    }
}

function updateReplayStep() {
    const current = parseInt(document.getElementById('replaySlider').value);
    const total = gameState.moveHistory.length;
    document.getElementById('replayStep').textContent = `Step: ${current}/${total}`;
}

function closeReplay() {
    gameState.isReplayMode = false;
    gameState.isReplayPlaying = false;
    
    if (gameState.replayTimeout) clearTimeout(gameState.replayTimeout);
    
    document.getElementById('replayControls').classList.add('hidden');
    drawBoard();
}

// ============ RESET FUNCTIONS ============
function resetBoardOnly() {
    // Papan dibangun ulang: buang giliran AI tertunda agar tidak ada eksekusi
    // basi yang berjalan di papan yang sudah berbeda (P1).
    turnQueue.clear();

    const gridSize = gameState.config.gridSize;
    
    gameState.edges.horizontal = Array(gridSize).fill(null).map(() => 
        Array(gridSize - 1).fill(null).map(() => ({ owner: null }))
    );
    gameState.edges.vertical = Array(gridSize - 1).fill(null).map(() => 
        Array(gridSize).fill(null).map(() => ({ owner: null }))
    );
    
    gameState.boxes = Array(gridSize - 1).fill(null).map(() => 
        Array(gridSize - 1).fill(null).map(() => ({
            owner: null,
            edges: { top: null, bottom: null, left: null, right: null }
        }))
    );
    
    gameState.scores = gameState.players.map(() => 0);
    gameState.currentPlayerIndex = 0;
    gameState.isGameOver = false;
    gameState.moveHistory = [];
    
    updateUI();
    drawBoard();
    saveGame();
}

// ============ UTILITY FUNCTIONS ============
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 2000);
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    document.getElementById('darkModeToggle').textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('dotsandboxes_darkmode', isDark);
    drawBoard();
}

// ============ EVENT LISTENERS ============
/* Handler tombol `.grid-btn` HANYA mengubah PILIHAN ukuran grid di `configMenu`
   sebelum permainan dimulai. Handler ini tidak boleh memutasi papan permainan
   yang sedang berjalan.

   Kenapa: `#configMenu` (index.html) hanya tampil saat tidak ada permainan aktif,
   dan "Mulai Game" (startGame) selalu memanggil `initGame(config)` yang membangun
   papan dari ukuran yang dipilih. Menulis `gameState.config.gridSize` di sini
   (perilaku lama) melanggar invariant "gridSize == ukuran papan": bila grid
   diubah lewat jalur mana pun saat permainan aktif, `edges`/`boxes` tetap ukuran
   lama sementara `config.gridSize` sudah baru -> `drawBoxes` membaca
   `dotPositions[row][col]` yang tidak ada -> TypeError. (QA-1.)

   Kita hanya memperbarui tombol aktif. Ukuran yang dipakai untuk memulai
   permainan dibaca langsung dari `.grid-btn.active` di startGame. */
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('dotsandboxes_darkmode') === 'true') {
        document.body.classList.add('dark-mode');
        document.getElementById('darkModeToggle').textContent = '☀️';
    }
    
    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);
    
    // Number selector buttons
    document.querySelectorAll('.btn-minus').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = document.getElementById(btn.dataset.target);
            const newValue = Math.max(parseInt(target.min), parseInt(target.value) - 1);
            target.value = newValue;
            
            if (btn.dataset.target === 'totalPlayers') {
                updateMaxAI();
            }
        });
    });
    
    document.querySelectorAll('.btn-plus').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = document.getElementById(btn.dataset.target);
            const newValue = Math.min(parseInt(target.max), parseInt(target.value) + 1);
            target.value = newValue;
            
            if (btn.dataset.target === 'totalPlayers') {
                updateMaxAI();
            }
        });
    });
    
    function updateMaxAI() {
        const totalPlayers = parseInt(document.getElementById('totalPlayers').value);
        const maxAI = totalPlayers - 1;
        const aiCountInput = document.getElementById('aiCount');
        const maxAiLabel = document.getElementById('maxAiLabel');
        
        aiCountInput.max = maxAI;
        maxAiLabel.textContent = maxAI;
        
        if (parseInt(aiCountInput.value) > maxAI) {
            aiCountInput.value = maxAI;
        }
    }
    
    // Grid size buttons: hanya menyimpan PILIHAN (tombol aktif), tidak
    // menyentuh config/papan permainan yang sedang berjalan. Lihat catatan
    // di atas `document.addEventListener('DOMContentLoaded', ...)` (QA-1).
    document.querySelectorAll('.grid-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.grid-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    
    // Start game button
    document.getElementById('startGame').addEventListener('click', () => {
        const config = {
            gridSize: parseInt(document.querySelector('.grid-btn.active').dataset.size),
            totalPlayers: parseInt(document.getElementById('totalPlayers').value),
            aiCount: parseInt(document.getElementById('aiCount').value),
            aiDepth: parseInt(document.getElementById('aiDepth').value)
        };
        
        const humanCount = config.totalPlayers - config.aiCount;
        if (humanCount < 1) {
            showToast('Minimal harus ada 1 pemain manusia!');
            return;
        }
        if (config.totalPlayers < 2) {
            showToast('Minimal harus ada 2 pemain total!');
            return;
        }
        
        initGame(config);
    });
    
    // Game control buttons
    document.getElementById('newGameBtn').addEventListener('click', () => {
        document.getElementById('gameArea').classList.add('hidden');
        document.getElementById('gameOverModal').classList.add('hidden');
        document.getElementById('configMenu').classList.remove('hidden');
    });
    
    document.getElementById('resetBoardBtn').addEventListener('click', () => {
        resetBoardOnly();
        showToast('Board di-reset');
    });
    
    document.getElementById('continueBtn').addEventListener('click', () => {
        if (!loadGame()) {
            showToast('Tidak ada game tersimpan');
        }
    });
    
    document.getElementById('replayBtn').addEventListener('click', () => {
        startReplay();
    });
    
    // Replay controls
    document.getElementById('replaySlider').addEventListener('input', (e) => {
        replayStep(parseInt(e.target.value));
    });
    
    document.getElementById('replayPlayPause').addEventListener('click', toggleReplayPlay);
    
    document.getElementById('replayPrev').addEventListener('click', () => {
        const current = parseInt(document.getElementById('replaySlider').value);
        if (current > 0) {
            document.getElementById('replaySlider').value = current - 1;
            replayStep(current - 1);
        }
    });
    
    document.getElementById('replayNext').addEventListener('click', () => {
        const current = parseInt(document.getElementById('replaySlider').value);
        if (current < gameState.moveHistory.length) {
            document.getElementById('replaySlider').value = current + 1;
            replayStep(current + 1);
        }
    });
    
    document.getElementById('replayClose').addEventListener('click', closeReplay);
    
    document.getElementById('playAgainBtn').addEventListener('click', () => {
        document.getElementById('gameOverModal').classList.add('hidden');
        document.getElementById('gameArea').classList.add('hidden');
        document.getElementById('configMenu').classList.remove('hidden');
    });
});
