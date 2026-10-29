#!/usr/bin/env node
/*
 * AI-vs-AI balance harness for any number of pantheons (reads the roster from data).
 *
 *   node tools/simulate.js --plan full --duel-seeds 20 --ffa-seeds 10 --label ten-final --out reports/ten-pantheon-balance-final
 *   node tools/simulate.js --games 3000 --seed 5000 --label candidate --out reports/ten-candidate          (stratified sample)
 *   node tools/simulate.js --legacy3 --games 3000 --seed 5000 ...        (v0.1 mix: greek/norse/egyptian, 60% FFA / 40% duels)
 *
 * Options: --data <dir>  --workers N  --easy-check N (hard-vs-easy duels, default 200)  --mode 2p|3p  --faction <id> (filter)
 *          --resume (reuse <out>.partial.jsonl)  --no-lookahead (greedy Hierophant, for speed comparisons)  --seed base
 * Determinism: config i always uses seed (seed + i); configs are enumerated in a fixed order, so any run is reproducible and can be
 * resumed or split across machines. Every ordered duel (A,B) and ordered triple (A,B,C) is a separate configuration, so each faction
 * plays every seat against every opponent equally often in a full plan.
 */
const os = require('os'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const loadData = require('./load-data.js');

function runGame(E, AI, cfg, opts) {
  const s = E.newGame(cfg);
  let guard = 0;
  while (!s.over && guard++ < 6000) AI.playTurn(E, s, opts);
  const H = E.helpers, tp = H.totalPop(s);
  return {
    i: cfg.i, seed: cfg.seed, n: s.players.length, winner: s.winner.pid, winnerFaction: s.players[s.winner.pid].faction, type: s.winner.type, turn: s.winner.turn,
    hash: E.hash(s),
    players: s.players.map(p => ({ faction: p.faction, ai: p.ai, seat: p.id, followers: H.followersOf(s, p.id), share: +(H.followersOf(s, p.id) / tp).toFixed(3),
      shrines: H.playerShrines(s, p.id).length, score: s.winner.scores[p.id], eliminated: p.eliminated, archetype: p.ai === 'hard' ? AI.personality(s, p.id).archetype : 'easy',
      stats: p.stats, favor: p.favor }))
  };
}

if (!isMainThread) {
  const E = require('../engine/engine.js').create(loadData(workerData.dataDir));
  const AI = require('../engine/ai.js');
  const opts = workerData.noLookahead ? { noLookahead: true } : undefined;
  for (const cfg of workerData.configs) parentPort.postMessage({ game: runGame(E, AI, cfg, opts) });
  parentPort.postMessage({ done: true, aiStats: AI.stats });
  return;
}

function arg(name, def) { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; }
function flag(name) { return process.argv.indexOf('--' + name) > 0; }
function perms(ids, k) { const out = []; (function rec(cur) { if (cur.length === k) { out.push(cur.slice()); return; } ids.forEach(id => { if (cur.indexOf(id) < 0) { cur.push(id); rec(cur); cur.pop(); } }); })([]); return out; }

function buildConfigs(ids, opts) {
  const duels = perms(ids, 2), triples = perms(ids, 3), out = [];
  const mk = (seats, seed) => ({ seed, players: seats.map(f => ({ faction: f, ai: 'hard' })) });
  if (opts.legacy3) {
    // v0.1 mix: game i: 60% FFA cycling 6 seat orders, 40% duels cycling 6 ordered pairs
    const P3 = perms(ids, 3), P2 = perms(ids, 2);
    for (let i = 0; i < opts.games; i++) { const three = (i % 5) < 3, k = Math.floor(i / 5) * (three ? 3 : 2) + (three ? (i % 5) : (i % 5) - 3); out.push(mk(three ? P3[k % P3.length] : P2[k % P2.length], opts.seed + i)); }
  } else if (opts.plan === 'full') {
    let seed = opts.seed;
    if (opts.mode !== '3p') duels.forEach(d => { for (let r = 0; r < opts.duelSeeds; r++) out.push(mk(d, seed++)); });
    if (opts.mode !== '2p') triples.forEach(t => { for (let r = 0; r < opts.ffaSeeds; r++) out.push(mk(t, seed++)); });
  } else {
    // stratified sample: interleave ordered duels and triples (40% / 60%), cycling every configuration before repeating any
    let di = 0, ti = 0;
    for (let i = 0; i < opts.games; i++) {
      const three = opts.mode === '3p' ? true : opts.mode === '2p' ? false : (i % 5) < 3;
      out.push(mk(three ? triples[(ti++ * 7) % triples.length] : duels[(di++ * 7) % duels.length], opts.seed + i));
    }
  }
  return out.filter(c => !opts.faction || c.players.some(p => p.faction === opts.faction)).map((c, i) => Object.assign(c, { i }));
}

async function runAll(configs, dataDir, workers, noLookahead, onGame) {
  const chunks = Array.from({ length: workers }, () => []);
  configs.forEach((c, i) => chunks[i % workers].push(c));
  const ai = { lookaheads: 0, lookaheadMs: 0, illegal: 0, forcedEnd: 0 };
  await Promise.all(chunks.filter(c => c.length).map(configs => new Promise((res, rej) => {
    const w = new Worker(__filename, { workerData: { configs, dataDir, noLookahead } });
    w.on('message', m => { if (m.game) onGame(m.game); if (m.done) { Object.keys(ai).forEach(k => ai[k] += m.aiStats[k] || 0); res(); } });
    w.on('error', rej);
  })));
  return ai;
}

/* Wilson score interval for a binomial proportion. */
function wilson(k, n, z) { z = z || 1.96; if (!n) return [0, 1]; const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - m) / d, (c + m) / d]; }
function pct(x) { return (100 * x).toFixed(1) + '%'; }
function ci(k, n) { const w = wilson(k, n); return pct(k / Math.max(1, n)) + ' [' + (100 * w[0]).toFixed(1) + '–' + (100 * w[1]).toFixed(1) + ']'; }

