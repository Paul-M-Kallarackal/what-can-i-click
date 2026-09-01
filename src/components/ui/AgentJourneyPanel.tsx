import { ArrowUpRight, Bot, Check, ChevronDown, ChevronLeft, ChevronRight, Route, X } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { companyImplementationById, MERGE_FAMILY_EVIDENCE_GAPS } from "../../data/companyImplementations";
import { evidenceById } from "../../data/evidence";
import { mechanismById } from "../../data/mechanisms";
import { LATEST_READ_STRATEGIES, mergeFamilyById } from "../../data/mergeFamilies";
import {
  resolveActiveAgentLogIndex,
  resolveAgentLogGuideIndex,
  resolveJourneyGuideStep,
  useCaseJourneyById,
  type UseCaseJourney,
} from "../../data/useCaseJourneys";
import { useAtlasStore } from "../../store/useAtlasStore";

function compactFact(value: string, maxLength = 112) {
  const sentence = value.split(/(?<=[.!?])\s+/)[0];
  return sentence.length <= maxLength ? sentence : `${sentence.slice(0, maxLength - 1).trimEnd()}…`;
}

function moveGuide(nextIndex: number) {
  useAtlasStore.getState().setJourneyStep(nextIndex);
}

export function getJourneyPanelState(journey: UseCaseJourney, stepIndex: number) {
  const guide = resolveJourneyGuideStep(journey, stepIndex);
  return {
    guide,
    family: mergeFamilyById(guide.familyId),
    strategy: LATEST_READ_STRATEGIES.find((entry) => entry.id === guide.latestReadStrategy)!,
    mechanism: mechanismById(guide.mechanismId)!,
    evidence: evidenceById(guide.evidenceId),
  };
}

export function getGuideProductionEvidence(journey: UseCaseJourney, stepIndex: number) {
  const guide = resolveJourneyGuideStep(journey, stepIndex);
  const implementationId = guide.step.productionEvidenceId;
  const implementation = implementationId ? companyImplementationById(implementationId) : undefined;

  if (!implementation) return { implementation: undefined, alignedOn: null as null };
  if (guide.step.phase === "storage" && implementation.mergeFamilyIds.includes(guide.familyId)) {
    return { implementation, alignedOn: "family" as const };
  }
  if (implementation.relatedMechanismIds.includes(guide.mechanismId)) {
    return { implementation, alignedOn: "mechanism" as const };
  }
  return { implementation: undefined, alignedOn: null as null };
}

/** Preserve the exact clicked trace row even when two reasoning stages share one visual step. */
export function resolveVisibleAgentLogIndex(
  journey: UseCaseJourney,
  guideIndex: number,
  selectedLogIndex: number | null,
) {
  const boundedGuideIndex = resolveJourneyGuideStep(journey, guideIndex).index;
  if (
    selectedLogIndex !== null
    && Number.isInteger(selectedLogIndex)
    && selectedLogIndex >= 0
    && selectedLogIndex < journey.agentLog.length
    && resolveAgentLogGuideIndex(journey, selectedLogIndex) === boundedGuideIndex
  ) {
    return selectedLogIndex;
  }
  return resolveActiveAgentLogIndex(journey, boundedGuideIndex);
}

