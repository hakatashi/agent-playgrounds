# 倉庫番パズル (Sokoban Puzzle Generator)

A browser-based infinite Sokoban puzzle game. Puzzles are procedurally generated and verified to be solvable before being presented to the player.

## Features

- Randomly generated 8×8 Sokoban puzzles, verified solvable via push-based BFS
- Real-time step counter and elapsed time display
- Undo (Z), restart (R), and next puzzle (N) shortcuts
- Difficulty gradually increases as you solve more puzzles (up to 4 boxes)

## How to Play

Open `index.html` in any modern browser — no server required.

| Key | Action |
|-----|--------|
| Arrow keys / WASD | Move player |
| Z | Undo last move |
| R | Restart current puzzle |
| N | Skip to next puzzle |

Push all brown boxes onto the gold goal markers to clear the puzzle.

## Prerequisites

None — plain HTML + JavaScript, no build step needed.