function analyse(games, data, ids) {
  const fac = {}; ids.forEach(f => fac[f] = { played: 0, wins: 0, played3: 0, wins3: 0, played2: 0, wins2: 0 });
  const seat = {}, types = {}, powerUses = {}, powerGames = {}, actions = {}, arche = {}, pair = {}, turnsList = [];
  data.powers.forEach(p => { powerUses[p.id] = 0; powerGames[p.id] = 0; });
  const keys = ['shrinesBuilt', 'priestsSent', 'eclipses', 'convertedFromRivals', 'faithEarned', 'toppled', 'covenantsKept', 'covenantsBroken', 'counters', 'specs', 'routes', 'landmarks', 'treaties', 'breaches'];
  const W = { n: 0 }, L = { n: 0 }; keys.forEach(k => { W[k] = 0; L[k] = 0; });
  for (const g of games) {
    turnsList.push(g.turn); types[g.type] = (types[g.type] || 0) + 1;
    g.players.forEach((p, i) => {
      const F = fac[p.faction], won = i === g.winner ? 1 : 0;
      F.played++; F.wins += won; if (g.n === 3) { F.played3++; F.wins3 += won; } else { F.played2++; F.wins2 += won; }
      const sk = g.n + 'p-seat' + (i + 1); seat[sk] = seat[sk] || { played: 0, wins: 0 }; seat[sk].played++; seat[sk].wins += won;
      const A = arche[p.archetype] = arche[p.archetype] || { played: 0, wins: 0 }; A.played++; A.wins += won;
      data.factions.find(f => f.id === p.faction).powers.forEach(id => powerGames[id]++);
      Object.entries(p.stats.powers).forEach(([k, v]) => powerUses[k] += v);
      Object.entries(p.stats.actions).forEach(([k, v]) => actions[k] = (actions[k] || 0) + v);
      const T = won ? W : L; T.n++; keys.forEach(k => T[k] += p.stats[k] || 0);
    });
    if (g.n === 2) { const a = g.players[0].faction, b = g.players[1].faction, key = [a, b].sort().join('|'), P = pair[key] = pair[key] || { a: [a, b].sort()[0], b: [a, b].sort()[1], n: 0, aw: 0 }; P.n++; if (g.players[g.winner].faction === P.a) P.aw++; }
  }
  const rate = (k, n) => n ? k / n : 0;
  const rows = ids.map(f => { const F = fac[f]; return { id: f, played: F.played, wins: F.wins, overall: rate(F.wins, F.played), ffa: rate(F.wins3, F.played3), duel: rate(F.wins2, F.played2), ffaCI: wilson(F.wins3, F.played3), duelCI: wilson(F.wins2, F.played2), F }; });
  const spread = (k, filt) => { const v = rows.filter(r => r.F[filt] > 0).map(r => r[k]); return v.length ? Math.max(...v) - Math.min(...v) : 0; };
  const powerRows = data.powers.map(p => ({ id: p.id, name: p.name, faction: p.faction, x: p.x, uses: powerUses[p.id], games: powerGames[p.id], perGame: +(powerUses[p.id] / Math.max(1, powerGames[p.id])).toFixed(2) })).sort((a, b) => b.perGame - a.perGame);
  turnsList.sort((a, b) => a - b);
  const avg = T => Object.fromEntries(keys.map(k => [k, +(T[k] / Math.max(1, T.n)).toFixed(2)]));
  const facStats = {}; ids.forEach(f => { facStats[f] = { n: 0 }; keys.forEach(k => facStats[f][k] = 0); facStats[f].share = 0; facStats[f].finalShrines = 0; });
  games.forEach(g => g.players.forEach(p => { const S = facStats[p.faction]; S.n++; keys.forEach(k => S[k] += p.stats[k] || 0); S.share += p.share; S.finalShrines += p.shrines; }));
  Object.values(facStats).forEach(S => { Object.keys(S).forEach(k => { if (k !== 'n') S[k] = +(S[k] / Math.max(1, S.n)).toFixed(2); }); });
  const pairs = Object.values(pair).map(P => Object.assign(P, { rate: P.aw / P.n, ci: wilson(P.aw, P.n) })).sort((x, y) => Math.abs(y.rate - 0.5) - Math.abs(x.rate - 0.5));
  return { games: games.length, avgTurns: +(turnsList.reduce((a, b) => a + b, 0) / Math.max(1, games.length)).toFixed(2), p10Turn: turnsList[Math.floor(turnsList.length * 0.1)], p90Turn: turnsList[Math.floor(turnsList.length * 0.9)],
    types, rows, spreadOverall: spread('overall', 'played'), spread3: spread('ffa', 'played3'), spread2: spread('duel', 'played2'), seat, powerRows, actions, archetypes: arche,
    winners: avg(W), losers: avg(L), pairs, facStats };
}

