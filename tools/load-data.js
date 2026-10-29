// Loads every JSON data file into one object (Node only).
const fs = require('fs'), path = require('path');
const FILES = ['rules', 'factions', 'domains', 'powers', 'shrines', 'events', 'terrain', 'sources'];
module.exports = function loadData(dir) {
  dir = dir || path.join(__dirname, '..', 'data');
  const d = {}; for (const f of FILES) d[f] = JSON.parse(fs.readFileSync(path.join(dir, f + '.json'), 'utf8'));
  return d;
};
module.exports.FILES = FILES;
