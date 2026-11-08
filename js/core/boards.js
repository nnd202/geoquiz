// Supports d'affichage : une carte SVG (zoom au pincement) ou une grille de cases.
import { el } from './dom.js';

const NS = 'http://www.w3.org/2000/svg';
const TAP_PX = 24; // rayon de toucher d'un point, en pixels d'écran

function common(nodes, root) {
  return {
    root, nodes,
    mark(code, cls, on = true) { (nodes[code] || []).forEach(n => n.classList.toggle(cls, on)); },
    flash(code) {
      (nodes[code] || []).forEach(n => { n.classList.remove('flash'); void n.getBoundingClientRect(); n.classList.add('flash'); });
    },
    // Onde verte au moment où un élément est trouvé : copie éphémère du tracé, animée en CSS.
    // Marqueur : la forme grandit et s'efface ; zone : contour qui déborde, posé au-dessus des voisines ;
    // fleuve : trait qui s'épaissit ; case de grille : liseré qui déborde.
    pulse(code) {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      for (const n of nodes[code] || []) {
        const cl = n.classList;
        if (cl.contains('cell')) { cl.remove('pulse'); void n.offsetWidth; cl.add('pulse'); continue; }
        if (cl.contains('riv-hit') || !n.getAttribute?.('d')) continue;
        const a = n.cloneNode(false);
        a.removeAttribute('data-code');
        if (cl.contains('pt')) {
          a.setAttribute('class', [...cl].filter(c => !['todo', 'found', 'off', 'missed', 'wrong', 'sel', 'asked', 'flash', 'late'].includes(c)).concat('pt-aura').join(' '));
          n.parentNode.insertBefore(a, n);
        } else if (cl.contains('riv')) {
          a.setAttribute('class', 'riv-aura');
          n.parentNode.insertBefore(a, n);
        } else {
          a.setAttribute('class', 'zone-aura');
          n.parentNode.append(a); // au-dessus des zones voisines, sinon elles cachent l'onde
        }
        a.addEventListener('animationend', () => a.remove());
        setTimeout(() => a.remove(), 1200); // filet de sécurité si l'animation ne se joue pas
      }
    },
  };
}

