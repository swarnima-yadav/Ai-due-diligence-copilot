import pytest
import db, reports


def test_db_duplicate_documents(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "t.db"))
    db.init()
    db.ensure_company("Acme")
    db.run("INSERT INTO documents(company,filename,sha256,status) VALUES('Acme','a.pdf','x','ready')")
    with pytest.raises(Exception):
        db.run("INSERT INTO documents(company,filename,sha256,status) VALUES('Acme','b.pdf','x','ready')")


def test_pdf_export():
    rep = {"sections": {"Company overview": "- Point one [S1]\nA & B <test>"},
           "sources": [{"label": "S1", "file": "ar.pdf", "page": "5", "doc_type": "Annual Report"}]}
    assert reports.build_pdf("Acme & Co", "2026-10-10", rep).startswith(b"%PDF")


def test_chunking_and_tables():
    pytest.importorskip("chromadb")
    import ingest
    chunks = ingest.split_text("Sentence number one. " * 200)
    assert len(chunks) > 1 and all(len(c) <= 1300 for c in chunks)
    assert ingest.rows_to_md([["Year", "Revenue"], ["FY24", "100"]]).splitlines()[0] == "| Year | Revenue |"


def test_json_parsing():
    pytest.importorskip("chromadb")
    import rag
    assert rag._parse_json('```json\n[{"a": 1}]\n```') == [{"a": 1}]
    assert rag._parse_json("no json here") == []


def test_llm_configuration(monkeypatch):
    import llm
    for k in ("LLM_API_KEY", "ANTHROPIC_API_KEY", "LLM_MODEL"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    assert not llm.configured() and "LLM_API_KEY" in llm.problem()
    monkeypatch.setenv("LLM_API_KEY", "x")
    assert llm.configured() and llm.model().startswith("gemini")
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    assert llm.configured()
    monkeypatch.setenv("LLM_PROVIDER", "nope")
    assert not llm.configured() and "Unknown" in llm.problem()
