import { useEffect, useMemo, useState } from "react";
import { createEffectEditor } from "@pixerate/flair/editor";
import { AgentTab } from "./components/AgentTab";
import { BenchPage } from "./components/BenchPage";
import { CheckPage } from "./components/CheckPage";
import { EditorTab } from "./components/EditorTab";
import { GalleryTab } from "./components/GalleryTab";
import { PixelsPage } from "./components/PixelsPage";
import { ProviderPage } from "./components/ProviderPage";

type Tab = "gallery" | "editor" | "agent";

const TABS: { id: Tab; label: string; blurb: string }[] = [
  { id: "gallery", label: "Gallery", blurb: "Every effect in the catalog, live." },
  { id: "editor", label: "Editor", blurb: "Tweak controls, keyframe them, edit the source." },
  { id: "agent", label: "Agent tools", blurb: "The same editor, driven through MCP-shaped tools." },
];

function tabFromHash(): Tab {
  const id = location.hash.replace(/^#\/?/, "").split("/")[0];
  return TABS.some((t) => t.id === id) ? (id as Tab) : "gallery";
}

export function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  // One editor for the page: the editor and agent tabs edit the same effect.
  const editor = useMemo(() => createEffectEditor({ from: "aurora" }), []);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (location.hash === "#check") return <CheckPage />;
  if (location.hash.split("?")[0] === "#bench") return <BenchPage />;
  if (location.hash.split("?")[0] === "#pixels") return <PixelsPage />;
  if (location.hash.split("?")[0] === "#provider") return <ProviderPage />;

  const go = (next: Tab) => {
    location.hash = `/${next}`;
    setTab(next);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          <a href="#/gallery" className="flex items-center gap-3">
            <span className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 bg-[length:200%_200%] animate-gradient grid place-items-center font-bold text-white">
              F
            </span>
            <span className="font-semibold tracking-tight">
              @pixerate/flair <span className="text-slate-500 font-normal text-sm">v{__FLAIR_VERSION__}</span>
            </span>
          </a>
          <nav className="flex gap-1 rounded-lg bg-slate-900 p-1 border border-slate-800" aria-label="Sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => go(t.id)}
                className={`px-3 py-1.5 rounded-md text-sm transition ${
                  tab === t.id ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-slate-100"
                }`}
                aria-current={tab === t.id ? "page" : undefined}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <p className="text-sm text-slate-400 hidden md:block">{TABS.find((t) => t.id === tab)!.blurb}</p>
          <div className="ml-auto flex gap-4 text-sm">
            <a className="text-slate-400 hover:text-white" href="https://github.com/Pixerate/flair">
              GitHub
            </a>
            <a className="text-slate-400 hover:text-white" href="https://www.npmjs.com/package/@pixerate/flair">
              npm
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6">
        {tab === "gallery" && (
          <GalleryTab
            onOpen={(id) => {
              // Camera moves are for scenes, not the effect editor, which refuses them.
              if (editor.load(id).ok) go("editor");
            }}
          />
        )}
        {tab === "editor" && <EditorTab editor={editor} />}
        {tab === "agent" && <AgentTab editor={editor} onShow={() => go("editor")} />}
      </main>

      <footer className="border-t border-slate-800 text-sm text-slate-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5 flex flex-wrap gap-4 justify-between">
          <span>MIT © Pixerate. Effects are WebGL2 fragment shaders and animated SVG.</span>
          <span>
            Editing is built on{" "}
            <a className="underline hover:text-slate-300" href="https://pixerate.github.io/editor/">
              @pixerate/editor
            </a>
            .
          </span>
        </div>
      </footer>
    </div>
  );
}