function markdown(label, a, easy, meta, data) {
  const fname = id => data.factions.find(f => f.id === id).name;
  const target = 0.15;
  let md = `# Pantheon Wars v0.2 — balance report: ${label}\n\n`;
  md += `Generated by \`${meta.cmd}\` on ${meta.date}. Engine ${meta.engine}, data hash \`${meta.dataHash}\`, git ${meta.git}. Workers ${meta.workers}, ${meta.seconds}s. All numbers are measured from this run.\n\n`;
  md += `- Games: **${a.games}** AI-vs-AI (Hierophant vs Hierophant${meta.noLookahead ? ', lookahead off' : ', bounded lookahead on'}). Plan: ${meta.plan}.\n`;
  md += `- Turns: mean **${a.avgTurns}**, p10 ${a.p10Turn}, p90 ${a.p90Turn} (cap 45).\n`;
  md += `- Victory types: ${Object.entries(a.types).map(([k, v]) => `${k} ${v} (${pct(v / a.games)})`).join(', ')}.\n\n`;
  md += `Intervals are 95% Wilson score intervals. Fair share is 50% in duels and 33.3% in three-god games.\n\n`;
  md += `## Faction win rates\n\n| Faction | Games | Overall | 3-god FFA [95% CI] | 2-god duel [95% CI] |\n|---|---|---|---|---|\n`;
  a.rows.forEach(r => { md += `| ${fname(r.id)} (${r.id}) | ${r.played} | ${pct(r.overall)} | ${r.F.played3 ? ci(r.F.wins3, r.F.played3) : '—'} (${r.F.wins3}/${r.F.played3}) | ${r.F.played2 ? ci(r.F.wins2, r.F.played2) : '—'} (${r.F.wins2}/${r.F.played2}) |\n`; });
  const pass = a.spread3 <= target && a.spread2 <= target;
  md += `\n**Spread (max − min of point estimates):** overall ${pct(a.spreadOverall)}, FFA ${pct(a.spread3)}, duel ${pct(a.spread2)}. Target ≤ ${pct(target)} per mode → **${pass ? 'PASS' : 'FAIL'}**`;
  md += ` (point estimates; with these sample sizes a single faction's interval is about ±${(100 * (wilson(Math.round(a.rows[0].F.played2 / 2), Math.max(1, a.rows[0].F.played2))[1] - 0.5)).toFixed(1)} points in duels, so spreads under ~10 points are within noise).\n\n`;
  md += `## Seat order\n\nEvery faction occupies every seat equally often in a full plan, so these rates already control for faction and opponent.\n\n| Seat | Games | Win rate [95% CI] |\n|---|---|---|\n` + Object.keys(a.seat).sort().map(k => `| ${k} | ${a.seat[k].played} | ${ci(a.seat[k].wins, a.seat[k].played)} |`).join('\n') + '\n\n';
  md += `## Most lopsided duel pairings\n\n| Pairing | Games | First listed wins [95% CI] |\n|---|---|---|\n`;
  a.pairs.slice(0, 12).forEach(P => md += `| ${P.a} vs ${P.b} | ${P.n} | ${ci(P.aw, P.n)} |\n`);
  md += `\n## Divine power usage (uses per game in which the owning faction played)\n\n| Power | Faction | X | Uses | Per game |\n|---|---|---|---|---|\n`;
  a.powerRows.forEach(p => md += `| ${p.name} | ${p.faction} | ${p.x} | ${p.uses} | ${p.perGame} |\n`);
  const unused = a.powerRows.filter(p => p.uses === 0 && p.games > 0);
  md += `\nMost used: **${a.powerRows[0].name}** (${a.powerRows[0].perGame}/game). Least used: **${a.powerRows[a.powerRows.length - 1].name}** (${a.powerRows[a.powerRows.length - 1].perGame}/game). Never used: ${unused.length ? unused.map(p => p.id).join(', ') : 'none'}.\n\n`;
  md += `Action totals: ${Object.entries(a.actions).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${v}`).join(', ')}.\n\n`;
  md += `## Economy per pantheon (average per god per game)\n\n| Faction | Faith earned | Shrines built | Final shrines | Final share | Won from rivals | Toppled | Covenants kept | Routes |\n|---|---|---|---|---|---|---|---|---|\n`;
  Object.keys(a.facStats).forEach(f => { const S = a.facStats[f]; md += `| ${f} | ${S.faithEarned} | ${S.shrinesBuilt} | ${S.finalShrines} | ${pct(S.share)} | ${S.convertedFromRivals} | ${S.toppled} | ${S.covenantsKept} | ${S.routes} |\n`; });
  md += `\n## Archetypes\n\n| Archetype | Appearances | Win rate [95% CI] |\n|---|---|---|\n`;
  Object.keys(a.archetypes).sort().forEach(k => md += `| ${k} | ${a.archetypes[k].played} | ${ci(a.archetypes[k].wins, a.archetypes[k].played)} |\n`);
  md += `\nWinners vs losers (average per god per game):\n\n| Stat | Winners | Losers |\n|---|---|---|\n`;
  Object.keys(a.winners).forEach(k => md += `| ${k} | ${a.winners[k]} | ${a.losers[k]} |\n`);
  md += `\nAI integrity: illegal actions returned ${meta.ai.illegal}, forced turn ends ${meta.ai.forcedEnd}, lookaheads ${meta.ai.lookaheads} (${meta.ai.lookaheads ? (meta.ai.lookaheadMs / meta.ai.lookaheads).toFixed(1) : 0} ms each).\n`;
  if (easy) {
    md += `\n## Difficulty check\n\n${easy.games} duels of Hierophant vs Acolyte across all ten pantheons (pairings rotated, seats alternated): Hierophant won **${ci(easy.hardWins, easy.games)}**.\n\n| Hard pantheon | Games | Hard win rate |\n|---|---|---|\n`;
    Object.keys(easy.byFaction).sort().forEach(f => md += `| ${f} | ${easy.byFaction[f].n} | ${pct(easy.byFaction[f].w / easy.byFaction[f].n)} |\n`);
  }
  return md;
}

