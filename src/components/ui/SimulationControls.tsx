import { Pause, Play, RotateCcw, Sparkles } from "lucide-react";
import { currentStoryNode, useAtlasStore } from "../../store/useAtlasStore";
import { knowledgeById } from "../../data/knowledge";

const SPEEDS = [0.25, 1, 2, 4];

export function SimulationControls() {
  const playing = useAtlasStore((state) => state.playing);
  const speed = useAtlasStore((state) => state.speed);
  const storyMode = useAtlasStore((state) => state.storyMode);
  const activeId = useAtlasStore((state) => currentStoryNode(state));
  const simulationTime = useAtlasStore((state) => state.simulationTime);
  const togglePlaying = useAtlasStore((state) => state.togglePlaying);
  const setSpeed = useAtlasStore((state) => state.setSpeed);
  const playStory = useAtlasStore((state) => state.playStory);
  const reset = useAtlasStore((state) => state.reset);
  const active = activeId ? knowledgeById(activeId) : null;

  return (
    <div className="simulation-dock" aria-label="Simulation controls">
      <button className="play-control" type="button" onClick={togglePlaying} aria-label={playing ? "Pause simulation" : "Play simulation"}>
        <span className="t-icon-swap" data-state={playing ? "a" : "b"}>
          <span className="t-icon" data-icon="a"><Pause size={16} /></span>
          <span className="t-icon play-triangle" data-icon="b"><Play size={16} /></span>
        </span>
      </button>
      <div className="timeline-status">
        <span className="eyebrow">{storyMode ? `${storyMode} story` : "Living system"}</span>
        <strong>{active ? active.shortTitle : "All mechanisms"}</strong>
        <small className="tabular">{simulationTime.toFixed(1)} garden seconds</small>
      </div>
      <div className="speed-control" aria-label="Simulation speed">
        {SPEEDS.map((value) => <button key={value} type="button" data-active={speed === value} onClick={() => setSpeed(value)}>{value}×</button>)}
      </div>
      <button className="dock-action lifecycle-action" type="button" onClick={() => playStory("lifecycle")}><Sparkles size={15} />Play lifecycle</button>
      <button className="icon-button dock-reset" type="button" onClick={reset} aria-label="Reset world"><RotateCcw size={16} /></button>
    </div>
  );
}

