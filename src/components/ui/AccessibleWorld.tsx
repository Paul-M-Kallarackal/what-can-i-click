import { ArrowRight, X } from "lucide-react";
import { DISTRICTS, MECHANISMS, mechanismById } from "../../data/mechanisms";
import { useAtlasStore } from "../../store/useAtlasStore";

export function AccessibleWorld() {
  const open = useAtlasStore((state) => state.worldInWordsOpen);
  return (
    <aside className="world-words-shell t-panel-slide" data-open={open} aria-hidden={!open} aria-label="World in words" inert={!open ? true : undefined}>
      <div className="world-words">
        <button className="icon-button inspector-close" type="button" onClick={() => useAtlasStore.getState().setWorldInWordsOpen(false)} aria-label="Close world in words"><X size={16} /></button>
        <span className="eyebrow">Accessible system map</span>
        <h2>The foundry in words</h2>
        <p>Seven MergeTree family machines connect to {MECHANISMS.length} ClickHouse mechanisms across {DISTRICTS.length} districts. Every item below focuses the same scene, inspector, evidence, and WebMCP address used by the 3D world.</p>
        <div className="word-districts">{DISTRICTS.map((district) => <section key={district.id}><header><i>{String(district.index).padStart(2, "0")}</i><span><strong>{district.title}</strong><small>{district.description}</small></span></header><div className="word-list">{district.mechanismIds.map((id) => { const mechanism = mechanismById(id)!; return <button type="button" key={id} onClick={() => { useAtlasStore.getState().selectMechanism(id); useAtlasStore.getState().setWorldInWordsOpen(false); }}><span><small>{mechanism.tempo}</small><strong>{mechanism.title}</strong><p>{mechanism.tagline}</p></span><ArrowRight size={14} /></button>; })}</div></section>)}</div>
      </div>
    </aside>
  );
}
