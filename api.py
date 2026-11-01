"""FastAPI backend. Run: uvicorn api:app --reload   (docs at /docs)"""
import collections
import hashlib
import json
import logging
import os
import re
import tempfile
import time
import uuid

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import analysis
import config  # noqa: F401  (loads .env)
import db
import ingest
import llm
import rag
import reports
import retriever
import store

log = logging.getLogger("ddc")
db.init()
app = FastAPI(title="AI Due Diligence Copilot API", version="0.4.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:5500,http://localhost:5500").split(",")],
    allow_methods=["*"], allow_headers=["*"])

MAX_BYTES = int(os.getenv("MAX_UPLOAD_MB", "50")) * 1024 * 1024
RATE = int(os.getenv("AI_RATE_PER_MIN", "10"))
MAGIC = {".pdf": (b"%PDF-",), ".xlsx": (b"PK",), ".xls": (b"\xd0\xcf\x11\xe0",)}
JOBS: dict[str, dict] = {}
_hits: dict[str, list] = collections.defaultdict(list)
NAME = Field(min_length=1, max_length=120, pattern=r"^[^/\\]+$")


def rate_limit(request: Request):
    ip, t = (request.client.host if request.client else "?"), time.time()
    _hits[ip] = [x for x in _hits[ip] if t - x < 60]
    if len(_hits[ip]) >= RATE:
        raise HTTPException(429, "Too many AI requests. Please wait a minute and try again.")
    _hits[ip].append(t)


def need_key():
    if not llm.configured():
        raise HTTPException(503, "LLM not configured. " + llm.problem())


def need_company(name: str) -> dict:
    r = db.rows("SELECT * FROM companies WHERE name=?", (name,))
    if not r:
        raise HTTPException(404, f"Company '{name}' not found.")
    return r[0]


class CompanyIn(BaseModel):
    name: str = NAME
    industry: str = Field("", max_length=120)
    country: str = Field("", max_length=120)
    description: str = Field("", max_length=2000)


class AskIn(BaseModel):
    company: str
    question: str = Field(min_length=3, max_length=2000)


class CompanyRef(BaseModel):
    company: str


@app.get("/health")
def health():
    return {"status": "ok", "llm_key_configured": llm.configured(), "provider": llm.provider(), "model": llm.model()}


@app.get("/llm/test")
def llm_test():
    if not llm.configured():
        return {"ok": False, "error": llm.problem()}
    try:
        return {"ok": True, "provider": llm.provider(), "model": llm.model(),
                "reply": llm.complete("Reply with one short word.", "Say OK.", 20).strip()[:60]}
    except Exception as e:
        log.exception("llm test failed")
        return {"ok": False, "error": f"{type(e).__name__}: check your key, model name and internet connection."}


# ---------- companies ----------
@app.post("/companies", status_code=201)
def create_company(c: CompanyIn):
    if db.rows("SELECT 1 FROM companies WHERE name=?", (c.name,)):
        raise HTTPException(409, "A company with this name already exists.")
    db.run("INSERT INTO companies(name,industry,country,description,created_at) VALUES(?,?,?,?,?)",
           (c.name, c.industry, c.country, c.description, db.now()))
    return need_company(c.name)


@app.get("/companies")
def companies():
    return {"companies": [r["name"] for r in db.rows("SELECT name FROM companies ORDER BY name")]}


@app.get("/companies/details")
def company_details():
    return {"companies": db.rows(
        "SELECT c.*, (SELECT COUNT(*) FROM documents d WHERE d.company=c.name AND d.status='ready') AS documents "
        "FROM companies c ORDER BY c.name")}


@app.get("/companies/{company}")
def company_detail(company: str):
    c = need_company(company)
    c["documents"] = db.rows("SELECT * FROM documents WHERE company=? ORDER BY id DESC", (company,))
    c["reports"] = db.rows("SELECT id,kind,created_at FROM reports WHERE company=? ORDER BY id DESC", (company,))
    return c


