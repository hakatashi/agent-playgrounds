'use strict';

// Cell types
const EMPTY = 0, WALL = 1, FLOOR = 2, GOAL = 3, BOX = 4, BOX_ON_GOAL = 5, PLAYER = 6, PLAYER_ON_GOAL = 7;

const TILE = 64; // px per cell
const COLS = 8, ROWS = 8;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = COLS * TILE;
canvas.height = ROWS * TILE;

// Colors / rendering
const COLORS = {
  empty:       '#111',
  wall:        '#556',
  floor:       '#222',
  goal:        '#332',
  box:         '#b87333',
  boxGoal:     '#88cc44',
  player:      '#6699ff',
  playerGoal:  '#88aaff',
};

// ── Game state ──────────────────────────────────────────────────────────────
let puzzle = null;       // { grid, playerPos, boxes, goals }
let history = [];        // stack of {grid, playerPos, boxes}
let steps = 0;
let startTime = null;
let timerInterval = null;
let solved = false;

function cloneState(state) {
  return {
    grid: state.grid.map(r => r.slice()),
    playerPos: { ...state.playerPos },
    boxes: new Set([...state.boxes]),
  };
}

function posKey(r, c) { return r * 100 + c; }
function keyR(k)      { return Math.floor(k / 100); }
function keyC(k)      { return k % 100; }

// ── Puzzle generator ─────────────────────────────────────────────────────────
// Strategy: reverse generation (pull method).
// Start from solved state (boxes on goals), then repeatedly "pull" boxes
// backward. Each pull is the reverse of a push, guaranteeing the resulting
// puzzle is solvable in at least targetPulls box-push operations.

const DIRS4 = [[-1,0],[1,0],[0,-1],[0,1]];

function generateFloor() {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(WALL));
  const sr = 1 + Math.floor(Math.random() * (ROWS - 2));
  const sc = 1 + Math.floor(Math.random() * (COLS - 2));
  let r = sr, c = sc;
  const floor = new Set();
  floor.add(posKey(r, c));
  const target = 22 + Math.floor(Math.random() * 10);
  for (let i = 0; i < 3000 && floor.size < target; i++) {
    const [dr, dc] = DIRS4[Math.floor(Math.random() * 4)];
    const nr = r + dr, nc = c + dc;
    if (nr > 0 && nr < ROWS - 1 && nc > 0 && nc < COLS - 1) { r = nr; c = nc; floor.add(posKey(r, c)); }
  }
  if (floor.size < 16) return null;
  for (const k of floor) grid[keyR(k)][keyC(k)] = FLOOR;
  return grid;
}

function getFloorCells(grid) {
  const cells = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid[r][c] === FLOOR) cells.push(posKey(r, c));
  return cells;
}

// BFS flood-fill: cells reachable by player without moving boxes
function getPlayerRegion(grid, playerPos, boxes) {
  const visited = new Set();
  const start = posKey(playerPos.r, playerPos.c);
  visited.add(start);
  const queue = [start];
  while (queue.length > 0) {
    const k = queue.shift();
    const r = keyR(k), c = keyC(k);
    for (const [dr, dc] of DIRS4) {
      const nr = r + dr, nc = c + dc;
      if (!inBounds(nr, nc) || grid[nr][nc] === WALL) continue;
      const nk = posKey(nr, nc);
      if (visited.has(nk) || boxes.has(nk)) continue;
      visited.add(nk);
      queue.push(nk);
    }
  }
  return visited;
}

function isDeadlockSquare(grid, r, c) {
  const wU = r === 0 || grid[r-1][c] === WALL;
  const wD = r === ROWS-1 || grid[r+1][c] === WALL;
  const wL = c === 0 || grid[r][c-1] === WALL;
  const wR = c === COLS-1 || grid[r][c+1] === WALL;
  return (wU || wD) && (wL || wR);
}

