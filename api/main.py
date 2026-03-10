from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import connect, disconnect
from routers import heatmap, repos, summary, timeline, languages

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect()
    yield
    await disconnect()

app = FastAPI(
    title="Dev Analytics API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(heatmap.router)
app.include_router(repos.router)
app.include_router(timeline.router)
app.include_router(summary.router)
app.include_router(languages.router)

@app.get("/health")
async def health():
    return {"status": "ok"}
