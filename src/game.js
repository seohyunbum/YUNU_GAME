/* =========================================================================
 * game.js — 지휘자: 씬 부팅 · 입력 배선 · 전투 규칙 · 오픈월드 루프 · 렌더
 *
 * 오픈월드 규칙
 *   · 레고 시티는 안전지대 — 몬스터가 나오지 않고 체력이 천천히 찬다
 *   · 흙길을 따라 사냥터(좀비 마을 · 동굴 협곡 · 높은 산 · 늪 폐가)로 간다
 *   · 사냥터마다 정해진 수만큼 몬스터가 계속 돌아다니고, 안쪽에는 보스가 있다
 *   · 쓰러지면 게임이 끝나는 게 아니라 도시에서 다시 깨어난다
 *
 * 렌더는 3단계: 도시/지형 → 심도 흐림 후처리 → 1인칭 두 팔(또렷하게)
 * ========================================================================= */
(function (L) {
  'use strict';
  const P = L.PLAYER;

  const GRAVITY = 62;
  const JUMP_SPEED = 22;
  const MAX_STEP = 2.9;          // 걸어서 올라갈 수 있는 턱(브릭 두 단 남짓)
  const SPAWN = { x: 0, z: 30 }; // 도시 광장

  function Game() {
    const canvas = document.getElementById('scene');
    this.canvas = canvas;

    // ---------------- 렌더러
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;
    this.renderer.shadowMap.autoUpdate = false;
    this._shadowTick = 0;

    // ---------------- 씬 · 카메라 · 빛
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.4, 2600);
    this.camera.rotation.order = 'YXZ';

    this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x54703f, 0.70);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xffeec8, 1.5);
    sun.position.set(58, 96, 62);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    const sc = sun.shadow.camera;
    sc.left = -58; sc.right = 58; sc.top = 58; sc.bottom = -58;
    sc.near = 20; sc.far = 240;
    sun.shadow.bias = -0.0006;
    sun.shadow.radius = 4;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    this.ambient = new THREE.AmbientLight(0xfff4e6, 0.13);
    this.scene.add(this.ambient);
    this.BASE = { sun: 1.5, hemi: 0.70, ambient: 0.13 };

    // 동굴용 횃불 (카메라에 붙어 다닌다)
    this.torch = new THREE.PointLight(0xffb060, 0, 52, 1.5);
    this.camera.add(this.torch);
    this.scene.add(this.camera);

    // ---------------- 후처리 · 도시 · 오픈월드
    this.post = new L.PostFX(this.renderer, this.camera);
    this.city = L.buildCity(this.scene);
    this.world = new L.World(this.scene, this.city);
    // 사냥터 사이 들판을 채우는 나무·바위(플레이어 주변만 배치)
    this.wilds = new L.Wilds(this.world, this.scene);

    // ---------------- 이펙트 · 몬스터 · 손 · HUD · 입력 · 소리
    this.fx = new L.FX(this.scene);
    // 발사체·파편이 지형 위에서 멈추도록 지면 높이를 알려준다
    const world0 = this.world;
    this.fx.groundAt = function (x, z) { return world0.heightAt(x, z); };
    this.enemies = new L.Enemies(this.scene, this.fx, this.world);
    this.weather = new L.Weather(this.scene);
    this.hands = new L.Hands(this.camera);
    this.hud = new L.HUD();
    this.input = new L.Input(canvas);
    this.sfx = new L.Sfx();

    // ---------------- 플레이어 (pos 는 발밑 좌표)
    this.player = {
      pos: new THREE.Vector3(SPAWN.x, this.world.heightAt(SPAWN.x, SPAWN.z), SPAWN.z),
      velY: 0, onGround: true,
      yaw: 0, pitch: -0.04,
      hearts: P.maxHearts, mana: P.maxMana,
      ammo: { blaster: 24, bomb: 4 },
      score: 0, kills: 0, deaths: 0, combo: 0, comboTimer: 0,
      invuln: 0, weaponCd: 0, channelTimer: 0, channelSkill: null,
      bob: 0, eyeY: 0, inWater: 0,
    };
    this.skillCd = { dragonfire: 0, meteor: 0, fireball: 0 };
    this.state = 'start';        // start | playing | pause | down
    this.downTimer = 0;
    this.best = Number(localStorage.getItem('legocity-best') || 0);
    this.time = 0;
    this.regionVisited = {};
    this.bossesDown = {};        // 지역별 보스 격파 여부

    // 스크래치(핫패스에서 새 객체 만들지 않기)
    this._dir = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
    this._look = { yaw: 0, pitch: 0 };
    this._aim = new THREE.Vector3();
    this._fogTarget = new THREE.Color(0xb6d8ef);
    this._hemiSky = new THREE.Color(0xcfe8ff);
    this._hemiGround = new THREE.Color(0x54703f);
    this._skyTarget = new THREE.Color(0xffffff);

    // 시작 전에 도시 주변 지형을 미리 깔아둔다(첫 프레임 끊김 방지)
    this.world.update(this.player.pos.x, this.player.pos.z, 0, 200);
    this.wilds.rebuild(this.player.pos.x, this.player.pos.z);

    this._wire();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.hud.show(false);
    this.hud.screen('start');
    if (this.input.touchMode) this.hud.showTouch(false);

    // 느린 기기 자동 보호
    this._fpsAccum = 0;
    this._fpsFrames = 0;
    this._qualityStep = 0;
    this._slowWindows = 0;
    this.autoQuality = true;

    this._lastT = 0;
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  // ------------------------------------------------------------------ 배선
  Game.prototype._wire = function () {
    const self = this;
    const h = this.input.hooks;
    h.selectWeapon = (i) => { if (self.state === 'playing') { self.hands.setWeapon(i); self.sfx.pop(); } };
    h.selectSkill = (i) => { if (self.state === 'playing') { self.hands.setSkill(i); self.sfx.pop(); } };
    h.swapWeapon = (d) => { if (self.state === 'playing') { self.hands.nextWeapon(d); self.sfx.pop(); } };
    h.swapSkill = (d) => { if (self.state === 'playing') { self.hands.nextSkill(d); self.sfx.pop(); } };
    h.jump = () => self.jump();
    h.travel = () => self.fastTravel();
    h.pause = () => {
      if (self.state === 'playing') {
        self.state = 'pause';
        self.hud.pauseStats({
          regionName: self.world.current ? self.world.current.name : '들판',
          score: self.player.score, kills: self.player.kills, best: self.best,
          bosses: self.bossCount(),
        });
        self.hud.screen('pause');
      }
    };

    this.fx.hooks.damageArea = (pos, radius, dmg) => {
      const hits = self.enemies.damageArea(pos, radius, dmg);
      if (hits) self.hud.hitMark();
    };
    this.fx.hooks.hitPlayer = (dmg) => self.hurtPlayer(dmg);
    this.fx.hooks.onImpact = () => self.sfx.boom();

    this.enemies.hooks.hitPlayer = (dmg) => self.hurtPlayer(dmg);
    this.enemies.hooks.onKill = (e) => self.onKill(e);

    document.getElementById('start-btn').addEventListener('click', () => self.start());
    document.getElementById('again-btn').addEventListener('click', () => self.start());
    document.getElementById('resume-btn').addEventListener('click', () => self.resume());
    this.canvas.addEventListener('click', () => {
      if (self.state === 'pause') self.resume();
      else if (self.state === 'playing') self.input.requestLock();
    });
  };

  Game.prototype.resize = function () {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 82 : 70;
    this.camera.updateProjectionMatrix();
    this.hands.resize(w / h, this.camera.fov);
    this.post.resize(w, h, this.renderer.getPixelRatio());
  };

  // ------------------------------------------------------------------ 흐름
  Game.prototype.start = function () {
    const p = this.player;
    p.pos.set(SPAWN.x, this.world.heightAt(SPAWN.x, SPAWN.z), SPAWN.z);
    p.velY = 0; p.onGround = true;
    p.yaw = 0; p.pitch = -0.04;
    p.hearts = P.maxHearts;
    p.mana = P.maxMana;
    p.ammo.blaster = 24;
    p.ammo.bomb = 4;
    p.score = 0; p.kills = 0; p.deaths = 0; p.combo = 0; p.comboTimer = 0;
    this.bossesDown = {};
    this.regionVisited = {};
    p.invuln = 0; p.weaponCd = 0; p.channelTimer = 0; p.channelSkill = null;
    this.skillCd.dragonfire = this.skillCd.meteor = this.skillCd.fireball = 0;
    this.enemies.clear();
    this.fx.clear();
    this.hands.setWeapon(0);
    this.hands.setSkill(2);
    this.state = 'playing';
    this.hud.screen(null);
    this.hud.show(true);
    if (this.input.touchMode) this.hud.showTouch(true);
    this.sfx.resume();
    this.input.requestLock();
    this.hud.toast('레고 시티 · 안전지대\n흙길을 따라 사냥터로 가 보자', 3.0);
  };

  Game.prototype.resume = function () {
    if (this.state !== 'pause') return;
    this.state = 'playing';
    this.hud.screen(null);
    this.input.requestLock();
  };

  Game.prototype.jump = function () {
    const p = this.player;
    if (this.state !== 'playing' || !p.onGround) return;
    p.velY = JUMP_SPEED;
    p.onGround = false;
  };

  /**
   * 표지판 앞에서 T — 이미 가 본 곳으로 빠르게 이동한다.
   * (한 번은 반드시 걸어서 가 봐야 열린다)
   */
  Game.prototype.fastTravel = function () {
    if (this.state !== 'playing') return;
    const p = this.player.pos;
    const t = this.world.travelNear(p.x, p.z, 16);
    if (!t) return;
    if (t.to !== 'city' && !this.regionVisited[t.to]) {
      this.hud.toast('아직 가 본 적 없는 곳이다.\n한 번은 걸어서 가 보자', 1.8);
      return;
    }
    const dest = this.world.entryOf(t.to);
    if (!dest) return;
    this.world.update(dest.x, dest.z, 0.016, 60);   // 도착지 지형을 미리 깐다
    p.set(dest.x, this.world.heightAt(dest.x, dest.z), dest.z);
    this.player.velY = 0;
    this.player.eyeY = p.y + P.eyeHeight;
    this.wilds.rebuild(p.x, p.z);
    this.enemies.clear();
    this.hud.toast(t.label + ' 도착!', 1.6);
    this.sfx.wave();
  };

  Game.prototype.onKill = function (e) {
    const p = this.player;
    p.kills++;
    p.combo++;
    p.comboTimer = 3.0;
    const mult = 1 + Math.min(1.5, (p.combo - 1) * 0.1);
    p.score += Math.round(e.def.score * mult);
    if (p.score > this.best) {
      this.best = p.score;
      localStorage.setItem('legocity-best', String(this.best));
    }
    this.hud.comboPop();
    this.sfx.pop();
    if (e.isBoss) {
      this.hud.toast((e.bossName || '보스') + ' 격파! 🎉', 2.4);
      if (e.region) this.bossesDown[e.region] = true;
      p.score += 800;
      if (this.bossCount() >= 4) {
        this.hud.toast('사냥터 네 곳의 보스를 모두 잡았다! 🏆\n레고 시티의 영웅!', 4.0);
      }
    }
  };

  /** 잡은 보스 수 */
  Game.prototype.bossCount = function () {
    let n = 0;
    for (const k in this.bossesDown) if (this.bossesDown[k]) n++;
    return n;
  };

  Game.prototype.hurtPlayer = function (dmg) {
    const p = this.player;
    if (this.state !== 'playing' || p.invuln > 0) return;
    p.hearts -= dmg;
    p.invuln = P.hurtInvuln;
    p.combo = 0;
    this.hud.hurt();
    this.sfx.hurt();
    if (p.hearts <= 0) {
      p.hearts = 0;
      this.knockOut();
    }
  };

  /** 쓰러짐 → 잠시 뒤 도시에서 다시 깨어난다(게임 오버 없음) */
  Game.prototype.knockOut = function () {
    this.state = 'down';
    this.downTimer = 2.4;
    this.player.deaths++;
    this.player.channelTimer = 0;
    this.input.attackHeld = false;
    this.input.castHeld = false;
    this.hud.toast('쓰러졌다…\n레고 시티에서 다시 깨어난다', 2.4);
    this.sfx.gameOver();
  };

  Game.prototype.respawn = function () {
    const p = this.player;
    p.pos.set(SPAWN.x, this.world.heightAt(SPAWN.x, SPAWN.z), SPAWN.z);
    p.velY = 0;
    p.hearts = P.maxHearts;
    p.mana = P.maxMana;
    p.invuln = 3.0;
    p.combo = 0;
    this.enemies.clear();
    this.fx.clear();
    this.state = 'playing';
    this.hud.toast('레고 시티에서 깨어났다', 1.6);
    this.input.requestLock();
  };

  // ------------------------------------------------------------------ 전투
  Game.prototype.aimDir = function () {
    return this.camera.getWorldDirection(this._dir);
  };

  /** 조준선이 땅에 닿는 지점(메테오 목표) */
  Game.prototype.aimGround = function (out) {
    const dir = this.aimDir();
    const eye = this.camera.position;
    if (dir.y < -0.06) {
      // 시선을 따라가며 지형과 만나는 지점을 찾는다(간단한 행진법)
      let t = 4;
      for (let i = 0; i < 40; i++) {
        const x = eye.x + dir.x * t, y = eye.y + dir.y * t, z = eye.z + dir.z * t;
        if (y <= this.world.heightAt(x, z)) {
          out.set(x, this.world.heightAt(x, z), z);
          return out;
        }
        t += 4;
        if (t > 160) break;
      }
    }
    const x = eye.x + dir.x * 60, z = eye.z + dir.z * 60;
    out.set(x, this.world.heightAt(x, z), z);
    return out;
  };

  Game.prototype.attack = function () {
    const p = this.player;
    const w = this.hands.currentWeapon();
    if (p.weaponCd > 0) return;
    if (w.ammoMax !== undefined && (p.ammo[w.id] || 0) <= 0) {
      this.hud.toast('탄약 없음! 파란 스터드를 주워라', 1.0);
      p.weaponCd = 0.4;
      return;
    }
    p.weaponCd = w.cooldown;
    this.hands.playAttack();
    const dir = this.aimDir();
    const eye = this.camera.position;

    if (w.id === 'sword') {
      this.sfx.sword();
      const hits = this.enemies.damageCone(eye, dir, w.reach, Math.cos(w.arc), w.damage);
      if (hits) {
        this.hud.hitMark();
        this._tmp.copy(eye).addScaledVector(dir, 6);
        this.fx.debrisBurst(this._tmp, L.COLORS.silver, 3, 8);
      }
    } else if (w.id === 'blaster') {
      p.ammo.blaster--;
      this.sfx.shoot();
      this.hands.getMuzzleWorld(this._tmp);
      this.fx.shoot('stud', this._tmp, dir, { speed: w.speed, dmg: w.damage, life: 1.8, spin: 6 });
    } else if (w.id === 'bomb') {
      p.ammo.bomb--;
      this.sfx.throwBomb();
      this.hands.getMuzzleWorld(this._tmp);
      this.fx.shoot('bomb', this._tmp, dir, {
        speed: w.speed, dmg: w.damage, radius: w.radius, gravity: 62,
        fuse: w.fuse, life: w.fuse + 0.1, up: 12, spin: 3,
      });
    }
  };

  Game.prototype.cast = function () {
    const p = this.player;
    const s = this.hands.currentSkill();
    if (this.skillCd[s.id] > 0 || p.channelTimer > 0) return;
    if (p.mana < s.mana) {
      this.hud.toast('마나 부족! 노란 스터드를 주워라', 1.0);
      this.skillCd[s.id] = 0.35;
      return;
    }
    p.mana -= s.mana;
    this.skillCd[s.id] = s.cooldown;
    this.sfx.cast();
    const dir = this.aimDir();

    if (s.id === 'fireball') {
      this.hands.playCast(0);
      this.hands.getScrollWorld(this._tmp);
      this.fx.shoot('fireball', this._tmp, dir, {
        speed: s.speed, dmg: s.damage, radius: s.radius, life: 3.2,
      });
    } else if (s.id === 'meteor') {
      this.hands.playCast(0);
      this.aimGround(this._aim);
      this.fx.meteor(this._aim, s);
      this.hud.toast('☄️ 메테오!', 0.9);
    } else if (s.id === 'dragonfire') {
      this.hands.playCast(s.duration);
      p.channelTimer = s.duration;
      p.channelSkill = s;
      this.hud.toast('🐲 드래곤 파이어!', 0.9);
    }
  };

  Game.prototype.updateChannel = function (dt) {
    const p = this.player;
    if (p.channelTimer <= 0) return;
    const s = p.channelSkill;
    p.channelTimer -= dt;
    const dir = this.aimDir();
    this.hands.getScrollWorld(this._tmp);
    this._tmp.addScaledVector(dir, 3.5);
    for (let i = 0; i < 4; i++) this.fx.flame(this._tmp, dir, 0.22);
    if (Math.random() < 0.35) this.sfx.flame();
    const hits = this.enemies.damageCone(this.camera.position, dir, s.range, Math.cos(s.cone), s.dps * dt);
    if (hits) this.hud.hitMark();
    if (p.channelTimer <= 0) { p.channelTimer = 0; p.channelSkill = null; }
  };

  // ------------------------------------------------------------------ 이동(지형 따라)
  Game.prototype.updatePlayer = function (dt) {
    const p = this.player;
    const inp = this.input;
    const world = this.world;
    inp.sample();
    const look = inp.consumeLook(this._look);
    p.yaw += look.yaw;
    p.pitch = Math.max(-1.15, Math.min(0.95, p.pitch + look.pitch));

    let mx = inp.moveX, mz = inp.moveZ;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }

    // 물속(늪)에서는 느려진다
    const waterDepth = world.waterDepthAt(p.pos.x, p.pos.z, p.pos.y);
    p.inWater = waterDepth;
    let speed = inp.sprint ? P.sprintSpeed : P.walkSpeed;
    if (p.channelTimer > 0) speed *= 0.55;
    if (waterDepth > 0.2) speed *= 0.62;

    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    const vx = (mx * cos - mz * sin) * speed * dt;
    const vz = (-mz * cos - mx * sin) * speed * dt;

    // 한 번에 못 가면 축을 나눠 시도한다(벽을 따라 미끄러지게)
    this._tryMove(vx, vz);

    // 소품·건물 충돌
    L.resolveCollision(p.pos, 2.0, world.colliders);

    // ---- 중력 · 점프 · 지면
    const ground = world.heightAt(p.pos.x, p.pos.z);
    if (!p.onGround || p.velY > 0) {
      p.velY -= GRAVITY * dt;
      p.pos.y += p.velY * dt;
      if (p.pos.y <= ground) {
        p.pos.y = ground;
        p.velY = 0;
        p.onGround = true;
      }
    } else {
      // 걸어 다닐 땐 지형에 붙어 다닌다(작은 턱은 그냥 올라간다)
      const drop = p.pos.y - ground;
      if (drop > 1.6) {           // 낭떠러지 → 떨어진다
        p.onGround = false;
        p.velY = 0;
      } else {
        p.pos.y = ground;
      }
    }
    if (p.pos.y < -140) {          // 세상 밖으로 떨어졌을 때 안전장치
      p.pos.set(SPAWN.x, world.heightAt(SPAWN.x, SPAWN.z), SPAWN.z);
      p.velY = 0;
    }

    // ---- 카메라 (걸음 흔들림 + 물속에서 살짝 낮게)
    const moving = len > 0.05 && p.onGround;
    p.bob += dt * (moving ? (inp.sprint ? 13 : 9) : 2.2);
    const bobY = moving ? Math.sin(p.bob) * (inp.sprint ? 0.22 : 0.14) : Math.sin(p.bob) * 0.04;
    const eyeTarget = p.pos.y + P.eyeHeight - Math.min(1.6, waterDepth * 0.5);
    // 계단을 오를 때 눈높이가 튀지 않게 부드럽게 따라간다
    p.eyeY += (eyeTarget - p.eyeY) * Math.min(1, dt * 14);
    this.camera.position.set(p.pos.x, p.eyeY + bobY, p.pos.z);
    this.camera.rotation.set(p.pitch, p.yaw, Math.sin(p.bob * 0.5) * (moving ? 0.012 : 0.003));

    // ---- 쿨다운 · 마나 · 콤보 · 안전지대 회복
    if (p.weaponCd > 0) p.weaponCd -= dt;
    for (const k in this.skillCd) if (this.skillCd[k] > 0) this.skillCd[k] -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    const safe = world.isSafe();
    p.mana = Math.min(P.maxMana, p.mana + P.manaRegen * (safe ? 3 : 1) * dt);
    if (safe) {
      this._healTimer = (this._healTimer || 0) + dt;
      if (this._healTimer > 3.5 && p.hearts < P.maxHearts) {
        this._healTimer = 0;
        p.hearts++;
        this.hud.toast('❤️ 도시에서 회복', 1.0);
      }
      // 도시에서는 탄약도 조금씩 채워진다
      this._ammoTimer = (this._ammoTimer || 0) + dt;
      if (this._ammoTimer > 2.5) {
        this._ammoTimer = 0;
        const bl = L.weaponById('blaster'), bm = L.weaponById('bomb');
        p.ammo.blaster = Math.min(bl.ammoMax, p.ammo.blaster + 3);
        if (Math.random() < 0.5) p.ammo.bomb = Math.min(bm.ammoMax, p.ammo.bomb + 1);
      }
    }
    if (p.comboTimer > 0) {
      p.comboTimer -= dt;
      if (p.comboTimer <= 0) p.combo = 0;
    }

    if (this.input.attackHeld) this.attack();
    if (this.input.castHeld) this.cast();

    return moving ? (inp.sprint ? 1 : 0.6) : 0;
  };

  /** 이동 시도: 턱이 너무 높으면 막고, 축을 나눠 미끄러지게 한다 */
  Game.prototype._tryMove = function (vx, vz) {
    const p = this.player;
    const world = this.world;
    const y0 = p.pos.y;
    const okX = world.heightAt(p.pos.x + vx, p.pos.z) - y0 <= MAX_STEP;
    const okZ = world.heightAt(p.pos.x, p.pos.z + vz) - y0 <= MAX_STEP;
    const okBoth = world.heightAt(p.pos.x + vx, p.pos.z + vz) - y0 <= MAX_STEP;
    if (okBoth && okX && okZ) {
      p.pos.x += vx;
      p.pos.z += vz;
      return;
    }
    if (okX) p.pos.x += vx;
    if (okZ) p.pos.z += vz;
  };

  // ------------------------------------------------------------------ 분위기
  Game.prototype.updateAmbience = function (dt) {
    const amb = this.world.ambience();
    const k = Math.min(1, dt * 1.6);
    this._fogTarget.setHex(amb.fog);
    this.scene.fog.color.lerp(this._fogTarget, k);
    this.scene.fog.near += (amb.fogNear - this.scene.fog.near) * k;
    this.scene.fog.far += (amb.fogFar - this.scene.fog.far) * k;
    this.sun.intensity += (this.BASE.sun * (amb.sun === undefined ? 1 : amb.sun) - this.sun.intensity) * k;
    this.hemi.intensity += (this.BASE.hemi * (amb.hemi === undefined ? 1 : amb.hemi) - this.hemi.intensity) * k;
    // 반구광 색도 지역을 따라간다(동굴은 따뜻한 어둠, 늪은 초록기)
    this._hemiSky.setHex(amb.hemiSky === undefined ? 0xcfe8ff : amb.hemiSky);
    this._hemiGround.setHex(amb.hemiGround === undefined ? 0x54703f : amb.hemiGround);
    this.hemi.color.lerp(this._hemiSky, k);
    this.hemi.groundColor.lerp(this._hemiGround, k);

    // 하늘 돔은 카메라를 따라다닌다
    if (this.city.anim.sky) this.city.anim.sky.position.copy(this.camera.position);
    // 하늘 색조(동굴은 어둡게, 설산은 하얗게)
    if (this.city.anim.sky) {
      this._skyTarget.setHex(amb.sky === undefined ? 0xffffff : amb.sky);
      this.city.anim.sky.material.color.lerp(this._skyTarget, k);
    }

    // 동굴 갱도 안이면 횃불을 켠다
    const p = this.player.pos;
    const dark = amb.dark || this.world.inTunnel(p.x, p.z, this.camera.position.y);
    const want = dark ? 1.7 : 0;
    this.torch.intensity += (want - this.torch.intensity) * Math.min(1, dt * 3);

    // 모닥불 불꽃 흔들기 (지역 소품 중 userData.flames 를 가진 것)
    const cur = this.world.current;
    const content = cur ? this.world.content[cur.id] : null;
    if (content && content.data) {
      const t2 = this.time;
      const shake = (obj) => {
        if (!obj || !obj.userData.flames) return;
        const f = obj.userData.flames;
        f.rotation.y = t2 * 1.6;
        f.scale.set(1 + Math.sin(t2 * 9) * 0.12, 1 + Math.sin(t2 * 7 + 1) * 0.18, 1 + Math.cos(t2 * 8) * 0.12);
      };
      shake(content.data.fire);
      shake(content.data.camp);
    }

    // 지역 분위기 입자(눈 · 반딧불 · 동굴 먼지)
    const region = this.world.current;
    this.weather.set(region && region.particles ? region.particles : 'none');
    this.weather.update(dt, this.camera.position);
  };

  // ------------------------------------------------------------------ 도시 연출
  Game.prototype.updateCity = function (dt) {
    const a = this.city.anim;
    const t = this.time;
    if (!this.city.group.visible) return;

    if (a.heli) {
      const r = 78, sp = 0.12;
      a.heli.group.position.set(Math.cos(t * sp) * r, 58 + Math.sin(t * 0.4) * 3, -46 + Math.sin(t * sp) * r);
      a.heli.group.rotation.y = -t * sp + Math.PI / 2;
      a.heli.rotor.rotation.y += dt * 26;
      a.heli.tailRotor.rotation.x += dt * 30;
    }
    if (a.crane) {
      a.crane.hook.rotation.z = Math.sin(t * 0.5) * 0.05;
      a.crane.group.rotation.y = Math.sin(t * 0.07) * 0.12;
    }
    if (a.police) {
      const on = (t * 3) % 2 < 1;
      a.police.lights[0].material.color.setHex(on ? 0x63b3ff : 0x123a63);
      a.police.lights[1].material.color.setHex(on ? 0x123a63 : 0x63b3ff);
    }

    // 시민: 인도를 오가고, 몬스터가 가까우면 도망친다
    const npcs = this.city.npcs;
    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i];
      n.phase += dt * 2.4;
      const near = this.enemies.hitTest(n.fig.position, 16);
      if (near) n.scared = 1.6;
      if (n.scared > 0) {
        n.scared -= dt;
        this._tmp.set(n.fig.position.x - (near ? near.pos.x : 0), 0, n.fig.position.z - (near ? near.pos.z : -1));
        if (this._tmp.lengthSq() < 0.01) this._tmp.set(0, 0, 1);
        this._tmp.normalize();
        n.fig.position.x += this._tmp.x * 15 * dt;
        n.fig.position.z += this._tmp.z * 15 * dt;
        n.fig.rotation.y = Math.atan2(this._tmp.x, this._tmp.z);
        L.animateWalk(n.fig, n.phase * 2.2, 1);
      } else if (n.patrol) {
        n.fig.position.z += n.dir * 5.2 * dt;
        if (Math.abs(n.fig.position.z - n.home.y) > 7) n.dir *= -1;
        n.fig.position.x += (n.home.x - n.fig.position.x) * dt * 1.6;
        n.fig.rotation.y = n.dir > 0 ? 0 : Math.PI;
        L.animateWalk(n.fig, n.phase, 0.5);
      } else {
        L.animateWalk(n.fig, n.phase * 0.35, 0.06);
      }
      const px = n.fig.position.x;
      if (Math.abs(px) < 14) n.fig.position.x = px < 0 ? -14 : 14;
      if (Math.abs(px) > 30) n.fig.position.x = px < 0 ? -30 : 30;
      if (n.fig.position.z > 38) n.fig.position.z = 38;
      if (n.fig.position.z < -60) n.fig.position.z = -60;
    }
  };

  // ------------------------------------------------------------------ 루프
  Game.prototype._loop = function (nowMs) {
    requestAnimationFrame(this._loop);
    const now = nowMs * 0.001;
    let dt = this._lastT ? now - this._lastT : 0.016;
    this._lastT = now;
    if (dt > 0.06) dt = 0.06;
    this._checkQuality(dt);
    this.time += dt;

    const p = this.player;

    if (this.state === 'playing' || this.state === 'down') {
      let speed01 = 0;
      if (this.state === 'playing') {
        speed01 = this.updatePlayer(dt);
        this.updateChannel(dt);
      } else {
        // 쓰러진 동안: 시야가 내려앉고 잠시 뒤 도시에서 깨어난다
        this.downTimer -= dt;
        p.eyeY += (p.pos.y + 1.2 - p.eyeY) * Math.min(1, dt * 4);
        this.camera.position.set(p.pos.x, p.eyeY, p.pos.z);
        this.camera.rotation.set(p.pitch - 0.5, p.yaw, 0.25);
        if (this.downTimer <= 0) this.respawn();
      }

      // 오픈월드: 지형 청크 · 지역 소품 · 지역 전환
      const changed = this.world.update(p.pos.x, p.pos.z, dt, 2);
      this.wilds.update(p.pos.x, p.pos.z);
      if (changed) {
        this.hud.regionBanner(changed);
        this.sfx.wave();
        // 사냥터에 들어서면 곧바로 몇 마리가 맞이한다
        if (!changed.safe) this.enemies.seedRegion(p.pos, changed, 4);
        if (!this.regionVisited[changed.id]) {
          this.regionVisited[changed.id] = true;
          if (!changed.safe) p.score += 150;
        }
      }
      this.updateAmbience(dt);
      this.updateCity(dt);

      // 몬스터: 지역 정원 유지 + 보스
      if (this.state === 'playing') {
        const region = this.world.current;
        this.enemies.updateSpawning(dt, p.pos, region);
        this.enemies.updateBoss(dt, p.pos, region, region ? this.world.content[region.id] : null);
      }
      this.enemies.update(dt, p.pos, this.camera);

      this.sun.position.set(p.pos.x + 58, p.pos.y + 96, p.pos.z + 62);
      this.sun.target.position.set(p.pos.x, p.pos.y, p.pos.z - 10);
      this.sun.target.updateMatrixWorld();

      this.fx.update(dt, {
        enemies: this.enemies,
        playerPos: this.camera.position,
        collectStud: (kind) => this.collectStud(kind),
      });
      this.hands.update(dt, speed01, false);

      // 표지판 앞이면 빠른 이동 안내를 띄운다
      const near = this.world.travelNear(p.pos.x, p.pos.z, 16);
      if (near) {
        const known = near.to === 'city' || this.regionVisited[near.to];
        this.hud.travelHint(known ? (near.label + ' 로 이동') : (near.label + ' — 먼저 걸어가 봐야 한다'));
      } else {
        this.hud.travelHint(null);
      }

      // HUD
      const region = this.world.current;
      const homeDx = 0 - p.pos.x, homeDz = -20 - p.pos.z;
      const homeDist = Math.hypot(homeDx, homeDz);
      // 화면 기준으로 도시가 어느 방향인지 (화살표 각도)
      const bearing = Math.atan2(homeDx, -homeDz);
      let rel = (bearing - p.yaw) * 180 / Math.PI;
      while (rel > 180) rel -= 360;
      while (rel < -180) rel += 360;
      this.hud.update(dt, {
        regionName: region ? region.name : '들판',
        remaining: this.enemies.nearbyCount(p.pos, 120),
        homeAngle: rel,
        homeDist,
        score: p.score,
        combo: p.combo,
        hearts: p.hearts,
        mana: p.mana,
        ammo: p.ammo,
        weaponIndex: this.hands.weaponIndex,
        skillIndex: this.hands.skillIndex,
        weaponCd: p.weaponCd,
        skillCd: this.skillCd,
        boss: this.enemies.boss,
      });
    } else {
      this.updateCity(dt * 0.6);
      this.hands.update(dt, 0, false);
      if (this.state === 'start') {
        const t = this.time * 0.06;
        const gy = this.world.heightAt(0, 30);
        this.camera.position.set(Math.sin(t) * 4, gy + P.eyeHeight + 1.2, 30 + Math.cos(t) * 3);
        this.camera.rotation.set(-0.05, Math.sin(t * 0.7) * 0.16, 0);
      }
    }

    // ---- 렌더
    this._shadowTick = (this._shadowTick + 1) % 2;
    this.renderer.shadowMap.needsUpdate = this._shadowTick === 0;
    const aimD = this.state === 'playing' ? this.aimDistance() : 0;
    this.post.setFocus(aimD || 40, dt);
    this.post.renderWorld(this.scene);
    this.renderer.clearDepth();
    this.renderer.render(this.hands.scene, this.hands.camera);
  };

  /** 조준선 앞 몬스터까지의 거리(접사 초점용) */
  Game.prototype.aimDistance = function () {
    const dir = this.aimDir();
    const eye = this.camera.position;
    let best = 0, bestDot = 0.986;
    const list = this.enemies.list;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive) continue;
      this._tmp2.set(e.pos.x - eye.x, (e.pos.y + e.radius * 0.6) - eye.y, e.pos.z - eye.z);
      const d = this._tmp2.length();
      if (d < 3) continue;
      this._tmp2.divideScalar(d);
      const dot = this._tmp2.dot(dir);
      if (dot > bestDot) { bestDot = dot; best = d; }
    }
    return best;
  };

  Game.prototype._checkQuality = function (dt) {
    if (!this.autoQuality || this._qualityStep >= 2 || dt <= 0) return;
    this._fpsAccum += dt;
    this._fpsFrames++;
    if (this._fpsAccum < 2.2) return;
    const fps = this._fpsFrames / this._fpsAccum;
    this._fpsAccum = 0;
    this._fpsFrames = 0;
    if (fps >= 42) { this._slowWindows = 0; return; }
    this._slowWindows++;
    if (this._slowWindows < 2) return;
    this._slowWindows = 0;
    this._qualityStep++;
    if (this._qualityStep === 1) {
      this.post.setScale(0.7);
      this.world.terrain.viewRadius = 300;
      this.world.farTerrain.viewRadius = 1000;
    } else {
      this.post.enabled = false;
      this.renderer.shadowMap.enabled = false;
      this.world.terrain.viewRadius = 240;
      this.world.farTerrain.viewRadius = 800;
    }
  };

  Game.prototype.collectStud = function (kind) {
    const p = this.player;
    if (kind === 'ammo') {
      p.ammo.blaster = Math.min(L.weaponById('blaster').ammoMax, p.ammo.blaster + L.weaponById('blaster').ammoPerPickup);
      p.ammo.bomb = Math.min(L.weaponById('bomb').ammoMax, p.ammo.bomb + L.weaponById('bomb').ammoPerPickup);
    } else if (kind === 'heart') {
      p.hearts = Math.min(P.maxHearts, p.hearts + 1);
      this.hud.toast('❤️ 하트 회복!', 0.9);
    } else {
      p.mana = Math.min(P.maxMana, p.mana + P.manaPerStud);
    }
    p.score += 5;
    this.sfx.pickup();
  };

  // 부팅
  window.addEventListener('DOMContentLoaded', () => {
    try {
      window.LEGO_GAME = new Game();
    } catch (err) {
      console.error(err);
      const s = document.getElementById('start-screen');
      if (s) {
        s.innerHTML = '<div class="sheet small"><h2>게임을 시작할 수 없었다</h2>' +
          '<p class="sub">' + String(err && err.message ? err.message : err) + '</p></div>';
      }
    }
  });

  L.Game = Game;
})(window.LEGO);
