#!/usr/bin/env node
// Applies a small set of numeric balance edits to data/*.json (source of truth) and prints what changed.
//   node tools/tune.js '<json: [["domains","grain","effect.perFollower",0.08], ["shrines","fire_altar","pressure",1.25], ...]>'
const fs = require('fs'), path = require('path');
const edits = JSON.parse(process.argv[2]);
for (const [file, id, keyPath, value] of edits) {
  const p = path.join(__dirname, '..', 'data', file + '.json'), arr = JSON.parse(fs.readFileSync(p, 'utf8'));
  const o = file === 'rules' ? arr : arr.find(x => x.id === id); if (!o) throw new Error('no ' + file + ' ' + id);
  const ks = keyPath.split('.'); let t = o; for (let i = 0; i < ks.length - 1; i++) t = t[/^\d+$/.test(ks[i]) ? +ks[i] : ks[i]];
  const last = ks[ks.length - 1], before = t[last]; t[last] = value;
  console.log(file + ':' + id + '.' + keyPath + ' ' + JSON.stringify(before) + ' -> ' + JSON.stringify(value));
  fs.writeFileSync(p, JSON.stringify(arr, null, 1));
}
