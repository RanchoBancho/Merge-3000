import Phaser from 'phaser';
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  LANE,
  LANE_STAGES,
  MERGE_LEVELS,
  textureKeyForLevel,
} from '../game/content';
import { SynthAudio } from '../game/SynthAudio';

interface FallingObject {
  sprite: Phaser.Physics.Matter.Sprite;
  level: number;
  bornAt: number;
  merging: boolean;
  gateArmed: boolean;
  gateEnteredAt: number | null;
}

interface ShotVector {
  valid: boolean;
  distance: number;
  directionX: number;
  directionY: number;
  velocityX: number;
  velocityY: number;
  power: number;
}

const BEST_SCORE_KEY = 'merge-3000.pressure-lane.best-score';
const LAUNCH_COOLDOWN_MS = 560;
const MIN_DRAG_DISTANCE = 44;
const MAX_DRAG_DISTANCE = 220;
const MIN_LAUNCH_SPEED = 14.5;
const MAX_LAUNCH_SPEED = 21.5;
const MAX_AIM_ANGLE = Phaser.Math.DegToRad(52);
const COMBO_WINDOW_MS = 1_550;
const GATE_ARM_DELAY_MS = 720;
const GATE_GRACE_MS = 1_050;
const GATE_HYSTERESIS = 22;
const MERGE_TEXTURE_SIZE = 256;
const VISUAL_DIAMETER_FACTOR = 2.25;
const PRESSURE_FORCE_MIN = 0.0000045;
const PRESSURE_FORCE_MAX = 0.000018;
const PRESSURE_SPEED_CAP = 2.8;
const SHOT_PRESSURE_PULSE = 0.05;
const MAX_SHOT_PRESSURE_SPEED = 3.2;
const SHOT_PRESSURE_HEAT = 0.065;
const PRESSURE_HEAT_DECAY_PER_SECOND = 0.022;
const MERGE_PRESSURE_COOLING = 0.026;
const PRESSURE_WALL_BASE_SPEED = 0.4;
const PRESSURE_WALL_MAX_SPEED = 20;
const PRESSURE_WALL_LOSS_GAP = 126;
const LANE_AREA = (
  ((LANE.backRight - LANE.backLeft) + (LANE.frontRight - LANE.frontLeft))
  * 0.5
  * (LANE.frontY - LANE.backY)
);

const textStyle = (
  size: number,
  color = '#ffffff',
  weight: '500' | '600' | '700' | '800' | '900' = '700',
): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: 'Inter, ui-rounded, system-ui, sans-serif',
  fontSize: `${size}px`,
  fontStyle: weight,
  color,
});

export class GameScene extends Phaser.Scene {
  private audio!: SynthAudio;
  private objects = new Map<Phaser.Physics.Matter.Sprite, FallingObject>();

  private background!: Phaser.GameObjects.Graphics;
  private ambient!: Phaser.GameObjects.Graphics;
  private laneGraphics!: Phaser.GameObjects.Graphics;
  private launcherGraphics!: Phaser.GameObjects.Graphics;
  private aimGraphics!: Phaser.GameObjects.Graphics;
  private dangerGraphics!: Phaser.GameObjects.Graphics;
  private pressureWallGraphics!: Phaser.GameObjects.Graphics;
  private pressureWallBody!: MatterJS.BodyType;

  private dangerMeter!: Phaser.GameObjects.Rectangle;
  private dangerLabel!: Phaser.GameObjects.Text;
  private pressureMeter!: Phaser.GameObjects.Rectangle;
  private pressureValueText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private stageEyebrowText!: Phaser.GameObjects.Text;
  private stageText!: Phaser.GameObjects.Text;
  private currentPreview!: Phaser.GameObjects.Image;
  private launchHintText!: Phaser.GameObjects.Text;
  private queueImages: Phaser.GameObjects.Image[] = [];
  private queueLabels: Phaser.GameObjects.Text[] = [];

  private score = 0;
  private bestScore = 0;
  private combo = 0;
  private comboExpiresAt = 0;
  private stageIndex = 0;
  private highestLevel = 0;
  private mergeCount = 0;
  private launchCount = 0;
  private singularityCount = 0;
  private pressureRatio = 0;
  private pressureHeat = 0;
  private pressureWallY = LANE.backY - 10;

  private currentLevel = 0;
  private nextLevels: number[] = [];
  private spawnBag: number[] = [];
  private launcherX = LANE.centerX;
  private launchReadyAt = 0;

  private activePointerId: number | null = null;
  private dragStart = new Phaser.Math.Vector2();
  private dragCurrent = new Phaser.Math.Vector2();
  private pressureForce = new Phaser.Math.Vector2();
  private isAiming = false;
  private isCelebrating = false;
  private isGameOver = false;

