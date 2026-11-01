import { describe, expect, it } from 'vitest';
import { ManualClock } from '../time/clock.js';
import { exportFcp7Xml } from '../export/interchange.js';
import { exportMotn } from '../export/motn.js';
import { getCameraMove } from '../catalog/camera.js';
import { between, CAMERA_STEPS, centreOf, easeInOutCubic, moveBlur, viewAt, type Stage, type View } from './camera.js';
import { cameraAt, cameraSamples, cameraTrack } from './cameratrack.js';
import { moveView, resolveCameraMove } from './moves.js';
import { MemorySceneBoard, playScene, simulateScene } from './player.js';
import { standaloneSceneHtml } from './standalone.js';
import { scenePlan } from './plan.js';
import type { Scene } from './types.js';
import { validateScene } from './validate.js';

const stage: Stage = { width: 1920, height: 1080, caption: 0 };
const left = viewAt(500, 540, 2, stage);
const right = viewAt(1500, 540, 2, stage);

/** A move's length at its defaults. */
const CAMERA_MS = 600;

/** The catalog's camera move for one of the old built-in transitions, `u` of the way through at this blur. */
function transitionView(kind: 'move' | 'whip' | 'zoom' | 'cut', from: View, to: View, u: number, _stage: Stage, blur: number): View {
  const id = { move: 'camera-glide', whip: 'camera-whip-pan', zoom: 'camera-punch-zoom', cut: 'camera-cut' }[kind];
  const move = resolveCameraMove({ move: id, values: kind === 'cut' ? {} : { motionBlur: blur, ...(kind === 'zoom' ? { punch: 1 + blur } : {}) } }, 'transition').move!;
  return moveView(move, from, to, u, stage);
}

const card = (id: string, x: number) => ({ type: 'element' as const, element: { id, type: 'rectangle', x, y: 400, width: 300, height: 200 } });

const scene: Scene = {
  name: 'transitions',
  shots: [
    { camera: { frame: ['a'] }, hold: 100, run: [card('a', 300), card('b', 1300)] },
    { camera: { frame: ['b'], in: 'camera-whip-pan' }, hold: 100 },
    { camera: { frame: ['a'], in: { move: 'camera-punch-zoom', values: { motionBlur: 1, punch: 2 } } }, hold: 100 },
    { camera: { frame: ['b'], in: 'camera-cut' }, hold: 100 },
    { camera: { frame: ['a'] }, hold: 100 },
  ],
};

const centre = (v: View) => centreOf(v, stage);

