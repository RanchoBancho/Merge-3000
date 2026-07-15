import Phaser from 'phaser';
import {
  MERGE_LEVELS,
  textureKeyForLevel,
  type MergeLevel,
} from '../game/content';

const TEXTURE_SIZE = 256;
const CENTER = 128;
const BADGE_Y = 124;
const INK = 0x13152f;
const PAPER = 0xfff8e7;

type DrawingContext = CanvasRenderingContext2D;

function color(value: number, alpha = 1): string {
  const red = (value >> 16) & 0xff;
  const green = (value >> 8) & 0xff;
  const blue = value & 0xff;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function mix(first: number, second: number, amount: number): number {
  const t = Phaser.Math.Clamp(amount, 0, 1);
  const red = Phaser.Math.Linear((first >> 16) & 0xff, (second >> 16) & 0xff, t);
  const green = Phaser.Math.Linear((first >> 8) & 0xff, (second >> 8) & 0xff, t);
  const blue = Phaser.Math.Linear(first & 0xff, second & 0xff, t);
  return (Math.round(red) << 16) | (Math.round(green) << 8) | Math.round(blue);
}

function roundedRect(
  ctx: DrawingContext,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function setIconStyle(ctx: DrawingContext): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = color(INK);
  ctx.fillStyle = color(PAPER);
}

function fillAndStroke(ctx: DrawingContext): void {
  ctx.fill();
  ctx.stroke();
}

function drawFourPointStar(
  ctx: DrawingContext,
  x: number,
  y: number,
  outer: number,
  inner: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x, y - outer);
  ctx.quadraticCurveTo(x + inner, y - inner, x + outer, y);
  ctx.quadraticCurveTo(x + inner, y + inner, x, y + outer);
  ctx.quadraticCurveTo(x - inner, y + inner, x - outer, y);
  ctx.quadraticCurveTo(x - inner, y - inner, x, y - outer);
  ctx.closePath();
}

