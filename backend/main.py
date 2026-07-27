import asyncio
import json
import operator
import os
from typing import Annotated, List, TypedDict
import time

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_tavily import TavilySearch
from langchain_groq import ChatGroq
from langgraph.graph import END, START, StateGraph
from pydantic import BaseModel

app = FastAPI(title="LangGraph Research Agent API")
load_dotenv()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── State ──────────────────────────────────────────────────────────────────────
class AgentState(TypedDict):
    query: str
    reports: Annotated[List[str], operator.add]
    iteration: int
    summaries: Annotated[List[str], operator.add]


# ── Request / Response schemas ─────────────────────────────────────────────────
class ResearchRequest(BaseModel):
    query: str
    max_iterations: int = 2


class ResearchResponse(BaseModel):
    query: str
    reports: List[str]
    summaries: List[str]
    iterations: int


def build_graph(max_iterations: int = 2):
    llm = ChatGroq(
        model="llama-3.3-70b-versatile",  
        temperature=0.3,  # Slight temperature allows variation in query generation
        max_retries=2
    )
    search_tool = TavilySearch(max_results=3)

    def research_node(state: AgentState):
        current_query = state["query"]
        
        # 1. If we are past iteration 0, ask LLM to generate a deeper follow-up search query
        if state["iteration"] > 0 and state["summaries"]:
            previous_summary = state["summaries"][-1]
            query_prompt = (
                f"Original query: '{state['query']}'\n"
                f"Current finding: '{previous_summary}'\n\n"
                f"Formulate a NEW, different 3-5 word Google search query to find deeper technical details "
                f"or missing angles about this topic. Output ONLY the search query string."
            )
            current_query = llm.invoke(query_prompt).content.strip().replace('"', '')

        # 2. Search using the newly refined query
        results = search_tool.invoke(current_query)
        raw = str(results)

        # 3. Summarise findings for this pass
        summary_prompt = (
            f"You are a research assistant (Pass {state['iteration'] + 1}). "
            f"Based on these search results for query '{current_query}':\n\n{raw}\n\n"
            f"Write a concise 3-5 sentence research finding focusing on NEW details about '{state['query']}'."
        )
        summary = llm.invoke(summary_prompt).content

        return {
            "reports": [f"[{current_query}]: {raw}"],
            "summaries": [summary],
            "iteration": state["iteration"] + 1,
        }

    def judge_node(state: AgentState):
        if state["iteration"] >= max_iterations:
            return "complete"
        return "more_research"

    wf = StateGraph(AgentState)
    wf.add_node("researcher", research_node)
    wf.add_edge(START, "researcher")
    wf.add_conditional_edges(
        "researcher",
        judge_node,
        {"more_research": "researcher", "complete": END},
    )
    return wf.compile()


# ── Regular endpoint ───────────────────────────────────────────────────────────
@app.post("/research", response_model=ResearchResponse)
async def run_research(req: ResearchRequest):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    if req.max_iterations < 1 or req.max_iterations > 5:
        raise HTTPException(
            status_code=400, detail="max_iterations must be between 1 and 5."
        )

    graph = build_graph(req.max_iterations)
    final = await asyncio.to_thread(
        graph.invoke,
        {"query": req.query, "reports": [], "summaries": [], "iteration": 0},
    )
    return ResearchResponse(
        query=final["query"],
        reports=final["reports"],
        summaries=final["summaries"],
        iterations=final["iteration"],
    )


# ── Streaming SSE endpoint ────────────────────────────────────────────────────
@app.get("/research/stream")
async def stream_research(query: str, max_iterations: int = 2):
    if not query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    async def event_generator():
        graph = build_graph(max_iterations)

        def run():
            return list(
                graph.stream(
                    {"query": query, "reports": [], "summaries": [], "iteration": 0}
                )
            )

        steps = await asyncio.to_thread(run)
        for step in steps:
            for node_name, state in step.items():
                iteration = state.get("iteration", "?")
                summaries = state.get("summaries", [])
                latest_summary = summaries[-1] if summaries else ""
                payload = {
                    "node": node_name,
                    "iteration": iteration,
                    "summary": latest_summary,
                }
                yield f"data: {json.dumps(payload)}\n\n"
                await asyncio.sleep(0.1)

        yield 'data: {"done": true}\n\n'

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/health")
def health():
    return {"status": "ok"}
