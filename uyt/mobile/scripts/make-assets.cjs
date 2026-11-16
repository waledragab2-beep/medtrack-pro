/**
 * Generates the alert sound (assets/sounds/ready.wav) – a 3-note chime repeated twice, 16-bit PCM mono.
 * Run: node scripts/make-assets.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const rate = 44100;
const notes = [880, 1175, 1568];
const dur = 2.4;
const samples = new Int16Array(Math.floor(rate * dur));
for (let rep = 0; rep < 2; rep++) {
  notes.forEach((f, i) => {
    const start = rep * 1.2 + i * 0.16;
    for (let n = 0; n < rate * 0.6; n++) {
      const t = n / rate;
      const idx = Math.floor((start + t) * rate);
      if (idx >= samples.length) break;
      const env = Math.min(1, t / 0.01) * Math.exp(-t * 6);
      const v = Math.sin(2 * Math.PI * f * t) * 0.55 + Math.sin(4 * Math.PI * f * t) * 0.12;
      samples[idx] = Math.max(-32767, Math.min(32767, samples[idx] + v * env * 0.6 * 32767));
    }
  });
}
const data = Buffer.from(samples.buffer);
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
header.write('data', 36); header.writeUInt32LE(data.length, 40);
fs.writeFileSync(path.join(__dirname, '../assets/sounds/ready.wav'), Buffer.concat([header, data]));
console.log('ready.wav written');
