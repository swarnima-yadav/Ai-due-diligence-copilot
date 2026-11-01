"""Risk analysis, growth analysis and executive summary (all evidence-grounded)."""
import json
import re
import rag
import retriever

SEVERITIES = {"Low", "Medium", "High", "Critical"}

SEVERITY_CRITERIA = (
    "Severity criteria (base ONLY on the sources): Critical = threatens solvency, going concern or core "
    "licence, with quantified large exposure; High = described as material and quantified, or repeated across "
    "documents; Medium = disclosed but limited or unquantified; Low = minor or explicitly mitigated.")

RISK_SPEC = ('{"risk": str, "severity": "Low|Medium|High|Critical", "severity_rationale": str (cite which evidence '
             'justifies the severity), "type": "disclosed|inferred", "evidence": str, "impact": str (potential business '
             'impact), "questions": [str, str], "sources": ["S1"]}. "disclosed" = the document itself states this risk; '
             '"inferred" = your own interpretation of the evidence.')

GROWTH_CATEGORIES = {
    "Geographic expansion": "expansion new markets international geographies capacity",
    "New products & services": "new products launch services pipeline innovation",
    "Emerging markets & demand": "demand growth emerging markets consumption outlook",
    "Technology investments": "technology digital investment capex platform",
    "Strategic partnerships": "partnership joint venture acquisition alliance",
    "Diversification": "diversification new business segment investment",
}
GROWTH_SPEC = ('{"opportunity": str, "type": "stated_by_management|inferred", "explanation": str, "evidence": str, '
               '"benefits": str, "uncertainties": str, "questions": [str, str], "sources": ["S1"]}. Management '
               'projections are NOT guaranteed outcomes; say so where relevant.')

EXEC_QUERIES = {
    "Company overview": "company overview about us history operations",
    "Business model": "business model revenue sources segments customers",
    "Key financial findings": "revenue net profit EBITDA margin debt cash flow",
    "Financial and operational risks": "risk factors debt regulatory operational",
    "Growth opportunities": "growth strategy outlook expansion investment",
    "Management discussion": "management discussion and analysis outlook challenges",
}
EXEC_SECTIONS = [
    "Company overview", "Business model", "Key financial findings", "Financial and operational risks",
    "Growth opportunities", "Important uncertainties and missing information",
    "Questions for further investigation", "Overall due diligence observations",
]


def scan(company, categories, spec, note, progress=None):
    findings = []
    for n, (cat, query) in enumerate(categories.items()):
        if progress:
            progress(n / len(categories), cat)
        chunks = retriever.hybrid_search(company, query, k=8)
        if not chunks:
            continue
        prompt = (f"Sources:\n{rag._context(chunks)}\n\nCategory: '{cat}'. {note}\n"
                  f"Return ONLY a JSON array (max 4 items). Each item: {spec} "
                  "Return [] if the sources show nothing relevant.")
        smap = rag._source_map(chunks)
        for it in rag._parse_json(rag._llm(rag.SYSTEM, prompt, 2500)):
            labels = [s for s in it.get("sources", []) if s in smap]
            if not labels:  # no verifiable citation -> discard
                continue
            it["category"] = cat
            it["sources"] = [{"label": l, "file": smap[l]["meta"]["file"], "page": smap[l]["meta"]["page"],
                              "doc_type": smap[l]["meta"]["doc_type"], "section": smap[l]["meta"]["section"],
                              "fiscal_year": smap[l]["meta"]["fiscal_year"], "text": smap[l]["text"]}
                             for l in labels]
            findings.append(it)
    return findings


def risk_report(company, progress=None):
    findings = scan(company, rag.RISK_CATEGORIES, RISK_SPEC, SEVERITY_CRITERIA, progress)
    for f in findings:
        if f.get("severity") not in SEVERITIES:
            f["severity"] = "Medium"
        if f.get("type") not in {"disclosed", "inferred"}:
            f["type"] = "inferred"
        f.setdefault("risk", "Untitled risk")
    summary = ""
    if findings:
        brief = json.dumps([{k: f.get(k) for k in ("category", "risk", "severity", "type", "evidence")} for f in findings])
        summary = rag._llm("You write concise executive summaries for investors. Use only the findings given.",
                           f"Write a 5-sentence summary of these risk findings for {company}. "
                           f"Mention which are disclosed vs inferred:\n{brief}", 700)
    if progress:
        progress(1.0, "Done")
    return {"summary": summary, "findings": findings}


def growth_report(company, progress=None):
    findings = scan(company, GROWTH_CATEGORIES, GROWTH_SPEC, "Identify growth opportunities supported by the sources.", progress)
    for f in findings:
        if f.get("type") not in {"stated_by_management", "inferred"}:
            f["type"] = "inferred"
    if progress:
        progress(1.0, "Done")
    return {"summary": "", "findings": findings}


def _parse_obj(text):
    s, e = text.find("{"), text.rfind("}")
    try:
        return json.loads(text[s:e + 1])
    except (json.JSONDecodeError, ValueError):
        return {}


def executive_summary(company: str, profile: dict) -> dict | None:
    seen = {}
    for q in EXEC_QUERIES.values():
        for c in retriever.hybrid_search(company, q, k=5):
            seen.setdefault(c["id"], c)
    chunks = list(seen.values())[:30]
    if not chunks:
        return None
    smap = rag._source_map(chunks)
    prompt = (
        f"Sources:\n{rag._context(chunks)}\n\nUser-supplied company profile (unverified): {json.dumps(profile)}\n\n"
        f"Write a due diligence executive summary as ONE JSON object with exactly these keys: {EXEC_SECTIONS}. "
        "Each value is a string (use '- ' bullets for lists). Cite [S#] for every factual claim. Prefix your own "
        "interpretation with 'Interpretation:'. In 'Important uncertainties and missing information' state what "
        "the sources do NOT cover. Give 5-8 questions under 'Questions for further investigation'. "
        "Do not invent figures. Return ONLY the JSON object.")
    obj = _parse_obj(rag._llm(rag.SYSTEM, prompt, 4500))
    sections = {k: str(obj.get(k) or "Not available in the analysed documents.") for k in EXEC_SECTIONS}
    cited = list(dict.fromkeys(l for t in sections.values() for l in re.findall(r"\[(S\d+)\]", t)))
    sources = [{"label": l, "file": smap[l]["meta"]["file"], "page": smap[l]["meta"]["page"],
                "doc_type": smap[l]["meta"]["doc_type"]} for l in cited if l in smap]
    return {"sections": sections, "sources": sources, "parsed_ok": bool(obj)}
