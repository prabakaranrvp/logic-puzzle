export const N = 5;

export const PIECES = [
  { name: 'O', color: '#f4c430', cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { name: 'T', color: '#e74c3c', cells: [[0, 0], [0, 1], [0, 2], [1, 1]] },
  { name: 'L', color: '#3498db', cells: [[0, 0], [1, 0], [2, 0], [2, 1]] },
  { name: 'S', color: '#2ecc71', cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
  { name: 'I', color: '#9b59b6', cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { name: 'P', color: '#e67e22', cells: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0]] },
];

export const LEVELS = [
  { name: 'Starter', locked: 4 },
  { name: 'Junior', locked: 3 },
  { name: 'Expert', locked: 2 },
  { name: 'Master', locked: 1 },
];
export const PER_LEVEL = 22; // 4 x 22 = 88 challenges

const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const shuffle = (a, r) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const norm = (cells) => {
  const mr = Math.min(...cells.map((c) => c[0]));
  const mc = Math.min(...cells.map((c) => c[1]));
  return cells.map(([r, c]) => [r - mr, c - mc]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
};
export const rotate = (cells) => norm(cells.map(([r, c]) => [c, -r]));
export const flip = (cells) => norm(cells.map(([r, c]) => [r, -c]));
export const size = (cells) => ({
  h: Math.max(...cells.map((c) => c[0])) + 1,
  w: Math.max(...cells.map((c) => c[1])) + 1,
});

const orientations = (cells) => {
  const seen = new Set();
  const out = [];
  let cur = norm(cells);
  for (let f = 0; f < 2; f++) {
    for (let i = 0; i < 4; i++) {
      const k = JSON.stringify(cur);
      if (!seen.has(k)) { seen.add(k); out.push(cur); }
      cur = rotate(cur);
    }
    cur = flip(cur);
  }
  return out;
};
const ORIENTS = PIECES.map((p) => orientations(p.cells));

// Random full tiling of the board using every piece once.
const solve = (r) => {
  const grid = Array(N * N).fill(-1);
  const used = Array(PIECES.length).fill(false);
  const placed = [];
  const rec = () => {
    const e = grid.indexOf(-1);
    if (e < 0) return true;
    const er = Math.floor(e / N), ec = e % N;
    for (const pi of shuffle(PIECES.map((_, i) => i), r)) {
      if (used[pi]) continue;
      for (const o of shuffle(ORIENTS[pi].slice(), r)) {
        const [ar, ac] = o[0];
        const cells = o.map(([a, b]) => [a - ar + er, b - ac + ec]);
        if (cells.every(([a, b]) => a >= 0 && a < N && b >= 0 && b < N && grid[a * N + b] < 0)) {
          cells.forEach(([a, b]) => { grid[a * N + b] = pi; });
          used[pi] = true; placed.push({ piece: pi, cells });
          if (rec()) return true;
          placed.pop(); used[pi] = false;
          cells.forEach(([a, b]) => { grid[a * N + b] = -1; });
        }
      }
    }
    return false;
  };
  return rec() ? placed : null;
};

export const makeChallenge = (level, idx) => {
  for (let t = 0; ; t++) {
    const r = rng(level * 1000 + idx * 7 + 13 + t * 100003);
    const solution = solve(r);
    if (!solution) continue;
    const locked = shuffle(solution.slice(), r).slice(0, LEVELS[level].locked);
    return { solution, locked };
  }
};
