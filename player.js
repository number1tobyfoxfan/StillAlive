/**
 * player.js - Terminal UI and song player for Portal - Still Alive
 * Implements ncurses-like split-screen layout in pure Node.js ANSI terminal.
 */

const readline = require('readline');
const { COMMAND, ASCII_IMAGES, asciiImages, lyrics, notes } = require('./song_data');
const { synthesizeNotes, detectAudioPlayer, playWavBuffer, playAudioFile } = require('./audio');

// Color themes
const THEMES = {
  amber: '\x1b[38;5;214m\x1b[40m', // authentic retro amber CRT
  yellow: '\x1b[33m\x1b[40m',       // standard yellow on black (ncurses pair 1)
  green: '\x1b[32m\x1b[40m',        // retro green phosphor
  cyan: '\x1b[36m\x1b[40m',         // aperture cyan
  white: '\x1b[37m\x1b[40m'         // monochrome white
};

const RESET = '\x1b[0m';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Player {
  constructor(options = {}) {
    this.speedMultiplier = options.speed || (options.fast ? 5 : 1);
    this.mute = Boolean(options.mute);
    this.testMode = Boolean(options.test);
    this.poweroff = Boolean(options.poweroff);
    this.theme = THEMES[options.color] || THEMES.yellow;
    this.audioFile = options.audioFile || null;
    this.audioOffset = options.audioOffset !== undefined ? options.audioOffset : null;

    // Box dimensions from original C++ StillAlive
    this.bordersWidth = 102;
    this.bordersHeight = 38;

    this.lyricsWidth = 51;
    this.lyricsHeight = 36;

    this.creatorsWidth = 51;
    this.creatorsHeight = 16;

    this.asciiX = 57;
    this.asciiY = 16;
    this.asciiWidth = 42;
    this.asciiHeight = 20;

    this.zeroX = 1;
    this.zeroY = 1;

    this.rowToPrint = 1;
    this.startPrintPosX = 2;

    this.audioProcess = null;
    this.audioTimer = null;
    this.stopped = false;
  }

  getFirstNoteTimeMs() {
    let time = 0;
    for (const n of notes) {
      if (n.tone > 0) return time;
      time += n.duration;
    }
    return 2000;
  }

  initScreen() {
    // Hide cursor and set colors
    process.stdout.write(HIDE_CURSOR + this.theme);
    this.updateDimensions();
    this.clearScreen();
    this.printBorders();
  }

  updateDimensions() {
    const cols = process.stdout.columns || 120;
    const rows = process.stdout.rows || 40;

    // Center layout on screen (1-indexed for ANSI cursor)
    this.zeroX = Math.max(1, Math.floor((cols - this.bordersWidth) / 2) + 1);
    this.zeroY = Math.max(1, Math.floor((rows - this.bordersHeight) / 2) + 1);
  }

  clearScreen() {
    process.stdout.write('\x1b[2J\x1b[3J\x1b[H' + this.theme);
  }

  moveTo(row, col) {
    const absRow = this.zeroY + row;
    const absCol = this.zeroX + col;
    process.stdout.write(`\x1b[${absRow};${absCol}H`);
  }

  printBorders() {
    // 1. Draw lyricsBox (width 51, height 36) at relative (0, 0)
    // Top border
    this.moveTo(0, 0);
    process.stdout.write(' ' + '-'.repeat(this.lyricsWidth - 2) + ' ');

    // Side borders
    for (let r = 1; r < this.lyricsHeight - 1; r++) {
      this.moveTo(r, 0);
      process.stdout.write('|' + ' '.repeat(this.lyricsWidth - 2) + '|');
    }

    // Bottom border
    this.moveTo(this.lyricsHeight - 1, 0);
    process.stdout.write(' ' + '-'.repeat(this.lyricsWidth - 2) + ' ');

    // 2. Draw creatorsBox (width 51, height 16) at relative (51, 0)
    const cX = 51;
    this.moveTo(0, cX);
    process.stdout.write(' ' + '-'.repeat(this.creatorsWidth - 2) + ' ');

    for (let r = 1; r < this.creatorsHeight - 1; r++) {
      this.moveTo(r, cX);
      process.stdout.write('|' + ' '.repeat(this.creatorsWidth - 2) + '|');
    }

    this.moveTo(this.creatorsHeight - 1, cX);
    process.stdout.write(' ' + '-'.repeat(this.creatorsWidth - 2) + ' ');

    // Creator box text
    this.moveTo(2, cX + 15);
    process.stdout.write('PORTAL - STILL ALIVE');

    this.moveTo(4, cX + 8);
    const audioDesc = this.audioFile ? 'Playing audio file: ' + require('path').basename(this.audioFile).slice(0, 20) : 'Played by motherboard buzzer';
    process.stdout.write(audioDesc.padEnd(38, ' '));

    this.moveTo(13, cX + 2);
    process.stdout.write('The code was written by CATDIMA');

    this.moveTo(14, cX + 2);
    process.stdout.write('on 02/09/2024');
  }

  clearLyricsWindow() {
    for (let r = 1; r < this.lyricsHeight - 1; r++) {
      this.moveTo(r, 1);
      process.stdout.write(' '.repeat(this.lyricsWidth - 2));
    }
    this.rowToPrint = 1;
    this.startPrintPosX = 2;
  }

  printAscii(imgIndex) {
    const lines = asciiImages[imgIndex];
    if (!lines) return;

    for (let r = 0; r < lines.length && r < this.asciiHeight; r++) {
      this.moveTo(this.asciiY + r, this.asciiX);
      const lineText = lines[r].padEnd(this.asciiWidth, ' ');
      process.stdout.write(lineText);
    }
  }

  drawChar(row, col, char) {
    if (row >= this.lyricsHeight - 1) return; // avoid overflowing bottom border
    this.moveTo(row, col);
    process.stdout.write(char);
  }

  async play() {
    this.initScreen();

    // 1. Audio setup
    if (!this.mute) {
      if (this.audioFile) {
        // Play external music file. Start when the first note usually plays!
        const delayMs = (this.audioOffset !== null
          ? this.audioOffset
          : this.getFirstNoteTimeMs()) / this.speedMultiplier;

        if (delayMs <= 0) {
          this.audioProcess = playAudioFile(this.audioFile);
        } else {
          this.audioTimer = setTimeout(() => {
            if (!this.stopped) {
              this.audioProcess = playAudioFile(this.audioFile);
            }
          }, delayMs);
        }
      } else {
        // Default: synthesize and play 8-bit retro buzzer square wave notes
        const playerInfo = detectAudioPlayer();
        if (playerInfo) {
          const wavBuffer = synthesizeNotes(notes, this.speedMultiplier);
          this.audioProcess = playWavBuffer(wavBuffer, playerInfo);
        }
      }
    }

    // 2. Play lyrics and display animation
    const songList = this.testMode ? lyrics.slice(0, 15) : lyrics;

    for (const item of songList) {
      if (this.stopped) break;

      let { text, duration } = item;
      const totalDurMs = duration / this.speedMultiplier;

      if (!text || text.length === 0) {
        if (totalDurMs > 0) {
          await sleep(totalDurMs);
        }
        continue;
      }

      // Check for commands at start of text
      let code = text.charCodeAt(0);
      if (code === COMMAND.CHANGE_IMAGE) {
        const imgId = text.charCodeAt(1);
        this.printAscii(imgId);
        text = text.substring(2);
      }

      code = text.charCodeAt(0);
      if (code === COMMAND.CLEAR) {
        this.clearLyricsWindow();
        text = text.substring(1);
      }

      if (text.length === 0) {
        if (totalDurMs > 0) {
          await sleep(totalDurMs);
        }
        continue;
      }

      // Type out symbols
      const msPerSymbol = Math.max(1, Math.floor(totalDurMs / text.length));

      for (let i = 0; i < text.length; i++) {
        if (this.stopped) break;

        const ch = text[i];
        if (ch === '\n') {
          this.rowToPrint++;
          this.startPrintPosX = 2;
        } else {
          this.drawChar(this.rowToPrint, this.startPrintPosX, ch);
          this.startPrintPosX++;
        }

        if (msPerSymbol > 0) {
          await sleep(msPerSymbol);
        }
      }
    }

    // Wait for audio completion or brief pause
    if (this.testMode) {
      await sleep(500);
    } else if (this.audioProcess && !this.stopped) {
      await Promise.race([this.audioProcess.promise, sleep(3000)]);
    }

    this.cleanup();

    // Handle poweroff flag if specified
    if (this.poweroff) {
      this.handlePoweroff();
    }
  }

  handlePoweroff() {
    const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
    if (isRoot) {
      const { execSync } = require('child_process');
      try {
        console.log('Shutting down system as requested...');
        execSync('systemctl poweroff', { stdio: 'inherit' });
      } catch (e) {
        console.error('Failed to power off:', e.message);
      }
    } else {
      console.log('Notice: -p / --poweroff requires root privileges (run with sudo).');
    }
  }

  cleanup() {
    this.stopped = true;
    if (this.audioTimer) {
      clearTimeout(this.audioTimer);
      this.audioTimer = null;
    }
    if (this.audioProcess) {
      this.audioProcess.stop();
      this.audioProcess = null;
    }
    // Restore cursor and terminal color, move below borders
    process.stdout.write(SHOW_CURSOR + RESET + `\x1b[${this.zeroY + this.bordersHeight + 1};1H\n`);
  }
}

module.exports = Player;