describe('camera moves into a shot', () => {
  it('a move eases across exactly as before', () => {
    for (const u of [0.2, 0.5, 0.8]) {
      const view = between(left, right, easeInOutCubic(u), stage);
      const before = between(left, right, easeInOutCubic(u - 1 / CAMERA_STEPS), stage);
      expect(transitionView('move', left, right, u, stage, 1)).toEqual({ ...view, ...moveBlur(before, view, stage, 1) });
    }
    expect(transitionView('move', left, right, 0.5, stage, 0).blur).toBeUndefined();
  });

  it('starts on the last framing and settles, unblurred, on the new one', () => {
    for (const kind of ['whip', 'zoom'] as const) {
      const start = transitionView(kind, left, right, 0, stage, 2);
      expect(centre(start)[0]).toBeCloseTo(500);
      expect(start.zoom).toBeCloseTo(2);
      expect(start.blur ?? 0).toBeLessThan(1);
      expect(transitionView(kind, left, right, 1, stage, 2)).toEqual(right);
    }
    expect(transitionView('cut', left, right, 0, stage, 2)).toBe(right);
  });

  it('whips off ahead of the last framing and in from behind the new one, streaking along the way it goes', () => {
    const out = transitionView('whip', left, right, 0.49, stage, 2);
    const into = transitionView('whip', left, right, 0.5, stage, 2);
    // Nearly a board's width (960 scene units at 2×) past the start, then a board's width short of the end.
    expect(centre(out)[0]).toBeGreaterThan(500 + 850);
    expect(centre(into)[0]).toBeCloseTo(1500 - 960);
    expect(out.blurAngle).toBe(0);
    expect(into.blurAngle).toBe(0);
    const up = transitionView('whip', viewAt(960, 900, 1, stage), viewAt(960, 200, 1, stage), 0.45, stage, 2);
    expect(up.blurAngle).toBe(90);
  });

  it('blurs most around the cut and hardly at all at either end', () => {
    for (const kind of ['whip', 'zoom'] as const) {
      const blur = (u: number) => transitionView(kind, left, right, u, stage, 2).blur ?? 0;
      expect(blur(0.47)).toBeGreaterThan(20);
      expect(blur(0.53)).toBeGreaterThan(20);
      expect(blur(0.47)).toBeGreaterThan(blur(0.1) * 2);
      expect(blur(0.53)).toBeGreaterThan(blur(0.9) * 2);
      expect(blur(0.02)).toBeLessThan(1);
      expect(blur(0.98)).toBeLessThan(2);
    }
  });

  it('zooms in to (1 + strength)× at the cut, blurring every way', () => {
    const atCut = transitionView('zoom', left, right, 0.5, stage, 2);
    expect(atCut.zoom).toBeCloseTo(2 * 3);
    expect(centre(atCut)[0]).toBeCloseTo(1500);
    expect(atCut.blurAngle).toBeUndefined();
    expect(transitionView('zoom', left, right, 0.4999, stage, 2).zoom).toBeCloseTo(6, 1);
  });

  it('plays each transition, taking no time to cut', async () => {
    const views: View[] = [];
    const board = new MemorySceneBoard(stage);
    const setView = board.setView.bind(board);
    board.setView = (v) => {
      views.push(v);
      setView(v);
    };
    const clock = new ManualClock();
    const done = playScene(scene, board, clock);
    for (let i = 0; i < 200; i++) await clock.advance(50);
    const result = await done;
    const moves = result.shots.map((s) => s.drawn - s.start);
    expect(moves).toEqual([0, CAMERA_MS, CAMERA_MS, 0, CAMERA_MS]);
    // The whip and zoom both blur hard on the way through.
    expect(Math.max(...views.slice(1, 1 + CAMERA_STEPS).map((v) => v.blur ?? 0))).toBeGreaterThan(20);
    expect(Math.max(...views.slice(1 + CAMERA_STEPS, 1 + 2 * CAMERA_STEPS).map((v) => v.blur ?? 0))).toBeGreaterThan(10);
  });

  it('lays moves out on the timeline, keying both sides of the jump', () => {
    const track = cameraTrack(scene);
    expect(track.map((t) => [t.move?.move.id, t.moveMs, t.move?.values.motionBlur])).toEqual([
      [undefined, 0, undefined],
      ['camera-whip-pan', CAMERA_MS, 2],
      ['camera-punch-zoom', CAMERA_MS, 1],
      ['camera-cut', 0, undefined],
      ['camera-glide', CAMERA_MS, 0],
    ]);
    const samples = cameraSamples(scene, 30).filter((s) => s.shot === 1);
    const frames = samples.map((s) => s.frame);
    const start = Math.round((track[1]!.startMs / 1000) * 30);
    expect(frames).toContain(start + 8);
    expect(frames).toContain(start + 9);
    const [before, after] = [samples.find((s) => s.frame === start + 8)!, samples.find((s) => s.frame === start + 9)!];
    // Short of a board's width (1920 / zoom) past the first card, then exactly one before the second.
    const reach = 1920 / track[1]!.to.zoom;
    const [x0, x1] = [centre(track[1]!.from)[0], centre(track[1]!.to)[0]];
    expect(centre(before.view)[0]).toBeLessThan(x0 + reach);
    expect(centre(before.view)[0]).toBeGreaterThan(x0 + reach / 2);
    expect(centre(after.view)[0]).toBeCloseTo(x1 - reach);
  });

  it('carries transitions into the standalone player and exporters', async () => {
    const html = await standaloneSceneHtml(scene);
    expect(html).toContain('id="flair-scene-plan"');
    expect(html).toContain('"moveMs":600');
    expect(exportMotn(scene)).toContain(': camera-whip-pan in -->');
    expect(exportFcp7Xml(scene)).toContain('<');
    const { result } = await simulateScene(scene);
    expect(result.duration).toBe(3 * CAMERA_MS + 5 * 100);
  });

  it('takes a move\'s length from the shot', async () => {
    const quick: Scene = { ...scene, shots: scene.shots.map((shot, i) => (i === 1 ? { ...shot, camera: { frame: ['b'], in: { move: 'camera-whip-pan', ms: 300 } } } : shot)) };
    expect(cameraTrack(quick)[1]!.moveMs).toBe(300);
    const { result } = await simulateScene(quick);
    expect(result.duration).toBe(2 * CAMERA_MS + 300 + 5 * 100);
  });

  it('checks moves, saying what to write instead', () => {
    expect(validateScene(scene)).toEqual([]);
    const bad = validateScene({
      name: 'bad',
      shots: [
        { camera: { x: 0, y: 0, width: 10, height: 10, in: 'camera-whip-pan' } },
        { camera: { in: 'camera-swoosh' } },
        { camera: { in: 'camera-ken-burns' } },
        { camera: { in: { move: 'camera-whip-pan', values: { motionBlur: 9 } } } },
        { camera: { transition: 'whip', motionBlur: 1.5 } as never },
      ],
    });
    expect(bad.map((i) => i.shot)).toEqual([1, 2, 3, 4, 5]);
    expect(bad[0]!.message).toContain('no framing to move from');
    expect(bad[1]!.message).toBe('There is no camera move "camera-swoosh"; camera "in" takes one of "camera-glide", "camera-whip-pan", "camera-punch-zoom", "camera-cut".');
    expect(bad[2]!.message).toContain('goes in camera "during", not "in"');
    expect(bad[3]!.message).toContain('motionBlur');
    expect(bad[4]!.message).toContain('{ "in": { "move": "camera-whip-pan", "values": { "motionBlur": 1.5 } } }');
  });
});

