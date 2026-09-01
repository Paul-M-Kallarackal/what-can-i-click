import { ArrowUpRight, Bot, Check, ChevronDown, ChevronLeft, ChevronRight, Play, ShieldCheck, X } from "lucide-react";
import type { CSSProperties } from "react";
import { mechanismById } from "../../data/mechanisms";
import { mergeFamilyById } from "../../data/mergeFamilies";
import { useAtlasStore } from "../../store/useAtlasStore";
import type { ArchitectureRecommendation, WorkloadProfile } from "../../types";

const workloadLabels: Record<WorkloadProfile["workload"], string> = {
  observability: "Observability",
  "product-analytics": "Product analytics",
  cdc: "CDC",
  iot: "IoT",
  financial: "Financial analytics",
  general: "General analytics",
};

const phrase = (value: string) => value.replaceAll("-", " ");

const readContractLabels = {
  background: "Background merge semantics",
  argmax: "argMax current-state reads",
  final: "FINAL current-state reads",
} as const;

export function recommendationProfileFacts(profile: WorkloadProfile) {
  return [
    workloadLabels[profile.workload],
    `${phrase(profile.ingestRate)} ingest`,
    `${phrase(profile.latencyTarget)} reads`,
    `${profile.retention} retention`,
    `${phrase(profile.availability)} availability`,
    phrase(profile.topology),
  ];
}

export function recommendationStepState(recommendation: ArchitectureRecommendation, requestedIndex: number) {
  const index = Math.min(Math.max(0, requestedIndex), Math.max(0, recommendation.decisions.length - 1));
  const decision = recommendation.decisions[index];
  const mechanism = decision ? mechanismById(decision.mechanismId) : undefined;
  const evidence = decision
    ? recommendation.evidence.filter((entry) => decision.evidenceIds.includes(entry.id)).slice(0, 3)
    : [];
  const validationIndex = recommendation.validationSteps.length
    ? Math.min(
        recommendation.validationSteps.length - 1,
        Math.floor((index / Math.max(1, recommendation.decisions.length - 1)) * (recommendation.validationSteps.length - 1)),
      )
    : -1;

  return {
    index,
    decision,
    mechanism,
    evidence,
    validationStep: validationIndex >= 0 ? recommendation.validationSteps[validationIndex] : undefined,
  };
}

