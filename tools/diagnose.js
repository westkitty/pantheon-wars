#!/usr/bin/env node
// Per-pantheon spending diagnostics from N quick greedy games: where Faith and Favor go, how often each power is cast and what it bought.
//   node tools/diagnose.js [games=100] [seed=7000]
const { E, AI, H, IDS } = require('../tests/helpers.js');
const N = +(process.argv[2] || 100), seed0 = +(process.argv[3] || 7000);
const agg = {}; IDS.forEach(f => agg[f] = { n: 0, spend: {}, favorSpend: {}, endFaith: 0, wins: 0, peakShare: 0 });
for (let i = 0; i < N; i++) {
  const n = i % 5 < 3 ? 3 : 2, pl = []; for (let k = 0; k < n; k++) pl.push({ faction: IDS[(i * 7 + k * 3 + Math.floor(i / 10)) % 10] });
  if (new Set(pl.map(p => p.faction)).size < n) continue;
  const s = E.newGame({ seed: seed0 + i, players: pl });
  let g = 0;
  while (!s.over && g++ < 4000) {
    const pid = s.current, p = s.players[pid], a = AI.nextAction(E, s, { noLookahead: true }), f0 = p.faith, v0 = p.favor;
    if (E.apply(s, a)) E.apply(s, { type: 'endTurn' });
    else if (a.type !== 'endTurn') { const key = a.type === 'power' ? a.power : a.type; const A = agg[p.faction]; A.spend[key] = (A.spend[key] || 0) + Math.max(0, f0 - p.faith); A.favorSpend[key] = (A.favorSpend[key] || 0) + Math.max(0, v0 - p.favor); }
  }
  s.players.forEach(p => { const A = agg[p.faction]; A.n++; A.endFaith += p.faith; A.peakShare += p.stats.peakShare; if (s.winner.pid === p.id) A.wins++; });
}
IDS.forEach(f => { const A = agg[f]; if (!A.n) return; const tot = Object.values(A.spend).reduce((a, b) => a + b, 0) / A.n;
  console.log(f.padEnd(13), 'win', (A.wins / A.n * 100).toFixed(0) + '%', 'spent/g', tot.toFixed(0), 'endFaith', (A.endFaith / A.n).toFixed(0), '|', Object.entries(A.spend).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([k, v]) => k + ' ' + (v / A.n).toFixed(0)).join(', ')); });
