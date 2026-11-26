import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from app.core.config import settings
from app.ml.inference import InferenceService
from app.api.routes import health, analysis

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("neuroinsight")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize ML inference service if not already loaded (avoid repeated loading)
    if not hasattr(app.state, "inference_service") or app.state.inference_service is None:
        logger.info("Initializing NeuroInsight AI inference service...")
        app.state.inference_service = InferenceService(settings.MODEL_DIR)
    yield
    # Shutdown
    logger.info("Shutting down NeuroInsight AI service...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(health.router, prefix=settings.API_V1_STR, tags=["Health"])
app.include_router(analysis.router, prefix=settings.API_V1_STR, tags=["Analysis"])


@app.get("/")
def root():
    return {
        "application": settings.PROJECT_NAME,
        "status": "online",
        "docs": f"{settings.API_V1_STR}/docs",
        "health": f"{settings.API_V1_STR}/health",
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal server error occurred. Please verify your inputs and try again.",
            "error_type": exc.__class__.__name__
        },
    )
