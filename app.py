import os
import tempfile
import streamlit as st
import ingest
import rag
import store

st.set_page_config(page_title="Due Diligence Copilot", page_icon="📊", layout="wide")
st.title("📊 Due Diligence Copilot")
st.caption("Source-backed answers from annual reports, filings and presentations.")

if not os.getenv("ANTHROPIC_API_KEY"):
    st.error("Set ANTHROPIC_API_KEY in your .env file and restart.")
    st.stop()

with st.sidebar:
    st.header("1. Upload documents")
    company = st.text_input("Company name", placeholder="Reliance Industries")
    doc_type = st.selectbox("Document type", ["Annual Report", "Investor Presentation",
                                              "Financial Statements", "Market Report", "Filing"])
    fy = st.text_input("Fiscal year (optional)", placeholder="FY2024")
    files = st.file_uploader("PDF or Excel", type=["pdf", "xlsx", "xls"], accept_multiple_files=True)
    if st.button("Ingest", type="primary", disabled=not (company and files)):
        for f in files:
            with st.spinner(f"Processing {f.name}..."):
                suffix = os.path.splitext(f.name)[1]
                with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                    tmp.write(f.getbuffer())
                n = ingest.ingest_file(tmp.name, f.name, company.strip(), doc_type, fy.strip())
                os.unlink(tmp.name)
            st.success(f"{f.name}: {n} chunks indexed") if n else st.warning(f"{f.name}: no text found (scanned?)")

    st.divider()
    st.header("2. Pick company")
    companies = store.list_companies()
    selected = st.selectbox("Company", companies) if companies else None


def show_sources(sources):
    for s in sources:
        with st.expander(f"[{s['label']}] {s['doc_type']} - {s['file']} - page {s['page']}"):
            st.caption(f"Section: {s['section']}  |  FY: {s['fiscal_year'] or 'n/a'}")
            st.text(s["text"])


if not selected:
    st.info("Upload and ingest documents in the sidebar to get started.")
    st.stop()

ask_tab, risk_tab = st.tabs(["💬 Ask a question", "⚠️ Risk report"])

with ask_tab:
    q = st.text_input("Question", placeholder="What are the major financial risks of this company?")
    if st.button("Ask") and q:
        with st.spinner("Searching documents..."):
            res = rag.answer_question(selected, q)
        st.markdown(res["answer"])
        if not res["verified"]:
            st.warning("Citation check failed or no citations found. Treat this answer with caution.")
        if res["sources"]:
            st.subheader("Sources")
            show_sources(res["sources"])

with risk_tab:
    if st.button("Generate risk report"):
        bar = st.progress(0.0, text="Starting...")
        report = rag.generate_risk_report(selected, progress=lambda p, t: bar.progress(p, text=t))
        bar.empty()
        if report["summary"]:
            st.subheader("Executive summary")
            st.write(report["summary"])
        icon = {"High": "🔴", "Medium": "🟠", "Low": "🟢"}
        for f in sorted(report["findings"], key=lambda x: ["High", "Medium", "Low"].index(x["severity"])
                        if x["severity"] in icon else 1):
            st.markdown(f"### {icon.get(f['severity'], '🟠')} {f['risk']}")
            st.caption(f"{f['category']} - Severity: {f['severity']}")
            st.write(f["evidence"])
            show_sources(f["sources"])
        if not report["findings"]:
            st.info("No cited risks found in the indexed documents.")
