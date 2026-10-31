# Recorded soundtrack

Pantheon Wars ships twenty original recordings in `audio/music/`. The music director in `ui/music.js` plays them at the right moments
of a game; see `reports/soundtrack.md` for the cue sheet. `audio/soundtrack.json` is the manifest: identities, provenance, checksums,
measurements, gains and transition points. `audio/soundtrack.js` holds the same data as a script, because it must load under `file://`.

## Rights and permission

- **Creator:** the recordings are original music made by their creator, who supplied them for Pantheon Wars from the Google Drive folder
  "macbook > pantheon music".
- **Permission:** on 2026-10-31 the creator stated: "I made them myself. They can be used." This authorizes including the
  recordings in Pantheon Wars and distributing them with the game. That covers this public repository and public distributions of
  the game.
- **Ownership:** the recordings remain the creator's intellectual property. Nothing here transfers ownership.
- **No separate licence:** no standalone licence is granted for the music by this repository. That means no Creative Commons licence and no public-domain dedication.
  Using the recordings outside Pantheon Wars needs the creator's own permission. The licence of the game's source code does not extend to these files.

History: until that statement, the recordings were kept out of Git (`audio/music/` was git-ignored), and the game shipped with only
its generated score. The repository history before commit `5ae1fa8` shows that state. The generated score remains the fallback whenever a
recording cannot be played.

## What was done to the files

`tools/prepare-soundtrack.js --src <folder with the twenty originals>` (needs `ffmpeg`/`ffprobe`) wrote `audio/music/<id>.mp3`.
The processing is lossless:

- The only change is removing the embedded cover-art picture stream with a stream copy: `-map 0:a -c:a copy`. The audio frames
  are byte-identical to the originals: the packet MD5s of every source and output pair match.
- Nothing is re-encoded, normalised or trimmed. Loudness matching and fades happen at playback (`gainDb` in the manifest, always ≤ 0 dB).
- 71,982,708 bytes of originals became 54,384,646 bytes of game files (68.65 → 51.87 MiB).
- The Drive originals were only read. They are not in this repository.

## Checks

- `node tools/soundtrack-integrity.js`: exactly the twenty manifest files are present, each size and SHA-256 matches, and each has
  MPEG-1 Layer III frames. It needs no ffmpeg and runs in CI.
- `node tools/soundtrack-check.js [--http]`: every recording loads and decodes in the browser, and every music state plays.
- `node tools/soundtrack-check.js --without-recordings`: the generated-music fallback, run on a temporary copy of the game without
  `audio/music/`.
- `reports/soundtrack-verify.json`: the source-to-output verification of all twenty files.

To rebuild from the originals, run `tools/prepare-soundtrack.js` again. It reproduces the committed files byte for byte.
