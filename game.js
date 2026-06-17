(() => {
  'use strict';

  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const resetBtn = document.getElementById('resetBtn');
  const winOverlay = document.getElementById('winOverlay');
  const winClose = document.getElementById('winClose');

  const POS = { LEFT: -1, CENTER: 0, RIGHT: 1 };
  const COLORS = ['#35aaff', '#ff7a3d'];
  const OUTER = 18;
  const ROWS = 4;

  let state;
  let layout;
  let pointer = null;
  let gateVisual = 0;
  let winClosed = false;
  let winShown = false;
  let snap = [0, 0];

  function solvedState() {
    return {
      leftLoop: Array(OUTER).fill(0),
      rightLoop: Array(OUTER).fill(1),
      gate: {
        position: POS.CENTER,
        leftColumn: Array(ROWS).fill(0),
        rightColumn: Array(ROWS).fill(1)
      }
    };
  }

  function resetGame() {
    winClosed = false;
    winShown = false;
    winOverlay.classList.remove('show');
    do {
      state = solvedState();
      gateVisual = state.gate.position;
      for (let i = 0; i < 90; i++) {
        if (Math.random() < 0.24) {
          state.gate.position = [POS.LEFT, POS.CENTER, POS.RIGHT][Math.floor(Math.random() * 3)];
          gateVisual = state.gate.position;
        } else {
          const loop = Math.random() < 0.5 ? 0 : 1;
          if (activeColumn(loop)) rotate(loop, Math.random() < 0.5 ? 1 : -1, false);
        }
      }
    } while (isSolved());
    resize();
  }

  function isSolved() {
    return state.gate.position === POS.CENTER &&
      state.gate.leftColumn.every(v => v === 0) &&
      state.gate.rightColumn.every(v => v === 1) &&
      state.leftLoop.every(v => v === 0) &&
      state.rightLoop.every(v => v === 1);
  }

  function checkSolved() {
    if (!winClosed && !winShown && isSolved()) {
      winShown = true;
      winOverlay.classList.add('show');
    }
  }

  function activeColumn(loop) {
    const p = state.gate.position;
    if (p === POS.CENTER) return loop === 0 ? 'leftColumn' : 'rightColumn';
    if (p === POS.LEFT && loop === 0) return 'rightColumn';
    if (p === POS.RIGHT && loop === 1) return 'leftColumn';
    return null;
  }

  function tokens(loop) {
    const list = [];
    const col = activeColumn(loop);
    if (col && !(pointer && pointer.mode === 'gate')) {
      for (let i = 0; i < ROWS; i++) list.push({ type: col, index: i });
    }
    const base = loop === 0 ? state.leftLoop : state.rightLoop;
    for (let i = 0; i < base.length; i++) list.push({ type: 'base', loop, index: i });
    return list;
  }

  function readToken(t) {
    if (t.type === 'base') return t.loop === 0 ? state.leftLoop[t.index] : state.rightLoop[t.index];
    return state.gate[t.type][t.index];
  }

  function writeToken(t, value) {
    if (t.type === 'base') {
      if (t.loop === 0) state.leftLoop[t.index] = value;
      else state.rightLoop[t.index] = value;
    } else {
      state.gate[t.type][t.index] = value;
    }
  }

  function rotate(loop, steps, shouldCheck = true) {
    steps = Math.trunc(steps);
    if (!steps || !activeColumn(loop)) return;
    const list = tokens(loop);
    const n = list.length;
    const k = ((steps % n) + n) % n;
    if (!k) return;
    const values = list.map(readToken);
    const shifted = values.slice(n - k).concat(values.slice(0, n - k));
    list.forEach((t, i) => writeToken(t, shifted[i]));
    if (shouldCheck) checkSolved();
  }

  function resize() {
    const rect = document.getElementById('stageWrap').getBoundingClientRect();
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width;
    const h = rect.height;
    const gap = Math.max(18, Math.min(24, Math.min(w, h) * 0.036));
    const sep = gap * 3.0;
    const loopW = Math.min(w * 0.30, gap * 8.0);
    const loopH = Math.min(h * 0.58, gap * 16.5);
    const cx = w / 2;
    const cy = h * 0.54;
    layout = { w, h, gap, sep, cx, cy, loopW, loopH, r: Math.max(7, Math.min(10, gap * 0.36)) };
    layout.leftSlotX = cx - sep / 2;
    layout.rightSlotX = cx + sep / 2;
    layout.leftCenterX = layout.leftSlotX - loopW / 2;
    layout.rightCenterX = layout.rightSlotX + loopW / 2;
    layout.top = cy - loopH / 2;
    layout.bottom = cy + loopH / 2;
    layout.slotTop = cy - gap * 1.5;
    draw();
  }

  function loopPoints(loop) {
    const pts = [];
    const col = activeColumn(loop);
    if (col && !(pointer && pointer.mode === 'gate')) {
      const x = loop === 0 ? layout.leftSlotX : layout.rightSlotX;
      for (let i = 0; i < ROWS; i++) pts.push({ x, y: layout.slotTop + i * layout.gap });
    }
    const cx = loop === 0 ? layout.leftCenterX : layout.rightCenterX;
    const rx = layout.loopW / 2;
    const ry = layout.loopH / 2;
    for (let i = 0; i < OUTER; i++) {
      const a = -Math.PI / 2 + (i + 1) * Math.PI * 2 / (OUTER + 1);
      const x = cx + Math.cos(a) * rx;
      const y = layout.cy + Math.sin(a) * ry;
      pts.push({ x, y });
    }
    return pts;
  }

  function pointAt(points, index) {
    const n = points.length;
    const x = ((index % n) + n) % n;
    const i = Math.floor(x);
    const f = x - i;
    const a = points[i];
    const b = points[(i + 1) % n];
    const s = f * f * (3 - 2 * f);
    return { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s };
  }

  function draw() {
    if (!layout) return;
    ctx.clearRect(0, 0, layout.w, layout.h);
    const grad = ctx.createLinearGradient(0, 0, 0, layout.h);
    grad.addColorStop(0, '#171b24');
    grad.addColorStop(1, '#0d1016');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, layout.w, layout.h);

    drawRails();
    drawBalls(0);
    drawBalls(1);
    drawInactiveGateBalls();
    drawGateHandle();
  }

  function drawRails() {
    for (const loop of [0, 1]) {
      const cx = loop === 0 ? layout.leftCenterX : layout.rightCenterX;
      const slotX = loop === 0 ? layout.leftSlotX : layout.rightSlotX;
      const active = !!activeColumn(loop);
      ctx.save();
      ctx.lineWidth = layout.r * 3.8;
      ctx.strokeStyle = '#05070a';
      ctx.beginPath();
      ctx.ellipse(cx, layout.cy, layout.loopW / 2, layout.loopH / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = active ? 'rgba(168,221,255,.75)' : 'rgba(255,155,155,.55)';
      if (!active) ctx.setLineDash([7, 7]);
      ctx.beginPath();
      ctx.ellipse(cx, layout.cy, layout.loopW / 2, layout.loopH / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = layout.r * 3.8;
      ctx.strokeStyle = '#05070a';
      ctx.beginPath();
      ctx.moveTo(slotX, layout.slotTop);
      ctx.lineTo(slotX, layout.slotTop + layout.gap * 3);
      ctx.stroke();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = active ? 'rgba(168,221,255,.75)' : 'rgba(255,155,155,.55)';
      if (!active) ctx.setLineDash([7, 7]);
      ctx.beginPath();
      ctx.moveTo(slotX, layout.slotTop);
      ctx.lineTo(slotX, layout.slotTop + layout.gap * 3);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawBalls(loop) {
    const list = tokens(loop);
    const pts = loopPoints(loop);
    let offset = snap[loop];
    if (pointer && pointer.mode === 'loop' && pointer.loop === loop) offset = pointer.offset;
    for (let i = 0; i < list.length; i++) {
      const p = pointAt(pts, i + offset);
      drawBall(p.x, p.y, COLORS[readToken(list[i])]);
    }
  }

  function drawInactiveGateBalls() {
    const active = new Set([activeColumn(0), activeColumn(1)].filter(Boolean));
    for (const col of ['leftColumn', 'rightColumn']) {
      if (active.has(col)) continue;
      const baseX = layout.cx + gateVisual * layout.sep;
      const x = col === 'leftColumn' ? baseX - layout.sep / 2 : baseX + layout.sep / 2;
      state.gate[col].forEach((v, i) => drawBall(x, layout.slotTop + i * layout.gap, COLORS[v]));
    }
  }

  function drawGateHandle() {
    const x = layout.cx + gateVisual * layout.sep;
    ctx.save();
    ctx.fillStyle = 'rgba(215,236,255,.22)';
    ctx.strokeStyle = 'rgba(215,236,255,.62)';
    ctx.lineWidth = 1.2;
    for (const y of [layout.top - layout.gap * 0.6, layout.bottom + layout.gap * 0.6]) {
      roundRect(x - layout.sep * 0.42, y - 5, layout.sep * 0.84, 10, 6);
      ctx.fill();
      ctx.stroke();
    }
    ctx.font = '900 13px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,.52)';
    ctx.fillText('⇆', x, layout.top - layout.gap * 0.6 - 9);
    ctx.restore();
  }

  function drawBall(x, y, color) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, layout.r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - layout.r * 0.33, y - layout.r * 0.36, layout.r * 0.27, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.30)';
    ctx.fill();
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function pointerPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function hitGate(x, y) {
    const gx = layout.cx + gateVisual * layout.sep;
    return Math.abs(x - gx) < layout.sep * 0.55 && y > layout.top - layout.gap && y < layout.bottom + layout.gap;
  }

  function hitLoop(x, y, loop) {
    const cx = loop === 0 ? layout.leftCenterX : layout.rightCenterX;
    const dx = (x - cx) / (layout.loopW / 2);
    const dy = (y - layout.cy) / (layout.loopH / 2);
    return Math.abs(Math.hypot(dx, dy) - 1) < 0.33;
  }

  function loopAngle(x, y, loop) {
    const cx = loop === 0 ? layout.leftCenterX : layout.rightCenterX;
    return Math.atan2(y - layout.cy, x - cx);
  }

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    const p = pointerPos(e);
    let mode = 'none';
    let loop = -1;
    if (hitLoop(p.x, p.y, 0) && activeColumn(0)) { mode = 'loop'; loop = 0; }
    else if (hitLoop(p.x, p.y, 1) && activeColumn(1)) { mode = 'loop'; loop = 1; }
    else if (hitGate(p.x, p.y)) mode = 'gate';
    pointer = { id: e.pointerId, mode, loop, x: p.x, y: p.y, moved: false, startGate: gateVisual, lastAngle: loop >= 0 ? loopAngle(p.x, p.y, loop) : 0, offset: 0 };
    canvas.setPointerCapture(e.pointerId);
  }, { passive: false });

  canvas.addEventListener('pointermove', e => {
    if (!pointer || pointer.id !== e.pointerId) return;
    e.preventDefault();
    const p = pointerPos(e);
    const dx = p.x - pointer.x;
    const dy = p.y - pointer.y;
    if (Math.hypot(dx, dy) > 7) pointer.moved = true;
    if (pointer.mode === 'gate') {
      gateVisual = Math.max(-1, Math.min(1, pointer.startGate + dx / layout.sep));
      draw();
      return;
    }
    if (pointer.mode === 'loop') {
      const a = loopAngle(p.x, p.y, pointer.loop);
      let da = a - pointer.lastAngle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      pointer.lastAngle = a;
      const direction = pointer.loop === 1 ? -1 : 1;
      pointer.offset += direction * da / (Math.PI * 2 / tokens(pointer.loop).length);
      draw();
    }
  }, { passive: false });

  canvas.addEventListener('pointerup', endPointer, { passive: false });
  canvas.addEventListener('pointercancel', endPointer, { passive: false });

  function endPointer(e) {
    if (!pointer || pointer.id !== e.pointerId) return;
    e.preventDefault();
    if (pointer.mode === 'gate') {
      const target = gateVisual < -0.35 ? POS.LEFT : gateVisual > 0.35 ? POS.RIGHT : POS.CENTER;
      state.gate.position = target;
      gateVisual = target;
      checkSolved();
      draw();
    } else if (pointer.mode === 'loop' && pointer.moved) {
      const raw = pointer.offset;
      const steps = Math.round(raw);
      snap[pointer.loop] = raw - steps;
      rotate(pointer.loop, steps);
      animateSnap(pointer.loop, snap[pointer.loop]);
    }
    pointer = null;
  }

  function animateSnap(loop, from) {
    const start = performance.now();
    const duration = 120;
    function frame(now) {
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      snap[loop] = from * (1 - eased);
      draw();
      if (t < 1) requestAnimationFrame(frame);
      else { snap[loop] = 0; draw(); checkSolved(); }
    }
    requestAnimationFrame(frame);
  }

  resetBtn.addEventListener('click', e => { e.preventDefault(); resetGame(); });
  winClose.addEventListener('click', e => { e.preventDefault(); winClosed = true; winOverlay.classList.remove('show'); });
  winOverlay.addEventListener('click', e => { if (e.target === winOverlay) { winClosed = true; winOverlay.classList.remove('show'); } });
  window.addEventListener('resize', resize);

  resetGame();
})();
