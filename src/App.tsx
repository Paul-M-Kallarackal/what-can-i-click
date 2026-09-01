import { Info } from "lucide-react";
import { useEffect } from "react";
import { WorldCanvas } from "./components/scene/WorldCanvas";
import { AboutPanel } from "./components/ui/AboutPanel";
import { AgentJourneyPanel } from "./components/ui/AgentJourneyPanel";
import { Inspector } from "./components/ui/Inspector";
import { MergeFamilyNavigator } from "./components/ui/MergeFamilyNavigator";
import { OperationalHud } from "./components/ui/OperationalHud";
import { RecommendationPanel } from "./components/ui/RecommendationPanel";
import { RecommendationRail } from "./components/ui/RecommendationRail";
import { SimulationControls } from "./components/ui/SimulationControls";
import { useAtlasStore } from "./store/useAtlasStore";
import { registerWebMcpTools } from "./webmcp/register";

export default function App() {
  const selectedMechanismId = useAtlasStore((state) => state.selectedMechanismId);
  const journeyPanelOpen = useAtlasStore((state) => state.journeyPanelOpen);
  const storyMode = useAtlasStore((state) => state.storyMode);
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
      if (event.key === "Escape" && target?.tagName !== "INPUT") {
        const state = useAtlasStore.getState();
        if (state.viewLevel === "xray") state.setViewLevel("mechanism");
        else if (state.selectedMechanismId || state.selectedEvidenceId) state.showSystem();
        else {
          state.setAboutOpen(false);
          state.setSearchOpen(false);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <main className="app-shell">
      <a className="skip-link" href="#machine-controls">Skip to simulation controls</a>
      <WorldCanvas />
      <header className="topbar">
        <div className="mini-brand"><img aria-hidden="true" alt="" className="brand-mark" src="/brand/what-can-i-click-tree-logo-512.png" /><span><strong>What can I <em>Click</em></strong><small>ClickHouse gotchas, made visible</small></span></div>
        <nav aria-label="ClickHouse foundry utilities">
          <div className="webmcp-status" title="WebMCP tools register when the browser supports document.modelContext"><i /><span>WebMCP</span></div>
          <button className="icon-button" type="button" onClick={() => useAtlasStore.getState().setAboutOpen(true)} aria-label="About this project"><Info size={17} /></button>
        </nav>
      </header>

      <OperationalHud />

      {!selectedMechanismId && !journeyPanelOpen && <MergeFamilyNavigator />}
      <AgentJourneyPanel />
      <RecommendationPanel />
      {storyMode === "architecture" && !journeyPanelOpen && <RecommendationRail />}

      <div className="gesture-note" aria-hidden="true"><span>Drag</span> orbit · <span>Shift + drag</span> pan · <span>Scroll</span> zoom · <span>Esc</span> step back</div>
      <div id="machine-controls"><SimulationControls /></div>
      {!journeyPanelOpen && <Inspector />}
      <AboutPanel />
      <footer className="source-footer"><span>See the gotcha. Choose around it.</span><span>Official guidance → derived advice → field evidence</span></footer>
    </main>
  );
}
