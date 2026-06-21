// Web Audio 절차적 SFX 합성 툴킷 — 외부 음원 0(로딩 렉 없음). 모든 보이스는 짧고 자동 정리(stop→GC).
// 품질 원칙: ①클릭 없는 부드러운 어택(0.0001→ramp) ②생노이즈 대신 필터드 노이즈(따뜻함) ③배음 적층+미세 디튠
// ④낮은 볼륨·짧은 길이로 동시 보이스 적게(렉 0). 거슬리지 않게 전부 작고 둥글게.

let sharedNoise: AudioBuffer | null = null;
function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (sharedNoise && sharedNoise.sampleRate === ctx.sampleRate) return sharedNoise;
  const len = Math.floor(ctx.sampleRate * 0.6);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  sharedNoise = buf;
  return buf;
}

function envGain(ctx: AudioContext, dest: AudioNode, t: number, vol: number, attack: number, dur: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.max(0.004, attack));
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack + 0.02, dur));
  g.connect(dest);
  return g;
}

export interface ToneOpts { freq: number; freq2?: number; dur?: number; type?: OscillatorType; vol?: number; attack?: number; detune?: number; delay?: number; }

// 한 성부 — 선택적 글라이드(freq→freq2)·디튠.
export function tone(ctx: AudioContext, dest: AudioNode, o: ToneOpts) {
  const t = ctx.currentTime + (o.delay ?? 0);
  const dur = o.dur ?? 0.12;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.freq2 && o.freq2 !== o.freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freq2), t + dur);
  if (o.detune) osc.detune.setValueAtTime(o.detune, t);
  osc.connect(envGain(ctx, dest, t, o.vol ?? 0.03, o.attack ?? Math.min(0.02, dur * 0.25), dur));
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export interface NoiseOpts { dur?: number; vol?: number; type?: BiquadFilterType; cutoff?: number; cutoff2?: number; q?: number; attack?: number; delay?: number; }

// 필터드 노이즈 버스트 — 타격/파기/발소리/휘익. cutoff 스윕으로 질감을 준다.
export function noise(ctx: AudioContext, dest: AudioNode, o: NoiseOpts) {
  const t = ctx.currentTime + (o.delay ?? 0);
  const dur = o.dur ?? 0.12;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.playbackRate.setValueAtTime(0.8 + Math.random() * 0.4, t);
  const filter = ctx.createBiquadFilter();
  filter.type = o.type ?? "lowpass";
  filter.Q.setValueAtTime(o.q ?? 0.9, t);
  filter.frequency.setValueAtTime(o.cutoff ?? 900, t);
  if (o.cutoff2) filter.frequency.exponentialRampToValueAtTime(Math.max(60, o.cutoff2), t + dur);
  src.connect(filter).connect(envGain(ctx, dest, t, o.vol ?? 0.02, o.attack ?? 0.003, dur));
  src.start(t);
  src.stop(t + dur + 0.05);
}

// 종/벨 적층 — 줍기/제작/완료/레벨업. 기음 + 배음들, 부드럽게 울림.
export function chime(ctx: AudioContext, dest: AudioNode, freqs: readonly number[], vol = 0.03, gap = 0.05, dur = 0.5) {
  freqs.forEach((f, i) => {
    tone(ctx, dest, { freq: f, type: "sine", vol, dur, attack: 0.006, delay: i * gap });
    tone(ctx, dest, { freq: f * 2.01, type: "sine", vol: vol * 0.35, dur: dur * 0.7, attack: 0.004, delay: i * gap }); // 옥타브 배음 = 벨 광택
  });
}

// 타격 임팩트 — 톤 thunk(몸통) + 노이즈 transient(타격감). 적 피격/근접 명중. 저역은 안 깐다(오류음 방지) — 중역 thunk + 밝은 노이즈.
export function impact(ctx: AudioContext, dest: AudioNode, body: number, vol = 0.04, bright = 1) {
  tone(ctx, dest, { freq: body, freq2: body * 0.78, type: "triangle", vol, dur: 0.1, attack: 0.002 });
  tone(ctx, dest, { freq: body * 0.78, type: "sine", vol: vol * 0.7, dur: 0.11, attack: 0.002 });
  noise(ctx, dest, { type: "bandpass", cutoff: 2600 * bright, cutoff2: 900, q: 0.7, vol: vol * 0.6, dur: 0.07 });
}

// 공격 휘두르기 — 짧은 휘익(밴드패스 노이즈 하강 스윕) + 미세 저음.
export function whoosh(ctx: AudioContext, dest: AudioNode, vol = 0.03, high = 1600) {
  noise(ctx, dest, { type: "bandpass", cutoff: high, cutoff2: 320, q: 1.1, vol, dur: 0.13, attack: 0.012 });
  tone(ctx, dest, { freq: 210, freq2: 120, type: "sine", vol: vol * 0.5, dur: 0.12, attack: 0.01 });
}
