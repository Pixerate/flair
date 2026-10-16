import { describe, expect, it } from 'vitest';
import { ManualClock } from '../time/clock.js';
import { exportFcp7Xml } from '../export/interchange.js';
import { exportMotn } from '../export/motn.js';
import {
  between,
  CAMERA_MS,
  CAMERA_STEPS,
  centreOf,
  easeInOutCubic,
  moveBlur,
  transitionView,
  viewAt,
  type Stage,
  type View,
} from './camera.js';
import { cameraSamples, cameraTrack } from './cameratrack.js';
import { MemorySceneBoard, playScene, simulateScene } from './player.js';
import { standaloneSceneHtml } from './standalone.js';
import type { Scene } from './types.js';
import { validateScene } from './validate.js';

const stage: Stage = { width: 1920, height: 1080, caption: 0 };
const left = viewAt(500, 540, 2, stage);
const right = viewAt(1500, 540, 2, stage);

const card = (id: string, x: number) => ({ type: 'element' as const, element: { id, type: 'rectangle', x, y: 400, width: 300, height: 200 } });

const scene: Scene = {
  name: 'transitions',
  shots: [
    { camera: { frame: ['a'] }, hold: 100, run: [card('a', 300), card('b', 1300)] },
    { camera: { frame: ['b'], transition: 'whip' }, hold: 100 },
    { camera: { frame: ['a'], transition: 'zoom', motionBlur: 1 }, hold: 100 },
    { camera: { frame: ['b'], transition: 'cut' }, hold: 100 },
    { camera: { frame: ['a'] }, hold: 100 },
  ],
};

const centre = (v: View) => centreOf(v, stage);

describe('camera transitions', () => {
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

  it('lays transitions out on the timeline, keying both sides of the jump', () => {
    const track = cameraTrack(scene);
    expect(track.map((t) => [t.transition, t.moveMs, t.motionBlur])).toEqual([
      ['move', 0, 0],
      ['whip', CAMERA_MS, 2],
      ['zoom', CAMERA_MS, 1],
      ['cut', 0, 0],
      ['move', CAMERA_MS, 0],
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
    const html = standaloneSceneHtml(scene);
    expect(html).toContain('"moveMs":0');
    expect(html).not.toContain('plan.cameraMs');
    expect(exportMotn(scene)).toContain(': whip in -->');
    expect(exportFcp7Xml(scene)).toContain('<');
    const { result } = await simulateScene(scene);
    expect(result.duration).toBe(3 * CAMERA_MS + 5 * 100);
  });

  it('checks transitions', () => {
    expect(validateScene(scene)).toEqual([]);
    const bad = validateScene({ name: 'bad', shots: [{ camera: { x: 0, y: 0, width: 10, height: 10, transition: 'whip' } }, { camera: { transition: 'swoosh' as never } }] });
    expect(bad.map((i) => i.shot)).toEqual([1, 2]);
    expect(bad[0]!.message).toContain('no framing to whip from');
    expect(bad[1]!.message).toContain('"move", "whip", "zoom", "cut"');
  });
});