// Reverse-generate a puzzle requiring at least ~targetPulls box pushes.
// A "pull" undoes one forward push: box at B moves to B-D, player moves to B-2D,
// provided the player can reach B-D and B-2D is empty floor.
function tryGenerateReverse(numBoxes, targetPulls) {
  const grid = generateFloor();
  if (!grid) return null;

  const floorArr = getFloorCells(grid);
  // Goals must not be deadlock squares
  const nonDL = floorArr.filter(k => !isDeadlockSquare(grid, keyR(k), keyC(k)));
  if (nonDL.length < numBoxes + 5) return null;
  shuffle(nonDL);

  const goalArr = nonDL.slice(0, numBoxes);
  const goals = new Set(goalArr);

  // Solved state: boxes on goals
  let boxes = new Set(goalArr);

  // Player starts at any free floor cell
  const free = floorArr.filter(k => !goals.has(k));
  if (free.length === 0) return null;
  shuffle(free);
  let player = { r: keyR(free[0]), c: keyC(free[0]) };

  let pullsDone = 0;

  for (let iter = 0; iter < targetPulls * 20 && pullsDone < targetPulls; iter++) {
    const region = getPlayerRegion(grid, player, boxes);

    // Collect valid pulls for every (box, direction) pair
    const valid = [];
    for (const b of boxes) {
      const br = keyR(b), bc = keyC(b);
      for (const [dr, dc] of DIRS4) {
        // To undo a push of direction (dr,dc): player needed at (br-dr, bc-dc)
        const plNeedR = br - dr, plNeedC = bc - dc;
        if (!region.has(posKey(plNeedR, plNeedC))) continue;
        // After pull: player moves to (br-2dr, bc-2dc), box moves to (br-dr, bc-dc)
        const newPlR = br - 2*dr, newPlC = bc - 2*dc;
        if (!inBounds(newPlR, newPlC) || grid[newPlR][newPlC] === WALL) continue;
        if (boxes.has(posKey(newPlR, newPlC))) continue;
        // New box position = (br-dr, bc-dc) = player's needed position
        // Don't let box land on deadlock unless it came from a goal (not applicable in reverse)
        valid.push({ br, bc, dr, dc, newPlR, newPlC, newBoxKey: posKey(plNeedR, plNeedC) });
      }
    }

    if (valid.length === 0) break;

    const p = valid[Math.floor(Math.random() * valid.length)];
    boxes.delete(posKey(p.br, p.bc));
    boxes.add(p.newBoxKey);
    player = { r: p.newPlR, c: p.newPlC };
    pullsDone++;
  }

  // Require enough pulls and at least one box not on its goal
  if (pullsDone < Math.ceil(targetPulls * 0.6)) return null;
  if ([...goals].every(g => boxes.has(g))) return null;

  return { grid, playerPos: player, boxes, goals };
}

function generatePuzzle(numBoxes, targetPulls) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const puz = tryGenerateReverse(numBoxes, targetPulls);
    if (puz) return puz;
  }
  return null;
}

function inBounds(r, c) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ── Rendering ──────────────────────────────────────────────────────────────
function drawTile(r, c, type) {
  const x = c * TILE, y = r * TILE;
  ctx.fillStyle = '#111';
  ctx.fillRect(x, y, TILE, TILE);

  switch (type) {
    case WALL:
      ctx.fillStyle = '#445';
      ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      ctx.fillStyle = '#667';
      ctx.fillRect(x + 2, y + 2, TILE - 6, TILE - 6);
      break;
    case FLOOR:
      ctx.fillStyle = '#1e1e2e';
      ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      break;
    case GOAL:
      ctx.fillStyle = '#1e1e2e';
      ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      ctx.strokeStyle = '#cc9900';
      ctx.lineWidth = 2;
      const m = TILE / 2;
      ctx.beginPath();
      ctx.arc(x + m, y + m, m * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case BOX:
      ctx.fillStyle = '#1e1e2e';
      ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      ctx.fillStyle = '#b87333';
      ctx.fillRect(x + 8, y + 8, TILE - 16, TILE - 16);
      ctx.fillStyle = '#c8935a';
      ctx.fillRect(x + 10, y + 10, TILE - 30, 6);
      break;
    case BOX_ON_GOAL:
      ctx.fillStyle = '#1e1e2e';
      ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      ctx.fillStyle = '#88cc44';
      ctx.fillRect(x + 8, y + 8, TILE - 16, TILE - 16);
      ctx.fillStyle = '#aae066';
      ctx.fillRect(x + 10, y + 10, TILE - 30, 6);
      break;
    case PLAYER:
    case PLAYER_ON_GOAL:
      ctx.fillStyle = type === PLAYER_ON_GOAL ? '#1e2e1e' : '#1e1e2e';
      ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      // body
      ctx.fillStyle = '#6699ff';
      ctx.beginPath();
      ctx.arc(x + TILE / 2, y + TILE / 2 + 10, 10, 0, Math.PI * 2);
      ctx.fill();
      // head
      ctx.beginPath();
      ctx.arc(x + TILE / 2, y + TILE / 2 - 8, 8, 0, Math.PI * 2);
      ctx.fill();
      break;
  }
}

function renderPuzzle() {
  if (!puzzle) return;
  const { grid, playerPos, boxes, goals } = puzzle;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const isGoal = goals.has(posKey(r, c));
      const isBox  = boxes.has(posKey(r, c));
      const isPlayer = playerPos.r === r && playerPos.c === c;
      const baseCell = grid[r][c];

      let type;
      if (baseCell === WALL) {
        type = WALL;
      } else if (isPlayer) {
        type = isGoal ? PLAYER_ON_GOAL : PLAYER;
      } else if (isBox) {
        type = isGoal ? BOX_ON_GOAL : BOX;
      } else if (isGoal) {
        type = GOAL;
      } else {
        type = FLOOR;
      }
      drawTile(r, c, type);
    }
  }
}

// ── Timer ──────────────────────────────────────────────────────────────────
function startTimer() {
  startTime = Date.now();
  clearInterval(timerInterval);
  timerInterval = setInterval(updateTimer, 500);
}

function stopTimer() {
  clearInterval(timerInterval);
}