(async function main() {
  const dataDir = path.resolve(arg('data', path.join(__dirname, '..', 'data')));
  const data = loadData(dataDir);
  let ids = data.factions.map(f => f.id);
  const legacy3 = flag('legacy3');
  if (legacy3) ids = ['greek', 'norse', 'egyptian'];
  else if (ids.length !== 10) { console.error('expected 10 factions in data, found ' + ids.length); process.exit(1); }
  const opts = { plan: arg('plan', 'sample'), games: +arg('games', 1000), seed: +arg('seed', 1000), duelSeeds: +arg('duel-seeds', 20), ffaSeeds: +arg('ffa-seeds', 10), mode: arg('mode', null), faction: arg('faction', null), legacy3 };
  const label = arg('label', 'run'), out = arg('out', 'reports/balance-' + label), workers = +arg('workers', Math.max(1, os.cpus().length)), easyN = +arg('easy-check', 200), noLookahead = flag('no-lookahead');
  const configs = buildConfigs(ids, opts);
  const partial = out + '.partial.jsonl';
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const done = new Map();
  if (flag('resume') && fs.existsSync(partial)) fs.readFileSync(partial, 'utf8').split('\n').filter(Boolean).forEach(l => { const g = JSON.parse(l); done.set(g.i, g); });
  else if (fs.existsSync(partial)) fs.unlinkSync(partial);
  const todo = configs.filter(c => !done.has(c.i));
  const t0 = Date.now(); let n = done.size;
  console.log(`${configs.length} configurations (${todo.length} to run) on ${workers} workers…`);
  const ai = await runAll(todo, dataDir, workers, noLookahead, g => { done.set(g.i, g); fs.appendFileSync(partial, JSON.stringify(g) + '\n'); if (++n % 250 === 0) console.log(`  ${n}/${configs.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)`); });
  const results = configs.map(c => done.get(c.i));
  const a = analyse(results, data, ids);
  let easy = null;
  if (easyN > 0) {
    const ec = Array.from({ length: easyN }, (_, i) => { const f = ids[i % ids.length], o = ids[(i + 1 + Math.floor(i / ids.length)) % ids.length === i % ids.length ? (i + 2) % ids.length : (i + 1 + Math.floor(i / ids.length)) % ids.length], hardSeat = Math.floor(i / ids.length) % 2;
      return { i: 1e6 + i, seed: opts.seed + 500000 + i, players: [0, 1].map(k => ({ faction: k === hardSeat ? f : o, ai: k === hardSeat ? 'hard' : 'easy' })) }; });
    const er = []; await runAll(ec, dataDir, workers, noLookahead, g => er.push(g));
    const byFaction = {}; er.forEach(g => { const h = g.players.find(p => p.ai === 'hard'); const B = byFaction[h.faction] = byFaction[h.faction] || { n: 0, w: 0 }; B.n++; if (g.players[g.winner].ai === 'hard') B.w++; });
    easy = { games: er.length, hardWins: er.filter(g => g.players[g.winner].ai === 'hard').length, byFaction };
  }
  let git = 'unknown'; try { git = require('child_process').execSync('git rev-parse --short HEAD', { cwd: path.join(__dirname, '..') }).toString().trim() + (require('child_process').execSync('git status --porcelain', { cwd: path.join(__dirname, '..') }).toString().trim() ? '+uncommitted' : ''); } catch (e) {}
  const dataHash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 12);
  const meta = { cmd: 'node tools/simulate.js ' + process.argv.slice(2).join(' '), date: new Date().toISOString().slice(0, 10), engine: require('../engine/engine.js').VERSION, dataHash, git, workers,
    seconds: ((Date.now() - t0) / 1000).toFixed(0), plan: legacy3 ? 'legacy three-pantheon mix' : opts.plan === 'full' ? `full ordered coverage, ${opts.duelSeeds} seeds per ordered duel, ${opts.ffaSeeds} per ordered triple` : 'stratified sample cycling ordered configurations', noLookahead, ai };
  fs.writeFileSync(out + '.json', JSON.stringify({ label, meta, analysis: a, easy, games: results.map(g => ({ seed: g.seed, factions: g.players.map(p => p.faction), winner: g.winnerFaction, type: g.type, turn: g.turn, hash: g.hash })) }, null, 1));
  fs.writeFileSync(out + '.md', markdown(label, a, easy, meta, data));
  fs.unlinkSync(partial);
  console.log(`${a.games} games in ${meta.seconds}s | avg turns ${a.avgTurns} | types ${JSON.stringify(a.types)}`);
  a.rows.forEach(r => { const S = a.facStats[r.id]; console.log(`  ${r.id.padEnd(13)} overall ${pct(r.overall)}  ffa ${pct(r.ffa)}  duel ${pct(r.duel)}  | faith ${S.faithEarned} shrines ${S.shrinesBuilt} share ${pct(S.share)} fromRivals ${S.convertedFromRivals}`); });
  console.log(`  spread overall ${pct(a.spreadOverall)} ffa ${pct(a.spread3)} duel ${pct(a.spread2)}`);
  console.log('  seats: ' + Object.keys(a.seat).sort().map(k => k + ' ' + pct(a.seat[k].wins / a.seat[k].played)).join(', '));
  console.log('  least used powers: ' + a.powerRows.slice(-6).map(p => p.id + '=' + p.perGame).join(' '));
  console.log('  ai: ' + JSON.stringify(ai));
  if (easy) console.log(`  hard beats easy ${easy.hardWins}/${easy.games}`);
})();