describe('camera moves while a shot holds', () => {
  const drift: Scene = {
    name: 'drift',
    shots: [
      { camera: { frame: ['a'], during: { move: 'camera-ken-burns', preset: 'Push in' } }, hold: 1000, run: [card('a', 300), card('b', 1300)] },
      { camera: { frame: ['b'] }, hold: 100 },
    ],
  };

  it('plays across the hold, and the next move starts where it ends', async () => {
    const track = cameraTrack(drift);
    expect(track[0]!.during?.move.id).toBe('camera-ken-burns');
    expect(track[0]!.end.zoom / track[0]!.to.zoom).toBeCloseTo(1.5, 6);
    expect(track[1]!.from).toEqual(track[0]!.end);
    expect(cameraAt(track[0]!, 500, stage).zoom / track[0]!.to.zoom).toBeCloseTo(1.25, 6);

    const views: View[] = [];
    const board = new MemorySceneBoard(stage);
    const setView = board.setView.bind(board);
    board.setView = (v) => {
      views.push(v);
      setView(v);
    };
    const clock = new ManualClock();
    const done = playScene(drift, board, clock);
    for (let i = 0; i < 100; i++) await clock.advance(50);
    await done;
    // One view to frame the shot, then one each 50 ms of the hold, ending where the track says.
    expect(views[20]!.zoom).toBeCloseTo(track[0]!.end.zoom, 6);
  });

  it('is sampled through the hold for exporters and the standalone player', async () => {
    const samples = cameraSamples(drift, 30);
    expect(samples.filter((s) => s.shot === 0).length).toBeGreaterThan(10);
    // The hold ends on frame 30, where the next shot's move sets off from where the drift ended.
    expect(samples.find((s) => s.frame === 30)!.view.zoom).toBeCloseTo(cameraTrack(drift)[0]!.end.zoom, 6);
    // The plan keys the camera at every frame of the hold, where it drifts.
    const plan = await scenePlan(drift);
    const inHold = plan.camera.filter((k) => k.ms > 0 && k.ms < 1000);
    expect(new Set(inHold.map((k) => k.view.zoom)).size).toBeGreaterThan(10);
    expect((await standaloneSceneHtml(drift)).length).toBeGreaterThan(1000);
    expect(validateScene(drift)).toEqual([]);
    expect(validateScene({ name: 'x', shots: [{ camera: { during: 'camera-whip-pan' } }] })[0]!.message).toContain('goes in camera "in", not "during"');
  });

  it('crash zooms onto a target', () => {
    const crash = getCameraMove('camera-crash-zoom')!;
    expect(crash.motion.role).toBe('hold');
    const shot: Scene = { name: 'crash', shots: [{ camera: { frame: ['a'], during: 'camera-crash-zoom' }, hold: 2000, run: [card('a', 300)] }] };
    const [entry] = cameraTrack(shot);
    expect(entry!.end.zoom / entry!.to.zoom).toBeCloseTo(3.4, 3);
  });
});
