import { useRef, useState } from "react";
import { FileText, Trash2, UploadCloud } from "lucide-react";
import { api } from "../api";
import { useApp } from "../ctx";
import { Badge, Empty, PageHeader } from "../components/ui";

const COLORS = { ready: "#34d399", processing: "#22d3ee", empty: "#fb7185", failed: "#fb7185" };

export default function Documents({ go }) {
  const { company, docs, refresh, toast } = useApp();
  const [files, setFiles] = useState([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState("Annual Report");
  const [fy, setFy] = useState("");
  const input = useRef();

  if (!company) return <><PageHeader title="Document Library" /><Empty icon={FileText} title="No company selected" text="Create a company first."><button className="btn" onClick={() => go("companies")}>Add a company</button></Empty></>;

  const upload = async () => {
    if (!files.length) return toast("Choose files first", true);
    const fd = new FormData();
    fd.append("company", company); fd.append("doc_type", type); fd.append("fiscal_year", fy);
    files.forEach((f) => fd.append("files", f));
    setBusy(true);
    try {
      const j = await api("/documents", { method: "POST", body: fd });
      j.results.forEach((r) => toast(r.error ? `${r.file}: ${r.error}` : `${r.file}: ${r.chunks} chunks indexed`, !!r.error));
      setFiles([]); await refresh();
    } catch (e) { toast(e.message, true); }
    setBusy(false);
  };
  const del = async (d) => { if (confirm(`Delete ${d.filename}?`)) { try { await api(`/documents/${d.id}`, { method: "DELETE" }); await refresh(); } catch (e) { toast(e.message, true); } } };

  return (
    <>
      <PageHeader title="Document Library" sub={`Files for ${company}. PDF and Excel supported; scanned PDFs need OCR (not yet available).`} />
      <div className="card">
        <div onClick={() => input.current.click()} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); setFiles([...e.dataTransfer.files]); }}
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${over ? "border-violet-500 bg-violet-500/10" : "border-[#343d78] hover:border-violet-500"}`}>
          <UploadCloud size={36} className="text-violet-300" />
          <b>Drag & drop files here, or click to browse</b>
          <span className="text-sm text-cyan-300">{files.map((f) => f.name).join(", ")}</span>
          <input ref={input} type="file" multiple hidden accept=".pdf,.xlsx,.xls" onChange={(e) => setFiles([...e.target.files])} />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>{["Annual Report", "Investor Presentation", "Financial Statements", "Market Report", "Filing"].map((t) => <option key={t}>{t}</option>)}</select>
          <input className="input" placeholder="Fiscal year (e.g. FY2024)" value={fy} onChange={(e) => setFy(e.target.value)} />
          <button className="btn" disabled={busy} onClick={upload}>{busy ? "Processing…" : "Upload & process"}</button>
        </div>
      </div>
      <div className="card mt-4">
        <h3 className="mb-2 font-display font-semibold">Documents ({docs.length})</h3>
        {docs.map((d) => (
          <div key={d.id} className="flex items-center gap-3 border-b border-[#1f2650] py-3 last:border-0">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/15 text-blue-300"><FileText size={18} /></div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{d.filename}</div>
              <div className="text-xs text-slate-400">{d.doc_type}{d.fiscal_year && ` · ${d.fiscal_year}`} · {(d.size / 1048576).toFixed(2)} MB · {d.chunks} chunks · {d.created_at}</div>
              {d.error && <div className="text-xs text-rose-400">{d.error}</div>}
            </div>
            <Badge color={COLORS[d.status]}>{d.status}</Badge>
            <button className="btn-ghost !px-2 hover:!border-rose-400" onClick={() => del(d)}><Trash2 size={15} /></button>
          </div>
        ))}
        {!docs.length && <p className="py-10 text-center text-sm text-slate-500">No documents uploaded yet.</p>}
      </div>
    </>
  );
}
