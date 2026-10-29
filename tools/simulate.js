#!/usr/bin/env node
/*
 * AI-vs-AI balance harness.
 *   node tools/simulate.js --games 1000 --seed 1000 --label before --out reports/balance-before
 * Options: --data <dir> (default data/), --workers N (default: CPU count), --easy-check N (extra hard-vs-easy games, default 150)
 * Game mix (deterministic): game i uses seed (seed + i). 60% are 3-god FFA cycling all 6 seat orders of
 * {greek, norse, egyptian}; 40% are 2-god duels cycling all 6 ordered pairings. All gods use the Hard AI.
 */
const os = require('os'), fs = require('fs'), path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const loadData = require('./load-data.js');
const FACTIONS = ['greek', 'norse', 'egyptian'];
const PERMS3 = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
const PAIRS = [[0, 1], [1, 0], [0, 2], [2, 0], [1, 2], [2, 1]];

function gameConfig(i, seedBase, games) {
  const three = (i % 5) < 3;
  const k = Math.floor(i / 5) * (three ? 3 : 2) + (three ? (i % 5) : (i % 5) - 3);
  const seats = three ? PERMS3[k % 6] : PAIRS[k % 6];
  return { seed: seedBase + i, players: seats.map(f => ({ faction: FACTIONS[f], ai: 'hard' })) };
}

function runGame(E, AI, cfg) {
  const s = E.newGame(cfg);
  while (!s.over) AI.playTurn(E, s);
  const H = E.helpers, tp = H.totalPop(s);
  return {
    seed: cfg.seed, n: s.players.length, winner: s.winner.pid, winnerFaction: s.players[s.winner.pid].faction, type: s.winner.type, turn: s.winner.turn,
    hash: E.hash(s),
    players: s.players.map(p => ({ faction: p.faction, ai: p.ai, seat: p.id, followers: H.followersOf(s, p.id), share: +(H.followersOf(s, p.id) / tp).toFixed(3),
      shrines: H.playerShrines(s, p.id).length, score: s.winner.scores[p.id], eliminated: p.eliminated, archetype: p.ai === 'hard' ? AI.personality(s, p.id).archetype : 'easy',
      stats: p.stats }))
  };
}

if (!isMainThread) {
  const E = require('../engine/engine.js').create(loadData(workerData.dataDir));
  const AI = require('../engine/ai.js');
  const out = [];
  for (const cfg of workerData.configs) out.push(runGame(E, AI, cfg));
  parentPort.postMessage(out);
  return;
}

function arg(name, def) { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; }
async function runAll(configs, dataDir, workers) {
  const chunks = Array.from({ length: workers }, () => []);
  configs.forEach((c, i) => chunks[i % workers].push(c));
  const results = await Promise.all(chunks.filter(c => c.length).map(configs => new Promise((res, rej) => {
    const w = new Worker(__filename, { workerData: { configs, dataDir } });
    w.on('message', res); w.on('error', rej);
  })));
  return results.flat().sort((a, b) => a.seed - b.seed);
}

