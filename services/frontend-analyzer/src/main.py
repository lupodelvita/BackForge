from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from src.analyzer import FrontendAnalyzer, _build_project_state_json
from src.models import AnalyzeRequest, AnalyzeResponse
from src.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

analyzer: FrontendAnalyzer | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global analyzer
    analyzer = FrontendAnalyzer()
    logger.info("Frontend Analyzer started (model: %s)", settings.ollama_model)
    yield
    if analyzer:
        await analyzer.ollama.aclose()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    return {"status": "ok", "version": settings.app_version}


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    if not analyzer:
        raise HTTPException(status_code=503, detail="Analyzer not initialized")
    result = await analyzer.analyze(request)
    project_state_json = _build_project_state_json(request.project_name, result)
    return AnalyzeResponse(
        project_name=request.project_name,
        language=request.language,
        result=result,
        project_state_json=project_state_json,
    )
