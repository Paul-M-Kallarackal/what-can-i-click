import { BookOpenText, Info, MousePointer2, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { WorldCanvas } from "./components/scene/WorldCanvas";
import { AboutPanel } from "./components/ui/AboutPanel";
import { AccessibleWorld } from "./components/ui/AccessibleWorld";
import { AtlasSearch } from "./components/ui/AtlasSearch";
import { Inspector } from "./components/ui/Inspector";
import { RecommendationRail } from "./components/ui/RecommendationRail";
import { SimulationControls } from "./components/ui/SimulationControls";
import { useAtlasStore } from "./store/useAtlasStore";
import { registerWebMcpTools } from "./webmcp/register";

export default function App() {
  const playStory = useAtlasStore((state) => state.playStory);
  const setWorldInWordsOpen = useAtlasStore((state) => state.setWorldInWordsOpen);
  const setAboutOpen = useAtlasStore((state) => state.setAboutOpen);

  useEffect(() => registerWebMcpTools(), []);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => useAtlasStore.getState().setReducedMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        useAtlasStore.getState().setSearchOpen(true);
        requestAnimationFrame(() => document.querySelector<HTMLInputElement>(".atlas-search input")?.focus());
      }
      if (event.key === "Escape" && target?.tagName !== "INPUT") {
        useAtlasStore.getState().selectNode(null);
        useAtlasStore.getState().selectEvidence(null);
        useAtlasStore.getState().setAboutOpen(false);
        useAtlasStore.getState().setWorldInWordsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <main className="app-shell">
      <a className="skip-link" href="#atlas-controls">Skip to atlas controls</a>
      <WorldCanvas />
      <header className="topbar">
        <div className="mini-brand"><span aria-hidden="true" className="column-glyph"><i /><i /><i /><i /></span><span><strong>What can I <em>Click</em></strong><small>ClickHouse 26.3 LTS · six mechanisms</small></span></div>
        <AtlasSearch />
        <nav aria-label="Atlas utilities">
          <div className="webmcp-status" title="WebMCP tools register when the browser supports document.modelContext"><i /><span>WebMCP</span></div>
          <button className="icon-button" type="button" onClick={() => setWorldInWordsOpen(true)} aria-label="Open world in words"><BookOpenText size={17} /></button>
          <button className="icon-button" type="button" onClick={() => setAboutOpen(true)} aria-label="About this atlas"><Info size={17} /></button>
        </nav>
      </header>

      <section className="hero-copy" aria-labelledby="page-title">
        <div className="hero-chunk hero-kicker"><span className="eyebrow"><MousePointer2 size={13} />An explorable architecture advisor</span></div>
        <div className="hero-chunk hero-title"><h1 id="page-title">Watch your data<br />become a <span>system.</span></h1></div>
        <div className="hero-chunk hero-body">
          <p>Click a bonsai to inspect the mechanism, or let a WebMCP agent grow an architecture around your workload.</p>
          <button type="button" className="primary-action" onClick={() => playStory("lifecycle")}><Sparkles size={15} />Play the data lifecycle</button>
        </div>
      </section>

      <div className="gesture-note" aria-hidden="true"><span>Drag</span> orbit · <span>Shift + drag</span> roam · <span>Scroll</span> zoom</div>
      <RecommendationRail />
      <div id="atlas-controls"><SimulationControls /></div>
      <Inspector />
      <AccessibleWorld />
      <AboutPanel />
      <footer className="source-footer"><span>Model, not emulator.</span><span>Official guidance → derived advice → field evidence</span></footer>
    </main>
  );
}