function updateTimer() {
  if (!startTime) return;
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  document.getElementById('timeDisplay').textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

function updateStats() {
  document.getElementById('stepCount').textContent = steps;
  if (puzzle) {
    const remaining = [...puzzle.goals].filter(g => !puzzle.boxes.has(g)).length;
    document.getElementById('boxCount').textContent = remaining;
  }
}

// ── Movement ───────────────────────────────────────────────────────────────
function move(dr, dc) {
  if (!puzzle || solved) return;
  const { grid, playerPos, boxes, goals } = puzzle;
  const nr = playerPos.r + dr, nc = playerPos.c + dc;

  if (!inBounds(nr, nc) || grid[nr][nc] === WALL) return;

  const nKey = posKey(nr, nc);
  const snapshot = cloneState(puzzle);

  if (boxes.has(nKey)) {
    const br = nr + dr, bc = nc + dc;
    if (!inBounds(br, bc) || grid[br][bc] === WALL || boxes.has(posKey(br, bc))) return;
    boxes.delete(nKey);
    boxes.add(posKey(br, bc));
  }

  history.push(snapshot);
  if (history.length > 200) history.shift();

  playerPos.r = nr;
  playerPos.c = nc;
  steps++;

  if (!startTime) startTimer();

  renderPuzzle();
  updateStats();
  checkSolved();
}

function checkSolved() {
  if (!puzzle) return;
  const { boxes, goals } = puzzle;
  if ([...goals].every(g => boxes.has(g))) {
    solved = true;
    stopTimer();
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    document.getElementById('resultStats').textContent =
      `${steps} ステップ / ${m}:${s.toString().padStart(2, '0')}`;
    document.getElementById('overlay').classList.remove('hidden');
  }
}

function undo() {
  if (!puzzle || solved || history.length === 0) return;
  const prev = history.pop();
  puzzle.grid = prev.grid;
  puzzle.playerPos = prev.playerPos;
  puzzle.boxes = prev.boxes;
  steps = Math.max(0, steps - 1);
  renderPuzzle();
  updateStats();
}

function restart() {
  if (!puzzle) return;
  // Restore to initial state (kept separately)
  history = [];
  steps = 0;
  startTime = null;
  solved = false;
  stopTimer();
  document.getElementById('timeDisplay').textContent = '0:00';
  document.getElementById('overlay').classList.add('hidden');
  puzzle.playerPos = { ...initialState.playerPos };
  puzzle.boxes = new Set(initialState.boxes);
  renderPuzzle();
  updateStats();
}

// ── Puzzle loading ─────────────────────────────────────────────────────────
let initialState = null;
let generating = false;
let solveCount = 0;

// Difficulty table: [numBoxes, targetPulls]
const DIFFICULTY = [
  [3, 12],
  [3, 16],
  [3, 20],
  [4, 18],
  [4, 22],
  [4, 28],
];

function getDifficulty() {
  const idx = Math.min(solveCount, DIFFICULTY.length - 1);
  return DIFFICULTY[idx];
}

function loadPuzzle(puz) {
  puzzle = puz;
  initialState = {
    playerPos: { ...puz.playerPos },
    boxes: new Set(puz.boxes),
  };
  history = [];
  steps = 0;
  startTime = null;
  solved = false;
  stopTimer();
  clearInterval(timerInterval);
  document.getElementById('timeDisplay').textContent = '0:00';
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('info').textContent =
    `箱の数: ${puz.goals.size} | 難易度 ${Math.min(solveCount + 1, DIFFICULTY.length)} / ${DIFFICULTY.length}`;
  updateStats();
  renderPuzzle();
}

function requestNextPuzzle() {
  if (generating) return;
  generating = true;
  document.getElementById('genStatus').textContent = '問題を生成中...';

  if (solved) solveCount++;

  setTimeout(() => {
    let [nb, tp] = getDifficulty();
    let puz = generatePuzzle(nb, tp);
    // Fallback: relax pulls
    if (!puz) puz = generatePuzzle(nb, Math.ceil(tp * 0.6));
    // Fallback: one fewer box
    if (!puz) puz = generatePuzzle(nb - 1, Math.ceil(tp * 0.5));

    generating = false;
    document.getElementById('genStatus').textContent = '';
    if (puz) {
      loadPuzzle(puz);
    } else {
      document.getElementById('genStatus').textContent = '生成に失敗しました。再試行してください (N)';
    }
  }, 10);
}

// ── Input ──────────────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowUp':    case 'w': case 'W': e.preventDefault(); move(-1, 0); break;
    case 'ArrowDown':  case 's': case 'S': e.preventDefault(); move(1, 0);  break;
    case 'ArrowLeft':  case 'a': case 'A': e.preventDefault(); move(0, -1); break;
    case 'ArrowRight': case 'd': case 'D': e.preventDefault(); move(0, 1);  break;
    case 'z': case 'Z': e.preventDefault(); undo(); break;
    case 'r': case 'R': e.preventDefault(); restart(); break;
    case 'n': case 'N': e.preventDefault(); requestNextPuzzle(); break;
  }
});

document.getElementById('nextBtn').addEventListener('click', requestNextPuzzle);

// ── Init ───────────────────────────────────────────────────────────────────
requestNextPuzzle();
