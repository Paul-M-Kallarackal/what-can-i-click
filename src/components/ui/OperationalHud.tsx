import { Activity, Boxes, DatabaseZap, Gauge, MemoryStick, Rows3 } from "lucide-react";
import { operationalScenarioById, operationalSnapshot } from "../../data/operationalScenarios";
import { useAtlasStore } from "../../store/useAtlasStore";

const compactNumber = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export function OperationalHud() {
  const scenarioId = useAtlasStore((state) => state.scenario);
  const simulationTime = useAtlasStore((state) => state.simulationTime);
  const scenario = operationalScenarioById(scenarioId);
  const snapshot = operationalSnapshot(scenarioId, simulationTime);
  const metrics = [
    { label: "Rows / s", value: compactNumber.format(snapshot.insertsPerSecond), icon: Rows3, danger: false },
    { label: "Query p99", value: `${compactNumber.format(snapshot.queryP99Ms)} ms`, icon: Activity, danger: snapshot.queryP99Ms >= 1_000 },
    { label: "Active parts", value: compactNumber.format(snapshot.activeParts), icon: Boxes, danger: snapshot.activeParts >= 250 },
    { label: "Merges", value: String(snapshot.activeMerges), icon: DatabaseZap, danger: snapshot.activeMerges >= 18 },
    { label: "Memory", value: `${snapshot.memoryPercent}%`, icon: MemoryStick, danger: snapshot.memoryPercent >= 90 },
    { label: "Replica queue", value: compactNumber.format(snapshot.replicaQueue), icon: Gauge, danger: snapshot.replicaQueue >= 100 },
  ];

  return (
    <section className="operational-hud" data-pressure={scenarioId !== "healthy"} aria-label="ClickHouse model telemetry">
      <header>
        <span><i />ClickHouse model telemetry</span>
        <strong>{scenario.shortTitle}</strong>
      </header>
      <div className="operational-hud__metrics" aria-hidden="true">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return <div key={metric.label} data-danger={metric.danger}><Icon size={13} /><span>{metric.label}</span><strong>{metric.value}</strong></div>;
        })}
      </div>
      <p className="sr-only">Deterministic model telemetry for {scenario.title}. These values are not connected to a real ClickHouse cluster.</p>
      <footer><span>{scenario.setting}</span><strong>{scenario.settingValue}</strong><em>MODEL · NOT LIVE CLUSTER DATA</em></footer>
    </section>
  );
}
