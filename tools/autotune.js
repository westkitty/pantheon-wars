#!/usr/bin/env node
/*
 * Bounded, logged balance calibration (P001). Each iteration runs a fixed-seed stratified sample with tools/simulate.js (greedy AI for
 * speed), then moves ONE lever per pantheon — its shrine `pressure` — toward equal overall win rates:
 *     pressure *= 1 + gain * (meanRate - factionRate), clamped to [min, max] and to ±maxStep per iteration.
 * Every change is appended to reports/autotune-log.md. The data files remain the source of truth.
 *   node tools/autotune.js --iters 4 --games 600 --seed 7000 --gain 0.9 [--min 0.9 --max 1.7 --max-step 0.12]
 */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ITERS = +arg('iters', 4), GAMES = +arg('games', 600), SEED = +arg('seed', 7000), GAIN = +arg('gain', 0.9), MIN = +arg('min', 0.9), MAX = +arg('max', 1.7), STEP = +arg('max-step', 0.12);
const ROOT = path.join(__dirname, '..'), shrinesPath = path.join(ROOT, 'data', 'shrines.json'), factions = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'factions.json')));
const logPath = path.join(ROOT, 'reports', 'autotune-log.md'), tmp = path.join(require('os').tmpdir(), 'pw-autotune');
fs.mkdirSync(path.dirname(logPath), { recursive: true });
let log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '# Balance calibration log\n\nEach block is one `tools/autotune.js` iteration: measured overall win rate per pantheon (fixed-seed stratified sample, greedy AI), then the shrine-pressure change applied.\n';
log += `\n## Run ${new Date().toISOString()} — iters ${ITERS}, games ${GAMES}, seed ${SEED}, gain ${GAIN}, bounds [${MIN}, ${MAX}], max step ${STEP}\n`;
for (let it = 0; it < ITERS; it++) {
  execFileSync('node', [path.join(__dirname, 'simulate.js'), '--games', String(GAMES), '--seed', String(SEED), '--label', 'autotune', '--easy-check', '0', '--no-lookahead', '--out', tmp], { stdio: 'ignore' });
  const a = JSON.parse(fs.readFileSync(tmp + '.json')).analysis, mean = a.rows.reduce((s, r) => s + r.overall, 0) / a.rows.length;
  const sh = JSON.parse(fs.readFileSync(shrinesPath));
  log += `\n### Iteration ${it + 1}: spread overall ${(100 * a.spreadOverall).toFixed(1)}, FFA ${(100 * a.spread3).toFixed(1)}, duel ${(100 * a.spread2).toFixed(1)} points\n\n| Pantheon | Overall | FFA | Duel | Pressure before → after |\n|---|---|---|---|---|\n`;
  a.rows.forEach(r => {
    const s = sh.find(x => x.id === factions.find(f => f.id === r.id).shrine), before = s.pressure;
    let next = before * (1 + GAIN * (mean - r.overall)); next = Math.max(before - STEP, Math.min(before + STEP, next)); next = Math.round(Math.max(MIN, Math.min(MAX, next)) * 100) / 100;
    s.pressure = next;
    log += `| ${r.id} | ${(100 * r.overall).toFixed(1)}% | ${(100 * r.ffa).toFixed(1)}% | ${(100 * r.duel).toFixed(1)}% | ${before} → ${next} |\n`;
  });
  fs.writeFileSync(shrinesPath, JSON.stringify(sh, null, 1));
  console.log(`iteration ${it + 1}: spread overall ${(100 * a.spreadOverall).toFixed(1)} ffa ${(100 * a.spread3).toFixed(1)} duel ${(100 * a.spread2).toFixed(1)}`);
  fs.writeFileSync(logPath, log);
}
