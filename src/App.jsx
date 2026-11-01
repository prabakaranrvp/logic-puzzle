import React, { useEffect, useMemo, useRef, useState } from 'react';
import { N, PIECES, LEVELS, PER_LEVEL, makeChallenge, rotate, flip, size } from './puzzle.js';

const sameCells = (a, b) =>
  JSON.stringify(a.slice().sort()) === JSON.stringify(b.slice().sort());

// One solid shape: outline layer first, then fills on top so inner seams vanish.
function Solid({ cells, color, cs, locked, dim }) {
  const { w, h } = size(cells);
  const pad = 3;
  return (
    <svg width={w * cs + pad * 2} height={h * cs + pad * 2} style={{ display: 'block', overflow: 'visible' }}>
      <g transform={`translate(${pad} ${pad})`} opacity={dim ? 0.6 : 1}>
        <ShapeCells cells={cells} color={color} cs={cs} locked={locked} />
      </g>
    </svg>
  );
}

function ShapeCells({ cells, color, cs, locked }) {
  return (
    <>
      {cells.map(([r, c], i) => (
        <rect key={'o' + i} x={c * cs} y={r * cs} width={cs} height={cs}
          fill="#1d1d2b" stroke="#1d1d2b" strokeWidth={locked ? 7 : 4} strokeLinejoin="round" />
      ))}
      {cells.map(([r, c], i) => (
        <rect key={'f' + i} x={c * cs - 0.3} y={r * cs - 0.3} width={cs + 0.6} height={cs + 0.6} fill={color}/>
      ))}
      {cells.map(([r, c], i) => (
        <rect key={'g' + i} x={c * cs} y={r * cs} width={cs} height={cs} fill="none"
          stroke="rgba(0,0,0,.45)" strokeWidth={2} />
      ))}
      {locked && cells.length > 0 && (
        <text x={cells[0][1] * cs + cs / 2} y={cells[0][0] * cs + cs / 2 + 6} textAnchor="middle" fontSize="16">🔒</text>
      )}
    </>
  );
}

