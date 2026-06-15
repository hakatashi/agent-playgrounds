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
// Strategy: random walk to generate reachable floor, place walls, then
// place boxes/goals and verify solvability via BFS/DFS with push-based search.

function generatePuzzle(numBoxes) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const puz = tryGenerate(numBoxes);
    if (puz) return puz;
  }
  return null;
}

function tryGenerate(numBoxes) {
  // 1. Fill with walls
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(WALL));

  // 2. Carve floor via random walk from centre
  const startR = 2 + Math.floor(Math.random() * (ROWS - 4));
  const startC = 2 + Math.floor(Math.random() * (COLS - 4));
  let r = startR, c = startC;
  const floor = new Set();
  floor.add(posKey(r, c));
  const DIRS = [[-1,0],[1,0],[0,-1],[0,1]];

  const targetFloor = 18 + Math.floor(Math.random() * 8);
  let steps2 = 0;
  while (floor.size < targetFloor && steps2 < 2000) {
    steps2++;
    const [dr, dc] = DIRS[Math.floor(Math.random() * 4)];
    const nr = r + dr, nc = c + dc;
    if (nr > 0 && nr < ROWS - 1 && nc > 0 && nc < COLS - 1) {
      r = nr; c = nc;
      floor.add(posKey(r, c));
    }
  }
  if (floor.size < 12) return null;

  for (const k of floor) grid[keyR(k)][keyC(k)] = FLOOR;

  // 3. Place player on random floor cell
  const floorArr = [...floor];
  shuffle(floorArr);
  const playerKey = floorArr[0];
  const playerPos = { r: keyR(playerKey), c: keyC(playerKey) };

  // 4. Pick box positions (must not be corners = deadlock squares)
  const candidates = floorArr.slice(1).filter(k => !isDeadlockSquare(grid, keyR(k), keyC(k)));
  if (candidates.length < numBoxes * 2) return null;

  const boxKeys = candidates.slice(0, numBoxes);
  const goalKeys = candidates.slice(numBoxes, numBoxes * 2);
  if (boxKeys.length < numBoxes || goalKeys.length < numBoxes) return null;

  // 5. Mark goals
  for (const k of goalKeys) grid[keyR(k)][keyC(k)] = GOAL;

  // 6. Verify solvable with simple push BFS
  const boxes = new Set(boxKeys);
  const goals = new Set(goalKeys);

  if (!isSolvable(grid, playerPos, boxes, goals, 800)) return null;

  return { grid, playerPos, boxes, goals };
}

function isDeadlockSquare(grid, r, c) {
  // Simple corner detection
  const wallU = r === 0 || grid[r-1][c] === WALL;
  const wallD = r === ROWS-1 || grid[r+1][c] === WALL;
  const wallL = c === 0 || grid[r][c-1] === WALL;
  const wallR = c === COLS-1 || grid[r][c+1] === WALL;
  return (wallU || wallD) && (wallL || wallR);
}

// Push-based BFS for solvability
function isSolvable(grid, startPlayer, startBoxes, goals, maxNodes) {
  const encode = (pPos, boxes) => {
    const bArr = [...boxes].sort((a, b) => a - b);
    return pPos.r + ',' + pPos.c + '|' + bArr.join(',');
  };

  const DIRS = [[-1,0],[1,0],[0,-1],[0,1]];
  const visited = new Set();
  const startKey = encode(startPlayer, startBoxes);
  visited.add(startKey);
  const queue = [{ player: startPlayer, boxes: startBoxes }];
  let nodes = 0;

  while (queue.length > 0 && nodes < maxNodes) {
    nodes++;
    const { player, boxes } = queue.shift();

    if ([...goals].every(g => boxes.has(g))) return true;

    for (const [dr, dc] of DIRS) {
      const nr = player.r + dr, nc = player.c + dc;
      if (!inBounds(nr, nc) || grid[nr][nc] === WALL) continue;

      const nKey = posKey(nr, nc);
      const newBoxes = new Set(boxes);

      if (boxes.has(nKey)) {
        // Push box
        const br = nr + dr, bc = nc + dc;
        if (!inBounds(br, bc) || grid[br][bc] === WALL || boxes.has(posKey(br, bc))) continue;
        const bKey = posKey(br, bc);
        if (!goals.has(bKey) && isDeadlockSquare(grid, br, bc)) continue;
        newBoxes.delete(nKey);
        newBoxes.add(bKey);
      }

      const newPlayer = { r: nr, c: nc };
      const stateKey = encode(newPlayer, newBoxes);
      if (!visited.has(stateKey)) {
        visited.add(stateKey);
        queue.push({ player: newPlayer, boxes: newBoxes });
      }
    }
  }
  return false;
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
let numBoxes = 2;
let generating = false;

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
  document.getElementById('info').textContent = `箱の数: ${puz.goals.size} | キーボードで操作してください`;
  updateStats();
  renderPuzzle();
}

function requestNextPuzzle() {
  if (generating) return;
  generating = true;
  document.getElementById('genStatus').textContent = '問題を生成中...';

  // Gradually increase difficulty
  if (steps > 0 && solved) {
    if (numBoxes < 4 && Math.random() < 0.4) numBoxes++;
  }

  setTimeout(() => {
    const puz = generatePuzzle(numBoxes);
    generating = false;
    document.getElementById('genStatus').textContent = '';
    if (puz) {
      loadPuzzle(puz);
    } else {
      // fallback: use fewer boxes
      numBoxes = Math.max(1, numBoxes - 1);
      const puz2 = generatePuzzle(numBoxes);
      if (puz2) loadPuzzle(puz2);
      else document.getElementById('genStatus').textContent = '生成に失敗しました。再試行してください (N)';
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
