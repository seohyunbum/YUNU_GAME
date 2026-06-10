import type { Region } from "../game/regions";
import { regionMonsterNames } from "../game/regions";
import type { WorldMapDefinition } from "../game/worldMaps";

interface MapWaterZone {
  center: { x: number; z: number };
  radius: number;
  name: string;
}

export interface RegionMapPanelView {
  regions: Region[];
  currentRegionId: string | null;
  player: { x: number; z: number; yaw: number; level: number };
  worldSize: number;
  waterZones: MapWaterZone[];
  worldMaps: { map: WorldMapDefinition; current: boolean; canTeleport: boolean; lockReason: string }[];
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
  const directionX = playerX - Math.sin(view.player.yaw) * 16;
  const directionY = playerY - Math.cos(view.player.yaw) * 16;
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
          <line x1="${playerX.toFixed(1)}" y1="${playerY.toFixed(1)}" x2="${directionX.toFixed(1)}" y2="${directionY.toFixed(1)}" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
          <circle cx="${playerX.toFixed(1)}" cy="${playerY.toFixed(1)}" r="9" fill="#fff7d6" stroke="#111827" stroke-width="3" />
        </svg>
        <aside class="map-region-list">
          <div class="map-player-level">현재 Lv ${view.player.level}</div>
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
