#!/usr/bin/env node
/*
 * Data schema validation and entity registry check (A002). Exits non-zero on any error so a broken data pack fails the build
 * instead of rendering fallbacks.   node tools/validate-data.js [dataDir]
 * Also used by tests/data.test.js through module.exports.validate(data).
 */
const path = require('path');
const ROSTER = ['greek', 'norse', 'egyptian', 'mesopotamian', 'irish', 'mexica', 'hittite', 'yoruba', 'japanese', 'vedic'];
const X = ['explore', 'expand', 'exploit', 'exterminate'];

function lum(hex) { const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

function validate(data, opts) {
  opts = opts || {};
  const errors = [], warn = [], E = require('../engine/engine.js'), AI = require('../engine/ai.js');
  const err = m => errors.push(m);
  const ids = new Set();
  const uniq = (kind, id) => { if (ids.has(kind + ':' + id)) err('duplicate ' + kind + ' id ' + id); ids.add(kind + ':' + id); if (!/^[a-z0-9_]+$/.test(id)) err(kind + ' id not ASCII-safe: ' + id); };
  const src = data.sources, cite = (who, list) => { if (!list || !list.length) err(who + ' cites no source'); (list || []).forEach(id => { const s = src[id]; if (!s) err(who + ' cites unknown source ' + id); else if (!/^https:\/\//.test(s.url)) err('source ' + id + ' is not https'); }); };
  // roster
  const fids = data.factions.map(f => f.id);
  if (fids.length !== 10) err('expected exactly 10 factions, found ' + fids.length);
  ROSTER.forEach(id => { if (fids.indexOf(id) < 0) err('locked roster faction missing: ' + id); });
  fids.forEach(id => { if (ROSTER.indexOf(id) < 0) err('faction not in the locked roster: ' + id); });
  const emblems = new Set(), shrines = new Set(), patterns = new Set(), secondaries = [];
  const art = opts.artIds || null;
  data.factions.forEach(f => {
    uniq('faction', f.id);
    ['name', 'tradition', 'deityTitle', 'emblem', 'shrine', 'blurb', 'pattern', 'atmosphere', 'priestStyle', 'motif'].forEach(k => { if (!f[k]) err(f.id + ' missing ' + k); });
    ['primary', 'secondary', 'accent', 'glow', 'dark'].forEach(k => { if (!/^#[0-9a-f]{6}$/i.test((f.palette || {})[k] || '')) err(f.id + ' palette.' + k + ' invalid'); });
    if (f.palette && contrast(f.palette.secondary, f.palette.dark) < 1.5 && contrast(f.palette.secondary, '#0c0e16') < 2) warn.push(f.id + ' secondary has low contrast on dark UI');
    if (emblems.has(f.emblem)) err('emblem reused: ' + f.emblem); emblems.add(f.emblem);
    if (shrines.has(f.shrine)) err('shrine reused: ' + f.shrine); shrines.add(f.shrine);
    if (patterns.has(f.pattern)) err('territory pattern reused: ' + f.pattern); patterns.add(f.pattern);
    secondaries.push(f.palette.secondary.toLowerCase());
    if (!f.domains || f.domains.length !== 4) err(f.id + ' must have 4 domains');
    if (!f.powers || f.powers.length !== 4) err(f.id + ' must have 4 powers');
    const xs = (f.powers || []).map(id => (data.powers.find(p => p.id === id) || {}).x).sort();
    if (JSON.stringify(xs) !== JSON.stringify(X.slice().sort())) err(f.id + ' powers must cover explore/expand/exploit/exterminate once each, got ' + xs.join(','));
    cite(f.id, f.sources);
    if (art) { if (art.emblems.indexOf(f.emblem) < 0) err(f.id + ': emblem ' + f.emblem + ' has no drawing in ui/art.js'); if (art.patterns.indexOf(f.pattern) < 0) err(f.id + ': pattern ' + f.pattern + ' has no drawing'); if (art.priests.indexOf(f.priestStyle) < 0) err(f.id + ': priest style ' + f.priestStyle + ' has no drawing'); if (art.atmospheres.indexOf(f.atmosphere) < 0) err(f.id + ': atmosphere ' + f.atmosphere + ' has no drawing'); }
  });
  if (new Set(secondaries).size !== secondaries.length) err('two factions share a territory colour');
  // domains
  if (data.domains.length !== 40) err('expected 40 domains, found ' + data.domains.length);
  data.domains.forEach(d => {
    uniq('domain', d.id);
    const f = data.factions.find(x => x.id === d.faction); if (!f || f.domains.indexOf(d.id) < 0) err('domain ' + d.id + ' not listed by its faction');
    if (!d.name || !d.text || !d.flavor) err('domain ' + d.id + ' needs name, text and flavor');
    const efs = d.effects || (d.effect ? [d.effect] : []); if (!efs.length) err('domain ' + d.id + ' has no effect');
    efs.forEach(ef => { if (E.DOMAIN_TYPES.indexOf(ef.type) < 0) err('domain ' + d.id + ' unknown effect ' + ef.type); Object.keys(ef).forEach(k => { const v = ef[k]; if (typeof v === 'number' && (!isFinite(v) || v < 0 || v > 50)) err('domain ' + d.id + '.' + k + ' out of range: ' + v); }); });
    cite('domain ' + d.id, d.sources);
  });
  // powers
  if (data.powers.length !== 40) err('expected 40 faction powers, found ' + data.powers.length);
  const icons = new Set(), vfx = new Set();
  data.powers.forEach(p => {
    uniq('power', p.id);
    const f = data.factions.find(x => x.id === p.faction); if (!f || f.powers.indexOf(p.id) < 0) err('power ' + p.id + ' not listed by its faction');
    if (X.indexOf(p.x) < 0) err('power ' + p.id + ' bad x ' + p.x);
    ['name', 'text', 'flavor', 'icon', 'vfx', 'inspiredBy'].forEach(k => { if (!p[k]) err('power ' + p.id + ' missing ' + k); });
    if (icons.has(p.icon)) err('power icon reused: ' + p.icon); icons.add(p.icon);
    if (vfx.has(p.vfx)) err('power vfx reused: ' + p.vfx); vfx.add(p.vfx);
    if (!p.cost || typeof p.cost.faith !== 'number' || typeof p.cost.favor !== 'number' || p.cost.faith < 0 || p.cost.favor < 0 || p.cost.favor > 15) err('power ' + p.id + ' bad cost');
    if (!(p.cooldown >= 1 && p.cooldown <= 10)) err('power ' + p.id + ' cooldown out of range');
    if (E.create && ['none', 'anyTile', 'nearKnown', 'ownShrine', 'revealedSettlement', 'ownSettlement', 'rivalShrine', 'shrineSite', 'contestedSettlement', 'rivalInfluenced', 'coastalShrineSite', 'linkedShrineSite'].indexOf(p.target) < 0) err('power ' + p.id + ' unknown target ' + p.target);
    (p.effects || []).forEach(ef => { if (E.EFFECT_TYPES.indexOf(ef.type) < 0) err('power ' + p.id + ' unknown effect ' + ef.type); if (AI.VALUED.indexOf(ef.type) < 0) err('power ' + p.id + ' effect ' + ef.type + ' has no AI valuation');
      Object.keys(ef).forEach(k => { const v = ef[k]; if (typeof v === 'number' && (!isFinite(v) || v < 0 || v > 20)) err('power ' + p.id + '.' + k + ' out of range: ' + v); }); });
    if (!p.effects || !p.effects.length) err('power ' + p.id + ' has no effects');
    cite('power ' + p.id, p.sources);
    if (art) { if (art.icons.indexOf(p.icon) < 0) err('power ' + p.id + ': icon ' + p.icon + ' has no drawing in ui/art.js'); if (art.vfx.indexOf(p.vfx) < 0) err('power ' + p.id + ': vfx ' + p.vfx + ' has no choreography in ui/render.js'); }
  });
  // shrines
  if (data.shrines.length !== 10) err('expected 10 shrine families, found ' + data.shrines.length);
  const arts = new Set();
  data.shrines.forEach(s => {
    uniq('shrine', s.id);
    if (!data.factions.find(f => f.shrine === s.id && f.id === s.faction)) err('shrine ' + s.id + ' not used by its faction');
    if (arts.has(s.art)) err('shrine art reused: ' + s.art); arts.add(s.art);
    ['faith', 'pressure', 'radius', 'ward', 'sight'].forEach(k => { if (!(typeof s[k] === 'number' && s[k] >= 0 && s[k] <= 6)) err('shrine ' + s.id + ' bad ' + k); });
    cite('shrine ' + s.id, s.sources);
    if (art && art.shrines.indexOf(s.art) < 0) err('shrine ' + s.id + ': art ' + s.art + ' has no draw path in ui/render.js');
  });
  // events
  data.events.forEach(e => { uniq('event', e.id); if (!e.title || !e.text || e.choices.length !== 2) err('event ' + e.id + ' malformed'); e.choices.forEach(c => c.effects.forEach(ef => { if (E.EFFECT_TYPES.indexOf(ef.type) < 0) err('event ' + e.id + ' unknown effect ' + ef.type); })); if (art && art.events.indexOf(e.art) < 0) err('event ' + e.id + ': art ' + e.art + ' has no illustration'); if (e.sources) cite('event ' + e.id, e.sources); });
  // scenarios
  (data.scenarios || []).forEach(s => { uniq('scenario', s.id); if (!s.objectives || !s.objectives.length) err('scenario ' + s.id + ' has no objectives'); s.players.forEach(p => { if (fids.indexOf(p.faction) < 0) err('scenario ' + s.id + ' unknown faction ' + p.faction); }); if (!(s.turns >= 10 && s.turns <= 45)) err('scenario ' + s.id + ' turns out of range'); });
  if ((data.scenarios || []).length < 6) err('expected at least 6 scenarios');
  // engine accepts it
  try { E.create(data); } catch (e) { err('engine rejected data: ' + e.message); }
  return { errors, warnings: warn };
}
/* The art registry, read from the shipped browser files in a sandbox (no canvas needed): every id the data names must have a drawing or choreography. */
function artIds() {
  const vm = require('vm'), fs = require('fs'), sb = {}; sb.self = sb; sb.Math = Math; sb.console = console;
  ['ui/art.js', 'ui/kits.js', 'ui/vfx-art.js', 'ui/terrain-art.js', 'ui/render.js'].forEach(f => vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sb, { filename: f }));
  return Object.assign({}, sb.PWArt.ids, { vfx: sb.PWRenderer.VFX_IDS });
}
module.exports = { validate, ROSTER, contrast, artIds };
if (require.main === module) {
  const data = require('./load-data.js')(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
  const r = validate(data, { artIds: artIds() });
  r.warnings.forEach(w => console.log('warning:', w));
  r.errors.forEach(e => console.log('ERROR:', e));
  console.log(r.errors.length ? 'FAIL (' + r.errors.length + ' errors)' : 'PASS: 10 factions, ' + data.domains.length + ' domains, ' + data.powers.length + ' powers, ' + data.shrines.length + ' shrines, ' + data.events.length + ' events, ' + (data.scenarios || []).length + ' scenarios');
  process.exit(r.errors.length ? 1 : 0);
}
