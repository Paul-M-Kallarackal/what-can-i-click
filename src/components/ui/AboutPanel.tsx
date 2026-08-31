import { ArrowUpRight, X } from "lucide-react";
import { useAtlasStore } from "../../store/useAtlasStore";

export function AboutPanel() {
  const open = useAtlasStore((state) => state.aboutOpen);
  const setOpen = useAtlasStore((state) => state.setAboutOpen);
  return (
    <section className="about-shell" data-open={open} aria-label="About this atlas" aria-hidden={!open} inert={!open ? true : undefined}>
      <div className="about-panel t-panel-slide" data-open={open} aria-hidden={!open}>
        <button type="button" className="icon-button inspector-close" onClick={() => setOpen(false)} aria-label="Close about panel"><X size={18} /></button>
        <span className="eyebrow">Model, not emulator</span>
        <h2>A memorable map of the important decisions.</h2>
        <p>What can I Click turns six ClickHouse mechanisms into a living systems atlas. The motion explains relative behavior; it does not claim to reproduce database timing.</p>
        <p>Recommendations are deterministic and scoped to ClickHouse 26.3 LTS. Official guidance outranks field stories, and every claim exposes its source.</p>
        <div className="about-links">
          <a href="https://clickhouse.com/docs" target="_blank" rel="noreferrer">ClickHouse docs <ArrowUpRight size={13} /></a>
          <a href="https://github.com/ClickHouse/agent-skills" target="_blank" rel="noreferrer">Agent best practices <ArrowUpRight size={13} /></a>
        </div>
        <div className="trademark-note">
          <img src="/clickhouse-mark.svg" alt="ClickHouse" />
          <p>ClickHouse and its logo are trademarks of ClickHouse, Inc. This independent educational project is not endorsed by ClickHouse.</p>
        </div>
      </div>
    </section>
  );
}
