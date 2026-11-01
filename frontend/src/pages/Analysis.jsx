import { useState } from "react";
import { Loader2, ShieldAlert, TrendingUp } from "lucide-react";
import { api, post, SEV, sevRank, sleep } from "../api";
import { useApp } from "../ctx";
import { Empty, Finding, PageHeader } from "../components/ui";

const META = {
  risk: { title: "Risk Analysis", sub: "Disclosed vs AI-inferred risks with transparent severity criteria", btn: "Run risk analysis", path: "/risk-report", icon: ShieldAlert },
  growth: { title: "Growth Opportunities", sub: "Management projections are not guaranteed outcomes", btn: "Run growth analysis", path: "/growth-report", icon: TrendingUp },
};

export default function Analysis({ kind, go }) {
  const app = useApp();
  const { company, setData, reload, toast } = app, res = app[kind], m = META[kind];
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [stage, setStage] = useState("");
  const [filter, setFilter] = useState("All");

  const run = async () => {
    setBusy(true); setPct(3);
    try {
      const { job_id } = await post(m.path, { company });
      for (;;) {
        await sleep(2000);
        const j = await api("/jobs/" + job_id);
        setPct(Math.max(3, j.progress * 100)); setStage(j.stage || "");
        if (j.status === "done") { setData((d) => ({ ...d, [kind]: j.result })); await reload(); break; }
        if (j.status === "error") throw new Error(j.error);
      }
    } catch (e) { toast(e.message, true); }
    setBusy(false);
  };

  if (!company) return <><PageHeader title={m.title} /><Empty icon={m.icon} title="No company selected" text="Create a company first."><button className="btn" onClick={() => go("companies")}>Add a company</button></Empty></>;
  const list = (res?.findings || []).filter((f) => kind !== "risk" || filter === "All" || f.severity === filter).sort((a, b) => sevRank(a) - sevRank(b));

  return (
    <>
      <PageHeader title={m.title} sub={m.sub}>
        <button className="btn" disabled={busy} onClick={run}>{busy && <Loader2 size={16} className="animate-spin" />}{busy ? "Analysing…" : m.btn}</button>
      </PageHeader>
      {busy && (
        <div className="relative mb-5 h-8 overflow-hidden rounded-full bg-white/5">
          <div className="h-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-500" style={{ width: pct + "%" }} />
          <span className="absolute inset-0 grid place-items-center text-xs">{stage}</span>
        </div>
      )}
      {!res ? <Empty icon={m.icon} title={`No ${kind} analysis yet`} text="Generate one from your uploaded documents. Every finding must cite a verifiable source." />
        : <>
          {kind === "risk" && (
            <div className="mb-5 flex flex-wrap gap-2">{["All", ...SEV].map((s) => <button key={s} onClick={() => setFilter(s)} className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${filter === s ? "border-violet-500 bg-violet-500 text-white" : "border-[#1f2650] bg-[#0d1126] text-slate-400 hover:text-white"}`}>{s}</button>)}</div>
          )}
          {res.summary && <div className="card mb-5"><h4 className="mb-1 font-display font-semibold text-violet-300">Overview</h4><p className="text-sm text-slate-300">{res.summary}</p></div>}
          {list.length ? list.map((f, i) => <Finding key={i} f={f} />) : <Empty title="No findings" text="Nothing with a verifiable citation was found for this filter." />}
        </>}
    </>
  );
}
