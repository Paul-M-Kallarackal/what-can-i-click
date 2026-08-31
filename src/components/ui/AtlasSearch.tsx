import { BookOpen, Search, Trees, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { searchEvidence } from "../../data/evidence";
import { searchKnowledge } from "../../data/knowledge";
import { useAtlasStore } from "../../store/useAtlasStore";

export function AtlasSearch() {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const open = useAtlasStore((state) => state.searchOpen);
  const setOpen = useAtlasStore((state) => state.setSearchOpen);
  const selectNode = useAtlasStore((state) => state.selectNode);
  const selectEvidence = useAtlasStore((state) => state.selectEvidence);
  const nodes = useMemo(() => searchKnowledge(query).slice(0, 6), [query]);
  const evidence = useMemo(() => searchEvidence(query).slice(0, 5), [query]);

  return (
    <div className="atlas-search" data-open={open}>
      <Search size={16} aria-hidden="true" />
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => { setQuery(event.target.value.slice(0, 80)); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
        }}
        placeholder="Search parts, TTL, Kafka, Cloudflare…"
        aria-label="Search the ClickHouse atlas"
        aria-expanded={open}
        aria-controls="atlas-search-results"
      />
      {query ? (
        <button className="clear-search" type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} aria-label="Clear search"><X size={15} /></button>
      ) : <kbd>⌘ K</kbd>}
      <div className="search-results t-panel-slide" id="atlas-search-results" data-open={open} aria-hidden={!open} inert={!open ? true : undefined}>
        <div className="search-result-group">
          <span className="result-heading"><Trees size={13} />Mechanisms</span>
          {nodes.map((node) => (
            <button key={node.id} type="button" onClick={() => selectNode(node.id)}>
              <span>{node.shortTitle}</span><small>{node.tagline}</small>
            </button>
          ))}
        </div>
        <div className="search-result-group evidence-results">
          <span className="result-heading"><BookOpen size={13} />Field notes</span>
          {evidence.map((entry) => (
            <button key={entry.id} type="button" onClick={() => selectEvidence(entry.id)}>
              <span>{entry.company}</span><small>{entry.workload.replace("-", " ")}</small>
            </button>
          ))}
        </div>
        {nodes.length + evidence.length === 0 ? <p className="empty-search">No reviewed mechanism or field note matches “{query}”.</p> : null}
      </div>
    </div>
  );
}
