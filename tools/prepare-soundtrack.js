#!/usr/bin/env node
/*
 * Soundtrack preparation. Takes the twenty original MP3 recordings (a private copy of the owner's Drive folder "pantheon music"),
 * removes only the embedded cover-art stream (lossless stream copy: the audio frames are not re-encoded), measures every file and writes:
 *   audio/music/<id>.mp3     the runtime files, committed with the game (creator's permission and scope in audio/README.md)
 *   audio/soundtrack.json    manifest: identities, provenance, measurements, gains, transition points, cue roles
 *   audio/soundtrack.js      the same manifest as a script (loads under file://, where fetch() of local JSON is blocked)
 * Measurements: ffprobe (codec, rate, channels, bitrate, duration), ffmpeg loudnorm first pass (EBU R128 integrated loudness, true
 * peak, loudness range), and a 1 s RMS envelope from decoded mono PCM (where sound starts, where the body level is first reached,
 * where the outro begins, where sound ends). No musical judgement is derived from file names; roles come from the owner's naming and
 * are confirmed by these measurements only where stated. Listening review is recorded separately (reports/soundtrack-listening.md).
 *   node tools/prepare-soundtrack.js --src <folder with the 20 originals> [--ids <drive-ids.txt>]
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execFileSync } = require('child_process');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SRC = arg('src'); if (!SRC) { console.error('usage: --src <folder with the original MP3s>'); process.exit(2); }
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'audio', 'music'); fs.mkdirSync(OUT, { recursive: true });
const TARGET_LUFS = -19.5, MAX_TP = -1.0; // every track is attenuated to the quietest recording's level, never boosted (media-element volume cannot exceed 1)

// owner's file name -> stable id, cue category, role and the take it alternates with
const MAP = [
  ['Pantheon Wars Main Title.mp3', 'title-a', 'title', 'Title and menus', 'title-b'],
  ['Pantheon Wars Main Title (Take 2).mp3', 'title-b', 'title', 'Title and menus (second take)', 'title-a'],
  ['Olympian Court Theme.mp3', 'olympian-a', 'faction:greek', 'Olympian Court (Greek) faction theme', 'olympian-b'],
  ['Olympian Court Theme (Alt Take).mp3', 'olympian-b', 'faction:greek', 'Olympian Court (Greek) faction theme, alternate take', 'olympian-a'],
  ['Hall of the Ash (Faction Theme).mp3', 'ash-a', 'faction:norse', 'Hall of the Ash (Norse) faction theme', 'ash-b'],
  ['Hall of the Ash (Faction Theme2).mp3', 'ash-b', 'faction:norse', 'Hall of the Ash (Norse) faction theme, second take', 'ash-a'],
  ['Ennead of the Two Lands.mp3', 'ennead-a', 'faction:egyptian', 'Ennead of the Two Lands (Egyptian) faction theme', 'ennead-b'],
  ['Ennead of the Two Lands (Alt Take).mp3', 'ennead-b', 'faction:egyptian', 'Ennead of the Two Lands (Egyptian) faction theme, alternate take', 'ennead-a'],
  ['Pantheon Wars_ Map Exploration.mp3', 'explore-a', 'exploration', 'Exploration and quiet strategy', 'explore-b'],
  ['Pantheon Wars_ Map Exploration (Take 2).mp3', 'explore-b', 'exploration', 'Exploration and quiet strategy (second take)', 'explore-a'],
  ['Pantheon Wars_ Expansion Theme.mp3', 'expansion-a', 'expansion', 'Growth, shrines and the Zenith', 'expansion-b'],
  ['Pantheon Wars_ Expansion Theme (Alt Take).mp3', 'expansion-b', 'expansion', 'Growth, shrines and the Zenith (alternate take)', 'expansion-a'],
  ['Pantheon Wars_ Divine Omens.mp3', 'omens-a', 'omens', 'Omens, ominous events and dangerous weather', 'omens-b'],
  ['Pantheon Wars_ Divine Omens (Alt Take).mp3', 'omens-b', 'omens', 'Omens (alternate take)', 'omens-a'],
  ['Pantheon Wars - Strategic Conflict.mp3', 'conflict-a', 'conflict', 'Strategic pressure on the viewer\'s towns and shrines', 'conflict-b'],
  ['Pantheon Wars - Strategic Conflict (Variation).mp3', 'conflict-b', 'conflict', 'Strategic pressure (variation)', 'conflict-a'],
  ['Pantheon Wars - Divine Intervention.mp3', 'intervention-a', 'intervention', 'Sustained miracle sequences; its loudest passage is the miracle accent', 'intervention-b'],
  ['Pantheon Wars - Divine Intervention (Variant).mp3', 'intervention-b', 'intervention', 'Sustained miracle sequences (variant)', 'intervention-a'],
  ['Pantheon Wars_ Twilight & Legacy.mp3', 'twilight', 'twilight', 'The Twilight age', null],
  ['Pantheon Wars_ Endgame Resolution.mp3', 'endgame', 'end', 'The end of a finished game (victory and defeat alike)', null]
];
const driveIds = {}; if (arg('ids')) fs.readFileSync(arg('ids'), 'utf8').trim().split('\n').forEach(l => { const m = l.match(/^(\S+)\s+(\d+)\s+(.+)$/); if (m) driveIds[m[3]] = m[1]; });
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const run = (cmd, args) => execFileSync(cmd, args, { maxBuffer: 1 << 30 });

function envelope(file) { // 1 s RMS in dBFS of decoded mono 8 kHz PCM
  const pcm = run('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', '8000', '-f', 's16le', '-']), n = Math.floor(pcm.length / 2), sec = Math.floor(n / 8000), rms = [];
  for (let s = 0; s < sec; s++) { let e = 0; for (let i = s * 8000; i < (s + 1) * 8000; i++) { const v = pcm.readInt16LE(i * 2) / 32768; e += v * v; } rms.push(10 * Math.log10(e / 8000 + 1e-12)); }
  const sorted = rms.slice().sort((a, b) => a - b), body = sorted[sorted.length >> 1];
  const firstAt = th => rms.findIndex(v => v > th), lastAt = th => { for (let i = rms.length - 1; i >= 0; i--) if (rms[i] > th) return i; return -1; };
  const fifths = [0, 1, 2, 3, 4].map(k => { const a = rms.slice(Math.floor(sec * k / 5), Math.floor(sec * (k + 1) / 5)); return +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1); });
  let peak = 0; rms.forEach((v, i) => { if (v > rms[peak]) peak = i; });
  return { bodyDbfs: +body.toFixed(1), soundStart: Math.max(0, firstAt(-45)), reachesBody: Math.max(0, firstAt(body - 6)), outroStart: lastAt(body - 6) + 1, soundEnd: lastAt(-45) + 1, fifthsDbfs: fifths, loudestSecond: peak, rmsPerSecond: rms.map(v => +v.toFixed(1)) };
}

const tracks = [];
for (const [name, id, cue, role, alt] of MAP) {
  const src = path.join(SRC, name); if (!fs.existsSync(src)) { console.error('missing original: ' + name); process.exit(1); }
  const out = path.join(OUT, id + '.mp3');
  run('ffmpeg', ['-v', 'error', '-y', '-i', src, '-map', '0:a', '-c:a', 'copy', '-map_metadata', '-1', '-id3v2_version', '3', '-metadata', 'title=' + name.replace(/\.mp3$/, ''), out]);
  const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration,bit_rate:stream=codec_name,sample_rate,channels', '-of', 'json', out]).toString());
  const lj = JSON.parse(execFileSync('sh', ['-c', 'ffmpeg -hide_banner -nostats -i "$0" -af loudnorm=print_format=json -f null - 2>&1 | sed -n "/^{/,/^}/p"', out]).toString());
  const I = +lj.input_i, TP = +lj.input_tp, LRA = +lj.input_lra, gain = +Math.min(0, TARGET_LUFS - I, MAX_TP - TP).toFixed(2);
  const env = envelope(out), st = probe.streams[0], dur = +(+probe.format.duration).toFixed(3);
  const t = { id, title: name.replace(/\.mp3$/, ''), cue, role, alternate: alt,
    source: { file: name, driveId: driveIds[name] || null, bytes: fs.statSync(src).size, sha256: sha(src), coverArtStream: true },
    file: 'audio/music/' + id + '.mp3', bytes: fs.statSync(out).size, sha256: sha(out), processing: 'cover-art stream removed by stream copy; audio frames unchanged (no re-encode)',
    durationS: dur, codec: st.codec_name, sampleRate: +st.sample_rate, channels: st.channels, kbps: Math.round(+probe.format.bit_rate / 1000),
    loudness: { integratedLufs: I, truePeakDbtp: TP, lraLu: LRA }, gainDb: gain,
    envelope: env,
    // transition points (seconds): playback starts at `in`; a sustained state crossfades onward from `out` over `fadeS`
    in: env.soundStart, out: Math.max(env.outroStart, Math.floor(dur * 0.6)), fadeS: 4,
    loop: { mode: 'continue', note: 'through-composed: quieter opening, fuller body and a quieter ending (see envelope); sustained states crossfade from `out` into the alternate take, or back to `loopIn` when the cue has a single take' },
    loopIn: env.reachesBody,
    listening: 'UNVERIFIED (no audio playback available to the build agent; see reports/soundtrack-listening.md)' };
  if (id === 'intervention-a') t.accent = { from: Math.max(0, env.loudestSecond - 4), to: Math.min(dur - 1, env.loudestSecond + 8), note: 'the loudest 12 s of the recording, used as the miracle accent' };
  tracks.push(t); process.stdout.write(id + ' ');
}
const total = (k) => tracks.reduce((n, t) => n + (k === 'source' ? t.source.bytes : t.bytes), 0);
const manifest = { generated: new Date().toISOString(), tool: 'node tools/prepare-soundtrack.js', origin: 'Google Drive > macbook > pantheon music (folder 1_w3X8OUuHHVq7PXIi_QfukqZ0B5RbfAB), 20 MP3 recordings supplied by the owner for Pantheon Wars; originals untouched',
  targetLufs: TARGET_LUFS, maxTruePeakDbtp: MAX_TP, sourceBytes: total('source'), runtimeBytes: total('runtime'), tracks };
fs.writeFileSync(path.join(ROOT, 'audio', 'soundtrack.json'), JSON.stringify(manifest, (k, v) => k === 'rmsPerSecond' ? undefined : v, 1));
fs.writeFileSync(path.join(ROOT, 'audio', 'soundtrack.js'), '/* generated by tools/prepare-soundtrack.js from audio/soundtrack.json — do not edit */\nwindow.PW_SOUNDTRACK = ' + JSON.stringify(manifest, (k, v) => k === 'rmsPerSecond' || k === 'fifthsDbfs' ? undefined : v) + ';\n');
fs.writeFileSync(path.join(ROOT, 'reports', 'soundtrack-envelopes.json'), JSON.stringify(tracks.map(t => ({ id: t.id, rmsPerSecond: t.envelope.rmsPerSecond })), null, 0));
console.log('\n' + tracks.length + ' tracks; source ' + (total('source') / 1048576).toFixed(2) + ' MiB -> runtime ' + (total('runtime') / 1048576).toFixed(2) + ' MiB');
