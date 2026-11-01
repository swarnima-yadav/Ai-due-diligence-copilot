const $ = s => document.querySelector(s), enc = encodeURIComponent, J = { "Content-Type": "application/json" };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const S = { view: "dashboard", company: null, companies: [], docs: [], reps: [], risk: null, growth: null, exec: null, chats: {}, asked: 0, filter: "All" };
const SRC = {}, SEV = ["Critical", "High", "Medium", "Low"], COL = { Critical: "#fb7185", High: "#f59e0b", Medium: "#a78bfa", Low: "#34d399" };
const SUG = ["What are the major financial risks?", "How has revenue changed over the reported years?", "What does management say about future growth?", "What are the main revenue sources?", "What competitive advantages are mentioned?"];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = location.port === "8000" ? "" : "http://127.0.0.1:8000";   // works from Live Server too

function toast(m, err) { const t = document.createElement("div"); t.className = "toast" + (err ? " err" : ""); t.textContent = m; $("#toasts").appendChild(t); setTimeout(() => t.remove(), 4800); }
async function api(p, o) { const r = await fetch(BASE + p, o); let j = {}; try { j = await r.json(); } catch {} if (!r.ok) throw new Error(typeof j.detail === "string" ? j.detail : "Request failed (" + r.status + ")"); return j; }
const cp = () => `/companies/${enc(S.company)}`;

/* ---------- data ---------- */
async function loadCompany() {
  S.docs = []; S.reps = []; S.risk = S.growth = S.exec = null;
  if (!S.company) return;
  S.docs = (await api(cp() + "/documents")).documents; S.reps = (await api(cp() + "/reports")).reports;
  for (const k of ["risk", "growth"]) { const r = S.reps.find(x => x.kind === k); if (r) S[k] = (await api("/reports/" + r.id)).content; }
}
async function refresh(keep) {
  S.companies = (await api("/companies/details")).companies;
  if (!S.companies.find(c => c.name === S.company)) S.company = keep && S.companies.find(c => c.name === keep) ? keep : S.companies[0]?.name || null;
  $("#companySel").innerHTML = S.companies.map(c => `<option ${c.name === S.company ? "selected" : ""}>${esc(c.name)}</option>`).join("") || "<option>No companies</option>";
  await loadCompany(); render();
}
function nav(v) { S.view = v; document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.view === v)); render(); window.scrollTo(0, 0); }

