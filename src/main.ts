import * as THREE from "three";
import "./style.css";

const WORLD_SIZE = 900;
const PLAYER_HEIGHT = 1.7;
const WALK_SPEED = 7;
const RUN_SPEED = 10;
const INTERACT_DISTANCE = 5.2;
const CHEST_STEP_INTERVAL = 100;
const CAVE_STEP_INTERVAL = 500;

type ItemId = string;
type ObjectType =
  | "smallTree"
  | "bigTree"
  | "chest"
  | "cave"
  | "caveExit"
  | "ore"
  | "mineChest"
  | "miner"
  | "animal"
  | "villageKnight"
  | "foodStorage"
  | "workbench"
  | "extendedWorkbench"
  | "smelter"
  | "specialSmelter";
type PanelType = "inventory" | "book" | "workbench" | "smelter" | null;
type LocationMode = "overworld" | "cave";

interface Slot {
  item: ItemId | null;
  count: number;
}

interface WorldObject {
  id: string;
  type: ObjectType;
  name: string;
  root: THREE.Object3D;
  hp?: number;
  armor?: number;
  ore?: ItemId;
  opened?: boolean;
  mineRich?: boolean;
  caveReturn?: THREE.Vector3;
}

interface Recipe {
  id: string;
  name: string;
  output: ItemId;
  count: number;
  ingredients: Record<ItemId, number>;
  note: string;
}

const ITEM_NAMES: Record<ItemId, string> = {
  tutorial_book: "튜토리얼 책",
  wood: "나무",
  stick: "나무 막대기",
  hammer: "망치",
  crafting_table: "제작대",
  extended_workbench: "확장 제작대",
  smelter: "재련대",
  special_smelter: "특수 재련대",
  bag: "가방",
  leather: "가죽",
  meat: "고기",
  stone: "돌",
  coal: "석탄",
  copper: "구리",
  iron: "철",
  gold: "금",
  diamond: "다이아몬드",
  obsidian: "흑요석",
  refined_wood: "재련된 나무",
  refined_stone: "재련된 돌",
  refined_copper: "재련된 구리",
  refined_iron: "재련된 철",
  refined_gold: "재련된 금",
  refined_diamond: "재련된 다이아몬드",
  sharp_obsidian: "날카로운 흑요석",
  weak_wood_axe: "약한 나무 도끼",
  sharp_wood_axe: "날카로운 나무 도끼",
  stone_axe: "돌 도끼",
  copper_axe: "구리 도끼",
  iron_axe: "철 도끼",
  gold_axe: "금 도끼",
  diamond_axe: "다이아몬드 도끼",
  wood_pickaxe: "나무 곡괭이",
  stone_pickaxe: "돌 곡괭이",
  copper_pickaxe: "구리 곡괭이",
  iron_pickaxe: "철 곡괭이",
  gold_pickaxe: "금 곡괭이",
  diamond_pickaxe: "다이아몬드 곡괭이",
  wood_dagger: "나무 단검",
  stone_dagger: "돌 단검",
  copper_dagger: "구리 단검",
  iron_dagger: "철 단검",
  gold_dagger: "금 단검",
  diamond_dagger: "다이아몬드 단검",
  obsidian_dagger: "날카로운 흑요석 단검",
  wood_sword: "나무 검",
  stone_sword: "돌 검",
  copper_sword: "구리 검",
  iron_sword: "철 검",
  gold_sword: "금 검",
  diamond_sword: "다이아몬드 검",
  obsidian_sword: "날카로운 흑요석 검",
  leather_armor: "가죽 갑옷",
  copper_armor: "구리 갑옷",
  iron_armor: "철 갑옷",
  gold_armor: "금 갑옷",
  diamond_armor: "다이아몬드 갑옷",
  obsidian_armor: "흑요석 갑옷",
};

const RAW_MATERIALS: ItemId[] = ["wood", "stone", "copper", "iron", "gold", "diamond"];
const REFINED_BY_RAW: Record<ItemId, ItemId> = {
  wood: "refined_wood",
  stone: "refined_stone",
  copper: "refined_copper",
  iron: "refined_iron",
  gold: "refined_gold",
  diamond: "refined_diamond",
};

const MATERIALS = [
  { raw: "wood", refined: "refined_wood", prefix: "wood", name: "나무", dagger: 5 },
  { raw: "stone", refined: "refined_stone", prefix: "stone", name: "돌", dagger: 10 },
  { raw: "copper", refined: "refined_copper", prefix: "copper", name: "구리", dagger: 20 },
  { raw: "iron", refined: "refined_iron", prefix: "iron", name: "철", dagger: 30 },
  { raw: "gold", refined: "refined_gold", prefix: "gold", name: "금", dagger: 25 },
  { raw: "diamond", refined: "refined_diamond", prefix: "diamond", name: "다이아몬드", dagger: 40 },
] as const;

const WEAPON_DAMAGE: Record<ItemId, number> = {
  wood_dagger: 5,
  stone_dagger: 10,
  copper_dagger: 20,
  iron_dagger: 30,
  gold_dagger: 25,
  diamond_dagger: 40,
  obsidian_dagger: 50,
  wood_sword: 10,
  stone_sword: 20,
  copper_sword: 40,
  iron_sword: 60,
  gold_sword: 50,
  diamond_sword: 80,
  obsidian_sword: 100,
  weak_wood_axe: 3,
  sharp_wood_axe: 6,
  stone_axe: 8,
  copper_axe: 12,
  iron_axe: 16,
  gold_axe: 14,
  diamond_axe: 22,
};

const ARMOR_VALUE: Record<ItemId, number> = {
  leather_armor: 5,
  copper_armor: 10,
  iron_armor: 15,
  gold_armor: 12,
  diamond_armor: 25,
  obsidian_armor: 35,
};

const AXE_POWER: Record<ItemId, number> = {
  weak_wood_axe: 1,
  sharp_wood_axe: 2,
  stone_axe: 2,
  copper_axe: 3,
  iron_axe: 4,
  gold_axe: 3,
  diamond_axe: 5,
};

const PICKAXE_POWER: Record<ItemId, number> = {
  wood_pickaxe: 1,
  stone_pickaxe: 2,
  copper_pickaxe: 3,
  iron_pickaxe: 4,
  gold_pickaxe: 3,
  diamond_pickaxe: 5,
};

const PLACEABLE_TYPES: Record<ItemId, ObjectType> = {
  crafting_table: "workbench",
  extended_workbench: "extendedWorkbench",
  smelter: "smelter",
  special_smelter: "specialSmelter",
};

const WORKBENCH_RECIPES: Recipe[] = [
  {
    id: "extended_workbench",
    name: "확장 제작대",
    output: "extended_workbench",
    count: 1,
    ingredients: { crafting_table: 2 },
    note: "제작대 2개를 합쳐 더 큰 제작대로 만듭니다.",
  },
  {
    id: "bag",
    name: "가방",
    output: "bag",
    count: 1,
    ingredients: { leather: 13 },
    note: "핫바 8칸, 인벤토리 40칸으로 확장합니다.",
  },
  {
    id: "weak_wood_axe",
    name: "약한 나무 도끼",
    output: "weak_wood_axe",
    count: 1,
    ingredients: { wood: 3, stick: 2 },
    note: "큰 나무를 캘 수 있는 첫 도끼입니다.",
  },
  {
    id: "sharp_wood_axe",
    name: "날카로운 나무 도끼",
    output: "sharp_wood_axe",
    count: 1,
    ingredients: { refined_wood: 3, stick: 2 },
    note: "재련된 나무로 만든 더 좋은 도끼입니다.",
  },
  {
    id: "special_smelter",
    name: "특수 재련대",
    output: "special_smelter",
    count: 1,
    ingredients: { smelter: 1, hammer: 1 },
    note: "흑요석을 재련할 수 있습니다.",
  },
  {
    id: "obsidian_dagger",
    name: "날카로운 흑요석 단검",
    output: "obsidian_dagger",
    count: 1,
    ingredients: { sharp_obsidian: 1, stick: 1 },
    note: "데미지 50.",
  },
  {
    id: "obsidian_sword",
    name: "날카로운 흑요석 검",
    output: "obsidian_sword",
    count: 1,
    ingredients: { sharp_obsidian: 2, stick: 1 },
    note: "데미지 100.",
  },
  {
    id: "leather_armor",
    name: "가죽 갑옷",
    output: "leather_armor",
    count: 1,
    ingredients: { leather: 8 },
    note: "방어력 +5.",
  },
];

