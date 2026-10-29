/*
 * Pantheon Wars — versioned saves, exports and imports (P023, P024, A006). UMD: runs in the browser and in Node tests.
 * A save never stores live engine objects: it stores the match configuration and the canonical action log, plus integrity data.
 * Restoring re-simulates the actions through PWEngine.apply (validated) and checks the final state hash, so a restored game is exact,
 * or the restore fails with a reason. Checksums detect corruption; they are not a security measure.
 *
 * Record (schema 2):
 *   { format:'pantheon-wars-save', schema:2, kind:'save'|'challenge'|'chronicle', engine:'0.2.0', dataHash, created, label, session,
 *     cfg:{seed, players:[{faction,human,ai,name}], mode}, actions:[{p,a}], turn, over, finalHash, turnHashes:{turn:hash}, checksum }
 * Legacy: a v0.1 record { seed, players, actions[, hash] } (as written by tools/screenshots.js) is recognised and replayed by the
 * frozen v0.1 engine in read-only mode; its hash is checked against the recorded hash when present.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PWStorage = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var FORMAT = 'pantheon-wars-save', SCHEMA = 2, PREFIX = 'pw.save.', MAX_BYTES = 900000;
  function fnv(str) { var h = 2166136261 >>> 0; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return ('00000000' + h.toString(16)).slice(-8); }
  function stable(o) { return JSON.stringify(o); }
  function dataHash(data) { return fnv(stable(data)); }
  function body(rec) { var c = {}; Object.keys(rec).forEach(function (k) { if (k !== 'checksum') c[k] = rec[k]; }); return c; }

  function makeRecord(E, state, info) {
    info = info || {};
    var rec = {
      format: FORMAT, schema: SCHEMA, kind: info.kind || 'save', engine: E.version, dataHash: dataHash(E.data), created: info.created || new Date().toISOString(),
      label: info.label || '', session: info.session || null,
      cfg: { seed: state.seed, players: state.players.map(function (p) { var o = { faction: p.faction, human: !!p.human, ai: p.ai }; if (p.name !== E.D.factions[p.faction].name) o.name = p.name; return o; }), mode: info.mode || state.mode || { kind: 'standard' } },
      actions: state.actions.map(function (x) { return { p: x.p, a: x.a }; }), turn: state.turn, over: !!state.over, finalHash: E.hash(state), turnHashes: info.turnHashes || {}
    };
    // the engine stores the normalised mode; keep only what newGame needs
    if (rec.cfg.mode && rec.cfg.mode.kind === 'scenario') rec.cfg.mode = { kind: 'scenario', scenario: rec.cfg.mode.scenario };
    else if (rec.cfg.mode && rec.cfg.mode.kind === 'alt') rec.cfg.mode = { kind: 'alt', victory: rec.cfg.mode.victory };
    else rec.cfg.mode = rec.cfg.mode && rec.cfg.mode.allowMirror ? { kind: 'standard', allowMirror: true } : { kind: 'standard' };
    rec.checksum = fnv(stable(body(rec)));
    return rec;
  }
  function isLegacy(rec) { return rec && !rec.format && typeof rec.seed !== 'undefined' && Array.isArray(rec.players) && Array.isArray(rec.actions); }

  /* Validate shape and integrity without running the game. Returns null or a human-readable reason. */
  function check(rec, E) {
    if (!rec || typeof rec !== 'object') return 'not a Pantheon Wars file';
    if (isLegacy(rec)) return null;
    if (rec.format !== FORMAT) return 'not a Pantheon Wars save';
    if (rec.schema > SCHEMA) return 'this save was written by a newer version (schema ' + rec.schema + ')';
    if (rec.schema < 2) return 'unsupported save schema ' + rec.schema;
    if (rec.checksum !== fnv(stable(body(rec)))) return 'the file is damaged (checksum mismatch)';
    if (!rec.cfg || !Array.isArray(rec.cfg.players) || rec.cfg.players.length < 2 || rec.cfg.players.length > 3) return 'the file has no valid player list';
    if (!Array.isArray(rec.actions)) return 'the file has no action log';
    if (E) {
      for (var i = 0; i < rec.cfg.players.length; i++) if (!E.D.factions[rec.cfg.players[i].faction]) return 'unknown pantheon ' + rec.cfg.players[i].faction;
      if (String(rec.engine).split('.').slice(0, 2).join('.') !== String(E.version).split('.').slice(0, 2).join('.')) return 'engine ' + rec.engine + ' saves cannot be replayed by engine ' + E.version;
    }
    return null;
  }
  /* Rebuild the exact game. opts.upto: stop after this many actions (chronicle). Returns {state} or {error, at}. */
  function restore(E, rec, opts) {
    opts = opts || {};
    var err = check(rec, E); if (err) return { error: err };
    if (isLegacy(rec)) return { error: 'legacy v0.1 replay: open it with restoreLegacy', legacy: true };
    var state;
    try { state = E.newGame({ seed: rec.cfg.seed, players: rec.cfg.players, mode: rec.cfg.mode }); } catch (e) { return { error: 'cannot start this match: ' + e.message }; }
    var n = opts.upto === undefined ? rec.actions.length : Math.min(opts.upto, rec.actions.length);
    for (var i = 0; i < n; i++) {
      var x = rec.actions[i];
      if (!x || typeof x.a !== 'object' || x.p !== state.current) return { error: 'action ' + (i + 1) + ' belongs to the wrong god', at: i };
      var e2 = E.apply(state, x.a); if (e2) return { error: 'action ' + (i + 1) + ' is illegal here: ' + e2, at: i };
    }
    if (opts.upto === undefined && rec.finalHash && E.hash(state) !== rec.finalHash) {
      if (rec.dataHash && rec.dataHash !== dataHash(E.data)) return { error: 'the rules data changed since this save (data ' + rec.dataHash + ' vs ' + dataHash(E.data) + '); the replay no longer matches', state: state, mismatch: true };
      return { error: 'replay hash mismatch: expected ' + rec.finalHash + ', got ' + E.hash(state), state: state, mismatch: true };
    }
    return { state: state };
  }
  function restoreLegacy(L, rec) {
    var state = L.newGame({ seed: rec.seed, players: rec.players });
    for (var i = 0; i < rec.actions.length; i++) { var e = L.apply(state, rec.actions[i].a); if (e) return { error: 'legacy action ' + (i + 1) + ' is illegal: ' + e, at: i }; }
    if (rec.hash && L.hash(state) !== rec.hash) return { error: 'legacy hash mismatch: expected ' + rec.hash + ', got ' + L.hash(state), state: state };
    return { state: state, legacy: true };
  }

  /* ---------------- slots (browser localStorage, or any object with getItem/setItem/removeItem) */
  function Store(ls, session) { this.ls = ls; this.session = session || ('s' + Math.floor(Math.random() * 1e9).toString(36)); this.loadedAt = Date.now(); }
  Store.prototype.slots = function () { return ['auto', 'slot1', 'slot2', 'slot3']; };
  Store.prototype.read = function (slot) {
    var raw = null; try { raw = this.ls.getItem(PREFIX + slot); } catch (e) { return { error: 'storage is not available (' + e.message + ')' }; }
    if (!raw) return { empty: true };
    var rec; try { rec = JSON.parse(raw); } catch (e) { return this.readBackup(slot, 'the save is damaged (not valid JSON)'); }
    var err = check(rec); if (err) return this.readBackup(slot, err);
    return { record: rec };
  };
  Store.prototype.readBackup = function (slot, why) {
    var raw = null; try { raw = this.ls.getItem(PREFIX + slot + '.bak'); } catch (e) { raw = null; }
    if (raw) { try { var rec = JSON.parse(raw); if (!check(rec)) return { record: rec, recovered: true, warning: why + '; the previous copy was recovered' }; } catch (e) { /* fall through */ } }
    return { error: why, damaged: true };
  };
  /* Atomic write: stage to .tmp, verify it parses and checks, keep the previous good copy as .bak, then promote. Never destroys a usable save. */
  Store.prototype.write = function (slot, rec, opts) {
    opts = opts || {};
    var raw = JSON.stringify(rec);
    if (raw.length > MAX_BYTES) return { error: 'the save is too large (' + raw.length + ' bytes)' };
    var existing = this.read(slot);
    if (!opts.force && existing.record && existing.record.session && existing.record.session !== this.session && Date.parse(existing.record.created) > this.loadedAt) {
      if (slot === 'auto') { slot = 'auto.' + this.session; } else return { conflict: true, error: 'another tab saved to this slot after this game was opened' };
    }
    try {
      this.ls.setItem(PREFIX + slot + '.tmp', raw);
      var back = JSON.parse(this.ls.getItem(PREFIX + slot + '.tmp')); if (check(back)) throw new Error('staged copy failed its check');
      var prev = this.ls.getItem(PREFIX + slot); if (prev) this.ls.setItem(PREFIX + slot + '.bak', prev);
      this.ls.setItem(PREFIX + slot, raw); this.ls.removeItem(PREFIX + slot + '.tmp');
    } catch (e) {
      try { this.ls.removeItem(PREFIX + slot + '.tmp'); } catch (e2) { /* ignore */ }
      return { error: /quota/i.test(e.name + e.message) ? 'browser storage is full; export the game to a file instead' : 'could not save: ' + e.message };
    }
    return { ok: true, slot: slot, bytes: raw.length };
  };
  Store.prototype.remove = function (slot) { try { this.ls.removeItem(PREFIX + slot); this.ls.removeItem(PREFIX + slot + '.bak'); } catch (e) { return { error: e.message }; } return { ok: true }; };
  Store.prototype.summary = function (slot) { var r = this.read(slot); if (!r.record) return r; var x = r.record; return { slot: slot, label: x.label, created: x.created, turn: x.turn, over: x.over, players: (x.cfg || {}).players || x.players, mode: (x.cfg || {}).mode, recovered: r.recovered, warning: r.warning }; };

  function exportName(rec) { var f = (rec.cfg ? rec.cfg.players : rec.players).map(function (p) { return p.faction; }).join('-'); return 'pantheon-wars-' + (rec.kind || 'save') + '-seed' + (rec.cfg ? rec.cfg.seed : rec.seed) + '-' + f + '-t' + (rec.turn || 0) + '.json'; }
  function parseImport(text) { var rec; try { rec = JSON.parse(text); } catch (e) { return { error: 'the file is not valid JSON' }; } var err = check(rec); if (err) return { error: err }; return { record: rec, legacy: isLegacy(rec) }; }
  /* Short shareable challenge string (P024): base64 of the compact JSON; only offered when it stays short. */
  function challengeCode(rec) { var s = JSON.stringify({ s: rec.cfg.seed, p: rec.cfg.players.map(function (p) { return [p.faction, p.human ? 1 : 0, p.ai === 'easy' ? 0 : 1]; }), m: rec.cfg.mode }); return typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, 'utf8').toString('base64'); }
  function readChallengeCode(code) { try { var s = typeof atob === 'function' ? decodeURIComponent(escape(atob(code))) : Buffer.from(code, 'base64').toString('utf8'); var o = JSON.parse(s); return { seed: o.s, players: o.p.map(function (x) { return { faction: x[0], human: !!x[1], ai: x[2] ? 'hard' : 'easy' }; }), mode: o.m || { kind: 'standard' } }; } catch (e) { return null; } }

  return { FORMAT: FORMAT, SCHEMA: SCHEMA, fnv: fnv, dataHash: dataHash, makeRecord: makeRecord, check: check, restore: restore, restoreLegacy: restoreLegacy, isLegacy: isLegacy, Store: Store, exportName: exportName, parseImport: parseImport, challengeCode: challengeCode, readChallengeCode: readChallengeCode };
});
