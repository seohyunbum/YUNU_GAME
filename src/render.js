/* 캔버스 렌더러 — run 상태를 읽어 그린다. 상태를 바꾸지 않는다. */
(function (global) {
  'use strict';
  const LW = (global.LW = global.LW || {});

  const SIDE_ROCKS = 26;
  const rockRng = LW.util.makeRng(7788);
  const rocks = [];
  for (let i = 0; i < SIDE_ROCKS; i++) {
    rocks.push({
      side: i % 2 === 0 ? -1 : 1,
      off: rockRng.range(0.7, 4.2),
      y: rockRng.range(0, 120),
      size: rockRng.range(0.25, 0.8),
      shade: rockRng.range(0.1, 0.3),
    });
  }

  function makeCamera(canvas) {
    return { w: 0, h: 0, scale: 1, baseY: 0, shakeX: 0, shakeY: 0, canvas: canvas };
  }

  function updateCamera(cam, run) {
    const cfg = LW.config.world;
    const w = cam.canvas.width;
    const h = cam.canvas.height;
    cam.w = w;
    cam.h = h;
    // 도로가 화면 폭을 채우되, 위로 보이는 거리가 스폰 거리를 넘지 않게 아래를 깔아준다.
    cam.scale = Math.max(w / (cfg.roadHalfWidth * 2 + 2.4), h / (cfg.cameraBack + cfg.cameraFront));
    cam.baseY = h - cfg.cameraBack * cam.scale;
    if (run && run.shake > 0) {
      const s = run.shake * 9;
      cam.shakeX = (Math.random() - 0.5) * s;
      cam.shakeY = (Math.random() - 0.5) * s;
    } else {
      cam.shakeX = cam.shakeY = 0;
    }
  }

  function sx(cam, wx) {
    return cam.w / 2 + wx * cam.scale + cam.shakeX;
  }

  function sy(cam, wy, dist) {
    return cam.baseY - (wy - dist) * cam.scale + cam.shakeY;
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  function drawGround(ctx, cam, run) {
    const cfg = LW.config.world;
    const theme = run.plan.theme;
    ctx.fillStyle = theme.side;
    ctx.fillRect(0, 0, cam.w, cam.h);

    const left = sx(cam, -cfg.roadHalfWidth);
    const right = sx(cam, cfg.roadHalfWidth);
    const grad = ctx.createLinearGradient(0, 0, 0, cam.h);
    grad.addColorStop(0, shade(theme.road, -0.18));
    grad.addColorStop(1, theme.road);
    ctx.fillStyle = grad;
    ctx.fillRect(left, 0, right - left, cam.h);

    // 차선 — dist 에 따라 흐른다
    ctx.strokeStyle = 'rgba(255,255,255,0.11)';
    ctx.lineWidth = Math.max(2, cam.scale * 0.07);
    ctx.setLineDash([cam.scale * 1.1, cam.scale * 1.1]);
    for (const lane of [-1.47, 1.47]) {
      ctx.beginPath();
      ctx.moveTo(sx(cam, lane), 0);
      ctx.lineTo(sx(cam, lane), cam.h);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // 도로 경계
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = Math.max(2, cam.scale * 0.06);
    ctx.beginPath();
    ctx.moveTo(left, 0);
    ctx.lineTo(left, cam.h);
    ctx.moveTo(right, 0);
    ctx.lineTo(right, cam.h);
    ctx.stroke();

    // 노면 흐름 표시 (진행감)
    const span = 60;
    const startY = Math.floor(run.dist / 3) * 3;
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    for (let y = startY - 6; y < startY + span; y += 3) {
      const py = sy(cam, y, run.dist);
      ctx.fillRect(left, py, right - left, Math.max(1, cam.scale * 0.08));
    }

    // 길 옆 돌무더기 (배경 반복)
    for (const r of rocks) {
      const wy = r.y + Math.floor((run.dist - r.y) / 120) * 120;
      const py = sy(cam, wy + 120, run.dist);
      if (py < -40 || py > cam.h + 40) continue;
      const wx = r.side * (cfg.roadHalfWidth + r.off);
      ctx.fillStyle = shade(theme.side, r.shade);
      const s = r.size * cam.scale;
      roundRect(ctx, sx(cam, wx) - s / 2, py - s / 2, s, s, s * 0.3);
      ctx.fill();
    }
  }

  function drawGates(ctx, cam, run) {
    const cfg = LW.config.world;
    for (const gate of run.gates) {
      const py = sy(cam, gate.y, run.dist);
      if (py < -120 || py > cam.h + 60) continue;
      const h = Math.max(18, cam.scale * 0.85);
      for (let side = 0; side < 2; side++) {
        const door = gate.doors[side];
        const x0 = side === 0 ? -cfg.roadHalfWidth : 0;
        const x1 = side === 0 ? 0 : cfg.roadHalfWidth;
        const px = sx(cam, x0);
        const pw = sx(cam, x1) - px;
        const buff = LW.gates.isBuff(door);
        const used = gate.used;
        const picked = used && gate.chosen === side;
        ctx.globalAlpha = used ? (picked ? 0.35 : 0.14) : 0.82;
        const g = ctx.createLinearGradient(0, py - h, 0, py + h);
        g.addColorStop(0, buff ? 'rgba(46,190,110,0.15)' : 'rgba(200,60,80,0.15)');
        g.addColorStop(1, buff ? 'rgba(46,220,130,0.75)' : 'rgba(230,70,90,0.75)');
        ctx.fillStyle = g;
        ctx.fillRect(px + 3, py - h, pw - 6, h * 2);
        ctx.globalAlpha = used ? 0.3 : 1;
        ctx.strokeStyle = buff ? '#69f2a4' : '#ff7d8c';
        ctx.lineWidth = Math.max(2, cam.scale * 0.05);
        ctx.strokeRect(px + 3, py - h, pw - 6, h * 2);

        // 라벨
        const fs = Math.max(18, cam.scale * 0.72);
        ctx.font = '900 ' + fs + 'px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillText(LW.gates.label(door), px + pw / 2, py + 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(LW.gates.label(door), px + pw / 2, py);

        // 통과 후 결과 미리보기
        if (!used) {
          const preview = LW.gates.apply(run.squad.count, door);
          ctx.font = '700 ' + Math.max(11, fs * 0.36) + 'px system-ui, sans-serif';
          ctx.fillStyle = buff ? '#d8ffe8' : '#ffdbe0';
          ctx.fillText('👥 ' + LW.util.formatCount(preview), px + pw / 2, py + fs * 0.62);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawBarricades(ctx, cam, run) {
    const cfgB = LW.config.barricade;
    for (const bar of run.barricades) {
      if (bar.broken) continue;
      const py = sy(cam, bar.y, run.dist);
      if (py < -60 || py > cam.h + 60) continue;
      const px = sx(cam, bar.x - cfgB.halfWidth);
      const pw = cfgB.halfWidth * 2 * cam.scale;
      const ph = cfgB.thickness * 2 * cam.scale;
      ctx.fillStyle = bar.flash > 0 ? '#ffffff' : '#78849a';
      roundRect(ctx, px, py - ph / 2, pw, ph, ph * 0.2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(px + (pw / 4) * i + 2, py - ph / 2 + 2, 2, ph - 4);
      }
      // 체력
      const ratio = Math.max(0, bar.hp / bar.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(px, py - ph / 2 - 7, pw, 5);
      ctx.fillStyle = '#ffd05e';
      ctx.fillRect(px, py - ph / 2 - 7, pw * ratio, 5);
    }
  }

  function drawCoins(ctx, cam, run) {
    for (const c of run.coins) {
      if (c.taken) continue;
      const py = sy(cam, c.y, run.dist);
      if (py < -30 || py > cam.h + 30) continue;
      const r = cam.scale * 0.17;
      const bob = Math.sin(run.time * 5 + c.bob) * r * 0.3;
      ctx.fillStyle = '#ffd45e';
      ctx.beginPath();
      ctx.arc(sx(cam, c.x), py + bob, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(120,80,10,0.55)';
      ctx.beginPath();
      ctx.arc(sx(cam, c.x), py + bob, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawEnemy(ctx, cam, run, e) {
    const py = sy(cam, e.y, run.dist);
    if (py < -60 || py > cam.h + 60) return;
    const px = sx(cam, e.x);
    const s = e.radius * cam.scale;
    const def = LW.config.enemyKinds[e.kind];
    const body = e.flash > 0 ? '#ffffff' : def.color;
    const sway = Math.sin(e.wobble) * s * 0.12;

    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(px, py + s * 0.9, s * 0.9, s * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    // 다리(궤도)
    ctx.fillStyle = shade(def.color, -0.35);
    ctx.fillRect(px - s * 0.85, py + s * 0.25, s * 0.4, s * 0.7);
    ctx.fillRect(px + s * 0.45, py + s * 0.25, s * 0.4, s * 0.7);

    // 몸통
    ctx.fillStyle = body;
    roundRect(ctx, px - s * 0.8 + sway, py - s, s * 1.6, s * 1.5, s * 0.28);
    ctx.fill();

    if (e.kind === 'brute') {
      ctx.fillStyle = shade(def.color, 0.18);
      roundRect(ctx, px - s * 1.05 + sway, py - s * 0.75, s * 0.28, s * 0.8, s * 0.1);
      ctx.fill();
      roundRect(ctx, px + s * 0.77 + sway, py - s * 0.75, s * 0.28, s * 0.8, s * 0.1);
      ctx.fill();
    }
    if (e.kind === 'shooter') {
      ctx.strokeStyle = '#ffb0f0';
      ctx.lineWidth = Math.max(1, s * 0.12);
      ctx.beginPath();
      ctx.moveTo(px + sway, py - s);
      ctx.lineTo(px + sway, py - s * 1.7);
      ctx.stroke();
      ctx.fillStyle = '#ffb0f0';
      ctx.beginPath();
      ctx.arc(px + sway, py - s * 1.75, s * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }

    // 센서 바 (얼굴 없음 — 기계)
    ctx.fillStyle = '#ff5f6d';
    ctx.fillRect(px - s * 0.45 + sway, py - s * 0.55, s * 0.9, s * 0.2);

    // 체력 (한 방에 안 죽는 적만)
    if (e.hp < e.maxHp) {
      const w = s * 1.8;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(px - w / 2, py - s * 1.35, w, 4);
      ctx.fillStyle = '#ff7a5c';
      ctx.fillRect(px - w / 2, py - s * 1.35, (w * e.hp) / e.maxHp, 4);
    }
  }

  function drawBoss(ctx, cam, run) {
    const boss = run.boss;
    if (!boss || boss.dead) return;
    const px = sx(cam, boss.x);
    const py = sy(cam, boss.y, run.dist);
    const s = boss.radius * cam.scale;
    const bob = Math.sin(boss.bob) * s * 0.06;

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(px, py + s * 0.95, s * 1.05, s * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = boss.flash > 0 ? '#ffffff' : '#5b6479';
    roundRect(ctx, px - s * 0.95, py - s + bob, s * 1.9, s * 1.85, s * 0.3);
    ctx.fill();

    ctx.fillStyle = '#454d60';
    roundRect(ctx, px - s * 1.35, py - s * 0.7 + bob, s * 0.42, s * 1.1, s * 0.14);
    ctx.fill();
    roundRect(ctx, px + s * 0.93, py - s * 0.7 + bob, s * 0.42, s * 1.1, s * 0.14);
    ctx.fill();

    ctx.fillStyle = '#ffb43d';
    ctx.fillRect(px - s * 0.6, py - s * 0.45 + bob, s * 1.2, s * 0.22);
    ctx.fillStyle = '#ff4a5c';
    ctx.fillRect(px - s * 0.75, py + s * 0.25 + bob, s * 1.5, s * 0.16);

    ctx.font = '800 ' + Math.max(11, cam.scale * 0.28) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd6da';
    ctx.fillText('대장 로봇', px, py - s * 1.25 + bob);
  }

  function drawSquad(ctx, cam, run) {
    const squad = run.squad;
    const cfg = LW.config.squad;
    const formation = LW.squad.fillFormation(squad.formation, squad.count);
    const flashing = squad.fireTimer > squad.interval() - 0.06;
    const unit = cfg.unitRadius * cam.scale;

    for (let i = 0; i < formation.length; i++) {
      const f = formation[i];
      const px = sx(cam, squad.x + f.x);
      const py = sy(cam, run.dist + f.y, run.dist);

      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(px, py + unit * 0.95, unit * 0.85, unit * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();

      // 몸통
      ctx.fillStyle = '#3f7ddc';
      roundRect(ctx, px - unit * 0.7, py - unit * 0.6, unit * 1.4, unit * 1.5, unit * 0.35);
      ctx.fill();
      // 총
      ctx.fillStyle = '#1c2434';
      ctx.fillRect(px + unit * 0.2, py - unit * 1.15, unit * 0.3, unit * 1.0);
      // 헬멧
      ctx.fillStyle = '#ffcf4a';
      ctx.beginPath();
      ctx.arc(px, py - unit * 0.75, unit * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // 선두 열 총구 화염
      if (flashing && f.y === 0) {
        ctx.fillStyle = 'rgba(255,228,140,0.95)';
        ctx.beginPath();
        ctx.arc(px + unit * 0.35, py - unit * 1.3, unit * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 인원 배지 (그린 것보다 많을 때)
    if (squad.count > cfg.maxDrawn) {
      const px = sx(cam, squad.x);
      const py = sy(cam, run.dist, run.dist) + unit * 2.6;
      ctx.font = '900 ' + Math.max(13, cam.scale * 0.3) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText('+' + (squad.count - cfg.maxDrawn), px, py + 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('+' + (squad.count - cfg.maxDrawn), px, py);
    }
  }

  function drawProjectiles(ctx, cam, run) {
    const br = LW.config.squad.bulletRadius * cam.scale;
    ctx.fillStyle = '#fff0b0';
    for (const b of run.bullets) {
      if (!b.active) continue;
      const py = sy(cam, b.y, run.dist);
      if (py < -20 || py > cam.h + 20) continue;
      roundRect(ctx, sx(cam, b.x) - br * 0.5, py - br * 1.6, br, br * 3.2, br * 0.5);
      ctx.fill();
    }
    const er = LW.config.enemyBolt.radius * cam.scale;
    for (const b of run.bolts) {
      if (!b.active) continue;
      const py = sy(cam, b.y, run.dist);
      ctx.fillStyle = '#ff8b5c';
      ctx.beginPath();
      ctx.arc(sx(cam, b.x), py, er, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles(ctx, cam, run) {
    for (const p of run.particles) {
      if (!p.active) continue;
      const a = p.life / p.maxLife;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const s = p.size * cam.scale * (0.5 + a);
      ctx.fillRect(sx(cam, p.x) - s / 2, sy(cam, p.y, run.dist) - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  }

  /** 색을 밝게/어둡게 (hex 전용) */
  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255;
    let g = (n >> 8) & 255;
    let b = n & 255;
    const t = amount < 0 ? 0 : 255;
    const p = Math.abs(amount);
    r = Math.round((t - r) * p + r);
    g = Math.round((t - g) * p + g);
    b = Math.round((t - b) * p + b);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function draw(ctx, cam, run) {
    updateCamera(cam, run);
    ctx.save();
    drawGround(ctx, cam, run);
    drawBarricades(ctx, cam, run);
    drawGates(ctx, cam, run);
    drawCoins(ctx, cam, run);
    for (const e of run.enemies) if (e.active) drawEnemy(ctx, cam, run, e);
    drawBoss(ctx, cam, run);
    drawSquad(ctx, cam, run);
    drawProjectiles(ctx, cam, run);
    drawParticles(ctx, cam, run);
    ctx.restore();
  }

  LW.render = { makeCamera, draw, shade };
})(typeof globalThis !== 'undefined' ? globalThis : this);