  private readonly handleCanvasPointerCancel = (): void => {
    this.cancelAim();
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.cancelAim();
    }
  };

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.resetRunState();
    this.matter.world.setGravity(0, 0);
    this.matter.world.resume();

    const storedAudio = this.registry.get('merge-3000.audio') as SynthAudio | undefined;
    this.audio = storedAudio ?? new SynthAudio();
    if (!storedAudio) {
      this.registry.set('merge-3000.audio', this.audio);
    }

    this.currentLevel = this.drawSpawnLevel();
    this.nextLevels = [this.drawSpawnLevel(), this.drawSpawnLevel(), this.drawSpawnLevel()];

    this.createBackdrop();
    this.createLane();
    this.createHud();
    this.createLauncher();
    this.createInstructions();
    this.refreshQueueVisuals();

    this.matter.world.on('collisionstart', this.handleCollisionStart, this);
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUp, this);
    this.input.on('gameout', this.handleGameOut, this);
    this.game.canvas.addEventListener('pointercancel', this.handleCanvasPointerCancel);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  update(time: number, delta: number): void {
    if (this.isGameOver) {
      return;
    }

    const waiting = time < this.launchReadyAt || this.isCelebrating;
    if (!this.isAiming) {
      this.currentPreview.y = LANE.launchY + Math.sin(time * 0.006) * 3;
      this.currentPreview.setAlpha(waiting ? 0.34 : 0.96);
      this.launchHintText.setAlpha(waiting ? 0.35 : 0.78);
    }

    if (this.combo > 0 && time > this.comboExpiresAt) {
      this.combo = 0;
      this.comboText.setAlpha(0);
    }

    for (const record of this.objects.values()) {
      record.sprite.setDepth(10 + record.sprite.y / 2_000 + record.level * 0.001);
    }

    if (!this.isCelebrating) {
      this.updatePressure(delta);
      this.updateDanger(time);
    }
  }

  private resetRunState(): void {
    this.objects.clear();
    this.queueImages = [];
    this.queueLabels = [];
    this.spawnBag = [];
    this.nextLevels = [];
    this.score = 0;
    this.bestScore = this.readBestScore();
    this.combo = 0;
    this.comboExpiresAt = 0;
    this.stageIndex = 0;
    this.highestLevel = 0;
    this.mergeCount = 0;
    this.launchCount = 0;
    this.singularityCount = 0;
    this.pressureRatio = 0;
    this.pressureHeat = 0;
    this.pressureWallY = LANE.backY - 10;
    this.currentLevel = 0;
    this.launcherX = LANE.centerX;
    this.launchReadyAt = 0;
    this.activePointerId = null;
    this.isAiming = false;
    this.isCelebrating = false;
    this.isGameOver = false;
  }

  private createBackdrop(): void {
    this.background = this.add.graphics().setDepth(-100);
    this.ambient = this.add.graphics().setDepth(-99);
    this.redrawBackdrop();
  }

  private redrawBackdrop(): void {
    const stage = LANE_STAGES[this.stageIndex];

    this.cameras.main.setBackgroundColor(stage.bottomColor);
    this.background.clear();
    this.background.fillGradientStyle(
      stage.topColor,
      stage.topColor,
      stage.bottomColor,
      stage.bottomColor,
      1,
    );
    this.background.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.ambient.clear();
    this.ambient.fillStyle(stage.glowColor, 0.13);
    this.ambient.fillCircle(GAME_WIDTH * 0.14, 150, 250);
    this.ambient.fillStyle(stage.glowColor, 0.09);
    this.ambient.fillCircle(GAME_WIDTH * 0.9, 760, 340);

    const speckCount = 20 + this.stageIndex * 7;
    for (let i = 0; i < speckCount; i += 1) {
      const x = (i * 137 + this.stageIndex * 43) % GAME_WIDTH;
      const y = 210 + ((i * 263 + this.stageIndex * 89) % (GAME_HEIGHT - 260));
      const radius = 1 + ((i * 7) % 3) * 0.5;
      this.ambient.fillStyle(i % 4 === 0 ? stage.glowColor : 0xffffff, 0.1 + (i % 3) * 0.05);
      this.ambient.fillCircle(x, y, radius);
    }
  }

  private createLane(): void {
    this.laneGraphics = this.add.graphics().setDepth(0);
    this.launcherGraphics = this.add.graphics().setDepth(2);
    this.dangerGraphics = this.add.graphics().setDepth(25);
    this.pressureWallGraphics = this.add.graphics().setDepth(24);
    this.redrawLane();

    const wallOptions: Phaser.Types.Physics.Matter.MatterBodyConfig = {
      isStatic: true,
      friction: 0.04,
      restitution: 0.42,
      label: 'lane-rail',
    };
    this.addRail(
      { x: LANE.backLeft, y: LANE.backY },
      { x: LANE.frontLeft, y: LANE.frontY + 42 },
      wallOptions,
    );
    this.addRail(
      { x: LANE.backRight, y: LANE.backY },
      { x: LANE.frontRight, y: LANE.frontY + 42 },
      wallOptions,
    );
    this.pressureWallBody = this.matter.add.rectangle(
      LANE.centerX,
      this.pressureWallY,
      GAME_WIDTH + 120,
      LANE.railThickness,
      {
        isStatic: true,
        friction: 0.16,
        restitution: 0.04,
        label: 'lane-backstop',
      },
    );
    this.drawPressureWall();

    const gateBounds = this.laneBoundsAt(LANE.gateY);
    this.matter.add.rectangle(
      LANE.centerX,
      LANE.gateY,
      gateBounds.right - gateBounds.left,
      18,
      {
        isStatic: true,
        isSensor: true,
        label: 'exit-gate',
      },
    );

    this.dangerMeter = this.add
      .rectangle(gateBounds.left + 7, LANE.gateY + 9, 0, 4, 0xff5277, 0.95)
      .setOrigin(0, 0.5)
      .setDepth(27);
    this.dangerLabel = this.add
      .text(gateBounds.right - 7, LANE.gateY - 17, 'EXIT GATE', {
        ...textStyle(12, '#ff7894', '800'),
        letterSpacing: 1.5,
      })
      .setOrigin(1, 1)
      .setAlpha(0.48)
      .setDepth(27);
  }

  private redrawLane(): void {
    const stage = LANE_STAGES[this.stageIndex];
    const corners = [
      new Phaser.Geom.Point(LANE.backLeft, LANE.backY),
      new Phaser.Geom.Point(LANE.backRight, LANE.backY),
      new Phaser.Geom.Point(LANE.frontRight, LANE.frontY),
      new Phaser.Geom.Point(LANE.frontLeft, LANE.frontY),
    ];

    this.laneGraphics.clear();
    this.laneGraphics.fillStyle(0x030511, 0.76);
    this.laneGraphics.fillPoints(corners, true);
    this.laneGraphics.lineStyle(26, stage.glowColor, 0.08);
    this.laneGraphics.lineBetween(LANE.backLeft, LANE.backY, LANE.frontLeft, LANE.frontY + 35);
    this.laneGraphics.lineBetween(LANE.backRight, LANE.backY, LANE.frontRight, LANE.frontY + 35);
    this.laneGraphics.lineStyle(5, stage.glowColor, 0.68);
    this.laneGraphics.lineBetween(LANE.backLeft, LANE.backY, LANE.frontLeft, LANE.frontY + 35);
    this.laneGraphics.lineBetween(LANE.backRight, LANE.backY, LANE.frontRight, LANE.frontY + 35);
    this.laneGraphics.lineStyle(7, 0xffffff, 0.2);
    this.laneGraphics.lineBetween(LANE.backLeft, LANE.backY, LANE.backRight, LANE.backY);

    this.laneGraphics.lineStyle(2, stage.glowColor, 0.11);
    for (let i = 1; i <= 7; i += 1) {
      const t = (i / 8) ** 1.55;
      const y = Phaser.Math.Linear(LANE.backY, LANE.frontY, t);
      const bounds = this.laneBoundsAt(y);
      this.laneGraphics.lineBetween(bounds.left + 4, y, bounds.right - 4, y);
    }
    for (let i = 1; i <= 5; i += 1) {
      const t = i / 6;
      this.laneGraphics.lineBetween(
        Phaser.Math.Linear(LANE.backLeft, LANE.backRight, t),
        LANE.backY,
        Phaser.Math.Linear(LANE.frontLeft, LANE.frontRight, t),
        LANE.frontY,
      );
    }

    this.laneGraphics.lineStyle(3, stage.glowColor, 0.17);
    for (let y = LANE.backY + 135; y < LANE.gateY - 90; y += 155) {
      const half = 13 + (y - LANE.backY) * 0.012;
      this.laneGraphics.lineBetween(LANE.centerX - half, y - 9, LANE.centerX, y + 7);
      this.laneGraphics.lineBetween(LANE.centerX, y + 7, LANE.centerX + half, y - 9);
    }

    this.redrawLauncher();
    this.drawPressureWall();
  }

  private drawPressureWall(): void {
    if (!this.pressureWallGraphics) {
      return;
    }
    const stage = LANE_STAGES[this.stageIndex];
    const y = Math.max(LANE.backY, this.pressureWallY + LANE.railThickness * 0.42);
    const bounds = this.laneBoundsAt(y);
    const pulse = 0.7 + Math.sin(this.time.now * 0.012) * 0.16;
    this.pressureWallGraphics.clear();
    this.pressureWallGraphics.lineStyle(18, stage.glowColor, 0.08 + this.pressureRatio * 0.12);
    this.pressureWallGraphics.lineBetween(bounds.left + 4, y, bounds.right - 4, y);
    this.pressureWallGraphics.lineStyle(5, stage.glowColor, 0.48 + this.pressureRatio * pulse * 0.42);
    this.pressureWallGraphics.lineBetween(bounds.left + 4, y, bounds.right - 4, y);
    this.pressureWallGraphics.lineStyle(2, 0xffffff, 0.24);
    this.pressureWallGraphics.lineBetween(bounds.left + 12, y - 5, bounds.right - 12, y - 5);
  }

  private redrawLauncher(): void {
    if (!this.launcherGraphics) {
      return;
    }
    const stage = LANE_STAGES[this.stageIndex];
    this.launcherGraphics.clear();
    this.launcherGraphics.fillStyle(0x050714, 0.82);
    this.launcherGraphics.fillRoundedRect(74, LANE.frontY + 19, 572, 103, 34);
    this.launcherGraphics.lineStyle(2, 0xffffff, 0.09);
    this.launcherGraphics.strokeRoundedRect(74, LANE.frontY + 19, 572, 103, 34);
    this.launcherGraphics.lineStyle(4, stage.glowColor, 0.48);
    this.launcherGraphics.lineBetween(111, LANE.launchY, 609, LANE.launchY);
    this.launcherGraphics.fillStyle(stage.glowColor, 0.16);
    this.launcherGraphics.fillCircle(this.launcherX, LANE.launchY, 42);
    this.launcherGraphics.lineStyle(3, stage.glowColor, 0.68);
    this.launcherGraphics.strokeCircle(this.launcherX, LANE.launchY, 42);
  }

  private addRail(
    start: { x: number; y: number },
    end: { x: number; y: number },
    options: Phaser.Types.Physics.Matter.MatterBodyConfig,
  ): void {
    const length = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y) + 28;
    const angle = Phaser.Math.Angle.Between(start.x, start.y, end.x, end.y);
    this.matter.add.rectangle(
      (start.x + end.x) / 2,
      (start.y + end.y) / 2,
      length,
      LANE.railThickness,
      { ...options, angle },
    );
  }

  private createHud(): void {
    this.add.text(34, 26, 'MERGE 3000', {
      ...textStyle(32, '#ffffff', '900'),
      letterSpacing: -1,
    }).setDepth(30);
    this.add.text(36, 65, 'PRESSURE LANE', {
      ...textStyle(12, '#aeb2d8', '800'),
      letterSpacing: 3.5,
    }).setDepth(30);

    this.add.rectangle(32, 101, 211, 91, 0x050714, 0.62)
      .setOrigin(0)
      .setStrokeStyle(2, 0xffffff, 0.08)
      .setDepth(29);
    this.add.text(48, 113, 'SCORE', {
      ...textStyle(11, '#8d92b8', '800'),
      letterSpacing: 2,
    }).setDepth(30);
    this.scoreText = this.add.text(47, 135, '0', textStyle(29, '#ffffff', '900')).setDepth(30);
    this.add.text(158, 115, 'BEST', {
      ...textStyle(10, '#8d92b8', '800'),
      letterSpacing: 1.4,
    }).setDepth(30);
    this.bestText = this.add
      .text(158, 139, this.formatScore(this.bestScore), textStyle(14, '#d6d8ee', '800'))
      .setDepth(30);

    this.add.rectangle(258, 101, 184, 91, 0x050714, 0.62)
      .setOrigin(0)
      .setStrokeStyle(2, 0xffffff, 0.08)
      .setDepth(29);
    this.stageEyebrowText = this.add.text(350, 113, LANE_STAGES[0].eyebrow, {
      ...textStyle(9, '#aaaed0', '800'),
      letterSpacing: 1.1,
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(30);
    this.stageText = this.add
      .text(350, 134, LANE_STAGES[0].label, textStyle(17, '#ffffff', '900'))
      .setOrigin(0.5, 0)
      .setDepth(30);
    this.add.text(275, 170, 'PRESSURE', {
      ...textStyle(8, '#8d92b8', '800'),
      letterSpacing: 1,
    }).setDepth(30);
    this.add.rectangle(331, 177, 77, 5, 0xffffff, 0.09).setOrigin(0, 0.5).setDepth(30);
    this.pressureMeter = this.add
      .rectangle(331, 177, 0, 5, 0x6c5cff, 0.95)
      .setOrigin(0, 0.5)
      .setDepth(31);
    this.pressureValueText = this.add
      .text(425, 169, '0%', textStyle(9, '#d9daf0', '800'))
      .setOrigin(1, 0)
      .setDepth(31);

    this.add.rectangle(457, 27, 231, 165, 0x050714, 0.66)
      .setOrigin(0)
      .setStrokeStyle(2, 0xffffff, 0.09)
      .setDepth(29);
    this.add.text(475, 41, 'NEXT 3', {
      ...textStyle(11, '#8d92b8', '800'),
      letterSpacing: 2,
    }).setDepth(30);
    for (let i = 0; i < 3; i += 1) {
      const x = 499 + i * 76;
      this.queueImages.push(this.add.image(x, 102, textureKeyForLevel(0)).setDepth(30));
      this.queueLabels.push(
        this.add
          .text(x, 153, 'COIN', {
            ...textStyle(8, '#d9daf0', '800'),
            letterSpacing: 0.5,
          })
          .setOrigin(0.5)
          .setDepth(30),
      );
    }

    this.comboText = this.add
      .text(GAME_WIDTH / 2, 234, '', {
        ...textStyle(24, '#fff0a7', '900'),
        stroke: '#6e3b12',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(55);
  }

  private createLauncher(): void {
    this.aimGraphics = this.add.graphics().setDepth(45);
    this.currentPreview = this.add
      .image(this.launcherX, LANE.launchY, textureKeyForLevel(this.currentLevel))
      .setDepth(35);
    this.launchHintText = this.add
      .text(LANE.centerX, 1241, 'DRAG UP  •  RELEASE TO SHOOT', {
        ...textStyle(12, '#d8daf3', '800'),
        letterSpacing: 1.4,
      })
      .setOrigin(0.5)
      .setDepth(35);
  }

  private createInstructions(): void {
    const panel = this.add
      .rectangle(GAME_WIDTH / 2, 493, 500, 116, 0x090b1d, 0.9)
      .setStrokeStyle(2, 0xffffff, 0.13)
      .setDepth(65);
    const title = this.add
      .text(GAME_WIDTH / 2, 466, 'DRAG UP  •  AIM  •  RELEASE', {
        ...textStyle(17, '#ffffff', '900'),
        letterSpacing: 1.1,
      })
      .setOrigin(0.5)
      .setDepth(66);
    const copy = this.add
      .text(
        GAME_WIDTH / 2,
        510,
        'Every shot drives the pressure wall. Merges blast it back.',
        textStyle(13, '#afb3d4', '600'),
      )
      .setOrigin(0.5)
      .setDepth(66);

    this.tweens.add({
      targets: [panel, title, copy],
      alpha: 0,
      delay: 5_200,
      duration: 700,
      ease: 'Sine.easeIn',
      onComplete: () => {
        panel.destroy();
        title.destroy();
        copy.destroy();
      },
    });
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    this.audio.unlock();
    if (
      this.isGameOver
      || this.isCelebrating
      || this.isAiming
      || this.time.now < this.launchReadyAt
      || pointer.worldY < LANE.gateY - 12
    ) {
      return;
    }

    const radius = MERGE_LEVELS[this.currentLevel].radius;
    this.launcherX = Phaser.Math.Clamp(
      pointer.worldX,
      LANE.frontLeft + radius + 22,
      LANE.frontRight - radius - 22,
    );
    this.activePointerId = pointer.id;
    this.dragStart.set(pointer.worldX, pointer.worldY);
    this.dragCurrent.copy(this.dragStart);
    this.isAiming = true;
    this.currentPreview.setPosition(this.launcherX, LANE.launchY).setAlpha(1).setScale(
      this.textureScaleForLevel(this.currentLevel) * 1.08,
    );
    this.launchHintText.setText('PULL TOWARD THE TARGET');
    this.redrawLauncher();
    this.drawAimGuide(this.calculateShotVector());
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isAiming || pointer.id !== this.activePointerId) {
      return;
    }
    this.dragCurrent.set(pointer.worldX, pointer.worldY);
    this.drawAimGuide(this.calculateShotVector());
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.isAiming || pointer.id !== this.activePointerId) {
      return;
    }
    this.dragCurrent.set(pointer.worldX, pointer.worldY);
    const shot = this.calculateShotVector();
    if (shot.valid) {
      this.launchCurrentObject(shot);
    } else {
      this.cancelAim();
    }
  }

  private handleGameOut(): void {
    this.cancelAim();
  }

  private calculateShotVector(): ShotVector {
    const dx = this.dragCurrent.x - this.dragStart.x;
    const dy = this.dragCurrent.y - this.dragStart.y;
    const distance = Math.hypot(dx, dy);
    const valid = distance >= MIN_DRAG_DISTANCE && dy <= -30;
    const angle = Phaser.Math.Clamp(
      Math.atan2(dx, -Math.min(-0.001, dy)),
      -MAX_AIM_ANGLE,
      MAX_AIM_ANGLE,
    );
    const power = Phaser.Math.Clamp(
      (distance - MIN_DRAG_DISTANCE) / (MAX_DRAG_DISTANCE - MIN_DRAG_DISTANCE),
      0,
      1,
    );
    const easedPower = Phaser.Math.Easing.Quadratic.Out(power);
    const speed = Phaser.Math.Linear(MIN_LAUNCH_SPEED, MAX_LAUNCH_SPEED, easedPower);
    const directionX = Math.sin(angle);
    const directionY = -Math.cos(angle);

    return {
      valid,
      distance,
      directionX,
      directionY,
      velocityX: directionX * speed,
      velocityY: directionY * speed,
      power,
    };
  }

  private drawAimGuide(shot: ShotVector): void {
    this.aimGraphics.clear();
    if (!this.isAiming) {
      return;
    }

    const stage = LANE_STAGES[this.stageIndex];
    const color = shot.valid ? stage.glowColor : 0xff5277;
    const guideLength = Phaser.Math.Clamp(shot.distance, 34, 210);
    this.aimGraphics.lineStyle(5, color, shot.valid ? 0.72 : 0.3);
    this.aimGraphics.lineBetween(
      this.launcherX,
      LANE.launchY,
      this.launcherX + shot.directionX * guideLength,
      LANE.launchY + shot.directionY * guideLength,
    );

    this.aimGraphics.fillStyle(color, shot.valid ? 0.9 : 0.38);
    for (let i = 1; i <= 8; i += 1) {
      const frames = i * 5;
      const x = this.launcherX + shot.velocityX * frames;
      const y = LANE.launchY + shot.velocityY * frames;
      if (y < LANE.backY - 30) {
        break;
      }
      this.aimGraphics.fillCircle(x, y, Math.max(2.5, 7 - i * 0.5));
    }

    const barX = 206;
    const barY = 1218;
    this.aimGraphics.fillStyle(0xffffff, 0.1);
    this.aimGraphics.fillRoundedRect(barX, barY, 308, 8, 4);
    this.aimGraphics.fillStyle(color, 0.9);
    this.aimGraphics.fillRoundedRect(barX, barY, 308 * shot.power, 8, 4);
  }

  private launchCurrentObject(shot: ShotVector): void {
    const previousObjects = [...this.objects.values()];
    const launchedLevel = this.currentLevel;
    const record = this.spawnObject(launchedLevel, this.launcherX, LANE.launchY, false);
    record.sprite.setVelocity(shot.velocityX, shot.velocityY);
    record.sprite.setAngularVelocity(Phaser.Math.FloatBetween(-0.045, 0.045));

    for (const other of previousObjects) {
      if (!other.gateArmed || other.merging) {
        continue;
      }
      const velocity = other.sprite.getVelocity();
      other.sprite.setAwake();
      other.sprite.setVelocity(
        velocity.x ?? 0,
        Math.min(MAX_SHOT_PRESSURE_SPEED, (velocity.y ?? 0) + SHOT_PRESSURE_PULSE),
      );
    }

    this.audio.drop();
    this.launchCount += 1;
    this.pressureHeat = Math.min(1, this.pressureHeat + SHOT_PRESSURE_HEAT);
    this.currentLevel = this.nextLevels.shift() ?? this.drawSpawnLevel();
    this.nextLevels.push(this.drawSpawnLevel());
    this.launchReadyAt = this.time.now + LAUNCH_COOLDOWN_MS;
    this.refreshQueueVisuals();
    this.cancelAim();
  }

  private cancelAim(): void {
    if (!this.isAiming && this.activePointerId === null) {
      return;
    }
    this.activePointerId = null;
    this.isAiming = false;
    this.aimGraphics?.clear();
    if (this.currentPreview?.active) {
      this.currentPreview
        .setPosition(this.launcherX, LANE.launchY)
        .setScale(this.textureScaleForLevel(this.currentLevel));
    }
    if (this.launchHintText?.active) {
      this.launchHintText.setText('DRAG UP  •  RELEASE TO SHOOT');
    }
    if (this.launcherGraphics?.active) {
      this.redrawLauncher();
    }
  }

  private drawSpawnLevel(): number {
    if (this.spawnBag.length === 0) {
      const floor = this.spawnFloor();
      this.spawnBag = [
        floor,
        floor,
        floor,
        floor,
        floor,
        floor,
        floor + 1,
        floor + 1,
        floor + 1,
        floor + 1,
        floor + 2,
        floor + 2,
      ].map((level) => Math.min(level, MERGE_LEVELS.length - 4));
      Phaser.Utils.Array.Shuffle(this.spawnBag);
    }
    return this.spawnBag.pop() ?? 0;
  }

  private spawnFloor(): number {
    if (this.highestLevel >= 8) {
      return 3;
    }
    if (this.highestLevel >= 6) {
      return 2;
    }
    if (this.highestLevel >= 4) {
      return 1;
    }
    return 0;
  }

  private refreshQueueVisuals(): void {
    this.currentPreview.setTexture(textureKeyForLevel(this.currentLevel));
    this.currentPreview.setScale(this.textureScaleForLevel(this.currentLevel));
    for (let i = 0; i < this.queueImages.length; i += 1) {
      const level = this.nextLevels[i] ?? 0;
      this.queueImages[i].setTexture(textureKeyForLevel(level)).setDisplaySize(48, 48);
      this.queueLabels[i].setText(MERGE_LEVELS[level].label.toUpperCase());
    }
    this.redrawLauncher();
  }

  private spawnObject(
    level: number,
    x: number,
    y: number,
    gateArmed: boolean,
  ): FallingObject {
    const safeX = this.clampObjectX(level, x, y);
    const sprite = this.matter.add.sprite(safeX, y, textureKeyForLevel(level));
    sprite.setCircle(MERGE_TEXTURE_SIZE / VISUAL_DIAMETER_FACTOR, {
      density: 0.0015,
      friction: 0.08,
      frictionAir: 0.014 + level * 0.001,
      frictionStatic: 0.02,
      restitution: 0.08,
      label: `merge-${level}`,
    });
    sprite.setScale(this.textureScaleForLevel(level));
    sprite.setBounce(0.08);
    sprite.setFriction(0.08, 0.014 + level * 0.001, 0.02);
    sprite.setSleepThreshold(Infinity);
    sprite.setDepth(10 + y / 2_000 + level * 0.001);

    const record: FallingObject = {
      sprite,
      level,
      bornAt: this.time.now,
      merging: false,
      gateArmed,
      gateEnteredAt: null,
    };
    this.objects.set(sprite, record);
    return record;
  }

  private clampObjectX(level: number, x: number, y: number): number {
    const bounds = this.laneBoundsAt(y);
    const radius = MERGE_LEVELS[level].radius;
    const left = bounds.left + radius + LANE.railThickness * 0.28;
    const right = bounds.right - radius - LANE.railThickness * 0.28;
    return left <= right ? Phaser.Math.Clamp(x, left, right) : LANE.centerX;
  }

  private laneBoundsAt(y: number): { left: number; right: number } {
    const progress = Phaser.Math.Clamp(
      (y - LANE.backY) / (LANE.frontY - LANE.backY),
      0,
      1,
    );
    return {
      left: Phaser.Math.Linear(LANE.backLeft, LANE.frontLeft, progress),
      right: Phaser.Math.Linear(LANE.backRight, LANE.frontRight, progress),
    };
  }

  private handleCollisionStart(event: Phaser.Physics.Matter.Events.CollisionStartEvent): void {
    if (this.isGameOver || this.isCelebrating) {
      return;
    }

    for (const pair of event.pairs) {
      const first = this.recordForBody(pair.bodyA);
      const second = this.recordForBody(pair.bodyB);
      if (
        !first
        || !second
        || first === second
        || first.level !== second.level
        || first.merging
        || second.merging
      ) {
        continue;
      }

      first.merging = true;
      second.merging = true;
      const x = (first.sprite.x + second.sprite.x) / 2;
      const y = (first.sprite.y + second.sprite.y) / 2;

      if (first.level >= MERGE_LEVELS.length - 1) {
        this.time.delayedCall(0, () => this.performSingularity(first, second, x, y));
        continue;
      }

      const velocityA = first.sprite.getVelocity();
      const velocityB = second.sprite.getVelocity();
      const velocityX = ((velocityA.x ?? 0) + (velocityB.x ?? 0)) / 2;
      const velocityY = ((velocityA.y ?? 0) + (velocityB.y ?? 0)) / 2;
      const gateArmed = first.gateArmed || second.gateArmed;
      this.time.delayedCall(0, () => {
        this.performMerge(first, second, x, y, velocityX, velocityY, gateArmed);
      });
    }
  }

  private recordForBody(body: MatterJS.BodyType): FallingObject | undefined {
    const gameObject = body.gameObject ?? body.parent?.gameObject;
    if (!gameObject) {
      return undefined;
    }
    return this.objects.get(gameObject as Phaser.Physics.Matter.Sprite);
  }

  private performMerge(
    first: FallingObject,
    second: FallingObject,
    x: number,
    y: number,
    velocityX: number,
    velocityY: number,
    gateArmed: boolean,
  ): void {
    if (
      this.isGameOver
      || !this.objects.has(first.sprite)
      || !this.objects.has(second.sprite)
    ) {
      return;
    }

    const newLevel = first.level + 1;
    this.removeObject(first);
    this.removeObject(second);

    const merged = this.spawnObject(newLevel, x, y, gateArmed);
    merged.sprite.setVelocity(velocityX * 0.28, Math.min(velocityY * 0.18, -1.85));
    merged.sprite.setAngularVelocity(Phaser.Math.FloatBetween(-0.03, 0.03));
    const mergedScale = this.textureScaleForLevel(newLevel);
    merged.sprite.setScale(mergedScale * 0.62);
    this.tweens.add({
      targets: merged.sprite,
      scaleX: mergedScale,
      scaleY: mergedScale,
      duration: 230,
      ease: 'Back.easeOut',
    });

    this.mergeCount += 1;
    this.pressureHeat = Math.max(
      0,
      this.pressureHeat - MERGE_PRESSURE_COOLING - newLevel * 0.002,
    );
    this.retreatPressureWall(3.5 + newLevel * 0.75 + Math.min(2, this.combo) * 0.3);
    this.registerScore(newLevel, x, y);
    this.audio.merge(newLevel);
    this.createMergeEffects(x, y, newLevel);
    this.applyMergeShockwave(x, y, newLevel, merged);
    this.checkZoneBreak(newLevel);
  }

  private performSingularity(
    first: FallingObject,
    second: FallingObject,
    x: number,
    y: number,
  ): void {
    if (
      this.isGameOver
      || !this.objects.has(first.sprite)
      || !this.objects.has(second.sprite)
    ) {
      return;
    }

    this.removeObject(first);
    this.removeObject(second);
    this.mergeCount += 1;
    this.singularityCount += 1;
    this.pressureHeat = 0;
    this.pressureWallY = LANE.backY - 10;
    this.highestLevel = MERGE_LEVELS.length - 1;
    this.stageIndex = LANE_STAGES.length - 1;
    this.registerScore(MERGE_LEVELS.length - 1, x, y);
    this.createMergeEffects(x, y, MERGE_LEVELS.length - 1);
    this.audio.scaleBreak(LANE_STAGES.length + this.singularityCount);
    this.cancelAim();
    this.isCelebrating = true;
    this.matter.world.pause();

    const remaining = [...this.objects.values()];
    const singularity = this.add
      .circle(x, y, 26, 0x010107, 1)
      .setStrokeStyle(7, 0xff8ad8, 0.95)
      .setDepth(105);
    const headline = this.add
      .text(GAME_WIDTH / 2, 530, 'SINGULARITY!', {
        ...textStyle(46, '#ffffff', '900'),
        stroke: '#28103f',
        strokeThickness: 9,
      })
      .setOrigin(0.5)
      .setDepth(110);
    const subline = this.add
      .text(GAME_WIDTH / 2, 586, 'BOARD CLEARED  •  PRESSURE BROKEN', {
        ...textStyle(13, '#ffd7f0', '800'),
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setDepth(110);

    this.cameras.main.flash(650, 190, 100, 255, false);
    this.cameras.main.shake(780, 0.014);
    this.tweens.add({
      targets: singularity,
      scaleX: 6,
      scaleY: 6,
      duration: 720,
      ease: 'Cubic.easeIn',
    });
    if (remaining.length > 0) {
      this.tweens.add({
        targets: remaining.map((record) => record.sprite),
        x,
        y,
        scaleX: 0,
        scaleY: 0,
        angle: '+=180',
        duration: 700,
        ease: 'Cubic.easeIn',
      });
    }
    this.tweens.add({
      targets: [headline, subline],
      alpha: 0,
      delay: 720,
      duration: 430,
    });

    this.time.delayedCall(760, () => {
      for (const record of remaining) {
        if (this.objects.has(record.sprite)) {
          this.removeObject(record);
        }
      }
      singularity.destroy();
      headline.destroy();
      subline.destroy();
      this.spawnBag = [];
      this.matter.body.setPosition(
        this.pressureWallBody,
        { x: LANE.centerX, y: this.pressureWallY },
        true,
      );
      this.redrawBackdrop();
      this.redrawLane();
      this.stageEyebrowText.setText(LANE_STAGES[this.stageIndex].eyebrow);
      this.stageText.setText(LANE_STAGES[this.stageIndex].label);
      this.launchReadyAt = this.time.now + 450;
      this.isCelebrating = false;
      if (!this.isGameOver) {
        this.matter.world.resume();
      }
    });
  }

  private removeObject(record: FallingObject): void {
    this.objects.delete(record.sprite);
    this.tweens.killTweensOf(record.sprite);
    record.sprite.destroy();
  }

  private updatePressure(delta: number): void {
    let occupiedArea = 0;
    for (const record of this.objects.values()) {
      const radius = MERGE_LEVELS[record.level].radius;
      occupiedArea += Math.PI * radius * radius;
    }
    const occupancyRatio = Phaser.Math.Clamp(occupiedArea / (LANE_AREA * 0.34), 0, 1);
    this.pressureHeat = Math.max(
      0,
      this.pressureHeat - PRESSURE_HEAT_DECAY_PER_SECOND * (delta / 1_000),
    );
    this.pressureRatio = Phaser.Math.Clamp(
      occupancyRatio * 0.75 + this.pressureHeat * 0.7,
      0,
      1,
    );
    const wallSpeed = Phaser.Math.Linear(
      PRESSURE_WALL_BASE_SPEED,
      PRESSURE_WALL_MAX_SPEED,
      this.pressureRatio ** 2,
    );
    this.pressureWallY += wallSpeed * (delta / 1_000);
    this.matter.body.setPosition(
      this.pressureWallBody,
      { x: LANE.centerX, y: this.pressureWallY },
      true,
    );
    this.drawPressureWall();
    if (this.pressureWallY >= LANE.gateY - PRESSURE_WALL_LOSS_GAP) {
      this.endGame();
      return;
    }
    const easedPressure = Phaser.Math.Easing.Sine.InOut(this.pressureRatio);
    const forcePerMass = Phaser.Math.Linear(PRESSURE_FORCE_MIN, PRESSURE_FORCE_MAX, easedPressure);
    const frameScale = Phaser.Math.Clamp(delta / (1_000 / 60), 0.55, 1.8);

    for (const record of this.objects.values()) {
      if (!record.gateArmed || record.merging) {
        continue;
      }
      const velocity = record.sprite.getVelocity();
      if ((velocity.y ?? 0) >= PRESSURE_SPEED_CAP) {
        continue;
      }
      const body = record.sprite.body as MatterJS.BodyType;
      record.sprite.setAwake();
      this.pressureForce.set(0, body.mass * forcePerMass * frameScale);
      record.sprite.applyForce(this.pressureForce);
    }

    const stage = LANE_STAGES[this.stageIndex];
    this.pressureMeter.width = 77 * this.pressureRatio;
    this.pressureMeter.setFillStyle(
      this.pressureRatio > 0.72 ? 0xff5277 : stage.glowColor,
      0.95,
    );
    this.pressureValueText.setText(`${Math.round(this.pressureRatio * 100)}%`);
  }

  private retreatPressureWall(distance: number): void {
    this.pressureWallY = Math.max(LANE.backY - 10, this.pressureWallY - distance);
    if (this.pressureWallBody) {
      this.matter.body.setPosition(
        this.pressureWallBody,
        { x: LANE.centerX, y: this.pressureWallY },
        true,
      );
    }
    this.drawPressureWall();
  }

  private updateDanger(time: number): void {
    let worstElapsed = 0;
    let immediateLoss = false;

    for (const record of this.objects.values()) {
      if (record.merging) {
        continue;
      }
      const radius = MERGE_LEVELS[record.level].radius;
      const velocity = record.sprite.getVelocity();
      const bottomEdge = record.sprite.y + radius;

      if (
        !record.gateArmed
        && (
          bottomEdge < LANE.gateY - 8
          || time - record.bornAt >= GATE_ARM_DELAY_MS
        )
      ) {
        record.gateArmed = true;
      }

      const inDanger = record.gateArmed
        && bottomEdge >= LANE.gateY
        && (velocity.y ?? 0) > -0.18;
      const clearlySafe = bottomEdge < LANE.gateY - GATE_HYSTERESIS
        || (velocity.y ?? 0) < -0.42;

      if (inDanger) {
        record.gateEnteredAt ??= time;
      } else if (clearlySafe) {
        record.gateEnteredAt = null;
      }

      if (record.gateEnteredAt !== null) {
        worstElapsed = Math.max(worstElapsed, time - record.gateEnteredAt);
      }
      if (record.gateArmed && record.sprite.y - radius > LANE.gateY + 24) {
        immediateLoss = true;
      }
    }

    const progress = Phaser.Math.Clamp(worstElapsed / GATE_GRACE_MS, 0, 1);
    const bounds = this.laneBoundsAt(LANE.gateY);
    const pulse = 0.65 + Math.sin(time * 0.016) * 0.25;
    this.dangerGraphics.clear();
    this.dangerGraphics.lineStyle(
      progress > 0.7 ? 6 : 4,
      progress > 0.7 ? 0xff315c : 0xff5277,
      progress > 0 ? 0.45 + progress * pulse : 0.24,
    );
    this.dangerGraphics.lineBetween(bounds.left + 5, LANE.gateY, bounds.right - 5, LANE.gateY);
    this.dangerMeter.width = (bounds.right - bounds.left - 14) * progress;
    this.dangerLabel.setAlpha(progress > 0 ? 0.62 + progress * 0.38 : 0.48);
    this.dangerLabel.setText(
      progress > 0
        ? `PUSH IT BACK  ${Math.max(0, (GATE_GRACE_MS - worstElapsed) / 1_000).toFixed(1)}s`
        : 'EXIT GATE',
    );

    if (immediateLoss || worstElapsed >= GATE_GRACE_MS) {
      this.endGame();
    }
  }

  private applyMergeShockwave(
    x: number,
    y: number,
    level: number,
    merged: FallingObject,
  ): void {
    const radius = Math.min(320, 155 + level * 15);
    const comboBoost = Math.min(1.35, 1 + Math.max(0, this.combo - 1) * 0.07);
    const baseStrength = (1.45 + level * 0.14) * comboBoost;

    for (const record of this.objects.values()) {
      if (record === merged || record.merging) {
        continue;
      }
      const dx = record.sprite.x - x;
      const dy = record.sprite.y - y;
      const distance = Math.hypot(dx, dy);
      if (distance <= 0.001 || distance >= radius) {
        continue;
      }
      const falloff = (1 - distance / radius) ** 2;
      const velocity = record.sprite.getVelocity();
      const lateral = (dx / distance) * baseStrength * 0.32 * falloff;
      const backward = baseStrength * (0.82 + Math.max(0, -dy / distance) * 0.18) * falloff;
      record.sprite.setAwake();
      record.sprite.setVelocity(
        Phaser.Math.Clamp((velocity.x ?? 0) + lateral, -12, 12),
        Phaser.Math.Clamp(Math.min(velocity.y ?? 0, 0.5) - backward, -10, 4),
      );
    }
  }

  private registerScore(level: number, x: number, y: number): void {
    const now = this.time.now;
    this.combo = now <= this.comboExpiresAt ? this.combo + 1 : 1;
    this.comboExpiresAt = now + COMBO_WINDOW_MS;

    const multiplier = Math.min(3, 1 + Math.max(0, this.combo - 1) * 0.25);
    const points = Math.round(MERGE_LEVELS[level].score * multiplier);
    this.score += points;

    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      this.writeBestScore(this.bestScore);
    }
    this.scoreText.setText(this.formatScore(this.score));
    this.bestText.setText(this.formatScore(this.bestScore));

    const scorePop = this.add
      .text(x, y - MERGE_LEVELS[level].radius - 10, `+${this.formatScore(points)}`, {
        ...textStyle(20, '#ffffff', '900'),
        stroke: '#121326',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(60);
    this.tweens.add({
      targets: scorePop,
      y: scorePop.y - 58,
      alpha: 0,
      duration: 800,
      ease: 'Cubic.easeOut',
      onComplete: () => scorePop.destroy(),
    });

    if (this.combo > 1) {
      this.comboText.setText(`${this.combo}× COMBO  •  ${multiplier.toFixed(2)}× SCORE`);
      this.comboText.setAlpha(1).setScale(0.72);
      this.tweens.add({
        targets: this.comboText,
        scaleX: 1,
        scaleY: 1,
        duration: 230,
        ease: 'Back.easeOut',
      });
    }
  }

  private createMergeEffects(x: number, y: number, level: number): void {
    const data = MERGE_LEVELS[level];
    const burstCount = 9 + Math.min(level, 7);
    for (let i = 0; i < burstCount; i += 1) {
      const angle = (Math.PI * 2 * i) / burstCount + Phaser.Math.FloatBetween(-0.2, 0.2);
      const distance = Phaser.Math.Between(45, 90) + level * 3;
      const mote = this.add
        .circle(x, y, Phaser.Math.Between(3, 7), i % 3 === 0 ? 0xffffff : data.accent, 0.95)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(52);
      this.tweens.add({
        targets: mote,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance - 24,
        scaleX: 0.15,
        scaleY: 0.15,
        alpha: 0,
        duration: Phaser.Math.Between(380, 620),
        ease: 'Cubic.easeOut',
        onComplete: () => mote.destroy(),
      });
    }

    const ring = this.add
      .ellipse(x, y, Math.max(28, data.radius * 0.95), Math.max(14, data.radius * 0.42), data.accent, 0)
      .setStrokeStyle(6, data.accent, 0.92)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(51);
    this.tweens.add({
      targets: ring,
      scaleX: 4.2,
      scaleY: 4.2,
      y: y - 34,
      alpha: 0,
      duration: 470,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });

    if (level >= MERGE_LEVELS.length - 1) {
      this.cameras.main.flash(650, 170, 110, 255, false);
      this.cameras.main.shake(650, 0.012);
    } else if (level >= 4) {
      this.cameras.main.shake(160, 0.003 + level * 0.00045);
    }
  }

  private checkZoneBreak(level: number): void {
    this.highestLevel = Math.max(this.highestLevel, level);
    const nextStageIndex = this.stageIndex + 1;
    if (
      this.isCelebrating
      || nextStageIndex >= LANE_STAGES.length
      || level < LANE_STAGES[nextStageIndex].thresholdLevel
    ) {
      return;
    }
    this.triggerZoneBreak(nextStageIndex);
  }

  private triggerZoneBreak(nextStageIndex: number): void {
    this.cancelAim();
    this.isCelebrating = true;
    this.matter.world.pause();
    this.stageIndex = nextStageIndex;

    const stage = LANE_STAGES[this.stageIndex];
    this.redrawBackdrop();
    this.redrawLane();
    this.stageEyebrowText.setText(stage.eyebrow);
    this.stageEyebrowText.setColor(Phaser.Display.Color.IntegerToColor(stage.glowColor).rgba);
    this.stageText.setText(stage.label);
    this.audio.scaleBreak(this.stageIndex);

    const veil = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, stage.glowColor, 0.34)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(100);
    const eyebrow = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 63, stage.eyebrow, {
        ...textStyle(15, '#ffffff', '900'),
        letterSpacing: 3.4,
      })
      .setOrigin(0.5)
      .setDepth(102);
    const headline = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 12, stage.label, {
        ...textStyle(48, '#ffffff', '900'),
        stroke: '#111128',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScale(0.65)
      .setDepth(102);
    const subline = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 43, 'NO ZOOM  •  MORE MASS  •  MORE PRESSURE', {
        ...textStyle(12, '#ffffff', '800'),
        letterSpacing: 1.8,
      })
      .setOrigin(0.5)
      .setDepth(102);

    this.cameras.main.flash(460, 255, 255, 255, false);
    this.cameras.main.shake(460, 0.009);
    this.tweens.add({
      targets: headline,
      scaleX: 1,
      scaleY: 1,
      duration: 360,
      ease: 'Back.easeOut',
    });
    this.tweens.add({
      targets: [veil, eyebrow, headline, subline],
      alpha: 0,
      delay: 540,
      duration: 390,
      ease: 'Sine.easeIn',
      onComplete: () => {
        veil.destroy();
        eyebrow.destroy();
        headline.destroy();
        subline.destroy();
        this.launchReadyAt = this.time.now + 260;
        this.isCelebrating = false;
        if (!this.isGameOver) {
          this.matter.world.resume();
        }
      },
    });
  }

  private endGame(): void {
    if (this.isGameOver) {
      return;
    }
    this.isGameOver = true;
    this.cancelAim();
    this.matter.world.pause();
    this.audio.gameOver();
    this.cameras.main.shake(520, 0.01);
    this.currentPreview.setVisible(false);
    this.launchHintText.setVisible(false);

    const stage = LANE_STAGES[this.stageIndex];
    const shade = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x03040c, 0.84)
      .setDepth(150);
    const panel = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 540, 500, 0x101329, 0.98)
      .setStrokeStyle(3, stage.glowColor, 0.72)
      .setDepth(151);
    const eyebrow = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 188, 'THE PILE BROKE THROUGH', {
        ...textStyle(14, '#aeb2d8', '800'),
        letterSpacing: 3,
      })
      .setOrigin(0.5)
      .setDepth(152);
    const headline = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 132, 'PRESSURE WON', textStyle(43, '#ffffff', '900'))
      .setOrigin(0.5)
      .setDepth(152);
    const result = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, this.formatScore(this.score), textStyle(44, '#fff0a7', '900'))
      .setOrigin(0.5)
      .setDepth(152);
    const resultLabel = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 18,
        `BEST  ${this.formatScore(this.bestScore)}  •  ${this.mergeCount} MERGES  •  ${this.launchCount} SHOTS`,
        {
          ...textStyle(13, '#aeb2d8', '800'),
          letterSpacing: 1,
        },
      )
      .setOrigin(0.5)
      .setDepth(152);

    const button = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 142, 340, 84, stage.glowColor, 1)
      .setStrokeStyle(2, 0xffffff, 0.45)
      .setInteractive({ useHandCursor: true })
      .setDepth(152);
    const buttonText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 142, 'PLAY AGAIN', {
        ...textStyle(20, '#ffffff', '900'),
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setDepth(153);

    button.on('pointerover', () => button.setScale(1.035));
    button.on('pointerout', () => button.setScale(1));
    button.on('pointerdown', () => {
      this.audio.unlock();
      this.audio.button();
      button.disableInteractive();
      this.cameras.main.fadeOut(180, 4, 5, 14);
      this.time.delayedCall(190, () => this.scene.restart());
    });

    this.tweens.add({
      targets: [shade, panel, eyebrow, headline, result, resultLabel, button, buttonText],
      alpha: { from: 0, to: 1 },
      duration: 320,
      ease: 'Sine.easeOut',
    });
    panel.setScale(0.88);
    this.tweens.add({
      targets: panel,
      scaleX: 1,
      scaleY: 1,
      duration: 360,
      ease: 'Back.easeOut',
    });
  }

  private formatScore(value: number): string {
    return Math.max(0, Math.floor(value)).toLocaleString('en-US');
  }

  private textureScaleForLevel(level: number): number {
    return (MERGE_LEVELS[level].radius * VISUAL_DIAMETER_FACTOR) / MERGE_TEXTURE_SIZE;
  }

  private readBestScore(): number {
    try {
      const value = Number.parseInt(localStorage.getItem(BEST_SCORE_KEY) ?? '0', 10);
      return Number.isFinite(value) ? Math.max(0, value) : 0;
    } catch {
      return 0;
    }
  }

  private writeBestScore(value: number): void {
    try {
      localStorage.setItem(BEST_SCORE_KEY, String(value));
    } catch {
      // Storage can be unavailable in embedded/private browser contexts.
    }
  }

  private handleShutdown(): void {
    this.matter?.world?.off('collisionstart', this.handleCollisionStart, this);
    this.input?.off('pointerdown', this.handlePointerDown, this);
    this.input?.off('pointermove', this.handlePointerMove, this);
    this.input?.off('pointerup', this.handlePointerUp, this);
    this.input?.off('pointerupoutside', this.handlePointerUp, this);
    this.input?.off('gameout', this.handleGameOut, this);
    this.game?.canvas?.removeEventListener('pointercancel', this.handleCanvasPointerCancel);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }
}
