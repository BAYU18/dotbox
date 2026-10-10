# Dots and Boxes Game

A classic Dots and Boxes game with AI opponents built with vanilla JavaScript.

## Features

- **Multiplayer Support**: 2-4 players locally
- **AI Opponents**: Play against 1-3 AI players with a depth-limited Minimax search
- **Adjustable Grid**: 3x3, 5x5, or 7x7 dot grid
- **Mobile Friendly**: Responsive design optimized for touch devices
- **Dark Mode**: Toggle between light and dark themes
- **Sound Effects**: Audio feedback for moves and box completion
- **Game Save/Load**: Continue your game anytime
- **Replay System**: Watch your game history step by step

## How to Play

1. Open `index.html` in any modern web browser
2. Configure the game:
   - Set total number of players (2-4)
   - Set number of AI opponents
   - Choose grid size
   - Adjust AI difficulty (depth)
3. Click "Mulai Game" to start
4. Take turns drawing lines between adjacent dots
5. Complete a box to score a point and get another turn
6. Game ends when all boxes are filled
7. Player with the most boxes wins!

## Controls

- **Click/Tap** on the space between dots to draw a line
- **New Game**: Return to configuration menu
- **Reset Board**: Clear the board and start over
- **Continue**: Load saved game
- **Replay**: Watch game replay step by step

## AI Implementation

The AI is a **decision policy** only — all board rules live in `rules.js` (single source of
truth). Its search is a depth-limited **Minimax** with **Alpha-Beta pruning** and a time budget
(~1.5 s) so the UI never freezes on large boards:

- **Minimax + Alpha-Beta Pruning**: `AIEngine.search()` looks ahead up to `depth` plies
  (the "AI difficulty (depth)" setting, 1–5). Higher depth = deeper search.
- **Time Budget**: the search aborts when the budget is exceeded and falls back to the
  static evaluation, so `depth 5` on a 7x7 board still returns promptly.
- **Box Completion Priority**: a move that completes a box is always preferred (explicit
  tie-break), and completing a box grants an extra turn.
- **Safe Move Detection**: the static evaluation penalises moves that hand the opponent an
  easy box.

`node --test` covers the AI (see `test/ai-engine.test.js`) and the rules
(`test/rules.test.js`).

## Tech Stack

- HTML5 Canvas
- CSS3 (with CSS Variables for theming)
- Vanilla JavaScript (ES6+)
- localStorage for game persistence
- Web Audio API for sound effects

## Project Structure

```
dots/
├── index.html      # Main HTML file
├── style.css       # Styles and responsive design
├── rules.js        # Pure board rules (single source of truth, no DOM)
├── script.js       # Game logic: state, UI, input, storage, wiring
├── ai-engine.js    # AI decision policy (minimax + alpha-beta over rules.js)
├── test/           # Node built-in test runner suites (node --test)
└── README.md       # This file
```

## Running the tests

No build step and no dependencies are needed. Node's built-in test runner is enough:

```bash
node --test
```

## License

MIT License
