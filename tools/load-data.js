// Loads every JSON data file into one object (Node only).
const fs = require('fs'), path = require('path');
const FILES = ['rules', 'factions', 'domains', 'powers', 'shrines', 'events', 'terrain', 'sources', 'scenarios'];
module.exports = function loadData(dir) {
  dir = dir || path.join(__dirname, '..', 'data');
  const d = {}; for (const f of FILES) { const p = path.join(dir, f + '.json'); if (f === 'scenarios' && !fs.existsSync(p)) continue; d[f] = JSON.parse(fs.readFileSync(p, 'utf8')); }
  return d;
};
module.exports.FILES = FILES;