/* ---------- Grille ---------- */
export function buildGrid(container, items, inPlay, onTap, { images = false, head = null } = {}) {
  const wrap = el('div', 'gridwrap');
  const grid = el('div', 'grid' + (images ? ' images' : head ? ' words' : ''));
  const nodes = {};
  for (const it of items) {
    const c = el('button', 'cell');
    c.dataset.code = it.code;
    if (images) {
      // Grille d'images (drapeaux) : l'image tient lieu d'indice, le nom apparaît une fois trouvé.
      const img = el('img');
      img.src = it.image; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      c.append(img, el('span', 'nm', ''));
    } else c.append(el('span', 'n', head ? it[head] : it.code), el('span', 'nm', ''));
    c.classList.add(inPlay.has(it.code) ? 'todo' : 'off');
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
  b.ask = () => {};
  b.relate = () => {};
  b.setReveal = on => wrap.classList.toggle('reveal', on);
  // Mode curseur : la case qui attend la réponse, gardée visible au-dessus du clavier.
  b.setCursor = code => {
    grid.querySelectorAll('.cur').forEach(c => c.classList.remove('cur'));
    const c = nodes[code]?.[0];
    if (!c) return;
    c.classList.add('cur');
    c.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  };
  return b;
}

/* ---------- Carte ----------
 * Contrat du SVG : groupes [data-layer] ; zones path.zone, traits path.sub, marqueurs path.pt (data-x, data-y), avec data-code.
 * - éléments du jeu de données : jouables ;
 * - zones hors jeu : décor ; traits : affichés si le calque est demandé ;
 * - points hors jeu : repères si leur calque est demandé, sinon masqués.
 */
export function buildMap(container, svgText, { codes, inPlay, layers = [], onTap, label, tapNeedsSingle, style }) {
  const wrap = el('div', 'mapwrap' + (style ? ` ${style}` : ''));
  const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement;
  const map = document.importNode(parsed, true);
  map.setAttribute('role', 'img');
  map.setAttribute('aria-label', label || 'Carte');
  const nodes = {};
  const points = [];

  map.querySelectorAll('g[data-layer]').forEach(g => {
    const name = g.dataset.layer;
    const wanted = layers.includes(name);
    const playable = [...g.querySelectorAll('[data-code]')].some(n => codes.has(n.dataset.code));
    if (g.querySelector('.sub') && !wanted) g.remove();
    else if (g.querySelector('.pt') && !wanted && !playable) g.remove();
  });
  map.querySelectorAll('[data-code]').forEach(n => {
    const code = n.dataset.code;
    if (!codes.has(code)) {
      n.classList.add(n.classList.contains('pt') ? 'ref' : 'deco');
      if (code.startsWith('x-')) n.classList.add('terr'); // territoires : plus pâles que les zones à trouver
      n.removeAttribute('data-code');
      return;
    }
    if (!inPlay.has(code)) n.classList.add('off');
    else n.classList.add('todo');
    (nodes[code] ||= []).push(n);
    if (n.classList.contains('pt')) points.push(n);
  });
  const labels = document.createElementNS(NS, 'g');
  labels.setAttribute('class', 'labels');
  map.append(labels);
  wrap.append(map);
  container.append(wrap);

  // Toucher : le point jouable le plus proche (zone de toucher élargie), sinon la zone sous le doigt.
  const pick = (cx, cy, svgXY, scale) => {
    if (points.length) {
      let best = null, bd = TAP_PX / scale;
      for (const p of points) {
        if (p.classList.contains('off')) continue;
        const d = Math.hypot(+p.dataset.x - svgXY[0], +p.dataset.y - svgXY[1]);
        if (d < bd) { bd = d; best = p; }
      }
      if (best) return best.dataset.code;
    }
    return document.elementFromPoint(cx, cy)?.closest?.('[data-code]')?.dataset.code || null;
  };
  let placeLabels = () => {};
  const pz = panZoom(map, pick, onTap, tapNeedsSingle, (v, k) => placeLabels(v, k));
  const z = el('div', 'zoom');
  [['+', 'Zoomer', () => pz.zoomBy(1.6)], ['−', 'Dézoomer', () => pz.zoomBy(1 / 1.6)], ['⤢', "Vue d'ensemble", pz.reset]]
    .forEach(([t, a, f]) => { const bt = el('button', null, t); bt.setAttribute('aria-label', a); bt.addEventListener('click', f); z.append(bt); });
  container.append(z);

  const b = common(nodes, wrap);
  b.reveal = () => {};
  // Étiquettes du mode étude et du bilan : code ou nom, au centre des zones, à côté des points.
  // Elles gardent la même taille à l'écran et sont replacées à chaque zoom : par ordre de priorité
  // (grandes zones d'abord, puis points dans l'ordre des données), chacune prend la première position
  // libre autour de son élément ; un peu plus loin, un trait fin la relie à lui ; sinon elle attend
  // un zoom plus fort pour apparaître.
  let entries = [];
  const LH = 14, GAP = 2, OBST = 5; // hauteur d'une étiquette, marge entre étiquettes, demi-taille d'un point (px)
  b.showLabels = (list, mode = 'code') => {
    labels.textContent = '';
    entries = [];
    const inInset = new Set([...map.querySelectorAll('[data-inset][data-code]')].map(p => p.dataset.code));
    list.forEach((it, idx) => {
      const own = nodes[it.code] || [];
      const hasPt = own.some(n => n.classList.contains('pt'));
      for (const n of own) {
        if (inInset.has(it.code) && !n.dataset.inset) continue;
        if (n.classList.contains('riv-hit') || (hasPt && !n.classList.contains('pt'))) continue;
        let ax, ay, kind, area = 0;
        if (n.classList.contains('riv') && n.getTotalLength) {
          const p = n.getPointAtLength(n.getTotalLength() / 2);
          ax = p.x; ay = p.y; kind = 'riv';
          const bb = n.getBBox(); area = bb.width * bb.height;
        } else if (n.classList.contains('pt')) {
          ax = +n.dataset.x; ay = +n.dataset.y; kind = 'pt';
        } else {
          // accroche fournie par la carte (plus grand morceau de la zone), sinon centre du cadre
          const bb = n.getBBox();
          ax = n.dataset.x ? +n.dataset.x : bb.x + bb.width / 2;
          ay = n.dataset.y ? +n.dataset.y : bb.y + bb.height / 2;
          kind = 'zone'; area = bb.width * bb.height;
        }
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('class', 'lbl' + (kind === 'pt' ? ' pl' : ''));
        t.textContent = mode === 'code' ? it.code : it.nom;
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('class', 'lead');
        labels.append(line, t);
        entries.push({ t, line, ax, ay, kind, area, idx, w: 0 });
      }
    });
    // Ordre de priorité : zones et fleuves par taille décroissante, puis points dans l'ordre des données.
    entries.sort((p, q) => (p.kind === 'pt') - (q.kind === 'pt') || q.area - p.area || p.idx - q.idx);
    const k = pz.k();
    for (const e of entries) {
      e.t.setAttribute('x', e.ax); e.t.setAttribute('y', e.ay);
      const len = e.t.getComputedTextLength?.() || 0;
      e.w = len > 0 ? len / k : e.t.textContent.length * 6.6; // largeur en pixels d'écran
    }
    placeLabels(pz.view(), k);
  };
  placeLabels = (v, k) => {
    if (!entries.length) return;
    const placed = []; // rectangles occupés, en unités SVG
    const hit = (x0, y0, x1, y1) => placed.some(r => x0 < r[2] && x1 > r[0] && y0 < r[3] && y1 > r[1]);
    // Les points eux-mêmes sont des obstacles : une étiquette ne recouvre pas un autre point.
    const o = OBST * k;
    for (const e of entries) if (e.kind === 'pt') placed.push([e.ax - o, e.ay - o, e.ax + o, e.ay + o]);
    const margin = 40 * k;
    for (const e of entries) {
      const inView = e.ax > v.x - margin && e.ax < v.x + v.w + margin && e.ay > v.y - margin && e.ay < v.y + v.h + margin;
      e.t.style.display = 'none'; e.line.style.display = 'none';
      if (!inView) continue;
      const w = e.w, hw = w / 2, h = LH / 2;
      // Positions candidates (centre de l'étiquette, en pixels), de la plus naturelle à la plus éloignée.
      const near = e.kind === 'pt'
        ? [[9 + hw, 0], [-(9 + hw), 0], [0, -13], [0, 13], [7 + hw, -11], [7 + hw, 11], [-(7 + hw), -11], [-(7 + hw), 11]]
        : [[0, 0], [0, -LH], [0, LH], [hw + 8, 0], [-(hw + 8), 0]];
      const far = e.kind === 'pt'
        ? [[22 + hw, 0], [-(22 + hw), 0], [0, -26], [0, 26], [18 + hw, -20], [18 + hw, 20], [-(18 + hw), -20], [-(18 + hw), 20]]
        : []; // une zone garde son nom sur elle ou juste à côté, sans trait
      let spot = null, lead = false;
      for (const [list, isFar] of [[near, false], [far, true]]) {
        for (const [dx, dy] of list) {
          const cx = e.ax + dx * k, cy = e.ay + dy * k;
          const r = [cx - (hw + GAP) * k, cy - (h + GAP) * k, cx + (hw + GAP) * k, cy + (h + GAP) * k];
          // le point de l'élément lui-même ne gêne pas sa propre étiquette
          const own = e.kind === 'pt' ? placed.findIndex(q => q[0] === e.ax - o && q[1] === e.ay - o) : -1;
          const saved = own >= 0 ? placed.splice(own, 1)[0] : null;
          const busy = hit(...r);
          if (saved) placed.push(saved);
          if (!busy) { spot = [cx, cy, r]; lead = isFar; break; }
        }
        if (spot) break;
      }
      if (!spot) continue;
      const [cx, cy, r] = spot;
      placed.push(r);
      e.t.setAttribute('x', cx); e.t.setAttribute('y', cy);
      e.t.style.display = '';
      if (lead) {
        // trait du point vers le bord le plus proche de l'étiquette
        const ex = Math.min(Math.max(e.ax, cx - hw * k), cx + hw * k), ey = Math.min(Math.max(e.ay, cy - h * k), cy + h * k);
        e.line.setAttribute('x1', e.ax); e.line.setAttribute('y1', e.ay);
        e.line.setAttribute('x2', ex); e.line.setAttribute('y2', ey);
        e.line.style.display = '';
      }
    }
  };
  b.select = code => {
    map.querySelectorAll('.sel').forEach(n => n.classList.remove('sel'));
    b.mark(code, 'sel');
  };
  // Territoires rattachés (Groenland pour le Danemark…) : teinte pâle quand leur pays est trouvé.
  b.relate = (code, cls) => map.querySelectorAll(`[data-parent="${code}"]`).forEach(n => n.classList.add(cls));
  // « Révéler les restants » : les éléments encore à trouver passent en orange (réversible).
  b.setReveal = on => wrap.classList.toggle('reveal', on);
  // Indice « zone surlignée » : l'élément demandé est mis en évidence, sans son nom.
  b.ask = code => {
    map.querySelectorAll('.asked').forEach(n => n.classList.remove('asked'));
    if (code) b.mark(code, 'asked');
  };
  return b;
}

// Pincer pour zoomer, glisser à un doigt, double toucher, molette sur PC. Le zoom agit sur la carte seule.
function panZoom(svg, pick, onTap, tapNeedsSingle, onView = () => {}) {
  const BASE = svg.getAttribute('viewBox').split(/[\s,]+/).map(Number);
  let view, raf = 0;
  // --k = unités SVG par pixel d'écran : marqueurs et étiquettes gardent la même taille à l'écran
  // quel que soit le zoom (comme sur une appli de cartes) ; en vue d'ensemble, ils peuvent se chevaucher.
  const setVB = () => {
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
    const r = svg.getBoundingClientRect();
    const s = Math.min(r.width / view.w, r.height / view.h);
    svg.style.setProperty('--k', String(s > 0 ? 1 / s : view.w / 380));
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; onView(visible(), s > 0 ? 1 / s : view.w / 380); });
  };
  if (window.ResizeObserver) new ResizeObserver(() => setVB()).observe(svg);
  const reset = () => { view = { x: BASE[0], y: BASE[1], w: BASE[2], h: BASE[3] }; setVB(); };
  const info = () => {
    const r = svg.getBoundingClientRect();
    const s = Math.min(r.width / view.w, r.height / view.h) || 1;
    return { r, s, ox: (r.width - view.w * s) / 2, oy: (r.height - view.h * s) / 2 };
  };
  const visible = () => {
    const { r, s, ox, oy } = info();
    return { x: view.x - ox / s, y: view.y - oy / s, w: r.width / s, h: r.height / s };
  };
  const toSvg = (cx, cy) => { const { r, s, ox, oy } = info(); return [view.x + (cx - r.left - ox) / s, view.y + (cy - r.top - oy) / s]; };
  const clamp = () => {
    view.x = Math.min(Math.max(view.x, BASE[0] - view.w / 2), BASE[0] + BASE[2] - view.w / 2);
    view.y = Math.min(Math.max(view.y, BASE[1] - view.h / 2), BASE[1] + BASE[3] - view.h / 2);
  };
  const zoomAt = (px, py, f) => {
    const nw = Math.min(BASE[2], Math.max(BASE[2] / 20, view.w / f));
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
    const xy = toSvg(e.clientX, e.clientY);
    // En mode « Nom → toucher », un toucher répond : pas de double toucher pour zoomer.
    if (dbl && !(tapNeedsSingle && tapNeedsSingle())) { zoomAt(xy[0], xy[1], 2); return; }
    const code = pick(e.clientX, e.clientY, xy, info().s);
    if (code) onTap(code);
  };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const [px, py] = toSvg(e.clientX, e.clientY);
    zoomAt(px, py, e.deltaY < 0 ? 1.2 : 1 / 1.2);
  }, { passive: false });
  return { reset, zoomBy, view: visible, k: () => 1 / (info().s || 1) };
}
