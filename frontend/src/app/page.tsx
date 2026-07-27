"use client";

import { useState, useRef, useEffect } from "react";

interface ResearchResponse {
  query: string;
  reports: string[];
  summaries: string[];
  iterations: number;
}

interface LogEntry {
  text: string;
  type: string;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [iterations, setIterations] = useState(2);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ResearchResponse | null>(null);
  const [openCards, setOpenCards] = useState<Record<number, boolean>>({});
  const [openRaw, setOpenRaw] = useState<Record<number, boolean>>({});

  // Pipeline state
  const [pipeState, setPipeState] = useState({
    start: "",
    researcher: "",
    judge: "",
    end: "",
  });
  const [arrows, setArrows] = useState([false, false, false]);

  const termBodyRef = useRef<HTMLDivElement>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

  useEffect(() => {
    if (termBodyRef.current) {
      termBodyRef.current.scrollTop = termBodyRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (text: string, type = "") => {
    setLogs((prev) => [...prev, { text, type }]);
  };

  const resetPipeline = () => {
    setPipeState({ start: "", researcher: "", judge: "", end: "" });
    setArrows([false, false, false]);
  };

  const toggleCard = (index: number) => {
    setOpenCards((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const toggleRaw = (index: number) => {
    setOpenRaw((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const runResearch = async () => {
    if (!query.trim()) {
      setError("Query cannot be empty.");
      return;
    }
    setError(null);
    setLoading(true);
    setLogs([]);
    setResults(null);
    resetPipeline();

    setPipeState((prev) => ({ ...prev, start: "done" }));
    setArrows([true, false, false]);

    addLog("Initialising agent...", "info");
    addLog(`query: "${query}"`, "");
    addLog(`max_iterations: ${iterations}`, "");
    addLog("model: Llama + tavily-search", "");
    addLog("Building StateGraph...", "info");

    try {
      const url = `${API_BASE}/research/stream?query=${encodeURIComponent(query)}&max_iterations=${iterations}`;
      const response = await fetch(url);

      if (!response.ok) throw new Error(`Server responded with ${response.status}`);

      setPipeState((prev) => ({ ...prev, researcher: "active" }));

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = JSON.parse(line.slice(6));

            if (data.done) {
              setPipeState({ start: "done", researcher: "done", judge: "done", end: "done" });
              setArrows([true, true, true]);
              addLog("Agent complete.", "done");
              break;
            }

            addLog(`[iter ${data.iteration}] node: ${data.node}`, "info");
            if (data.summary) {
              addLog(`Finding: ${data.summary.slice(0, 120)}...`, "done");
            }

            setPipeState((prev) => ({ ...prev, researcher: "active", judge: "active" }));
            setArrows([true, true, false]);
          }
        }
      }

      addLog("Fetching complete results...", "info");
      const fullRes = await fetch(`${API_BASE}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, max_iterations: iterations }),
      });

      if (!fullRes.ok) {
        const err = await fullRes.json();
        throw new Error(err.detail || "Unknown server error");
      }

      const data: ResearchResponse = await fullRes.json();
      setResults(data);

      const initialOpenState: Record<number, boolean> = {};
      data.summaries.forEach((_, i) => (initialOpenState[i] = true));
      setOpenCards(initialOpenState);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
      addLog("Failed: " + err.message, "warn");
    } finally {
      setLoading(false);
    }
  };

  const getPrefix = (type: string) => {
    switch (type) {
      case "warn": return "!";
      case "info": return "$";
      case "done": return "+";
      default: return ">";
    }
  };

  return (
    <div className="container">
      {/* Header */}
      <header>
        <div className="header-badge">
          LangGraph Agent — Powered by LLama + Tavily
        </div>
        <h1>ResearchMind</h1>
        <p className="subtitle">
          // multi-iteration AI research agent with iterative retrieval
        </p>
      </header>

      {/* Input Card */}
      <div className="input-card">
        <div className="input-label">// research_query.txt</div>
        <div className="input-row">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. What are the top 3 AI trends in 2026?"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                runResearch();
              }
            }}
          />
        </div>

        <div className="suggestions">
          {[
            "Top AI trends in 2026",
            "Latest breakthroughs in quantum computing",
            "How does RAG work in LLMs?",
            "Best Python frameworks for ML in 2025",
          ].map((text) => (
            <span
              key={text}
              className="suggestion-chip"
              onClick={() => setQuery(text)}
            >
              {text}
            </span>
          ))}
        </div>

        <div style={{ height: "1px", background: "var(--border)", margin: "1.25rem 0" }} />

        <div className="controls-row">
          <div className="iter-control">
            <span>Iterations</span>
            <input
              type="range"
              min="1"
              max="5"
              value={iterations}
              step="1"
              onChange={(e) => setIterations(parseInt(e.target.value))}
            />
            <span className="iter-val">{iterations}</span>
            <span style={{ color: "var(--text3)", fontSize: "11px" }}>
              (more = deeper research)
            </span>
          </div>

          <button
            className={`run-btn ${loading ? "loading" : ""}`}
            onClick={runResearch}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                <span className="btn-text">RESEARCHING...</span>
              </>
            ) : (
              <span className="btn-icon">&#9654; RUN AGENT</span>
            )}
          </button>
        </div>
      </div>

      {/* Pipeline Visualiser */}
      <div className="pipeline">
        <div className="pipe-node">
          <div className={`pipe-dot ${pipeState.start}`}>&#9679;</div>
          <span className={`pipe-label ${pipeState.start}`}>START</span>
        </div>
        <div className={`pipe-arrow ${arrows[0] ? "active" : ""}`} />
        <div className="pipe-node">
          <div className={`pipe-dot ${pipeState.researcher}`}>&#128269;</div>
          <span className={`pipe-label ${pipeState.researcher}`}>RESEARCHER</span>
        </div>
        <div className={`pipe-arrow ${arrows[1] ? "active" : ""}`} />
        <div className="pipe-node">
          <div className={`pipe-dot ${pipeState.judge}`}>&#9878;</div>
          <span className={`pipe-label ${pipeState.judge}`}>JUDGE</span>
        </div>
        <div className={`pipe-arrow ${arrows[2] ? "active" : ""}`} />
        <div className="pipe-node">
          <div className={`pipe-dot ${pipeState.end}`}>&#9632;</div>
          <span className={`pipe-label ${pipeState.end}`}>END</span>
        </div>
      </div>

      {/* Error */}
      {error && <div className="error-box">// ERROR: {error}</div>}

      {/* Terminal log */}
      {logs.length > 0 && (
        <div className="terminal">
          <div className="terminal-header">
            <div className="term-dots">
              <div className="term-dot"></div>
              <div className="term-dot"></div>
              <div className="term-dot"></div>
            </div>
            <span className="term-title">agent_log — live output</span>
          </div>
          <div className="terminal-body" ref={termBodyRef}>
            {logs.map((log, i) => (
              <div key={i} className="log-line">
                <span className={`log-prefix ${log.type === "done" ? "info" : log.type}`}>
                  {getPrefix(log.type)}
                </span>
                <span className={`log-text ${log.type === "done" ? "highlight" : ""}`}>
                  {log.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="results-section">
          <div className="results-header">
            <div className="results-title">Research Findings</div>
            <div className="results-meta">
              {results.iterations} iteration{results.iterations !== 1 ? "s" : ""} · {results.reports.length} report{results.reports.length !== 1 ? "s" : ""}
            </div>
          </div>

          <div className="stats-bar">
            <div className="stat-pill">
              <div className="stat-dot" style={{ background: "var(--accent)" }} />
              <span className="stat-key">query</span>
              <span className="stat-val" style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {results.query}
              </span>
            </div>
            <div className="stat-pill">
              <div className="stat-dot" style={{ background: "var(--accent2)" }} />
              <span className="stat-key">iterations</span>
              <span className="stat-val">{results.iterations}</span>
            </div>
            <div className="stat-pill">
              <div className="stat-dot" style={{ background: "var(--accent4)" }} />
              <span className="stat-key">sources</span>
              <span className="stat-val">{results.reports.length}</span>
            </div>
          </div>

          <div>
            {results.summaries.map((summary, i) => (
              <div key={i} className={`result-card ${openCards[i] ? "open" : ""}`}>
                <div className="result-card-header" onClick={() => toggleCard(i)}>
                  <span className="iter-badge">ITER {i + 1}</span>
                  <span className="result-card-title">Research Pass {i + 1}</span>
                  <span className="chevron">&#9660;</span>
                </div>
                <div className="result-card-body">
                  <div className="summary-text">{summary}</div>
                  <span className="raw-toggle" onClick={() => toggleRaw(i)}>
                    {openRaw[i] ? "// hide raw search data" : "// show raw search data"}
                  </span>
                  {openRaw[i] && (
                    <div className="raw-data">{results.reports[i] || ""}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