function pct(x) { return (100 * x).toFixed(1) + '%'; }
function analyse(games, data) {
  const fac = {}; FACTIONS.forEach(f => fac[f] = { played: 0, wins: 0, played3: 0, wins3: 0, played2: 0, wins2: 0 });
  const seat = {}, types = {}, powerUses = {}, powerGames = {}, actions = {}, arche = {};
  let turns = 0;
  data.powers.forEach(p => { powerUses[p.id] = 0; powerGames[p.id] = 0; });
  const W = { n: 0 }, L = { n: 0 }, keys = ['shrinesBuilt', 'priestsSent', 'eclipses', 'convertedFromRivals', 'faithEarned', 'toppled'];
  keys.forEach(k => { W[k] = 0; L[k] = 0; });
  let exterW = 0, exterL = 0;
  const exterPowers = data.powers.filter(p => p.x === 'exterminate').map(p => p.id);
  for (const g of games) {
    turns += g.turn; types[g.type] = (types[g.type] || 0) + 1;
    g.players.forEach((p, i) => {
      const F = fac[p.faction], won = i === g.winner;
      F.played++; F.wins += won; if (g.n === 3) { F.played3++; F.wins3 += won; } else { F.played2++; F.wins2 += won; }
      const sk = g.n + 'p-seat' + (i + 1); seat[sk] = seat[sk] || { played: 0, wins: 0 }; seat[sk].played++; seat[sk].wins += won;
      const A = arche[p.archetype] = arche[p.archetype] || { played: 0, wins: 0 }; A.played++; A.wins += won;
      data.factions.find(f => f.id === p.faction).powers.forEach(id => powerGames[id]++);
      Object.entries(p.stats.powers).forEach(([k, v]) => powerUses[k] += v);
      Object.entries(p.stats.actions).forEach(([k, v]) => actions[k] = (actions[k] || 0) + v);
      const T = won ? W : L; T.n++; keys.forEach(k => T[k] += p.stats[k]);
      const ex = exterPowers.reduce((a, id) => a + (p.stats.powers[id] || 0), 0); if (won) exterW += ex; else exterL += ex;
    });
  }
  const powerRows = data.powers.map(p => ({ id: p.id, name: p.name, faction: p.faction, x: p.x, uses: powerUses[p.id], perGame: +(powerUses[p.id] / Math.max(1, powerGames[p.id])).toFixed(2) }))
    .sort((a, b) => b.perGame - a.perGame);
  const rates = FACTIONS.map(f => fac[f].wins / fac[f].played), rates3 = FACTIONS.map(f => fac[f].wins3 / Math.max(1, fac[f].played3)), rates2 = FACTIONS.map(f => fac[f].wins2 / Math.max(1, fac[f].played2));
  const spread = a => Math.max(...a) - Math.min(...a);
  const avg = (T) => Object.fromEntries(keys.map(k => [k, +(T[k] / Math.max(1, T.n)).toFixed(2)]));
  return { games: games.length, avgTurns: +(turns / games.length).toFixed(2), types, factions: fac, rates, rates3, rates2,
    spread: spread(rates), spread3: spread(rates3), spread2: spread(rates2), seat, powerRows, actions, archetypes: arche,
    winners: avg(W), losers: avg(L), exterminatePerGame: { winners: +(exterW / W.n).toFixed(2), losers: +(exterL / L.n).toFixed(2) } };
}

function markdown(label, a, easy, cmd, data) {
  const fname = id => data.factions.find(f => f.id === id).name;
  let md = `# Pantheon Wars v0.1 — balance report: ${label}\n\n`;
  md += `Generated by \`${cmd}\` on ${new Date().toISOString().slice(0, 10)}. All numbers below are measured from the run, not estimated.\n\n`;
  md += `- Games: **${a.games}** AI-vs-AI (Hard vs Hard). 60% three-god free-for-all, 40% two-god duels; seat orders rotate evenly.\n`;
  md += `- Average game length: **${a.avgTurns} turns** (cap 45).\n`;
  md += `- Victory types: ${Object.entries(a.types).map(([k, v]) => `${k} ${v} (${pct(v / a.games)})`).join(', ')}.\n\n`;
  md += `## Faction win rates\n\n| Faction | Games | Wins | Overall | 3-god FFA (fair = 33.3%) | 2-god duel (fair = 50%) |\n|---|---|---|---|---|---|\n`;
  FACTIONS.forEach((f, i) => { const F = a.factions[f]; md += `| ${fname(f)} (${f}) | ${F.played} | ${F.wins} | ${pct(a.rates[i])} | ${pct(a.rates3[i])} (${F.wins3}/${F.played3}) | ${pct(a.rates2[i])} (${F.wins2}/${F.played2}) |\n`; });
  md += `\n**Spread (max − min):** overall ${pct(a.spread)}, FFA ${pct(a.spread3)}, duel ${pct(a.spread2)}. Target: ≤ 15.0 percentage points → **${a.spread <= 0.15 && a.spread3 <= 0.15 && a.spread2 <= 0.15 ? 'PASS' : 'FAIL'}**.\n\n`;
  md += `## Seat order\n\n| Seat | Games | Win rate |\n|---|---|---|\n` + Object.keys(a.seat).sort().map(k => `| ${k} | ${a.seat[k].played} | ${pct(a.seat[k].wins / a.seat[k].played)} |`).join('\n') + '\n\n';
  md += `## Divine power usage (uses per game in which the owning faction played)\n\n| Power | Faction | X | Total uses | Per game |\n|---|---|---|---|---|\n`;
  a.powerRows.forEach(p => md += `| ${p.name} | ${p.faction} | ${p.x} | ${p.uses} | ${p.perGame} |\n`);
  md += `\nMost used: **${a.powerRows[0].name}** (${a.powerRows[0].perGame}/game). Least used: **${a.powerRows[a.powerRows.length - 1].name}** (${a.powerRows[a.powerRows.length - 1].perGame}/game).\n\n`;
  md += `Core action totals: ${Object.entries(a.actions).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(', ')}.\n\n`;
  md += `## Dominant strategies\n\nEach Hard AI god gets a seeded personality; its strongest trait names its archetype (Builder = shrines, Zealot = eclipses/miracles, Seer = exploration, Steward = economy powers).\n\n| Archetype | Appearances | Win rate |\n|---|---|---|\n`;
  Object.keys(a.archetypes).sort().forEach(k => md += `| ${k} | ${a.archetypes[k].played} | ${pct(a.archetypes[k].wins / a.archetypes[k].played)} |\n`);
  md += `\nWinners vs losers (average per god per game):\n\n| Stat | Winners | Losers |\n|---|---|---|\n`;
  Object.keys(a.winners).forEach(k => md += `| ${k} | ${a.winners[k]} | ${a.losers[k]} |\n`);
  md += `| exterminate-power uses | ${a.exterminatePerGame.winners} | ${a.exterminatePerGame.losers} |\n`;
  if (easy) md += `\n## Difficulty check\n\n${easy.games} mirror duels of Hard vs Easy (same pantheon on both sides, pantheons and seats rotated): Hard won **${easy.hardWins} (${pct(easy.hardWins / easy.games)})**.\n`;
  return md;
}

