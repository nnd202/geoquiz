// Supports d'affichage : une carte SVG (zoom au pincement) ou une grille de cases.
import { el } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';

// Interface commune : { root, nodes, mark, flash, reveal, showLabels, select }
function common(nodes, root) {
  return {
    root, nodes,
    mark(code, cls, on = true) { (nodes[code] || []).forEach(n => n.classList.toggle(cls, on)); },
    flash(code) {
      (nodes[code] || []).forEach(n => { n.classList.remove('flash'); void n.getBoundingClientRect(); n.classList.add('flash'); });
    },
  };
}

/* ---------- Grille ---------- */
export function buildGrid(container, items, inPlay, onTap) {
  const wrap = el('div', 'gridwrap');
  const grid = el('div', 'grid');
  const nodes = {};
  for (const it of items) {
    const c = el('button', 'cell');
    c.dataset.code = it.code;
    c.append(el('span', 'n', it.code), el('span', 'nm', ''));
    if (!inPlay.has(it.code)) c.classList.add('off');
    c.addEventListener('click', () => onTap(it.code));
    grid.append(c);
    nodes[it.code] = [c];
  }
  wrap.append(grid);
  container.append(wrap);
  const b = common(nodes, wrap);
  b.reveal = (code, name) => (nodes[code] || []).forEach(c => { c.querySelector('.nm').textContent = name; });
  b.showLabels = list => list.forEach(it => b.reveal(it.code, it.nom));
  b.select = () => {};
  return b;
}

/* ---------- Carte ---------- */
export function buildMap(container, svgText, inPlay, onTap, opts = {}) {
  const wrap = el('div', 'mapwrap');
  const svg = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement;
  const map = document.importNode(svg, true);
  map.setAttribute('role', 'img');
  map.setAttribute('aria-label', opts.label || 'Carte');
  const nodes = {};
  map.querySelectorAll('[data-code]').forEach(p => {
    const code = p.dataset.code;
    if (!inPlay.has(code)) p.classList.add('off');
    (nodes[code] ||= []).push(p);
  });
  const labels = document.createElementNS(NS, 'g');
  map.append(labels);
  wrap.append(map);
  container.append(wrap);

  const pz = panZoom(map, onTap, opts.tapNeedsSingle);
  const z = el('div', 'zoom');
  [['+', 'Zoomer', () => pz.zoomBy(1.6)], ['−', 'Dézoomer', () => pz.zoomBy(1 / 1.6)], ['⤢', "Vue d'ensemble", pz.reset]]
    .forEach(([t, a, f]) => { const b = el('button', null, t); b.setAttribute('aria-label', a); b.addEventListener('click', f); z.append(b); });
  container.append(z);

  const b = common(nodes, wrap);
  b.reveal = () => {};
  // Mode étude et bilan : codes posés au centre de chaque zone (pas dans la métropole pour les zones en encart).
  b.showLabels = list => {
    const inInset = new Set([...map.querySelectorAll('[data-inset][data-code]')].map(p => p.dataset.code));
    for (const it of list) {
      for (const p of nodes[it.code] || []) {
        if (inInset.has(it.code) && !p.dataset.inset) continue;
        const bb = p.getBBox();
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', bb.x + bb.width / 2);
        t.setAttribute('y', bb.y + bb.height / 2);
        t.setAttribute('class', 'lbl');
        t.textContent = it.code;
        labels.append(t);
      }
    }
  };
  b.select = code => {
    map.querySelectorAll('.sel').forEach(n => n.classList.remove('sel'));
    b.mark(code, 'sel');
  };
  return b;
}

// Pincer pour zoomer, glisser à un doigt, double toucher, molette sur PC. Le zoom agit sur la carte seule.
function panZoom(svg, onTap, tapNeedsSingle) {
  const BASE = svg.getAttribute('viewBox').split(/[\s,]+/).map(Number);
  let view;
  const setVB = () => svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  const reset = () => { view = { x: BASE[0], y: BASE[1], w: BASE[2], h: BASE[3] }; setVB(); };
  const info = () => {
    const r = svg.getBoundingClientRect();
    const s = Math.min(r.width / view.w, r.height / view.h);
    return { r, s, ox: (r.width - view.w * s) / 2, oy: (r.height - view.h * s) / 2 };
  };
  const toSvg = (cx, cy) => { const { r, s, ox, oy } = info(); return [view.x + (cx - r.left - ox) / s, view.y + (cy - r.top - oy) / s]; };
  const clamp = () => {
    view.x = Math.min(Math.max(view.x, BASE[0] - view.w / 2), BASE[0] + BASE[2] - view.w / 2);
    view.y = Math.min(Math.max(view.y, BASE[1] - view.h / 2), BASE[1] + BASE[3] - view.h / 2);
  };
  const zoomAt = (px, py, f) => {
    const nw = Math.min(BASE[2], Math.max(BASE[2] / 14, view.w / f));
    const k = nw / view.w;
    view.x = px - (px - view.x) * k; view.y = py - (py - view.y) * k;
    view.w = nw; view.h *= k;
    clamp(); setVB();
  };
  const zoomBy = f => zoomAt(view.x + view.w / 2, view.y + view.h / 2, f);
  reset();

  const pts = new Map();
  let moved = false, last = null, pinch = null, lastTap = { t: 0, x: 0, y: 0 };
  svg.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = pts.size > 1;
    if (pts.size === 1) last = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY };
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    }
  });
  svg.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1 && last) {
      if (!moved && Math.hypot(e.clientX - last.sx, e.clientY - last.sy) < 8) return;
      moved = true;
      const { s } = info();
      view.x -= (e.clientX - last.x) / s; view.y -= (e.clientY - last.y) / s;
      last.x = e.clientX; last.y = e.clientY;
      clamp(); setVB();
    } else if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const { s } = info();
      view.x -= (mx - pinch.mx) / s; view.y -= (my - pinch.my) / s;
      const [px, py] = toSvg(mx, my);
      zoomAt(px, py, d / pinch.d);
      pinch = { d, mx, my };
    }
  });
  const up = e => {
    if (!pts.has(e.pointerId)) return;
    const single = pts.size === 1;
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size === 1) { const [p] = [...pts.values()]; last = { x: p.x, y: p.y, sx: p.x, sy: p.y }; }
    if (!single || moved || e.type === 'pointercancel') return;
    const now = performance.now();
    const dbl = now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30;
    lastTap = { t: now, x: e.clientX, y: e.clientY };
    // En mode « Nom → toucher », un toucher répond : pas de double toucher pour zoomer.
    if (dbl && !(tapNeedsSingle && tapNeedsSingle())) { const [px, py] = toSvg(e.clientX, e.clientY); zoomAt(px, py, 2); return; }
    const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-code]');
    if (hit) onTap(hit.dataset.code);
  };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const [px, py] = toSvg(e.clientX, e.clientY);
    zoomAt(px, py, e.deltaY < 0 ? 1.2 : 1 / 1.2);
  }, { passive: false });
  return { reset, zoomBy };
}
