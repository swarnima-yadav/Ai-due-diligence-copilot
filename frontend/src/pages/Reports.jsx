import { useState } from "react";
import { Download, Loader2, ScrollText } from "lucide-react";
import { api, enc, post } from "../api";
import { useApp } from "../ctx";
import { Empty, PageHeader, Rich } from "../components/ui";

export default function Reports({ go }) {
  const { company, reps, reload, toast, setData } = useApp();
  const [exec, setExec] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!company) return <><PageHeader title="Reports" /><Empty icon={ScrollText} title="No company selected" text="Create a company first."><button className="btn" onClick={() => go("companies")}>Add a company</button></Empty></>;

  const generate = async () => {
    setBusy(true);
    try { const r = await post(`/companies/${enc(company)}/executive-summary`); setExec({ id: r.id, ...r.report }); await reload(); toast("Executive summary ready"); }
    catch (e) { toast(e.message, true); }
    setBusy(false);
  };
  const open = async (r) => {
    try {
      const j = await api("/reports/" + r.id);
      if (r.kind === "executive_summary") setExec({ id: r.id, ...j.content });
      else { setData((d) => ({ ...d, [r.kind]: j.content })); go(r.kind); }
    } catch (e) { toast(e.message, true); }
  };

  return (
    <>
      <PageHeader title="Reports" sub="Generate, review and export due diligence reports">
        <button className="btn" disabled={busy} onClick={generate}>{busy && <Loader2 size={16} className="animate-spin" />}{busy ? "Generating… (about a minute)" : "Generate Executive Summary"}</button>
      </PageHeader>
      <div className="card">
        <h3 className="mb-2 font-display font-semibold">Saved reports</h3>
        {reps.map((r) => (
          <div key={r.id} className="flex items-center gap-3 border-b border-[#1f2650] py-3 last:border-0">
            <div className="min-w-0 flex-1"><div className="text-sm font-semibold capitalize">{r.kind.replace("_", " ")}</div><div className="text-xs text-slate-400">{r.created_at}</div></div>
            <button className="btn-ghost" onClick={() => open(r)}>View</button>
            {r.kind === "executive_summary" && <a className="btn" href={`/reports/${r.id}/pdf`} target="_blank" rel="noreferrer"><Download size={15} />PDF</a>}
          </div>
        ))}
        {!reps.length && <p className="py-10 text-center text-sm text-slate-500">No reports yet.</p>}
      </div>
      {exec && (
        <div className="card mt-4">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-display text-xl font-semibold">Executive Summary</h3>
            <a className="btn" href={`/reports/${exec.id}/pdf`} target="_blank" rel="noreferrer"><Download size={15} />Download PDF</a></div>
          {Object.entries(exec.sections).map(([k, v], i) => (
            <section key={k} className="mb-4 text-sm leading-relaxed text-slate-300"><h4 className="mb-1 font-display font-semibold text-violet-300">{i + 1}. {k}</h4><Rich text={v} sources={exec.sources} /></section>
          ))}
          <h4 className="mb-1 font-display font-semibold text-violet-300">9. Sources</h4>
          {exec.sources.map((s) => <p key={s.label} className="text-sm text-slate-400">[{s.label}] {s.file}, page {s.page}</p>)}
          <p className="mt-4 text-xs text-amber-400">AI-generated from the uploaded documents. Not certified investment, legal or financial advice.</p>
        </div>
      )}
    </>
  );
}