(async function main() {
  const games = +arg('games', 1000), seed = +arg('seed', 1000), label = arg('label', 'run'), out = arg('out', 'reports/balance-' + label);
  const dataDir = path.resolve(arg('data', path.join(__dirname, '..', 'data')));
  const workers = +arg('workers', Math.max(1, os.cpus().length)), easyN = +arg('easy-check', 150);
  const data = loadData(dataDir);
  const t0 = Date.now();
  const configs = Array.from({ length: games }, (_, i) => gameConfig(i, seed, games));
  const results = await runAll(configs, dataDir, workers);
  const a = analyse(results, data);
  let easy = null;
  if (easyN > 0) {
    // Mirror duels (same pantheon on both sides) isolate AI skill from faction strength.
    const ec = Array.from({ length: easyN }, (_, i) => { const f = FACTIONS[i % 3], hardSeat = Math.floor(i / 3) % 2; return { seed: seed + 50000 + i, players: [0, 1].map(k => ({ faction: f, ai: k === hardSeat ? 'hard' : 'easy', name: (k === hardSeat ? 'Hard ' : 'Easy ') + f })) }; });
    const er = await runAll(ec, dataDir, workers);
    easy = { games: er.length, hardWins: er.filter(g => g.players[g.winner].ai === 'hard').length };
  }
  const cmd = 'node tools/simulate.js ' + process.argv.slice(2).join(' ');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out + '.json', JSON.stringify({ label, cmd, seconds: (Date.now() - t0) / 1000, analysis: a, easy, games: results.map(g => ({ seed: g.seed, n: g.n, winner: g.winnerFaction, type: g.type, turn: g.turn, hash: g.hash })) }, null, 1));
  fs.writeFileSync(out + '.md', markdown(label, a, easy, cmd, data));
  console.log(`${games} games in ${((Date.now() - t0) / 1000).toFixed(1)}s | avg turns ${a.avgTurns} | types ${JSON.stringify(a.types)}`);
  FACTIONS.forEach((f, i) => console.log(`  ${f.padEnd(9)} overall ${pct(a.rates[i])}  ffa ${pct(a.rates3[i])}  duel ${pct(a.rates2[i])}`));
  console.log(`  spread overall ${pct(a.spread)} ffa ${pct(a.spread3)} duel ${pct(a.spread2)}`);
  console.log('  powers/game: ' + a.powerRows.map(p => p.id + '=' + p.perGame).join(' '));
  console.log('  archetypes: ' + Object.entries(a.archetypes).map(([k, v]) => k + ' ' + pct(v.wins / v.played)).join(', '));
  if (easy) console.log(`  hard beats easy ${easy.hardWins}/${easy.games}`);
})();