export function AgentJourneyPanel() {
  const open = useAtlasStore((state) => state.journeyPanelOpen);
  const activeJourneyId = useAtlasStore((state) => state.activeJourneyId);
  const stepIndex = useAtlasStore((state) => state.journeyStepIndex);
  const [selectedAgentLogIndex, setSelectedAgentLogIndex] = useState<number | null>(null);
  useEffect(() => setSelectedAgentLogIndex(null), [activeJourneyId]);
  if (!open) return null;
  const journey = activeJourneyId ? useCaseJourneyById(activeJourneyId) : undefined;
  if (!journey) return null;

  const { guide, family, strategy, mechanism, evidence } = getJourneyPanelState(journey, stepIndex);
  const currentStep = guide.step;
  const productionEvidence = getGuideProductionEvidence(journey, guide.index);
  const company = productionEvidence.implementation;
  const gap = MERGE_FAMILY_EVIDENCE_GAPS[journey.familyId];
  const atEnd = guide.index >= journey.guidePath.length - 1;
  const activeLogIndex = resolveVisibleAgentLogIndex(journey, guide.index, selectedAgentLogIndex);
  const activeLog = journey.agentLog[activeLogIndex]!;
  const navigateGuide = (nextIndex: number) => {
    setSelectedAgentLogIndex(null);
    moveGuide(nextIndex);
  };

  return (
    <aside className="journey-panel" aria-label={`${journey.title} guided recommendation`}>
      <header>
        <button className="journey-close" type="button" onClick={() => useAtlasStore.getState().setJourneyPanelOpen(false)} aria-label="Close guided recommendation"><X size={15} /></button>
        <span className="eyebrow"><Bot size={12} /> Agent trace · {journey.agentLog.length} bounded steps · deterministic</span>
        <h2>{journey.title}</h2>
        <p>{journey.prompt}</p>
      </header>

      <section className="agent-log" aria-label="Agent decision log">
        <div className="agent-log-now" aria-live="polite">
          <span>Agent trace · {activeLogIndex + 1}/{journey.agentLog.length}</span>
          <strong>{activeLog.stage}</strong>
          <p>{activeLog.message}</p>
        </div>
        {journey.agentLog.map((entry, index) => {
          const targetGuideIndex = resolveAgentLogGuideIndex(journey, index);
          const isActive = index === activeLogIndex;
          const isComplete = index < activeLogIndex;
          return (
            <button
              key={entry.stage}
              type="button"
              data-active={isActive}
              data-complete={isComplete}
              aria-current={isActive ? "step" : undefined}
              aria-label={`Jump to ${entry.stage} decision at guide step ${targetGuideIndex + 1}: ${entry.message}`}
              onClick={() => {
                setSelectedAgentLogIndex(index);
                moveGuide(targetGuideIndex);
              }}
              style={{ "--log-index": index } as CSSProperties}
            >
              <span aria-hidden="true">{isComplete ? <Check size={9} /> : <Route size={9} />}</span>
              <p><b>{entry.stage}</b><span className="sr-only">{entry.message}</span></p>
            </button>
          );
        })}
      </section>

      <section className="guide-card" aria-live="polite">
        <div className="guide-progress" aria-label={`Step ${guide.index + 1} of ${journey.guidePath.length}`}>{journey.guidePath.map((step, index) => <button key={step.id} type="button" data-active={index === guide.index} data-complete={index < guide.index} onClick={() => navigateGuide(index)} aria-label={`Open step ${index + 1}: ${step.title}`} />)}</div>
        <span className="eyebrow">{currentStep.phase} · {guide.index + 1}/{journey.guidePath.length}</span>
        <h3>{currentStep.title}</h3>
        <div className="guide-glance" aria-label="Current recommendation at a glance">
          <div><small>Do</small><p>{compactFact(currentStep.narration)}</p></div>
          <div><small>Tradeoff</small><p>{compactFact(journey.tradeoff.cost)}</p></div>
          {company ? (
            <button type="button" onClick={() => useAtlasStore.getState().selectEvidence(company.id)} aria-label={`Open ${company.company} production proof`}>
              <small>Proof · {company.company}</small><p>{compactFact(company.outcome)}</p><ArrowUpRight size={12} aria-hidden="true" />
            </button>
          ) : evidence ? (
            <a href={evidence.source.url} target="_blank" rel="noreferrer"><small>Proof · {evidence.company}</small><p>{compactFact(evidence.outcome)}</p><ArrowUpRight size={12} aria-hidden="true" /></a>
          ) : (
            <div><small>Proof</small><p>Open the official pattern before adopting this choice.</p></div>
          )}
        </div>
        <details className="guide-disclosure">
          <summary><span>Exact 3D route</span><small>{family.title} → {mechanism.shortTitle}</small><ChevronDown size={13} aria-hidden="true" /></summary>
          <p aria-label="Active world state"><b>3D state</b> {family.title} · {strategy.label}<br /><b>Mechanism</b> {mechanism.title} · <b>Evidence</b> {evidence?.company ?? guide.evidenceId}</p>
        </details>
        <div className="guide-actions"><button type="button" disabled={guide.index === 0} onClick={() => navigateGuide(guide.index - 1)}><ChevronLeft size={14} /> Back</button><button type="button" disabled={atEnd} onClick={() => navigateGuide(guide.index + 1)}>Next <ChevronRight size={14} /></button></div>
      </section>

      <details className="journey-disclosure">
        <summary><span><strong>Compare with production</strong><small>{company ? company.company : "Reviewed evidence gap"}</small></span><ChevronDown size={14} aria-hidden="true" /></summary>
        <section className="evidence-compare" aria-label="Recommendation compared with production evidence">
          <div className="evidence-compare-grid">
            <article className="evidence-compare-card">
              <small>Recommended now</small><h3>{currentStep.title}</h3>
              <dl><div><dt>Pattern</dt><dd>{compactFact(currentStep.narration)}</dd></div><div><dt>Result</dt><dd>{compactFact(journey.tradeoff.benefit)}</dd></div><div><dt>Caveat</dt><dd>{compactFact(journey.tradeoff.cost)}</dd></div></dl>
            </article>
            {company ? (
              <button
                className="evidence-compare-card evidence-production-card"
                type="button"
                onClick={() => useAtlasStore.getState().selectEvidence(company.id)}
                aria-label={`Open ${company.company} production evidence for ${productionEvidence.alignedOn === "family" ? family.title : mechanism.title}`}
              >
                <small>{company.company} · {productionEvidence.alignedOn === "family" ? `discloses ${family.title}` : `matches ${mechanism.shortTitle}`}</small>
                <h3>{company.version === "Not disclosed" ? "Version not disclosed" : `Version ${company.version}`}<ArrowUpRight size={12} /></h3>
                <dl><div><dt>Pattern</dt><dd>{compactFact(company.implementation)}</dd></div><div><dt>Result</dt><dd>{compactFact(company.outcome)}</dd></div><div><dt>Caveat</dt><dd>{compactFact(company.tradeoff)}</dd></div></dl>
              </button>
            ) : (
              <article className="evidence-compare-card evidence-gap-card"><small>Evidence gap</small><h3>No exact production match</h3><p>{gap?.note ?? `No reviewed account in this corpus explicitly maps to ${mechanism.title}.`}</p>{gap && <a href={gap.officialPatternUrl} target="_blank" rel="noreferrer">Read official pattern <ArrowUpRight size={12} /></a>}</article>
            )}
          </div>
        </section>
      </details>

    </aside>
  );
}
