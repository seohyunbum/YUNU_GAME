import type { Region } from "../game/regions";
import { regionMonsterNames } from "../game/regions";
import type { WorldMapDefinition } from "../game/worldMaps";

interface MapWaterZone {
  center: { x: number; z: number };
  radius: number;
  name: string;
}

export interface MapBossMarker {
  name: string;
  x: number;
  z: number;
  sealed: boolean;
  next: boolean;
}

export interface MapPartyMarker {
  nickname: string;
  x: number;
  z: number;
}

export interface MapHomeMarker {
  name: string;
  x: number;
  z: number;
}

export interface MapCaveMarker {
  x: number;
  z: number;
}

export interface RegionMapPanelView {
  regions: Region[];
  currentRegionId: string | null;
  player: { x: number; z: number; yaw: number; level: number };
  worldSize: number;
  waterZones: MapWaterZone[];
  worldMaps: { map: WorldMapDefinition; current: boolean; canTeleport: boolean; lockReason: string }[];
  bosses: MapBossMarker[];
  homes: MapHomeMarker[];
  caves: MapCaveMarker[];
  party: MapPartyMarker[];
}

export interface RegionMapCallbacks {
  onClose: () => void;
  onTeleport: (mapId: string) => void;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function colorHex(value: number) {
  return `#${value.toString(16).padStart(6, "0")}`;
}

function sharesCenter(region: Region, regions: Region[]) {
  return regions.some(
    (other) =>
      other !== region &&
      Math.abs(other.center.x - region.center.x) < 0.001 &&
      Math.abs(other.center.z - region.center.z) < 0.001,
  );
}

export function renderRegionMapPanel(panelEl: HTMLElement, view: RegionMapPanelView, callbacks: RegionMapCallbacks) {
  const size = 720;
  const half = size / 2;
  const scale = size / view.worldSize;
  const mapX = (x: number) => half + x * scale;
  const mapY = (z: number) => half + z * scale;
  const playerX = mapX(view.player.x);
  const playerY = mapY(view.player.z);
  // 바라보는 방향을 한눈에 — 점+선 대신 큰 방향 화살표(삼각형)로 표시
  const fwdX = -Math.sin(view.player.yaw);
  const fwdY = -Math.cos(view.player.yaw);
  const perpX = -fwdY;
  const perpY = fwdX;
  const arrowTip = `${(playerX + fwdX * 28).toFixed(1)},${(playerY + fwdY * 28).toFixed(1)}`;
  const arrowL = `${(playerX + perpX * 13 - fwdX * 7).toFixed(1)},${(playerY + perpY * 13 - fwdY * 7).toFixed(1)}`;
  const arrowR = `${(playerX - perpX * 13 - fwdX * 7).toFixed(1)},${(playerY - perpY * 13 - fwdY * 7).toFixed(1)}`;
  const waters = view.waterZones
    .map((zone) => `<circle cx="${mapX(zone.center.x).toFixed(1)}" cy="${mapY(zone.center.z).toFixed(1)}" r="${(zone.radius * scale).toFixed(1)}" fill="#38bdf8" opacity="0.34"><title>${escapeHtml(zone.name)}</title></circle>`)
    .join("");
  const regions = view.regions
    .map((region) => {
      const selected = region.id === view.currentRegionId;
      const fill = colorHex(region.color);
      const cx = mapX(region.center.x).toFixed(1);
      const cy = mapY(region.center.z).toFixed(1);
      const radius = (region.radius * scale).toFixed(1);
      const inner = region.innerRadius ? `<circle cx="${cx}" cy="${cy}" r="${(region.innerRadius * scale).toFixed(1)}" fill="none" stroke="${fill}" stroke-width="1.5" stroke-dasharray="8 8" opacity="0.55" />` : "";
      const labelRadius = sharesCenter(region, view.regions) ? ((region.innerRadius ?? 0) > 0 ? ((region.innerRadius ?? 0) + region.radius) / 2 : region.radius * 0.5) : 0;
      const labelX = mapX(region.center.x).toFixed(1);
      const labelY = mapY(region.center.z - labelRadius).toFixed(1);
      const labelSize = selected ? 20 : 18;
      const labelFill = selected ? "#ffffff" : "#fff7d6";
      const levelFill = selected ? "#fff2b8" : "#f8e7b6";
      const textHalo = `paint-order="stroke" stroke="#15231d" stroke-width="3.5" stroke-linejoin="round"`;
      return `<g>
        <circle cx="${cx}" cy="${cy}" r="${radius}" fill="${fill}" opacity="${selected ? 0.34 : 0.16}" stroke="${fill}" stroke-width="${selected ? 4 : 2}" />
        ${inner}
        <text x="${labelX}" y="${labelY}" text-anchor="middle" fill="${labelFill}" font-size="${labelSize}" font-weight="800" ${textHalo}>${escapeHtml(region.name)}</text>
        <text x="${labelX}" y="${(Number(labelY) + 21).toFixed(1)}" text-anchor="middle" fill="${levelFill}" font-size="${selected ? 14 : 13}" ${textHalo}>Lv ${region.levelRange[0]}-${region.levelRange[1]}</text>
      </g>`;
    })
    .join("");
  // 보스 마커 — 금색 = 다음 처치 목표, 빨강 = 도전 가능, 회색 = 봉인됨
  const bosses = view.bosses
    .map((boss) => {
      const cx = Number(mapX(boss.x).toFixed(1));
      const cy = Number(mapY(boss.z).toFixed(1));
      const fill = boss.next ? "#fbbf24" : boss.sealed ? "#94a3b8" : "#f87171";
      const label = boss.next ? `${boss.name} · 다음 목표` : boss.sealed ? `${boss.name} · 봉인` : boss.name;
      const textHalo = `paint-order="stroke" stroke="#15231d" stroke-width="3.5" stroke-linejoin="round"`;
      const ring = boss.next ? `<circle cx="${cx}" cy="${cy}" r="17" fill="none" stroke="#fbbf24" stroke-width="2.5" stroke-dasharray="4 5" />` : "";
      return `<g data-boss-marker="${boss.next ? "next" : boss.sealed ? "sealed" : "open"}">
        ${ring}
        <path d="M ${cx} ${cy - 11} L ${cx + 10} ${cy} L ${cx} ${cy + 11} L ${cx - 10} ${cy} Z" fill="${fill}" stroke="#111827" stroke-width="2.5" />
        <text x="${cx}" y="${cy - 17}" text-anchor="middle" fill="${fill}" font-size="14" font-weight="800" ${textHalo}>${escapeHtml(label)}</text>
      </g>`;
    })
    .join("");
  // 내 집 마커 — 초록 지붕 집 모양, 거점 느낌을 준다
  const homes = view.homes
    .map((home) => {
      const cx = Number(mapX(home.x).toFixed(1));
      const cy = Number(mapY(home.z).toFixed(1));
      const textHalo = `paint-order="stroke" stroke="#15231d" stroke-width="3.5" stroke-linejoin="round"`;
      return `<g data-home-marker>
        <rect x="${cx - 7}" y="${cy - 4}" width="14" height="10" fill="#fef3c7" stroke="#111827" stroke-width="2" />
        <path d="M ${cx - 10} ${cy - 3} L ${cx} ${cy - 13} L ${cx + 10} ${cy - 3} Z" fill="#34d399" stroke="#111827" stroke-width="2" />
        <text x="${cx}" y="${cy + 20}" text-anchor="middle" fill="#a7f3d0" font-size="13" font-weight="800" ${textHalo}>${escapeHtml(home.name)}</text>
      </g>`;
    })
    .join("");
  // 동굴 마커 — 현재 스폰된 동굴 입구 위치를 갈색 아치로 표시
  const caves = view.caves
    .map((cave) => {
      const cx = Number(mapX(cave.x).toFixed(1));
      const cy = Number(mapY(cave.z).toFixed(1));
      const textHalo = `paint-order="stroke" stroke="#15231d" stroke-width="3.5" stroke-linejoin="round"`;
      return `<g data-cave-marker>
        <circle cx="${cx}" cy="${cy}" r="7" fill="#3f2d20" stroke="#0f0a06" stroke-width="2" />
        <path d="M ${cx - 4} ${cy + 4} L ${cx - 4} ${cy - 1} Q ${cx} ${cy - 6} ${cx + 4} ${cy - 1} L ${cx + 4} ${cy + 4} Z" fill="#0a0705" />
        <text x="${cx}" y="${cy - 11}" text-anchor="middle" fill="#d4a574" font-size="11" font-weight="800" ${textHalo}>동굴</text>
      </g>`;
    })
    .join("");
  // 파티원 마커 — 하늘색 점 + 닉네임
  const party = view.party
    .map((member) => {
      const cx = Number(mapX(member.x).toFixed(1));
      const cy = Number(mapY(member.z).toFixed(1));
      const textHalo = 'paint-order="stroke" stroke="#15231d" stroke-width="3.5" stroke-linejoin="round"';
      return `<g data-party-marker>
        <circle cx="${cx}" cy="${cy}" r="8" fill="#38bdf8" stroke="#0c4a6e" stroke-width="2.5" />
        <circle cx="${cx}" cy="${cy}" r="3" fill="#e0f2fe" />
        <text x="${cx}" y="${cy - 14}" text-anchor="middle" fill="#7dd3fc" font-size="13" font-weight="800" ${textHalo}>${escapeHtml(member.nickname)}</text>
      </g>`;
    })
    .join("");
  const cards = view.regions
    .map((region) => {
      const selected = region.id === view.currentRegionId ? " current" : "";
      const monsters = regionMonsterNames(region).slice(0, 5).join(", ");
      return `<article class="map-region-card${selected}">
        <span class="map-region-swatch" style="background:${colorHex(region.color)}"></span>
        <strong>${escapeHtml(region.name)} · Lv ${region.levelRange[0]}-${region.levelRange[1]}</strong>
        <small>전리품 티어 ${region.lootTier} · ${escapeHtml(monsters)}</small>
      </article>`;
    })
    .join("");
  const mapCards = view.worldMaps
    .map(({ map, current, canTeleport, lockReason }) => {
      const disabled = current || !canTeleport ? "disabled" : "";
      const status = current ? "현재 맵" : canTeleport ? "이동" : "잠김";
      return `<article class="world-map-card${current ? " current" : ""}">
        <div>
          <strong>${escapeHtml(map.name)} · Lv ${map.levelRange[0]}-${map.levelRange[1]}</strong>
          <small>${escapeHtml(lockReason || map.description)}</small>
        </div>
        <button data-teleport-map="${escapeHtml(map.id)}" ${disabled}>${status}</button>
      </article>`;
    })
    .join("");

  panelEl.innerHTML = `
    <section class="panel map-panel">
      <header>
        <div>
          <h2>지역 지도</h2>
          <p>중앙에서 멀어질수록 권장 레벨과 전리품 티어가 높아집니다.</p>
        </div>
        <button class="icon-button" data-close>닫기</button>
      </header>
      <div class="map-layout">
        <svg class="region-map" viewBox="0 0 ${size} ${size}" role="img" aria-label="지역 지도">
          <rect x="0" y="0" width="${size}" height="${size}" rx="20" fill="#16251f" />
          <g opacity="0.24">
            <line x1="${half}" y1="0" x2="${half}" y2="${size}" stroke="#f4d488" />
            <line x1="0" y1="${half}" x2="${size}" y2="${half}" stroke="#f4d488" />
            <circle cx="${half}" cy="${half}" r="${size * 0.24}" fill="none" stroke="#f4d488" stroke-dasharray="5 12" />
            <circle cx="${half}" cy="${half}" r="${size * 0.4}" fill="none" stroke="#f4d488" stroke-dasharray="5 12" />
          </g>
          ${waters}
          ${regions}
          ${caves}
          ${homes}
          ${party}
          ${bosses}
          <polygon points="${arrowTip} ${arrowL} ${arrowR}" fill="#ffe24a" stroke="#111827" stroke-width="3" stroke-linejoin="round"><title>내 위치 · 바라보는 방향</title></polygon>
          <circle cx="${playerX.toFixed(1)}" cy="${playerY.toFixed(1)}" r="6.5" fill="#fff7d6" stroke="#111827" stroke-width="2.5" />
        </svg>
        <aside class="map-region-list">
          <div class="map-player-level">현재 Lv ${view.player.level}</div>
          ${view.bosses.length > 0 ? `<div class="map-player-level">◆ 보스 위치 — 금색=다음 목표 · 빨강=도전 가능 · 회색=봉인</div>` : ""}
          <div class="map-player-level">원정 맵 텔레포트</div>
          ${mapCards}
          ${cards}
        </aside>
      </div>
    </section>
  `;

  panelEl.querySelector<HTMLButtonElement>("[data-close]")?.addEventListener("click", callbacks.onClose);
  panelEl.querySelectorAll<HTMLButtonElement>("[data-teleport-map]").forEach((button) => {
    button.addEventListener("click", () => callbacks.onTeleport(button.dataset.teleportMap ?? ""));
  });
}
