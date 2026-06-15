'use strict';

const WALL = 1, FLOOR = 2, GOAL = 3;
const TILE = 64;
const COLS = 8, ROWS = 8;
const DIRS = [[-1,0],[1,0],[0,-1],[0,1]];

const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
canvas.width  = COLS * TILE;
canvas.height = ROWS * TILE;

// Per box-count difficulty parameters.
// minPushes: minimum BFS push-count to accept a puzzle (filters trivially-easy layouts).
// bfsNodes:  BFS node budget (should cover entire state-space for these board sizes).
// maxAttempts: random layout attempts before giving up.
const DIFF = {
  2: { minPushes: 5,  bfsNodes:  8000, maxAttempts:  400 },
  3: { minPushes: 7,  bfsNodes: 20000, maxAttempts:  800 },
  4: { minPushes: 8,  bfsNodes: 40000, maxAttempts: 1500 },
};

// ── Game state ─────────────────────────────────────────────────────────────
let puzzle       = null;
let history      = [];
let steps        = 0;
let pushCount    = 0;
let startTime    = null;
let timerInterval = null;
let solved       = false;
let initialState = null;
let numBoxes     = 2;
let solveCount   = 0;
let generating   = false;

// ── Utilities ──────────────────────────────────────────────────────────────
function posKey(r, c) { return r * 100 + c; }
function keyR(k)      { return Math.floor(k / 100); }
function keyC(k)      { return k % 100; }
function inBounds(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function encodeState(player, boxes) {
  return player.r * 100 + player.c + '|' + [...boxes].sort((a, b) => a - b).join(',');
}

// ── Deadlock Detection ─────────────────────────────────────────────────────
// Corner deadlock: box is in a corner formed by walls and is not on a goal.
function isCornerDeadlock(grid, goals, r, c) {
  if (goals.has(posKey(r, c))) return false;
  const wU = r <= 0        || grid[r-1][c] === WALL;
  const wD = r >= ROWS - 1 || grid[r+1][c] === WALL;
  const wL = c <= 0        || grid[r][c-1] === WALL;
  const wR = c >= COLS - 1 || grid[r][c+1] === WALL;
  return (wU || wD) && (wL || wR);
}

// Line deadlock: box is pushed against a wall edge that has no goal along it.
// Only active when there is a continuous wall on one side of the row/column.
function isLineDeadlock(grid, goals, r, c) {
  if (goals.has(posKey(r, c))) return false;

  const wallAbove = (rr, cc) => rr <= 0        || grid[rr-1][cc] === WALL;
  const wallBelow = (rr, cc) => rr >= ROWS - 1 || grid[rr+1][cc] === WALL;
  const wallLeft  = (rr, cc) => cc <= 0        || grid[rr][cc-1] === WALL;
  const wallRight = (rr, cc) => cc >= COLS - 1 || grid[rr][cc+1] === WALL;

  // Horizontal line scan helper
  function hLineDeadlock(wallFn) {
    if (!wallFn(r, c)) return false;
    let hasGoal = goals.has(posKey(r, c));
    for (let cc = c - 1; cc >= 0 && !hasGoal; cc--) {
      if (grid[r][cc] === WALL) break;
      if (!wallFn(r, cc)) break; // wall backing interrupted
      if (goals.has(posKey(r, cc))) hasGoal = true;
    }
    for (let cc = c + 1; cc < COLS && !hasGoal; cc++) {
      if (grid[r][cc] === WALL) break;
      if (!wallFn(r, cc)) break;
      if (goals.has(posKey(r, cc))) hasGoal = true;
    }
    return !hasGoal;
  }

  // Vertical line scan helper
  function vLineDeadlock(wallFn) {
    if (!wallFn(r, c)) return false;
    let hasGoal = goals.has(posKey(r, c));
    for (let rr = r - 1; rr >= 0 && !hasGoal; rr--) {
      if (grid[rr][c] === WALL) break;
      if (!wallFn(rr, c)) break;
      if (goals.has(posKey(rr, c))) hasGoal = true;
    }
    for (let rr = r + 1; rr < ROWS && !hasGoal; rr++) {
      if (grid[rr][c] === WALL) break;
      if (!wallFn(rr, c)) break;
      if (goals.has(posKey(rr, c))) hasGoal = true;
    }
    return !hasGoal;
  }

  return hLineDeadlock(wallAbove) || hLineDeadlock(wallBelow) ||
         vLineDeadlock(wallLeft)  || vLineDeadlock(wallRight);
}

function isDeadlock(grid, goals, r, c) {
  return isCornerDeadlock(grid, goals, r, c) || isLineDeadlock(grid, goals, r, c);
}

// ── BFS Solver ─────────────────────────────────────────────────────────────
// Returns { moves, pushes } for the optimal solution, or null if not found within budget.
function solvePuzzle(grid, startPlayer, startBoxes, goals, maxNodes) {
  if ([...goals].every(g => startBoxes.has(g))) return { moves: 0, pushes: 0 };

  const visited = new Set([encodeState(startPlayer, startBoxes)]);
  const queue   = [{ player: startPlayer, boxes: startBoxes, moves: 0, pushes: 0 }];
  let head = 0;

  while (head < queue.length && head < maxNodes) {
    const { player, boxes, moves, pushes } = queue[head++];

    if ([...goals].every(g => boxes.has(g))) return { moves, pushes };

    for (const [dr, dc] of DIRS) {
      const nr = player.r + dr, nc = player.c + dc;
      if (!inBounds(nr, nc) || grid[nr][nc] === WALL) continue;

      const nk      = posKey(nr, nc);
      const newBoxes = new Set(boxes);
      let isPush     = false;

      if (boxes.has(nk)) {
        const br = nr + dr, bc = nc + dc;
        if (!inBounds(br, bc) || grid[br][bc] === WALL || boxes.has(posKey(br, bc))) continue;
        if (isDeadlock(grid, goals, br, bc)) continue;
        newBoxes.delete(nk);
        newBoxes.add(posKey(br, bc));
        isPush = true;
      }

      const np  = { r: nr, c: nc };
      const key = encodeState(np, newBoxes);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ player: np, boxes: newBoxes, moves: moves + 1, pushes: pushes + (isPush ? 1 : 0) });
      }
    }
  }
  return null;
}

