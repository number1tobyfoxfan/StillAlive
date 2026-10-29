/**
 * audio.js - Retro 8-bit buzzer sound synthesizer and cross-platform audio player
 * Emulates the motherboard PC speaker buzzer used in the original C++ StillAlive project.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

function commandExists(cmd) {
  try {
    const testCmd = process.platform === 'win32' ? `where ${cmd}` : `command -v ${cmd}`;
    const res = spawnSync(testCmd, { shell: true, stdio: 'ignore' });
    return res.status === 0;
  } catch {
    return false;
  }
}

/**
 * Builds a 16-bit mono PCM WAV file in memory
 */
function createWavBuffer(samples, sampleRate = 44100) {
  const numChannels = 1;
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // 16 for PCM
  buffer.writeUInt16LE(1, 20);  // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
  buffer.writeUInt16LE(bytesPerSample * 8, 34);

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    buffer.writeInt16LE(samples[i], 44 + i * 2);
  }

  return buffer;
}

/**
 * Synthesizes note frequencies into a retro square wave (PC buzzer sound)
 */
function synthesizeNotes(notes, speedMultiplier = 1, sampleRate = 44100) {
  let totalSamples = 0;
  for (const n of notes) {
    const durSec = (n.duration / 1000) / speedMultiplier;
    totalSamples += Math.floor(durSec * sampleRate);
  }

  const samples = new Int16Array(totalSamples);
  let offset = 0;

  for (const n of notes) {
    const durSec = (n.duration / 1000) / speedMultiplier;
    const count = Math.floor(durSec * sampleRate);
    if (count <= 0) continue;

    if (n.tone === 0) {
      // Silence
      offset += count;
      continue;
    }

    const tone = n.tone;
    const invSampleRate = 1 / sampleRate;
    const twoPiTone = 2 * Math.PI * tone;
    const fadeCount = Math.min(Math.floor(sampleRate * 0.004), Math.floor(count / 4));

    for (let i = 0; i < count; i++) {
      let amp = 5500; // buzzer volume
      if (i < fadeCount) {
        amp = amp * (i / fadeCount);
      } else if (i > count - fadeCount) {
        amp = amp * ((count - i) / fadeCount);
      }
      // Square wave
      const sample = Math.sin(twoPiTone * (i * invSampleRate)) >= 0 ? amp : -amp;
      samples[offset + i] = Math.round(sample);
    }

    offset += count;
  }

  return createWavBuffer(samples, sampleRate);
}

/**
 * Detects an audio playback command supported on this system
 */
function detectAudioPlayer() {
  if (process.platform === 'linux') {
    if (commandExists('aplay')) {
      return { cmd: 'aplay', getArgs: (file) => ['-q', file] };
    }
    if (commandExists('paplay')) {
      return { cmd: 'paplay', getArgs: (file) => [file] };
    }
    if (commandExists('ffplay')) {
      return { cmd: 'ffplay', getArgs: (file) => ['-nodisp', '-autoexit', '-loglevel', 'quiet', file] };
    }
  }

  if (process.platform === 'darwin') {
    if (commandExists('afplay')) {
      return { cmd: 'afplay', getArgs: (file) => [file] };
    }
    if (commandExists('ffplay')) {
      return { cmd: 'ffplay', getArgs: (file) => ['-nodisp', '-autoexit', '-loglevel', 'quiet', file] };
    }
  }

  if (process.platform === 'win32') {
    return {
      cmd: 'powershell',
      getArgs: (file) => [
        '-NoProfile',
        '-Command',
        `(New-Object Media.SoundPlayer '${file.replace(/'/g, "''")}').PlaySync()`
      ]
    };
  }

  return null;
}

/**
 * Plays a WAV buffer asynchronously
 */
function playWavBuffer(wavBuffer, player) {
  if (!player) {
    return {
      stop: () => {},
      promise: Promise.resolve()
    };
  }

  const tmpFile = path.join(os.tmpdir(), `still_alive_${Date.now()}_${process.pid}.wav`);
  try {
    fs.writeFileSync(tmpFile, wavBuffer);
  } catch (err) {
    return {
      stop: () => {},
      promise: Promise.resolve()
    };
  }

  const proc = spawn(player.cmd, player.getArgs(tmpFile), {
    stdio: 'ignore'
  });

  const cleanupTmp = () => {
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch (_) {}
  };

  const stop = () => {
    try {
      proc.kill('SIGTERM');
    } catch (_) {}
    cleanupTmp();
  };

  const promise = new Promise((resolve) => {
    proc.on('close', () => {
      cleanupTmp();
      resolve();
    });
    proc.on('error', () => {
      cleanupTmp();
      resolve();
    });
  });

  return { process: proc, promise, stop };
}

module.exports = {
  synthesizeNotes,
  detectAudioPlayer,
  playWavBuffer
};
