"""Parse PDFs / Excel into page-aware chunks and store them in Chroma."""
import re
import fitz  # PyMuPDF
import pandas as pd
import config
import store
import retriever

HEADING_RE = re.compile(r"^[A-Z][A-Z0-9 ,&\-/()']{6,80}$")


def rows_to_md(rows: list[list]) -> str:
    rows = [[("" if c is None else str(c).replace("\n", " ").strip()) for c in r] for r in rows]
    rows = [r for r in rows if any(r)]
    if len(rows) < 2:
        return ""
    width = max(len(r) for r in rows)
    rows = [r + [""] * (width - len(r)) for r in rows]
    out = ["| " + " | ".join(rows[0]) + " |", "|" + "---|" * width]
    out += ["| " + " | ".join(r) + " |" for r in rows[1:]]
    return "\n".join(out)


def split_text(text: str) -> list[str]:
    text = text.strip()
    if len(text) <= config.CHUNK_CHARS:
        return [text] if text else []
    chunks, start = [], 0
    while start < len(text):
        end = min(start + config.CHUNK_CHARS, len(text))
        if end < len(text):  # prefer to break at a sentence/paragraph boundary
            cut = max(text.rfind("\n", start, end), text.rfind(". ", start, end))
            if cut > start + config.CHUNK_CHARS // 2:
                end = cut + 1
        chunks.append(text[start:end].strip())
        if end >= len(text):
            break
        start = end - config.CHUNK_OVERLAP
    return [c for c in chunks if c]


def parse_pdf(path: str) -> list[dict]:
    items, section = [], "Front matter"
    doc = fitz.open(path)
    for i, page in enumerate(doc, start=1):
        text = page.get_text("text")
        for line in text.splitlines():
            if HEADING_RE.match(line.strip()):
                section = line.strip().title()
        for c in split_text(text):
            items.append({"text": c, "page": str(i), "section": section, "kind": "text"})
        try:
            for t in page.find_tables().tables:
                md = rows_to_md(t.extract())
                if md:
                    items.append({"text": "TABLE:\n" + md[:4000], "page": str(i), "section": section, "kind": "table"})
        except Exception:
            pass  # table detection is best-effort
    return items


def parse_excel(path: str) -> list[dict]:
    items = []
    for name, df in pd.read_excel(path, sheet_name=None, header=None).items():
        rows = df.fillna("").values.tolist()
        header = rows[0] if rows else []
        for i in range(1, len(rows), 40):
            md = rows_to_md([header] + rows[i:i + 40])
            if md:
                items.append({"text": f"SHEET {name}:\n{md}", "page": f"Sheet {name}", "section": str(name), "kind": "table"})
    return items


def ingest_file(path: str, filename: str, company: str, doc_type: str, fiscal_year: str = "") -> int:
    items = parse_excel(path) if filename.lower().endswith((".xlsx", ".xls")) else parse_pdf(path)
    if not items:
        return 0
    col = store.collection()
    ids, docs, metas = [], [], []
    for n, it in enumerate(items):
        ids.append(f"{company}|{filename}|{n}")
        docs.append(it["text"])
        metas.append({"company": company, "doc_type": doc_type, "file": filename, "fiscal_year": fiscal_year,
                      "page": it["page"], "section": it["section"], "kind": it["kind"]})
    for s in range(0, len(ids), 256):
        sl = slice(s, s + 256)
        emb = store.embedder().encode(docs[sl], normalize_embeddings=True).tolist()
        col.upsert(ids=ids[sl], documents=docs[sl], metadatas=metas[sl], embeddings=emb)
    retriever.clear_cache()
    return len(ids)
