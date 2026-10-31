# Recorded soundtrack: integration report

Generated data: `audio/soundtrack.json` (tool `tools/prepare-soundtrack.js`), per-second RMS envelopes in `reports/soundtrack-envelopes.json`.
Browser evidence: `reports/soundtrack-check-file.json` (file://) and `reports/soundtrack-check-http.json` (local HTTP server), tool `tools/soundtrack-check.js`.

## Distribution

The twenty recordings are committed in `audio/music/` and ship with the game. The creator authorized their inclusion and
distribution with Pantheon Wars on 2026-10-31. The music remains the creator's property. See `audio/README.md` for the exact scope.
Earlier commits on this branch, up to `5ae1fa8`, kept them out of Git while that permission was unconfirmed. Those commits play the generated score.

Source-to-output verification of all twenty files is in `reports/soundtrack-verify.json`. Each file passed these checks:

- Drive file ID and byte size, against the Drive listing. None of the files had been modified since upload.
- Source SHA-256 against the manifest.
- Output SHA-256 and size against the manifest.
- Audio-packet MD5: source equals output.
- A single MP3 audio stream, with the duration recorded in the manifest.
- A full decode with `ffmpeg -xerror`, without errors.

Re-running the preparation reproduces 20/20 files byte for byte.

## Source analysis (all twenty recordings)

- Format: every file is MPEG-1 Layer III, 48 kHz, stereo, about 128 kb/s audio, plus an embedded cover-art picture (mjpeg) of about 0.79 MB.
  The 163–177 kb/s "bitrates" reported for the originals include that picture.
- Length: 150–181 s each, 56.6 minutes in total.
- Loudness (EBU R128, ffmpeg loudnorm measurement pass): −14.2 to −19.1 LUFS integrated, so the takes differ by up to 4.9 LU.
  True peak −0.1 to −1.1 dBTP (Divine Omens Alt −3.8). No file reaches 0 dBTP. No clipping was measured, but several takes peak within 0.3 dB of full scale.
- Shape: the 1 s RMS envelopes all show the same arc: a quieter opening, a full body, and a quieter ending of 2–20 s, followed by 1–2 s of near-silence.
  These are complete pieces with endings, not loops. A hard sample loop would cut an ending into an opening, so the director never loops a track's end.
  Instead, from each track's `out` point (the start of its quiet ending) it crossfades for 4 s into the alternate take, or back into the track's own body (`loopIn`) when a cue has only one take.
- Leading silence: none of note. Only Ennead Alt (0.36 s), Twilight (0.55 s) and Endgame (0.76 s) have any; playback starts at `in`.
- Alternate takes: nine cues have two takes (title, three faction themes, exploration, expansion, omens, conflict, intervention). The director alternates them so that a long session does not repeat one take.
  The take is chosen with the director's own generator (`Math.random`), never the game's seeded RNG.
- Listening review: **UNVERIFIED**. No audio output is available to the build agent. Roles follow the owner's file names. The measurements confirm only shape, level and length, not musical fit.

## Runtime files and size

| | bytes | MiB |
|---|---|---|
| 20 originals (Drive) | 71,982,708 | 68.65 |
| 20 runtime files (`audio/music/`, cover art removed, audio stream copied) | 54,384,646 | 51.87 |
| saved | 17,598,062 | 16.78 (24.4 %) |

The files were not re-encoded. MP3 to MP3 or Opus would be a second lossy pass, and the files already play everywhere the game runs.
Their audio packets are byte-identical to the originals: the packet MD5s of source and output match for every checked file.
Loudness matching is applied at playback: `gainDb` brings each take to about −19.5 LUFS, the level of the quietest take, and is never above 0 dB.
That rule follows from `HTMLMediaElement.volume`, which cannot exceed 1.

## Manifest and cue sheet

| id | source file | cue | duration s | kbps | LUFS | true peak dBTP | LRA | gain dB | in | loopIn | out | sound end | alternate | source MiB | runtime MiB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| title-a | Pantheon Wars Main Title.mp3 | title | 174.2 | 128 | -15.72 | -0.27 | 13 | -3.78 | 0 | 0 | 151 | 171 | title-b | 3.42 | 2.66 |
| title-b | Pantheon Wars Main Title (Take 2).mp3 | title | 177.7 | 128 | -15.24 | -0.15 | 6.7 | -4.26 | 0 | 0 | 173 | 175 | title-a | 3.53 | 2.71 |
| olympian-a | Olympian Court Theme.mp3 | faction:greek | 160.8 | 128 | -16.02 | -0.75 | 10.8 | -3.48 | 0 | 3 | 151 | 158 | olympian-b | 3.26 | 2.45 |
| olympian-b | Olympian Court Theme (Alt Take).mp3 | faction:greek | 150.2 | 128 | -14.59 | -0.31 | 8 | -4.91 | 0 | 0 | 143 | 147 | olympian-a | 3.15 | 2.29 |
| ash-a | Hall of the Ash (Faction Theme).mp3 | faction:norse | 176.1 | 128 | -15.29 | -0.54 | 10.3 | -4.21 | 0 | 14 | 167 | 172 | ash-b | 3.62 | 2.69 |
| ash-b | Hall of the Ash (Faction Theme2).mp3 | faction:norse | 150.9 | 128 | -15.09 | -0.37 | 9.9 | -4.41 | 0 | 2 | 141 | 147 | ash-a | 3.03 | 2.30 |
| ennead-a | Ennead of the Two Lands.mp3 | faction:egyptian | 172.9 | 128 | -14.59 | -0.54 | 8.6 | -4.91 | 0 | 0 | 165 | 169 | ennead-b | 3.60 | 2.64 |
| ennead-b | Ennead of the Two Lands (Alt Take).mp3 | faction:egyptian | 176.2 | 128 | -14.25 | -0.1 | 7 | -5.25 | 1 | 3 | 166 | 173 | ennead-a | 3.53 | 2.69 |
| explore-a | Pantheon Wars_ Map Exploration.mp3 | exploration | 175.7 | 128 | -15.6 | -0.41 | 13.7 | -3.9 | 0 | 28 | 170 | 172 | explore-b | 3.42 | 2.68 |
| explore-b | Pantheon Wars_ Map Exploration (Take 2).mp3 | exploration | 165.5 | 128 | -16.06 | -0.39 | 9.9 | -3.44 | 0 | 4 | 153 | 160 | explore-a | 3.49 | 2.53 |
| expansion-a | Pantheon Wars_ Expansion Theme.mp3 | expansion | 160.2 | 128 | -14.75 | -0.08 | 11.1 | -4.75 | 0 | 4 | 154 | 156 | expansion-b | 3.35 | 2.44 |
| expansion-b | Pantheon Wars_ Expansion Theme (Alt Take).mp3 | expansion | 177.6 | 128 | -14.23 | -0.43 | 6 | -5.27 | 0 | 1 | 172 | 175 | expansion-a | 3.54 | 2.71 |
| omens-a | Pantheon Wars_ Divine Omens.mp3 | omens | 175.6 | 128 | -17.59 | -0.41 | 8.4 | -1.91 | 0 | 0 | 169 | 172 | omens-b | 3.49 | 2.68 |
| omens-b | Pantheon Wars_ Divine Omens (Alt Take).mp3 | omens | 174.8 | 128 | -19.1 | -3.79 | 12.6 | -0.4 | 0 | 0 | 163 | 172 | omens-a | 3.45 | 2.67 |
| conflict-a | Pantheon Wars - Strategic Conflict.mp3 | conflict | 178.0 | 128 | -16.1 | -0.3 | 10.1 | -3.4 | 0 | 0 | 162 | 175 | conflict-b | 3.55 | 2.72 |
| conflict-b | Pantheon Wars - Strategic Conflict (Variation).mp3 | conflict | 158.1 | 128 | -16.4 | -0.27 | 9.1 | -3.1 | 0 | 0 | 148 | 154 | conflict-a | 3.26 | 2.41 |
| intervention-a | Pantheon Wars - Divine Intervention.mp3 | intervention | 180.5 | 128 | -14.42 | -0.64 | 6.5 | -5.08 | 0 | 0 | 175 | 177 | intervention-b | 3.51 | 2.75 |
| intervention-b | Pantheon Wars - Divine Intervention (Variant).mp3 | intervention | 177.4 | 128 | -15.11 | -0.55 | 7.4 | -4.39 | 0 | 0 | 174 | 175 | intervention-a | 3.60 | 2.71 |
| twilight | Pantheon Wars_ Twilight & Legacy.mp3 | twilight | 175.5 | 128 | -14.58 | -0.63 | 12.8 | -4.92 | 0 | 0 | 167 | 173 | — | 3.55 | 2.68 |
| endgame | Pantheon Wars_ Endgame Resolution.mp3 | end | 160.8 | 128 | -16.1 | -1.06 | 12.1 | -3.4 | 0 | 4 | 154 | 158 | — | 3.32 | 2.45 |

Times are in seconds. `in` is where playback starts. `loopIn` is where a single-take cue re-enters its own body. `out` is where the track's quiet ending begins: a sustained mood crossfades onward from there.
Miracle accent: Divine Intervention (take A), 44–56 s, the loudest 12 s of the recording.

## Moods and triggers

Only information the current viewer may know is used. The app passes a log entry to the director only after the viewer's fog filter (`cueFor` in `ui/app.js`), and passes nothing while the hot-seat screen is covered.

| Mood (priority) | Recording | Enters when | Leaves when |
|---|---|---|---|
| end (7) | Endgame Resolution, once | the victory/defeat screen opens (after the procedural victory/defeat cue) | the track ends; it does not repeat or continue |
| conflict (6) | Strategic Conflict A/B | the viewer's pressure reaches 3. Pressure: a threat to the viewer's shrine +3, the viewer's shrine toppled +3, a town taken from the viewer +3, a treaty broken against the viewer +2, a contested gain or a counter-rite +1. It halves every game turn | pressure falls below 1 (hysteresis) and at least 60 s have passed |
| omens (5) | Divine Omens A/B | the viewer draws or resolves an event card, gets a forecast, or a storm, drought or frost arrives over visible land | 45 s after the last such signal |
| intervention (4) | Divine Intervention A/B | three visible miracles (faction powers) within two turns | 60 s |
| faction (3) | Olympian Court (greek), Hall of the Ash (norse), Ennead (egyptian); the procedural motif for the other seven pantheons | game start, or a hot-seat god taking the seat for the first time | 150 s (45 s for a procedural motif), or a higher mood |
| twilight (2) | Twilight & Legacy | the Twilight age | — |
| expansion (1) | Expansion A/B | the Zenith, or two or more of the viewer's own growth events (shrine, growth, specialisation, route, a town won) in the Dawn | 20 s minimum |
| exploration (1) | Map Exploration A/B | the Dawn, by default | 20 s minimum |
| title (0) | Main Title A/B | the title screen, after the first click or key press | leaving the title screen |

- A mood keeps its minimum duration against equal or lower moods only. A higher mood takes over at once, for example omens over the exploration bed.
- A single miracle never changes or restarts the bed. Any visible faction power plays the accent: Divine Intervention 44–56 s on a third element, with 1.2 s fades. The bed is ducked to 35 % and keeps playing from where it was. Accents are at most one per 25 s, and none play during the intervention or end moods.
- Mood changes are 4 s crossfades between two elements. The leaving element is paused and released (`src` removed) once it is silent, so at most two music elements exist during a crossfade, plus one during an accent.
- Hot-seat: covering the screen switches the bed to the public age mood (exploration, expansion or twilight) and ignores all signals. Each god's pressure, omen, growth and miracle state is kept separately, so the next god never inherits the previous god's conflict.
- The generated score yields: while a recording holds the bed, `PWAudio.recordedActive` is set and the motif loop stays silent. Ambience and all sound effects are unchanged. The motif returns when no recording plays: Generated setting, files absent or failing, or a pantheon without a recorded theme.

## Lifecycle rules

- Nothing is fetched or played before the first click or key press: no element exists until sound is unlocked and audible.
- Mute, master or music volume at 0, or a hidden tab: every music element is paused and the timer is cleared. Restoring the tab resumes only the bed that was playing.
- One 100 ms interval runs only while something is playing or fading.
- Volume is master × music × track gain × fade × duck, applied to `element.volume`.
  Web Audio routing is not used for the recordings: in Chromium a MediaElementSource on a `file://` page is cross-origin and outputs silence.
- Settings: Settings → Soundtrack, **Recorded** (default) or **Generated**, saved in `pw.settings.audio.soundtrack` with the volumes and mute.

## Validation evidence

| Check | file:// | HTTP | without recordings (temporary copy, repository untouched) |
|---|---|---|---|
| `tools/soundtrack-check.js` | 43/43 | 43/43 (includes full `decodeAudioData` of all 20) | 12/12 file://, 12/12 HTTP |
| `tools/soundtrack-integrity.js` | 20/20 files: size and SHA-256 match the manifest, MPEG-1 Layer III frames | | |

Added with the committed recordings:
- **Restarts:** six game restarts in a row leave one bed and at most two elements holding a file.
- **Save/load:** loading a save restarts the music cleanly.
- **Sound effects:** they still play alongside the recordings.
- **Return to the title:** it fades the game bed out and leaves one Main Title take.
- **Fallback fixture:** one failed request marks the soundtrack absent, with no retries. The generated score holds the bed, a full round of play completes, and mood changes request nothing more.
- **Strict errors:** a failing committed recording is an error. The only load failures admitted are the deliberate fixtures, and those are counted.

Earlier counts, before the recordings were committed: 39/39 file://, 39/39 HTTP, 7/7 without recordings.

The checks cover the following. Each is a pass/fail check in the reports.

- **Loading and decoding:** all 20 files load (and, over HTTP, fully decode) at the manifest duration ±0.2 s.
- **Title and autoplay:** no element and no playback before a gesture. A Main Title take is audibly advancing after the first click.
- **Faction themes:** the greek, norse and egyptian themes play at game start. Mexica gets its procedural motif, then Map Exploration after its 45 s intro window.
- **Ages:** the Zenith brings Expansion and the Twilight brings Twilight & Legacy. In the Dawn, the viewer's own growth brings Expansion.
- **Conflict:** it enters at pressure 3, holds above 1 inside 60 s, and leaves below 1 after 60 s.
- **Omens:** they enter on a card and hold for at least 45 s.
- **Miracles:** one miracle plays the accent and ducks the bed (duck < 0.5), and the same bed continues, neither restarted nor replaced. The 25 s accent cooldown holds. Three miracles bring the Divine Intervention bed.
- **Continuation:** at the out point the bed crossfades into the alternate take. Afterwards exactly one element remains.
- **Mute, volume and visibility:** mute pauses and unmute resumes. Music volume 0 pauses. A hidden tab pauses and clears the timer, and nothing restarts while hidden. On restore only the previous bed resumes.
- **Endgame:** it plays and does not repeat.
- **Hot-seat privacy:** while the screen is covered, the bed is the public age mood and signals are ignored. The next god gets their own state, with no inherited conflict.
- **Real game:** a norse game against two AIs, played 40 turns through the real log, moved the music through faction → intervention → omens → expansion → conflict, plus accents.
- **Missing files and settings:** missing files fall back silently. Stop releases every element and clears the timer. The soundtrack setting and volume persist across reload. There are no page errors.

The full regression suite is in `docs/OMNI_IMPLEMENTATION_STATE.md`.

## Not verified

- Subjective quality: how the transitions, the accent passage, the chosen `out` points and the gain matching sound to a listener.
- Browsers other than Playwright's Chromium (Firefox and Safari also decode MP3, but were not run here).
- Real devices, Bluetooth latency, and OS media controls.
