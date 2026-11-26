from fastapi import APIRouter, Request
from app.schemas.analysis import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def get_health_status(request: Request):
    """
    Check backend health status and ML model checkpoint/scaler readiness.
    """
    inference_service = request.app.state.inference_service
    health_data = inference_service.get_health_status()
    return health_data
