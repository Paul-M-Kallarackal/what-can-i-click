import { ArrowUpRight, Check, ChevronDown, CircleAlert, Pause, Play, RotateCcw, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GOTCHA_STORIES, gotchaBeatById, gotchaStoryById } from "../../data/gotchas";
import { mechanismById } from "../../data/mechanisms";
import { useAtlasStore } from "../../store/useAtlasStore";
import type { GotchaId } from "../../types";

const beatLabels = ["Cause", "Impact", "Avoid", "Verify"] as const;

function GotchaGlyph({ id }: { id: GotchaId }) {
  return <span className="gotcha-glyph" data-gotcha={id} aria-hidden="true"><i /><i /><i /><i /></span>;
}

export function WebMcpStatus() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(() => readWebMcpStatus());
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setStatus(readWebMcpStatus());
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-webmcp", "data-webmcp-count"] });
    sync();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event: KeyboardEvent | MouseEvent) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent && root.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", close);
    return () => { window.removeEventListener("keydown", close); window.removeEventListener("pointerdown", close); };
  }, [open]);

  return <div className="agent-status-wrap" ref={root}>
    <button className="agent-status" type="button" data-tone={status.tone} aria-expanded={open} aria-controls="agent-status-popover" onClick={() => setOpen((value) => !value)}>
      <i aria-hidden="true" />
      <span className="agent-status__wide">{status.label}</span>
      <span className="agent-status__compact">{status.shortLabel}</span>
      <ChevronDown size={15} aria-hidden="true" />
    </button>
    {open && <section id="agent-status-popover" className="agent-status-popover" aria-label="Agent tool availability">
      <strong>{status.heading}</strong>
      <p>{status.detail}</p>
      <ul>
        <li><Check size={15} />Inspect a reviewed mechanism</li>
        <li><Check size={15} />Build a workload-specific gotcha journey</li>
        <li><Check size={15} />Animate and compare bounded methods</li>
      </ul>
      <small>No SQL, credentials, schemas, or private cluster data.</small>
    </section>}
  </div>;
}

function readWebMcpStatus() {
  const mode = document.documentElement.dataset.webmcp;
  const count = Number(document.documentElement.dataset.webmcpCount ?? 0);
  if (mode === "available" && count >= 7) return { tone: "ready", label: "Agent tools ready · 7", shortLabel: "Agent ready", heading: "Seven agent tools are ready", detail: "Your ChatGPT agent can personalize, inspect, compare, and animate this reviewed ClickHouse world." };
  if (mode === "available" && count > 0) return { tone: "partial", label: `Agent tools partial · ${count}/7`, shortLabel: `Agent ${count}/7`, heading: `${count} of seven agent tools are ready`, detail: "Manual exploration still works while the remaining tools are unavailable." };
  return { tone: "manual", label: "Manual mode", shortLabel: "Manual mode", heading: "Explore without an agent", detail: "This browser did not expose WebMCP. Every gotcha and mechanism remains available through the interface." };
}

export function GotchaShelf() {
  const open = useAtlasStore((state) => state.gotchaShelfOpen);
  const activeGotchaId = useAtlasStore((state) => state.activeGotchaId);
  if (!open) return null;

  return <section className="gotcha-shelf" aria-label="Six common ClickHouse gotchas">
    <header>
      <span><small>Choose a failure mode</small><strong>Explore six common gotchas</strong></span>
      <button type="button" onClick={() => useAtlasStore.getState().setGotchaShelfOpen(false)} aria-label="Close gotcha shelf"><X size={19} /></button>
    </header>
    <div className="gotcha-shelf__grid">
      <button className="gotcha-tile gotcha-tile--healthy" type="button" data-active={!activeGotchaId} onClick={() => useAtlasStore.getState().closeGotcha()}>
        <span className="healthy-glyph"><Check size={20} /></span>
        <span><small>Baseline</small><strong>Healthy MergeTree</strong><em>Return to the stable foundry.</em></span>
      </button>
      {GOTCHA_STORIES.map((story) => <button key={story.id} className="gotcha-tile" type="button" data-active={activeGotchaId === story.id} onClick={() => useAtlasStore.getState().startGotcha(story.id)}>
        <GotchaGlyph id={story.id} />
        <span><small>{String(story.index).padStart(2, "0")} · {story.category}</small><strong>{story.title}</strong><em>{story.consequence}</em></span>
      </button>)}
    </div>
  </section>;
}

