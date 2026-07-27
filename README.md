# ResearchMind — LangGraph AI Research Agent

A full-stack, iterative AI research application powered by **LangGraph**, **FastAPI**, **ChatGroq (Llama 3.3)**, **Tavily Search**, and **Next.js**.

---

## 🏗️ Project Architecture

```text
research-mind/
├── backend/                  # FastAPI + LangGraph server
│   ├── main.py              # LangGraph workflow & API routes
│   ├── requirements.txt     # Python dependencies
│   └── .env                 # API keys (local setup)
└── frontend/                 # Next.js App Router frontend
    ├── src/
    │   └── app/
    │       ├── page.tsx     # Terminal UI & research runner
    │       └── globals.css  # Dark terminal theme styles
    ├── package.json
    └── .env.local           # Next.js environment configuration