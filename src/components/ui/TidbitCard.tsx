import { ArrowUpRight, MousePointerClick, X } from "lucide-react";
import { mergeFamilyById } from "../../data/mergeFamilies";
import { useAtlasStore } from "../../store/useAtlasStore";

function splitTidbit(value: string) {
  const match = value.match(/^(.+?[.!?])(?:\s+(.+))?$/);
  return { lead: match?.[1] ?? value, rest: match?.[2] ?? "" };
}

/** Visual notes stay inside the workbench so they never cover the tree. */
export function TidbitCard() {
  const familyId = useAtlasStore((state) => state.mergeFamilyId);
  const selectedTidbitId = useAtlasStore((state) => state.selectedTidbitId);
  const family = mergeFamilyById(familyId);
  const tidbit = family.tidbits.find((entry) => entry.id === selectedTidbitId);
  if (!tidbit) return null;
  const copy = splitTidbit(tidbit.body);

  return (
    <section
      className="tidbit-card"
      aria-label={`${family.title} selected visual note`}
      aria-live="polite"
      aria-atomic="true"
      data-integrated="true"
      style={{ "--family-accent": family.accent } as React.CSSProperties}
    >
      <button type="button" className="tidbit-close" onClick={() => useAtlasStore.getState().selectTidbit(null)} aria-label="Close visual note"><X size={20} strokeWidth={2.25} /></button>
      <span className="eyebrow"><MousePointerClick size={12} /> {family.title} · visual note</span>
      <h2>{tidbit.title}</h2>
      <p>{copy.lead}</p>
      {copy.rest && <details className="tidbit-more"><summary>One caveat</summary><p>{copy.rest}</p></details>}
      <a href={family.source} target="_blank" rel="noreferrer">Proof in the docs <ArrowUpRight size={12} /></a>
    </section>
  );
}