// ── Floor Generator ────────────────────────────────────────────────────────
// Biased random walk: 60 % chance to continue in same direction → corridor-like floors.
function generateFloor() {
  const grid   = Array.from({ length: ROWS }, () => Array(COLS).fill(WALL));
  const target = 15 + Math.floor(Math.random() * 6); // 15–20 floor cells

  let r = 1 + Math.floor(Math.random() * (ROWS - 2));
  let c = 1 + Math.floor(Math.random() * (COLS - 2));
  const floor   = new Set([posKey(r, c)]);
  let lastDir   = DIRS[Math.floor(Math.random() * 4)];

  for (let step = 0; floor.size < target && step < 8000; step++) {
    if (Math.random() < 0.4) lastDir = DIRS[Math.floor(Math.random() * 4)];
    const [dr, dc] = lastDir;
    const nr = r + dr, nc = c + dc;
    if (nr > 0 && nr < ROWS - 1 && nc > 0 && nc < COLS - 1) {
      r = nr; c = nc; floor.add(posKey(r, c));
    } else {
      lastDir = DIRS[Math.floor(Math.random() * 4)];
    }
  }

  if (floor.size < 12) return null;
  for (const k of floor) grid[keyR(k)][keyC(k)] = FLOOR;
  return { grid, floor };
}

