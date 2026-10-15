import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  cameraAt,
  cameraBlur,
  cameraTrack,
  cameraTransform,
  sceneStage,
  SvgPlayer,
  type Scene,
  type SceneElement,
} from "@pixerate/flair";
import { effectDefaults, getEffect, renderVectorEffect } from "@pixerate/flair/catalog";

/** A dashboard laid out on a 1920×1080 stage, the way the product videos' screens are. */
const DASHBOARD: SceneElement[] = [
  { id: "nav", type: "panel", x: 60, y: 60, width: 250, height: 960, text: "Projects", fontSize: 30 },
  { id: "graph", type: "graph", x: 370, y: 60, width: 960, height: 560, text: "Critical path", fontSize: 30 },
  { id: "velocity", type: "chart", x: 1390, y: 60, width: 470, height: 560, text: "Velocity", fontSize: 30 },
  { id: "todo", type: "card", x: 370, y: 680, width: 450, height: 340, text: "To do", fontSize: 30 },
  { id: "doing", type: "card", x: 880, y: 680, width: 450, height: 340, text: "In progress", fontSize: 30 },
  { id: "done", type: "card", x: 1390, y: 680, width: 470, height: 340, text: "Done", fontSize: 30 },
];

const place = (elements: SceneElement[]) => elements.map((element) => ({ type: "element" as const, element }));
const WIDE = { x: 0, y: 0, width: 1920, height: 1080 };

interface Example {
  name: string;
  about: string;
  scene: Scene;
}

const EXAMPLES: Example[] = [
  {
    name: "Swoop onto a tilted screen",
    about: "The camera leans the dashboard back and swings it round as it dives onto the graph, blurring on the way.",
    scene: {
      name: "swoop",
      shots: [
        { title: "Dashboard", camera: WIDE, hold: 900, run: place(DASHBOARD) },
        { title: "Tilt in", camera: { frame: ["graph"], tilt: 32, turn: -16, motionBlur: 1.5 }, hold: 1600 },
        { title: "Across", camera: { frame: ["velocity"], tilt: 24, turn: 18, motionBlur: 1.5 }, hold: 1200 },
        { title: "Flat", camera: { ...WIDE, tilt: 0, turn: 0, motionBlur: 1 }, hold: 900 },
      ],
    },
  },
  {
    name: "Whip pans",
    about: "Fast flat pans between the cards: the blur streaks along each move and is gone when the camera lands.",
    scene: {
      name: "whip",
      shots: [
        { title: "To do", camera: { frame: ["todo"], padding: 0.3 }, hold: 900, run: place(DASHBOARD) },
        { title: "In progress", camera: { frame: ["doing"], padding: 0.3, motionBlur: 3 }, hold: 900 },
        { title: "Done", camera: { frame: ["done"], padding: 0.3, motionBlur: 3 }, hold: 900 },
        { title: "Velocity", camera: { frame: ["velocity"], padding: 0.2, motionBlur: 3 }, hold: 900 },
      ],
    },
  },
  {
    name: "Rolling reveal",
    about: "Starts close, tipped and rolled with a short lens for drama, then rolls level as it pulls back to the whole board.",
    scene: {
      name: "roll",
      shots: [
        { title: "Close", camera: { frame: ["graph"], padding: 0.05, tilt: 40, roll: -14, perspective: 0.7 }, hold: 1100, run: place(DASHBOARD) },
        { title: "Pull back", camera: { ...WIDE, tilt: 12, roll: 0, perspective: 1.2, motionBlur: 1 }, hold: 1100 },
        { title: "Level", camera: { ...WIDE, tilt: 0, motionBlur: 0.5 }, hold: 900 },
      ],
    },
  },
];

const LOOKS: Record<string, string> = {
  panel: "bg-slate-800/90 border-slate-600",
  graph: "bg-[#0B1220] border-teal-400/70",
  chart: "bg-indigo-950 border-violet-400/70",
  card: "bg-slate-800/90 border-amber-400/60",
};

