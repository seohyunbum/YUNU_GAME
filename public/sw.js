// 야생 마을 PWA 서비스워커 — 설치 가능성 + 오프라인(재방문) 지원.
// 전략: HTML(내비게이션)은 network-first(새 배포 즉시 반영), 해시된 정적 자원은
// stale-while-revalidate(빠른 로드 + 백그라운드 갱신). 오디오·range·교차출처는 통과(캐시 안 함).
// Vite 자산은 내용해시 파일명이라 URL 단위 캐시가 안전하며, activate 에서 옛 캐시를 정리한다.
const CACHE = "yunu-village-v1";
const AUDIO_RE = /\.(mp3|ogg|wav|m4a)$/i;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  // 앱 셸(현재 디렉터리)만 선캐시 — 해시 자산은 런타임에 채운다.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(new Request("./", { cache: "reload" })).catch(() => {})));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 교차출처(파이어베이스 등) 통과
  if (req.headers.has("range") || AUDIO_RE.test(url.pathname)) return; // 오디오·부분요청은 네트워크 그대로(Cache API range 미지원)

  // 내비게이션/HTML → network-first(새 배포 즉시), 실패 시 캐시 폴백.
  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("./"))),
    );
    return;
  }

  // 그 외 정적 자원 → stale-while-revalidate.
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; })
        .catch(() => hit);
      return hit || network;
    }),
  );
});
