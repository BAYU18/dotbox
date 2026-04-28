# Dots and Boxes Game

A classic Dots and Boxes game with AI opponents built with vanilla JavaScript.

## Features

- **Multiplayer Support**: 2-4 players locally
- **AI Opponents**: Play against 1-3 AI players with Minimax algorithm
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

The AI uses:
- **Minimax Algorithm**: Evaluates all possible moves
- **Alpha-Beta Pruning**: Optimizes search performance
- **Box Completion Priority**: Always takes boxes when available
- **Safe Move Detection**: Avoids giving opponent easy boxes

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
├── script.js       # Main game logic
├── ai-engine.js    # AI decision making
└── README.md       # This file
```

## License

MIT License
