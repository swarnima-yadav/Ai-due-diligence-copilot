# AI Due Diligence Copilot

RAG-based due diligence platform: PDF/Excel ingestion with page metadata, hybrid retrieval (vector + BM25),
citation-verified answers, risk and growth analysis, executive summary with PDF export.

Stack: FastAPI, SQLite, ChromaDB, Sentence Transformers, PyMuPDF, ReportLab, vanilla JS dashboard.
LLM: Gemini / OpenAI / Groq / OpenRouter / Ollama / Claude (choose in `.env`).

## Run (Windows)
Double-click `setup.bat` once, then `run.bat`. See `START_HERE.txt`.

## Run (manual)
```
python -m venv .venv && .venv\Scripts\activate     (Mac/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env      (set LLM_PROVIDER and LLM_API_KEY)
uvicorn api:app --reload    -> http://127.0.0.1:8000   (API docs: /docs)
```
Tests: `pytest tests/`

## Not implemented yet
OCR for scanned PDFs, financial-table extraction and trend charts, chat-session persistence, authentication.
