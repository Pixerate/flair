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

const scene: Scene = {
  name: 'tilt',
  shots: [
    { camera: { x: 0, y: 0, width: 1920, height: 1080 }, hold: 100, run: [{ type: 'element', element: { id: 'card', type: 'rectangle', x: 600, y: 300, width: 400, height: 300 } }] },
    { camera: { frame: ['card'], tilt: 35, turn: -15, in: { move: 'camera-glide', values: { motionBlur: 1.5 } } }, hold: 100 },
    { camera: { x: 0, y: 0, width: 1920, height: 1080 }, hold: 100 },
    { camera: { tilt: 0, turn: 0 }, hold: 100 },
  ],
};

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
    const bad: Scene = { name: 'bad', shots: [{ x: 1 } as never, { camera: { tilt: 90, perspective: 0.1, in: { move: 'camera-glide', values: { motionBlur: 9 } } } }] };
    expect(validateScene(bad).filter((i) => i.shot === 2).map((i) => i.message)).toEqual([
      'Camera tilt is degrees between -75 and 75.',
      'Camera perspective is the lens distance as a multiple of the stage width, 0.3 or more (1.2 by default).',
      '"camera-glide": motionBlur takes a number from 0 to 3, not 9.',
    ]);
    expect(validateScene(scene)).toEqual([]);
  });

  it('plays the camera in the standalone player', async () => {
    const html = await standaloneSceneHtml(scene);
    const plan = JSON.parse(html.match(/<script type="application\/json" id="flair-scene-plan">(.*?)<\/script>/s)![1]!);
    expect(plan.shots).toHaveLength(4);
    const settled = plan.camera.filter((k: { ms: number }) => k.ms <= plan.shots[1].startMs + plan.shots[1].moveMs).at(-1);
    expect(settled.view).toMatchObject({ tilt: 35, turn: -15 });
    expect(plan.elements.map((e: { id: string }) => e.id)).toEqual(['card']);
  });
});

describe('angled checks and directional blur', () => {
  it('judges framing and text size on screen, where the angle puts things', async () => {
    const { checkShot } = await import('./check.js');
    const card = { id: 'card', type: 'rectangle', x: 760, y: 440, width: 400, height: 200, text: 'Hi', fontSize: 30 };
    const shot = { run: [{ type: 'element' as const, element: card }] };
    const flatView = viewAt(960, 540, 1, stage);
    expect(checkShot(shot, [card], flatView, stage).framing).toEqual([]);
    expect(checkShot(shot, [card], flatView, stage).smallestText?.px).toBe(30);
    // Zoomed in on the card flat, it fits; tilted hard, its near edge swells off the board.
    const close = viewAt(960, 540, 4.5, stage);
    expect(checkShot(shot, [card], close, stage).framing).toEqual([]);
    expect(checkShot(shot, [card], { ...close, tilt: 60 }, stage).framing).toEqual([{ id: 'card', how: 'cut' }]);
    // Leaning back shrinks text at the top of the board.
    const top = { ...card, y: 0 };
    expect(checkShot(shot, [top], { ...flatView, tilt: 50 }, stage).smallestText!.px).toBeLessThan(30);
  });

  it('streaks a pan along its direction, and blurs zooms every way', async () => {
    const { cameraBlur, moveBlur } = await import('./camera.js');
    const pan = moveBlur(flat, viewAt(1100, 540, 1, stage), stage, 1);
    expect(pan.blurAngle).toBe(0);
    const [sx, sy] = cameraBlur({ ...flat, ...pan }, stage);
    expect(sx).toBeGreaterThan(sy * 5);
    const down = moveBlur(flat, viewAt(960, 700, 1, stage), stage, 1);
    expect(down.blurAngle).toBe(90);
    const zoom = moveBlur(flat, viewAt(960, 540, 2, stage), stage, 1);
    expect(zoom.blurAngle).toBeUndefined();
    const [zx, zy] = cameraBlur({ ...flat, ...zoom }, stage);
    expect(zx).toBe(zy);
    // Rolled 90°, a horizontal streak runs along the board's own y axis.
    const [rx, ry] = cameraBlur({ ...flat, ...pan, roll: 90 }, stage);
    expect(ry).toBeGreaterThan(rx * 5);
    expect(cameraBlur(flat, stage)).toEqual([0, 0]);
  });

  it('lays the camera out on a timeline for exporters', async () => {
    const { cameraTrack, cameraSamples } = await import('./cameratrack.js');
    const track = cameraTrack(scene);
    expect(track.map((t) => [t.startMs, t.moveMs, t.holdMs])).toEqual([
      [0, 0, 100],
      [100, 600, 100],
      [800, 600, 100],
      [1500, 600, 100],
    ]);
    expect(track[1]!.to).toMatchObject({ tilt: 35, turn: -15 });
    const samples = cameraSamples(scene, 30);
    expect(samples[0]).toMatchObject({ frame: 0, shot: 0 });
    const intoCard = samples.filter((x) => x.shot === 1);
    expect(intoCard.map((x) => x.frame)).toEqual([3, 5, 7, 9, 11, 13, 15, 17, 19, 21]);
    expect(intoCard.some((x) => (x.view.blur ?? 0) > 0)).toBe(true);
    expect(intoCard.at(-1)!.view.blur).toBeUndefined();
  });
});
