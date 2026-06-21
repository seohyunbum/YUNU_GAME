// 원샷 효과음 샘플 재생 — 짧은 ogg 를 preload(decode)해두고 play(name) 으로 즉시 재생(겹침 허용).
// 미로드/실패 시 play 가 false 반환 → 호출측이 절차적 합성으로 폴백(무음 없음). 샘플은 작아 preload 비용 적고 재생은 프레임당 한둘.

export interface SfxPlayer {
  preload(names: readonly string[]): void;
  play(name: string, opts?: { volume?: number; rate?: number }): boolean;
}

export function createSfxPlayer(ctx: AudioContext, dest: AudioNode, baseUrl: string): SfxPlayer {
  const buffers = new Map<string, AudioBuffer>();
  const loading = new Set<string>();

  const load = (name: string) => {
    if (buffers.has(name) || loading.has(name)) return;
    loading.add(name);
    fetch(`${baseUrl}sfx/${name}.ogg`)
      .then((r) => r.arrayBuffer())
      .then((ab) => ctx.decodeAudioData(ab))
      .then((buf) => { loading.delete(name); buffers.set(name, buf); })
      .catch(() => { loading.delete(name); }); // 실패 → 폴백 유지
  };

  return {
    preload(names) { for (const n of names) load(n); },
    play(name, opts) {
      const buf = buffers.get(name);
      if (!buf) { load(name); return false; } // 아직 미로드 → 이번엔 폴백, 다음을 위해 로드 시작
      const src = ctx.createBufferSource();
      src.buffer = buf;
      if (opts?.rate) src.playbackRate.value = opts.rate;
      const g = ctx.createGain();
      g.gain.value = opts?.volume ?? 0.5;
      src.connect(g).connect(dest);
      src.start();
      try { src.stop(ctx.currentTime + buf.duration + 0.05); } catch { /* noop */ }
      return true;
    },
  };
}
