// 실음원(CC0) BGM 재생기 — fetch+decodeAudioData 1회 후 AudioBuffer 무한 루프. 트랙 간 크로스페이드.
// 맵별 lazy 로드(현재 트랙만 받음) → 첫 진입 1회만 네트워크, 이후 프레임 비용 0(렉 없음).
// 로드 전/실패 시 isPlaying()=false → 호출측이 절차적 BGM 으로 폴백.

interface Deck { source: AudioBufferSourceNode; gain: GainNode; }

export interface MusicPlayer {
  setTrack(url: string | null, opts?: { volume?: number; fadeMs?: number }): void;
  isPlaying(): boolean; // 실음원 데크가 살아있나(절차적 BGM 음소거 판단용)
}

export function createMusicPlayer(ctx: AudioContext, destination: AudioNode): MusicPlayer {
  const buffers = new Map<string, AudioBuffer>();
  const loading = new Set<string>();
  let wantUrl: string | null = null;
  let wantVol = 0.4;
  let wantFade = 1500;
  let deck: Deck | null = null;
  let deckUrl: string | null = null;

  const fadeOut = (d: Deck, fadeMs: number) => {
    const t = ctx.currentTime;
    d.gain.gain.cancelScheduledValues(t);
    d.gain.gain.setValueAtTime(Math.max(0.0001, d.gain.gain.value), t);
    d.gain.gain.linearRampToValueAtTime(0.0001, t + fadeMs / 1000);
    try { d.source.stop(t + fadeMs / 1000 + 0.08); } catch { /* 이미 정지 */ }
  };

  function startDeck(url: string, buffer: AudioBuffer, vol: number, fadeMs: number) {
    if (deck) fadeOut(deck, fadeMs); // 이전 트랙 페이드아웃(크로스페이드)
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + fadeMs / 1000);
    source.connect(gain).connect(destination);
    source.start(t);
    deck = { source, gain };
    deckUrl = url;
  }

  function ensureLoaded(url: string, vol: number, fadeMs: number) {
    const buf = buffers.get(url);
    if (buf) { if (deckUrl !== url) startDeck(url, buf, vol, fadeMs); return; }
    if (loading.has(url)) return;
    loading.add(url);
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((ab) => ctx.decodeAudioData(ab))
      .then((buffer) => { loading.delete(url); buffers.set(url, buffer); if (wantUrl === url) startDeck(url, buffer, wantVol, wantFade); }) // 여전히 그 트랙 원할 때만 재생
      .catch(() => { loading.delete(url); }); // 실패 → 절차적 BGM 폴백
  }

  return {
    setTrack(url, opts) {
      wantVol = opts?.volume ?? 0.4;
      wantFade = opts?.fadeMs ?? 1500;
      if (url === wantUrl) { if (deck && deckUrl === url) deck.gain.gain.setTargetAtTime(wantVol, ctx.currentTime, 0.6); return; } // 같은 트랙이면 볼륨만 갱신
      wantUrl = url;
      if (!url) { if (deck) { fadeOut(deck, wantFade); deck = null; deckUrl = null; } return; }
      ensureLoaded(url, wantVol, wantFade);
    },
    isPlaying: () => deck !== null,
  };
}
