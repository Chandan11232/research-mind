# ResearchMind — LangGraph Research Agent

A full-stack AI research agent built with LangGraph, Gemini, and Tavily.

---

## Project Structure

```
langgraph-app/
├── backend/
│   ├── main.py              # FastAPI backend
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Environment variable template
└── frontend/
    └── index.html           # Single-file frontend (no build step needed)
```

---

## Local Setup

### 1. Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env and add your real keys:
#   GOOGLE_API_KEY=...
#   TAVILY_API_KEY=...

# Run the server
uvicorn main:app --reload --port 8000
```

Backend will be live at: http://localhost:8000
Interactive API docs at: http://localhost:8000/docs

### 2. Frontend

Just open `frontend/index.html` in a browser. No build step needed.

> Make sure `API_BASE` in index.html matches your backend URL:
> ```js
> const API_BASE = "http://localhost:8000";  // local
> ```

---

## Getting API Keys

| Key | Where to get it |
|-----|----------------|
| `GOOGLE_API_KEY` | https://aistudio.google.com/app/apikey |
| `TAVILY_API_KEY` | https://app.tavily.com (free tier available) |

---

## Deployment

### Option A — Railway (Easiest, free tier available)

1. Push your project to a GitHub repo
2. Go to https://railway.app → New Project → Deploy from GitHub
3. Select your repo, set the root to `backend/`
4. Add environment variables in Railway dashboard:
   - `GOOGLE_API_KEY`
   - `TAVILY_API_KEY`
5. Railway auto-detects FastAPI and deploys it
6. Copy your Railway URL (e.g. `https://researchmind.up.railway.app`)
7. In `frontend/index.html`, update:
   ```js
   const API_BASE = "https://researchmind.up.railway.app";
   ```
8. Deploy frontend to Railway as a static site, or use Vercel/Netlify

---

### Option B — Render (Free tier, no credit card)

1. Push to GitHub
2. Go to https://render.com → New Web Service
3. Connect GitHub repo, set:
   - Root directory: `backend`
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables in Render dashboard
5. Deploy frontend `index.html` as a Static Site on Render

---

### Option C — Docker (Self-host anywhere)

Create `backend/Dockerfile`:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
docker build -t researchmind-backend ./backend
docker run -p 8000:8000 \
  -e GOOGLE_API_KEY=your_key \
  -e TAVILY_API_KEY=your_key \
  researchmind-backend
```

---

### Option D — Vercel + Railway (Production)

- Backend → Railway (persistent, always-on)
- Frontend → Vercel (drag and drop `index.html`)
  - https://vercel.com → New Project → drag frontend folder

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/research` | Run full research, returns JSON |
| GET | `/research/stream` | Streaming SSE endpoint |
| GET | `/health` | Health check |

### POST /research
```json
{
  "query": "What are the top AI trends in 2026?",
  "max_iterations": 2
}
```

### Response
```json
{
  "query": "...",
  "reports": ["raw search data..."],
  "summaries": ["LLM-generated summary..."],
  "iterations": 2
}
```

---

## Troubleshooting

**CORS errors in browser** → The backend already has CORS enabled for all origins. If you still see errors, check that `API_BASE` in the frontend matches your backend URL exactly (no trailing slash).

**`ModuleNotFoundError`** → Make sure you activated your virtual environment before running uvicorn.

**Tavily returns no results** → Check your `TAVILY_API_KEY` in `.env` is correct and not expired.

**Gemini quota error** → The free tier of Google AI Studio has rate limits. Add a delay between iterations or upgrade to a paid plan.
