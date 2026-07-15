export interface MergeLevel {
  key: string;
  label: string;
  radius: number;
  score: number;
  shell: number;
  accent: number;
}

export interface LaneStage {
  label: string;
  eyebrow: string;
  thresholdLevel: number;
  topColor: number;
  bottomColor: number;
  glowColor: number;
}

export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;
export const LANE = {
  centerX: GAME_WIDTH / 2,
  backY: 276,
  backLeft: 205,
  backRight: 515,
  frontY: 1110,
  frontLeft: 44,
  frontRight: 676,
  gateY: 1065,
  launchY: 1162,
  railThickness: 36,
} as const;

export const MERGE_LEVELS: MergeLevel[] = [
  { key: 'coin', label: 'Coin', radius: 22, score: 10, shell: 0xffc83d, accent: 0xfff1a6 },
  { key: 'phone', label: 'Phone', radius: 26, score: 25, shell: 0x5f6cff, accent: 0xb9c0ff },
  { key: 'toaster', label: 'Toaster', radius: 31, score: 60, shell: 0xff7a5c, accent: 0xffc1a8 },
  { key: 'tv', label: 'TV', radius: 37, score: 140, shell: 0x31d5c8, accent: 0xa6fff7 },
  { key: 'sofa', label: 'Sofa', radius: 44, score: 320, shell: 0xa66cff, accent: 0xe1c5ff },
  { key: 'car', label: 'Car', radius: 52, score: 720, shell: 0xff4f91, accent: 0xffb8d2 },
  { key: 'house', label: 'House', radius: 61, score: 1600, shell: 0x48d982, accent: 0xb7ffd1 },
  { key: 'tower', label: 'Tower', radius: 70, score: 3500, shell: 0x4aa8ff, accent: 0xb8dcff },
  { key: 'city', label: 'City', radius: 79, score: 7600, shell: 0xff9847, accent: 0xffd3a8 },
  { key: 'moon', label: 'Moon', radius: 88, score: 16500, shell: 0xc7d2e8, accent: 0xffffff },
  { key: 'planet', label: 'Planet', radius: 97, score: 36000, shell: 0x5c7cff, accent: 0x9ff5d0 },
  { key: 'galaxy', label: 'Galaxy', radius: 108, score: 80000, shell: 0x9a5cff, accent: 0xff8ad8 },
];

export const LANE_STAGES: LaneStage[] = [
  {
    label: 'WORKBENCH',
    eyebrow: 'PRESSURE ZONE 01',
    thresholdLevel: 0,
    topColor: 0x151335,
    bottomColor: 0x080a1b,
    glowColor: 0x6c5cff,
  },
  {
    label: 'ROOM',
    eyebrow: 'PRESSURE ZONE 02',
    thresholdLevel: 4,
    topColor: 0x172a46,
    bottomColor: 0x08121e,
    glowColor: 0x31d5c8,
  },
  {
    label: 'STREET',
    eyebrow: 'PRESSURE ZONE 03',
    thresholdLevel: 6,
    topColor: 0x352047,
    bottomColor: 0x100b1d,
    glowColor: 0xff4f91,
  },
  {
    label: 'CITY',
    eyebrow: 'PRESSURE ZONE 04',
    thresholdLevel: 8,
    topColor: 0x102f47,
    bottomColor: 0x07101d,
    glowColor: 0xff9847,
  },
  {
    label: 'ORBIT',
    eyebrow: 'PRESSURE ZONE 05',
    thresholdLevel: 9,
    topColor: 0x111737,
    bottomColor: 0x03050f,
    glowColor: 0xaab8ff,
  },
  {
    label: 'DEEP SPACE',
    eyebrow: 'PRESSURE ZONE 06',
    thresholdLevel: 10,
    topColor: 0x210d3e,
    bottomColor: 0x04030c,
    glowColor: 0x9a5cff,
  },
];

export function textureKeyForLevel(level: number): string {
  return `merge-${MERGE_LEVELS[level].key}`;
}
