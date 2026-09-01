import { ChevronUp, Gauge, Pause, Play, RotateCcw } from "lucide-react";
import { useState } from "react";
import { OPERATIONAL_SCENARIOS, operationalScenarioById } from "../../data/operationalScenarios";
import { useAtlasStore } from "../../store/useAtlasStore";

export function SimulationControls() {
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const playing = useAtlasStore((state) => state.playing);
  const scenario = useAtlasStore((state) => state.scenario);
  const operationalScenario = operationalScenarioById(scenario);
  return (
    <div className="simulation-dock" aria-label="Simulation controls">
      <button className="play-control" type="button" onClick={() => useAtlasStore.getState().togglePlaying()} aria-label={playing ? "Pause simulation" : "Play simulation"}>
        <span className="t-icon-swap" data-state={playing ? "a" : "b"}>
          <span className="t-icon" data-icon="a"><Pause size={16} /></span>
          <span className="t-icon play-triangle" data-icon="b"><Play size={16} /></span>
        </span>
      </button>
      <div className="scenario-picker">
        <button className="scenario-picker__trigger" type="button" data-pressure={scenario !== "healthy"} aria-haspopup="menu" aria-expanded={scenarioOpen} onClick={() => setScenarioOpen((open) => !open)}>
          <Gauge size={14} /><span><small>Scenario</small><strong>{operationalScenario.shortTitle}</strong></span><ChevronUp size={13} />
        </button>
        <div className="scenario-picker__menu" data-open={scenarioOpen} role="menu" aria-label="ClickHouse operational scenarios">
          <header><span>ClickHouse pressure lab</span><strong>Change one cause. Watch the whole machine respond.</strong></header>
          {OPERATIONAL_SCENARIOS.filter((entry) => entry.id !== "pressure").map((entry) => (
            <button key={entry.id} type="button" role="menuitemradio" aria-checked={scenario === entry.id} data-active={scenario === entry.id} onClick={() => { useAtlasStore.getState().setScenario(entry.id); setScenarioOpen(false); }}>
              <span><strong>{entry.title}</strong><small>{entry.description}</small></span><em>{entry.setting}<b>{entry.settingValue}</b></em>
            </button>
          ))}
        </div>
      </div>
      <button className="step-control" type="button" onClick={() => useAtlasStore.getState().reset()} aria-label="Reset foundry"><RotateCcw size={15} /></button>
    </div>
  );
}
