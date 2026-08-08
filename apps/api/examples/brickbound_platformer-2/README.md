# Brickbound

A polished, original Mario-inspired browser platformer built with plain HTML, CSS and JavaScript. No external assets or libraries are required.

## Features
- Running and variable-height jumping
- Enemies that can be stomped
- Coins, power-ups, checkpoints and goal beacons
- Three distinct levels
- Score, coin count, lives and persistent localStorage high score
- Keyboard and touch controls
- Web Audio sound effects
- Particle effects, camera smoothing and screen shake
- Pause, restart, level-clear, game-over and victory overlays
- Responsive 16:9 layout
- Clean separated HTML / CSS / JS

## Run
Open `index.html` in a modern browser.

For stricter browser environments, serve the folder locally, for example:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Controls
- Left: A / Left Arrow
- Right: D / Right Arrow
- Jump: W / Up Arrow / Space
- Pause: P / Escape
- Restart level: R


## Responsive & physics update

- Light-mode browser chrome and game shell.
- Canvas automatically fits the available browser viewport while preserving the 16:9 game aspect ratio.
- Fixed 120 Hz physics timestep for consistent movement across different display refresh rates.
- Tuned ground/air acceleration, braking, variable jump height, gravity, coyote time, and jump buffering.