export default function App() {
  const [level, setLevel] = useState(0);
  const [idx, setIdx] = useState(0);
  const [ch, setCh] = useState(null);
  const [placed, setPlaced] = useState([]); // {piece, cells, locked?}
  const [orients, setOrients] = useState({}); // piece -> current orientation
  const [selected, setSelected] = useState(null);
  const [drag, setDrag] = useState(null); // {piece, orient, x, y}
  const [msg, setMsg] = useState('');
  const [hintsLeft, setHintsLeft] = useState(2);
  const [hintTarget, setHintTarget] = useState(null); // {piece, cells}
  const boardRef = useRef(null);
  const live = useRef({});
  live.current = { drag, placed, orients };

  const load = (l = level, i = idx) => {
    const c = makeChallenge(l, i);
    const o = {};
    PIECES.forEach((p, k) => { o[k] = p.cells; });
    setCh(c);
    setPlaced(c.locked.map((p) => ({ ...p, locked: true })));
    setOrients(o);
    setSelected(null);
    setDrag(null);
    setMsg('');
    setHintTarget(null);
    setHintsLeft(2);
  };
  useEffect(() => { load(); }, [level, idx]); // eslint-disable-line

  const cellPx = () => {
    const r = boardRef.current.getBoundingClientRect();
    return { left: r.left + 8, top: r.top + 8, cs: (r.width - 16) / N };
  };

  // Snap the dragged shape to the board grid under the pointer.
  const target = (d, plc) => {
    if (!boardRef.current) return null;
    const { left, top, cs } = cellPx();
    const { w, h } = size(d.orient);
    const col = Math.round((d.x - (w * cs) / 2 - left) / cs);
    const row = Math.round((d.y - (h * cs) / 2 - top) / cs);
    const cells = d.orient.map(([r, c]) => [r + row, c + col]);
    const taken = new Set(plc.filter((p) => p.piece !== d.piece).flatMap((p) => p.cells.map(([r, c]) => r * N + c)));
    const valid = cells.every(([r, c]) => r >= 0 && r < N && c >= 0 && c < N && !taken.has(r * N + c));
    return { cells, valid };
  };

  const startDrag = (e, piece, fromBoard) => {
    e.preventDefault();
    if (live.current.drag) return; // ignore extra fingers
    setHintTarget(null);
    if (fromBoard) setMsg('');
    setSelected(piece);
    setDrag({
      piece, fromBoard, orient: live.current.orients[piece], pointerId: e.pointerId,
      x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t0: Date.now(),
    });
  };

  const active = !!drag;
  useEffect(() => {
    if (!active) return undefined;
    const mine = (e) => live.current.drag && e.pointerId === live.current.drag.pointerId;
    const move = (e) => { if (mine(e)) setDrag((d) => d && { ...d, x: e.clientX, y: e.clientY }); };
    const cancel = (e) => { if (mine(e)) setDrag(null); }; // piece stays where it was
    const up = (e) => {
      if (!mine(e)) return;
      const { drag: d, placed: plc } = live.current;
      const rest = plc.filter((p) => p.piece !== d.piece);
      const moved = Math.hypot(e.clientX - d.sx, e.clientY - d.sy);
      if (!d.fromBoard && moved < 8 && Date.now() - d.t0 < 350) {
        // a quick tap on a catalog block rotates it
        setOrients((o) => ({ ...o, [d.piece]: rotate(d.orient) }));
        setDrag(null);
        return;
      }
      const t = target({ ...d, x: e.clientX, y: e.clientY }, plc);
      const next = t && t.valid ? [...rest, { piece: d.piece, cells: t.cells }] : rest;
      setPlaced(next);
      if (t && t.valid) {
        setOrients((o) => ({ ...o, [d.piece]: d.orient }));
      }
      setDrag(null);
    };
    const key = (e) => {
      if (e.key === 'r' || e.key === 'R') setDrag((d) => d && { ...d, orient: rotate(d.orient) });
      if (e.key === 'f' || e.key === 'F') setDrag((d) => d && { ...d, orient: flip(d.orient) });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key);
    };
  }, [active]); // eslint-disable-line

  const transform = (fn) => {
    if (drag) return setDrag((d) => ({ ...d, orient: fn(d.orient) }));
    if (selected != null && !placed.some((p) => p.piece === selected)) {
      setOrients((o) => ({ ...o, [selected]: fn(o[selected]) }));
    }
    return undefined;
  };

  const step = (d) => {
    let l = level, i = idx + d;
    if (i < 0) { l = (l + LEVELS.length - 1) % LEVELS.length; i = PER_LEVEL - 1; }
    else if (i >= PER_LEVEL) { l = (l + 1) % LEVELS.length; i = 0; }
    setLevel(l); setIdx(i);
  };

  const hint = () => {
    const ok = placed.every((p) => p.locked || ch.solution.some((s) => s.piece === p.piece && sameCells(s.cells, p.cells)));
    if (!ok) return setMsg('Hint: a block you placed is not part of the intended solution — try moving some.');
    const next = ch.solution.find((s) => !placed.some((p) => p.piece === s.piece));
    if (!next || hintsLeft <= 0) return undefined;
    setHintTarget(next);
    setHintsLeft((n) => n - 1);
    setMsg('Hint: place the glowing block in the glowing spot. Rotate / flip it to match.');
    return undefined;
  };

  const solved = placed.length === PIECES.length;
  const confetti = useMemo(() => (solved ? Array.from({ length: 70 }, (_, i) => ({
    left: Math.random() * 100, delay: Math.random() * 0.8, dur: 2.2 + Math.random() * 1.8,
    size: 8 + Math.random() * 8, rot: Math.random() * 360,
    color: PIECES[i % PIECES.length].color,
  })) : []), [solved]);

  if (!ch) return null;
  const snap = drag ? target(drag, placed) : null;
  const cs = 40; // catalog cell size
  const remaining = PIECES.map((_, i) => i).filter((i) => !placed.some((p) => p.piece === i));

  return (
    <div className="app">
      <div className="bar">
        <label>Level{' '}
          <select value={level} onChange={(e) => { setLevel(+e.target.value); setIdx(0); }}>
            {LEVELS.map((l, i) => <option key={l.name} value={i}>{l.name}</option>)}
          </select>
        </label>
        <label>Challenge{' '}
          <select value={idx} onChange={(e) => setIdx(+e.target.value)}>
            {Array.from({ length: PER_LEVEL }, (_, i) => <option key={i} value={i}>#{level * PER_LEVEL + i + 1}</option>)}
          </select>
        </label>
        <button onClick={() => step(-1)}>◀</button>
        <button onClick={() => step(1)}>▶</button>
        <button onClick={() => load()}>Reset</button>
        <button onClick={hint} disabled={hintsLeft === 0 || solved}>💡 Hint ({hintsLeft})</button>
      </div>
      <div className="msg">{msg}</div>

      <div className="play">
      <div className={'board' + (solved ? ' solved' : '')} ref={boardRef}>
        <svg viewBox={`0 0 ${N} ${N}`} style={{ overflow: 'visible' }}>
          {Array.from({ length: N * N }, (_, i) => (
            <rect key={i} x={(i % N) + 0.04} y={Math.floor(i / N) + 0.04} width={0.92} height={0.92} rx={0.1} fill="#4a4f6e" />
          ))}
          {placed.map((p) => (
            <g key={p.piece}
              style={{ cursor: p.locked ? 'not-allowed' : 'grab', touchAction: 'none', visibility: drag?.piece === p.piece ? 'hidden' : 'visible' }}
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={p.locked ? undefined : (e) => startDrag(e, p.piece, true)}>
              <g transform="scale(1)">
                {p.cells.map(([r, c], i) => (
                  <rect key={'o' + i} x={c} y={r} width={1} height={1} fill="#1d1d2b" stroke="#1d1d2b"
                    strokeWidth={p.locked ? 0.2 : 0.12} strokeLinejoin="round" />
                ))}
                {p.cells.map(([r, c], i) => (
                  <rect key={'f' + i} x={c - 0.01} y={r - 0.01} width={1.02} height={1.02} fill={p.locked ? '#9aa0ab' : PIECES[p.piece].color}/>
                ))}
                {p.cells.map(([r, c], i) => (
                  <rect key={'g' + i} x={c} y={r} width={1} height={1} fill="none"
                    stroke="rgba(0,0,0,.45)" strokeWidth={0.05} />
                ))}
                {p.locked && <text x={p.cells[0][1] + 0.5} y={p.cells[0][0] + 0.7} textAnchor="middle" fontSize="0.5">🔒</text>}
              </g>
            </g>
          ))}
          {hintTarget && !drag && hintTarget.cells.map(([r, c], i) => (
            <rect key={'h' + i} className="hint-cell" x={c + 0.06} y={r + 0.06} width={0.88} height={0.88} rx={0.1}
              fill={PIECES[hintTarget.piece].color} stroke="#fff" strokeWidth={0.06} pointerEvents="none" />
          ))}
          {snap && snap.cells.map(([r, c], i) => (
            <rect key={'s' + i} x={c} y={r} width={1} height={1}
              fill={snap.valid ? PIECES[drag.piece].color : '#c0392b'} opacity={0.45} pointerEvents="none" />
          ))}
        </svg>
      </div>

      <div className="side">
      <div className="bar">
        <button onClick={() => transform(rotate)}>Rotate (R)</button>
        <button onClick={() => transform(flip)}>Flip (F)</button>
      </div>

      <div className="catalog">
        {remaining.map((i) => (
          <div key={i} className={'slot' + (selected === i ? ' sel' : '') + (hintTarget?.piece === i ? ' hinted' : '')}
            style={{ visibility: drag?.piece === i ? 'hidden' : 'visible' }}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={(e) => startDrag(e, i, false)}>
            <Solid cells={orients[i]} color={PIECES[i].color} cs={cs} />
          </div>
        ))}
        {remaining.length === 0 && !drag && <div>All blocks placed</div>}
      </div>
      </div>
      </div>

      {drag && (() => {
        const { w, h } = size(drag.orient);
        return (
          <div className="ghost" style={{ transform: `translate(${drag.x - (w * cellPx().cs) / 2}px, ${drag.y - (h * cellPx().cs) / 2}px)` }}>
            <Solid cells={drag.orient} color={PIECES[drag.piece].color} cs={cellPx().cs} />
          </div>
        );
      })()}

      {solved && (
        <>
          {confetti.map((c, i) => (
            <span key={i} className="confetti" style={{
              left: c.left + 'vw', width: c.size, height: c.size * 0.45, background: c.color,
              animationDelay: c.delay + 's', animationDuration: c.dur + 's', transform: `rotate(${c.rot}deg)`,
            }} />
          ))}
          <div className="win">
            <div className="win-title">🎉 Puzzle solved! 🎉</div>
            <button onClick={() => step(1)}>Next challenge ▶</button>
          </div>
        </>
      )}

      <small>Drag a block from the catalog onto the board. Tap a block in the catalog to rotate it; use Rotate / Flip (or tap them with a second finger mid-drag; R / F on a keyboard). Drag a placed block to move it. 🔒 blocks are fixed.</small>
    </div>
  );
}
