import { useState } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";
import { api, enc, post } from "../api";
import { useApp } from "../ctx";
import { Empty, PageHeader } from "../components/ui";

const BLANK = { name: "", industry: "", country: "", description: "" };

export default function Companies({ go }) {
  const { companies, refresh, select, toast } = useApp();
  const [f, setF] = useState(BLANK);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const add = async (e) => {
    e.preventDefault();
    try { await post("/companies", f); toast("Company added. Now upload its documents."); await refresh(f.name); setF(BLANK); go("documents"); }
    catch (x) { toast(x.message, true); }
  };
  const del = async (e, name) => {
    e.stopPropagation();
    if (!confirm(`Delete "${name}" and all its documents?`)) return;
    try { await api(`/companies/${enc(name)}`, { method: "DELETE" }); toast("Company deleted"); await refresh(); } catch (x) { toast(x.message, true); }
  };

  return (
    <>
      <PageHeader title="Companies" sub="Each company gets its own isolated analysis workspace" />
      <form onSubmit={add} className="card mb-6 grid gap-3 md:grid-cols-3">
        <input className="input" placeholder="Company name *" required value={f.name} onChange={set("name")} />
        <input className="input" placeholder="Industry" value={f.industry} onChange={set("industry")} />
        <input className="input" placeholder="Country" value={f.country} onChange={set("country")} />
        <textarea className="input md:col-span-3" rows={2} placeholder="Short description" value={f.description} onChange={set("description")} />
        <div className="md:col-span-3"><button className="btn"><Plus size={16} />Add company</button></div>
      </form>
      {companies.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {companies.map((c) => (
            <div key={c.name} onClick={async () => { await select(c.name); go("dashboard"); }} className="card cursor-pointer transition hover:-translate-y-1 hover:border-violet-500">
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 font-display text-lg font-bold">{c.name[0].toUpperCase()}</div>
              <h4 className="font-display text-lg font-semibold">{c.name}</h4>
              <p className="mb-4 mt-1 min-h-10 text-sm text-slate-400">{c.description || [c.industry, c.country].filter(Boolean).join(" · ") || "No description"}</p>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{c.documents} documents</span>
                <button className="btn-ghost !px-2 !py-1 hover:!border-rose-400" onClick={(e) => del(e, c.name)}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      ) : <Empty icon={Building2} title="No companies yet" text="Add your first company using the form above." />}
    </>
  );
}
