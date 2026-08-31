import { ChevronRight, X } from "lucide-react";
import { KNOWLEDGE_NODES } from "../../data/knowledge";
import { useAtlasStore } from "../../store/useAtlasStore";

export function AccessibleWorld() {
  const open = useAtlasStore((state) => state.worldInWordsOpen);
  const setOpen = useAtlasStore((state) => state.setWorldInWordsOpen);
  const selectNode = useAtlasStore((state) => state.selectNode);
  return (
    <section className="world-words-shell" data-open={open} aria-label="World in words" aria-hidden={!open} inert={!open ? true : undefined}>
      <div className="world-words t-panel-slide" data-open={open} aria-hidden={!open}>
        <button type="button" className="icon-button inspector-close" onClick={() => setOpen(false)} aria-label="Close world in words"><X size={18} /></button>
        <span className="eyebrow">Accessible atlas</span>
        <h2>The garden in words</h2>
        <p>Every visible mechanism is available here without the 3D canvas.</p>
        <div className="word-list">
          {KNOWLEDGE_NODES.map((node) => (
            <button key={node.id} type="button" onClick={() => { selectNode(node.id); setOpen(false); }}>
              <span><small>{node.district}</small><strong>{node.title}</strong><p>{node.tagline}</p></span><ChevronRight size={16} />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
