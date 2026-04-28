/* ===================================
   DOTS AND BOXES - GAME LOGIC
   Mobile-friendly implementation
   Uses AIEngine for AI moves
   =================================== */

// ============ GAME STATE ============
const gameState = {
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
        setTimeout(() => makeAIMove(), 500);
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
    
    // Validate move
    if (type === 'horizontal' && gameState.edges.horizontal[row][col].owner !== null) {
        showToast('Garis sudah ada!');
        return false;
    }
    if (type === 'vertical' && gameState.edges.vertical[row][col].owner !== null) {
        showToast('Garis sudah ada!');
        return false;
    }
    
    // Record and apply move
    const move = {
        type,
        row,
        col,
        player: currentPlayer,
        timestamp: Date.now()
    };
    gameState.moveHistory.push(move);
    
    if (type === 'horizontal') {
        gameState.edges.horizontal[row][col].owner = currentPlayer;
    } else {
        gameState.edges.vertical[row][col].owner = currentPlayer;
    }
    
    playSound('line');
    
    // Check for completed boxes
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
            setTimeout(() => makeAIMove(), 400);
        }
        return true;
    }
    
    switchTurn();
    return true;
}

function checkBoxCompletion(type, row, col) {
    const gridSize = gameState.config.gridSize;
    const completedBoxes = [];
    
    if (type === 'horizontal') {
        if (row > 0 && isBoxComplete(row - 1, col)) {
            if (gameState.boxes[row - 1][col].owner === null) {
                gameState.boxes[row - 1][col].owner = gameState.currentPlayerIndex;
                completedBoxes.push({ row: row - 1, col });
            }
        }
        if (row < gridSize - 1 && isBoxComplete(row, col)) {
            if (gameState.boxes[row][col].owner === null) {
                gameState.boxes[row][col].owner = gameState.currentPlayerIndex;
                completedBoxes.push({ row, col });
            }
        }
    } else {
        if (col > 0 && isBoxComplete(row, col - 1)) {
            if (gameState.boxes[row][col - 1].owner === null) {
                gameState.boxes[row][col - 1].owner = gameState.currentPlayerIndex;
                completedBoxes.push({ row, col: col - 1 });
            }
        }
        if (col < gridSize - 1 && isBoxComplete(row, col)) {
            if (gameState.boxes[row][col].owner === null) {
                gameState.boxes[row][col].owner = gameState.currentPlayerIndex;
                completedBoxes.push({ row, col });
            }
        }
    }
    
    return completedBoxes;
}

function isBoxComplete(row, col) {
    const top = gameState.edges.horizontal[row][col];
    const bottom = gameState.edges.horizontal[row + 1][col];
    const left = gameState.edges.vertical[row][col];
    const right = gameState.edges.vertical[row][col + 1];
    
    return top.owner !== null && bottom.owner !== null && left.owner !== null && right.owner !== null;
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
        setTimeout(() => makeAIMove(), 400);
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
    gameState.scores = gameState.players.map(() => 0);
    const gridSize = gameState.config.gridSize;
    
    for (let row = 0; row < gridSize - 1; row++) {
        for (let col = 0; col < gridSize - 1; col++) {
            if (gameState.boxes[row][col].owner !== null) {
                gameState.scores[gameState.boxes[row][col].owner]++;
            }
        }
    }
}

function isGameOver() {
    const gridSize = gameState.config.gridSize;
    const totalBoxes = (gridSize - 1) * (gridSize - 1);
    let filledBoxes = 0;
    
    for (let row = 0; row < gridSize - 1; row++) {
        for (let col = 0; col < gridSize - 1; col++) {
            if (gameState.boxes[row][col].owner !== null) {
                filledBoxes++;
            }
        }
    }
    
    return filledBoxes === totalBoxes;
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
let aiMoveTimeout = null;

function makeAIMove() {
    // Always reset at start - allow multiple calls
    setTimeout(() => executeAIMove(), 300);
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
function saveGame() {
    const saveData = {
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

function loadGame() {
    const saved = localStorage.getItem('dotsandboxes_current');
    if (!saved) return false;
    
    try {
        const saveData = JSON.parse(saved);
        
        gameState.config = saveData.config;
        gameState.players = saveData.players;
        gameState.currentPlayerIndex = saveData.currentPlayerIndex;
        gameState.edges = saveData.edges;
        gameState.boxes = saveData.boxes;
        gameState.scores = saveData.scores;
        gameState.moveHistory = saveData.moveHistory;
        gameState.isGameOver = saveData.isGameOver;
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
        
        showToast('Game dimuat dari save terakhir');
        return true;
    } catch (e) {
        console.error('Failed to load game:', e);
        return false;
    }
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
    resetBoardOnly();
    
    for (let i = 0; i <= stepIndex && i < gameState.moveHistory.length; i++) {
        const move = gameState.moveHistory[i];
        replayMove(move);
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
    
    checkBoxCompletion(move.type, move.row, move.col);
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
    
    // Grid size buttons
    document.querySelectorAll('.grid-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.grid-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            gameState.config.gridSize = parseInt(btn.dataset.size);
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
