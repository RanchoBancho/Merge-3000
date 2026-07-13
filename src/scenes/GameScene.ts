import Phaser from 'phaser';
import {
  CHAMBER,
  GAME_HEIGHT,
  GAME_WIDTH,
  MERGE_LEVELS,
  SCALE_STAGES,
  textureKeyForLevel,
} from '../game/content';
import { SynthAudio } from '../game/SynthAudio';

interface FallingObject {
  sprite: Phaser.Physics.Matter.Sprite;
  level: number;
  bornAt: number;
  merging: boolean;
}

const BEST_SCORE_KEY = 'merge-3000.best-score';
const DROP_COOLDOWN_MS = 330;
const COMBO_WINDOW_MS = 1_450;
const DANGER_GRACE_MS = 2_750;
const DANGER_BORN_IMMUNITY_MS = 1_350;
const MERGE_TEXTURE_SIZE = 256;
const VISUAL_DIAMETER_FACTOR = 2.25;

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
  private chamberFrame!: Phaser.GameObjects.Graphics;
  private dangerLine!: Phaser.GameObjects.Rectangle;
  private dangerMeter!: Phaser.GameObjects.Rectangle;
  private dangerLabel!: Phaser.GameObjects.Text;
  private aimLine!: Phaser.GameObjects.Rectangle;

  private scoreText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private stageEyebrowText!: Phaser.GameObjects.Text;
  private stageText!: Phaser.GameObjects.Text;
  private nextImage!: Phaser.GameObjects.Image;
  private nextNameText!: Phaser.GameObjects.Text;
  private dropPreview!: Phaser.GameObjects.Image;

  private score = 0;
  private bestScore = 0;
  private combo = 0;
  private comboExpiresAt = 0;
  private dangerElapsed = 0;
  private stageIndex = 0;
  private worldScale = 1;
  private currentLevel = 0;
  private nextLevel = 0;
  private dropX = GAME_WIDTH / 2;
  private dropReadyAt = 0;
  private scaleBreaking = false;
  private isGameOver = false;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.resetRunState();
    this.matter.world.resume();

    const storedAudio = this.registry.get('merge-3000.audio') as SynthAudio | undefined;
    this.audio = storedAudio ?? new SynthAudio();
    if (!storedAudio) {
      this.registry.set('merge-3000.audio', this.audio);
    }

    this.createBackdrop();
    this.createChamber();
    this.createHud();
    this.createDropPreview();
    this.createInstructions();

    this.currentLevel = this.rollDropLevel();
    this.nextLevel = this.rollDropLevel();
    this.refreshQueueVisuals();

    this.matter.world.on('collisionstart', this.handleCollisionStart, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.keyboard?.on('keydown-SPACE', this.handleKeyboardDrop, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
  }

  update(time: number, delta: number): void {
    if (this.isGameOver) {
      return;
    }

    this.dropPreview.y = CHAMBER.dropY + Math.sin(time * 0.005) * 3;
    this.aimLine.setPosition(this.dropX, (this.dropPreview.y + CHAMBER.top) / 2);
    this.aimLine.height = Math.max(8, CHAMBER.top - this.dropPreview.y);

    const waitingForDrop = time < this.dropReadyAt || this.scaleBreaking;
    this.dropPreview.setAlpha(waitingForDrop ? 0.25 : 0.9);
    this.aimLine.setAlpha(waitingForDrop ? 0.08 : 0.25);

    if (this.combo > 0 && time > this.comboExpiresAt) {
      this.combo = 0;
      this.comboText.setAlpha(0);
    }

    this.updateDanger(time, delta);
  }

  private resetRunState(): void {
    this.objects.clear();
    this.score = 0;
    this.bestScore = this.readBestScore();
    this.combo = 0;
    this.comboExpiresAt = 0;
    this.dangerElapsed = 0;
    this.stageIndex = 0;
    this.worldScale = 1;
    this.dropX = GAME_WIDTH / 2;
    this.dropReadyAt = 0;
    this.scaleBreaking = false;
    this.isGameOver = false;
  }

  private createBackdrop(): void {
    this.background = this.add.graphics().setDepth(-100);
    this.ambient = this.add.graphics().setDepth(-99);
    this.redrawBackdrop();
  }

  private redrawBackdrop(): void {
    const stage = SCALE_STAGES[this.stageIndex];

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
    this.ambient.fillStyle(stage.glowColor, 0.12);
    this.ambient.fillCircle(GAME_WIDTH * 0.16, 100, 260);
    this.ambient.fillStyle(stage.glowColor, 0.08);
    this.ambient.fillCircle(GAME_WIDTH * 0.92, 530, 310);

    const speckCount = 18 + this.stageIndex * 8;
    for (let i = 0; i < speckCount; i += 1) {
      const x = (i * 137 + this.stageIndex * 43) % GAME_WIDTH;
      const y = 170 + ((i * 263 + this.stageIndex * 89) % (GAME_HEIGHT - 220));
      const radius = 1 + ((i * 7) % 3) * 0.5;
      this.ambient.fillStyle(i % 4 === 0 ? stage.glowColor : 0xffffff, 0.1 + (i % 3) * 0.06);
      this.ambient.fillCircle(x, y, radius);
    }
  }

  private createChamber(): void {
    const width = CHAMBER.right - CHAMBER.left;
    const height = CHAMBER.bottom - CHAMBER.top;

    this.chamberFrame = this.add.graphics().setDepth(0);
    this.chamberFrame.fillStyle(0x030511, 0.48);
    this.chamberFrame.fillRoundedRect(CHAMBER.left - 15, CHAMBER.top - 14, width + 30, height + 26, 34);
    this.chamberFrame.lineStyle(3, 0xffffff, 0.1);
    this.chamberFrame.strokeRoundedRect(CHAMBER.left - 15, CHAMBER.top - 14, width + 30, height + 26, 34);
    this.chamberFrame.lineStyle(1, 0xffffff, 0.04);
    for (let y = CHAMBER.top + 60; y < CHAMBER.bottom; y += 90) {
      this.chamberFrame.lineBetween(CHAMBER.left + 2, y, CHAMBER.right - 2, y);
    }

    const wallOptions: Phaser.Types.Physics.Matter.MatterBodyConfig = {
      isStatic: true,
      friction: 0.18,
      restitution: 0.05,
      label: 'chamber-wall',
    };
    this.matter.add.rectangle(CHAMBER.left - 21, CHAMBER.top + height / 2, 42, height + 100, wallOptions);
    this.matter.add.rectangle(CHAMBER.right + 21, CHAMBER.top + height / 2, 42, height + 100, wallOptions);
    this.matter.add.rectangle(GAME_WIDTH / 2, CHAMBER.bottom + 21, width + 84, 42, wallOptions);

    this.dangerLine = this.add
      .rectangle(GAME_WIDTH / 2, CHAMBER.dangerY, width - 12, 3, 0xff5277, 0.25)
      .setDepth(25);
    this.dangerMeter = this.add
      .rectangle(CHAMBER.left + 6, CHAMBER.dangerY + 5, 0, 3, 0xff5277, 0.9)
      .setOrigin(0, 0.5)
      .setDepth(26);
    this.dangerLabel = this.add
      .text(CHAMBER.right - 8, CHAMBER.dangerY - 17, 'DANGER LINE', {
        ...textStyle(12, '#ff7894', '800'),
        letterSpacing: 1.5,
      })
      .setOrigin(1, 1)
      .setAlpha(0.45)
      .setDepth(26);
  }

  private createHud(): void {
    this.add.text(38, 28, 'MERGE 3000', {
      ...textStyle(34, '#ffffff', '900'),
      letterSpacing: -1,
    }).setDepth(30);
    this.add.text(40, 68, 'SCALE EATER', {
      ...textStyle(13, '#aeb2d8', '800'),
      letterSpacing: 4,
    }).setDepth(30);

    this.add.rectangle(38, 105, 218, 86, 0x050714, 0.55)
      .setOrigin(0)
      .setStrokeStyle(2, 0xffffff, 0.08)
      .setDepth(29);
    this.add.text(56, 118, 'SCORE', {
      ...textStyle(12, '#8d92b8', '800'),
      letterSpacing: 2,
    }).setDepth(30);
    this.scoreText = this.add.text(54, 139, '0', textStyle(31, '#ffffff', '900')).setDepth(30);
    this.add.text(172, 120, 'BEST', {
      ...textStyle(11, '#8d92b8', '800'),
      letterSpacing: 1.5,
    }).setDepth(30);
    this.bestText = this.add
      .text(172, 144, this.formatScore(this.bestScore), textStyle(16, '#d6d8ee', '800'))
      .setDepth(30);

    this.add.rectangle(279, 105, 216, 86, 0x050714, 0.55)
      .setOrigin(0)
      .setStrokeStyle(2, 0xffffff, 0.08)
      .setDepth(29);
    this.stageEyebrowText = this.add.text(387, 119, SCALE_STAGES[0].eyebrow, {
      ...textStyle(11, '#aaaed0', '800'),
      letterSpacing: 1.5,
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(30);
    this.stageText = this.add
      .text(387, 145, SCALE_STAGES[0].label, textStyle(23, '#ffffff', '900'))
      .setOrigin(0.5, 0)
      .setDepth(30);

    this.add.rectangle(518, 28, 166, 163, 0x050714, 0.62)
      .setOrigin(0)
      .setStrokeStyle(2, 0xffffff, 0.09)
      .setDepth(29);
    this.add.text(537, 42, 'NEXT', {
      ...textStyle(12, '#8d92b8', '800'),
      letterSpacing: 2,
    }).setDepth(30);
    this.nextImage = this.add.image(601, 104, textureKeyForLevel(0)).setDepth(30);
    this.nextNameText = this.add
      .text(601, 161, MERGE_LEVELS[0].label.toUpperCase(), {
        ...textStyle(11, '#d9daf0', '800'),
        letterSpacing: 1.2,
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.comboText = this.add
      .text(GAME_WIDTH / 2, 291, '', {
        ...textStyle(25, '#fff0a7', '900'),
        stroke: '#6e3b12',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setDepth(45);
  }

  private createDropPreview(): void {
    this.aimLine = this.add
      .rectangle(this.dropX, (CHAMBER.dropY + CHAMBER.top) / 2, 2, CHAMBER.top - CHAMBER.dropY, 0xffffff, 0.24)
      .setDepth(20);
    this.dropPreview = this.add
      .image(this.dropX, CHAMBER.dropY, textureKeyForLevel(0))
      .setAlpha(0.9)
      .setDepth(35);
  }

  private createInstructions(): void {
    const panel = this.add
      .rectangle(GAME_WIDTH / 2, 407, 430, 88, 0x090b1d, 0.78)
      .setStrokeStyle(2, 0xffffff, 0.12)
      .setDepth(40);
    const title = this.add
      .text(GAME_WIDTH / 2, 387, 'MOVE TO AIM  •  TAP TO DROP', {
        ...textStyle(15, '#ffffff', '900'),
        letterSpacing: 1.2,
      })
      .setOrigin(0.5)
      .setDepth(41);
    const copy = this.add
      .text(GAME_WIDTH / 2, 423, 'Merge two matching objects. Break the scale.', textStyle(14, '#afb3d4', '600'))
      .setOrigin(0.5)
      .setDepth(41);

    this.tweens.add({
      targets: [panel, title, copy],
      alpha: 0,
      delay: 4_200,
      duration: 700,
      ease: 'Sine.easeIn',
      onComplete: () => {
        panel.destroy();
        title.destroy();
        copy.destroy();
      },
    });
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.isGameOver) {
      return;
    }
    this.moveDropper(pointer.worldX);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    this.audio.unlock();
    if (this.isGameOver) {
      return;
    }
    this.moveDropper(pointer.worldX);
    this.tryDrop();
  }

  private handleKeyboardDrop(): void {
    this.audio.unlock();
    this.tryDrop();
  }

  private moveDropper(x: number): void {
    const radius = MERGE_LEVELS[this.currentLevel].radius * this.worldScale;
    this.dropX = Phaser.Math.Clamp(x, CHAMBER.left + radius + 5, CHAMBER.right - radius - 5);
    this.dropPreview.x = this.dropX;
    this.aimLine.x = this.dropX;
  }

  private tryDrop(): void {
    if (this.isGameOver || this.scaleBreaking || this.time.now < this.dropReadyAt) {
      return;
    }

    const droppedLevel = this.currentLevel;
    const record = this.spawnObject(droppedLevel, this.dropX, CHAMBER.dropY);
    record.sprite.setVelocity(Phaser.Math.FloatBetween(-0.12, 0.12), 0.25);
    record.sprite.setAngularVelocity(Phaser.Math.FloatBetween(-0.015, 0.015));
    this.audio.drop();

    this.currentLevel = this.nextLevel;
    this.nextLevel = this.rollDropLevel();
    this.dropReadyAt = this.time.now + DROP_COOLDOWN_MS;
    this.moveDropper(this.dropX);
    this.refreshQueueVisuals();
  }

  private rollDropLevel(): number {
    const roll = Math.random();
    if (roll < 0.58) {
      return 0;
    }
    if (roll < 0.88) {
      return 1;
    }
    return 2;
  }

  private refreshQueueVisuals(): void {
    this.dropPreview.setTexture(textureKeyForLevel(this.currentLevel));
    this.dropPreview.setScale(this.textureScaleForLevel(this.currentLevel) * this.worldScale);
    this.nextImage.setTexture(textureKeyForLevel(this.nextLevel));
    this.nextImage.setDisplaySize(66, 66);
    this.nextNameText.setText(MERGE_LEVELS[this.nextLevel].label.toUpperCase());
  }

  private spawnObject(level: number, x: number, y: number): FallingObject {
    const sprite = this.matter.add.sprite(x, y, textureKeyForLevel(level));
    sprite.setCircle(MERGE_TEXTURE_SIZE / VISUAL_DIAMETER_FACTOR, {
      density: 0.0017,
      friction: 0.11,
      frictionAir: 0.008,
      frictionStatic: 0.25,
      restitution: 0.08,
      label: `merge-${level}`,
    });
    sprite.setScale(this.textureScaleForLevel(level) * this.worldScale);
    sprite.setBounce(0.08);
    sprite.setFriction(0.11, 0.008, 0.25);
    sprite.setDepth(10 + level * 0.01);

    const record: FallingObject = {
      sprite,
      level,
      bornAt: this.time.now,
      merging: false,
    };
    this.objects.set(sprite, record);
    return record;
  }

  private handleCollisionStart(event: Phaser.Physics.Matter.Events.CollisionStartEvent): void {
    if (this.isGameOver || this.scaleBreaking) {
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
        || first.level >= MERGE_LEVELS.length - 1
        || first.merging
        || second.merging
      ) {
        continue;
      }

      first.merging = true;
      second.merging = true;

      const x = (first.sprite.x + second.sprite.x) / 2;
      const y = (first.sprite.y + second.sprite.y) / 2;
      const velocityA = first.sprite.getVelocity();
      const velocityB = second.sprite.getVelocity();
      const velocityX = ((velocityA.x ?? 0) + (velocityB.x ?? 0)) / 2;
      const velocityY = ((velocityA.y ?? 0) + (velocityB.y ?? 0)) / 2;

      this.time.delayedCall(0, () => {
        this.performMerge(first, second, x, y, velocityX, velocityY);
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

    const merged = this.spawnObject(newLevel, x, y);
    merged.sprite.setVelocity(velocityX * 0.35, Math.min(velocityY * 0.2, -1.7));
    merged.sprite.setAngularVelocity(Phaser.Math.FloatBetween(-0.025, 0.025));
    const mergedScale = this.textureScaleForLevel(newLevel) * this.worldScale;
    const nextStageIndex = this.stageIndex + 1;
    const causesScaleBreak = nextStageIndex < SCALE_STAGES.length
      && newLevel >= SCALE_STAGES[nextStageIndex].thresholdLevel;
    if (!causesScaleBreak) {
      merged.sprite.setScale(mergedScale * 0.62);
      this.tweens.add({
        targets: merged.sprite,
        scaleX: mergedScale,
        scaleY: mergedScale,
        duration: 230,
        ease: 'Back.easeOut',
      });
    }

    this.registerScore(newLevel, x, y);
    this.audio.merge(newLevel);
    this.createMergeEffects(x, y, newLevel);
    this.dangerElapsed = Math.max(0, this.dangerElapsed - 650);
    this.checkScaleBreak(newLevel);
  }

  private removeObject(record: FallingObject): void {
    this.objects.delete(record.sprite);
    // A freshly-created object can collide again while its merge "pop" tween
    // is still running. Stop that tween before Matter removes the body; Phaser
    // would otherwise try to scale a destroyed body on the following frame.
    this.tweens.killTweensOf(record.sprite);
    record.sprite.destroy();
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
      .text(x, y - MERGE_LEVELS[level].radius * this.worldScale - 10, `+${this.formatScore(points)}`, {
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
      this.comboText.setText(`${this.combo}× COMBO  •  ${multiplier.toFixed(2)}×`);
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
    const burstCount = 8 + Math.min(level, 6);
    for (let i = 0; i < burstCount; i += 1) {
      const angle = (Math.PI * 2 * i) / burstCount + Phaser.Math.FloatBetween(-0.2, 0.2);
      const distance = Phaser.Math.Between(38, 82) * Math.max(0.75, this.worldScale);
      const mote = this.add
        .circle(x, y, Phaser.Math.Between(3, 7), i % 3 === 0 ? 0xffffff : data.accent, 0.95)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(52);
      this.tweens.add({
        targets: mote,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        scaleX: 0.15,
        scaleY: 0.15,
        alpha: 0,
        duration: Phaser.Math.Between(380, 620),
        ease: 'Cubic.easeOut',
        onComplete: () => mote.destroy(),
      });
    }

    const ring = this.add
      .circle(x, y, Math.max(10, data.radius * this.worldScale * 0.45), data.accent, 0)
      .setStrokeStyle(6, data.accent, 0.9)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(51);
    this.tweens.add({
      targets: ring,
      scaleX: 2.5,
      scaleY: 2.5,
      alpha: 0,
      duration: 430,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });

    if (level >= MERGE_LEVELS.length - 1) {
      this.cameras.main.flash(650, 170, 110, 255, false);
      this.cameras.main.shake(650, 0.012);
    } else if (level >= 4) {
      this.cameras.main.shake(160, 0.003 + level * 0.0005);
    }
  }

  private checkScaleBreak(level: number): void {
    const nextStageIndex = this.stageIndex + 1;
    if (
      nextStageIndex >= SCALE_STAGES.length
      || level < SCALE_STAGES[nextStageIndex].thresholdLevel
    ) {
      return;
    }
    this.triggerScaleBreak(nextStageIndex);
  }

  private triggerScaleBreak(nextStageIndex: number): void {
    this.scaleBreaking = true;
    this.matter.world.pause();
    this.stageIndex = nextStageIndex;

    const stage = SCALE_STAGES[this.stageIndex];
    const previousScale = this.worldScale;
    const targetScale = previousScale * stage.shrinkFactor;
    const startingScales = new Map<Phaser.Physics.Matter.Sprite, number>();
    for (const { sprite } of this.objects.values()) {
      startingScales.set(sprite, sprite.scaleX);
    }
    this.worldScale = targetScale;

    this.redrawBackdrop();
    this.stageEyebrowText.setText(stage.eyebrow).setColor(Phaser.Display.Color.IntegerToColor(stage.glowColor).rgba);
    this.stageText.setText(stage.label);
    this.refreshQueueVisuals();
    this.audio.scaleBreak(this.stageIndex);

    const veil = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, stage.glowColor, 0.42)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(100);
    const eyebrow = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 70, stage.eyebrow, {
        ...textStyle(16, '#ffffff', '900'),
        letterSpacing: 4,
      })
      .setOrigin(0.5)
      .setDepth(102);
    const headline = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 18, stage.label, {
        ...textStyle(52, '#ffffff', '900'),
        stroke: '#111128',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScale(0.65)
      .setDepth(102);
    const subline = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 44, 'THE WORLD JUST GOT BIGGER', {
        ...textStyle(13, '#ffffff', '800'),
        letterSpacing: 2.5,
      })
      .setOrigin(0.5)
      .setDepth(102);

    this.cameras.main.flash(520, 255, 255, 255, false);
    this.cameras.main.shake(650, 0.012);
    this.cameras.main.zoomTo(0.91, 180, 'Sine.easeOut');
    this.time.delayedCall(190, () => this.cameras.main.zoomTo(1, 650, 'Back.easeOut'));

    const progress = { value: 0 };
    this.tweens.add({
      targets: progress,
      value: 1,
      duration: 540,
      ease: 'Cubic.easeInOut',
      onUpdate: () => {
        for (const [sprite, startScale] of startingScales) {
          if (sprite.active) {
            sprite.setScale(Phaser.Math.Linear(startScale, startScale * stage.shrinkFactor, progress.value));
          }
        }
      },
      onComplete: () => {
        for (const [sprite, startScale] of startingScales) {
          if (sprite.active) {
            sprite.setScale(startScale * stage.shrinkFactor);
          }
        }
      },
    });
    this.tweens.add({
      targets: headline,
      scaleX: 1,
      scaleY: 1,
      duration: 420,
      ease: 'Back.easeOut',
    });
    this.tweens.add({
      targets: [veil, eyebrow, headline, subline],
      alpha: 0,
      delay: 650,
      duration: 520,
      ease: 'Sine.easeIn',
      onComplete: () => {
        veil.destroy();
        eyebrow.destroy();
        headline.destroy();
        subline.destroy();
        this.dangerElapsed = 0;
        this.scaleBreaking = false;
        if (!this.isGameOver) {
          this.matter.world.resume();
        }
      },
    });
  }

  private updateDanger(time: number, delta: number): void {
    if (this.scaleBreaking) {
      return;
    }

    let hasDangerousSettledObject = false;
    for (const record of this.objects.values()) {
      if (record.merging || time - record.bornAt < DANGER_BORN_IMMUNITY_MS) {
        continue;
      }
      const velocity = record.sprite.getVelocity();
      const speed = Math.hypot(velocity.x ?? 0, velocity.y ?? 0);
      const radius = MERGE_LEVELS[record.level].radius * this.worldScale;
      if (record.sprite.y - radius < CHAMBER.dangerY && speed < 2.4) {
        hasDangerousSettledObject = true;
        break;
      }
    }

    if (hasDangerousSettledObject) {
      this.dangerElapsed = Math.min(DANGER_GRACE_MS, this.dangerElapsed + delta);
    } else {
      this.dangerElapsed = Math.max(0, this.dangerElapsed - delta * 1.75);
    }

    const progress = Phaser.Math.Clamp(this.dangerElapsed / DANGER_GRACE_MS, 0, 1);
    const pulse = 0.68 + Math.sin(time * 0.014) * 0.22;
    this.dangerLine.setAlpha(progress > 0 ? 0.35 + progress * pulse : 0.2);
    this.dangerLine.setFillStyle(progress > 0.72 ? 0xff315c : 0xff5277);
    this.dangerMeter.width = (CHAMBER.right - CHAMBER.left - 12) * progress;
    this.dangerLabel.setAlpha(progress > 0 ? 0.55 + progress * 0.45 : 0.38);
    this.dangerLabel.setText(
      progress > 0
        ? `TOO HIGH  ${(Math.max(0, DANGER_GRACE_MS - this.dangerElapsed) / 1000).toFixed(1)}s`
        : 'DANGER LINE',
    );

    if (this.dangerElapsed >= DANGER_GRACE_MS) {
      this.endGame();
    }
  }

  private endGame(): void {
    if (this.isGameOver) {
      return;
    }
    this.isGameOver = true;
    this.matter.world.pause();
    this.audio.gameOver();
    this.cameras.main.shake(520, 0.01);
    this.dropPreview.setVisible(false);
    this.aimLine.setVisible(false);

    const shade = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x03040c, 0.82)
      .setDepth(150);
    const panel = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 520, 470, 0x101329, 0.98)
      .setStrokeStyle(3, SCALE_STAGES[this.stageIndex].glowColor, 0.72)
      .setDepth(151);
    const eyebrow = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 172, 'THE SCALE COLLAPSED', {
        ...textStyle(14, '#aeb2d8', '800'),
        letterSpacing: 3,
      })
      .setOrigin(0.5)
      .setDepth(152);
    const headline = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 116, 'RUN OVER', textStyle(48, '#ffffff', '900'))
      .setOrigin(0.5)
      .setDepth(152);
    const result = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 25, this.formatScore(this.score), textStyle(44, '#fff0a7', '900'))
      .setOrigin(0.5)
      .setDepth(152);
    const resultLabel = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, `BEST  ${this.formatScore(this.bestScore)}  •  ${SCALE_STAGES[this.stageIndex].label}`, {
        ...textStyle(14, '#aeb2d8', '800'),
        letterSpacing: 1.4,
      })
      .setOrigin(0.5)
      .setDepth(152);

    const button = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 126, 330, 82, SCALE_STAGES[this.stageIndex].glowColor, 1)
      .setStrokeStyle(2, 0xffffff, 0.45)
      .setInteractive({ useHandCursor: true })
      .setDepth(152);
    const buttonText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 126, 'PLAY AGAIN', {
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
    this.matter.world.off('collisionstart', this.handleCollisionStart, this);
    this.input.off('pointermove', this.handlePointerMove, this);
    this.input.off('pointerdown', this.handlePointerDown, this);
    this.input.keyboard?.off('keydown-SPACE', this.handleKeyboardDrop, this);
  }
}