for (const material of MATERIALS) {
  if (material.prefix !== "wood") {
    WORKBENCH_RECIPES.push({
      id: `${material.prefix}_axe`,
      name: `${material.name} 도끼`,
      output: `${material.prefix}_axe`,
      count: 1,
      ingredients: { [material.refined]: 3, stick: 2 },
      note: "큰 나무를 더 빠르게 캘 수 있습니다.",
    });
  }

  WORKBENCH_RECIPES.push(
    {
      id: `${material.prefix}_pickaxe`,
      name: `${material.name} 곡괭이`,
      output: `${material.prefix}_pickaxe`,
      count: 1,
      ingredients: { [material.refined]: 3, stick: 2 },
      note: material.prefix === "diamond" ? "흑요석을 캘 수 있습니다." : "광물을 캘 수 있습니다.",
    },
    {
      id: `${material.prefix}_dagger`,
      name: `${material.name} 단검`,
      output: `${material.prefix}_dagger`,
      count: 1,
      ingredients: { [material.refined]: 1, stick: 1 },
      note: `데미지 ${material.dagger}.`,
    },
    {
      id: `${material.prefix}_sword`,
      name: `${material.name} 검`,
      output: `${material.prefix}_sword`,
      count: 1,
      ingredients: { [material.refined]: 2, stick: 1 },
      note: `데미지 ${material.dagger * 2}.`,
    },
  );
}

WORKBENCH_RECIPES.push(
  {
    id: "copper_armor",
    name: "구리 갑옷",
    output: "copper_armor",
    count: 1,
    ingredients: { refined_copper: 8 },
    note: "방어력 +10.",
  },
  {
    id: "iron_armor",
    name: "철 갑옷",
    output: "iron_armor",
    count: 1,
    ingredients: { refined_iron: 8 },
    note: "방어력 +15.",
  },
  {
    id: "gold_armor",
    name: "금 갑옷",
    output: "gold_armor",
    count: 1,
    ingredients: { refined_gold: 8 },
    note: "방어력 +12. 멋지지만 튼튼함은 철보다 낮습니다.",
  },
  {
    id: "diamond_armor",
    name: "다이아몬드 갑옷",
    output: "diamond_armor",
    count: 1,
    ingredients: { refined_diamond: 8 },
    note: "방어력 +25.",
  },
  {
    id: "obsidian_armor",
    name: "흑요석 갑옷",
    output: "obsidian_armor",
    count: 1,
    ingredients: { sharp_obsidian: 8 },
    note: "방어력 +35.",
  },
);

const TUTORIAL_SECTIONS = [
  "이 게임은 3D 1인칭 야생 생존 게임입니다. 화면을 클릭하면 마우스로 시점을 돌릴 수 있고, WASD로 움직입니다.",
  "처음 하단 핫바는 4칸입니다. 책은 튜토리얼입니다. I를 눌러 인벤토리, B를 눌러 책을 엽니다.",
  "작은 나무는 맨손으로 캘 수 있고 나무 1개를 줍니다. 큰 나무는 도끼가 필요하고 나무 5개를 줍니다.",
  "상자는 100걸음마다 50% 확률로 주변에 생깁니다. 상자 안에는 망치가 50%, 재련대가 2% 확률로 들어 있습니다.",
  "인벤토리의 2x2 미니 제작칸에 나무 4개를 넣고 망치를 가지고 있으면 제작대를 만들 수 있습니다.",
  "제작대를 설치한 뒤 E로 상호작용하면 레시피북이 열립니다. 제작대 2개를 합치면 확장 제작대가 됩니다.",
  "재련대는 나무, 돌, 구리, 철, 금, 다이아몬드를 재련된 재료로 바꿉니다. 특수 재련대는 흑요석을 날카로운 흑요석으로 바꿉니다.",
  "재련된 나무 3개와 막대기 2개는 날카로운 나무 도끼가 됩니다. 일반 나무 3개와 막대기 2개는 약한 나무 도끼가 됩니다.",
  "동굴은 500걸음마다 20% 확률로 주변에 생깁니다. 동굴에는 돌, 석탄, 드문 광부, 아주 낮은 확률의 광산이 있습니다.",
  "광산 상자는 구리 50%, 철 20%, 금 10%, 다이아몬드 5%, 석탄 15% 확률로 광물이 나옵니다. 5% 확률로 여러 광물이 같이 나옵니다.",
  "가방은 가죽 13개로 제작대에서 만듭니다. 가방을 만들면 핫바가 8칸, 인벤토리가 40칸으로 확장됩니다.",
  "흑요석은 다이아몬드 곡괭이로만 캘 수 있습니다. 흑요석 단검 데미지는 50, 흑요석 검 데미지는 100입니다.",
  "플레이어 기본 체력은 10, 방어력은 0입니다. 갑옷을 만들면 자동으로 가장 좋은 갑옷을 입습니다.",
  "마을에는 식량창고와 마을기사가 있습니다. 마을기사의 체력은 10, 방어력은 5입니다.",
];

