import Phaser from "phaser";
import "./style.css";

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const PLAYER_SPEED = 245;
const GAME_SECONDS = 45;

type StarSprite = Phaser.Physics.Arcade.Sprite & { sparkle?: Phaser.GameObjects.Arc };

class StarGardenScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;
  private stars!: Phaser.Physics.Arcade.Group;
  private scoreText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private ideaText!: Phaser.GameObjects.Text;
  private score = 0;
  private secondsLeft = GAME_SECONDS;
  private targetPoint: Phaser.Math.Vector2 | null = null;
  private gameOver = false;

  constructor() {
    super("StarGardenScene");
  }

  preload() {
    this.createGeneratedTextures();
  }

  create() {
    this.score = 0;
    this.secondsLeft = GAME_SECONDS;
    this.gameOver = false;
    this.targetPoint = null;

    this.createWorld();
    this.createPlayer();
    this.createStars();
    this.createHud();
    this.createControls();

    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.gameOver) return;
        this.secondsLeft -= 1;
        this.timeText.setText(`시간 ${this.secondsLeft}`);
        if (this.secondsLeft <= 0) this.finishGame();
      },
    });
  }

  update() {
    if (this.gameOver) return;

    const velocity = new Phaser.Math.Vector2(0, 0);
    if (this.cursors.left.isDown || this.wasd.left.isDown) velocity.x -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) velocity.x += 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) velocity.y -= 1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) velocity.y += 1;

    if (velocity.lengthSq() > 0) {
      this.targetPoint = null;
      velocity.normalize().scale(PLAYER_SPEED);
      this.player.setVelocity(velocity.x, velocity.y);
    } else if (this.targetPoint) {
      this.physics.moveToObject(this.player, this.targetPoint, PLAYER_SPEED);
      if (Phaser.Math.Distance.BetweenPoints(this.player, this.targetPoint) < 8) {
        this.player.setVelocity(0, 0);
        this.targetPoint = null;
      }
    } else {
      this.player.setVelocity(0, 0);
    }
  }

  private createGeneratedTextures() {
    this.makeCircleTexture("player", 18, 0x3a86ff, 0xffffff);
    this.makeCircleTexture("star", 11, 0xffc857, 0xffffff);
    this.makeCircleTexture("seed", 6, 0x37b24d, 0xe8ffe6);
  }

  private makeCircleTexture(name: string, radius: number, fill: number, stroke: number) {
    const size = radius * 2 + 8;
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(fill, 1);
    graphics.fillCircle(size / 2, size / 2, radius);
    graphics.lineStyle(3, stroke, 0.92);
    graphics.strokeCircle(size / 2, size / 2, radius);
    graphics.generateTexture(name, size, size);
    graphics.destroy();
  }

  private createWorld() {
    this.cameras.main.setBackgroundColor("#cfeaff");

    const sky = this.add.graphics();
    sky.fillGradientStyle(0xa9dcff, 0xa9dcff, 0xf7efe3, 0xdaf5d7, 1);
    sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const hills = this.add.graphics();
    hills.fillStyle(0x69c779, 1);
    hills.fillEllipse(210, 510, 520, 180);
    hills.fillStyle(0x4fbf8f, 1);
    hills.fillEllipse(720, 520, 650, 210);
    hills.fillStyle(0xf6f0dd, 1);
    hills.fillRect(0, 420, GAME_WIDTH, 120);

    for (let i = 0; i < 52; i += 1) {
      const x = Phaser.Math.Between(30, GAME_WIDTH - 30);
      const y = Phaser.Math.Between(430, GAME_HEIGHT - 20);
      const seed = this.add.image(x, y, "seed");
      seed.setAlpha(Phaser.Math.FloatBetween(0.35, 0.75));
      seed.setScale(Phaser.Math.FloatBetween(0.65, 1.2));
    }
  }

  private createPlayer() {
    this.player = this.physics.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 60, "player");
    this.player.setCollideWorldBounds(true);
    this.player.setDamping(true);
    this.player.setDrag(900, 900);

    this.tweens.add({
      targets: this.player,
      scale: { from: 1, to: 1.08 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private createStars() {
    this.stars = this.physics.add.group();
    for (let i = 0; i < 10; i += 1) this.spawnStar();

    this.physics.add.overlap(
      this.player,
      this.stars,
      (_player, star) => this.collectStar(star as StarSprite),
      undefined,
      this,
    );
  }

  private createHud() {
    this.scoreText = this.add.text(24, 20, "별 0", {
      color: "#10202f",
      fontFamily: "Arial, sans-serif",
      fontSize: "26px",
      fontStyle: "700",
    });

    this.timeText = this.add.text(GAME_WIDTH - 24, 20, `시간 ${this.secondsLeft}`, {
      color: "#10202f",
      fontFamily: "Arial, sans-serif",
      fontSize: "26px",
      fontStyle: "700",
    });
    this.timeText.setOrigin(1, 0);

    this.ideaText = this.add.text(GAME_WIDTH / 2, 26, "별 정원", {
      align: "center",
      color: "#20354a",
      fontFamily: "Arial, sans-serif",
      fontSize: "28px",
      fontStyle: "700",
    });
    this.ideaText.setOrigin(0.5, 0);
  }

  private createControls() {
    if (!this.input.keyboard) throw new Error("Keyboard input is not available.");

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = {
      up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.targetPoint = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY);
    });
  }

  private spawnStar() {
    const x = Phaser.Math.Between(40, GAME_WIDTH - 40);
    const y = Phaser.Math.Between(90, GAME_HEIGHT - 50);
    const star = this.stars.create(x, y, "star") as StarSprite;
    star.setCircle(12);
    star.setBounce(1);
    star.setVelocity(Phaser.Math.Between(-55, 55), Phaser.Math.Between(-35, 35));
    star.setCollideWorldBounds(true);
    star.sparkle = this.add.circle(x, y, 22, 0xffffff, 0.22);

    this.tweens.add({
      targets: star.sparkle,
      scale: { from: 0.7, to: 1.25 },
      alpha: { from: 0.08, to: 0.35 },
      duration: Phaser.Math.Between(850, 1300),
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private collectStar(star: StarSprite) {
    this.score += 1;
    this.scoreText.setText(`별 ${this.score}`);

    if (star.sparkle) star.sparkle.destroy();
    star.destroy();
    this.spawnStar();

    if (this.score % 5 === 0) this.showIdeaTwist();
  }

  private showIdeaTwist() {
    const twists = [
      "규칙을 하나 바꿔볼까?",
      "새 친구를 추가해보자",
      "별에 특별한 힘을 넣자",
      "배경을 다른 행성으로!",
    ];
    this.ideaText.setText(Phaser.Utils.Array.GetRandom(twists));
    this.tweens.add({
      targets: this.ideaText,
      scale: { from: 1.15, to: 1 },
      duration: 420,
      ease: "Back.easeOut",
    });
  }

  private finishGame() {
    this.gameOver = true;
    this.player.setVelocity(0, 0);

    const panel = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 470, 190, 0xffffff, 0.92);
    panel.setStrokeStyle(2, 0x20354a, 0.25);

    const result = this.add.text(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2 - 34,
      `오늘 모은 별: ${this.score}`,
      {
        align: "center",
        color: "#10202f",
        fontFamily: "Arial, sans-serif",
        fontSize: "34px",
        fontStyle: "700",
      },
    );
    result.setOrigin(0.5);

    const restart = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 44, "다시 시작", {
      backgroundColor: "#3a86ff",
      color: "#ffffff",
      fixedWidth: 160,
      fixedHeight: 44,
      fontFamily: "Arial, sans-serif",
      fontSize: "22px",
      fontStyle: "700",
      padding: { top: 9 },
      align: "center",
    });
    restart.setOrigin(0.5);
    restart.setInteractive({ useHandCursor: true });
    restart.on("pointerdown", () => this.scene.restart());
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#cfeaff",
  physics: {
    default: "arcade",
    arcade: {
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [StarGardenScene],
};

new Phaser.Game(config);