@app.put("/companies/{company}")
def update_company(company: str, c: CompanyIn):
    need_company(company)
    if c.name != company:
        raise HTTPException(400, "Renaming is not supported; create a new company instead.")
    db.run("UPDATE companies SET industry=?, country=?, description=? WHERE name=?",
           (c.industry, c.country, c.description, company))
    return need_company(company)


@app.delete("/companies/{company}")
def delete_company(company: str):
    need_company(company)
    store.collection().delete(where={"company": company})
    for t in ("documents", "reports"):
        db.run(f"DELETE FROM {t} WHERE company=?", (company,))
    db.run("DELETE FROM companies WHERE name=?", (company,))
    retriever.clear_cache()
    return {"deleted": company}


# ---------- documents ----------
@app.post("/documents")
def upload_documents(company: str = Form(..., max_length=120, pattern=r"^[^/\\]+$"),
                     doc_type: str = Form("Annual Report"), fiscal_year: str = Form(""),
                     files: list[UploadFile] = File(...)):
    company = company.strip()
    db.ensure_company(company)
    results = []
    for f in files:
        name = os.path.basename(f.filename or "")
        ext = os.path.splitext(name)[1].lower()
        res = {"file": name, "chunks": 0, "status": "failed"}
        results.append(res)
        if ext not in MAGIC:
            res["error"] = "Unsupported file type. Upload PDF or Excel files."
            continue
        data = f.file.read(MAX_BYTES + 1)
        if len(data) > MAX_BYTES:
            res["error"] = f"File is larger than {MAX_BYTES // 1024 // 1024} MB."
            continue
        if not data.startswith(MAGIC[ext]):
            res["error"] = "File content does not match its extension."
            continue
        sha = hashlib.sha256(data).hexdigest()
        if db.rows("SELECT 1 FROM documents WHERE company=? AND sha256=?", (company, sha)):
            res.update(status="duplicate", error="This exact file was already uploaded for this company.")
            continue
        doc_id = db.run("INSERT INTO documents(company,filename,doc_type,fiscal_year,size,sha256,status,created_at) "
                        "VALUES(?,?,?,?,?,?,'processing',?)",
                        (company, name, doc_type, fiscal_year.strip(), len(data), sha, db.now()))
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(data)
        try:
            store.collection().delete(where={"$and": [{"company": company}, {"file": name}]})
            n = ingest.ingest_file(tmp.name, name, company, doc_type, fiscal_year.strip())
            if n:
                db.run("UPDATE documents SET status='ready', chunks=? WHERE id=?", (n, doc_id))
                res.update(status="ready", chunks=n)
            else:
                msg = "No extractable text. This looks like a scanned PDF; OCR is not implemented yet."
                db.run("UPDATE documents SET status='empty', error=? WHERE id=?", (msg, doc_id))
                res.update(status="empty", error=msg)
        except Exception:
            log.exception("ingest failed for %s", name)
            msg = "The file could not be processed. It may be corrupted or password-protected."
            db.run("UPDATE documents SET status='failed', error=? WHERE id=?", (msg, doc_id))
            res["error"] = msg
        finally:
            os.unlink(tmp.name)
    return {"company": company, "results": results}


@app.get("/companies/{company}/documents")
def list_documents(company: str):
    need_company(company)
    return {"documents": db.rows("SELECT * FROM documents WHERE company=? ORDER BY id DESC", (company,))}


@app.delete("/documents/{doc_id}")
def delete_document(doc_id: int):
    r = db.rows("SELECT * FROM documents WHERE id=?", (doc_id,))
    if not r:
        raise HTTPException(404, "Document not found.")
    store.collection().delete(where={"$and": [{"company": r[0]["company"]}, {"file": r[0]["filename"]}]})
    db.run("DELETE FROM documents WHERE id=?", (doc_id,))
    retriever.clear_cache()
    return {"deleted": doc_id}


