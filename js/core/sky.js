// Ciel mobile : le ciel vu d'un lieu, à une date et une heure choisies.
// Deux cartes : « Polaire au centre » (la carte à deux disques, avec l'horizon et le zénith qui tournent dessus)
// et « Mon ciel » (un disque centré sur le zénith, bordé par l'horizon, N en haut et E à gauche).
// Heure : heure solaire du lieu (midi = Soleil plein sud), sans fuseau horaire.
import { el } from './dom.js';
import { buildMap } from './boards.js';

const rad = Math.PI / 180;
const NS = 'http://www.w3.org/2000/svg';
const DOT = 'M-1 0a1 1 0 1 0 2 0a1 1 0 1 0-2 0z';

/* ---------- Astronomie (précision de l'ordre du dixième de degré, largement assez pour une carte) ---------- */
export function julian(date, h, lon) {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 864e5 + 2440587.5 + (h - lon / 15) / 24;
}
export const sidereal = (jd, lon) => ((280.46061837 + 360.98564736629 * (jd - 2451545) + lon) % 360 + 360) % 360;
export function sunRaDec(jd) {
  const n = jd - 2451545;
  const L = 280.46 + 0.9856474 * n, g = (357.528 + 0.9856003 * n) * rad;
  const lam = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad, eps = (23.439 - 4e-7 * n) * rad;
  return [Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) / rad, Math.asin(Math.sin(eps) * Math.sin(lam)) / rad];
}
// Une étoile passe au moins une fois au-dessus de l'horizon si sa déclinaison est à moins de 90° de la latitude.
export const rises = (dec, lat) => Math.abs(lat - dec) < 90;
export function visibleSet(items, geo, lat) {
  const s = new Set();
  for (const it of items) {
    const rings = geo.bounds[it.code];
    if (rings) { if (rings.some(r => r.some(p => rises(p[1], lat)))) s.add(it.code); }
    else if (it.geo && rises(it.geo[1], lat)) s.add(it.code);
  }
  return s;
}
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const fmtCoord = (lat, lon) => `${Math.abs(lat).toLocaleString('fr-FR')}° ${lat >= 0 ? 'N' : 'S'} · ${Math.abs(lon).toLocaleString('fr-FR')}° ${lon >= 0 ? 'E' : 'O'}`;

// Repère local : pour une heure donnée, convertit (ascension droite, déclinaison) en hauteur et en direction.
function frame(st) {
  const jd = julian(st.date, st.h, st.lon);
  const lst = sidereal(jd, st.lon), sf = Math.sin(st.lat * rad), cf = Math.cos(st.lat * rad);
  return {
    jd, lst,
    // [hauteur en degrés, composante est, composante nord] (est et nord : direction horizontale non normée)
    h(ra, dec) {
      const H = (lst - ra) * rad, d = dec * rad, sd = Math.sin(d), cd = Math.cos(d), cH = Math.cos(H);
      const alt = Math.asin(Math.max(-1, Math.min(1, sf * sd + cf * cd * cH))) / rad;
      return [alt, -Math.sin(H) * cd, sd * cf - cd * sf * cH];
    },
  };
}

/* ---------- Barre du temps : heure (curseur), lecture automatique, rappel de la date et du lieu ---------- */
function timeBar(host, st, onChange) {
  const bar = el('div', 'skybar');
  const play = el('button', 'sky-play', '▶');
  play.type = 'button'; play.setAttribute('aria-label', 'Faire tourner le ciel');
  const col = el('div', 'sky-col');
  const lab = el('div', 'sky-t');
  const r = el('input'); r.type = 'range'; r.min = '0'; r.max = '1440'; r.step = '5';
  r.setAttribute('aria-label', 'Heure solaire du lieu');
  col.append(lab, r);
  bar.append(play, col);
  host.append(bar);
  const day = new Date(st.date + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const show = () => {
    const m = Math.round(st.h * 60) % 1440;
    lab.textContent = `${String(Math.floor(m / 60)).padStart(2, '0')} h ${String(m % 60).padStart(2, '0')} · ${day} · ${st.nom}`;
    r.value = String(m);
  };
  r.addEventListener('input', () => { st.h = r.value / 60; show(); onChange(); });
  let raf = 0, t0 = 0;
  const step = t => {
    if (t0) { st.h = (st.h + (t - t0) / 1000 * 2) % 24; show(); onChange(); } // 2 heures par seconde
    t0 = t; raf = requestAnimationFrame(step);
  };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; t0 = 0; play.textContent = '▶'; play.setAttribute('aria-pressed', 'false'); };
  play.addEventListener('click', () => {
    if (raf) return stop();
    play.textContent = '❚❚'; play.setAttribute('aria-pressed', 'true'); raf = requestAnimationFrame(step);
  });
  show();
  return { stop };
}

const throttle = f => { let q = 0; return () => { if (!q) q = requestAnimationFrame(() => { q = 0; f(); }); }; };