// ── Puzzle Generator ───────────────────────────────────────────────────────
// Random placement strategy: shuffle floor cells, assign player / goals / boxes,
// then verify solvability and difficulty with BFS.
function tryGenerate(n) {
  const d = DIFF[n] || DIFF[2];

  const result = generateFloor();
  if (!result) return null;
  const { grid, floor } = result;

  const floorArr = shuffle([...floor]);
  // Need at least: 1 player + n goals + n boxes
  if (floorArr.length < n * 2 + 1) return null;

  // Player at floorArr[0]
  const playerPos = { r: keyR(floorArr[0]), c: keyC(floorArr[0]) };

  // Goals on the next n non-corner cells
  const rest        = floorArr.slice(1);
  const goodCells   = rest.filter(k => !isCornerDeadlock(grid, new Set(), keyR(k), keyC(k)));
  if (goodCells.length < n * 2) return null;

  const goalKeys = goodCells.slice(0, n);
  const goals    = new Set(goalKeys);
  for (const k of goalKeys) grid[keyR(k)][keyC(k)] = GOAL;

  // Boxes on the next n non-goal, non-corner cells
  const boxCandidates = goodCells.slice(n).filter(k => !goals.has(k));
  if (boxCandidates.length < n) return null;
  const boxes = new Set(boxCandidates.slice(0, n));

  // Player must not start on a box or goal
  const pk = posKey(playerPos.r, playerPos.c);
  if (boxes.has(pk) || goals.has(pk)) return null;

  // Solve and check difficulty
  const sol = solvePuzzle(grid, playerPos, boxes, goals, d.bfsNodes);
  if (!sol || sol.pushes < d.minPushes) return null;

  return {
    grid,
    playerPos,
    boxes,
    goals,
    optimalMoves:  sol.moves,
    optimalPushes: sol.pushes,
  };
}

function generatePuzzle(n) {
  const d = DIFF[n] || DIFF[2];
  for (let i = 0; i < d.maxAttempts; i++) {
    const p = tryGenerate(n);
    if (p) return p;
  }
  return null;
}

// ── Rendering ──────────────────────────────────────────────────────────────
function drawCell(r, c, isWall, isGoal, isBox, isPlayer) {
  const x = c * TILE, y = r * TILE;

  ctx.fillStyle = '#0d0d14';
  ctx.fillRect(x, y, TILE, TILE);

  if (isWall) {
    ctx.fillStyle = '#2c2c42';
    ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
    ctx.fillStyle = '#3e3e5a';
    ctx.fillRect(x + 1, y + 1, TILE - 2, 5);
    ctx.fillRect(x + 1, y + 1, 5, TILE - 2);
    ctx.fillStyle = '#1e1e30';
    ctx.fillRect(x + 1, y + TILE - 6, TILE - 2, 5);
    ctx.fillRect(x + TILE - 6, y + 1, 5, TILE - 2);
    return;
  }

  // Floor base
  ctx.fillStyle = isGoal ? '#1a1a10' : '#161620';
  ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
  ctx.fillStyle = '#252535';
  ctx.fillRect(x + TILE - 5, y + TILE - 5, 3, 3);

  if (isGoal && !isBox && !isPlayer) {
    const cx = x + TILE / 2, cy = y + TILE / 2;
    ctx.fillStyle = '#8a6000';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 15); ctx.lineTo(cx + 15, cy);
    ctx.lineTo(cx, cy + 15); ctx.lineTo(cx - 15, cy);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffdd55';
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
  }

  if (isBox) {
    const [bg, face, hi, sh] = isGoal
      ? ['#235514', '#3da01a', '#66cc33', '#173a0c']
      : ['#5a2e0e', '#9a5520', '#c07840', '#3a1a06'];
    ctx.fillStyle = bg;   ctx.fillRect(x + 4,  y + 4,  TILE - 8,  TILE - 8);
    ctx.fillStyle = face; ctx.fillRect(x + 7,  y + 7,  TILE - 14, TILE - 14);
    ctx.fillStyle = hi;   ctx.fillRect(x + 9,  y + 9,  TILE - 22, 5);
    ctx.fillRect(x + 9, y + 9, 5, TILE - 22);
    ctx.fillStyle = sh;   ctx.fillRect(x + TILE - 15, y + TILE - 15, 7, 7);
    if (isGoal) {
      ctx.strokeStyle = '#88ff44'; ctx.lineWidth = 2.5;
      ctx.strokeRect(x + 7, y + 7, TILE - 14, TILE - 14);
    }
  }

  if (isPlayer) {
    const cx = x + TILE / 2, cy = y + TILE / 2;
    ctx.fillStyle = '#5588ee';
    ctx.beginPath(); ctx.roundRect(cx - 7, cy, 14, 16, 4); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy - 8, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#88aaff';
    ctx.beginPath(); ctx.arc(cx - 3, cy - 11, 4, 0, Math.PI); ctx.fill();
    if (isGoal) {
      ctx.strokeStyle = '#ffdd00'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy - 8, 12, 0, Math.PI * 2); ctx.stroke();
    }
  }
}

