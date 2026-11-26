# NeuroInsight AI - API Documentation

The NeuroInsight AI Backend exposes RESTful endpoints built with FastAPI.

Base URL: `/api/v1`

---

## Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Backend and ML model readiness status |
| `POST` | `/api/v1/analyze` | Execute multimodal IDH classification |
| `GET` | `/api/v1/analysis/{id}` | Fetch completed analysis details |
| `GET` | `/api/v1/analysis/{id}/report` | Download formatted text report |

---

## 1. Health Check
`GET /api/v1/health`

### Response (Model Ready)
```json
{
  "status": "ok",
  "model_loaded": true,
  "age_scaler_configured": true,
  "checkpoint_path": "C:\\SDC2_Project\\backend\\model\\best_multimodal_cnn_vit_idh.pth",
  "config_path": "C:\\SDC2_Project\\backend\\model\\preprocessing_config.json",
  "device": "cpu",
  "details": {
    "checkpoint_exists": true,
    "error": null,
    "age_scaler_note": null
  }
}
```

---

## 2. Execute Analysis
`POST /api/v1/analyze`

Content-Type: `multipart/form-data`

### Form Parameters
- `patient_id` (string): Patient Reference Identifier
- `age` (float): Patient age (0 - 120)
- `sex` (string): 'Male' or 'Female'
- `t1` (file): T1-weighted NIfTI volume (`.nii` or `.nii.gz`)
- `t1ce` (file): T1ce-weighted NIfTI volume (`.nii` or `.nii.gz`)
- `t2` (file): T2-weighted NIfTI volume (`.nii` or `.nii.gz`)
- `flair` (file): FLAIR NIfTI volume (`.nii` or `.nii.gz`)

### Response (200 OK)
```json
{
  "analysis_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "status": "completed",
  "created_at": "2026-09-21T11:45:00.000Z",
  "patient": {
    "patient_id": "PAT-2026-089",
    "age": 58.0,
    "sex": "Female"
  },
  "mri_modalities": ["T1", "T1ce", "T2", "FLAIR"],
  "prediction": {
    "class": 1,
    "label": "IDH Mutated"
  },
  "probabilities": {
    "idh_wild_type": 0.1258,
    "idh_mutated": 0.8742
  },
  "model": {
    "name": "Multimodal CNN-Vision Transformer",
    "version": "1.0",
    "degraded_mode": false
  },
  "disclaimer": "This application is a research and educational decision-support system..."
}
```
