# GLIOMA-AI — PROJECT SPECIFICATION

## 1. PROJECT OVERVIEW

We are building a professional, research-oriented web application called GLIOMA-AI.

The purpose is to provide an AI-assisted multimodal glioma analysis workflow using brain MRI and selected clinical/molecular information.

This is a research/educational prototype and must NOT present itself as a clinical diagnostic or treatment system.

The application should look and behave like a serious real-world medical AI research platform, not a toy CRUD application.

The system will eventually connect:

Frontend → Backend API → MRI preprocessing → ML inference → Explainability → Results

The ML model is being developed separately by another team member. The application must therefore use a clean, replaceable inference-service architecture so that a mock model can be used during development and later replaced by the real model without redesigning the frontend or API.

---

## 2. DATASET AND ML CONTEXT

The research dataset is UTSW-Glioma.

The validated preprocessing pipeline currently has:

- 184 valid patients
- Four MRI modalities:
  - T1
  - T1CE
  - T2
  - FLAIR
- Original MRI dimensions:
  - 240 × 240 × 155
- Voxel spacing:
  - 1 × 1 × 1 mm
- Tumor segmentation was validated.
- Segmentation labels encountered:
  - 0
  - 1
  - 2
  - 4
- Three patients with empty segmentation were excluded.
- Final processed MRI volumes:
  - 128 × 128 × 128
- Four MRI modalities are treated as four channels.
- Final MRI tensor shape:
  - 128 × 128 × 128 × 4

The preprocessing pipeline includes:

1. NIfTI loading
2. Intensity normalization
3. Tumor segmentation processing
4. Tumor bounding box
5. 10-voxel margin
6. Tumor-centered ROI
7. Resize to 128 × 128 × 128
8. Stack T1/T1CE/T2/FLAIR as four channels

The backend inference preprocessing must eventually match the exact preprocessing used during ML training.

Do not independently invent a different preprocessing pipeline.

---

## 3. ML MODEL CONTEXT

The final ML architecture is being developed separately.

The planned research direction includes:

- multimodal MRI
- MRI feature extraction
- clinical feature processing
- multimodal feature fusion
- classification
- explainability

The exact final model architecture, prediction targets, clinical variables, and explainability method are NOT finalized yet.

Therefore:

- Do not hard-code assumptions that the model predicts tumor grade, tumor type, IDH, MGMT, etc.
- Do not expose clinical fields in the UI unless they are confirmed to be required by the final model.
- Do not invent model outputs.
- Use a replaceable mock inference service until the real model contract is available.
- The API must be designed so the real model can be integrated later.

The application must not claim medical accuracy or clinical validity.

---

## 4. TECHNOLOGY STACK

Use:

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS or an appropriate professional UI system
- Proper component architecture
- Responsive design

### Backend
- Python
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic
- PostgreSQL
- NIfTI handling using nibabel
- NumPy/SciPy where needed

### Development
- VS Code
- Git
- GitHub
- Environment variables using .env
- .env must never be committed

### ML
The final ML framework and model format will be determined by the separate ML development.

---

## 5. HIGH-LEVEL ARCHITECTURE

The system should follow:

User
 ↓
React Frontend
 ↓
REST API
 ↓
FastAPI Backend
 ↓
Validation
 ↓
Preprocessing Service
 ↓
Inference Service
 ↓
Explainability Service
 ↓
Database / Artifact Storage
 ↓
Results API
 ↓
React Results Dashboard

The backend must use a service-oriented structure.

Do NOT place all application logic inside main.py.

---

## 6. FRONTEND REQUIREMENTS

The frontend should be professional, minimal, modern, and appropriate for a medical AI research application.

Required major screens:

### Home
- GLIOMA-AI branding
- Brief explanation
- Multimodal MRI + clinical analysis
- Research/educational disclaimer
- Start Analysis button

### Analysis
- Patient information section
- Only confirmed model-required clinical fields
- MRI upload section
- Four MRI modalities:
  - T1
  - T1CE
  - T2
  - FLAIR
- Drag-and-drop or file picker
- Support .nii and .nii.gz
- Upload status
- Validation status
- Replace/remove file
- Clear validation errors
- Analyze button

Do not ask the end user to upload tumor segmentation unless the final inference pipeline explicitly requires it.

### Analysis Progress
Show real processing stages such as:

- Files validated
- Preprocessing
- Feature extraction
- Clinical processing
- Model inference
- Explainability
- Completed

Do not fake progress once the real backend is integrated.

### Results
Show only outputs actually produced by the model.

Possible sections include:
- primary prediction
- confidence
- class probabilities
- MRI visualization
- segmentation overlay
- explainability
- clinical feature contribution

### History
Show previous analysis records:
- analysis ID
- date/time
- prediction if available
- model version
- status

Clicking an analysis should open its result.

Do not add unnecessary:
- payments
- chatbots
- appointments
- social features
- doctor messaging
- treatment recommendations
- fake medical claims

---

## 7. BACKEND REQUIREMENTS

The backend should be production-oriented but appropriately scoped.

Suggested structure:

