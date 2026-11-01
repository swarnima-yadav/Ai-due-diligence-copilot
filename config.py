from dotenv import load_dotenv

load_dotenv()

CHROMA_DIR = "storage/chroma"
COLLECTION = "filings"
EMBED_MODEL = "BAAI/bge-small-en-v1.5"
QUERY_PREFIX = "Represent this sentence for searching relevant passages: "
CHUNK_CHARS = 1200
CHUNK_OVERLAP = 150
TOP_K = 8
