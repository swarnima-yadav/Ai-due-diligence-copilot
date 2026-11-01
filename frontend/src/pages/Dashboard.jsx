import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Building2, FileText, MessageSquare, ScrollText } from "lucide-react";
import { SEV, SEV_COLOR, sevRank } from "../api";
import { useApp } from "../ctx";
import { Badge, Empty, PageHeader, SevTag } from "../components/ui";

const tip = { contentStyle: { background: "#0d1126", border: "1px solid #1f2650", borderRadius: 12, fontSize: 12 }, cursor: { fill: "rgba(139,92,246,.08)" } };
const Stat = ({ icon: Icon, label, value, c }) => (
  <div className="card relative overflow-hidden">
    <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-30 blur-2xl" style={{ background: c }} />
    <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl" style={{ background: c + "26", color: c }}><Icon size={18} /></div>
    <div className="font-display text-4xl font-bold">{value}</div>
    <div className="text-sm text-slate-400">{label}</div>
  </div>
);
const Row = ({ title, sub, right }) => (
  <div className="flex items-center gap-3 border-b border-[#1f2650] py-3 last:border-0">
    <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{title}</div><div className="text-xs text-slate-400">{sub}</div></div>{right}
  </div>
);
const None = ({ children }) => <div className="grid h-48 place-items-center text-center text-sm text-slate-500"><div>{children}</div></div>;

export default function Dashboard({ go }) {
  const { companies, company, docs, reps, risk, growth, asked } = useApp();
  if (!companies.length)
    return <><PageHeader title="Dashboard" sub="Your due diligence overview" />
      <Empty icon={Building2} title="Welcome to Diligence AI" text="Add a company and upload its annual report to get source-backed answers, risk analysis and executive summaries."><button className="btn" onClick={() => go("companies")}>Add your first company</button></Empty></>;

  const f = risk?.findings || [];
  const pie = SEV.map((s) => ({ name: s, value: f.filter((x) => x.severity === s).length })).filter((x) => x.value);
  const cats = Object.entries(f.reduce((a, x) => ({ ...a, [x.category]: (a[x.category] || 0) + 1 }), {})).map(([name, count]) => ({ name: name.split(" ")[0], count }));
  const chunks = docs.filter((d) => d.status === "ready").map((d) => ({ name: d.filename.slice(0, 14), chunks: d.chunks }));
  const alerts = [...f].sort((a, b) => sevRank(a) - sevRank(b)).slice(0, 4);

  return (
    <>
      <PageHeader title={company} sub="Analysis workspace overview"><button className="btn" onClick={() => go("assistant")}><MessageSquare size={16} />Ask the AI</button></PageHeader>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat icon={Building2} label="Companies analysed" value={companies.length} c="#4f7cff" />
        <Stat icon={FileText} label="Documents processed" value={companies.reduce((a, c) => a + c.documents, 0)} c="#8b5cf6" />
        <Stat icon={ScrollText} label="Reports saved" value={reps.length} c="#22d3ee" />
        <Stat icon={MessageSquare} label="Questions this session" value={asked} c="#a78bfa" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card"><h3 className="mb-2 font-display font-semibold">Risk distribution</h3>
          {pie.length ? <ResponsiveContainer height={210}><PieChart><Pie data={pie} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={3} stroke="none">{pie.map((p) => <Cell key={p.name} fill={SEV_COLOR[p.name]} />)}</Pie><Tooltip {...tip} /></PieChart></ResponsiveContainer>
            : <None>No risk analysis yet.<br /><button className="btn mt-3" onClick={() => go("risk")}>Run analysis</button></None>}
          <div className="flex flex-wrap justify-center gap-3 text-xs">{pie.map((p) => <span key={p.name} style={{ color: SEV_COLOR[p.name] }}>● {p.name} {p.value}</span>)}</div></div>
        <div className="card"><h3 className="mb-2 font-display font-semibold">Risks by category</h3>
          {cats.length ? <ResponsiveContainer height={230}><BarChart data={cats}><XAxis dataKey="name" stroke="#8a92bc" fontSize={11} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} stroke="#8a92bc" fontSize={11} tickLine={false} axisLine={false} /><Tooltip {...tip} /><Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer> : <None>Appears after a risk analysis.</None>}</div>
        <div className="card"><h3 className="mb-2 font-display font-semibold">Indexed content (chunks)</h3>
          {chunks.length ? <ResponsiveContainer height={230}><BarChart data={chunks} layout="vertical"><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={90} stroke="#8a92bc" fontSize={11} tickLine={false} axisLine={false} /><Tooltip {...tip} /><Bar dataKey="chunks" fill="#4f7cff" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer> : <None>No processed documents yet.</None>}</div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card"><h3 className="mb-2 font-display font-semibold">Key risk alerts</h3>
          {alerts.length ? alerts.map((a, i) => <Row key={i} title={a.risk} sub={a.category} right={<SevTag s={a.severity} />} />) : <p className="py-8 text-center text-sm text-slate-500">No alerts yet.</p>}</div>
        <div className="card"><h3 className="mb-2 font-display font-semibold">Growth highlights</h3>
          {growth?.findings?.length ? growth.findings.slice(0, 4).map((g, i) => <Row key={i} title={g.opportunity} sub={g.category} right={<Badge color="#34d399">{(g.type || "").replace(/_/g, " ")}</Badge>} />) : <p className="py-8 text-center text-sm text-slate-500">No growth analysis yet.</p>}</div>
        <div className="card"><h3 className="mb-2 font-display font-semibold">Recent documents</h3>
          {docs.slice(0, 5).map((d) => <Row key={d.id} title={d.filename} sub={`${d.doc_type} · ${(d.size / 1048576).toFixed(1)} MB`} right={<Badge color={d.status === "ready" ? "#34d399" : "#fb7185"}>{d.status}</Badge>} />)}
          {!docs.length && <p className="py-8 text-center text-sm text-slate-500">Nothing uploaded.</p>}</div>
        <div className="card"><h3 className="mb-2 font-display font-semibold">Activity timeline</h3>
          {reps.slice(0, 5).map((r) => <Row key={r.id} title={`${r.kind.replace("_", " ")} generated`} sub={r.created_at} />)}
          {!reps.length && <p className="py-8 text-center text-sm text-slate-500">No activity yet.</p>}</div>
      </div>
    </>
  );
}
