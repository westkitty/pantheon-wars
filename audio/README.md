# Recorded soundtrack

`audio/soundtrack.json` (and the same data as `audio/soundtrack.js`, which loads under `file://`) is the manifest of the twenty
recordings supplied for Pantheon Wars in the Google Drive folder "macbook > pantheon music". It is committed. **The recordings
themselves (`audio/music/*.mp3`) are not committed**: `audio/music/` is in `.gitignore` because public redistribution rights for the
recordings have not been confirmed (see "Approval needed" below).

Without `audio/music/` the game is complete: the director (`ui/music.js`) finds no playable recording and the generated score in
`ui/audio.js` plays instead. Nothing fails and nothing is fetched from the network.

## Installing the recordings locally

1. Download the twenty MP3s from the Drive folder into any local folder (keep the original file names; do not rename them).
2. `node tools/prepare-soundtrack.js --src <that folder>` (needs `ffmpeg`/`ffprobe`). It writes `audio/music/<id>.mp3`, re-measures
   every file and regenerates the manifest. The originals are only read.
3. Open `index.html` (double-click or any local server). Settings → Soundtrack: **Recorded** (default) or **Generated**.

Processing is lossless: the only change is removing the embedded cover-art picture stream (`-map 0:a -c:a copy`). The audio frames are
byte-identical to the originals (checked by comparing packet MD5s of source and output). Nothing is re-encoded, normalised or trimmed;
loudness matching and fades happen at playback (`gainDb` in the manifest, always ≤ 0 dB).

## Approval needed before the recordings can be committed or deployed

The files are owned in Drive by a different account from the one working on this repository, and no licence or statement of rights
accompanies them. Committing them to this repository, or deploying the game with them, distributes them publicly. Before that, the
rights holder needs to confirm in writing (an issue or PR comment on this repository is enough) that:

- they hold the rights to all twenty recordings (composition and recording, including any samples, loops or generated material used), and
- they permit redistribution with this game in this public repository and any public deployment of it, under a stated licence or terms.

Once that confirmation exists: remove `audio/music/` from `.gitignore`, run `tools/prepare-soundtrack.js`, commit `audio/music/` with
the manifest, and record the licence in this file and in `README.md`.