export function GotchaStoryCard() {
  const activeGotchaId = useAtlasStore((state) => state.activeGotchaId);
  const beatIndex = useAtlasStore((state) => state.gotchaBeatIndex);
  const recommendations = useAtlasStore((state) => state.gotchaRecommendations);
  const inspectorSnap = useAtlasStore((state) => state.inspectorSnap);
  const story = gotchaStoryById(activeGotchaId);
  const beat = gotchaBeatById(activeGotchaId, beatIndex);
  const personalized = recommendations.find((entry) => entry.gotchaId === activeGotchaId);
  if (!story || !beat) return null;

  return <aside className="gotcha-story-card" aria-label={`${story.title} story`} data-beat={beat.kind} data-snap={inspectorSnap}>
    <button className="gotcha-story-card__handle" type="button" aria-label={inspectorSnap === "peek" ? "Expand story" : "Collapse story"} onClick={() => useAtlasStore.getState().setInspectorSnap(inspectorSnap === "peek" ? "full" : "peek")}><span /></button>
    <header>
      <div><span>Gotcha {String(story.index).padStart(2, "0")} · {story.category}</span><button type="button" onClick={() => useAtlasStore.getState().closeGotcha()} aria-label="Return to healthy MergeTree"><X size={19} /></button></div>
      <h1>{story.title}</h1>
      <p>{story.summary}</p>
    </header>
    {personalized && <section className="gotcha-personalized"><Sparkles size={17} /><span><small>For your workload</small><p>{personalized.whyRelevant}</p><em>{personalized.selectedVariant}</em></span></section>}
    <section className="gotcha-beat-copy" aria-live="polite">
      <span>{beat.kind}</span>
      <h2>{beat.heading}</h2>
      <p>{beat.narration}</p>
    </section>
    <section className="gotcha-guidance">
      <div><strong>{beat.kind === "avoid" ? "Do this" : "Guidance"}</strong><p>{beat.guidance}</p></div>
      <div><strong>Production check</strong><p>{beat.productionCheck}</p></div>
    </section>
    <section className="gotcha-components" aria-label="Inspectable story components">
      <strong>Inspect in the machine</strong>
      <div>{story.mechanismIds.slice(0, 3).map((id) => <button type="button" key={id} onClick={() => useAtlasStore.getState().selectMechanism(id)}>{mechanismById(id)?.shortTitle ?? id}</button>)}</div>
    </section>
    <details className="gotcha-tradeoff"><summary>Tradeoff</summary><p>{story.tradeoff}</p></details>
    <a className="gotcha-source" href={story.sourceUrl} target="_blank" rel="noreferrer">Official source · ClickHouse 26.3 LTS <ArrowUpRight size={16} /></a>
  </aside>;
}

export function GotchaInstruments() {
  const activeGotchaId = useAtlasStore((state) => state.activeGotchaId);
  const beatIndex = useAtlasStore((state) => state.gotchaBeatIndex);
  const story = gotchaStoryById(activeGotchaId);
  const beat = gotchaBeatById(activeGotchaId, beatIndex);
  if (!story || !beat) return null;
  return <section className="gotcha-instruments" aria-label={`${story.title} instruments`}>
    <header><span>{story.category}</span><strong>{beat.kind}</strong><em>MODEL · NOT LIVE DATA</em></header>
    <div>{beat.metrics.slice(0, 3).map((metric) => <article key={metric.label} data-tone={metric.tone ?? "neutral"}><span>{metric.label}</span><strong>{metric.value}</strong></article>)}</div>
  </section>;
}

export function GotchaLegend() {
  const activeGotchaId = useAtlasStore((state) => state.activeGotchaId);
  const beatIndex = useAtlasStore((state) => state.gotchaBeatIndex);
  const beat = gotchaBeatById(activeGotchaId, beatIndex);
  if (!beat) return null;
  return <aside className="gotcha-legend" aria-label="Scene legend"><span>Legend</span>{beat.legend.slice(0, 3).map((item) => <div key={item.label}><i style={{ background: item.color }} /><strong>{item.label}</strong></div>)}</aside>;
}

export function GotchaControls() {
  const activeGotchaId = useAtlasStore((state) => state.activeGotchaId);
  const beatIndex = useAtlasStore((state) => state.gotchaBeatIndex);
  const playing = useAtlasStore((state) => state.playing);
  const story = gotchaStoryById(activeGotchaId);

  useEffect(() => {
    if (!story || !playing) return undefined;
    const timer = window.setTimeout(() => {
      const state = useAtlasStore.getState();
      if (state.gotchaBeatIndex >= 3) state.setPlaying(false);
      else state.setGotchaBeat(state.gotchaBeatIndex + 1);
    }, 4300);
    return () => window.clearTimeout(timer);
  }, [story, playing, beatIndex]);

  if (!story) return <div className="simulation-dock gotcha-entry-dock" aria-label="Explore ClickHouse gotchas">
    <button className="gotcha-entry" type="button" onClick={() => useAtlasStore.getState().setGotchaShelfOpen(true)}><CircleAlert size={19} /><span><small>Common ClickHouse mistakes</small><strong>Explore 6 gotchas</strong></span></button>
    <span className="gotcha-entry__or">or ask your agent</span>
    <button className="step-control" type="button" onClick={() => useAtlasStore.getState().reset()} aria-label="Reset foundry"><RotateCcw size={17} /></button>
  </div>;

  const selectBeat = (index: number) => {
    const state = useAtlasStore.getState();
    state.setPlaying(false);
    state.setGotchaBeat(index);
  };

  return <div className="gotcha-rail" aria-label={`${story.title} story controls`}>
    <button className="gotcha-rail__play" type="button" onClick={() => useAtlasStore.getState().togglePlaying()} aria-label={playing ? "Pause story" : "Play story"}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
    <div className="gotcha-rail__track">
      <input type="range" min={0} max={3} step={1} value={beatIndex} aria-label={`${story.title} story beat`} onChange={(event) => selectBeat(Number(event.currentTarget.value))} />
      <div role="group" aria-label="Story beats">{beatLabels.map((label, index) => <button type="button" key={label} data-active={beatIndex === index} aria-pressed={beatIndex === index} onClick={() => selectBeat(index)}><i /><span>{label}</span></button>)}</div>
    </div>
    <button className="gotcha-rail__healthy" type="button" onClick={() => useAtlasStore.getState().closeGotcha()}><Check size={16} />Healthy</button>
  </div>;
}

export function activeGotchaSummary() {
  const state = useAtlasStore.getState();
  const story = gotchaStoryById(state.activeGotchaId);
  const beat = gotchaBeatById(state.activeGotchaId, state.gotchaBeatIndex);
  return story && beat ? `${story.title}. ${beat.heading}. ${beat.narration}` : "Healthy MergeTree baseline.";
}
