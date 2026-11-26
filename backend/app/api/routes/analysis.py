import os
import shutil
import uuid
from pathlib import Path
from typing import Dict, Any
from fastapi import APIRouter, Form, UploadFile, File, HTTPException, Request, Response
from fastapi.responses import PlainTextResponse

from app.core.config import settings
from app.ml.preprocessing import validate_nifti_file
from app.db.models import AnalysisRecord, save_analysis, get_analysis_by_id
from app.utils.report_generator import generate_text_report

router = APIRouter()


@router.post("/analyze")
async def analyze_patient_data(
    request: Request,
    patient_id: str = Form(..., description="Patient Reference ID"),
    age: float = Form(..., description="Patient Age"),
    sex: str = Form(..., description="Patient Sex ('Male' or 'Female')"),
    t1: UploadFile = File(..., description="T1-weighted MRI (.nii / .nii.gz)"),
    t1ce: UploadFile = File(..., description="T1ce-weighted MRI (.nii / .nii.gz)"),
    t2: UploadFile = File(..., description="T2-weighted MRI (.nii / .nii.gz)"),
    flair: UploadFile = File(..., description="FLAIR-weighted MRI (.nii / .nii.gz)"),
):
    """
    Process patient clinical data and 4 MRI modalities (T1, T1ce, T2, FLAIR) for IDH classification.
    """
    # 1. Input Validation
    if not patient_id.strip():
        raise HTTPException(status_code=400, detail="Patient ID must not be empty.")

    if age < 0 or age > 120:
        raise HTTPException(status_code=422, detail="Patient age must be between 0 and 120 years.")

    sex_clean = sex.strip().upper()
    if sex_clean not in ("M", "MALE", "F", "FEMALE"):
        raise HTTPException(status_code=422, detail="Patient sex must be 'Male' or 'Female'.")

    # Modality map
    files_map: Dict[str, UploadFile] = {
        "T1": t1,
        "T1ce": t1ce,
        "T2": t2,
        "FLAIR": flair,
    }

    # Verify all four modalities present
    for mod_name, upload_file in files_map.items():
        if not upload_file or not upload_file.filename:
            raise HTTPException(status_code=400, detail=f"Missing upload file for modality '{mod_name}'.")

        filename = upload_file.filename.lower()
        if not (filename.endswith(".nii") or filename.endswith(".nii.gz")):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file extension for modality '{mod_name}'. Accepted formats are .nii and .nii.gz."
            )

    # 2. Temporary File Handling (Randomized secure paths with automatic cleanup)
    analysis_id = str(uuid.uuid4())
    session_temp_dir = settings.TEMP_STORAGE_DIR / analysis_id
    session_temp_dir.mkdir(parents=True, exist_ok=True)
    temp_file_paths: Dict[str, Path] = {}

    try:
        for mod_name, upload_file in files_map.items():
            ext = ".nii.gz" if upload_file.filename.lower().endswith(".nii.gz") else ".nii"
            safe_temp_path = session_temp_dir / f"{mod_name}_{uuid.uuid4().hex[:8]}{ext}"

            # Save uploaded content to temp path with size limit check
            bytes_written = 0
            max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024

            with open(safe_temp_path, "wb") as buffer:
                underlying = getattr(upload_file, "file", None)
                if underlying and hasattr(underlying, "read"):
                    while chunk := underlying.read(1024 * 1024):
                        bytes_written += len(chunk)
                        if bytes_written > max_bytes:
                            raise HTTPException(
                                status_code=413,
                                detail=f"File '{upload_file.filename}' exceeds maximum allowed upload size ({settings.MAX_UPLOAD_SIZE_MB}MB)."
                            )
                        buffer.write(chunk)
                else:
                    while chunk := await upload_file.read(1024 * 1024):
                        bytes_written += len(chunk)
                        if bytes_written > max_bytes:
                            raise HTTPException(
                                status_code=413,
                                detail=f"File '{upload_file.filename}' exceeds maximum allowed upload size ({settings.MAX_UPLOAD_SIZE_MB}MB)."
                            )
                        buffer.write(chunk)

            # Validate NIfTI structure
            is_valid, err_msg = validate_nifti_file(safe_temp_path)
            if not is_valid:
                raise HTTPException(status_code=422, detail=f"Validation failed for modality '{mod_name}': {err_msg}")

            temp_file_paths[mod_name] = safe_temp_path

        # 3. Run Inference Engine with Explainability Pre-generation
        inference_service = request.app.state.inference_service
        try:
            result = inference_service.predict(
                mri_modality_inputs=temp_file_paths,
                age=age,
                sex="Female" if sex_clean in ("F", "FEMALE") else "Male",
                analysis_id=analysis_id,
                patient_id=patient_id.strip(),
            )
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Internal inference failure during MRI preprocessing or forward pass: {str(e)}"
            )

        # 4. Save analysis record into repository
        record = AnalysisRecord(
            analysis_id=analysis_id,
            patient_reference=patient_id.strip(),
            age=age,
            sex="Female" if sex_clean in ("F", "FEMALE") else "Male",
            prediction_class=result["prediction"]["class"],
            prediction_label=result["prediction"]["label"],
            wild_type_probability=result["probabilities"]["idh_wild_type"],
            mutated_probability=result["probabilities"]["idh_mutated"],
            model_version=result["model"]["version"],
            degraded_mode=result["model"].get("degraded_mode", False),
            architecture=result["model"].get("architecture", "MultimodalCNNViT"),
        )
        save_analysis(record)
        res_dict = record.to_dict()
        res_dict["model"]["explainability_ready"] = result["model"].get("explainability_ready", False)
        return res_dict

    finally:
        # 5. Security & Privacy: Clean up temporary files immediately
        if session_temp_dir.exists():
            shutil.rmtree(session_temp_dir, ignore_errors=True)