/* ---------- helpers ---------- */
function fmt(text, key) {
  let out = "", ul = false;
  for (const l of esc(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").split("\n")) {
    const m = l.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (m) { if (!ul) { out += "<ul>"; ul = true; } out += `<li>${m[1]}</li>`; }
    else { if (ul) { out += "</ul>"; ul = false; } if (l.trim()) out += `<p>${l}</p>`; }
  }
  return (out + (ul ? "</ul>" : "")).replace(/\[(S\d+)\]/g, (_, l) => `<button class="cite" data-key="${key}" data-label="${l}">${l.slice(1)}</button>`);
}
function openSrc(key, label) {
  const s = SRC[key]?.[label]; if (!s) return;
  $("#dbody").innerHTML = `<dl class="meta2"><dt>Label</dt><dd>${esc(label)}</dd><dt>File</dt><dd>${esc(s.file)}</dd><dt>Page</dt><dd>${esc(s.page)}</dd>${s.doc_type ? `<dt>Type</dt><dd>${esc(s.doc_type)}</dd>` : ""}${s.section ? `<dt>Section</dt><dd>${esc(s.section)}</dd>` : ""}${s.fiscal_year ? `<dt>FY</dt><dd>${esc(s.fiscal_year)}</dd>` : ""}</dl><pre>${esc(s.text || "(text not stored for this source)")}</pre>`;
  $("#drawer").classList.add("open");
}
const chips = (key, list) => (list || []).map(s => `<button class="sc" data-key="${key}" data-label="${esc(s.label)}"><b>${esc(s.label)}</b> ${esc(s.file)} · p.${esc(s.page)}</button>`).join("");
const needCo = () => `<div class="card empty"><h3>No company selected</h3><p>Create a company and upload its documents to begin.</p><button class="btn" data-act="nav" data-v="companies">Add a company</button></div>`;
const head = (t, p, right = "") => `<div class="ph"><div><h2>${t}</h2><p>${p}</p></div><div>${right}</div></div>`;
const sevRank = f => { const i = SEV.indexOf(f.severity); return i < 0 ? 2 : i; };

function finding(f, key) {
  SRC[key] = Object.fromEntries((f.sources || []).map(s => [s.label, s]));
  const title = f.risk || f.opportunity, main = f.explanation || f.evidence, sev = f.severity, t = (f.type || "").replace(/_/g, " ");
  const line = (k, v) => v ? `<p class="sub"><b>${k}:</b> ${esc(v)}</p>` : "";
  return `<article class="card fcard ${sev || ""}" style="margin-bottom:14px"><div class="fh"><h4>${esc(title)}</h4><div>${sev ? `<span class="tag ${sev}">${sev}</span>` : ""}${t ? `<span class="tag t">${esc(t)}</span>` : ""}</div></div>
  <div class="cat">${esc(f.category)}</div><p>${esc(main)}</p>${f.explanation ? line("Evidence", f.evidence) : ""}${line("Why this severity", f.severity_rationale)}${line("Business impact", f.impact)}${line("Potential benefits", f.benefits)}${line("Key uncertainties", f.uncertainties)}
  ${f.questions?.length ? `<div class="sub"><b>Investigate next</b><ul class="qs">${f.questions.map(q => `<li>${esc(q)}</li>`).join("")}</ul></div>` : ""}<div class="srcs">${chips(key, f.sources)}</div></article>`;
}
function donut(counts) {
  const tot = SEV.reduce((a, k) => a + (counts[k] || 0), 0); let off = 0;
  const arcs = SEV.map(k => { const len = tot ? (counts[k] || 0) / tot * 251.3 : 0, s = `<circle r="40" cx="60" cy="60" fill="none" stroke="${COL[k]}" stroke-width="14" stroke-dasharray="${len} ${251.3 - len}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"/>`; off += len; return s; }).join("");
  return `<div class="donut"><svg width="150" height="150" viewBox="0 0 120 120"><circle r="40" cx="60" cy="60" fill="none" stroke="#1a2048" stroke-width="14"/>${arcs}<text x="60" y="58" text-anchor="middle" fill="#fff" font-size="20" font-family="Space Grotesk" font-weight="700">${tot}</text><text x="60" y="73" text-anchor="middle" fill="#8a92bc" font-size="8">risks</text></svg>
  <div class="legend">${SEV.map(k => `<div><i style="background:${COL[k]}"></i>${k} <b>${counts[k] || 0}</b></div>`).join("")}</div></div>`;
}

/* ---------- views ---------- */
const V = {};
V.dashboard = () => {
  if (!S.companies.length) return head("Dashboard", "Your due diligence overview") + needCo();
  const ready = S.docs.filter(d => d.status === "ready"), totalDocs = S.companies.reduce((a, c) => a + c.documents, 0), f = S.risk?.findings || [];
  const counts = {}; f.forEach(x => counts[x.severity] = (counts[x.severity] || 0) + 1);
  const max = Math.max(1, ...ready.map(d => d.chunks)), alerts = [...f].sort((a, b) => sevRank(a) - sevRank(b)).slice(0, 4), gr = (S.growth?.findings || []).slice(0, 3);
  const stat = (l, v, c) => `<div class="card stat" style="--c:${c}"><span>${l}</span><b>${v}</b></div>`;
  return head(esc(S.company), "Analysis workspace overview", `<button class="btn" data-act="nav" data-v="assistant">Ask the AI</button>`) +
  `<div class="grid g4">${stat("Companies analysed", S.companies.length, "#4f7cff")}${stat("Documents processed", totalDocs, "#8b5cf6")}${stat("Saved reports", S.reps.length, "#22d3ee")}${stat("Questions asked (this session)", S.asked, "#a78bfa")}</div>
  <div class="grid g2" style="margin-top:16px"><div class="card"><h3>Key risk alerts <button class="btn g sm" data-act="nav" data-v="risk">View all</button></h3>${alerts.length ? alerts.map(a => `<div class="row"><span class="tag ${a.severity}" style="margin:0">${a.severity}</span><div class="m"><b>${esc(a.risk)}</b><small>${esc(a.category)}</small></div></div>`).join("") : `<div class="empty">No risk analysis yet. <br><br><button class="btn sm" data-act="nav" data-v="risk">Run risk analysis</button></div>`}</div>
  <div class="card"><h3>Risk distribution</h3>${f.length ? donut(counts) : `<div class="empty">Shown once a risk analysis exists.</div>`}</div></div>
  <div class="grid g2" style="margin-top:16px"><div class="card"><h3>Indexed content per document <small style="color:var(--mute);font-weight:400">text chunks</small></h3>${ready.length ? ready.map(d => `<div class="bar"><span title="${esc(d.filename)}">${esc(d.filename)}</span><span class="tr"><div style="width:${d.chunks / max * 100}%"></div></span><span>${d.chunks}</span></div>`).join("") : `<div class="empty">No processed documents yet.</div>`}</div>
  <div class="card"><h3>Growth highlights</h3>${gr.length ? gr.map(g => `<div class="row"><div class="m"><b>${esc(g.opportunity)}</b><small>${esc(g.category)}</small></div></div>`).join("") : `<div class="empty">No growth analysis yet.</div>`}</div></div>
  <div class="grid g2" style="margin-top:16px"><div class="card"><h3>Recent documents</h3>${S.docs.slice(0, 5).map(d => `<div class="row"><div class="m"><b>${esc(d.filename)}</b><small>${esc(d.doc_type)} · ${(d.size / 1048576).toFixed(1)} MB</small></div><span class="badge ${d.status}">${d.status}</span></div>`).join("") || `<div class="empty">Nothing uploaded.</div>`}</div>
  <div class="card"><h3>Activity timeline</h3>${S.reps.slice(0, 5).map(r => `<div class="row"><div class="m"><b>${r.kind === "executive_summary" ? "Executive summary" : r.kind[0].toUpperCase() + r.kind.slice(1) + " analysis"} generated</b><small>${esc(r.created_at)}</small></div></div>`).join("") || `<div class="empty">No activity yet.</div>`}</div></div>`;
};
V.companies = () => head("Companies", "Each company has its own isolated workspace") +
  `<form class="card form" data-form="company"><input name="name" placeholder="Company name *" required><input name="industry" placeholder="Industry"><input name="country" placeholder="Country"><textarea class="w" name="description" rows="2" placeholder="Short description"></textarea><div class="w"><button class="btn">Add company</button></div></form>` +
  (S.companies.length ? `<div class="grid g3">${S.companies.map(c => `<div class="card ccard" data-act="pick" data-v="${esc(c.name)}"><div class="av">${esc(c.name[0].toUpperCase())}</div><h4>${esc(c.name)}</h4><p>${esc(c.description || [c.industry, c.country].filter(Boolean).join(" · ") || "No description")}</p><div class="meta"><span>${c.documents} documents</span><button class="btn g sm" data-act="delco" data-v="${esc(c.name)}">Delete</button></div></div>`).join("")}</div>` : `<div class="card empty"><h3>No companies yet</h3><p>Add your first company above.</p></div>`);
V.documents = () => head("Document Library", S.company ? `Files for ${esc(S.company)}` : "") + (!S.company ? needCo() :
  `<div class="card"><label class="drop" id="drop"><input id="files" type="file" multiple hidden accept=".pdf,.xlsx,.xls"><big>⇪</big><b style="color:var(--ink)">Drag & drop PDF or Excel files</b><span>or click to browse · scanned PDFs need OCR (not supported yet)</span><small id="fnames"></small></label>
  <div class="up"><select id="dtype"><option>Annual Report</option><option>Investor Presentation</option><option>Financial Statements</option><option>Market Report</option><option>Filing</option></select><input id="fy" placeholder="Fiscal year (FY2024)"><span></span><button class="btn" data-act="upload" id="upbtn">Upload & process</button></div></div>
  <div class="card" style="margin-top:16px"><h3>Documents (${S.docs.length})</h3>${S.docs.map(d => `<div class="row"><div class="m"><b>${esc(d.filename)}</b><small>${esc(d.doc_type)} ${d.fiscal_year ? "· " + esc(d.fiscal_year) : ""} · ${(d.size / 1048576).toFixed(2)} MB · ${d.chunks} chunks · ${esc(d.created_at)}${d.error ? " · " + esc(d.error) : ""}</small></div><span class="badge ${d.status}">${d.status}</span><button class="btn g sm" data-act="deldoc" data-v="${d.id}">Delete</button></div>`).join("") || `<div class="empty">No documents yet.</div>`}</div>`);
V.assistant = () => head("AI Research Assistant", "Evidence-grounded answers with page-level citations") + (!S.company ? needCo() :
  `<div class="card chat"><div id="msgs"></div><div class="sug" id="sug"></div><form class="comp" data-form="ask"><textarea id="q" rows="1" placeholder="Ask about ${esc(S.company)}…  (Enter to send, Shift+Enter for new line)"></textarea><button class="btn" id="askbtn">Send</button></form></div>`);
const jobView = (kind, title, sub, label) => head(title, sub, S.company ? `<button class="btn" id="jobbtn" data-act="job" data-v="${kind}">${label}</button>` : "") + (!S.company ? needCo() :
  `<div class="prog hidden" id="prog"><div id="bar"></div><span id="stage"></span></div>` + (S[kind] ? (kind === "risk" ? `<div class="flt" style="margin-bottom:16px">${["All", ...SEV].map(x => `<button data-act="flt" data-v="${x}" class="${S.filter === x ? "on" : ""}">${x}</button>`).join("")}</div>${S.risk.summary ? `<div class="card sec" style="margin-bottom:16px"><h4>Executive overview</h4><p>${esc(S.risk.summary)}</p></div>` : ""}` : "") +
  (S[kind].findings.filter(f => kind !== "risk" || S.filter === "All" || f.severity === S.filter).sort((a, b) => sevRank(a) - sevRank(b)).map((f, i) => finding(f, `${kind}${i}${S.filter}`)).join("") || `<div class="card empty">No findings with citations in the indexed documents.</div>`) : `<div class="card empty"><h3>No ${kind} analysis yet</h3><p>Generate one from the uploaded documents. Every finding must cite a source.</p></div>`));
V.risk = () => jobView("risk", "Risk Analysis", "Disclosed vs AI-inferred risks, with transparent severity criteria", "Run risk analysis");
V.growth = () => jobView("growth", "Growth Opportunities", "Management projections are not guaranteed outcomes", "Run growth analysis");
V.reports = () => head("Reports", "Generate and export due diligence reports", S.company ? `<button class="btn" id="execbtn" data-act="exec">Generate Executive Summary</button>` : "") + (!S.company ? needCo() :
  `<div class="card"><h3>Saved reports</h3>${S.reps.map(r => `<div class="row"><div class="m"><b>${r.kind === "executive_summary" ? "Executive summary" : r.kind + " analysis"}</b><small>${esc(r.created_at)}</small></div><button class="btn g sm" data-act="openrep" data-v="${r.id}" data-k="${r.kind}">View</button>${r.kind === "executive_summary" ? `<a href="${BASE}/reports/${r.id}/pdf" target="_blank"><button class="btn sm">Download PDF</button></a>` : ""}</div>`).join("") || `<div class="empty">No reports yet.</div>`}</div>` +
  (S.exec ? `<div class="card sec" style="margin-top:16px"><h3>Executive summary <a href="${BASE}/reports/${S.exec.id}/pdf" target="_blank"><button class="btn sm">Download PDF</button></a></h3>${Object.entries(S.exec.sections).map(([k, v], i) => { SRC["x" + i] = Object.fromEntries(S.exec.sources.map(s => [s.label, s])); return `<h4>${i + 1}. ${esc(k)}</h4>${fmt(v, "x" + i)}`; }).join("")}<h4>9. Sources</h4>${S.exec.sources.map(s => `<p>[${esc(s.label)}] ${esc(s.file)}, page ${esc(s.page)}</p>`).join("")}<p class="warn">AI-generated; not certified investment advice.</p></div>` : ""));
V.settings = () => { api("/health").then(h => { const p = $("#hl"); if (p) p.innerHTML = h.llm_key_configured ? `<span class='badge ready'>${esc(h.provider)} · ${esc(h.model)}</span> <button class="btn sm" data-act="llmtest">Test connection</button>` : "<span class='badge failed'>LLM not configured — edit .env and restart the server</span>"; }).catch(() => { const p = $("#hl"); if (p) p.innerHTML = "<span class='badge failed'>Backend not reachable — start it with run.bat</span>"; });
  return head("Settings", "System status and notes") +
  `<div class="card"><h3>LLM connection</h3><div id="hl">Checking…</div></div><div class="card" style="margin-top:16px"><h3>Important</h3><p style="color:var(--mute)">This tool analyses only the documents you upload. Output is AI-generated, may contain errors, and is not certified investment, legal or financial advice. Scanned PDFs are not supported until OCR is added.</p></div>`; };

function render() { $("#content").innerHTML = V[S.view](); if (S.view === "assistant") renderMsgs(); }

/* ---------- chat ---------- */
function renderMsgs() {
  const m = S.chats[S.company] || [], box = $("#msgs"); if (!box) return;
  $("#sug").classList.toggle("hidden", m.length > 0); $("#sug").innerHTML = SUG.map(q => `<button type="button" data-act="sug">${esc(q)}</button>`).join("");
  box.innerHTML = m.map((x, i) => { if (x.role === "u") return `<div class="msg u"><div class="av">You</div><div class="bub">${esc(x.text)}</div></div>`; if (x.pending) return `<div class="msg"><div class="av">AI</div><div class="bub dots"><span></span><span></span><span></span></div></div>`;
    const k = `m${S.company}${i}`; SRC[k] = Object.fromEntries((x.sources || []).map(s => [s.label, s]));
    return `<div class="msg"><div class="av">AI</div><div class="bub">${fmt(x.text, k)}${x.err || x.verified ? "" : `<div class="warn">⚠ Citation check failed or no citations found. Treat with caution.</div>`}${x.sources?.length ? `<div class="srcs">${chips(k, x.sources)}</div>` : ""}</div></div>`; }).join("") ||
    `<div class="empty"><h3>Ask about ${esc(S.company)}</h3><p>Every factual claim cites a document and page. Click a number to see the evidence.</p></div>`;
  box.scrollTop = box.scrollHeight;
}
async function ask(q) {
  q = (q || "").trim(); if (!q || !S.company) return;
  if (S.view !== "assistant") nav("assistant");
  const m = (S.chats[S.company] ||= []); m.push({ role: "u", text: q }, { role: "a", pending: true }); renderMsgs(); if ($("#q")) $("#q").value = ""; S.asked++;
  try { const r = await api("/ask", { method: "POST", headers: J, body: JSON.stringify({ company: S.company, question: q }) }); m[m.length - 1] = { role: "a", text: r.answer, sources: r.sources, verified: r.verified }; }
  catch (e) { m[m.length - 1] = { role: "a", text: "Error: " + e.message, err: true }; }
  renderMsgs();
}

/* ---------- actions ---------- */
async function runJob(kind) {
  const btn = $("#jobbtn"); btn.disabled = true; $("#prog").classList.remove("hidden");
  try {
    const { job_id } = await api(kind === "risk" ? "/risk-report" : "/growth-report", { method: "POST", headers: J, body: JSON.stringify({ company: S.company }) });
    for (;;) { await sleep(2000); const j = await api("/jobs/" + job_id); if ($("#bar")) { $("#bar").style.width = Math.max(3, j.progress * 100) + "%"; $("#stage").textContent = j.stage || ""; }
      if (j.status === "done") { S[kind] = j.result; break; } if (j.status === "error") throw new Error(j.error); }
    S.reps = (await api(cp() + "/reports")).reports;
  } catch (e) { toast(e.message, true); }
  if (S.view === kind) render();
}
async function upload() {
  const files = $("#files").files; if (!files.length) return toast("Choose files first", true);
  const fd = new FormData(); fd.append("company", S.company); fd.append("doc_type", $("#dtype").value); fd.append("fiscal_year", $("#fy").value); [...files].forEach(f => fd.append("files", f));
  const b = $("#upbtn"); b.disabled = true; b.textContent = "Processing…";
  try { const j = await api("/documents", { method: "POST", body: fd }); j.results.forEach(r => toast(r.error ? `${r.file}: ${r.error}` : `${r.file}: ${r.chunks} chunks indexed`, !!r.error)); await refresh(); } catch (e) { toast(e.message, true); b.disabled = false; b.textContent = "Upload & process"; }
}
document.addEventListener("click", async e => {
  const k = e.target.closest("[data-key]"); if (k) return openSrc(k.dataset.key, k.dataset.label);
  const el = e.target.closest("[data-act]"); if (!el) return; const a = el.dataset.act, v = el.dataset.v;
  try {
    if (a === "close") $("#drawer").classList.remove("open");
    else if (a === "llmtest") { el.textContent = "Testing…"; const r = await api("/llm/test"); toast(r.ok ? `LLM works (${r.model}): ${r.reply}` : r.error, !r.ok); el.textContent = "Test connection"; }
    else if (a === "nav") nav(v);
    else if (a === "pick") { if (e.target.closest("[data-act=delco]")) return; S.company = v; $("#companySel").value = v; await loadCompany(); nav("dashboard"); }
    else if (a === "delco") { e.stopPropagation(); if (confirm(`Delete "${v}" and all its documents?`)) { await api("/companies/" + enc(v), { method: "DELETE" }); delete S.chats[v]; await refresh(); toast("Company deleted"); } }
    else if (a === "deldoc") { if (confirm("Delete this document?")) { await api("/documents/" + v, { method: "DELETE" }); await refresh(); } }
    else if (a === "upload") await upload();
    else if (a === "sug") ask(el.textContent);
    else if (a === "job") await runJob(v);
    else if (a === "flt") { S.filter = v; render(); }
    else if (a === "exec") { el.disabled = true; el.textContent = "Generating… (about a minute)"; try { const r = await api(cp() + "/executive-summary", { method: "POST" }); S.exec = { id: r.id, ...r.report }; S.reps = (await api(cp() + "/reports")).reports; toast("Executive summary ready"); } finally { render(); } }
    else if (a === "openrep") { const r = await api("/reports/" + v); if (el.dataset.k === "executive_summary") { S.exec = { id: +v, ...r.content }; render(); } else { S[el.dataset.k] = r.content; nav(el.dataset.k); } }
  } catch (x) { toast(x.message, true); render(); }
});
document.addEventListener("submit", async e => {
  e.preventDefault(); const f = e.target.dataset.form;
  if (f === "ask") return ask($("#q").value);
  if (f === "company") { const d = Object.fromEntries(new FormData(e.target)); try { await api("/companies", { method: "POST", headers: J, body: JSON.stringify(d) }); S.company = d.name; toast("Company added — now upload documents"); await refresh(); nav("documents"); } catch (x) { toast(x.message, true); } }
});
document.addEventListener("keydown", e => { if (e.key === "Escape") $("#drawer").classList.remove("open"); if (e.target.id === "q" && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(e.target.value); } });
document.addEventListener("change", e => { if (e.target.id === "files") $("#fnames").textContent = [...e.target.files].map(f => f.name).join(", "); });
["dragover", "dragleave", "drop"].forEach(t => document.addEventListener(t, e => { const d = e.target.closest("#drop"); if (!d) return; e.preventDefault(); d.classList.toggle("over", t === "dragover"); if (t === "drop") { $("#files").files = e.dataTransfer.files; $("#fnames").textContent = [...e.dataTransfer.files].map(f => f.name).join(", "); } }));
document.querySelectorAll("#nav button").forEach(b => b.onclick = () => nav(b.dataset.view));
$("#companySel").onchange = async e => { S.company = e.target.value; await loadCompany(); render(); };
$("#gsearch").onkeydown = e => { if (e.key === "Enter") { if (!S.company) return toast("Add a company first", true); ask(e.target.value); e.target.value = ""; } };
api("/health").then(h => { const p = $("#pill"); p.className = "pill " + (h.llm_key_configured ? "ok" : "bad"); p.textContent = h.llm_key_configured ? "● LLM connected" : "● LLM not configured"; }).catch(() => { const p = $("#pill"); p.className = "pill bad"; p.textContent = "● Backend offline"; });
nav("dashboard"); refresh().catch(e => toast(e.message, true));
