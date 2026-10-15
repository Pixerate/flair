import { describe, expect, it } from 'vitest';
import { ManualClock } from '../time/clock.js';
import {
  between,
  cameraFilter,
  cameraTransform,
  centreOf,
  motionBlur,
  projectPoint,
  viewAt,
  type Stage,
  type View,
} from './camera.js';
import { MemorySceneBoard, playScene } from './player.js';
import { standaloneSceneHtml } from './standalone.js';
import type { Scene } from './types.js';
import { validateScene } from './validate.js';

const stage: Stage = { width: 1920, height: 1080, caption: 0 };
const flat = viewAt(960, 540, 1, stage);

describe('3D camera', () => {
  it('interpolates angles, and leaves flat moves flat', () => {
    const tilted: View = { ...flat, tilt: 40, turn: -20 };
    expect(between(flat, tilted, 0.5, stage)).toMatchObject({ tilt: 20, turn: -10 });
    expect(Object.keys(between(flat, viewAt(500, 300, 2, stage), 0.5, stage)).sort()).toEqual(['scrollX', 'scrollY', 'zoom']);
    expect(between(tilted, flat, 1, stage).tilt).toBeUndefined();
  });

  it('writes the angle and blur as CSS', () => {
    expect(cameraTransform(flat, stage)).toBe('none');
    expect(cameraTransform({ ...flat, tilt: 30, roll: 5 }, stage, 960)).toBe('perspective(1152px) rotateX(30deg) rotateY(0deg) rotateZ(5deg)');
    expect(cameraTransform({ ...flat, tilt: 120 }, stage)).toContain('rotateX(75deg)');
    expect(cameraFilter({ ...flat, blur: 8 }, stage, 960)).toBe('blur(4px)');
    expect(cameraFilter(flat, stage)).toBe('none');
  });

  it('projects points as CSS draws them', () => {
    expect(projectPoint(flat, stage, [100, 200])).toEqual([100, 200]);
    const tilted: View = { ...flat, tilt: 40 };
    // The middle stays put; the top leans away (smaller, lower), the bottom comes nearer (bigger).
    const [mx, my] = projectPoint(tilted, stage, [960, 540])!;
    expect(mx).toBeCloseTo(960);
    expect(my).toBeCloseTo(540);
    const topLeft = projectPoint(tilted, stage, [0, 0])!;
    const bottomLeft = projectPoint(tilted, stage, [0, 1080])!;
    expect(topLeft[0]).toBeGreaterThan(0);
    expect(topLeft[1]).toBeGreaterThan(0);
    expect(bottomLeft[0]).toBeLessThan(0);
    // Turned, the left side comes nearer.
    const turned: View = { ...flat, turn: 30 };
    const left = projectPoint(turned, stage, [0, 0])!;
    const right = projectPoint(turned, stage, [1920, 0])!;
    expect(540 - left[1]).toBeGreaterThan(540 - right[1]);
  });

  it('blurs with the speed of a move', () => {
    const near = viewAt(1000, 540, 1, stage);
    const far = viewAt(1400, 540, 1, stage);
    expect(motionBlur(flat, far, stage, 0)).toBe(0);
    expect(motionBlur(flat, far, stage, 1)).toBeGreaterThan(motionBlur(flat, near, stage, 1));
    expect(motionBlur(flat, { ...flat, tilt: 30 }, stage, 1)).toBeGreaterThan(0);
    expect(motionBlur(flat, viewAt(5000, 540, 1, stage), stage, 3)).toBe(40);
  });

  const scene: Scene = {
    name: 'tilt',
    shots: [
      { camera: { x: 0, y: 0, width: 1920, height: 1080 }, hold: 100, run: [{ type: 'element', element: { id: 'card', type: 'rectangle', x: 600, y: 300, width: 400, height: 300 } }] },
      { camera: { frame: ['card'], tilt: 35, turn: -15, motionBlur: 1.5 }, hold: 100 },
      { camera: { x: 0, y: 0, width: 1920, height: 1080 }, hold: 100 },
      { camera: { tilt: 0, turn: 0 }, hold: 100 },
    ],
  };

  it('moves into a shot at its angle, blurring on the way and keeping the angle until changed', async () => {
    const clock = new ManualClock();
    const board = new MemorySceneBoard(stage);
    const views: View[] = [];
    const setView = board.setView.bind(board);
    board.setView = (v) => {
      views.push(v);
      setView(v);
    };
    const done = playScene(scene, board, clock);
    while (views.length < 46) await clock.advance(50);
    await clock.advance(5000);
    await done;
    const intoCard = views.slice(1, 16);
    expect(intoCard.some((v) => (v.blur ?? 0) > 5)).toBe(true);
    expect(intoCard.at(-1)).toMatchObject({ tilt: 35, turn: -15 });
    expect(intoCard.at(-1)!.blur).toBeUndefined();
    const [cx] = centreOf(intoCard.at(-1)!, stage);
    expect(cx).toBeCloseTo(800);
    // Angled, the framed card still fits the board.
    for (const corner of [[600, 300], [1000, 300], [600, 600], [1000, 600]] as const) {
      const [x, y] = projectPoint(intoCard.at(-1)!, stage, corner)!;
      expect(x).toBeGreaterThanOrEqual(-1);
      expect(x).toBeLessThanOrEqual(1921);
      expect(y).toBeGreaterThanOrEqual(-1);
      expect(y).toBeLessThanOrEqual(1081);
    }
    // Shot 3 reframes without saying an angle, so it keeps it (zoomed out to fit, with no blur); shot 4 flattens it in place.
    expect(views[30]).toMatchObject({ tilt: 35, turn: -15 });
    expect(views[30]!.zoom).toBeLessThan(1);
    expect(views.slice(16, 31).every((v) => v.blur === undefined)).toBe(true);
    expect(views.at(-1)!.tilt).toBeUndefined();
    expect(views.at(-1)!.zoom).toBeCloseTo(views[30]!.zoom);
  });

  it('checks angles and blur', () => {
    const bad: Scene = { name: 'bad', shots: [{ camera: { tilt: 90, perspective: 0.1, motionBlur: 9 } }] };
    expect(validateScene(bad).map((i) => i.message)).toEqual([
      'Camera tilt is degrees between -75 and 75.',
      'Camera perspective is the lens distance as a multiple of the stage width, 0.3 or more (1.2 by default).',
      'Camera motionBlur is 0 (none) to 3 (a whip); 1 is natural.',
    ]);
    expect(validateScene(scene)).toEqual([]);
  });

  it('plays the camera in the standalone player', () => {
    const html = standaloneSceneHtml(scene);
    const plan = JSON.parse(html.match(/const plan = (\{.*\});/)![1]!);
    expect(plan.shots).toHaveLength(4);
    expect(plan.shots[1].move).toHaveLength(15);
    expect(plan.shots[1].move.at(-1)).toMatchObject({ tilt: 35, turn: -15 });
    expect(plan.shots[1].elements.map((e: { id: string }) => e.id)).toEqual(['card']);
    expect(html).toContain("'perspective('");
  });
});