/* ---------- Polaire au centre : la carte à deux disques (maps/ciel.svg), avec un calque qui tourne ---------- */
const PC = { N: [255, 260], S: [745, 260] }, PR = 238; // centres et rayon des disques de maps/ciel.svg
function polXY(ra, dec) {
  const n = dec >= 0, r = (n ? 90 - dec : 90 + dec) / 90 * PR, a = ra * rad, [cx, cy] = PC[n ? 'N' : 'S'];
  return [cx + (n ? 1 : -1) * r * Math.sin(a), cy + r * Math.cos(a), n];
}
const svgEl = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); p?.append(e); return e; };

function polar(host, o) {
  const { st } = o;
  const b = buildMap(host, o.mapSvg, o.map);
  const svg = b.root.querySelector('svg');
  const g = svgEl('g', { class: 'sky-over' });
  svg.insertBefore(g, svg.querySelector('g.labels'));
  // Hémisphère qui ne se lève jamais : voile sombre sur le disque opposé ; trajet du zénith en pointillé.
  const far = st.lat >= 0 ? 'S' : 'N', near = st.lat >= 0 ? 'N' : 'S';
  if (Math.abs(st.lat) > 0.05) svgEl('circle', { class: 'sky-never', cx: PC[far][0], cy: PC[far][1], r: Math.abs(st.lat) / 90 * PR }, g);
  svgEl('circle', { class: 'sky-ztrack', cx: PC[near][0], cy: PC[near][1], r: (90 - Math.abs(st.lat)) / 90 * PR }, g);
  const hor = svgEl('path', { class: 'sky-hor' }, g);
  const sunG = st.sun ? svgEl('g', {}, g) : null;
  const sun = sunG && svgEl('path', { class: 'sky-sun', d: DOT }, sunG);
  const zG = svgEl('g', {}, g);
  svgEl('path', { class: 'sky-zen', d: DOT }, zG);
  const draw = () => {
    const f = frame(st), sf = Math.sin(st.lat * rad), cf = Math.cos(st.lat * rad);
    // Horizon : tous les points de hauteur nulle, d'azimut 0 à 360°, coupés au passage d'un disque à l'autre.
    let d = '', prev = null;
    for (let az = 0; az <= 360; az += 2) {
      const A = az * rad, dec = Math.asin(cf * Math.cos(A)) / rad;
      const H = Math.atan2(-Math.sin(A), -sf * Math.cos(A)) / rad;
      const [x, y, n] = polXY(f.lst - H, dec);
      d += (prev === n ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      prev = n;
    }
    hor.setAttribute('d', d);
    const [zx, zy] = polXY(f.lst, st.lat);
    zG.setAttribute('transform', `translate(${zx.toFixed(1)} ${zy.toFixed(1)})`);
    if (sun) {
      const [sx, sy] = polXY(...sunRaDec(f.jd));
      sunG.setAttribute('transform', `translate(${sx.toFixed(1)} ${sy.toFixed(1)})`);
    }
  };
  draw();
  const bar = timeBar(host, st, throttle(draw));
  b.stop = bar.stop;
  return b;
}

/* ---------- Mon ciel : disque centré sur le zénith ---------- */
const R = 240;
function zenith(host, o) {
  const { st, geo, codes } = o;
  const k = 1 / 90 * R;
  // SVG de départ, au contrat de buildMap (calques, zones, traits, marqueurs) ; les positions sont ensuite
  // recalculées en place à chaque mouvement du curseur, sans reconstruire la carte.
  const parts = [`<svg xmlns="${NS}" viewBox="${-R - 24} ${-R - 24} ${2 * R + 48} ${2 * R + 48}">`,
    `<defs><clipPath id="sky-clip"><circle r="${R}"/></clipPath></defs>`,
    `<g data-layer="cadre"><circle class="sky-disk" r="${R}"/>`];
  for (const [t, x, y] of [['N', 0, -R - 12], ['E', -R - 12, 0], ['S', 0, R + 12], ['O', R + 12, 0]]) {
    parts.push(`<text class="sky-card" x="${x}" y="${y}">${t}</text>`);
  }
  parts.push('</g><g data-layer="constellations" clip-path="url(#sky-clip)">');
  const zones = Object.keys(geo.bounds);
  for (const c of zones) parts.push(`<path class="zone con zen" data-code="${c}" data-k="z:${c}" fill-rule="evenodd" d=""/>`);
  parts.push('</g><g data-layer="traces" clip-path="url(#sky-clip)"><path class="sub sky-line" data-k="lines" d=""/></g>');
  parts.push('<g data-layer="etoiles">');
  geo.stars.forEach(([, , m, code], i) => {
    const r = Math.round(Math.max(0.7, 3.3 - 0.55 * m) * 100) / 100;
    parts.push(`<g data-k="g:${i}"><path class="pt rond star${code ? ' named' : ''}"${code ? ` data-code="${code}"` : ''} data-k="s:${i}" data-x="0" data-y="0" d="${DOT}" style="--r:${r}"/></g>`);
  });
  parts.push('</g>');
  if (st.sun) parts.push(`<g class="sky-over"><g data-k="sun"><path class="sky-sun" d="${DOT}"/></g></g>`);
  parts.push('</svg>');
  const b = buildMap(host, parts.join(''), o.map);
  const wrap = b.root, svg = wrap.querySelector('svg');
  wrap.classList.add('zen');
  const q = s => svg.querySelector(`[data-k="${s}"]`);
  const zEl = Object.fromEntries(zones.map(c => [c, q(`z:${c}`)]));
  const lineEl = q('lines'), sunEl = q('sun'), disk = svg.querySelector('.sky-disk');
  const sEl = geo.stars.map((_, i) => [q(`g:${i}`), q(`s:${i}`)]);
  const up = new Set(); // éléments au-dessus de l'horizon, pour les étiquettes

  const P = (f, ra, dec) => {
    const [alt, e, n] = f.h(ra, dec), hz = Math.hypot(e, n), r = (90 - alt) * k;
    return hz < 1e-9 ? [0, 0, alt] : [-r * e / hz, -r * n / hz, alt];
  };
  const draw = () => {
    const f = frame(st);
    up.clear();
    for (const c of zones) {
      let d = '', vis = false;
      for (const ring of geo.bounds[c]) {
        const pts = ring.map(([ra, dec]) => P(f, ra, dec));
        if (!pts.some(p => p[2] > 0)) continue;
        vis = true;
        d += 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'z';
        // Anneau qui fait le tour du centre sans contenir le zénith : il entoure le nadir (sous nos pieds).
        // Avec la règle pair-impair, un cercle extérieur remet la zone du bon côté de son contour.
        let wind = 0;
        for (let i = 1; i < pts.length; i++) {
          let da = Math.atan2(pts[i][1], pts[i][0]) - Math.atan2(pts[i - 1][1], pts[i - 1][0]);
          if (da > Math.PI) da -= 2 * Math.PI; else if (da < -Math.PI) da += 2 * Math.PI;
          wind += da;
        }
        const meanAlt = pts.reduce((s, p) => s + p[2], 0) / pts.length;
        if (Math.abs(wind) > Math.PI && meanAlt < 0) d += `M${-2.2 * R} 0a${2.2 * R} ${2.2 * R} 0 1 0 ${4.4 * R} 0a${2.2 * R} ${2.2 * R} 0 1 0 ${-4.4 * R} 0z`;
      }
      const z = zEl[c];
      z.setAttribute('d', d);
      if (vis) {
        up.add(c);
        let [x, y] = P(f, ...geo.anchor[c]);
        const rr = Math.hypot(x, y), lim = R * 0.92;
        if (rr > lim) { x *= lim / rr; y *= lim / rr; }
        z.dataset.x = x.toFixed(1); z.dataset.y = y.toFixed(1);
      }
    }
    let ld = '';
    for (const seg of geo.lines) {
      let run = 0;
      for (const [ra, dec] of seg) {
        const p = P(f, ra, dec);
        if (p[2] < -3) { run = 0; continue; }
        ld += (run++ ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
      }
    }
    lineEl.setAttribute('d', ld);
    geo.stars.forEach(([ra, dec, , code], i) => {
      const [x, y, alt] = P(f, ra, dec), [g, p] = sEl[i];
      const below = alt <= 0;
      p.classList.toggle('below', below);
      if (below) return;
      if (code) up.add(code);
      g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      p.dataset.x = x.toFixed(1); p.dataset.y = y.toFixed(1);
    });
    if (st.sun) {
      const [x, y, alt] = P(f, ...sunRaDec(f.jd));
      sunEl.style.display = alt > -0.5 ? '' : 'none';
      sunEl.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      // Couleur du ciel selon la hauteur du Soleil : jour, crépuscules (civil, nautique, astronomique), nuit.
      const t = Math.max(0, Math.min(1, (alt + 18) / 24));
      disk.style.fill = `rgb(${Math.round(12 + 50 * t * t)},${Math.round(31 + 95 * t * t)},${Math.round(61 + 120 * t * t)})`;
    }
    if (lastLabels) baseLabels(lastLabels[0].filter(it => up.has(it.code)), lastLabels[1]);
  };
  // Étiquettes (étude, bilan) : seulement pour ce qui est au-dessus de l'horizon, recalculées quand le ciel tourne.
  const baseLabels = b.showLabels;
  let lastLabels = null;
  b.showLabels = (list, mode) => { lastLabels = [list, mode]; baseLabels(list.filter(it => up.has(it.code)), mode); };
  draw();
  const bar = timeBar(host, st, throttle(draw));
  b.stop = bar.stop;
  return b;
}

// Monte la carte du Ciel mobile dans le plateau. o : { st, geo, mapSvg, map (options de buildMap) }
export function mountSky(host, o) {
  host.classList.add('has-sky');
  return o.st.mode === 'czen' ? zenith(host, o) : polar(host, o);
}
