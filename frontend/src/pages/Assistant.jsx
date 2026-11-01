import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { post } from "../api";
import { useApp } from "../ctx";
import { Empty, PageHeader, Rich, SourceChips } from "../components/ui";

const SUG = ["What are the major financial risks?", "How has revenue changed over the reported years?", "What does management say about future growth?", "What are the main revenue sources?", "What competitive advantages are mentioned?"];

export default function Assistant({ go }) {
  const { company, chats, setChats, setAsked, query, setQuery } = useApp();
  const [text, setText] = useState("");
  const end = useRef();
  const msgs = chats[company] || [];
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = async (q) => {
    q = q.trim();
    if (!q || !company) return;
    const upd = (fn) => setChats((c) => ({ ...c, [company]: fn(c[company] || []) }));
    upd((m) => [...m, { role: "user", text: q }, { role: "ai", pending: true }]);
    setAsked((n) => n + 1); setText("");
    try { const r = await post("/ask", { company, question: q }); upd((m) => [...m.slice(0, -1), { role: "ai", ...r }]); }
    catch (e) { upd((m) => [...m.slice(0, -1), { role: "ai", answer: "Error: " + e.message, err: true, sources: [] }]); }
  };
  useEffect(() => { if (query) { send(query); setQuery(""); } }, [query]); // eslint-disable-line

  if (!company) return <><PageHeader title="AI Research Assistant" /><Empty icon={Sparkles} title="No company selected" text="Create a company and upload documents first."><button className="btn" onClick={() => go("companies")}>Add a company</button></Empty></>;

  return (
    <>
      <PageHeader title="AI Research Assistant" sub="Evidence-grounded answers. Click a numbered citation to see the exact source text." />
      <div className="card flex h-[calc(100vh-230px)] min-h-[440px] flex-col !p-0">
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {!msgs.length && (
            <div className="grid h-full place-items-center text-center">
              <div><div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-violet-500/15 text-violet-300"><Sparkles size={26} /></div>
                <h3 className="font-display text-xl font-semibold">Ask anything about {company}</h3>
                <p className="mb-5 mt-1 text-sm text-slate-400">Every factual claim cites a document and page.</p>
                <div className="flex max-w-2xl flex-wrap justify-center gap-2">{SUG.map((s) => <button key={s} onClick={() => send(s)} className="btn-ghost !rounded-full text-xs">{s}</button>)}</div></div>
            </div>
          )}
          {msgs.map((m, i) => m.role === "user" ? (
            <div key={i} className="ml-auto max-w-[80%] rounded-2xl bg-gradient-to-br from-blue-500/40 to-violet-500/40 px-4 py-3 text-sm">{m.text}</div>
          ) : (
            <div key={i} className="flex max-w-[900px] gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-[11px] font-bold">AI</div>
              <div className="min-w-0 rounded-2xl border border-[#1f2650] bg-[#121734] px-4 py-3 text-sm leading-relaxed">
                {m.pending ? <span className="flex gap-1">{[0, 1, 2].map((d) => <i key={d} className="h-2 w-2 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: d * 0.15 + "s" }} />)}</span> : <>
                  <Rich text={m.answer} sources={m.sources} />
                  {!m.err && !m.verified && <p className="mt-2 text-xs text-amber-400">⚠ Citation check failed or no citations found. Treat with caution.</p>}
                  <SourceChips sources={m.sources} /></>}
              </div>
            </div>
          ))}
          <div ref={end} />
        </div>
        <form className="flex gap-3 border-t border-[#1f2650] p-4" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <input className="input" placeholder={`Ask about ${company}…`} value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn"><Send size={16} />Send</button>
        </form>
      </div>
    </>
  );
}
