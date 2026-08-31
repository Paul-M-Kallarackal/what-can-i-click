import { ArrowUpRight, BookOpen, ChevronRight, Clock3, X } from "lucide-react";
import { evidenceById } from "../../data/evidence";
import { knowledgeById } from "../../data/knowledge";
import { TEMPO_LABEL } from "../../lib/tempo";
import { useAtlasStore } from "../../store/useAtlasStore";

export function Inspector() {
  const selectedNodeId = useAtlasStore((state) => state.selectedNodeId);
  const selectedEvidenceId = useAtlasStore((state) => state.selectedEvidenceId);
  const recommendation = useAtlasStore((state) => state.recommendation);
  const selectNode = useAtlasStore((state) => state.selectNode);
  const selectEvidence = useAtlasStore((state) => state.selectEvidence);
  const node = selectedNodeId ? knowledgeById(selectedNodeId) : undefined;
  const evidence = selectedEvidenceId ? evidenceById(selectedEvidenceId) : undefined;
  const open = Boolean(node || evidence);
  const close = () => { selectNode(null); selectEvidence(null); };
  const matchingDecision = node ? recommendation?.decisions.find((entry) => entry.nodeId === node.id) : undefined;

  return (
    <aside className="inspector-shell" aria-label="Atlas inspector" data-open={open} aria-hidden={!open} inert={!open ? true : undefined}>
      <div className="inspector t-panel-slide" data-open={open} aria-hidden={!open}>
        {open ? <button className="icon-button inspector-close" type="button" onClick={close} aria-label="Close inspector"><X size={18} /></button> : null}
        {node ? (
          <>
            <div className="inspector-head">
              <span className="eyebrow">{node.district}</span>
              <h2>{node.title}</h2>
              <p className="inspector-tagline">{node.tagline}</p>
              <span className="tempo"><Clock3 size={13} />{TEMPO_LABEL[node.motion.tempo]} tempo</span>
            </div>
            {matchingDecision ? (
              <section className="decision-callout">
                <span className="eyebrow">Agent chose this</span>
                <h3>{matchingDecision.title}</h3>
                <p>{matchingDecision.recommendation}</p>
                <small>{matchingDecision.confidence} confidence · validate against your workload</small>
              </section>
            ) : null}
            <section>
              <h3>What happens here</h3>
              <p>{node.explanation}</p>
            </section>
            <section className="motion-note">
              <span className="motion-critter" aria-hidden="true">{node.motion.critter === "roots" ? "⌁" : node.motion.critter === "leaves" ? "❧" : "◌"}</span>
              <div><h3>Read the motion</h3><p>{node.motion.metaphor}</p></div>
            </section>
            <section>
              <h3>Tradeoffs</h3>
              <div className="tradeoff-list">
                {node.tradeoffs.map((tradeoff, index) => (
                  <div className="tradeoff" key={index}>
                    <p><strong>Gain</strong>{tradeoff.benefit}</p>
                    <p><strong>Pay</strong>{tradeoff.cost}</p>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h3>Versioned claims</h3>
              <div className="claim-list">
                {node.claims.map((claim) => (
                  <a key={claim.id} href={claim.source.url} target="_blank" rel="noreferrer" className="claim-card">
                    <span>{claim.kind} · {claim.version}</span>
                    <p>{claim.text}</p>
                    <small>{claim.source.label}<ArrowUpRight size={12} /></small>
                  </a>
                ))}
              </div>
            </section>
            <section>
              <h3>Follow the roots</h3>
              <div className="related-list">
                {node.relatedNodeIds.map((id) => {
                  const related = knowledgeById(id);
                  return related ? <button type="button" key={id} onClick={() => selectNode(id)}><span>{related.shortTitle}</span><ChevronRight size={14} /></button> : null;
                })}
              </div>
            </section>
          </>
        ) : null}
        {evidence ? (
          <>
            <div className="inspector-head evidence-head">
              <span className="eyebrow"><BookOpen size={13} />Field note · {evidence.workload.replace("-", " ")}</span>
              <h2>{evidence.company}</h2>
              <p className="inspector-tagline">{evidence.provider} · version {evidence.version}</p>
            </div>
            <section><h3>Challenge</h3><p>{evidence.challenge}</p></section>
            <section><h3>Architecture move</h3><p>{evidence.approach}</p></section>
            <section className="decision-callout"><span className="eyebrow">Published outcome</span><p>{evidence.outcome}</p></section>
            <section>
              <h3>Related mechanisms</h3>
              <div className="related-list">
                {evidence.relatedNodeIds.map((id) => {
                  const related = knowledgeById(id);
                  return related ? <button type="button" key={id} onClick={() => selectNode(id)}><span>{related.title}</span><ChevronRight size={14} /></button> : null;
                })}
              </div>
            </section>
            <a className="source-button" href={evidence.source.url} target="_blank" rel="noreferrer">Open source <ArrowUpRight size={15} /></a>
            <p className="evidence-disclaimer">Field evidence corroborates a pattern. It does not override official guidance, and the ClickHouse version is never inferred from publication date.</p>
          </>
        ) : null}
      </div>
    </aside>
  );
}