function renderPuzzle() {
  if (!puzzle) return;
  const { grid, playerPos, boxes, goals } = puzzle;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const k = posKey(r, c);
      drawCell(r, c,
        grid[r][c] === WALL,
        goals.has(k),
        boxes.has(k),
        playerPos.r === r && playerPos.c === c
      );
    }
  }
}

// ── Timer ──────────────────────────────────────────────────────────────────
function startTimer() {
  if (startTime) return;
  startTime = Date.now();
  timerInterval = setInterval(updateTimer, 500);
}
function stopTimer() { clearInterval(timerInterval); timerInterval = null; }
function updateTimer() {
  if (!startTime) return;
  const e = Math.floor((Date.now() - startTime) / 1000);
  document.getElementById('timeDisplay').textContent =
    Math.floor(e / 60) + ':' + String(e % 60).padStart(2, '0');
}
function updateStats() {
  document.getElementById('stepCount').textContent = steps;
  if (puzzle) {
    document.getElementById('boxCount').textContent =
      [...puzzle.goals].filter(g => !puzzle.boxes.has(g)).length;
  }
}

function diffStars(pushes) {
  if (pushes >= 10) return '★★★';
  if (pushes >= 7)  return '★★☆';
  if (pushes >= 4)  return '★☆☆';
  return '☆☆☆';
}

// ── Movement ───────────────────────────────────────────────────────────────
function clonePlayState(p) {
  return { playerPos: { ...p.playerPos }, boxes: new Set(p.boxes) };
}

function move(dr, dc) {
  if (!puzzle || solved) return;
  const { grid, playerPos, boxes } = puzzle;
  const nr = playerPos.r + dr, nc = playerPos.c + dc;
  if (!inBounds(nr, nc) || grid[nr][nc] === WALL) return;

  const snapshot = clonePlayState(puzzle);
  const nk = posKey(nr, nc);
  let didPush = false;

  if (boxes.has(nk)) {
    const br = nr + dr, bc = nc + dc;
    if (!inBounds(br, bc) || grid[br][bc] === WALL || boxes.has(posKey(br, bc))) return;
    boxes.delete(nk);
    boxes.add(posKey(br, bc));
    didPush = true;
  }

  history.push(snapshot);
  if (history.length > 500) history.shift();

  playerPos.r = nr; playerPos.c = nc;
  steps++; if (didPush) pushCount++;
  startTimer();
  renderPuzzle();
  updateStats();
  checkSolved();
}

function checkSolved() {
  if (!puzzle || solved) return;
  if ([...puzzle.goals].every(g => puzzle.boxes.has(g))) {
    solved = true;
    stopTimer();
    const e = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(e / 60);
    const s = String(e % 60).padStart(2, '0');
    document.getElementById('resultStats').innerHTML =
      `${steps} 手 &nbsp;|&nbsp; 押し: ${pushCount} 回 &nbsp;|&nbsp; ${m}:${s}`;
    document.getElementById('overlay').classList.remove('hidden');
    solveCount++;
    if (numBoxes < 4 && solveCount % 3 === 0) numBoxes++;
  }
}

function undo() {
  if (!puzzle || solved || history.length === 0) return;
  const prev = history.pop();
  puzzle.playerPos = prev.playerPos;
  puzzle.boxes     = prev.boxes;
  steps = Math.max(0, steps - 1);
  renderPuzzle();
  updateStats();
}

