import { ArrowLeft, ArrowUpRight, CheckCircle2, TriangleAlert } from "lucide-react";
import { LATEST_READ_STRATEGIES, mergeFamilyById } from "../../data/mergeFamilies";
import { operationalScenarioById } from "../../data/operationalScenarios";
import { useAtlasStore } from "../../store/useAtlasStore";
import { TidbitCard } from "./TidbitCard";

export function MergeFamilyNavigator() {
  const selectedId = useAtlasStore((state) => state.mergeFamilyId);
  const latestReadStrategy = useAtlasStore((state) => state.latestReadStrategy);
  const latestReadComparison = useAtlasStore((state) => state.latestReadComparison);
  const selectedTidbitId = useAtlasStore((state) => state.selectedTidbitId);
  const scenarioId = useAtlasStore((state) => state.scenario);
  const family = mergeFamilyById(selectedId);
  const strategy = LATEST_READ_STRATEGIES.find((candidate) => candidate.id === latestReadStrategy)!;
  const comparisonMethods = LATEST_READ_STRATEGIES.filter((candidate) => candidate.id === "argmax" || candidate.id === "final");
  const scenario = operationalScenarioById(scenarioId);
  const healthy = scenarioId === "healthy";
  const agentSelected = selectedId !== "merge";

  const returnToMergeTree = () => {
    const store = useAtlasStore.getState();
    store.stopJourney();
    store.setLatestReadStrategy("background");
    store.setMergeFamily("merge");
  };

  return (
    <aside
      className="family-workbench"
      data-single-family="true"
      data-agent-selected={agentSelected}
      aria-label={`${family.title} workbench`}
    >
      <header>
        <span className="eyebrow">{latestReadComparison ? "Agent-requested method comparison" : agentSelected ? "Agent-selected table engine" : "Core table engine"}</span>
        <div className="merge-title-row"><h1>{family.title}</h1><span>{latestReadComparison ? "argMax vs FINAL" : family.shortTitle}</span></div>
        <p>{agentSelected ? family.behavior : "Each white cassette is one immutable data part: sorted column files, marks, and metadata. A merge reads A + B and writes a new Part C."}</p>
      </header>
      <div className="family-context">
        {selectedTidbitId ? <TidbitCard /> : (
          agentSelected ? (
            <article className="family-agent-card" style={{ "--family-accent": family.accent } as React.CSSProperties}>
              {!latestReadComparison && (
                <div className="family-agent-card__decision">
                  <section>
                    <span>Use it when</span>
                    <p>{family.useWhen}</p>
                  </section>
                  <section data-tone="warning">
                    <span>Watch for</span>
                    <p>{family.caution}</p>
                  </section>
                </div>
              )}
              {selectedId === "replacing" && latestReadComparison ? (
                <section className="family-agent-comparison" aria-label="argMax versus SELECT FINAL comparison">
                  <header><span>Same candidate rows</span><strong>Two correctness contracts</strong></header>
                  <div>
                    {comparisonMethods.map((method) => (
                      <article key={method.id} data-method={method.id}>
                        <span>{method.label}</span>
                        <strong>{method.summary}</strong>
                        <p>{method.chooseWhen}</p>
                        <small>{method.tradeoff}</small>
                      </article>
                    ))}
                  </div>
                </section>
              ) : selectedId === "summing" ? (
                <section className="family-agent-card__strategy" aria-label="SummingMergeTree exact-read contract">
                  <header><span>Exact read contract</span><strong>Aggregate every visible row</strong></header>
                  <p>Background merges may store a partial sum while newer rows with the same sorting key remain in other parts.</p>
                  <small>Use the appropriate SUM and GROUP BY at read time. Keep raw detail in a separate MergeTree table when the rollup must not discard it.</small>
                </section>
              ) : selectedId === "aggregating" ? (
                <section className="family-agent-card__strategy" aria-label="AggregatingMergeTree state contract">
                  <header><span>State contract</span><strong>Write -State · read matching -Merge</strong></header>
                  <p>AggregateFunction columns retain mergeable internals such as an average’s sum and count; background merges combine those states without prematurely finalizing them.</p>
                  <small>Use the matching -Merge aggregate with GROUP BY to return a scalar. SimpleAggregateFunction is a separate scalar-storage contract.</small>
                </section>
              ) : selectedId === "collapsing" ? (
                <section className="family-agent-card__strategy" aria-label="CollapsingMergeTree exact-read contract">
                  <header><span>Exact read contract</span><strong>Account for Sign before merges converge</strong></header>
                  <p>The producer must emit an exact cancel copy of the old state before its replacement. Until a background merge collapses that pair, all three rows remain visible.</p>
                  <small>Use sign-aware aggregation with GROUP BY and HAVING for metrics. Reserve FINAL for bounded row extraction; broad FINAL reads do extra query-time work.</small>
                </section>
              ) : selectedId === "versioned-collapsing" ? (
                <section className="family-agent-card__strategy" aria-label="VersionedCollapsingMergeTree version contract">
                  <header><span>Pairing contract</span><strong>Same key · same version · opposite Sign</strong></header>
                  <p>Rows may arrive out of order, but a cancel row removes only the state carrying its exact version. A mismatched cancel cannot remove a newer state.</p>
                  <small>Exact metric reads remain sign-aware and group by key plus version before merges converge. Broad FINAL remains an expensive row-extraction path.</small>
                </section>
              ) : (selectedId === "replacing" || latestReadStrategy !== "background") && (
                <section className="family-agent-card__strategy" aria-label="Selected latest-state read method">
                  <header><span>Read latest state</span><strong>{strategy.label}</strong></header>
                  <p>{strategy.summary}</p>
                  <small>{strategy.tradeoff}</small>
                </section>
              )}
              <footer>
                <button type="button" onClick={returnToMergeTree}><ArrowLeft size={15} />Back to MergeTree</button>
                <a href={family.source} target="_blank" rel="noreferrer" aria-label={`Read the official ${family.title} documentation`}>Official docs <ArrowUpRight size={14} /></a>
              </footer>
            </article>
          ) : (
            <article className="merge-scenario-card" data-pressure={!healthy}>
              <header><span>{healthy ? <CheckCircle2 size={18} /> : <TriangleAlert size={18} />}<small>Current scenario</small></span><strong>{scenario.title}</strong></header>
              <p>{scenario.description}</p>
              {!healthy && <div className="merge-scenario-advice"><span>Avoid it</span><p>{scenario.lesson}</p></div>}
              <footer><span>{scenario.setting}</span><strong>{scenario.settingValue}</strong><a href={family.source} target="_blank" rel="noreferrer" aria-label="Read the official MergeTree documentation">Official docs <ArrowUpRight size={14} /></a></footer>
            </article>
          )
        )}
      </div>
    </aside>
  );
}