export function RecommendationPanel() {
  const open = useAtlasStore((state) => state.journeyPanelOpen);
  const activeJourneyId = useAtlasStore((state) => state.activeJourneyId);
  const recommendation = useAtlasStore((state) => state.recommendation);
  const profile = useAtlasStore((state) => state.recommendationProfile);
  const stepIndex = useAtlasStore((state) => state.recommendationStepIndex);
  const mergeFamilyId = useAtlasStore((state) => state.mergeFamilyId);
  const latestReadStrategy = useAtlasStore((state) => state.latestReadStrategy);

  if (!open || activeJourneyId || !recommendation || !profile || recommendation.decisions.length === 0) return null;

  const { index, decision, mechanism, evidence, validationStep } = recommendationStepState(recommendation, stepIndex);
  if (!decision || !mechanism) return null;

  const facts = recommendationProfileFacts(profile);
  const mergeFamily = mergeFamilyById(mergeFamilyId);
  const atEnd = index === recommendation.decisions.length - 1;
  const tradeoff = mechanism.tradeoffs[0] ?? recommendation.tradeoffs[Math.min(index, recommendation.tradeoffs.length - 1)];
  const move = (nextIndex: number) => useAtlasStore.getState().setRecommendationStep(nextIndex);

  return (
    <aside className="journey-panel recommendation-panel" aria-label="Your ClickHouse architecture recommendation">
      <header>
        <button className="journey-close" type="button" onClick={() => useAtlasStore.getState().setJourneyPanelOpen(false)} aria-label="Close recommendation"><X size={18} /></button>
        <span className="eyebrow"><Bot size={14} /> WebMCP recommendation · deterministic</span>
        <h2>{workloadLabels[profile.workload]} baseline</h2>
        <p>{recommendation.summary}</p>
      </header>

      <section className="recommendation-profile" aria-label="Workload facts used for this recommendation">
        <span>Agent understood</span>
        <div>{facts.map((fact) => <b key={fact}>{fact}</b>)}</div>
      </section>

      <section className="recommendation-contract" aria-label="Recommended MergeTree storage and read contract">
        <span>Chosen storage contract</span>
        <strong>{mergeFamily.title}</strong>
        <b>{readContractLabels[latestReadStrategy]}</b>
      </section>

      <nav
        className="recommendation-route"
        aria-label="Recommendation steps"
        style={{ "--route-progress": `${recommendation.decisions.length > 1 ? (index / (recommendation.decisions.length - 1)) * 100 : 0}%` } as CSSProperties}
      >
        <div className="recommendation-route__head"><span>Drag to move through the 3D architecture</span><strong>{index + 1} / {recommendation.decisions.length}</strong></div>
        <input
          type="range"
          min={0}
          max={recommendation.decisions.length - 1}
          step={1}
          value={index}
          onChange={(event) => move(Number(event.currentTarget.value))}
          aria-label="Move through the recommended architecture"
          aria-valuetext={`Step ${index + 1}: ${decision.title}`}
        />
        <div className="recommendation-route__ticks">
          {recommendation.decisions.map((entry, routeIndex) => (
            <button
              key={entry.id}
              type="button"
              data-active={routeIndex === index}
              data-complete={routeIndex < index}
              aria-current={routeIndex === index ? "step" : undefined}
              aria-label={`Open step ${routeIndex + 1}: ${entry.title}`}
              onClick={() => move(routeIndex)}
            >
              {routeIndex < index ? <Check size={10} /> : routeIndex + 1}
            </button>
          ))}
        </div>
      </nav>

      <section className="recommendation-decision" aria-live="polite">
        <div className="recommendation-decision__head">
          <span>Step {index + 1} of {recommendation.decisions.length}</span>
          <small>{mechanism.districtId} · {mechanism.shortTitle}</small>
          <h3>{decision.title}</h3>
        </div>

        <dl className="recommendation-glance">
          <div><dt>Do</dt><dd>{decision.recommendation}</dd></div>
          <div><dt>Why</dt><dd>{decision.rationale}</dd></div>
          {tradeoff && <div><dt>Tradeoff</dt><dd>{tradeoff.cost}</dd></div>}
          {validationStep && <div data-validation="true"><dt>Validate</dt><dd>{validationStep}</dd></div>}
        </dl>

        <div className="recommendation-confidence"><ShieldCheck size={15} /><span>{decision.confidence} confidence</span><small>{evidence.length || decision.evidenceIds.length} reviewed source{(evidence.length || decision.evidenceIds.length) === 1 ? "" : "s"}</small></div>

        {decision.alternatives.length > 0 && (
          <details className="recommendation-disclosure">
            <summary><span>Alternatives to consider</span><ChevronDown size={16} /></summary>
            <ul>{decision.alternatives.map((alternative) => <li key={alternative}>{alternative}</li>)}</ul>
          </details>
        )}

        {evidence.length > 0 && (
          <details className="recommendation-disclosure">
            <summary><span>Evidence for this decision</span><ChevronDown size={16} /></summary>
            <div className="recommendation-sources">
              {evidence.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noreferrer"><span><small>{source.kind}</small><strong>{source.label}</strong></span><ArrowUpRight size={15} /></a>)}
            </div>
          </details>
        )}

        <div className="recommendation-actions">
          <button type="button" disabled={index === 0} onClick={() => move(index - 1)}><ChevronLeft size={17} />Back</button>
          {atEnd ? (
            <button type="button" onClick={() => {
              useAtlasStore.getState().setJourneyPanelOpen(false);
              useAtlasStore.getState().playStory("architecture", recommendation.path);
            }}><Play size={16} />Play the architecture</button>
          ) : (
            <button type="button" onClick={() => move(index + 1)}>Next decision<ChevronRight size={17} /></button>
          )}
        </div>
      </section>

      <details className="recommendation-checklist">
        <summary><span><strong>Production validation checklist</strong><small>{recommendation.validationSteps.length} checks before adoption</small></span><ChevronDown size={17} /></summary>
        <ol>{recommendation.validationSteps.map((step) => <li key={step}>{step}</li>)}</ol>
      </details>
    </aside>
  );
}
