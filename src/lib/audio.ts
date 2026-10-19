/** Synthesised audio: UI chimes and seamless ambient soundscapes (no audio files needed, works offline). */
import { db } from '../db/database';

let ctx: AudioContext | null = null;
const getCtx = () => {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ||= new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
};
/** Call from a user gesture so later timers can play sound. */
export const unlockAudio = () => void getCtx();

export function chime(kind: 'rest' | 'complete' | 'pr' = 'rest') {
  if (db.get('app_settings', 'feedback')?.value === '0') return;
  const c = getCtx();
  if (!c) return;
  const notes = kind === 'pr' ? [659, 784, 988, 1319] : kind === 'complete' ? [523, 659, 784] : [880, 1175];
  notes.forEach((f, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = f;
    const t = c.currentTime + i * 0.16;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.55);
  });
}

export type Soundscape = 'rain' | 'white' | 'cafe' | 'forest' | 'mute';
let ambient: { nodes: AudioNode[]; sources: AudioScheduledSourceNode[]; master: GainNode; timers: number[] } | null = null;

function noiseBuffer(c: AudioContext, kind: 'white' | 'pink' | 'brown', seconds = 6) {
  const len = c.sampleRate * seconds;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w;
    else if (kind === 'pink') {
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
  }
  // Crossfade the loop seam so it repeats without a click.
  const fade = Math.floor(c.sampleRate * 0.25);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    d[i] = d[i] * t + d[len - fade + i] * (1 - t);
  }
  return buf;
}

function loopSource(c: AudioContext, kind: 'white' | 'pink' | 'brown') {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, kind);
  src.loop = true;
  src.loopEnd = src.buffer.duration - 0.25;
  return src;
}

export function stopAmbient() {
  if (!ambient) return;
  const a = ambient;
  ambient = null;
  const c = ctx;
  a.timers.forEach((t) => clearInterval(t));
  try {
    if (c) a.master.gain.linearRampToValueAtTime(0, c.currentTime + 0.3);
  } catch { /* ignore */ }
  setTimeout(() => {
    a.sources.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } });
    a.nodes.forEach((n) => n.disconnect());
  }, 400);
}

export function playAmbient(kind: Soundscape, volume = 0.5) {
  stopAmbient();
  if (kind === 'mute') return;
  const c = getCtx();
  if (!c) return;
  const master = c.createGain();
  master.gain.value = 0;
  master.gain.linearRampToValueAtTime(volume * 0.6, c.currentTime + 0.6);
  master.connect(c.destination);
  const nodes: AudioNode[] = [master];
  const sources: AudioScheduledSourceNode[] = [];
  const timers: number[] = [];
  const chain = (src: AudioBufferSourceNode, ...fx: AudioNode[]) => {
    let prev: AudioNode = src;
    for (const n of fx) { prev.connect(n); prev = n; nodes.push(n); }
    prev.connect(master);
    sources.push(src);
    src.start();
  };
  const filter = (type: BiquadFilterType, freq: number, q = 0.7) => {
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f;
  };
  const gain = (v: number) => { const g = c.createGain(); g.gain.value = v; return g; };

  if (kind === 'white') chain(loopSource(c, 'white'), filter('lowpass', 9000), gain(0.5));
  else if (kind === 'rain') {
    chain(loopSource(c, 'white'), filter('highpass', 1200), filter('lowpass', 8000), gain(0.55));
    chain(loopSource(c, 'pink'), filter('lowpass', 600), gain(0.5));
  } else if (kind === 'cafe') {
    chain(loopSource(c, 'brown'), filter('bandpass', 500, 0.6), gain(1.1));
    const murmur = loopSource(c, 'pink');
    const mg = gain(0.5);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.35;
    const lg = gain(0.3); lfo.connect(lg).connect(mg.gain); lfo.start(); sources.push(lfo); nodes.push(lg);
    chain(murmur, filter('bandpass', 1100, 1.2), mg);
    timers.push(window.setInterval(() => { // occasional cup clink
      if (Math.random() > 0.4) return;
      const o = c.createOscillator(); const g = gain(0); o.type = 'triangle';
      o.frequency.value = 2400 + Math.random() * 1600;
      g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.25);
      o.connect(g).connect(master); o.start(); o.stop(c.currentTime + 0.3);
    }, 2500));
  } else if (kind === 'forest') {
    chain(loopSource(c, 'pink'), filter('lowpass', 900), gain(0.6)); // wind
    timers.push(window.setInterval(() => { // bird chirps
      if (Math.random() > 0.5) return;
      const o = c.createOscillator(); const g = gain(0); o.type = 'sine';
      const base = 2200 + Math.random() * 1800; const t = c.currentTime;
      o.frequency.setValueAtTime(base, t); o.frequency.linearRampToValueAtTime(base * 1.4, t + 0.12);
      o.frequency.linearRampToValueAtTime(base * 0.9, t + 0.22);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g).connect(master); o.start(t); o.stop(t + 0.3);
    }, 1800));
  }
  ambient = { nodes, sources, master, timers };
}
export const setAmbientVolume = (v: number) => {
  if (ambient && ctx) ambient.master.gain.setTargetAtTime(v * 0.6, ctx.currentTime, 0.1);
};
