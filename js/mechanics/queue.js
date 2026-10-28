// File d'éléments à poser un par un (Indice → saisie, Nom → toucher).
export function next(g, show) {
  const cur = g.queue[0];
  if (!cur) return g.finish(g.missed.size ? 'list' : 'all');
  g.cur = cur;
  g.tries = 0;
  show(cur);
}

export function skip(g) {
  g.queue.push(g.queue.shift());
}