function restart() {
  if (!puzzle) return;
  history   = [];
  steps     = 0;
  pushCount = 0;
  startTime = null;
  solved    = false;
  stopTimer();
  document.getElementById('timeDisplay').textContent = '0:00';
  document.getElementById('overlay').classList.add('hidden');
  puzzle.playerPos = { ...initialState.playerPos };
  puzzle.boxes     = new Set(initialState.boxes);
  renderPuzzle();
  updateStats();
}

// ── URL Hash Sharing ───────────────────────────────────────────────────────
// Binary format (version 1):
//   byte 0   : version (1)
//   byte 1   : player position (r*COLS+c, 0-63)
//   byte 2   : numBoxes (1-4)
//   bytes 3..3+n-1  : box positions sorted ascending (r*COLS+c each)
//   bytes 3+n..3+2n-1: goal positions sorted ascending
//   bytes 3+2n..3+2n+7: floor bitmap (64 bits, bit r*COLS+c = 1 if not WALL)
// Encoded as URL-safe base64 (no padding).
function encodePuzzleToHash(puz) {
  const { grid, playerPos, boxes, goals } = puz;
  const n     = goals.size;
  const bytes = [1]; // version

  bytes.push(playerPos.r * COLS + playerPos.c);
  bytes.push(n);

  for (const k of [...boxes].sort((a, b) => a - b))
    bytes.push(keyR(k) * COLS + keyC(k));
  for (const k of [...goals].sort((a, b) => a - b))
    bytes.push(keyR(k) * COLS + keyC(k));

  // 64-bit floor bitmap packed into 8 bytes
  const fb = new Array(8).fill(0);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== WALL) {
        const bit = r * COLS + c;
        fb[bit >> 3] |= 1 << (bit & 7);
      }
    }
  }
  bytes.push(...fb);

  const raw = String.fromCharCode(...bytes);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function decodePuzzleFromHash(enc) {
  try {
    const b64    = enc.replace(/-/g, '+').replace(/_/g, '/');
    const pad    = (4 - b64.length % 4) % 4;
    const raw    = atob(b64 + '='.repeat(pad));
    const bytes  = Uint8Array.from(raw, ch => ch.charCodeAt(0));

    let i = 0;
    if (bytes[i++] !== 1) return null; // version check

    const pp         = bytes[i++];
    const playerPos  = { r: Math.floor(pp / COLS), c: pp % COLS };
    const n          = bytes[i++];
    if (n < 1 || n > 4) return null;

    const boxes = new Set();
    for (let j = 0; j < n; j++) {
      const b = bytes[i++];
      boxes.add(posKey(Math.floor(b / COLS), b % COLS));
    }
    const goals = new Set();
    for (let j = 0; j < n; j++) {
      const g = bytes[i++];
      goals.add(posKey(Math.floor(g / COLS), g % COLS));
    }

    // Reconstruct grid from floor bitmap
    const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(WALL));
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const bit = r * COLS + c;
        if (bytes[i + (bit >> 3)] & (1 << (bit & 7))) {
          grid[r][c] = goals.has(posKey(r, c)) ? GOAL : FLOOR;
        }
      }
    }

    // Basic validation
    if (!inBounds(playerPos.r, playerPos.c) || grid[playerPos.r][playerPos.c] === WALL)
      return null;
    for (const k of [...boxes, ...goals]) {
      if (!inBounds(keyR(k), keyC(k)) || grid[keyR(k)][keyC(k)] === WALL) return null;
    }
    if (boxes.size !== n || goals.size !== n) return null;

    // Compute optimal solution via BFS (large budget since we trust the data)
    const sol = solvePuzzle(grid, playerPos, boxes, goals, 120000);

    return {
      grid, playerPos, boxes, goals,
      optimalMoves:  sol ? sol.moves  : 0,
      optimalPushes: sol ? sol.pushes : 0,
    };
  } catch {
    return null;
  }
}