/** A chart card's bars, drawn in the card's own units. */
function Bars() {
  const heights = [40, 65, 50, 85, 70, 95];
  return (
    <div className="absolute inset-x-[8%] bottom-[8%] top-[22%] flex items-end gap-[4%]">
      {heights.map((h, i) => (
        <div key={i} className="flex-1 rounded-t bg-violet-400/80" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

/** The flow-network effect, playing inside the graph card. */
function Graph() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const effect = getEffect("flow-network");
    if (effect?.kind !== "vector") return;
    const player = new SvgPlayer(host.current!, renderVectorEffect(effect, effectDefaults(effect)), { hold: effect.hold, pauseWhenHidden: true });
    return () => player.dispose();
  }, []);
  return <div ref={host} className="absolute inset-[10%_4%_4%]" />;
}

function Element({ element }: { element: SceneElement }) {
  return (
    <div
      className={`absolute rounded-[18px] border-[3px] overflow-hidden ${LOOKS[element.type] ?? LOOKS.card}`}
      style={{ left: element.x, top: element.y, width: element.width, height: element.height }}
    >
      <span className="absolute left-6 top-4 font-semibold text-slate-100" style={{ fontSize: element.fontSize }}>
        {element.text}
      </span>
      {element.type === "graph" && <Graph />}
      {element.type === "chart" && <Bars />}
      {element.type === "card" &&
        [0, 1, 2].map((i) => <div key={i} className="absolute left-6 right-6 h-[16%] rounded-lg bg-slate-700/80" style={{ top: `${26 + i * 22}%` }} />)}
    </div>
  );
}

/**
 * Plays a scene's camera on a DOM board, looping: `cameraTrack` lays the
 * camera out, `cameraAt` gives the view at a time, and the view becomes the
 * board's zoom and scroll, `cameraTransform` (its 3D angle) and
 * `cameraBlur` (an SVG blur that streaks along a pan).
 */
function CameraPlayer({ scene }: { scene: Scene }) {
  const stage = useMemo(() => sceneStage(scene), [scene]);
  const track = useMemo(() => cameraTrack(scene), [scene]);
  const total = track.reduce((ms, e) => ms + e.moveMs + e.holdMs, 0);
  const frame = useRef<HTMLDivElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const blur = useRef<SVGFEGaussianBlurElement>(null);
  const filterId = `camera-blur-${useId().replace(/:/g, "")}`;
  const [shot, setShot] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    // Measured on resize, not every frame: reading layout after writing transforms forces a layout per frame.
    let width = frame.current!.clientWidth;
    const resize = new ResizeObserver(([entry]) => entry && (width = entry.contentRect.width));
    resize.observe(frame.current!);
    const draw = (now: number) => {
      const t = (now - start) % total;
      const entry = [...track].reverse().find((e) => e.startMs <= t) ?? track[0]!;
      const view = cameraAt(entry, t - entry.startMs, stage);
      const k = width / stage.width;
      content.current!.style.transform = `scale(${k * view.zoom}) translate(${view.scrollX}px, ${view.scrollY}px)`;
      board.current!.style.transform = cameraTransform(view, stage, width);
      const [sx, sy] = cameraBlur(view, stage, width);
      blur.current!.setAttribute("stdDeviation", `${sx} ${sy}`);
      board.current!.style.filter = sx > 0 ? `url(#${filterId})` : "none";
      setShot((s) => (s === entry.index ? s : entry.index));
      raf = requestAnimationFrame(draw);
    };
    // Only plays while on screen.
    const visibility = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(raf);
      raf = entry?.isIntersecting ? requestAnimationFrame(draw) : 0;
    });
    visibility.observe(frame.current!);
    return () => {
      cancelAnimationFrame(raf);
      visibility.disconnect();
      resize.disconnect();
    };
  }, [track, stage, total, filterId]);

  const entry = track[shot]!;
  return (
    <div ref={frame} className="relative aspect-video overflow-hidden bg-gradient-to-b from-slate-950 to-[#0a0f1f]">
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur ref={blur} stdDeviation="0 0" />
        </filter>
      </svg>
      <div ref={board} className="absolute inset-0" style={{ transformOrigin: "50% 50%" }}>
        <div ref={content} className="absolute left-0 top-0" style={{ width: stage.width, height: stage.height, transformOrigin: "0 0" }}>
          {entry.elements.map((element) => (
            <Element key={element.id} element={element} />
          ))}
        </div>
      </div>
      {entry.shot.title && (
        <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-slate-200">
          {entry.index + 1}. {entry.shot.title}
        </span>
      )}
    </div>
  );
}

/** The gallery's camera section: scenes whose shots tilt, turn, roll and blur. */
export function CameraMoves() {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Camera moves</h2>
        <p className="text-sm text-slate-400">
          Scene shots can tilt, turn and roll the camera in 3D and blur while it moves:{" "}
          <code className="text-slate-300">{`{ "camera": { "frame": ["graph"], "tilt": 32, "turn": -16, "motionBlur": 1.5 } }`}</code>
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {EXAMPLES.map((example) => (
          <article key={example.name} className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <CameraPlayer scene={example.scene} />
            <div className="p-3">
              <h3 className="font-medium text-slate-100">{example.name}</h3>
              <p className="mt-1 text-sm text-slate-400">{example.about}</p>
              <details className="mt-2 text-xs text-slate-400">
                <summary className="cursor-pointer select-none hover:text-slate-200">Shots</summary>
                <pre className="mt-2 overflow-x-auto rounded bg-slate-950 p-2 text-[11px] text-slate-300">
                  {JSON.stringify(
                    example.scene.shots.map(({ title, camera }) => ({ title, camera })),
                    null,
                    1,
                  )}
                </pre>
              </details>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
