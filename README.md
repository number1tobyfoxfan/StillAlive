# Portal - Still Alive (Node.js)

> *This was a triumph. I'm making a note here: HUGE SUCCESS.*

A terminal recreation of the Portal ending credits song ("Still Alive") with synchronized lyrics, split-screen terminal layout, retro ASCII art, and authentic 8-bit PC speaker buzzer sound synthesized in real-time.

Originally written in C++ by [CATDIMA](https://github.com/CATDIMA/StillAlive.git) for Linux tty motherboard buzzers, now running natively on **JavaScript / Node.js** cross-platform without needing a physical motherboard buzzer or C++ compilation.

Original song composed by Jonathan Coulton.

___

## Quick Start

No build steps or npm installations needed! Just Node.js (v14+):

```bash
# Clone the repository
git clone https://github.com/CATDIMA/StillAlive.git
cd StillAlive

# Run with Node.js
node index.js

# Or using npm
npm start
```

## Options & Flags

```bash
node index.js [options]
```

| Option | Description |
|---|---|
| `-h, --help` | Show help screen |
| `-f, --fast` | Run at 5x fast-forward speed |
| `-s, --speed <multiplier>` | Custom playback speed (e.g. `node index.js -s 2` for 2x) |
| `-m, --mute, --no-audio` | Run silently without audio |
| `-c, --color <theme>` | Terminal color: `yellow` (default), `amber`, `green`, `cyan`, `white` |
| `-p, --poweroff` | Shut down system after song finishes (requires root/sudo) |
| `-t, --test` | Rapid test run (for preview / automated testing) |

Press `Ctrl+C` at any time to exit cleanly.

## Requirements

- **Node.js**: v14.0.0 or higher
- **Audio player** (standard on almost all OSes):
  - Linux: `aplay` (ALSA), `paplay` (PulseAudio / PipeWire), or `ffplay`
  - macOS: `afplay` (built-in)
  - Windows: PowerShell (built-in)
- **Terminal size**: Recommended at least 102 columns by 38 rows for full split-screen presentation.

## License

GPL-3.0
