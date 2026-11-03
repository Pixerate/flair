import { useEffect, useRef, useState } from "react";
import { validateScene, type Scene } from "@pixerate/flair";
import { mountScene, recordEffect, type MountedScene } from "@pixerate/flair/embed";
import retime from "../../../../tests/fixtures/retime.scene.json";

/**
 * `#scene`: the retimed-footage scene (`tests/fixtures/retime.scene.json`)
 * playing on the page. Its "footage" slot is filled with Flair's preview
 * clip, recorded to a WebM first (it shows its own clock, so each retime
 * reads plainly: slow motion, light trails, then counting down in reverse).
 */
export function ScenePage() {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Recording the footage…");
  const [time, setTime] = useState(0);

  useEffect(() => {
    const scene = retime as unknown as Scene;
    let player: MountedScene | undefined;
    let url: string | undefined;
    let gone = false;
    void (async () => {
      try {
        const issues = validateScene(scene);
        if (issues.length) throw new Error(issues.map((i) => `Shot ${i.shot}: ${i.message}`).join(" "));
        // Speed 1 without blending gives the preview clip as it is.
        const clip = await recordEffect("retime-speed", { values: { speed: 1, smooth: false }, format: "webm", width: 640, height: 360, fps: 30 });
        if (gone) return;
        url = URL.createObjectURL(clip);
        setStatus("Loading the scene…");
        player = await mountScene(host.current!, scene, { subjects: { footage: { video: url } }, loop: true, width: 1280, height: 720 });
        if (gone) return player.dispose();
        player.onFrame = setTime;
        setStatus(`Playing "${scene.title}" (${(player.plan.durationMs / 1000).toFixed(1)} s).`);
      } catch (e) {
        setStatus(`Could not play it: ${(e as Error).message}`);
      }
    })();
    return () => {
      gone = true;
      player?.dispose();
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  return (
    <div className="min-h-screen p-6 space-y-3">
      <h1 className="text-lg font-semibold">Scene with retimed video layers</h1>
      <p className="text-sm text-slate-400" data-status>
        {status} <span data-time>{(time / 1000).toFixed(2)} s</span>
      </p>
      <div ref={host} className="w-full max-w-4xl aspect-video bg-black rounded-lg overflow-hidden" />
    </div>
  );
}