backend/
├── app/
│   ├── main.py
│   ├── api/
│   │   ├── dependencies.py
│   │   └── routes/
│   │       ├── health.py
│   │       ├── analyses.py
│   │       ├── predictions.py
│   │       └── files.py
│   ├── core/
│   │   ├── config.py
│   │   ├── logging.py
│   │   └── security.py
│   ├── schemas/
│   │   ├── analysis.py
│   │   ├── patient.py
│   │   └── prediction.py
│   ├── services/
│   │   ├── analysis_service.py
│   │   ├── validation_service.py
│   │   ├── preprocessing_service.py
│   │   ├── inference_service.py
│   │   └── explainability_service.py
│   ├── models/
│   │   ├── analysis.py
│   │   └── prediction.py
│   ├── db/
│   │   ├── session.py
│   │   └── base.py
│   └── utils/
├── ml/
├── storage/
│   └── temporary/
├── tests/
├── requirements.txt
├── .env.example
└── README.md

Do not create unnecessary microservices.

---

## 8. API DESIGN

Use versioned REST APIs.

Initial endpoints:

GET /api/v1/health

POST /api/v1/analyses

GET /api/v1/analyses

GET /api/v1/analyses/{analysis_id}

POST /api/v1/analyses/{analysis_id}/predict

GET /api/v1/analyses/{analysis_id}/results

GET /api/v1/analyses/{analysis_id}/artifacts/{artifact_type}

Potential DELETE endpoint may be added later.

Use Pydantic schemas for requests and responses.

Do not expose internal filesystem paths.

---

## 9. DATABASE

Use PostgreSQL.

Use:

- SQLAlchemy
- Alembic

The database should store structured metadata and results, NOT large MRI volumes.

Potential entities:

### analyses
- id
- patient_id
- status
- created_at
- completed_at
- model_version

### clinical_data
Only model-required clinical information.

### predictions
- id
- analysis_id
- predicted class
- confidence
- created_at

### prediction_probabilities
- prediction_id
- class name
- probability

### artifacts
- analysis_id
- artifact type
- storage reference
- created_at

Do not store raw NIfTI volumes inside PostgreSQL.

Use temporary filesystem/object storage for MRI files and generated artifacts.

---

## 10. FILE VALIDATION

The backend must independently validate MRI uploads.

Validate:

- extension
- readable NIfTI format
- dimensionality
- compatible modalities
- invalid/corrupt files
- file size limits

Do not rely only on frontend validation.

Do not silently accept invalid data.

---

## 11. ANALYSIS LIFECYCLE

An analysis should have a status such as:

CREATED
UPLOADING
VALIDATING
PREPROCESSING
INFERENCE
EXPLAINABILITY
COMPLETED
FAILED

The frontend should display appropriate states.

Errors should be represented using structured application errors rather than raw stack traces.

---

## 12. INFERENCE ARCHITECTURE

The ML model must be isolated behind an inference service.

The frontend must NOT directly interact with the ML model.

The flow is:

Frontend
 ↓
FastAPI
 ↓
InferenceService
 ↓
Preprocessing
 ↓
Final Model
 ↓
Prediction
 ↓
Explanation
 ↓
API Response

Initially implement a MockInferenceService.

Later replace it with RealInferenceService.

The API contract should remain as stable as possible.

---

## 13. SECURITY AND PRIVACY

Implement sensible security practices:

- environment variables
- no secrets in Git
- CORS configuration
- file validation
- upload limits
- safe error messages
- no unnecessary patient-identifying information in logs
- no hard-coded credentials

The application is a research prototype and must display an appropriate disclaimer.

---

## 14. CODE QUALITY

Follow:

- modular architecture
- clear naming
- type hints
- docstrings where useful
- separation of concerns
- reusable components
- error handling
- logging
- tests
- environment configuration

Do not generate giant files.

Do not duplicate logic.

Do not modify unrelated files when implementing a feature.

Before making architectural changes, explain the reason.

---

## 15. DEVELOPMENT STRATEGY

Build incrementally.

Do not generate the entire application in one step.

Work in this order:

1. Repository and documentation
2. Backend foundation
3. Configuration and logging
4. PostgreSQL and SQLAlchemy
5. Alembic migrations
6. Health endpoint
7. Analysis data model
8. MRI upload and validation
9. Mock inference service
10. Prediction API
11. Frontend foundation
12. Analysis UI
13. Frontend/backend integration
14. Results UI
15. History
16. MRI visualization
17. Explainability interface
18. Real ML integration
19. Integration testing
20. Security and error handling
21. Deployment preparation

At every stage:
- inspect existing code
- make the smallest necessary change
- run tests
- verify functionality
- report what changed
- do not move to the next stage until the current stage works

---

## 16. IMPORTANT AI CODING RULES

You are an AI coding assistant working with a human developer.

Do NOT:
- invent ML requirements
- invent prediction classes
- invent clinical variables
- invent model files
- rewrite the entire repository unnecessarily
- add unnecessary technologies
- create fake medical claims
- fabricate test results
- silently change the architecture

When information about the final ML model is unavailable, create an abstraction/interface and clearly mark the integration point.

When uncertain, inspect the repository first and ask before making a major architectural assumption.

Always preserve compatibility with the existing project.