"""SQLite persistence: companies, documents, reports."""
import datetime
import os
import sqlite3

DB_PATH = "storage/app.db"


def _conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def init():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    c = _conn()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS companies(
        id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL, industry TEXT DEFAULT '',
        country TEXT DEFAULT '', description TEXT DEFAULT '', created_at TEXT);
    CREATE TABLE IF NOT EXISTS documents(
        id INTEGER PRIMARY KEY, company TEXT NOT NULL, filename TEXT, doc_type TEXT, fiscal_year TEXT,
        size INTEGER, sha256 TEXT, status TEXT, chunks INTEGER DEFAULT 0, error TEXT, created_at TEXT,
        UNIQUE(company, sha256));
    CREATE TABLE IF NOT EXISTS reports(
        id INTEGER PRIMARY KEY, company TEXT, kind TEXT, content TEXT, created_at TEXT);
    """)
    c.commit()
    c.close()


def rows(sql: str, args: tuple = ()) -> list[dict]:
    c = _conn()
    try:
        return [dict(r) for r in c.execute(sql, args).fetchall()]
    finally:
        c.close()


def run(sql: str, args: tuple = ()) -> int:
    c = _conn()
    try:
        cur = c.execute(sql, args)
        c.commit()
        return cur.lastrowid
    finally:
        c.close()


def ensure_company(name: str):
    run("INSERT OR IGNORE INTO companies(name, created_at) VALUES(?, ?)", (name, now()))
