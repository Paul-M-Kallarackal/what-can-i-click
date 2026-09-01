import { Pause, Play, RotateCcw, Sparkles } from "lucide-react";
import { useAtlasStore } from "../../store/useAtlasStore";

export function SimulationControls() {
  const playing = useAtlasStore((state) => state.playing);
  return (
    <div className="simulation-dock" aria-label="Simulation controls">
      <button className="play-control" type="button" onClick={() => useAtlasStore.getState().togglePlaying()} aria-label={playing ? "Pause simulation" : "Play simulation"}>
        <span className="t-icon-swap" data-state={playing ? "a" : "b"}>
          <span className="t-icon" data-icon="a"><Pause size={16} /></span>
          <span className="t-icon play-triangle" data-icon="b"><Play size={16} /></span>
        </span>
      </button>
      <div className="stable-guide" aria-label="Stable architecture walkthrough">
        <Sparkles size={14} />
        <span><small>Ask your agent</small><strong>Fit ClickHouse to my workload</strong></span>
      </div>
      <button className="step-control" type="button" onClick={() => useAtlasStore.getState().reset()} aria-label="Reset foundry"><RotateCcw size={15} /></button>
    </div>
  );
}
