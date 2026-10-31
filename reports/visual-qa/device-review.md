# Real-device review — handoff

**Status: UNVERIFIED.** No physical desktop, tablet or phone was available to the build environment; every frame time and
screenshot in this repository comes from headless Chromium with software rendering. This sheet is for the person who reviews it.

## Build
- Branch `claude/vibrant-feynman-x1fjq9`, the head commit named in draft PR #1 (open the PR's latest commit; record its SHA with your notes).
- No server, install or network is needed: clone or download the branch, then open `index.html` directly (double-click, or
  `file:///…/index.html`). For a phone or tablet, copy the folder to the device or serve it on your local network with any static
  server (`python3 -m http.server 8080` in the folder, then open `http://<computer-ip>:8080/` on the device). Do not deploy it publicly.

## Five scenes to inspect (each URL loads a fixed game)
1. Home town at normal zoom, Dawn: `index.html?seed=31&faction=greek&autostart=1` — mouse wheel or pinch to about the default zoom; look at
   town life (people, lanterns, cloth), forests, hills and the coast.
2. Water at three zooms: `index.html?seed=33&faction=egyptian&autostart=1` — overview (zoom out fully), normal, close (zoom in fully); check
   shallow/deep distinction, seabed in the shallows, no visible hex steps, shore band, gentle wave motion.
3. Twilight towns: play or end turns to turn 31+ in any game (End Turn repeatedly, or `&diff=easy` for a faster game) — windows and
   lanterns should glow; water turns violet-blue.
4. Miracles: in scene 1 cast powers 6–9 on valid targets (keys 6–9, then click a highlighted hex) — each must have its own form; the
   target hex must stay readable.
5. Weather: keep ending turns until a front appears (forecast ring, then rain, storm, drought, frost or omen) — rain should slant, forests
   should sway harder; controls and labels must stay readable.

## Settings to try (⚙ Settings)
Graphics quality High and Low; Reduced motion on (people stand still, lights stay on, no world-light flash); Flashes off; High contrast
on; Patterned borders on. On touch devices also try pinch zoom, two-finger pan and tapping small towns.

## What to look for
Stutter or uneven frame pacing while panning or during a miracle; text or icons too small to read on the phone; people, cloth or effects
covering a target, label or shrine; shimmering or crawling textures at overview zoom; colour banding in water or sky; anything drawn over
fog that should be hidden; touch targets that are hard to hit; any console error (desktop: F12 → Console).

## Recording a result
For each scene note: device and browser (with version), screen size, quality setting, whether it felt smooth (and, if the browser offers
it, the FPS meter reading), and any defect. Attach screenshots (desktop: the browser's screenshot; phones: the system screenshot) and add
them as a comment on draft PR #1, or commit them under `reports/visual-qa/device/` with a short `README.md` naming the device and commit.