function copyCurrentURL() {
  const url = location.href;
  const btn = document.getElementById('copyBtn');

  const succeed = () => {
    btn.textContent = 'コピーしました';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'URLをコピー'; btn.classList.remove('copied'); }, 2000);
  };

  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(succeed).catch(() => fallbackCopy(url, succeed));
  } else {
    fallbackCopy(url, succeed);
  }
}

function fallbackCopy(text, cb) {
  const el = Object.assign(document.createElement('textarea'), {
    value: text, style: 'position:fixed;opacity:0',
  });
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  cb();
}

// ── Puzzle Loading ─────────────────────────────────────────────────────────
function loadPuzzle(puz) {
  puzzle       = puz;
  initialState = { playerPos: { ...puz.playerPos }, boxes: new Set(puz.boxes) };
  history      = [];
  steps        = 0;
  pushCount    = 0;
  startTime    = null;
  solved       = false;
  stopTimer();
  document.getElementById('timeDisplay').textContent = '0:00';
  document.getElementById('overlay').classList.add('hidden');

  const stars = diffStars(puz.optimalPushes);
  document.getElementById('info').innerHTML =
    `箱: ${puz.goals.size}個 &nbsp;|&nbsp; ` +
    `最短手数: <strong>${puz.optimalMoves}</strong> 手 &nbsp;|&nbsp; ` +
    `最少押し: <strong>${puz.optimalPushes}</strong> 回 &nbsp;|&nbsp; ` +
    `難易度: ${stars}`;

  // Reflect current puzzle in the URL hash so it can be shared.
  // history.replaceState is blocked on file:// origins; ignore errors gracefully.
  try { history.replaceState(null, '', '#' + encodePuzzleToHash(puz)); } catch { /* file:// */ }

  updateStats();
  renderPuzzle();
}

function requestNextPuzzle() {
  if (generating) return;
  generating = true;
  document.getElementById('genStatus').textContent = '問題を生成中...';

  setTimeout(() => {
    let puz = generatePuzzle(numBoxes);
    // Fall back to fewer boxes if needed
    if (!puz && numBoxes > 2) puz = generatePuzzle(numBoxes - 1);
    if (!puz) puz = generatePuzzle(2);

    generating = false;
    document.getElementById('genStatus').textContent = '';

    if (puz) {
      loadPuzzle(puz);
    } else {
      document.getElementById('genStatus').textContent =
        '生成に失敗しました。N キーで再試行してください';
    }
  }, 10);
}

// ── Input ──────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  switch (e.key) {
    case 'ArrowUp':    case 'w': case 'W': e.preventDefault(); move(-1,  0); break;
    case 'ArrowDown':  case 's': case 'S': e.preventDefault(); move( 1,  0); break;
    case 'ArrowLeft':  case 'a': case 'A': e.preventDefault(); move( 0, -1); break;
    case 'ArrowRight': case 'd': case 'D': e.preventDefault(); move( 0,  1); break;
    case 'z': case 'Z': e.preventDefault(); undo();              break;
    case 'r': case 'R': e.preventDefault(); restart();           break;
    case 'n': case 'N': e.preventDefault(); requestNextPuzzle(); break;
  }
});

document.getElementById('nextBtn').addEventListener('click', requestNextPuzzle);
document.getElementById('copyBtn').addEventListener('click', copyCurrentURL);

// ── Init ───────────────────────────────────────────────────────────────────
// If the URL contains a hash, try to load the encoded puzzle from it.
// Otherwise generate a fresh puzzle.
(function init() {
  const hash = location.hash.slice(1);
  if (hash) {
    document.getElementById('genStatus').textContent = 'URLから盤面を読み込み中...';
    setTimeout(() => {
      const puz = decodePuzzleFromHash(hash);
      document.getElementById('genStatus').textContent = '';
      if (puz) {
        loadPuzzle(puz);
      } else {
        document.getElementById('genStatus').textContent = 'URLが無効です。新しい問題を生成します。';
        requestNextPuzzle();
      }
    }, 10);
  } else {
    requestNextPuzzle();
  }
}());
