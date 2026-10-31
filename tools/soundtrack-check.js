#!/usr/bin/env node
/*
 * Recorded-soundtrack checks in the real page (Playwright + the pre-installed Chromium), over file:// and local HTTP.
 * Needs the private local recordings in audio/music/ (tools/prepare-soundtrack.js); without them it checks only the fallback and
 * reports the recordings as absent. Music time is advanced through the director's own clock (PW.music.now), never the game's.
 *   node tools/soundtrack-check.js [--http] [--out reports/soundtrack-check.json]
 */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..'), HTTP = process.argv.includes('--http');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = path.resolve(arg('out', path.join(ROOT, 'reports', HTTP ? 'soundtrack-check-http.json' : 'soundtrack-check-file.json')));
const MANIFEST = JSON.parse(fs.readFileSync(path.join(ROOT, 'audio', 'soundtrack.json'), 'utf8'));
const HAVE_FILES = MANIFEST.tracks.every(t => fs.existsSync(path.join(ROOT, t.file)));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.mp3': 'audio/mpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

function serve() { // static server with byte ranges (media elements seek with Range requests)
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      const size = fs.statSync(f).size, type = TYPES[path.extname(f)] || 'application/octet-stream', m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
      if (m) { const a = m[1] ? +m[1] : 0, b = m[2] ? +m[2] : size - 1; rsp.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': b - a + 1, 'Accept-Ranges': 'bytes' }); fs.createReadStream(f, { start: a, end: b }).pipe(rsp); }
      else { rsp.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' }); fs.createReadStream(f).pipe(rsp); }
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

const checks = [];
function check(name, ok, evidence) { checks.push({ name, ok: !!ok, evidence }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (evidence !== undefined ? '  ' + JSON.stringify(evidence).slice(0, 220) : '')); }

(async () => {
  const srv = HTTP ? await serve() : null, base = HTTP ? `http://127.0.0.1:${srv.address().port}/` : 'file://' + ROOT + '/';
  const browser = await chromium.launch({ args: ['--autoplay-policy=user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/audio\/music|ERR_FILE_NOT_FOUND|404/.test(m.text())) errors.push('console: ' + m.text()); });
  const st = () => page.evaluate(() => PW.music.status());
  const adv = s => page.evaluate(s => { window.__off += s; PW.music.tick(0.1); }, s);
  const playing = async (ms) => { // a deck that is not paused and whose time advances is audibly playing
    const a = await st(); await page.waitForTimeout(ms || 700); const b = await st();
    const d0 = a.decks.find(d => !d.leaving), d1 = b.decks.find(d => !d.leaving);
    return { id: d1 && d1.id, paused: d1 ? d1.paused : null, advanced: !!(d0 && d1 && d0.id === d1.id && d1.t > d0.t), volume: d1 && d1.volume };
  };
  const loadPage = async (q) => {
    await page.goto(base + 'index.html?speed=0&follow=0' + (q || ''));
    await page.waitForFunction(() => window.PW && PW.music);
    await page.evaluate(() => { window.__off = 0; PW.music.now = () => Date.now() / 1000 + window.__off; });
  };
  const start = (faction, humans) => page.evaluate(([f, h]) => { PW.choice.faction = f; PW.choice.humans = h || 1; PW.start(PW.buildConfig()); }, [faction, humans]);
  const settle = () => page.evaluate(() => { PW.music.tick(0.1); });

  try {
    await page.goto('about:blank');
    // 1. every recording loads and decodes in this browser (element metadata over both protocols; full decode where fetch is allowed)
    await loadPage('');
    check('manifest present in page (audio/soundtrack.js)', await page.evaluate(() => !!window.PW_SOUNDTRACK && PW_SOUNDTRACK.tracks.length === 20), 20);
    if (HAVE_FILES) {
      const loads = await page.evaluate(async (http) => {
        const out = [];
        for (const t of PW_SOUNDTRACK.tracks) {
          const r = await new Promise(res => { const el = new Audio(); el.preload = 'metadata'; el.onloadedmetadata = () => { res({ ok: true, dur: el.duration }); el.removeAttribute('src'); el.load(); }; el.onerror = () => res({ ok: false, err: el.error && el.error.code }); el.src = t.file; });
          if (http && r.ok) { try { const buf = await (await fetch(t.file)).arrayBuffer(); const ac = new OfflineAudioContext(2, 48000, 48000); const ab = await ac.decodeAudioData(buf); r.decoded = +ab.duration.toFixed(2); r.sr = ab.sampleRate; r.ch = ab.numberOfChannels; } catch (e) { r.decodeErr = e.message; } }
          r.id = t.id; r.want = t.durationS; out.push(r);
        }
        return out;
      }, HTTP);
      const bad = loads.filter(r => !r.ok || Math.abs(r.dur - r.want) > 0.2 || (HTTP && (!r.decoded || Math.abs(r.decoded - r.want) > 0.2)));
      check('all 20 recordings load' + (HTTP ? ' and fully decode (decodeAudioData)' : ' (media element metadata)') + ' with the manifest duration ±0.2 s', bad.length === 0, bad.length ? bad : loads.map(r => r.id + ':' + (r.decoded || r.dur.toFixed(2))));
    } else check('recordings absent locally: recorded checks skipped, fallback checked', true, 'audio/music/ missing');

    // 2. no playback before a gesture; the title theme starts on the first click
    let s = await st();
    check('title: nothing plays or downloads before the first gesture (autoplay rules)', s.decks.length === 0 && s.mood === 'title' && !(await page.evaluate(() => PW.audio.ready)), s.decks);
    await page.mouse.click(5, 5); await page.waitForTimeout(400); await settle();
    if (HAVE_FILES) {
      const p = await playing(900); s = await st();
      check('title: a Main Title take plays after the first click', /^title-/.test(p.id) && p.advanced && !p.paused && p.volume > 0, p);
    }

    // 3. settings persistence (volumes, mute, soundtrack mode) across reload
    await page.evaluate(() => { PW.openSettings(); document.querySelector('#soundtrack-seg [data-st=procedural]').click(); });
    s = await st();
    check('setting "Generated" stops the recordings and returns the procedural score', s.mode === 'procedural' && s.decks.filter(d => !d.leaving).length === 0, s);
    await page.evaluate(() => { const r = document.getElementById('vol-music'); r.value = 37; r.oninput(); });
    await loadPage('');
    const persisted = await page.evaluate(() => ({ st: PW.settings.audio.soundtrack, music: PW.settings.audio.music, mode: PW.music.mode }));
    check('soundtrack mode and music volume persist across reload', persisted.st === 'procedural' && persisted.mode === 'procedural' && persisted.music === 0.37, persisted);
    await page.evaluate(() => { PW.openSettings(); document.querySelector('#soundtrack-seg [data-st=recorded]').click(); const r = document.getElementById('vol-music'); r.value = 50; r.oninput(); document.getElementById('settings').hidden = true; });
    await page.mouse.click(5, 5);

    if (HAVE_FILES) {
      // 4. faction themes, and the procedural motif for pantheons without a recording
      for (const [f, want] of [['greek', 'olympian'], ['norse', 'ash'], ['egyptian', 'ennead']]) {
        await start(f); await settle(); const p = await playing(800);
        check('game start (' + f + '): its faction theme plays', p.id && p.id.startsWith(want) && p.advanced, p);
      }
      await start('mexica'); await settle(); s = await st();
      check('game start (mexica, no recording): procedural motif holds the bed, no recording plays', s.procedural && s.decks.filter(d => !d.leaving).length === 0 && s.mood === 'faction', { mood: s.mood, procedural: s.procedural, decks: s.decks });
      await adv(46); s = await st();
      check('after its intro window the Dawn bed (Map Exploration) takes over', s.mood === 'exploration' && s.decks.some(d => !d.leaving && d.cue === 'exploration') && !s.procedural, { mood: s.mood, decks: s.decks.map(d => d.id) });

      // 5. ages
      await page.evaluate(() => PW.music.setAge('zenith')); await adv(25); s = await st();
      check('Zenith: Expansion bed', s.mood === 'expansion' && s.decks.some(d => !d.leaving && d.cue === 'expansion'), s.mood);
      await page.evaluate(() => PW.music.setAge('twilight')); await adv(25); s = await st();
      check('Twilight: Twilight & Legacy bed', s.mood === 'twilight' && s.decks.some(d => !d.leaving && d.id === 'twilight'), s.mood);
      await page.evaluate(() => PW.music.setAge('dawn')); await adv(25);

      // 6. growth -> expansion in the Dawn
      await page.evaluate(() => { const v = PW.app.viewer, t = PW.state.turn; PW.music.signal({ k: 'shrine', p: v, x: {} }, { viewer: v, turn: t }); PW.music.signal({ k: 'growth', p: v, x: {} }, { viewer: v, turn: t }); });
      await adv(21); s = await st();
      check('Dawn + the viewer\'s own growth: Expansion bed (after the Dawn bed\'s 20 s minimum)', s.mood === 'expansion', { mood: s.mood, signals: s.signals });

      // 7. conflict with hysteresis and its minimum duration
      await page.evaluate(() => { const v = PW.app.viewer, t = PW.state.turn; PW.music.signal({ k: 'threat', p: 1, x: { owner: v } }, { viewer: v, turn: t }); });
      await adv(1); s = await st();
      check('a threat to the viewer\'s shrine: Strategic Conflict', s.mood === 'conflict' && s.decks.some(d => !d.leaving && d.cue === 'conflict'), s.mood);
      await page.evaluate(() => { const v = PW.app.viewer, t = PW.state.turn; PW.music.signal({ k: 'threat', p: 1, x: { owner: 1 - v + 5 } }, { viewer: v, turn: t + 1 }); });
      await adv(10); s = await st();
      check('conflict holds while pressure decays above the exit level and inside its 60 s minimum', s.mood === 'conflict', s.signals.pressure);
      await page.evaluate(() => { const v = PW.app.viewer, t = PW.state.turn; PW.music.signal({ k: 'counter', p: 1, x: {} }, { viewer: v, turn: t + 3 }); PW.music.signal({ k: 'shrine', p: 1, x: {} }, { viewer: v, turn: t + 5 }); });
      await adv(61); s = await st();
      check('conflict leaves once pressure falls below 1 and 60 s have passed', s.mood !== 'conflict', { mood: s.mood, pressure: s.signals.pressure });

      // 8. omens: temporary, at least 45 s
      await page.evaluate(() => { const v = PW.app.viewer; PW.music.signal({ k: 'card', p: v, x: {} }, { viewer: v, turn: PW.state.turn + 6 }); });
      await adv(1); s = await st();
      check('an event card drawn by the viewer: Divine Omens', s.mood === 'omens' && s.decks.some(d => !d.leaving && d.cue === 'omens'), s.mood);
      await adv(30); s = await st(); const midOmen = s.mood;
      await adv(20); s = await st();
      check('omens last at least 45 s, then return to the age bed', midOmen === 'omens' && s.mood !== 'omens', { at31: midOmen, at51: s.mood });

      // 9. a single miracle: accent over the ducked bed; the bed is neither restarted nor replaced
      await adv(25); await settle(); await page.waitForTimeout(600);
      const before = (await st()).decks.find(d => !d.leaving);
      await page.evaluate(() => { const v = PW.app.viewer; PW.music.signal({ k: 'power', p: v, x: { power: 'thunderbolt' } }, { viewer: v, turn: PW.state.turn + 20 }); });
      await page.waitForTimeout(1600); s = await st(); const after = s.decks.find(d => !d.leaving);
      check('one miracle: accent plays, bed ducked, same bed continues (not restarted)', s.accent && s.duck < 0.5 && after && before && after.id === before.id && after.t > before.t, { before, after, accent: s.accent, duck: s.duck });
      await page.evaluate(() => { const v = PW.app.viewer; PW.music.signal({ k: 'power', p: v, x: { power: 'thunderbolt' } }, { viewer: v, turn: PW.state.turn + 20 }); });
      s = await st(); check('accent cooldown: a second miracle within 25 s adds no second accent', s.history.filter(h => h.cue === 'accent').length === 1, s.history.filter(h => h.cue === 'accent'));
      // three miracles in two turns: sustained intervention bed
      await page.evaluate(() => { const v = PW.app.viewer, t = PW.state.turn + 21; [0, 1].forEach(() => PW.music.signal({ k: 'power', p: v, x: {} }, { viewer: v, turn: t })); });
      await adv(1); s = await st();
      check('three miracles within two turns: Divine Intervention as the bed', s.mood === 'intervention' && s.decks.some(d => !d.leaving && d.cue === 'intervention'), s.mood);
      await adv(65); await page.waitForTimeout(5000);
      await page.waitForFunction(() => PW.music.decks.length === 1 && PW.music.decks[0].el.readyState >= 1, null, { timeout: 20000 });

      // 10. through-composed continuation: at the out point the bed crossfades into the alternate take
      s = await st(); const cur = s.decks.find(d => !d.leaving), tr = MANIFEST.tracks.find(t => t.id === cur.id);
      await page.evaluate(([id, t]) => { const d = PW.music.decks.find(x => x.id === id && !x.leaving); d.el.currentTime = t; }, [cur.id, tr.out - 0.5]);
      await page.waitForTimeout(1500); s = await st();
      const nxt = s.decks.find(d => !d.leaving);
      check('at the out point (' + cur.id + ' @' + tr.out + ' s) the bed crossfades to ' + (tr.alternate || 'its own body'), nxt && nxt.id === (tr.alternate || cur.id) && s.decks.length <= 2, s.decks);
      await page.waitForTimeout(4600); s = await st();
      check('after the crossfade one deck remains (no overlapping tracks)', s.decks.length === 1 && !s.decks[0].leaving, s.decks);

      // 11. mute, zero music volume, tab hidden and restore
      await page.evaluate(() => { document.getElementById('vol-mute').checked = true; PW.openSettings(); const m = document.getElementById('vol-mute'); m.checked = true; m.onchange(); }); s = await st();
      check('mute pauses the recording (nothing plays while muted)', s.decks.every(d => d.paused), s.decks);
      await page.evaluate(() => { const m = document.getElementById('vol-mute'); m.checked = false; m.onchange(); }); await page.waitForTimeout(500); s = await st();
      check('unmute resumes the same bed', s.decks.some(d => !d.paused), s.decks);
      await page.evaluate(() => { const r = document.getElementById('vol-music'); r.value = 0; r.oninput(); }); s = await st();
      check('music volume 0 pauses the recording', s.decks.every(d => d.paused), s.decks);
      await page.evaluate(() => { const r = document.getElementById('vol-music'); r.value = 50; r.oninput(); document.getElementById('settings').hidden = true; });
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }); s = await st();
      check('tab hidden: playback paused and the timer stopped', s.decks.every(d => d.paused) && !s.timer, { timer: s.timer, decks: s.decks });
      await page.waitForTimeout(500); s = await st(); check('while hidden nothing restarts', s.decks.every(d => d.paused), s.decks);
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); }); await page.waitForTimeout(500); s = await st();
      check('tab restored: the bed that was playing resumes (and nothing else)', s.decks.length === 1 && !s.decks[0].paused && s.timer, s.decks);

      // 12. end of game: Endgame Resolution plays once after the victory/defeat cue
      await page.evaluate(() => PW.music.gameOver()); await adv(0.1); await page.waitForTimeout(800); s = await st();
      check('game over: Endgame Resolution plays', s.mood === 'end' && s.decks.some(d => !d.leaving && d.id === 'endgame' && !d.paused), s.decks);
      await page.evaluate(() => { const d = PW.music.decks.find(x => x.id === 'endgame'); d.el.currentTime = d.el.duration - 0.4; }); await page.waitForTimeout(1500); s = await st();
      check('Endgame plays once: no restart or continuation after it ends', s.endPlayed && s.decks.filter(d => !d.leaving).length === 0 && s.history.filter(h => h.id === 'endgame').length === 1, { decks: s.decks, mood: s.mood, endPlayed: s.endPlayed });

      // 13. hot-seat: the covered screen hears only the public age bed; each god's signals are kept apart
      await page.evaluate(() => { PW.choice.faction = 'greek'; PW.choice.humans = 2; PW.start(PW.buildConfig()); });
      await page.evaluate(() => { const v = PW.app.viewer; PW.music.signal({ k: 'threat', p: 1, x: { owner: v } }, { viewer: v, turn: PW.state.turn }); });
      await adv(1); const first = (await st()).mood;
      await page.evaluate(() => PW.endTurn());
      await page.waitForFunction(() => PW.app.handoff || (PW.state.current === PW.app.viewer && !PW.busy()), null, { timeout: 60000 });
      s = await st(); const covered = await page.evaluate(() => PW.app.handoff);
      check('hot-seat: while the screen is covered the bed is the public age mood, not the previous god\'s conflict', first === 'conflict' && covered && s.frozen && ['exploration', 'expansion', 'twilight'].includes(s.mood), { first, covered, mood: s.mood, frozen: s.frozen });
      await page.evaluate(() => { const v = PW.app.viewer; PW.music.signal({ k: 'threat', p: 1, x: { owner: v } }, { viewer: v, turn: PW.state.turn }); }); await adv(1);
      s = await st(); check('hot-seat: signals are ignored while covered', s.mood !== 'conflict', s.mood);
      await page.evaluate(() => document.getElementById('handoff-go').click()); await adv(1); s = await st();
      const vw = await page.evaluate(() => ({ viewer: PW.app.viewer, faction: PW.state.players[PW.app.viewer].faction }));
      check('hot-seat: the next god hears their own state (their faction intro, no inherited conflict)', s.viewer === vw.viewer && s.mood !== 'conflict' && s.signals.pressure === 0, { vw, mood: s.mood, signals: s.signals });

      // 14. a real AI-driven game feeds the director from the log (not synthetic signals)
      await loadPage('&seed=7'); await page.mouse.click(5, 5);
      await page.evaluate(() => { PW.choice.faction = 'norse'; PW.choice.humans = 1; PW.choice.rivals = 2; PW.start(PW.buildConfig()); });
      const seen = new Set(), moods = new Set();
      for (let i = 0; i < 40; i++) {
        await page.waitForFunction(() => PW.state.over || (!PW.busy() && PW.state.current === PW.app.viewer), null, { timeout: 120000 });
        const r = await page.evaluate(() => { const s = PW.state; if (s.over) return { over: true }; if (s.players[PW.app.viewer].pendingEvent) { const a = PW.suggest(); if (a) PW.act(a); document.getElementById('event').hidden = true; }
          for (let k = 0; k < 6; k++) { const a = PW.suggest(); if (!a || a.type === 'endTurn' || !PW.act(a)) break; } PW.endTurn(); return { turn: s.turn }; });
        await adv(20); const ss = await st(); moods.add(ss.mood); ss.history.forEach(h => seen.add(h.cue));
        if (r.over) break;
      }
      s = await st();
      check('a played game (norse vs two AI, 40 turns) moves the music through several moods from real log entries', moods.size >= 3, { moods: [...moods], cues: [...seen] });

      // 15. missing recordings: silent fallback to the procedural score, no page errors
      const fb = await page.evaluate(async () => {
        const m = new PWMusic(PW.audio, PW_SOUNDTRACK, { base: 'no-such-folder/' }); m.title(); await new Promise(r => setTimeout(r, 1500)); const s = m.status(); m.stop(); return s;
      });
      check('missing files: every take marks missing, the director falls back, no exception', fb.missing.length >= 2 && fb.decks.length === 0, { missing: fb.missing });
    }

    // 16. cleanup: back to the title, then stop -> no timers, no live elements
    await page.evaluate(() => { PW.app.state && document.getElementById('vic-new') && PW.music.title(); PW.music.stop(); }); s = await st();
    check('stop releases every element and clears the timer', s.decks.length === 0 && !s.timer && !s.accent, s);
    check('no page errors', errors.length === 0, errors);
  } catch (e) { check('harness', false, String(e.stack || e).split('\n').slice(0, 3)); }
  await browser.close(); if (srv) srv.close();
  const rep = { protocol: HTTP ? 'http' : 'file', recordings: HAVE_FILES, browser: 'Chromium (Playwright ' + require('playwright/package.json').version + ')', at: new Date().toISOString(), pass: checks.filter(c => c.ok).length, total: checks.length, checks };
  fs.writeFileSync(OUT, JSON.stringify(rep, null, 1));
  console.log(`${rep.pass}/${rep.total} pass (${rep.protocol}) -> ${path.relative(ROOT, OUT)}`);
  process.exit(rep.pass === rep.total ? 0 : 1);
})();
