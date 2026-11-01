import { X } from "lucide-react";
import { SEV_COLOR } from "../api";
import { useApp } from "../ctx";

export const PageHeader = ({ title, sub, children }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>
      <h2 className="font-display text-3xl font-bold tracking-tight">{title}</h2>
      {sub && <p className="mt-1 text-sm text-slate-400">{sub}</p>}
    </div>
    <div className="flex gap-2">{children}</div>
  </div>
);

export const Empty = ({ icon: Icon, title, text, children }) => (
  <div className="card flex flex-col items-center py-14 text-center">
    {Icon && <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/15 text-violet-300"><Icon size={26} /></div>}
    <h3 className="font-display text-xl font-semibold">{title}</h3>
    <p className="mb-5 mt-1 max-w-md text-sm text-slate-400">{text}</p>
    {children}
  </div>
);

export const Badge = ({ children, color = "#8a92bc" }) => (
  <span className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: color + "26", color }}>{children}</span>
);
export const SevTag = ({ s }) => (
  <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-[#0b0d1c]" style={{ background: SEV_COLOR[s] || "#a78bfa" }}>{s}</span>
);

export function Rich({ text = "", sources = [] }) {
  const { setSource } = useApp();
  const inline = (s) => s.split(/(\[S\d+\]|\*\*[^*]+\*\*)/).map((p, i) => {
    const m = p.match(/^\[(S\d+)\]$/);
    if (m) { const src = sources.find((x) => x.label === m[1]); return <button key={i} className="cite" onClick={() => src && setSource(src)}>{m[1].slice(1)}</button>; }
    return p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p;
  });
  return text.split("\n").filter((l) => l.trim()).map((l, i) =>
    /^\s*([-*•]|\d+\.)\s/.test(l)
      ? <li key={i} className="ml-5 list-disc">{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""))}</li>
      : <p key={i} className="mb-2 last:mb-0">{inline(l)}</p>);
}

export const SourceChips = ({ sources = [] }) => {
  const { setSource } = useApp();
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {sources.map((s) => (
        <button key={s.label} onClick={() => setSource(s)} className="rounded-full border border-[#1f2650] bg-white/5 px-3 py-1 text-xs transition hover:border-violet-500">
          <b className="text-cyan-300">{s.label}</b> {s.file} · p.{s.page}
        </button>
      ))}
    </div>
  );
};

const Line = ({ k, v }) => v ? <p className="mt-2 text-sm text-slate-300"><b className="text-slate-100">{k}:</b> {v}</p> : null;

export function Finding({ f }) {
  const title = f.risk || f.opportunity, main = f.explanation || f.evidence;
  return (
    <article className="card mb-4 border-l-4" style={{ borderLeftColor: SEV_COLOR[f.severity] || "#8b5cf6" }}>
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-display text-lg font-semibold">{title}</h4>
        <div className="flex gap-2">{f.severity && <SevTag s={f.severity} />}{f.type && <Badge>{f.type.replace(/_/g, " ")}</Badge>}</div>
      </div>
      <div className="mb-2 text-xs text-slate-400">{f.category}</div>
      <p className="text-sm text-slate-200">{main}</p>
      {f.explanation && <Line k="Evidence" v={f.evidence} />}
      <Line k="Why this severity" v={f.severity_rationale} />
      <Line k="Business impact" v={f.impact} />
      <Line k="Potential benefits" v={f.benefits} />
      <Line k="Key uncertainties" v={f.uncertainties} />
      {f.questions?.length > 0 && (
        <div className="mt-3 text-sm"><b>Investigate next</b>
          <ul className="ml-5 mt-1 list-disc text-slate-300">{f.questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
        </div>
      )}
      <SourceChips sources={f.sources} />
    </article>
  );
}

export function SourceDrawer() {
  const { source: s, setSource } = useApp();
  const rows = s ? [["Label", s.label], ["File", s.file], ["Page", s.page], ["Type", s.doc_type], ["Section", s.section], ["FY", s.fiscal_year]].filter(([, v]) => v) : [];
  return (
    <aside className={`fixed right-0 top-0 z-40 flex h-screen w-[440px] max-w-full flex-col border-l border-[#1f2650] bg-[#090c1d] shadow-2xl shadow-black transition-transform duration-300 ${s ? "translate-x-0" : "translate-x-full"}`}>
      <div className="flex items-center justify-between border-b border-[#1f2650] p-5">
        <b className="font-display">Source evidence</b>
        <button onClick={() => setSource(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
      </div>
      {s && (
        <div className="overflow-y-auto p-5">
          <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-slate-400">{k}</dt><dd>{v}</dd></div>)}
          </dl>
          <pre className="whitespace-pre-wrap break-words rounded-xl border border-[#1f2650] bg-[#0d1126] p-4 font-mono text-xs leading-relaxed text-slate-300">{s.text || "(text not stored for this source)"}</pre>
        </div>
      )}
    </aside>
  );
}

export const Toasts = () => {
  const { toasts } = useApp();
  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`rounded-xl border bg-[#1a2050] px-4 py-2.5 text-sm shadow-xl ${t.err ? "border-rose-400" : "border-violet-500"}`}>{t.msg}</div>
      ))}
    </div>
  );
};
