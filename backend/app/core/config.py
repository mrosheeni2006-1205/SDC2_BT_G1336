import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict




class Settings(BaseSettings):
    PROJECT_NAME: str = "NeuroInsight AI - Brain Tumor IDH Classification"
    API_V1_STR: str = "/api/v1"
    
    # Base Directory
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    MODEL_DIR: Path = BASE_DIR / "model"
    MODEL_PATH: Path = MODEL_DIR / "best_multimodal_cnn_vit_idh.pth"
    CONFIG_PATH: Path = MODEL_DIR / "preprocessing_config.json"
    
    # Uploads and temporary processing
    MAX_UPLOAD_SIZE_MB: int = 100
    ALLOWED_EXTENSIONS: List[str] = [".nii", ".nii.gz"]
    TEMP_STORAGE_DIR: Path = BASE_DIR / "temp_uploads"

    # CORS Configuration
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "*"]

    # Database preparation (PostgreSQL)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/neuroinsight")

    model_config = SettingsConfigDict(case_sensitive=True)



settings = Settings()
