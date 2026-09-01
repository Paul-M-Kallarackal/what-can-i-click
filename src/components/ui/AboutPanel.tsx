import { ExternalLink, Github, X } from "lucide-react";
import { useAtlasStore } from "../../store/useAtlasStore";

export function AboutPanel() {
  const open = useAtlasStore((state) => state.aboutOpen);
  return (
    <aside className="about-shell t-panel-slide" data-open={open} aria-hidden={!open} aria-label="About What can I Click" inert={!open ? true : undefined}>
      <div className="about-panel">
        <button className="icon-button inspector-close" type="button" onClick={() => useAtlasStore.getState().setAboutOpen(false)} aria-label="Close about panel"><X size={16} /></button>
        <span className="eyebrow">See the gotcha. Avoid the outage.</span>
        <h2>See ClickHouse gotchas before production.</h2>
        <p className="about-intro">What can I Click turns ClickHouse’s easy-to-miss failure modes into interactive 3D mechanisms you can watch, trigger, and understand.</p>
        <div className="about-promises">
          <article><span>01</span><div><strong>Understand the gotcha</strong><p>Watch tiny inserts, runaway parts, expensive reads, bad ordering keys, stalled merges, mutations, and replica lag change the machine.</p></div></article>
          <article><span>02</span><div><strong>Avoid it for your workload</strong><p>WebMCP lets your agent highlight the relevant mechanisms, recommend a safer pattern, explain the tradeoffs, and show what to validate.</p></div></article>
        </div>
        <p className="about-safety"><strong>Safe by design.</strong> No SQL execution, cluster credentials, private data, external 3D assets, or user-provided code.</p>
        <div className="about-links"><a href="https://github.com/Paul-M-Kallarackal/what-can-i-click" target="_blank" rel="noreferrer"><Github size={13} />Source</a><a href="https://clickhouse.com/docs" target="_blank" rel="noreferrer">ClickHouse docs<ExternalLink size={12} /></a></div>
        <div className="trademark-note"><img src="/clickhouse-mark.svg" alt="ClickHouse logomark" /><p>ClickHouse and its logo are trademarks of ClickHouse, Inc. This independent educational project is not endorsed by or affiliated with ClickHouse, Inc.</p></div>
      </div>
    </aside>
  );
}
