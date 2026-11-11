// Morse : sons fabriqués à la volée (Web Audio, aucun fichier) et règle de temps officielle.
// Unité = 1200 / (mots par minute) ms. Point = 1 unité, trait = 3, espace entre signes = 1,
// fin de lettre = 3 unités de silence.
import { store, save } from './store.js';

export const MORSE_DEFAULT = { wpm: 12, aide: true }; // 12 mots/min : point 100 ms, trait 300 ms
export const morseCfg = () => ({ ...MORSE_DEFAULT, ...(store.morse || {}) });
export function setMorse(patch) { store.morse = { ...morseCfg(), ...patch }; save(); }
export const unitMs = () => 1200 / morseCfg().wpm;

// Seuils de classement, en unités (règle absolue, sans tolérance relative au rythme de l'utilisateur).
export const DOT_MAX = 2;   // appui < 2 unités : point
export const DASH_MAX = 5;  // de 2 à 5 unités : trait ; au-delà : trop long
export const LETTER_GAP = 3; // silence qui termine la lettre

const FREQ = 650;
let ctx = null, osc = null, gain = null;
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    osc = ctx.createOscillator(); gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = FREQ; gain.gain.value = 0;
    osc.connect(gain).connect(ctx.destination); osc.start();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Bip du manipulateur : tant que le bouton est appuyé.
export function toneOn() {
  const c = audio(); if (!c) return;
  const t = c.currentTime;
  gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.linearRampToValueAtTime(0.25, t + 0.005);
}
export function toneOff() {
  if (!ctx) return;
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.linearRampToValueAtTime(0, t + 0.005);
}

// Joue une lettre (motif « .-- ») au rythme réglé. Renvoie sa durée en ms.
export function playPattern(pattern) {
  const c = audio(); if (!c) return 0;
  const u = unitMs() / 1000;
  let t = c.currentTime + 0.05;
  gain.gain.cancelScheduledValues(c.currentTime); gain.gain.setValueAtTime(0, c.currentTime);
  for (const s of pattern) {
    const d = (s === '-' ? 3 : 1) * u;
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.25, t + 0.005);
    gain.gain.setValueAtTime(0.25, t + d - 0.005); gain.gain.linearRampToValueAtTime(0, t + d);
    t += d + u;
  }
  return (t - c.currentTime) * 1000;
}

export const pretty = m => [...m].map(c => (c === '.' ? '·' : '−')).join(' ');
export const units = ms => ms / unitMs();
export const fmtU = u => `${u.toFixed(1).replace('.', ',')} u`;
