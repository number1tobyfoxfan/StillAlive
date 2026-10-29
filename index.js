#!/usr/bin/env node

/**
 * Portal - Still Alive (Node.js edition)
 * Terminal recreation with ASCII art, synchronized lyrics, and retro buzzer music or custom audio file.
 * Original C++ code by CATDIMA (2024).
 */

const fs = require('fs');
const path = require('path');
const Player = require('./player');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    poweroff: false,
    fast: false,
    mute: false,
    test: false,
    color: 'yellow',
    speed: 1,
    audioFile: null,
    audioOffset: undefined,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else if (arg === '-p' || arg === '--poweroff') {
      options.poweroff = true;
    } else if (arg === '-f' || arg === '--fast') {
      options.fast = true;
    } else if (arg === '-m' || arg === '--no-audio' || arg === '--mute') {
      options.mute = true;
    } else if (arg === '-t' || arg === '--test') {
      options.test = true;
      options.fast = true;
      options.speed = 10;
    } else if ((arg === '-c' || arg === '--color') && i + 1 < args.length) {
      options.color = args[++i];
    } else if ((arg === '-s' || arg === '--speed') && i + 1 < args.length) {
      options.speed = parseFloat(args[++i]) || 1;
    } else if ((arg === '-a' || arg === '--audio' || arg === '--audio-file' || arg === '--music' || arg === '--music-file') && i + 1 < args.length) {
      options.audioFile = args[++i];
    } else if ((arg === '-o' || arg === '--offset' || arg === '--audio-offset') && i + 1 < args.length) {
      options.audioOffset = parseFloat(args[++i]);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Portal - Still Alive (Node.js edition)

Usage:
  node index.js [options]
  npm start -- [options]
  ./index.js [options]

Options:
  -h, --help                Show this help screen
  -a, --music-file <path>   Play an audio/music file (MP3, WAV, OGG, FLAC, M4A)
                            instead of the synthesized buzzer. Starts when the
                            first note usually plays (at 2.0s)!
  -o, --audio-offset <ms>   Custom delay in milliseconds before audio starts (default: 2000)
  -f, --fast                Run at 5x fast-forward speed
  -s, --speed <num>         Set custom speed multiplier (e.g. 2 for 2x speed)
  -m, --mute, --no-audio     Disable music playback
  -c, --color <name>        Theme color: yellow (default), amber, green, cyan, white
  -p, --poweroff            Power off system after song finishes (requires root)
  -t, --test                Rapid test run (for automated testing / preview)

Controls:
  Press Ctrl+C at any time to exit cleanly.
`);
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    return;
  }

  // Validate audio file if specified
  if (options.audioFile) {
    const resolvedPath = path.resolve(options.audioFile);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`Error: Audio file not found at: ${options.audioFile}`);
      process.exit(1);
    }
    options.audioFile = resolvedPath;
  }

  const player = new Player(options);

  const cleanup = () => {
    player.cleanup();
  };

  process.on('SIGINT', () => {
    cleanup();
    process.exit(130);
  });

  process.on('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });

  process.on('exit', () => {
    cleanup();
  });

  try {
    await player.play();
  } catch (err) {
    cleanup();
    console.error('Error running Still Alive:', err);
    process.exit(1);
  }
}

main();
