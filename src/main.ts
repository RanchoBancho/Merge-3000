import Phaser from 'phaser';
import './styles.css';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 720,
  height: 1280,
  backgroundColor: '#070a18',
  transparent: false,
  antialias: true,
  roundPixels: false,
  pixelArt: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 720,
    height: 1280,
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 0 },
      enableSleeping: false,
      positionIterations: 8,
      velocityIterations: 6,
      debug: false,
    },
  },
  scene: [BootScene, GameScene],
});

window.addEventListener('resize', () => game.scale.refresh());
