import { useEffect, useState } from "react";
import { Building2, FileText, LayoutDashboard, ScrollText, Search, ShieldAlert, Sparkles, TrendingUp, Diamond } from "lucide-react";
import { api } from "./api";
import { useApp } from "./ctx";
import { SourceDrawer, Toasts } from "./components/ui";
import Dashboard from "./pages/Dashboard";
import Companies from "./pages/Companies";
import Documents from "./pages/Documents";
import Assistant from "./pages/Assistant";
import Analysis from "./pages/Analysis";
import Reports from "./pages/Reports";

const NAV = [
  ["dashboard", "Dashboard", LayoutDashboard], ["companies", "Companies", Building2], ["documents", "Document Library", FileText],
  ["assistant", "AI Assistant", Sparkles], ["risk", "Risk Analysis", ShieldAlert], ["growth", "Growth", TrendingUp], ["reports", "Reports", ScrollText],
];

export default function App() {
  const { companies, company, select, setQuery } = useApp();
  const [view, setView] = useState("dashboard");
  const [health, setHealth] = useState(null);
  const [q, setQ] = useState("");
  useEffect(() => { api("/health").then(setHealth).catch(() => setHealth({ llm_key_configured: false, down: true })); }, []);

  const go = setView;
  const page = {
    dashboard: <Dashboard go={go} />, companies: <Companies go={go} />, documents: <Documents go={go} />, assistant: <Assistant go={go} />,
    risk: <Analysis kind="risk" go={go} />, growth: <Analysis kind="growth" go={go} />, reports: <Reports go={go} />,
  }[view];

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col border-r border-[#1f2650] bg-[#070916]/80 p-3 backdrop-blur lg:w-64 lg:p-4">
        <div className="mb-6 flex items-center gap-3 px-1">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 shadow-lg shadow-violet-500/40"><Diamond size={18} /></div>
          <div className="hidden lg:block"><b className="font-display text-lg leading-none">Diligence AI</b><div className="text-xs text-slate-400">Research Copilot</div></div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(([id, label, Icon]) => (
            <button key={id} onClick={() => go(id)} title={label}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${view === id ? "bg-gradient-to-r from-blue-500/25 to-violet-500/10 text-white shadow-[inset_2px_0_0_#8b5cf6]" : "text-slate-400 hover:bg-violet-500/10 hover:text-white"}`}>
              <Icon size={18} className={view === id ? "text-violet-300" : ""} /><span className="hidden lg:inline">{label}</span>
            </button>
          ))}
        </nav>
        <p className="mt-auto hidden border-t border-[#1f2650] pt-3 text-[11px] text-slate-500 lg:block">AI-generated analysis. Not investment advice. Verify against source documents.</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[#1f2650] bg-[#05060f]/75 px-4 py-3 backdrop-blur lg:px-8">
          <form className="relative max-w-lg flex-1" onSubmit={(e) => { e.preventDefault(); if (q.trim() && company) { setQuery(q); setQ(""); go("assistant"); } }}>
            <Search size={16} className="absolute left-3 top-3 text-slate-500" />
            <input className="input pl-9" placeholder="Ask the AI about the selected company…" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <select className="input w-auto min-w-40 cursor-pointer" value={company || ""} onChange={(e) => select(e.target.value)}>
            {companies.length ? companies.map((c) => <option key={c.name}>{c.name}</option>) : <option>No companies</option>}
          </select>
          {health && (
            <span className={`hidden rounded-full border border-[#1f2650] px-3 py-1.5 text-xs md:block ${health.llm_key_configured ? "text-emerald-400" : "text-rose-400"}`}>
              ● {health.down ? "Backend offline" : health.llm_key_configured ? "LLM connected" : "API key missing"}
            </span>
          )}
        </header>
        <main className="mx-auto w-full max-w-[1320px] flex-1 p-4 lg:p-8">{page}</main>
      </div>
      <SourceDrawer />
      <Toasts />
    </div>
  );
}