@router.get("/analysis/{analysis_id}/explainability")
async def get_analysis_explainability(request: Request, analysis_id: str):
    """
    Retrieve SHAP modality/clinical feature attributions and 3D Grad-CAM++ visualizations for an analysis ID.
    """
    inference_service = request.app.state.inference_service
    explain_data = inference_service.get_explainability(analysis_id)
    if not explain_data:
        record = get_analysis_by_id(analysis_id)
        if not record:
            raise HTTPException(status_code=404, detail=f"Analysis ID '{analysis_id}' not found.")
        raise HTTPException(
            status_code=404,
            detail="Explainability session expired or not available in cache. Please re-run analysis to generate fresh XAI explanations."
        )
    return explain_data


@router.get("/analysis/{analysis_id}/gradcam/slice")
async def get_gradcam_slice(
    request: Request,
    analysis_id: str,
    modality: str = "FLAIR",
    slice_idx: int = 48,
    opacity: float = 0.6,
):
    """
    Dynamically render and retrieve a specific 2D MRI slice with Grad-CAM++ overlay and colormapped heatmap.
    """
    inference_service = request.app.state.inference_service
    slice_data = inference_service.get_gradcam_slice(
        analysis_id=analysis_id,
        modality=modality,
        slice_idx=slice_idx,
        opacity=opacity,
    )
    if not slice_data:
        raise HTTPException(
            status_code=404,
            detail=f"Slice data for analysis ID '{analysis_id}' not found in active cache."
        )
    return slice_data


@router.get("/analysis/{analysis_id}")
async def get_analysis_record(analysis_id: str):
    """
    Retrieve completed analysis details by ID.
    """
    record = get_analysis_by_id(analysis_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Analysis ID '{analysis_id}' not found.")
    return record


@router.get("/analysis/{analysis_id}/report")
async def download_analysis_report(analysis_id: str):
    """
    Download a formatted text report for an analysis ID.
    """
    record = get_analysis_by_id(analysis_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Analysis ID '{analysis_id}' not found.")

    report_text = generate_text_report(record)
    return PlainTextResponse(
        content=report_text,
        media_type="text/plain",
        headers={
            "Content-Disposition": f"attachment; filename=neuroinsight_idh_report_{analysis_id[:8]}.txt"
        }
    )
