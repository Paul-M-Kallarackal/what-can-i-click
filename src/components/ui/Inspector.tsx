import { ArrowUpRight, ChevronDown, ExternalLink, Focus, GitCompareArrows, Maximize2, Minimize2, Play, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import {
  architectureRecipeRoleLabel,
  companyArchitectureRecipeById,
  declaredRecipeReadStrategy,
  type CompanyArchitectureRecipe,
} from "../../data/companyArchitectureRecipes";
import {
  COMPANY_IMPLEMENTATIONS,
  companyImplementationById,
  type CompanyImplementation,
} from "../../data/companyImplementations";
import { COMPANY_EVIDENCE } from "../../data/evidence";
import { operationalScenarioById } from "../../data/operationalScenarios";
import {
  recommendImplementationPeer,
  type ImplementationPeerMatch,
} from "../../data/implementationComparison";
import { MECHANISMS, mechanismById } from "../../data/mechanisms";
import { useAtlasStore } from "../../store/useAtlasStore";
import type { MechanismId, MergeFamilyId, WorkloadProfile } from "../../types";

function firstSentence(value: string, maxLength = 132) {
  const sentence = value.split(/(?<=[.!?])\s+/)[0] ?? value;
  return sentence.length <= maxLength ? sentence : `${sentence.slice(0, maxLength - 1).trimEnd()}…`;
}

function InspectorGlance({
  meaning,
  tradeoff,
  proof,
}: {
  meaning: string;
  tradeoff: string;
  proof: { label: string; text: string; url: string };
}) {
  return (
    <section className="inspector-glance" aria-label="At a glance">
      <div><span>Meaning</span><p>{firstSentence(meaning)}</p></div>
      <div><span>Tradeoff</span><p>{firstSentence(tradeoff)}</p></div>
      <a href={proof.url} target="_blank" rel="noreferrer">
        <span>Proof · {proof.label}</span>
        <p>{firstSentence(proof.text)}</p>
        <ExternalLink size={11} aria-hidden="true" />
      </a>
    </section>
  );
}

function MechanismInspector({ id }: { id: MechanismId }) {
  const mechanism = mechanismById(id)!;
  const viewLevel = useAtlasStore((state) => state.viewLevel);
  const comparison = useAtlasStore((state) => state.comparisonIds);
  const paired = comparison?.map((entry) => mechanismById(entry)!) ?? null;
  const recommendation = useAtlasStore((state) => state.recommendation);
  const scenarioId = useAtlasStore((state) => state.scenario);
  const scenario = operationalScenarioById(scenarioId);
  const scenarioOwnsMechanism = scenarioId !== "healthy" && scenario.primaryMechanismId === id;
  const decision = recommendation?.decisions.find((entry) => entry.mechanismId === id);
  const primaryTradeoff = mechanism.tradeoffs[0];
  const primaryClaim = mechanism.claims[0];
  return (
    <>
      <header className="inspector-head">
        <span className="eyebrow">{mechanism.districtId} / {viewLevel === "xray" ? "analogy cutaway" : viewLevel}</span>
        <h2>{mechanism.title}</h2>
        <p className="inspector-tagline">{mechanism.tagline}</p>
        <div className="inspector-meta"><span className="tempo">{mechanism.tempo}</span><span>{mechanism.states.length} semantic states</span></div>
      </header>
      {decision && !scenarioOwnsMechanism && <section className="decision-callout"><span className="eyebrow">Agent chose this</span><h3>{decision.title}</h3><p>{decision.recommendation}</p><small>{decision.confidence} confidence · {decision.evidenceIds.length} sources</small></section>}
      {scenarioOwnsMechanism && <section className="scenario-recommendation" data-personalized={Boolean(decision)}>
        <span>{decision ? "For your workload" : "How to avoid this"}</span>
        <h3>{decision?.title ?? scenario.title}</h3>
        <p>{decision?.recommendation ?? scenario.lesson}</p>
        {decision && <small>{decision.confidence} confidence · {decision.evidenceIds.length} reviewed sources</small>}
      </section>}
      <InspectorGlance
        meaning={mechanism.explanation}
        tradeoff={primaryTradeoff.cost}
        proof={{ label: primaryClaim.source.label, text: primaryClaim.text, url: primaryClaim.source.url }}
      />
      {id === "mergetree.part-anatomy" && <div className="inspector-actions">
        <button type="button" data-active={viewLevel === "xray"} onClick={() => viewLevel === "xray" ? useAtlasStore.getState().setViewLevel("mechanism") : useAtlasStore.getState().openXray()}><Focus size={14} />{viewLevel === "xray" ? "Return to foundry" : "Open part X-ray"}</button>
      </div>}
      <details className="inspector-disclosure">
        <summary><span><strong>How it works</strong><small>{mechanism.states.length} visual states and the common misconception</small></span><ChevronDown size={14} aria-hidden="true" /></summary>
        <div className="inspector-disclosure-body">
          <div className="state-sequence">
            {mechanism.states.map((state, index) => <div key={state}><i>{index + 1}</i><span>{state}</span>{index < mechanism.states.length - 1 && <ArrowUpRight size={12} />}</div>)}
          </div>
          <p>{mechanism.explanation}</p>
          <div className="misconception"><h3>Do not model it as</h3><p>{mechanism.misconception}</p></div>
        </div>
      </details>
      {mechanism.tradeoffs.length > 1 && <details className="inspector-disclosure"><summary><span><strong>More tradeoffs</strong><small>{mechanism.tradeoffs.length - 1} additional considerations</small></span><ChevronDown size={14} aria-hidden="true" /></summary><div className="inspector-disclosure-body"><div className="tradeoff-list">{mechanism.tradeoffs.slice(1).map((tradeoff) => <div className="tradeoff" key={tradeoff.benefit}><p><strong>Gain</strong>{tradeoff.benefit}</p><p><strong>Spend</strong>{tradeoff.cost}</p></div>)}</div></div></details>}
      {mechanism.claims.length > 1 && <details className="inspector-disclosure"><summary><span><strong>More evidence</strong><small>{mechanism.claims.length - 1} additional reviewed sources</small></span><ChevronDown size={14} aria-hidden="true" /></summary><div className="inspector-disclosure-body"><div className="claim-list">{mechanism.claims.slice(1).map((claim) => <a className="claim-card" key={claim.id} href={claim.source.url} target="_blank" rel="noreferrer"><span>{claim.kind} · {claim.version}</span><p>{claim.text}</p><small>{claim.source.label}<ExternalLink size={10} /></small></a>)}</div></div></details>}
      <section>
        <h3>Compare mechanisms</h3>
        <label className="compare-select"><GitCompareArrows size={14} /><select defaultValue="" onChange={(event) => { const other = event.target.value as MechanismId; if (other) useAtlasStore.getState().setComparison(id, other); }}><option value="" disabled>Choose a second mechanism</option>{MECHANISMS.filter((entry) => entry.id !== id).map((entry) => <option value={entry.id} key={entry.id}>{entry.title}</option>)}</select><ChevronDown size={13} /></label>
        {paired && <div className="comparison-grid">{paired.map((entry) => <article key={entry.id}><small>{entry.tempo}</small><strong>{entry.shortTitle}</strong><p>{entry.tagline}</p><ol>{entry.states.map((state) => <li key={state}>{state}</li>)}</ol></article>)}</div>}
      </section>
      <details className="inspector-disclosure"><summary><span><strong>Related mechanisms</strong><small>{mechanism.relatedMechanismIds.length} ways to continue</small></span><ChevronDown size={14} aria-hidden="true" /></summary><div className="inspector-disclosure-body"><div className="related-list">{mechanism.relatedMechanismIds.map((relatedId) => { const related = mechanismById(relatedId)!; return <button type="button" key={relatedId} onClick={() => useAtlasStore.getState().selectMechanism(relatedId)}><span>{related.title}</span><ArrowUpRight size={12} /></button>; })}</div></div></details>
    </>
  );
}

const workloadLabels: Record<WorkloadProfile["workload"], string> = {
  observability: "observability",
  "product-analytics": "product analytics",
  cdc: "CDC",
  iot: "IoT",
  financial: "financial analytics",
  general: "general analytics",
};

const mergeFamilyLabels: Record<MergeFamilyId, string> = {
  merge: "MergeTree",
  replacing: "ReplacingMergeTree",
  summing: "SummingMergeTree",
  aggregating: "AggregatingMergeTree",
  collapsing: "CollapsingMergeTree",
  "versioned-collapsing": "VersionedCollapsingMergeTree",
  coalescing: "CoalescingMergeTree",
};

function recommendationReason(match: ImplementationPeerMatch) {
  const familyId = match.sharedFamilyIds[0];
  if (familyId) return `Shared named family · ${mergeFamilyLabels[familyId]}`;
  const mechanism = match.sharedMechanisms[0];
  if (mechanism) return `Shared mechanism · ${mechanism}`;
  return `Same ${workloadLabels[match.implementation.workload]} workload`;
}

function ImplementationComparisonCard({
  implementation,
  position,
}: {
  implementation: CompanyImplementation;
  position: "Current account" | "Peer account";
}) {
  const facts = [
    ["Pattern", firstSentence(implementation.implementation, 124)],
    ["Published scale", firstSentence(implementation.scale[0], 124)],
    ["Result", firstSentence(implementation.outcome, 124)],
    ["Tradeoff", firstSentence(implementation.tradeoff, 124)],
  ] as const;

  return (
    <article className="implementation-comparison-card" aria-label={`${implementation.company} ${position.toLowerCase()}`}>
      <header>
        <span>{position}</span>
        <h4>{implementation.company}</h4>
      </header>
      <dl>
        {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <a href={implementation.source.url} target="_blank" rel="noreferrer" aria-label={`Open ${implementation.company} primary source`}>
        Primary source
        <ExternalLink size={11} aria-hidden="true" />
      </a>
    </article>
  );
}

function CompanyArchitectureRecipePanel({ recipe }: { recipe: CompanyArchitectureRecipe }) {
  const familyNames = recipe.mergeFamilyIds.map((familyId) => mergeFamilyLabels[familyId]);
  const playRecipe = () => {
    const store = useAtlasStore.getState();
    const family = recipe.mergeFamilyIds[0];
    if (family) store.setMergeFamily(family);
    store.setLatestReadStrategy(declaredRecipeReadStrategy(recipe));
    store.playStory("architecture", recipe.mechanismPath);
  };
  return (
    <section className="company-recipe" aria-label={`${recipe.company} ClickHouse architecture recipe`}>
      <header className="company-recipe__head">
        <div>
          <span className="eyebrow">Declared architecture</span>
          <h3>How the pieces work together</h3>
        </div>
        {recipe.mechanismPath.length > 0 && (
          <button type="button" onClick={playRecipe}>
            <Play size={16} aria-hidden="true" />
            Play architecture
          </button>
        )}
      </header>

      {familyNames.length > 0 && (
        <div className="company-recipe__families" aria-label="Explicitly named MergeTree families">
          <span>Engine families</span>
          {familyNames.map((familyName) => <strong key={familyName}>{familyName}</strong>)}
        </div>
      )}

      {recipe.steps.length > 0 ? (
        <ol className="company-recipe__path">
          {recipe.steps.map((step, index) => (
            <li key={step.id}>
              <button type="button" onClick={() => useAtlasStore.getState().selectMechanism(step.mechanismId)}>
                <i>{index + 1}</i>
                <span><small>{architectureRecipeRoleLabel(step.role)}</small><strong>{step.label}</strong><em>{step.rationale}</em></span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="company-recipe__gap">The source names the stack below, but does not disclose enough detail to map it to an internal foundry path without guessing.</p>
      )}

      <div className="company-recipe__declared">
        <span>Source-declared stack</span>
        <div>{recipe.declaredItems.map((item) => <b key={item}>{item}</b>)}</div>
      </div>
    </section>
  );
}

function CompanyImplementationInspector({ implementation }: { implementation: CompanyImplementation }) {
  const selectId = useId();
  const recipe = companyArchitectureRecipeById(implementation.id)!;
  const comparisonId = useAtlasStore((state) => state.evidenceComparisonId);
  const recommendation = recommendImplementationPeer(implementation);
  const peer = comparisonId && comparisonId !== implementation.id
    ? companyImplementationById(comparisonId) ?? null
    : null;
  const options = COMPANY_IMPLEMENTATIONS
    .filter((entry) => entry.id !== implementation.id)
    .sort((left, right) => left.company.localeCompare(right.company));
  const version = implementation.version === "Not disclosed"
    ? "Version not disclosed"
    : `Version ${implementation.version}`;
  const activate = (peerId: string) => useAtlasStore.getState().setEvidenceComparison(peerId || null);

  return (
    <>
      <header className="inspector-head evidence-head">
        <span className="eyebrow">Production implementation</span>
        <h2>{implementation.company}</h2>
        <p className="inspector-tagline">{implementation.challenge}</p>
        <div className="inspector-meta"><span className="tempo">{implementation.workload}</span><span>{version}</span></div>
      </header>
      <CompanyArchitectureRecipePanel recipe={recipe} />
      {!peer && (
        <>
          <section className="evidence-glance" aria-label="Production implementation at a glance">
            <div><span>Pattern</span><p>{firstSentence(implementation.implementation)}</p></div>
            <div><span>Result</span><p>{firstSentence(implementation.outcome)}</p></div>
            <div><span>Caveat</span><p>{firstSentence(implementation.tradeoff)}</p></div>
          </section>
          <a className="source-button" href={implementation.source.url} target="_blank" rel="noreferrer">Open primary source<ExternalLink size={12} /></a>
        </>
      )}
      <section className="implementation-compare" aria-labelledby={`${selectId}-heading`} data-active={Boolean(peer)}>
        <div className="implementation-compare__heading">
          <h3 id={`${selectId}-heading`}>Compare production accounts</h3>
          <p>Four published signals, side by side.</p>
        </div>
        {recommendation && (
          <button
            className="implementation-compare__recommendation"
            type="button"
            data-active={peer?.id === recommendation.implementation.id}
            onClick={() => activate(recommendation.implementation.id)}
          >
            <span><small>Recommended peer</small><strong>{recommendation.implementation.company}</strong><em>{recommendationReason(recommendation)}</em></span>
            <b>{peer?.id === recommendation.implementation.id ? "Comparing" : "Compare"}</b>
          </button>
        )}
        <label className="implementation-compare__label" htmlFor={`${selectId}-peer`}>Choose another account</label>
        <div className="implementation-compare__select">
          <select id={`${selectId}-peer`} value={peer?.id ?? ""} onChange={(event) => activate(event.target.value)}>
            <option value="">Select an account</option>
            {options.map((entry) => <option value={entry.id} key={entry.id}>{entry.company}</option>)}
          </select>
          <ChevronDown size={13} aria-hidden="true" />
        </div>
        <p className="sr-only" aria-live="polite">{peer ? `Comparing ${implementation.company} with ${peer.company}.` : ""}</p>
        {peer && (
          <div className="implementation-comparison-grid" aria-label={`${implementation.company} and ${peer.company} production comparison`}>
            <ImplementationComparisonCard implementation={implementation} position="Current account" />
            <ImplementationComparisonCard implementation={peer} position="Peer account" />
          </div>
        )}
      </section>
      <details className="inspector-disclosure"><summary><span><strong>Implementation detail</strong><small>{implementation.scale.length} published scale signals</small></span><ChevronDown size={14} aria-hidden="true" /></summary><div className="inspector-disclosure-body"><h3>What they built</h3><p>{implementation.implementation}</p><h3>Observed outcome</h3><p>{implementation.outcome}</p><div className="claim-list">{implementation.scale.slice(0, 3).map((signal) => <div className="claim-card" key={signal}><span>Published scale</span><p>{signal}</p></div>)}</div><p className="evidence-disclaimer">Published implementation details describe this team's context. Version is shown only when the source names it.</p></div></details>
    </>
  );
}

function EvidenceInspector({ id }: { id: string }) {
  const evidence = COMPANY_EVIDENCE.find((entry) => entry.id === id);
  if (evidence) {
    return (
      <>
        <header className="inspector-head evidence-head"><span className="eyebrow">Field evidence · {evidence.workload}</span><h2>{evidence.company}</h2><p className="inspector-tagline">{evidence.challenge}</p></header>
        <section className="evidence-glance" aria-label="Published account at a glance">
          <div><span>Pattern</span><p>{firstSentence(evidence.approach)}</p></div>
          <div><span>Result</span><p>{firstSentence(evidence.outcome)}</p></div>
          <div><span>Caveat</span><p>One team’s context; validate the same pattern against your workload.</p></div>
        </section>
        <a className="source-button" href={evidence.source.url} target="_blank" rel="noreferrer">Open reviewed source<ExternalLink size={12} /></a>
        <details className="inspector-disclosure"><summary><span><strong>Full published account</strong><small>{evidence.version}</small></span><ChevronDown size={14} aria-hidden="true" /></summary><div className="inspector-disclosure-body"><h3>Approach</h3><p>{evidence.approach}</p><h3>Outcome</h3><p>{evidence.outcome}</p><p className="evidence-disclaimer">Field evidence illustrates one team's context. It does not replace workload-specific validation.</p></div></details>
      </>
    );
  }

  const implementation = companyImplementationById(id);
  if (!implementation) return null;
  return <CompanyImplementationInspector implementation={implementation} />;
}

export function Inspector() {
  const selected = useAtlasStore((state) => state.selectedMechanismId);
  const selectedEvidence = useAtlasStore((state) => state.selectedEvidenceId);
  const snap = useAtlasStore((state) => state.inspectorSnap);
  const open = Boolean(selected || selectedEvidence);
  const companyModal = Boolean(selectedEvidence && companyImplementationById(selectedEvidence));
  const shellRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open || !companyModal || !shellRef.current) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const shell = shellRef.current;
    const focusableSelector = "button:not([disabled]), a[href], select, summary, [tabindex]:not([tabindex='-1'])";
    const focusClose = requestAnimationFrame(() => shell.querySelector<HTMLElement>(".inspector-close")?.focus());
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = [...shell.querySelectorAll<HTMLElement>(focusableSelector)].filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trapFocus);
    return () => {
      cancelAnimationFrame(focusClose);
      document.removeEventListener("keydown", trapFocus);
      previousFocus?.focus();
    };
  }, [companyModal, open, selectedEvidence]);

  return (
    <>
      {companyModal && open && <div className="inspector-backdrop" aria-hidden="true" onClick={() => useAtlasStore.getState().showSystem()} />}
      <aside
        ref={shellRef}
        className="inspector-shell t-panel-slide"
        data-kind={companyModal ? "company" : "mechanism"}
        data-open={open}
        data-snap={snap}
        role={companyModal ? "dialog" : undefined}
        aria-modal={companyModal || undefined}
        aria-label={companyModal ? "Company architecture" : "ClickHouse mechanism inspector"}
        aria-hidden={!open}
        inert={!open ? true : undefined}
      >
        <div className="inspector-grabber" aria-hidden="true" />
        {!companyModal && <button className="icon-button inspector-snap" type="button" onClick={() => useAtlasStore.getState().setInspectorSnap(snap === "peek" ? "full" : "peek")} aria-label={snap === "peek" ? "Expand inspector" : "Collapse inspector"}>{snap === "peek" ? <Maximize2 size={15} /> : <Minimize2 size={15} />}</button>}
        <button className="icon-button inspector-close" type="button" onClick={() => useAtlasStore.getState().showSystem()} aria-label={companyModal ? "Close company architecture" : "Close inspector"}><X size={18} /></button>
        <div className="inspector">{selected ? <MechanismInspector id={selected} /> : selectedEvidence ? <EvidenceInspector id={selectedEvidence} /> : null}</div>
      </aside>
    </>
  );
}
