#!/usr/bin/env node
// Lists every numeric/text change between two data directories (default: reports/data-before vs data/). Usage: node tools/diff-data.js [before] [after]
const path = require('path'), loadData = require('./load-data.js');
const a = loadData(path.resolve(process.argv[2] || path.join(__dirname, '..', 'reports', 'data-before'))), b = loadData(process.argv[3] ? path.resolve(process.argv[3]) : undefined);
const out = [];
function walk(x, y, p) {
  if (Array.isArray(x) && Array.isArray(y) && x.length && x[0] && x[0].id) { const m = {}; x.forEach(o => m[o.id] = o); y.forEach(o => walk(m[o.id], o, p + '.' + o.id)); return; }
  if (x && y && typeof x === 'object' && typeof y === 'object') { new Set([...Object.keys(x), ...Object.keys(y)]).forEach(k => walk(x[k], y[k], p + '.' + k)); return; }
  if (JSON.stringify(x) !== JSON.stringify(y)) out.push('- `' + p.slice(1) + '`: ' + JSON.stringify(x) + ' → ' + JSON.stringify(y));
}
walk(a, b, '');
console.log(out.join('\n'));
