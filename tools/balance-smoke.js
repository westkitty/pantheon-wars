#!/usr/bin/env node
/*
 * Fast deterministic balance smoke test for CI. Runs a fixed-seed stratified sample through tools/simulate.js and checks
 * integrity, not balance quality: every pantheon plays, every game finishes, the AI never attempts an illegal action or needs a
 * forced end, and the Hierophant beats the Acolyte. The full 9000-game validation is a separate, manually run workflow.
 *   node tools/balance-smoke.js [--games 120] [--out dir]
 */
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const games = +arg('games', 120), outDir = arg('out', fs.mkdtempSync(path.join(os.tmpdir(), 'pw-smoke-'))), out = path.join(outDir, 'balance-smoke');
execFileSync(process.execPath, [path.join(__dirname, 'simulate.js'), '--games', String(games), '--seed', '9100', '--no-lookahead', '--easy-check', '40', '--label', 'ci-smoke', '--out', out], { stdio: 'inherit' });
const r = JSON.parse(fs.readFileSync(out + '.json', 'utf8')), a = r.analysis, ai = r.meta.ai, fails = [];
if (a.games !== games) fails.push('expected ' + games + ' games, got ' + a.games);
if (ai.illegal) fails.push('AI attempted ' + ai.illegal + ' illegal actions');
if (ai.forcedEnd) fails.push('AI needed ' + ai.forcedEnd + ' forced turn ends');
if (a.rows.length !== 10) fails.push('expected 10 pantheons in results, got ' + a.rows.length);
a.rows.forEach(row => { if (!(row.played > 0)) fails.push(row.id + ' never played'); });
r.games.forEach(g => { if (!g.type || !(g.turn >= 1 && g.turn <= 45)) fails.push('game seed ' + g.seed + ' did not finish properly'); });
if (r.easy && r.easy.hardWins / r.easy.games < 0.6) fails.push('Hierophant beat Acolyte only ' + r.easy.hardWins + '/' + r.easy.games);
console.log(fails.length ? 'BALANCE SMOKE FAIL\n- ' + fails.join('\n- ') : `BALANCE SMOKE PASS: ${a.games} games, 10 pantheons, 0 illegal AI actions, Hierophant ${r.easy.hardWins}/${r.easy.games} vs Acolyte (data ${r.meta.dataHash})`);
process.exit(fails.length ? 1 : 0);
