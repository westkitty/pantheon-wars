#!/usr/bin/env node
/*
 * Integrity of the committed soundtrack (no ffmpeg needed): exactly the twenty files the manifest names exist in audio/music/, nothing
 * else is there, and each file's size and SHA-256 match audio/soundtrack.json. audio/soundtrack.js must carry the same manifest.
 * Each file must also start with an ID3v2 tag followed by an MPEG-1 Layer III frame header at the manifest's sample rate.
 * Decoding is proven in the browser by tools/soundtrack-check.js; this check catches a missing, truncated, swapped or stray file.
 *   node tools/soundtrack-integrity.js
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..'), M = JSON.parse(fs.readFileSync(path.join(ROOT, 'audio', 'soundtrack.json'), 'utf8'));
const js = fs.readFileSync(path.join(ROOT, 'audio', 'soundtrack.js'), 'utf8'), W = JSON.parse(js.slice(js.indexOf('=') + 1).trim().replace(/;$/, ''));
const RATES = [44100, 48000, 32000], problems = [];
if (M.tracks.length !== 20) problems.push('manifest lists ' + M.tracks.length + ' tracks, expected 20');
const named = new Set(M.tracks.map(t => path.basename(t.file)));
fs.readdirSync(path.join(ROOT, 'audio', 'music')).forEach(f => { if (!named.has(f)) problems.push('stray file audio/music/' + f); });
let bytes = 0;
for (const t of M.tracks) {
  const f = path.join(ROOT, t.file); if (!fs.existsSync(f)) { problems.push('missing ' + t.file); continue; }
  const b = fs.readFileSync(f); bytes += b.length;
  if (b.length !== t.bytes) problems.push(t.id + ': size ' + b.length + ' != manifest ' + t.bytes);
  if (crypto.createHash('sha256').update(b).digest('hex') !== t.sha256) problems.push(t.id + ': SHA-256 differs from the manifest');
  if (b.toString('latin1', 0, 3) !== 'ID3') problems.push(t.id + ': no ID3v2 tag'); else {
    const tag = 10 + ((b[6] & 127) << 21 | (b[7] & 127) << 14 | (b[8] & 127) << 7 | (b[9] & 127)), h = b.readUInt32BE(tag);
    const sync = (h >>> 21) === 0x7ff, ver = (h >>> 19) & 3, layer = (h >>> 17) & 3, rate = RATES[(h >>> 10) & 3];
    if (!sync || ver !== 3 || layer !== 1 || rate !== t.sampleRate) problems.push(t.id + ': first frame is not MPEG-1 Layer III at ' + t.sampleRate + ' Hz');
  }
  const w = W.tracks.find(x => x.id === t.id); if (!w || w.sha256 !== t.sha256 || w.file !== t.file) problems.push(t.id + ': audio/soundtrack.js disagrees with soundtrack.json');
}
if (bytes !== M.runtimeBytes) problems.push('total ' + bytes + ' != manifest runtimeBytes ' + M.runtimeBytes);
console.log(problems.length ? 'SOUNDTRACK INTEGRITY FAIL\n- ' + problems.join('\n- ') : 'SOUNDTRACK INTEGRITY PASS: 20 recordings, ' + bytes + ' bytes (' + (bytes / 1048576).toFixed(2) + ' MiB), sizes and SHA-256 match the manifest, MPEG-1 Layer III frames');
process.exit(problems.length ? 1 : 0);
