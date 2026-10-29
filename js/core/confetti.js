// Confettis de réussite : fines lamelles blanches propulsées depuis le bas, ~2 s, sans bibliothèque.
// mode 'centre' : un jet depuis le bas au centre ; mode 'coins' : deux jets depuis les coins bas qui se croisent.
export function confetti(mode = 'centre', count = 50) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const c = document.createElement('canvas');
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:50';
  document.body.append(c);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = c.width = innerWidth * dpr, H = c.height = innerHeight * dpr;
  const ctx = c.getContext('2d');
  const g = 0.32 * dpr;           // gravité
  const rnd = (a, b) => a + Math.random() * (b - a);
  const parts = [];
  const shoot = (x, angle, spread, n) => {
    for (let i = 0; i < n; i++) {
      const a = angle + rnd(-spread, spread);
      const v = rnd(15, 25) * dpr * (H / dpr > 700 ? 1.08 : 1);
      parts.push({
        x, y: H + 10, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        w: rnd(2, 3.2) * dpr, h: rnd(7, 11) * dpr,
        r: rnd(0, Math.PI), vr: rnd(-0.2, 0.2), flip: rnd(0, Math.PI), vf: rnd(0.08, 0.18),
        sway: rnd(0.6, 1.4), life: 0,
      });
    }
  };
  const up = -Math.PI / 2;
  if (mode === 'coins') {
    shoot(W * 0.04, up + 0.42, 0.22, Math.round(count / 2));
    shoot(W * 0.96, up - 0.42, 0.22, Math.round(count / 2));
  } else shoot(W / 2, up, 0.38, count);

  const start = performance.now();
  const frame = now => {
    const t = (now - start) / 1000;
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += g;
      p.vx *= 0.985; p.vy *= p.vy > 0 ? 0.94 : 0.985;      // freinage : la retombée flotte
      p.x += p.vx + (p.vy > 0 ? Math.sin(t * 6 * p.sway + p.flip) * 0.9 * dpr : 0);
      p.y += p.vy;
      p.r += p.vr; p.flip += p.vf;
      const alpha = Math.max(0, Math.min(1, 2.4 - t));    // fondu sur la fin
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.scale(1, Math.cos(p.flip));                     // la lamelle tourne sur elle-même
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(70, 115, 170, .75)';        // liseré bleu : visible sur fond clair
      ctx.lineWidth = 0.8 * dpr;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (t < 2.5) requestAnimationFrame(frame); else c.remove();
  };
  requestAnimationFrame(frame);
}