function drawCoin(ctx: DrawingContext, detail: number): void {
  setIconStyle(ctx);

  ctx.fillStyle = color(mix(PAPER, detail, 0.15));
  ctx.beginPath();
  ctx.ellipse(128, 128, 55, 55, 0, 0, Math.PI * 2);
  fillAndStroke(ctx);

  ctx.lineWidth = 6;
  ctx.strokeStyle = color(detail);
  ctx.beginPath();
  ctx.arc(128, 128, 41, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = color(INK);
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(145, 101);
  ctx.bezierCurveTo(137, 94, 112, 95, 110, 111);
  ctx.bezierCurveTo(108, 126, 146, 121, 146, 141);
  ctx.bezierCurveTo(145, 158, 118, 164, 106, 152);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(128, 91);
  ctx.lineTo(128, 166);
  ctx.stroke();

  ctx.fillStyle = color(PAPER);
  ctx.strokeStyle = color(INK);
  ctx.lineWidth = 5;
  drawFourPointStar(ctx, 173, 82, 13, 4);
  fillAndStroke(ctx);
}

function drawPhone(ctx: DrawingContext, detail: number): void {
  setIconStyle(ctx);
  roundedRect(ctx, 88, 55, 80, 143, 17);
  fillAndStroke(ctx);

  roundedRect(ctx, 99, 76, 58, 89, 7);
  ctx.fillStyle = color(mix(INK, detail, 0.3));
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.stroke();

  const screenGlow = ctx.createLinearGradient(100, 77, 156, 164);
  screenGlow.addColorStop(0, color(detail, 0.7));
  screenGlow.addColorStop(0.52, color(mix(detail, 0xffffff, 0.52), 0.42));
  screenGlow.addColorStop(0.53, color(0xffffff, 0.08));
  screenGlow.addColorStop(1, color(detail, 0.2));
  roundedRect(ctx, 105, 82, 46, 77, 4);
  ctx.fillStyle = screenGlow;
  ctx.fill();

  ctx.strokeStyle = color(INK);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(118, 67);
  ctx.lineTo(138, 67);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(128, 181, 6, 0, Math.PI * 2);
  ctx.fillStyle = color(detail);
  ctx.fill();
  ctx.stroke();
}

function drawToaster(ctx: DrawingContext, detail: number): void {
  setIconStyle(ctx);

  ctx.fillStyle = color(mix(PAPER, detail, 0.12));
  ctx.beginPath();
  ctx.moveTo(85, 101);
  ctx.lineTo(89, 72);
  ctx.quadraticCurveTo(90, 57, 103, 53);
  ctx.lineTo(111, 51);
  ctx.lineTo(111, 69);
  ctx.quadraticCurveTo(115, 61, 128, 61);
  ctx.quadraticCurveTo(141, 61, 145, 69);
  ctx.lineTo(145, 51);
  ctx.lineTo(153, 53);
  ctx.quadraticCurveTo(166, 57, 167, 72);
  ctx.lineTo(171, 101);
  ctx.closePath();
  fillAndStroke(ctx);

  ctx.fillStyle = color(PAPER);
  roundedRect(ctx, 65, 94, 126, 91, 24);
  fillAndStroke(ctx);

  const metal = ctx.createLinearGradient(74, 98, 182, 178);
  metal.addColorStop(0, color(0xffffff, 0.76));
  metal.addColorStop(0.45, color(detail, 0.28));
  metal.addColorStop(0.7, color(0xffffff, 0.86));
  metal.addColorStop(1, color(detail, 0.2));
  roundedRect(ctx, 76, 106, 104, 65, 16);
  ctx.fillStyle = metal;
  ctx.fill();

  ctx.strokeStyle = color(INK);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(89, 99);
  ctx.quadraticCurveTo(128, 89, 167, 99);
  ctx.stroke();

  ctx.fillStyle = color(detail);
  ctx.beginPath();
  ctx.arc(161, 147, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(191, 118);
  ctx.lineTo(205, 118);
  ctx.lineTo(205, 151);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(205, 157, 7, 0, Math.PI * 2);
  ctx.fillStyle = color(PAPER);
  fillAndStroke(ctx);
}

function drawTv(ctx: DrawingContext, detail: number): void {
  setIconStyle(ctx);

  ctx.strokeStyle = color(INK);
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(105, 66);
  ctx.lineTo(82, 41);
  ctx.moveTo(151, 66);
  ctx.lineTo(174, 41);
  ctx.stroke();
  ctx.fillStyle = color(detail);
  ctx.beginPath();
  ctx.arc(80, 39, 6, 0, Math.PI * 2);
  ctx.arc(176, 39, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color(PAPER);
  roundedRect(ctx, 54, 62, 148, 117, 25);
  fillAndStroke(ctx);

  const screen = ctx.createLinearGradient(70, 77, 168, 160);
  screen.addColorStop(0, color(mix(detail, 0xffffff, 0.25)));
  screen.addColorStop(0.55, color(detail));
  screen.addColorStop(1, color(mix(detail, INK, 0.48)));
  roundedRect(ctx, 69, 76, 100, 83, 16);
  ctx.fillStyle = screen;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.fillStyle = color(0xffffff, 0.24);
  ctx.beginPath();
  ctx.moveTo(84, 84);
  ctx.lineTo(125, 84);
  ctx.lineTo(83, 143);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = color(detail);
  ctx.beginPath();
  ctx.arc(185, 101, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(185, 132, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = color(INK);
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(91, 190);
  ctx.lineTo(105, 176);
  ctx.moveTo(165, 176);
  ctx.lineTo(179, 190);
  ctx.stroke();
}

function drawSofa(ctx: DrawingContext, detail: number): void {
  setIconStyle(ctx);

  ctx.fillStyle = color(mix(PAPER, detail, 0.18));
  roundedRect(ctx, 71, 77, 114, 91, 27);
  fillAndStroke(ctx);

  ctx.strokeStyle = color(INK);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(128, 88);
  ctx.lineTo(128, 132);
  ctx.stroke();

  ctx.fillStyle = color(PAPER);
  roundedRect(ctx, 56, 119, 42, 71, 18);
  fillAndStroke(ctx);
  roundedRect(ctx, 158, 119, 42, 71, 18);
  fillAndStroke(ctx);

  ctx.fillStyle = color(mix(PAPER, detail, 0.12));
  roundedRect(ctx, 87, 128, 82, 48, 14);
  fillAndStroke(ctx);

  ctx.fillStyle = color(detail);
  ctx.beginPath();
  ctx.arc(82, 148, 7, 0, Math.PI * 2);
  ctx.arc(174, 148, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = color(INK);
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(78, 187);
  ctx.lineTo(73, 197);
  ctx.moveTo(178, 187);
  ctx.lineTo(183, 197);
  ctx.stroke();
}

function drawCar(ctx: DrawingContext, detail: number): void {
  setIconStyle(ctx);

  ctx.fillStyle = color(mix(PAPER, detail, 0.13));
  ctx.beginPath();
  ctx.moveTo(57, 137);
  ctx.quadraticCurveTo(61, 119, 81, 114);
  ctx.lineTo(94, 83);
  ctx.quadraticCurveTo(99, 72, 113, 72);
  ctx.lineTo(148, 72);
  ctx.quadraticCurveTo(160, 73, 167, 84);
  ctx.lineTo(185, 113);
  ctx.quadraticCurveTo(203, 118, 207, 137);
  ctx.lineTo(207, 160);
  ctx.quadraticCurveTo(205, 172, 192, 174);
  ctx.lineTo(67, 174);
  ctx.quadraticCurveTo(52, 171, 52, 158);
  ctx.lineTo(52, 149);
  ctx.quadraticCurveTo(52, 141, 57, 137);
  ctx.closePath();
  fillAndStroke(ctx);

  ctx.fillStyle = color(mix(detail, INK, 0.28));
  ctx.beginPath();
  ctx.moveTo(103, 86);
  ctx.lineTo(124, 86);
  ctx.lineTo(124, 112);
  ctx.lineTo(90, 112);
  ctx.closePath();
  ctx.moveTo(134, 86);
  ctx.lineTo(148, 86);
  ctx.quadraticCurveTo(154, 87, 158, 94);
  ctx.lineTo(169, 112);
  ctx.lineTo(134, 112);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color(detail);
  roundedRect(ctx, 61, 132, 28, 11, 5);
  ctx.fill();
  roundedRect(ctx, 177, 132, 24, 11, 5);
  ctx.fill();

  ctx.fillStyle = color(INK);
  ctx.beginPath();
  ctx.arc(89, 174, 21, 0, Math.PI * 2);
  ctx.arc(174, 174, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color(PAPER);
  ctx.beginPath();
  ctx.arc(89, 174, 9, 0, Math.PI * 2);
  ctx.arc(174, 174, 9, 0, Math.PI * 2);
  ctx.fill();
}

function drawHouse(ctx: DrawingContext, detail: number): void {
  setIconStyle(ctx);

  ctx.fillStyle = color(PAPER);
  roundedRect(ctx, 76, 105, 104, 91, 9);
  fillAndStroke(ctx);

  ctx.fillStyle = color(mix(PAPER, detail, 0.17));
  ctx.beginPath();
  ctx.moveTo(57, 112);
  ctx.lineTo(122, 53);
  ctx.quadraticCurveTo(128, 48, 134, 53);
  ctx.lineTo(199, 112);
  ctx.lineTo(180, 127);
  ctx.lineTo(128, 81);
  ctx.lineTo(76, 127);
  ctx.closePath();
  fillAndStroke(ctx);

  ctx.fillStyle = color(detail);
  roundedRect(ctx, 91, 124, 29, 27, 5);
  ctx.fill();
  ctx.stroke();
  roundedRect(ctx, 139, 124, 29, 27, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color(mix(PAPER, detail, 0.22));
  roundedRect(ctx, 116, 155, 27, 41, 6);
  fillAndStroke(ctx);
  ctx.fillStyle = color(detail);
  ctx.beginPath();
  ctx.arc(135, 176, 3, 0, Math.PI * 2);
  ctx.fill();
}

function drawTower(ctx: DrawingContext, detail: number): void {
  setIconStyle(ctx);

  ctx.strokeStyle = color(INK);
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(128, 39);
  ctx.lineTo(128, 59);
  ctx.stroke();
  ctx.fillStyle = color(detail);
  ctx.beginPath();
  ctx.arc(128, 34, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color(PAPER);
  ctx.beginPath();
  ctx.moveTo(96, 62);
  ctx.lineTo(160, 62);
  ctx.lineTo(176, 202);
  ctx.lineTo(80, 202);
  ctx.closePath();
  fillAndStroke(ctx);

  const glass = mix(detail, INK, 0.14);
  ctx.fillStyle = color(glass);
  ctx.strokeStyle = color(INK);
  ctx.lineWidth = 4;
  const windows = [
    [102, 79], [132, 79],
    [99, 108], [132, 108],
    [96, 137], [132, 137],
    [93, 166], [132, 166],
  ];
  for (const [x, y] of windows) {
    roundedRect(ctx, x, y, 22, 17, 3);
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = color(detail);
  roundedRect(ctx, 113, 175, 30, 27, 5);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = color(INK);
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(70, 203);
  ctx.lineTo(186, 203);
  ctx.stroke();
}

function drawCity(ctx: DrawingContext, detail: number): void {
  setIconStyle(ctx);

  ctx.fillStyle = color(mix(PAPER, detail, 0.12));
  roundedRect(ctx, 56, 111, 47, 88, 7);
  fillAndStroke(ctx);
  roundedRect(ctx, 102, 70, 59, 129, 8);
  fillAndStroke(ctx);
  roundedRect(ctx, 159, 95, 43, 104, 7);
  fillAndStroke(ctx);

  ctx.strokeStyle = color(INK);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(131, 70);
  ctx.lineTo(131, 49);
  ctx.stroke();

  ctx.fillStyle = color(detail);
  ctx.strokeStyle = color(INK);
  ctx.lineWidth = 3;
  const windows = [
    [67, 126], [84, 126], [67, 149], [84, 149],
    [114, 88], [138, 88], [114, 113], [138, 113], [114, 138], [138, 138], [114, 163], [138, 163],
    [170, 111], [186, 111], [170, 136], [186, 136], [170, 161], [186, 161],
  ];
  for (const [x, y] of windows) {
    roundedRect(ctx, x, y, 9, 13, 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.strokeStyle = color(INK);
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(46, 201);
  ctx.lineTo(211, 201);
  ctx.stroke();
}

function drawMoon(ctx: DrawingContext, detail: number): void {
  setIconStyle(ctx);

  const moonGradient = ctx.createRadialGradient(106, 87, 5, 126, 125, 66);
  moonGradient.addColorStop(0, color(0xffffff));
  moonGradient.addColorStop(1, color(mix(PAPER, detail, 0.3)));
  ctx.fillStyle = moonGradient;
  ctx.beginPath();
  ctx.arc(127, 126, 62, 0, Math.PI * 2);
  fillAndStroke(ctx);

  ctx.fillStyle = color(mix(detail, 0x8d9ab9, 0.45), 0.72);
  ctx.strokeStyle = color(INK, 0.8);
  ctx.lineWidth = 4;
  const craters = [
    [103, 96, 12], [151, 111, 9], [112, 151, 15], [155, 157, 7], [83, 130, 7],
  ];
  for (const [x, y, radius] of craters) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = color(PAPER);
  ctx.strokeStyle = color(INK);
  ctx.lineWidth = 4;
  drawFourPointStar(ctx, 184, 70, 15, 4);
  fillAndStroke(ctx);
  drawFourPointStar(ctx, 188, 172, 9, 3);
  fillAndStroke(ctx);
}

function drawPlanet(ctx: DrawingContext, detail: number): void {
  setIconStyle(ctx);

  ctx.save();
  ctx.translate(128, 126);
  ctx.rotate(-0.26);
  ctx.strokeStyle = color(PAPER);
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.ellipse(0, 0, 91, 31, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = color(INK);
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.restore();

  const planetGradient = ctx.createRadialGradient(105, 92, 7, 130, 129, 64);
  planetGradient.addColorStop(0, color(mix(PAPER, detail, 0.12)));
  planetGradient.addColorStop(0.55, color(detail));
  planetGradient.addColorStop(1, color(mix(detail, INK, 0.4)));
  ctx.fillStyle = planetGradient;
  ctx.strokeStyle = color(INK);
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(128, 126, 55, 0, Math.PI * 2);
  fillAndStroke(ctx);

  ctx.save();
  ctx.beginPath();
  ctx.arc(128, 126, 51, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = color(PAPER, 0.55);
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(118, 111, 59, 0.12, 2.75);
  ctx.stroke();
  ctx.strokeStyle = color(INK, 0.35);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(139, 153, 54, 3.5, 6.2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(128, 126);
  ctx.rotate(-0.26);
  ctx.strokeStyle = color(PAPER);
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.ellipse(0, 0, 91, 31, 0, 0.05, Math.PI - 0.05);
  ctx.stroke();
  ctx.strokeStyle = color(INK);
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = color(PAPER);
  drawFourPointStar(ctx, 187, 67, 11, 3);
  ctx.fill();
}

function drawGalaxy(ctx: DrawingContext, detail: number): void {
  setIconStyle(ctx);

  ctx.strokeStyle = color(PAPER);
  ctx.lineWidth = 15;
  ctx.beginPath();
  ctx.moveTo(61, 125);
  ctx.bezierCurveTo(76, 63, 176, 53, 196, 105);
  ctx.bezierCurveTo(210, 143, 165, 181, 119, 180);
  ctx.stroke();

  ctx.strokeStyle = color(mix(PAPER, detail, 0.28));
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(73, 163);
  ctx.bezierCurveTo(46, 124, 77, 79, 121, 76);
  ctx.bezierCurveTo(170, 73, 188, 105, 174, 133);
  ctx.bezierCurveTo(160, 160, 111, 159, 94, 136);
  ctx.stroke();

  ctx.strokeStyle = color(detail);
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(104, 114);
  ctx.bezierCurveTo(119, 94, 156, 101, 153, 126);
  ctx.bezierCurveTo(150, 147, 115, 146, 105, 129);
  ctx.stroke();

  const core = ctx.createRadialGradient(128, 124, 1, 128, 124, 29);
  core.addColorStop(0, color(0xffffff));
  core.addColorStop(0.35, color(PAPER));
  core.addColorStop(1, color(detail, 0));
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(128, 124, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color(PAPER);
  ctx.beginPath();
  ctx.arc(128, 124, 9, 0, Math.PI * 2);
  ctx.fill();

  const stars = [
    [55, 73, 10], [197, 62, 7], [203, 170, 11], [73, 193, 7],
  ];
  ctx.fillStyle = color(PAPER);
  for (const [x, y, radius] of stars) {
    drawFourPointStar(ctx, x, y, radius, Math.max(2, radius * 0.28));
    ctx.fill();
  }
}

function drawIcon(ctx: DrawingContext, level: MergeLevel): void {
  const detail = mix(level.shell, level.accent, 0.48);
  ctx.save();
  ctx.shadowColor = color(0x030412, 0.38);
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 4;

  switch (level.key) {
    case 'coin':
      drawCoin(ctx, detail);
      break;
    case 'phone':
      drawPhone(ctx, detail);
      break;
    case 'toaster':
      drawToaster(ctx, detail);
      break;
    case 'tv':
      drawTv(ctx, detail);
      break;
    case 'sofa':
      drawSofa(ctx, detail);
      break;
    case 'car':
      drawCar(ctx, detail);
      break;
    case 'house':
      drawHouse(ctx, detail);
      break;
    case 'tower':
      drawTower(ctx, detail);
      break;
    case 'city':
      drawCity(ctx, detail);
      break;
    case 'moon':
      drawMoon(ctx, detail);
      break;
    case 'planet':
      drawPlanet(ctx, detail);
      break;
    case 'galaxy':
      drawGalaxy(ctx, detail);
      break;
    default:
      drawFourPointStar(ctx, CENTER, BADGE_Y, 54, 18);
      ctx.fillStyle = color(PAPER);
      fillAndStroke(ctx);
  }

  ctx.restore();
}

function drawBadge(ctx: DrawingContext, level: MergeLevel, index: number): void {
  ctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  const darkShell = mix(level.shell, 0x090b20, 0.58);
  const midShell = mix(level.shell, level.accent, 0.18);

  ctx.save();
  ctx.shadowColor = color(level.shell, 0.64);
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = color(darkShell);
  ctx.beginPath();
  ctx.arc(CENTER, BADGE_Y, 108, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const body = ctx.createRadialGradient(83, 61, 10, CENTER, BADGE_Y, 132);
  body.addColorStop(0, color(mix(level.accent, 0xffffff, 0.42)));
  body.addColorStop(0.32, color(level.accent));
  body.addColorStop(0.67, color(midShell));
  body.addColorStop(1, color(darkShell));
  ctx.fillStyle = body;
  ctx.strokeStyle = color(mix(darkShell, INK, 0.62));
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(CENTER, BADGE_Y, 107, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.arc(CENTER, BADGE_Y, 101.5, 0, Math.PI * 2);
  ctx.clip();

  const lowerShade = ctx.createLinearGradient(0, 48, 0, 229);
  lowerShade.addColorStop(0, color(0xffffff, 0.18));
  lowerShade.addColorStop(0.45, color(0xffffff, 0));
  lowerShade.addColorStop(1, color(INK, 0.44));
  ctx.fillStyle = lowerShade;
  ctx.fillRect(18, 17, 220, 218);

  ctx.fillStyle = color(0xffffff, 0.07);
  ctx.beginPath();
  ctx.ellipse(94, 67, 93, 39, -0.34, 0, Math.PI * 2);
  ctx.fill();

  const dots = [
    [56, 113, 5], [72, 174, 3], [193, 92, 4], [206, 143, 3],
    [177, 193, 5], [47, 145, 2], [153, 35, 3], [211, 118, 2],
  ];
  ctx.fillStyle = color(0xffffff, 0.12);
  for (const [x, y, radius] of dots) {
    ctx.beginPath();
    ctx.arc(x + (index % 3) * 2, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = color(level.accent, 0.23);
  ctx.lineWidth = 3;
  for (let ray = 0; ray < 12; ray += 1) {
    const angle = ray * (Math.PI / 6) + index * 0.07;
    ctx.beginPath();
    ctx.moveTo(CENTER + Math.cos(angle) * 88, BADGE_Y + Math.sin(angle) * 88);
    ctx.lineTo(CENTER + Math.cos(angle) * 96, BADGE_Y + Math.sin(angle) * 96);
    ctx.stroke();
  }

  ctx.restore();

  ctx.strokeStyle = color(0xffffff, 0.34);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(CENTER, BADGE_Y, 99, Math.PI * 1.08, Math.PI * 1.86);
  ctx.stroke();

  ctx.strokeStyle = color(darkShell, 0.72);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(CENTER, BADGE_Y, 99, Math.PI * 0.08, Math.PI * 0.87);
  ctx.stroke();

  const medallion = ctx.createRadialGradient(104, 91, 4, CENTER, BADGE_Y, 82);
  medallion.addColorStop(0, color(0xffffff, 0.14));
  medallion.addColorStop(1, color(INK, 0.1));
  ctx.fillStyle = medallion;
  ctx.strokeStyle = color(0xffffff, 0.14);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(CENTER, BADGE_Y, 76, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  drawIcon(ctx, level);

  ctx.save();
  ctx.translate(61, 60);
  ctx.rotate(-0.15);
  ctx.fillStyle = color(0xffffff, 0.9);
  ctx.shadowColor = color(0xffffff, 0.65);
  ctx.shadowBlur = 8;
  drawFourPointStar(ctx, 0, 0, 10, 2.5);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = color(mix(level.accent, 0xffffff, 0.35), 0.72);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(CENTER, BADGE_Y, 103, 0, Math.PI * 2);
  ctx.stroke();
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    MERGE_LEVELS.forEach((level, index) => {
      const key = textureKeyForLevel(index);
      if (this.textures.exists(key)) {
        this.textures.remove(key);
      }
      const texture = this.textures.createCanvas(key, TEXTURE_SIZE, TEXTURE_SIZE);
      if (!texture) {
        throw new Error(`Could not create canvas texture: ${key}`);
      }
      drawBadge(texture.getContext(), level, index);
      texture.refresh();
    });

    this.createParticleTextures();
    this.scene.start('GameScene');
  }

  private createParticleTextures(): void {
    this.replaceCanvasTexture('particle-dot', 32, 32, (ctx) => {
      const glow = ctx.createRadialGradient(16, 16, 1, 16, 16, 15);
      glow.addColorStop(0, color(0xffffff));
      glow.addColorStop(0.25, color(0xffffff, 0.95));
      glow.addColorStop(0.58, color(0xffffff, 0.45));
      glow.addColorStop(1, color(0xffffff, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 32, 32);
    });

    this.replaceCanvasTexture('particle-star', 40, 40, (ctx) => {
      const glow = ctx.createRadialGradient(20, 20, 1, 20, 20, 19);
      glow.addColorStop(0, color(0xffffff, 0.75));
      glow.addColorStop(0.38, color(0xffffff, 0.22));
      glow.addColorStop(1, color(0xffffff, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 40, 40);
      ctx.fillStyle = color(0xffffff);
      drawFourPointStar(ctx, 20, 20, 17, 3.2);
      ctx.fill();
    });

    this.replaceCanvasTexture('white-pixel', 2, 2, (ctx) => {
      ctx.fillStyle = color(0xffffff);
      ctx.fillRect(0, 0, 2, 2);
    });
  }

  private replaceCanvasTexture(
    key: string,
    width: number,
    height: number,
    draw: (ctx: DrawingContext) => void,
  ): void {
    if (this.textures.exists(key)) {
      this.textures.remove(key);
    }
    const texture = this.textures.createCanvas(key, width, height);
    if (!texture) {
      throw new Error(`Could not create canvas texture: ${key}`);
    }
    draw(texture.getContext());
    texture.refresh();
  }
}