# ---------- AI endpoints ----------
@app.post("/ask", dependencies=[Depends(rate_limit)])
def ask(req: AskIn):
    need_key()
    need_company(req.company)
    try:
        return rag.answer_question(req.company, req.question)
    except Exception:
        log.exception("ask failed")
        raise HTTPException(502, "The AI service returned an error. Check your key/model in Settings > Test connection.")


def _run_job(job_id: str, company: str, fn, kind: str):
    def progress(p, label):
        JOBS[job_id].update(progress=round(p, 2), stage=label)
    try:
        result = fn(company, progress=progress)
        db.run("INSERT INTO reports(company,kind,content,created_at) VALUES(?,?,?,?)",
               (company, kind, json.dumps(result), db.now()))
        JOBS[job_id].update(result=result, status="done")
    except Exception:
        log.exception("%s job failed", kind)
        JOBS[job_id].update(status="error", error="Analysis failed. Check your key/model in Settings > Test connection.")


def _start(company: str, fn, kind: str, bg: BackgroundTasks):
    need_key()
    need_company(company)
    job_id = uuid.uuid4().hex[:12]
    JOBS[job_id] = {"status": "running", "progress": 0.0, "stage": "Starting", "result": None}
    bg.add_task(_run_job, job_id, company, fn, kind)
    return {"job_id": job_id}


@app.post("/risk-report", status_code=202, dependencies=[Depends(rate_limit)])
def start_risk(req: CompanyRef, bg: BackgroundTasks):
    return _start(req.company, analysis.risk_report, "risk", bg)


@app.post("/growth-report", status_code=202, dependencies=[Depends(rate_limit)])
def start_growth(req: CompanyRef, bg: BackgroundTasks):
    return _start(req.company, analysis.growth_report, "growth", bg)


@app.get("/risk-report/{job_id}")
@app.get("/jobs/{job_id}")
def job_status(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(404, "Unknown job id.")
    return JOBS[job_id]


# ---------- reports ----------
@app.post("/companies/{company}/executive-summary", dependencies=[Depends(rate_limit)])
def executive_summary(company: str):
    need_key()
    profile = need_company(company)
    try:
        rep = analysis.executive_summary(company, {k: profile[k] for k in ("industry", "country", "description")})
    except Exception:
        log.exception("executive summary failed")
        raise HTTPException(502, "The AI service returned an error. Check your key/model in Settings > Test connection.")
    if rep is None:
        raise HTTPException(422, "No processed documents for this company. Upload a text-based PDF first.")
    rid = db.run("INSERT INTO reports(company,kind,content,created_at) VALUES(?,?,?,?)",
                 (company, "executive_summary", json.dumps(rep), db.now()))
    return {"id": rid, "report": rep}


@app.get("/companies/{company}/reports")
def list_reports(company: str):
    need_company(company)
    return {"reports": db.rows("SELECT id,kind,created_at FROM reports WHERE company=? ORDER BY id DESC", (company,))}


def _report(rid: int) -> dict:
    r = db.rows("SELECT * FROM reports WHERE id=?", (rid,))
    if not r:
        raise HTTPException(404, "Report not found.")
    r[0]["content"] = json.loads(r[0]["content"])
    return r[0]


@app.get("/reports/{rid}")
def get_report(rid: int):
    return _report(rid)


@app.get("/reports/{rid}/pdf")
def report_pdf(rid: int):
    r = _report(rid)
    if r["kind"] != "executive_summary":
        raise HTTPException(400, "Only executive summaries can be exported as PDF.")
    pdf = reports.build_pdf(r["company"], r["created_at"], r["content"])
    safe = re.sub(r"[^A-Za-z0-9_-]+", "_", r["company"])
    return Response(pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{safe}_executive_summary.pdf"'})


app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", include_in_schema=False)
def index():
    return FileResponse("static/index.html")
