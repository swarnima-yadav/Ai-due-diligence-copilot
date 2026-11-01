# Frontend (React + Vite + Tailwind + Recharts + Lucide)

Requires Node.js 18+ (https://nodejs.org).

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```
The backend must also be running: `uvicorn api:app --reload` (from the project root).
Vite proxies API calls to http://127.0.0.1:8000, so no CORS setup is needed in development.