class WildernessGame {
  private readonly container: HTMLDivElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.1, 1200);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2(0, 0);
  private readonly clock = new THREE.Clock();
  private readonly keys = new Set<string>();
  private readonly objects = new Map<string, WorldObject>();
  private readonly raycastTargets: THREE.Object3D[] = [];
  private readonly hotbar: Slot[] = [
    { item: "tutorial_book", count: 1 },
    { item: null, count: 0 },
    { item: null, count: 0 },
    { item: null, count: 0 },
  ];
  private readonly bagSlots: Slot[] = [];
  private readonly craftSlots: Slot[] = Array.from({ length: 4 }, () => ({ item: null, count: 0 }));
  private readonly uiRoot = document.createElement("div");
  private readonly statsEl = document.createElement("div");
  private readonly promptEl = document.createElement("div");
  private readonly hotbarEl = document.createElement("div");
  private readonly messageEl = document.createElement("div");
  private readonly panelEl = document.createElement("div");
  private selectedHotbarIndex = 0;
  private selectedCraftItem: ItemId | null = null;
  private currentPanel: PanelType = null;
  private currentStationId: string | null = null;
  private yaw = 0;
  private pitch = 0;
  private playerPosition = new THREE.Vector3(0, PLAYER_HEIGHT, 12);
  private previousPosition = this.playerPosition.clone();
  private totalSteps = 0;
  private chestStepBank = 0;
  private caveStepBank = 0;
  private health = 10;
  private maxHealth = 10;
  private equippedArmor: ItemId | null = null;
  private locationMode: LocationMode = "overworld";
  private caveReturnPosition: THREE.Vector3 | null = null;
  private caveObjectIds: string[] = [];
  private messageTimer = 0;
  private lastTargetId: string | null = null;

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.setupRenderer();
    this.setupScene();
    this.setupUi();
    this.setupEvents();
    this.seedOverworld();
    this.renderHud();
    this.animate();
  }

  private setupRenderer() {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.domElement.className = "game-canvas";
    this.container.appendChild(this.renderer.domElement);
    this.camera.position.copy(this.playerPosition);
  }

  private setupScene() {
    this.scene.background = new THREE.Color(0xaed8ff);
    this.scene.fog = new THREE.Fog(0xaed8ff, 70, 460);

    const ambient = new THREE.HemisphereLight(0xeaf7ff, 0x49623d, 2.2);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 2.6);
    sun.position.set(80, 140, 40);
    this.scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 48, 48),
      new THREE.MeshStandardMaterial({ color: 0x5fa85c, roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.name = "grassland";
    this.scene.add(ground);

    const grid = new THREE.GridHelper(WORLD_SIZE, 90, 0x40794d, 0x78b36a);
    grid.position.y = 0.012;
    this.scene.add(grid);
  }

  private setupUi() {
    this.uiRoot.className = "game-ui";
    this.statsEl.className = "stats";
    this.promptEl.className = "prompt";
    this.hotbarEl.className = "hotbar";
    this.messageEl.className = "message";
    this.panelEl.className = "panel-layer";
    this.uiRoot.innerHTML = '<div class="crosshair"></div>';
    this.uiRoot.append(this.statsEl, this.promptEl, this.hotbarEl, this.messageEl, this.panelEl);
    this.container.appendChild(this.uiRoot);
  }

  private setupEvents() {
    window.addEventListener("resize", () => this.resize());
    this.renderer.domElement.addEventListener("click", () => {
      if (this.currentPanel === null) this.renderer.domElement.requestPointerLock();
    });
    document.addEventListener("pointerlockchange", () => this.renderHud());
    document.addEventListener("mousemove", (event) => this.handleMouseMove(event));
    document.addEventListener("keydown", (event) => this.handleKeyDown(event));
    document.addEventListener("keyup", (event) => this.keys.delete(event.code));
  }

  private seedOverworld() {
    for (let i = 0; i < 42; i += 1) this.spawnTree(i % 3 === 0 ? "bigTree" : "smallTree", this.randomGroundPoint());
    for (let i = 0; i < 6; i += 1) this.spawnChest(this.randomGroundPoint(), false);
    for (let i = 0; i < 3; i += 1) this.spawnCave(this.randomGroundPoint());
    for (let i = 0; i < 10; i += 1) this.spawnAnimal(this.randomGroundPoint());
    this.spawnVillage(new THREE.Vector3(58, 0, -76));
  }

  private handleMouseMove(event: MouseEvent) {
    if (document.pointerLockElement !== this.renderer.domElement || this.currentPanel !== null) return;
    this.yaw -= event.movementX * 0.0024;
    this.pitch -= event.movementY * 0.002;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.32, 1.32);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }

  private handleKeyDown(event: KeyboardEvent) {
    this.keys.add(event.code);
    if (event.code === "Escape") {
      this.closePanel();
      return;
    }
    if (event.code === "KeyI") this.togglePanel("inventory");
    if (event.code === "KeyB") this.togglePanel("book");
    if (event.code === "KeyE") this.interact();
    if (event.code === "KeyP") this.placeSelectedObject();
    if (event.code.startsWith("Digit")) this.selectHotbarByKey(event.code);
  }

  private selectHotbarByKey(code: string) {
    const number = Number(code.replace("Digit", ""));
    if (Number.isInteger(number) && number >= 1 && number <= this.hotbar.length) {
      this.selectedHotbarIndex = number - 1;
      this.renderHud();
    }
  }

  private resize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private animate = () => {
    requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.update(delta);
    this.renderer.render(this.scene, this.camera);
  };

  private update(delta: number) {
    this.updateMovement(delta);
    this.updateMessages(delta);
    this.updatePrompt();
  }

  private updateMovement(delta: number) {
    if (this.currentPanel !== null) return;

    const direction = new THREE.Vector3();
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    if (this.keys.has("KeyW")) direction.add(forward);
    if (this.keys.has("KeyS")) direction.sub(forward);
    if (this.keys.has("KeyD")) direction.add(right);
    if (this.keys.has("KeyA")) direction.sub(right);

    if (direction.lengthSq() === 0) return;

    direction.normalize();
    const speed = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? RUN_SPEED : WALK_SPEED;
    this.playerPosition.addScaledVector(direction, speed * delta);
    this.playerPosition.x = THREE.MathUtils.clamp(this.playerPosition.x, -WORLD_SIZE / 2 + 5, WORLD_SIZE / 2 - 5);
    this.playerPosition.z = THREE.MathUtils.clamp(this.playerPosition.z, -WORLD_SIZE / 2 + 5, WORLD_SIZE / 2 - 5);
    this.playerPosition.y = PLAYER_HEIGHT;
    this.camera.position.copy(this.playerPosition);

    const moved = this.playerPosition.distanceTo(this.previousPosition);
    if (moved > 0) {
      this.totalSteps += moved;
      if (this.locationMode === "overworld") this.checkStepEvents(moved);
      this.previousPosition.copy(this.playerPosition);
      this.renderHud();
    }
  }

  private checkStepEvents(moved: number) {
    this.chestStepBank += moved;
    this.caveStepBank += moved;

    while (this.chestStepBank >= CHEST_STEP_INTERVAL) {
      this.chestStepBank -= CHEST_STEP_INTERVAL;
      if (Math.random() < 0.5) {
        this.spawnChest(this.pointNearPlayer(18, 30), false);
        this.showMessage("발자국 소리를 따라가 보니 상자가 생겼습니다. (100걸음 50%)");
      }
    }

    while (this.caveStepBank >= CAVE_STEP_INTERVAL) {
      this.caveStepBank -= CAVE_STEP_INTERVAL;
      if (Math.random() < 0.2) {
        this.spawnCave(this.pointNearPlayer(26, 44));
        this.showMessage("멀리 동굴 입구가 보입니다. (500걸음 20%)");
      }
    }
  }

  private updateMessages(delta: number) {
    if (this.messageTimer <= 0) return;
    this.messageTimer -= delta;
    if (this.messageTimer <= 0) this.messageEl.textContent = "";
  }

  private updatePrompt() {
    const target = this.getLookTarget();
    if (target?.id === this.lastTargetId) return;
    this.lastTargetId = target?.id ?? null;

    const lockText =
      document.pointerLockElement === this.renderer.domElement
        ? "I 인벤토리 | B 책 | E 상호작용 | P 설치 | 1-8 선택"
        : "화면 클릭: 1인칭 시점 고정";

    if (!target) {
      this.promptEl.textContent = lockText;
      return;
    }

    const action = this.actionTextFor(target);
    this.promptEl.textContent = `${action} | ${lockText}`;
  }

  private actionTextFor(target: WorldObject) {
    if (target.type === "smallTree") return "E: 작은 나무 캐기";
    if (target.type === "bigTree") return "E: 큰 나무 캐기(도끼 필요)";
    if (target.type === "chest") return target.opened ? "이미 연 상자" : "E: 상자 열기";
    if (target.type === "cave") return "E: 동굴 들어가기";
    if (target.type === "caveExit") return "E: 동굴 나가기";
    if (target.type === "ore") return `E: ${target.name} 캐기`;
    if (target.type === "mineChest") return target.opened ? "이미 연 광산 상자" : "E: 광산 상자 열기";
    if (target.type === "miner") return "E: 광부와 대화";
    if (target.type === "animal") return `E: ${target.name} 사냥`;
    if (target.type === "villageKnight") return "E: 마을기사 공격";
    if (target.type === "foodStorage") return "E: 식량창고 열기";
    if (target.type === "workbench" || target.type === "extendedWorkbench") return "E: 제작대 사용";
    if (target.type === "smelter" || target.type === "specialSmelter") return "E: 재련대 사용";
    return "E: 상호작용";
  }

  private interact() {
    const target = this.getLookTarget();
    if (!target) {
      this.showMessage("가까이 보고 있는 대상이 없습니다.");
      return;
    }

    if (target.type === "smallTree") this.harvestSmallTree(target);
    if (target.type === "bigTree") this.harvestBigTree(target);
    if (target.type === "chest") this.openChest(target);
    if (target.type === "cave") this.enterCave(target);
    if (target.type === "caveExit") this.leaveCave();
    if (target.type === "ore") this.mineOre(target);
    if (target.type === "mineChest") this.openMineChest(target);
    if (target.type === "miner") this.showMessage("광부: 이 동굴 어딘가에 광산이 있을지도 몰라. 아주 드물지만!");
    if (target.type === "animal") this.attackAnimal(target);
    if (target.type === "villageKnight") this.attackKnight(target);
    if (target.type === "foodStorage") this.openFoodStorage();
    if (target.type === "workbench" || target.type === "extendedWorkbench") this.openStation("workbench", target.id);
    if (target.type === "smelter" || target.type === "specialSmelter") this.openStation("smelter", target.id);
    this.renderHud();
  }

  private harvestSmallTree(target: WorldObject) {
    this.addItem("wood", 1);
    this.removeObject(target.id);
    this.showMessage("작은 나무를 캐서 나무 1개를 얻었습니다.");
  }

  private harvestBigTree(target: WorldObject) {
    if (this.bestPower(AXE_POWER) <= 0) {
      this.showMessage("큰 나무는 도끼가 있어야 캘 수 있습니다.");
      return;
    }
    this.addItem("wood", 5);
    this.removeObject(target.id);
    this.showMessage("큰 나무를 베어 나무 5개를 얻었습니다.");
  }

  private openChest(target: WorldObject) {
    if (target.opened) {
      this.showMessage("이미 연 상자입니다.");
      return;
    }
    target.opened = true;
    this.tintObject(target.root, 0x6a5940);

    const loot: string[] = [];
    if (Math.random() < 0.5 && this.addItem("hammer", 1)) loot.push("망치");
    if (Math.random() < 0.02 && this.addItem("smelter", 1)) loot.push("재련대");
    if (Math.random() < 0.45 && this.addItem("wood", THREE.MathUtils.randInt(1, 3))) loot.push("나무");
    if (Math.random() < 0.35 && this.addItem("stick", THREE.MathUtils.randInt(1, 2))) loot.push("나무 막대기");
    if (Math.random() < 0.15 && this.addItem("leather", 1)) loot.push("가죽");

    this.showMessage(loot.length > 0 ? `상자에서 ${loot.join(", ")}를 얻었습니다.` : "상자가 비어 있었습니다.");
  }

  private enterCave(target: WorldObject) {
    this.caveReturnPosition = target.caveReturn?.clone() ?? this.playerPosition.clone();
    this.clearCaveObjects();
    this.locationMode = "cave";
    this.playerPosition.set(0, PLAYER_HEIGHT, -780);
    this.previousPosition.copy(this.playerPosition);
    this.camera.position.copy(this.playerPosition);
    this.createCaveInterior();
    this.showMessage("동굴 안으로 들어왔습니다. 돌과 석탄을 찾아보세요.");
    this.renderHud();
  }

  private leaveCave() {
    this.locationMode = "overworld";
    this.clearCaveObjects();
    this.playerPosition.copy(this.caveReturnPosition ?? new THREE.Vector3(0, PLAYER_HEIGHT, 12));
    this.previousPosition.copy(this.playerPosition);
    this.camera.position.copy(this.playerPosition);
    this.showMessage("다시 야생으로 나왔습니다.");
    this.renderHud();
  }

  private mineOre(target: WorldObject) {
    if (!target.ore) return;
    if (target.ore === "obsidian" && this.bestPower(PICKAXE_POWER) < 5) {
      this.showMessage("흑요석은 다이아몬드 곡괭이로만 캘 수 있습니다.");
      return;
    }
    if (target.ore !== "stone" && target.ore !== "coal" && this.bestPower(PICKAXE_POWER) <= 0) {
      this.showMessage("광물은 곡괭이가 있으면 더 제대로 캘 수 있습니다.");
      return;
    }
    this.addItem(target.ore, target.ore === "stone" ? 2 : 1);
    this.removeObject(target.id);
    this.showMessage(`${ITEM_NAMES[target.ore]}을 얻었습니다.`);
  }

  private openMineChest(target: WorldObject) {
    if (target.opened) {
      this.showMessage("이미 연 광산 상자입니다.");
      return;
    }
    target.opened = true;
    this.tintObject(target.root, 0x4f4636);

    const rolls = Math.random() < 0.05 ? THREE.MathUtils.randInt(2, 3) : 1;
    const loot: string[] = [];
    for (let i = 0; i < rolls; i += 1) {
      const item = this.rollMineMineral();
      if (this.addItem(item, 1)) loot.push(ITEM_NAMES[item]);
    }
    this.showMessage(`광산 상자에서 ${loot.join(", ")}를 얻었습니다.`);
  }

  private attackAnimal(target: WorldObject) {
    const damage = this.currentDamage();
    target.hp = (target.hp ?? 8) - damage;
    if (target.hp > 0) {
      this.showMessage(`${target.name}에게 ${damage} 피해. 남은 체력 ${target.hp}.`);
      return;
    }
    this.addItem("leather", THREE.MathUtils.randInt(1, 2));
    if (Math.random() < 0.25) this.addItem("meat", 1);
    this.removeObject(target.id);
    this.showMessage(`${target.name}을 사냥해 가죽을 얻었습니다.`);
  }

  private attackKnight(target: WorldObject) {
    const damage = Math.max(1, this.currentDamage() - (target.armor ?? 0));
    target.hp = (target.hp ?? 10) - damage;
    if (target.hp > 0) {
      this.damagePlayer(2);
      this.showMessage(`마을기사에게 ${damage} 피해. 반격을 받았습니다.`);
      return;
    }
    this.addItem("iron", 1);
    this.removeObject(target.id);
    this.showMessage("마을기사를 물리치고 철 1개를 얻었습니다.");
  }

  private openFoodStorage() {
    const knightNearby = [...this.objects.values()].some(
      (object) =>
        object.type === "villageKnight" &&
        object.root.position.distanceTo(this.playerPosition) < 22 &&
        this.locationMode === "overworld",
    );
    this.addItem("meat", THREE.MathUtils.randInt(2, 4));
    if (knightNearby) {
      this.damagePlayer(3);
      this.showMessage("식량을 얻었지만 마을기사에게 들켜 피해를 받았습니다.");
    } else {
      this.showMessage("식량창고에서 고기를 얻었습니다.");
    }
  }

  private openStation(panel: "workbench" | "smelter", stationId: string) {
    this.currentStationId = stationId;
    this.togglePanel(panel);
  }

  private rollMineMineral(): ItemId {
    const roll = Math.random() * 100;
    if (roll < 50) return "copper";
    if (roll < 70) return "iron";
    if (roll < 80) return "gold";
    if (roll < 85) return "diamond";
    return "coal";
  }

  private currentDamage() {
    const selectedItem = this.hotbar[this.selectedHotbarIndex]?.item;
    if (selectedItem && WEAPON_DAMAGE[selectedItem]) return WEAPON_DAMAGE[selectedItem];
    return Math.max(1, this.bestPower(WEAPON_DAMAGE));
  }

  private damagePlayer(amount: number) {
    const armor = this.equippedArmor ? ARMOR_VALUE[this.equippedArmor] ?? 0 : 0;
    const damage = Math.max(1, amount - Math.floor(armor / 10));
    this.health = Math.max(0, this.health - damage);
    if (this.health <= 0) {
      this.health = this.maxHealth;
      this.playerPosition.set(0, PLAYER_HEIGHT, 12);
      this.previousPosition.copy(this.playerPosition);
      this.camera.position.copy(this.playerPosition);
      this.showMessage("체력이 0이 되어 시작 지점으로 돌아왔습니다.");
    }
  }

  private placeSelectedObject() {
    const selectedItem = this.hotbar[this.selectedHotbarIndex]?.item;
    const selectedPlaceable = selectedItem && PLACEABLE_TYPES[selectedItem] ? selectedItem : null;
    const fallback = selectedPlaceable ?? this.firstAvailablePlaceable();

    if (!fallback) {
      this.showMessage("설치할 제작대나 재련대가 없습니다.");
      return;
    }

    if (!this.removeItem(fallback, 1)) {
      this.showMessage("설치할 아이템을 찾지 못했습니다.");
      return;
    }

    const position = this.pointInFront(4);
    if (fallback === "crafting_table") this.spawnWorkbench(position, false);
    if (fallback === "extended_workbench") this.spawnWorkbench(position, true);
    if (fallback === "smelter") this.spawnSmelter(position, false);
    if (fallback === "special_smelter") this.spawnSmelter(position, true);
    this.showMessage(`${ITEM_NAMES[fallback]}를 설치했습니다.`);
    this.renderHud();
  }

  private firstAvailablePlaceable() {
    return ["crafting_table", "extended_workbench", "special_smelter", "smelter"].find((item) => this.countItem(item) > 0) ?? null;
  }

  private getLookTarget() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.raycastTargets, true);
    for (const hit of hits) {
      const objectId = this.findObjectId(hit.object);
      if (!objectId) continue;
      const target = this.objects.get(objectId);
      if (!target) continue;
      if (hit.distance <= INTERACT_DISTANCE) return target;
    }
    return null;
  }

  private findObjectId(object: THREE.Object3D): string | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      if (typeof current.userData.objectId === "string") return current.userData.objectId;
      current = current.parent;
    }
    return null;
  }

  private togglePanel(panel: Exclude<PanelType, null>) {
    this.currentPanel = this.currentPanel === panel ? null : panel;
    if (this.currentPanel !== null && document.pointerLockElement) document.exitPointerLock();
    this.renderPanel();
    this.renderHud();
  }

  private closePanel() {
    this.currentPanel = null;
    this.currentStationId = null;
    this.renderPanel();
    this.renderHud();
  }

  private renderHud() {
    const armor = this.equippedArmor ? ARMOR_VALUE[this.equippedArmor] ?? 0 : 0;
    const location = this.locationMode === "cave" ? "동굴" : "야생";
    this.statsEl.textContent = `체력 ${this.health}/${this.maxHealth} | 방어 ${armor} | 걸음 ${Math.floor(this.totalSteps)} | ${location}`;

    this.hotbarEl.innerHTML = this.hotbar
      .map((slot, index) => {
        const label = slot.item ? `${this.shortName(slot.item)} ${slot.count}` : "";
        const selected = index === this.selectedHotbarIndex ? " selected" : "";
        return `<button class="slot${selected}" data-hotbar="${index}"><span>${index + 1}</span>${label}</button>`;
      })
      .join("");

    this.hotbarEl.querySelectorAll<HTMLButtonElement>("[data-hotbar]").forEach((button) => {
      button.addEventListener("click", () => {
        this.selectedHotbarIndex = Number(button.dataset.hotbar);
        this.renderHud();
      });
    });
  }

  private renderPanel() {
    if (this.currentPanel === null) {
      this.panelEl.innerHTML = "";
      return;
    }

    if (this.currentPanel === "inventory") this.renderInventoryPanel();
    if (this.currentPanel === "book") this.renderBookPanel();
    if (this.currentPanel === "workbench") this.renderWorkbenchPanel();
    if (this.currentPanel === "smelter") this.renderSmelterPanel();
  }

  private renderInventoryPanel() {
    const itemButtons = Object.entries(this.itemCounts())
      .filter(([item]) => item !== "tutorial_book")
      .map(([item, count]) => {
        const selected = this.selectedCraftItem === item ? " selected" : "";
        return `<button class="item-button${selected}" data-select-item="${item}">${ITEM_NAMES[item] ?? item} x${count}</button>`;
      })
      .join("");

    const craftSlots = this.craftSlots
      .map((slot, index) => {
        const label = slot.item ? `${this.shortName(slot.item)} ${slot.count}` : "빈칸";
        return `<button class="craft-slot" data-craft-slot="${index}">${label}</button>`;
      })
      .join("");

    const bagGrid =
      this.bagSlots.length > 0
        ? `<section><h3>가방 40칸</h3><div class="bag-grid">${this.bagSlots
            .map((slot) => `<div class="mini-slot">${slot.item ? `${this.shortName(slot.item)} ${slot.count}` : ""}</div>`)
            .join("")}</div></section>`
        : `<p class="muted">가방을 만들면 이곳이 40칸으로 확장됩니다.</p>`;

    this.panelEl.innerHTML = `
      <section class="panel">
        <header>
          <h2>인벤토리</h2>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <div class="panel-grid">
          <section>
            <h3>보유 아이템</h3>
            <div class="item-list">${itemButtons || '<p class="muted">아직 재료가 없습니다.</p>'}</div>
            <p class="muted">아이템을 고른 뒤 제작칸을 누르면 1개씩 넣습니다.</p>
          </section>
          <section>
            <h3>미니 제작대 2x2</h3>
            <div class="craft-grid">${craftSlots}</div>
            <div class="panel-actions">
              <button data-mini-craft>제작</button>
              <button data-clear-craft>재료 빼기</button>
            </div>
            <p class="muted">나무 1개: 막대기 2개 / 나무 4개 + 망치 보유: 제작대</p>
          </section>
        </div>
        <section>
          <h3>하단 핫바 ${this.hotbar.length}칸</h3>
          <div class="inventory-hotbar">${this.hotbar
            .map((slot) => `<div class="mini-slot">${slot.item ? `${this.shortName(slot.item)} ${slot.count}` : ""}</div>`)
            .join("")}</div>
        </section>
        ${bagGrid}
      </section>
    `;

    this.bindPanelBasics();
    this.panelEl.querySelectorAll<HTMLButtonElement>("[data-select-item]").forEach((button) => {
      button.addEventListener("click", () => {
        this.selectedCraftItem = button.dataset.selectItem ?? null;
        this.renderInventoryPanel();
      });
    });
    this.panelEl.querySelectorAll<HTMLButtonElement>("[data-craft-slot]").forEach((button) => {
      button.addEventListener("click", () => this.handleCraftSlotClick(Number(button.dataset.craftSlot)));
    });
    this.panelEl.querySelector<HTMLButtonElement>("[data-mini-craft]")?.addEventListener("click", () => this.craftMiniRecipe());
    this.panelEl.querySelector<HTMLButtonElement>("[data-clear-craft]")?.addEventListener("click", () => this.clearCraftSlots());
  }

  private renderBookPanel() {
    this.panelEl.innerHTML = `
      <section class="panel book-panel">
        <header>
          <h2>튜토리얼 책</h2>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <ol>${TUTORIAL_SECTIONS.map((line) => `<li>${line}</li>`).join("")}</ol>
        <h3>핵심 레시피</h3>
        <div class="recipe-lines">
          <p>나무 1개 -> 나무 막대기 2개</p>
          <p>나무 4개 + 망치 보유 -> 제작대 1개</p>
          <p>제작대 2개 -> 확장 제작대 1개</p>
          <p>재련대 1개 + 망치 1개 -> 특수 재련대 1개</p>
          <p>재련된 나무 3개 + 막대기 2개 -> 날카로운 나무 도끼</p>
          <p>일반 나무 3개 + 막대기 2개 -> 약한 나무 도끼</p>
          <p>날카로운 흑요석 1개 + 막대기 1개 -> 흑요석 단검</p>
          <p>날카로운 흑요석 2개 + 막대기 1개 -> 흑요석 검</p>
        </div>
      </section>
    `;
    this.bindPanelBasics();
  }

  private renderWorkbenchPanel() {
    const station = this.currentStationId ? this.objects.get(this.currentStationId) : null;
    const isExtended = station?.type === "extendedWorkbench";
    const recipes = WORKBENCH_RECIPES.filter((recipe) => isExtended || recipe.id !== "obsidian_armor");
    this.panelEl.innerHTML = `
      <section class="panel workbench-panel">
        <header>
          <h2>${isExtended ? "확장 제작대" : "제작대"} 레시피북</h2>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <div class="recipes">
          ${recipes
            .map((recipe) => {
              const canCraft = this.canCraft(recipe);
              const ingredients = Object.entries(recipe.ingredients)
                .map(([item, count]) => `${ITEM_NAMES[item] ?? item} ${count}`)
                .join(" + ");
              return `<article class="recipe-card">
                <div>
                  <strong>${recipe.name}</strong>
                  <p>${ingredients} -> ${ITEM_NAMES[recipe.output] ?? recipe.output} ${recipe.count}</p>
                  <small>${recipe.note}</small>
                </div>
                <button data-recipe="${recipe.id}" ${canCraft ? "" : "disabled"}>제작</button>
              </article>`;
            })
            .join("")}
        </div>
      </section>
    `;
    this.bindPanelBasics();
    this.panelEl.querySelectorAll<HTMLButtonElement>("[data-recipe]").forEach((button) => {
      button.addEventListener("click", () => this.craftWorkbenchRecipe(button.dataset.recipe ?? ""));
    });
  }

  private renderSmelterPanel() {
    const station = this.currentStationId ? this.objects.get(this.currentStationId) : null;
    const isSpecial = station?.type === "specialSmelter";
    const rawItems = isSpecial ? [...RAW_MATERIALS, "obsidian"] : RAW_MATERIALS;
    this.panelEl.innerHTML = `
      <section class="panel smelter-panel">
        <header>
          <h2>${isSpecial ? "특수 재련대" : "재련대"}</h2>
          <button class="icon-button" data-close>닫기</button>
        </header>
        <div class="recipes">
          ${rawItems
            .map((item) => {
              const output = item === "obsidian" ? "sharp_obsidian" : REFINED_BY_RAW[item];
              const disabled = this.countItem(item) <= 0 ? "disabled" : "";
              return `<article class="recipe-card">
                <div>
                  <strong>${ITEM_NAMES[item]} 재련</strong>
                  <p>${ITEM_NAMES[item]} 1 -> ${ITEM_NAMES[output]} 1</p>
                </div>
                <button data-smelt="${item}" ${disabled}>재련</button>
              </article>`;
            })
            .join("")}
        </div>
      </section>
    `;
    this.bindPanelBasics();
    this.panelEl.querySelectorAll<HTMLButtonElement>("[data-smelt]").forEach((button) => {
      button.addEventListener("click", () => this.smeltItem(button.dataset.smelt ?? ""));
    });
  }

  private bindPanelBasics() {
    this.panelEl.querySelector<HTMLButtonElement>("[data-close]")?.addEventListener("click", () => this.closePanel());
  }

  private handleCraftSlotClick(index: number) {
    const slot = this.craftSlots[index];
    if (!slot) return;

    if (slot.item) {
      this.addItem(slot.item, slot.count);
      slot.item = null;
      slot.count = 0;
      this.renderInventoryPanel();
      this.renderHud();
      return;
    }

    if (!this.selectedCraftItem) {
      this.showMessage("먼저 보유 아이템을 선택하세요.");
      return;
    }

    if (!this.removeItem(this.selectedCraftItem, 1)) {
      this.showMessage("선택한 아이템이 부족합니다.");
      return;
    }

    slot.item = this.selectedCraftItem;
    slot.count = 1;
    if (this.countItem(this.selectedCraftItem) <= 0) this.selectedCraftItem = null;
    this.renderInventoryPanel();
    this.renderHud();
  }

  private craftMiniRecipe() {
    const counts = this.craftCounts();
    if (counts.wood === 1 && Object.keys(counts).length === 1) {
      this.clearCraftSlots(false);
      this.addItem("stick", 2);
      this.showMessage("나무 막대기 2개를 만들었습니다.");
      this.renderPanel();
      this.renderHud();
      return;
    }

    if (counts.wood === 4 && Object.keys(counts).length === 1) {
      if (!this.removeItem("hammer", 1)) {
        this.showMessage("제작대를 만들려면 망치가 필요합니다.");
        return;
      }
      this.clearCraftSlots(false);
      this.addItem("crafting_table", 1);
      this.showMessage("제작대를 만들었습니다. P로 설치하세요.");
      this.renderPanel();
      this.renderHud();
      return;
    }

    if (counts.smelter === 1 && Object.keys(counts).length === 1) {
      if (!this.removeItem("hammer", 1)) {
        this.showMessage("특수 재련대를 만들려면 망치가 필요합니다.");
        return;
      }
      this.clearCraftSlots(false);
      this.addItem("special_smelter", 1);
      this.showMessage("특수 재련대를 만들었습니다.");
      this.renderPanel();
      this.renderHud();
      return;
    }

    this.showMessage("맞는 미니 제작 레시피가 없습니다.");
  }

  private clearCraftSlots(returnItems = true) {
    for (const slot of this.craftSlots) {
      if (returnItems && slot.item) this.addItem(slot.item, slot.count);
      slot.item = null;
      slot.count = 0;
    }
    this.renderPanel();
    this.renderHud();
  }

  private craftWorkbenchRecipe(recipeId: string) {
    const recipe = WORKBENCH_RECIPES.find((item) => item.id === recipeId);
    if (!recipe || !this.canCraft(recipe)) return;

    for (const [item, count] of Object.entries(recipe.ingredients)) this.removeItem(item, count);
    if (recipe.output === "bag") {
      this.unlockBag();
    } else {
      this.addItem(recipe.output, recipe.count);
      this.autoEquip(recipe.output);
    }
    this.showMessage(`${recipe.name} 제작 완료.`);
    this.renderPanel();
    this.renderHud();
  }

  private smeltItem(item: ItemId) {
    const output = item === "obsidian" ? "sharp_obsidian" : REFINED_BY_RAW[item];
    if (!output || !this.removeItem(item, 1)) {
      this.showMessage("재련할 재료가 없습니다.");
      return;
    }
    this.addItem(output, 1);
    this.showMessage(`${ITEM_NAMES[item]}을 ${ITEM_NAMES[output]}으로 재련했습니다.`);
    this.renderPanel();
    this.renderHud();
  }

  private canCraft(recipe: Recipe) {
    return Object.entries(recipe.ingredients).every(([item, count]) => this.countItem(item) >= count);
  }

  private craftCounts() {
    const counts: Record<ItemId, number> = {};
    for (const slot of this.craftSlots) {
      if (!slot.item) continue;
      counts[slot.item] = (counts[slot.item] ?? 0) + slot.count;
    }
    return counts;
  }

  private addItem(item: ItemId, count: number) {
    if (item === "bag") {
      this.unlockBag();
      return true;
    }

    let remaining = count;
    for (const slot of this.allStorageSlots()) {
      if (slot.item === item) {
        slot.count += remaining;
        this.autoEquip(item);
        this.renderHud();
        return true;
      }
    }

    for (const slot of this.allStorageSlots()) {
      if (!slot.item) {
        slot.item = item;
        slot.count = remaining;
        this.autoEquip(item);
        this.renderHud();
        return true;
      }
    }

    this.showMessage(`${ITEM_NAMES[item] ?? item}을 넣을 공간이 없습니다.`);
    return false;
  }

  private removeItem(item: ItemId, count: number) {
    let remaining = count;
    for (const slot of this.allStorageSlots()) {
      if (slot.item !== item) continue;
      const taken = Math.min(slot.count, remaining);
      slot.count -= taken;
      remaining -= taken;
      if (slot.count <= 0) {
        slot.item = null;
        slot.count = 0;
      }
      if (remaining <= 0) {
        this.renderHud();
        return true;
      }
    }
    return false;
  }

  private countItem(item: ItemId) {
    return this.allStorageSlots()
      .filter((slot) => slot.item === item)
      .reduce((sum, slot) => sum + slot.count, 0);
  }

  private itemCounts() {
    const counts: Record<ItemId, number> = {};
    for (const slot of this.allStorageSlots()) {
      if (!slot.item) continue;
      counts[slot.item] = (counts[slot.item] ?? 0) + slot.count;
    }
    return counts;
  }

  private allStorageSlots() {
    return [...this.hotbar, ...this.bagSlots];
  }

  private unlockBag() {
    if (this.bagSlots.length === 0) {
      this.bagSlots.push(...Array.from({ length: 40 }, () => ({ item: null, count: 0 })));
      while (this.hotbar.length < 8) this.hotbar.push({ item: null, count: 0 });
      this.showMessage("가방을 만들었습니다. 핫바 8칸, 인벤토리 40칸이 열렸습니다.");
    } else {
      this.addItem("leather", 2);
      this.showMessage("이미 가방이 있어 보너스 가죽을 돌려받았습니다.");
    }
  }

  private autoEquip(item: ItemId) {
    if (!ARMOR_VALUE[item]) return;
    const current = this.equippedArmor ? ARMOR_VALUE[this.equippedArmor] ?? 0 : 0;
    if (ARMOR_VALUE[item] > current) this.equippedArmor = item;
  }

  private bestPower(table: Record<ItemId, number>) {
    return Object.keys(this.itemCounts()).reduce((best, item) => Math.max(best, table[item] ?? 0), 0);
  }

  private shortName(item: ItemId) {
    const name = ITEM_NAMES[item] ?? item;
    return name.length > 6 ? `${name.slice(0, 6)}` : name;
  }

  private showMessage(text: string) {
    this.messageEl.textContent = text;
    this.messageTimer = 4.2;
  }

  private spawnTree(type: "smallTree" | "bigTree", position: THREE.Vector3) {
    const group = new THREE.Group();
    const size = type === "bigTree" ? 1.7 : 1;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18 * size, 0.28 * size, 1.7 * size, 8),
      new THREE.MeshStandardMaterial({ color: 0x7b4a2d, roughness: 0.9 }),
    );
    trunk.position.y = 0.85 * size;
    const leaves = new THREE.Mesh(
      new THREE.ConeGeometry(1.0 * size, 2.0 * size, 9),
      new THREE.MeshStandardMaterial({ color: type === "bigTree" ? 0x1f6f42 : 0x2f8f4c, roughness: 0.85 }),
    );
    leaves.position.y = 2.15 * size;
    group.add(trunk, leaves);
    group.position.copy(position);
    this.addWorldObject(type, type === "bigTree" ? "큰 나무" : "작은 나무", group);
  }

  private spawnChest(position: THREE.Vector3, mineRich: boolean) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.8, 1),
      new THREE.MeshStandardMaterial({ color: mineRich ? 0x5a3e2c : 0x8b5a2b, roughness: 0.75 }),
    );
    base.position.y = 0.4;
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.12, 1.05),
      new THREE.MeshStandardMaterial({ color: 0xd6b35a, metalness: 0.3, roughness: 0.5 }),
    );
    band.position.y = 0.82;
    group.add(base, band);
    group.position.copy(position);
    this.addWorldObject(mineRich ? "mineChest" : "chest", mineRich ? "광산 상자" : "상자", group, { mineRich });
  }

  private spawnCave(position: THREE.Vector3) {
    const group = new THREE.Group();
    const entrance = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 3.4, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x25292e, roughness: 0.95 }),
    );
    entrance.position.y = 1.7;
    const leftRock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.4),
      new THREE.MeshStandardMaterial({ color: 0x5e6468, roughness: 1 }),
    );
    leftRock.position.set(-2.3, 0.8, 0.2);
    const rightRock = leftRock.clone();
    rightRock.position.set(2.2, 0.8, 0.3);
    group.add(entrance, leftRock, rightRock);
    group.position.copy(position);
    this.addWorldObject("cave", "동굴 입구", group, { caveReturn: position.clone().add(new THREE.Vector3(0, PLAYER_HEIGHT, 5)) });
  }

  private createCaveInterior() {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(110, 110),
      new THREE.MeshStandardMaterial({ color: 0x31363a, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.02, -850);
    const caveId = this.addWorldObject("caveExit", "동굴 출구", this.createExitPortal(new THREE.Vector3(0, 0, -775))).id;
    this.caveObjectIds.push(caveId);
    this.scene.add(floor);
    this.caveObjectIds.push(`loose-${floor.uuid}`);
    floor.userData.looseCaveMesh = true;

    for (let i = 0; i < 9; i += 1) this.spawnOre("stone", this.randomCavePoint());
    for (let i = 0; i < 5; i += 1) this.spawnOre("coal", this.randomCavePoint());
    if (Math.random() < 0.14) this.spawnOre("obsidian", this.randomCavePoint());
    if (Math.random() < 0.1) this.spawnMiner(this.randomCavePoint());

    if (Math.random() < 0.001) {
      for (let i = 0; i < 8; i += 1) this.spawnChest(this.randomCavePoint(), true);
      this.showMessage("엄청 드문 광산을 발견했습니다. 광산 상자가 많습니다!");
    }
  }

  private createExitPortal(position: THREE.Vector3) {
    const group = new THREE.Group();
    const portal = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 3.2, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x243a52, roughness: 0.6 }),
    );
    portal.position.y = 1.6;
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 2.4, 0.38),
      new THREE.MeshStandardMaterial({ color: 0x8fd7ff, emissive: 0x3e91c2, emissiveIntensity: 0.9 }),
    );
    glow.position.y = 1.55;
    group.add(portal, glow);
    group.position.copy(position);
    return group;
  }

  private spawnOre(ore: ItemId, position: THREE.Vector3) {
    const colorByOre: Record<ItemId, number> = {
      stone: 0x8a8f93,
      coal: 0x202225,
      copper: 0xb66f39,
      iron: 0xb8aca0,
      gold: 0xe3ba32,
      diamond: 0x66d9e8,
      obsidian: 0x24152f,
    };
    const mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.75),
      new THREE.MeshStandardMaterial({
        color: colorByOre[ore] ?? 0x888888,
        emissive: ore === "diamond" ? 0x144d55 : 0x000000,
        emissiveIntensity: ore === "diamond" ? 0.35 : 0,
        roughness: 0.9,
      }),
    );
    mesh.position.copy(position);
    mesh.position.y = 0.75;
    const object = this.addWorldObject("ore", ITEM_NAMES[ore] ?? ore, mesh, { ore });
    if (this.locationMode === "cave") this.caveObjectIds.push(object.id);
  }

  private spawnMiner(position: THREE.Vector3) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.2, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x5b6c77, roughness: 0.85 }),
    );
    body.position.y = 1;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.32),
      new THREE.MeshStandardMaterial({ color: 0xd3a06d, roughness: 0.8 }),
    );
    head.position.y = 1.85;
    const helmet = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.18, 0.55),
      new THREE.MeshStandardMaterial({ color: 0xd9b13b, roughness: 0.7 }),
    );
    helmet.position.y = 2.15;
    group.add(body, head, helmet);
    group.position.copy(position);
    const object = this.addWorldObject("miner", "광부", group);
    this.caveObjectIds.push(object.id);
  }

  private spawnAnimal(position: THREE.Vector3) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.8, 0.7),
      new THREE.MeshStandardMaterial({ color: Math.random() < 0.5 ? 0x8d6e55 : 0xd7d2c8, roughness: 0.9 }),
    );
    body.position.y = 0.72;
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.5, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xb89474, roughness: 0.9 }),
    );
    head.position.set(0.95, 0.92, 0);
    group.add(body, head);
    group.position.copy(position);
    this.addWorldObject("animal", Math.random() < 0.5 ? "소" : "말", group, { hp: 8 });
  }

  private spawnVillage(position: THREE.Vector3) {
    const storage = new THREE.Group();
    const hut = new THREE.Mesh(
      new THREE.BoxGeometry(5, 2.6, 4),
      new THREE.MeshStandardMaterial({ color: 0x9f7650, roughness: 0.8 }),
    );
    hut.position.y = 1.3;
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(3.8, 1.6, 4),
      new THREE.MeshStandardMaterial({ color: 0x7f3f2b, roughness: 0.85 }),
    );
    roof.position.y = 3.3;
    roof.rotation.y = Math.PI / 4;
    storage.add(hut, roof);
    storage.position.copy(position);
    this.addWorldObject("foodStorage", "마을 식량창고", storage);

    this.spawnKnight(position.clone().add(new THREE.Vector3(7, 0, 1)));
    this.spawnKnight(position.clone().add(new THREE.Vector3(-7, 0, -2)));
  }

  private spawnKnight(position: THREE.Vector3) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.4, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x8ea0ad, metalness: 0.3, roughness: 0.5 }),
    );
    body.position.y = 1.05;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.32),
      new THREE.MeshStandardMaterial({ color: 0xceb08c, roughness: 0.8 }),
    );
    head.position.y = 1.95;
    const shield = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.9, 0.65),
      new THREE.MeshStandardMaterial({ color: 0x3d5a80, roughness: 0.7 }),
    );
    shield.position.set(-0.6, 1.1, 0);
    group.add(body, head, shield);
    group.position.copy(position);
    this.addWorldObject("villageKnight", "마을기사", group, { hp: 10, armor: 5 });
  }

  private spawnWorkbench(position: THREE.Vector3, extended: boolean) {
    const group = new THREE.Group();
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, extended ? 1.1 : 0.9, 1.6),
      new THREE.MeshStandardMaterial({ color: extended ? 0x6d4c41 : 0x9a6a3a, roughness: 0.8 }),
    );
    table.position.y = extended ? 0.55 : 0.45;
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.12, 1.75),
      new THREE.MeshStandardMaterial({ color: 0xd1a35a, roughness: 0.65 }),
    );
    top.position.y = extended ? 1.16 : 0.96;
    group.add(table, top);
    group.position.copy(position);
    this.addWorldObject(extended ? "extendedWorkbench" : "workbench", extended ? "확장 제작대" : "제작대", group);
  }

  private spawnSmelter(position: THREE.Vector3, special: boolean) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.4, 1.5),
      new THREE.MeshStandardMaterial({ color: special ? 0x352246 : 0x555a5c, roughness: 0.8 }),
    );
    body.position.y = 0.7;
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.5, 0.1),
      new THREE.MeshStandardMaterial({
        color: special ? 0xb279ff : 0xff8a3d,
        emissive: special ? 0x6226aa : 0x9b3f14,
        emissiveIntensity: 1.1,
      }),
    );
    core.position.set(0, 0.75, 0.76);
    group.add(body, core);
    group.position.copy(position);
    this.addWorldObject(special ? "specialSmelter" : "smelter", special ? "특수 재련대" : "재련대", group);
  }

  private addWorldObject(type: ObjectType, name: string, root: THREE.Object3D, extra: Partial<WorldObject> = {}) {
    const id = `${type}-${crypto.randomUUID()}`;
    root.userData.objectId = id;
    root.traverse((child) => {
      child.userData.objectId = id;
      if (child instanceof THREE.Mesh) this.raycastTargets.push(child);
    });
    this.scene.add(root);
    const object: WorldObject = { id, type, name, root, ...extra };
    this.objects.set(id, object);
    return object;
  }

  private removeObject(id: string) {
    const object = this.objects.get(id);
    if (!object) return;
    this.scene.remove(object.root);
    this.objects.delete(id);
    for (let i = this.raycastTargets.length - 1; i >= 0; i -= 1) {
      if (this.findObjectId(this.raycastTargets[i]) === id) this.raycastTargets.splice(i, 1);
    }
  }

  private clearCaveObjects() {
    for (const id of this.caveObjectIds) {
      if (id.startsWith("loose-")) {
        const loose = this.scene.children.find((child) => `loose-${child.uuid}` === id);
        if (loose) this.scene.remove(loose);
      } else {
        this.removeObject(id);
      }
    }
    this.caveObjectIds = [];
  }

  private tintObject(root: THREE.Object3D, color: number) {
    root.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        child.material.color.set(color);
      }
    });
  }

  private randomGroundPoint() {
    return new THREE.Vector3(
      THREE.MathUtils.randFloatSpread(WORLD_SIZE - 80),
      0,
      THREE.MathUtils.randFloatSpread(WORLD_SIZE - 80),
    );
  }

  private pointNearPlayer(min: number, max: number) {
    const angle = Math.random() * Math.PI * 2;
    const radius = THREE.MathUtils.randFloat(min, max);
    return new THREE.Vector3(
      this.playerPosition.x + Math.cos(angle) * radius,
      0,
      this.playerPosition.z + Math.sin(angle) * radius,
    );
  }

  private pointInFront(distance: number) {
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    return new THREE.Vector3(
      this.playerPosition.x + forward.x * distance,
      0,
      this.playerPosition.z + forward.z * distance,
    );
  }

  private randomCavePoint() {
    return new THREE.Vector3(THREE.MathUtils.randFloatSpread(84), 0, -850 + THREE.MathUtils.randFloatSpread(84));
  }
}

const gameRoot = document.querySelector<HTMLDivElement>("#game");
if (!gameRoot) throw new Error("Game root element was not found.");

new WildernessGame(gameRoot);
