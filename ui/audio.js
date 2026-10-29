/*
 * Pantheon Wars — original procedural audio (P018). Everything is synthesised with Web Audio oscillators and filtered noise at run time;
 * there are no sound files, samples or recorded music. Nothing plays until the player interacts (browser autoplay rules), the context
 * suspends when the tab is hidden, and every node is disconnected after use. The game is fully playable with sound off or unavailable;
 * every cue also has a visible equivalent (banner, toast or log line) in ui/app.js.
 * Motifs are short original phrases on pantheon-specific scales and timbres; they are moods, not reconstructions of historical music.
 */
(function (root) {
  'use strict';
  var MOTIFS = {
    greek: { scale: [0, 2, 3, 5, 7, 9, 10], phrase: [0, 2, 4, 2, 5, 4], wave: 'triangle', base: 220, tempo: 0.42 },
    norse: { scale: [0, 2, 3, 5, 7, 8, 10], phrase: [0, 0, 3, 2, 0, 4], wave: 'sawtooth', base: 146.8, tempo: 0.55, lp: 900 },
    egyptian: { scale: [0, 1, 4, 5, 7, 8, 11], phrase: [0, 1, 2, 1, 4, 2], wave: 'triangle', base: 196, tempo: 0.4 },
    mesopotamian: { scale: [0, 2, 3, 5, 7, 8, 11], phrase: [4, 3, 2, 0, 2, 3], wave: 'triangle', base: 174.6, tempo: 0.48 },
    irish: { scale: [0, 2, 4, 5, 7, 9, 10], phrase: [0, 2, 4, 5, 4, 2], wave: 'square', base: 293.7, tempo: 0.3, lp: 1600 },
    mexica: { scale: [0, 3, 5, 7, 10], phrase: [0, 1, 2, 4, 3, 1], wave: 'sine', base: 261.6, tempo: 0.36, perc: true },
    hittite: { scale: [0, 2, 3, 6, 7, 8, 11], phrase: [0, 3, 2, 3, 5, 3], wave: 'sawtooth', base: 130.8, tempo: 0.6, lp: 700 },
    yoruba: { scale: [0, 2, 4, 7, 9], phrase: [0, 2, 1, 3, 2, 4], wave: 'sine', base: 246.9, tempo: 0.3, perc: true },
    japanese: { scale: [0, 1, 5, 7, 8], phrase: [0, 2, 3, 2, 4, 3], wave: 'sine', base: 293.7, tempo: 0.5 },
    vedic: { scale: [0, 1, 4, 5, 7, 8, 11], phrase: [0, 4, 3, 1, 0, 2], wave: 'triangle', base: 164.8, tempo: 0.45, drone: true }
  };
  function Audio(settings) {
    this.s = settings || { master: 0.8, music: 0.5, sfx: 0.8, ambience: 0.4, mute: false };
    this.ctx = null; this.ready = false; this.faction = 'greek'; this.musicTimer = null; this.ambNode = null; this.age = 'dawn'; this.played = {};
    var self = this;
    if (root.document) root.document.addEventListener('visibilitychange', function () { if (!self.ctx) return; if (root.document.hidden) self.ctx.suspend(); else if (!self.s.mute) self.ctx.resume(); });
  }
  var P = Audio.prototype;
  Audio.MOTIFS = MOTIFS;
  P.supported = function () { return !!(root.AudioContext || root.webkitAudioContext); };
  /* Called from the first pointer/key gesture. Safe to call repeatedly. */
  P.unlock = function () {
    if (this.ready || !this.supported()) return;
    try {
      var C = root.AudioContext || root.webkitAudioContext; this.ctx = new C();
      this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
      this.music = this.ctx.createGain(); this.music.connect(this.master);
      this.sfxBus = this.ctx.createGain(); this.sfxBus.connect(this.master);
      this.amb = this.ctx.createGain(); this.amb.connect(this.master);
      this.ready = true; this.apply();
      if (this.wantMusic) this.startMusic(this.faction);
    } catch (e) { this.ready = false; this.error = e.message; }
  };
  P.apply = function () {
    if (!this.ready) return; var m = this.s.mute ? 0 : this.s.master, t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(m, t, 0.05); this.music.gain.setTargetAtTime(this.s.music * 0.35, t, 0.05); this.sfxBus.gain.setTargetAtTime(this.s.sfx * 0.6, t, 0.05); this.amb.gain.setTargetAtTime(this.s.ambience * 0.25, t, 0.05);
    if (this.s.mute) this.ctx.suspend(); else if (!(root.document && root.document.hidden)) this.ctx.resume();
  };
  P.set = function (k, v) { this.s[k] = v; this.apply(); };
  P.tone = function (bus, freq, start, dur, wave, gain, lp) {
    var c = this.ctx, o = c.createOscillator(), g = c.createGain(), out = g;
    o.type = wave || 'sine'; o.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start); g.gain.exponentialRampToValueAtTime(gain || 0.3, start + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    if (lp) { var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; g.connect(f); out = f; }
    out.connect(bus); o.start(start); o.stop(start + dur + 0.05);
    o.onended = function () { o.disconnect(); g.disconnect(); if (out !== g) out.disconnect(); };
  };
  P.noise = function (bus, start, dur, gain, freq, q) {
    var c = this.ctx, len = Math.max(1, Math.floor(c.sampleRate * dur)), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0), seed = 7;
    for (var i = 0; i < len; i++) { seed = (seed * 16807) % 2147483647; d[i] = (seed / 2147483647) * 2 - 1; }
    var src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq || 800; f.Q.value = q || 0.8;
    g.gain.setValueAtTime(gain || 0.2, start); g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(f); f.connect(g); g.connect(bus); src.start(start); src.stop(start + dur + 0.02);
    src.onended = function () { src.disconnect(); f.disconnect(); g.disconnect(); };
  };
  function hz(base, semis) { return base * Math.pow(2, semis / 12); }
  P.motif = function (fid, bus, when, octave) {
    var M = MOTIFS[fid] || MOTIFS.greek, t = when, self = this;
    M.phrase.forEach(function (deg, i) { var semi = M.scale[deg % M.scale.length] + 12 * Math.floor(deg / M.scale.length) + (octave || 0); self.tone(bus, hz(M.base, semi), t + i * M.tempo * 0.5, M.tempo * 0.9, M.wave, 0.18, M.lp); if (M.perc && i % 2 === 0) self.noise(bus, t + i * M.tempo * 0.5, 0.06, 0.12, 2200, 2); });
    if (M.drone) this.tone(bus, hz(M.base, -12), t, M.tempo * M.phrase.length * 0.5 + 0.4, 'sine', 0.08);
  };
  /* Generative score: the pantheon motif returns every few seconds, transposed by the age; the bed under it is quiet ambience. */
  P.startMusic = function (fid) {
    this.faction = fid || this.faction; this.wantMusic = true;
    if (!this.ready) return; this.stopMusic(true); var self = this, n = 0;
    function loop() { if (!self.ready || !self.wantMusic) return; var t = self.ctx.currentTime + 0.05, oct = self.age === 'dawn' ? 0 : self.age === 'zenith' ? 2 : -3; self.motif(self.faction, self.music, t, n % 4 === 3 ? oct + 5 : oct); n++; self.musicTimer = setTimeout(loop, 5200 + (n % 3) * 1100); }
    loop(); this.startAmbience();
  };
  P.stopMusic = function (keepWish) { clearTimeout(this.musicTimer); this.musicTimer = null; if (!keepWish) this.wantMusic = false; if (this.ambNode) { try { this.ambNode.stop(); } catch (e) { /* already stopped */ } this.ambNode = null; } };
  P.startAmbience = function () {
    if (!this.ready || this.ambNode) return;
    var c = this.ctx, len = c.sampleRate * 4, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0), seed = 11, last = 0;
    for (var i = 0; i < len; i++) { seed = (seed * 16807) % 2147483647; last = last * 0.985 + ((seed / 2147483647) * 2 - 1) * 0.015; d[i] = last * 6; }
    var src = c.createBufferSource(), f = c.createBiquadFilter(); src.buffer = buf; src.loop = true; f.type = 'lowpass'; f.frequency.value = 500;
    src.connect(f); f.connect(this.amb); src.start(); this.ambNode = src;
    src.onended = function () { src.disconnect(); f.disconnect(); };
  };
  P.setAge = function (age) { this.age = age; };
  /* Sound effects by category. Returns true if something was scheduled (tests read this). */
  P.cue = function (kind, opt) {
    this.played[kind] = (this.played[kind] || 0) + 1;
    if (!this.ready || this.s.mute) return false;
    var t = this.ctx.currentTime + 0.01, b = this.sfxBus, M = MOTIFS[(opt && opt.faction) || this.faction] || MOTIFS.greek, self = this;
    switch (kind) {
      case 'turn': this.tone(b, hz(M.base, 12), t, 0.4, 'sine', 0.15); this.tone(b, hz(M.base, 19), t + 0.08, 0.5, 'sine', 0.1); break;
      case 'age': this.motif(this.faction, b, t, 12); this.tone(b, hz(M.base, -12), t, 2.2, 'sine', 0.12); break;
      case 'shrine': [0, 4, 7].forEach(function (s, i) { self.tone(b, hz(M.base, s + 12), t + i * 0.06, 0.9, 'triangle', 0.14); }); break;
      case 'priest': this.tone(b, hz(M.base, 7), t, 0.25, 'triangle', 0.12); this.tone(b, hz(M.base, 12), t + 0.1, 0.3, 'triangle', 0.1); break;
      case 'explore': this.tone(b, hz(M.base, 24), t, 0.6, 'sine', 0.1); this.tone(b, hz(M.base, 31), t + 0.15, 0.6, 'sine', 0.08); break;
      case 'expand': this.tone(b, hz(M.base, 5), t, 0.5, 'triangle', 0.16); this.tone(b, hz(M.base, 12), t + 0.12, 0.6, 'triangle', 0.12); break;
      case 'exploit': [0, 2, 4].forEach(function (d, i) { self.tone(b, hz(M.base, M.scale[d] + 12), t + i * 0.09, 0.4, 'sine', 0.12); }); break;
      case 'exterminate': this.noise(b, t, 0.5, 0.4, 300, 0.6); this.tone(b, hz(M.base, -12), t, 0.6, 'sawtooth', 0.12, 600); break;
      case 'eclipse': this.tone(b, hz(M.base, -5), t, 1.2, 'sine', 0.18); this.tone(b, hz(M.base, -6), t, 1.2, 'sine', 0.12); break;
      case 'topple': this.noise(b, t, 0.9, 0.5, 180, 0.5); this.noise(b, t + 0.15, 0.6, 0.3, 90, 0.5); break;
      case 'threat': this.tone(b, hz(M.base, 13), t, 0.18, 'square', 0.08, 1400); this.tone(b, hz(M.base, 13), t + 0.25, 0.18, 'square', 0.08, 1400); break;
      case 'rains': this.noise(b, t, 1.4, 0.18, 3000, 0.4); break;
      case 'storm': this.noise(b, t, 1.6, 0.35, 120, 0.4); break;
      case 'drought': this.tone(b, hz(M.base, 18), t, 1.2, 'sine', 0.05); break;
      case 'frost': this.tone(b, hz(M.base, 31), t, 0.9, 'sine', 0.06); break;
      case 'omen': this.tone(b, hz(M.base, 26), t, 1.2, 'sine', 0.07); this.tone(b, hz(M.base, 33), t + 0.2, 1.2, 'sine', 0.05); break;
      case 'covenant': this.tone(b, hz(M.base, 7), t, 0.7, 'triangle', 0.12); this.tone(b, hz(M.base, 12), t + 0.2, 0.9, 'triangle', 0.1); break;
      case 'victory': this.motif(this.faction, b, t, 12); [0, 4, 7, 12].forEach(function (s, i) { self.tone(b, hz(M.base, s + 12), t + 1.4 + i * 0.12, 1.6, 'triangle', 0.12); }); break;
      case 'defeat': [0, -2, -5, -7].forEach(function (s, i) { self.tone(b, hz(M.base, s), t + i * 0.3, 1.0, 'sine', 0.12); }); break;
      case 'click': this.tone(b, 880, t, 0.05, 'square', 0.04, 3000); break;
      default: return false;
    }
    return true;
  };
  root.PWAudio = Audio;
})(typeof self !== 'undefined' ? self : this);
