import pytest
from pathlib import Path
import tempfile
import torch

from app.main import app
from app.core.config import settings
from app.ml.model import MultimodalCNNViT, create_model
from app.ml.gated_fusion_model import CNNViTGatedClinicalIDHModel
from app.ml.clinical import ClinicalPreprocessor
from app.ml.preprocessing import MRIPreprocessor, validate_nifti_file
from app.ml.inference import InferenceService
from app.ml.explainability import (
    GradCAMPlusPlus3D,
    ModalityShapExplainer,
    ClinicalShapExplainer,
    explainability_manager,
)
from tests.create_synthetic_nifti import generate_synthetic_nifti, generate_synthetic_multimodal_set


@pytest.fixture(scope="session", autouse=True)
def setup_inference_service():
    app.state.inference_service = InferenceService(settings.MODEL_DIR)


def test_model_architecture():
    """Verify PyTorch model forward pass output shape [B, 2]."""
    model = create_model()
    model.eval()

    mri_dummy = torch.randn(1, 4, 128, 128, 96, dtype=torch.float32)
    clinical_dummy = torch.tensor([[0.5, 1.0]], dtype=torch.float32)

    with torch.no_grad():
        out = model(mri_dummy, clinical_dummy)

    assert out.shape == (1, 2), f"Expected shape (1, 2), got {out.shape}"


def test_clinical_preprocessor(tmp_path):
    """Test clinical encoding and sex mapping."""
    config_file = tmp_path / "preprocessing_config.json"
    config_file.write_text('{"age_scaler": {"mean": 55.0, "scale": 15.0}, "sex_mapping": {"M": 0.0, "F": 1.0}}')

    preprocessor = ClinicalPreprocessor(config_file)
    assert preprocessor.is_scaler_configured() is True

    tensor = preprocessor.preprocess(70.0, "Female")
    assert tensor.shape == (1, 2)
    # (70 - 55) / 15 = 1.0, Female = 1.0
    assert torch.isclose(tensor[0, 0], torch.tensor(1.0))
    assert torch.isclose(tensor[0, 1], torch.tensor(1.0))


def test_mri_preprocessing(tmp_path):
    """Test synthetic NIfTI volume loading and stacked interpolation."""
    synthetic_paths = generate_synthetic_multimodal_set(tmp_path)
    mri_preprocessor = MRIPreprocessor()

    tensor = mri_preprocessor.preprocess_multimodal_mri(synthetic_paths)
    assert tensor.shape == (1, 4, 128, 128, 96)
    assert tensor.dtype == torch.float32


def test_gradcampp_generation():
    """Verify 3D Grad-CAM++ calculation from actual model activations and gradients."""
    model = CNNViTGatedClinicalIDHModel()
    cp = torch.load("model/cnn_vit_clinical_gated_resumed_best.pth", map_location="cpu", weights_only=False)
    model.load_state_dict(cp["model_state_dict"], strict=True)
    model.eval()

    mri = torch.randn(1, 4, 128, 128, 96)
    clinical = torch.tensor([[0.1, 1.0]], dtype=torch.float32)

    gradcam = GradCAMPlusPlus3D(model, target_layer_idx=10)
    cam, metrics = gradcam.generate(mri, clinical, target_class=1)

    assert cam.shape == (128, 128, 96)
    assert cam.min() >= 0.0
    assert cam.max() <= 1.0
    assert metrics["target_layer"] == "cnn.features[10]"
    assert 0 <= metrics["peak_slice"] < 96
    assert "top1pct_activation" in metrics


def test_modality_shap_generation():
    """Verify exact 16-subset modality SHAP attribution with additivity residual = 0."""
    model = CNNViTGatedClinicalIDHModel()
    cp = torch.load("model/cnn_vit_clinical_gated_resumed_best.pth", map_location="cpu", weights_only=False)
    model.load_state_dict(cp["model_state_dict"], strict=True)
    model.eval()

    mri = torch.randn(1, 4, 128, 128, 96)
    clinical = torch.tensor([[0.2, 0.0]], dtype=torch.float32)

    mod_shap = ModalityShapExplainer(model)
    res = mod_shap.explain(mri, clinical, target_class=0)

    assert len(res["modalities"]) == 4
    mods = {m["modality"] for m in res["modalities"]}
    assert mods == {"T1", "T1ce", "T2", "FLAIR"}
    assert abs(res["additivity_residual"]) < 1e-4
    assert "interpretation" in res


def test_clinical_shap_generation():
    """Verify exact clinical SHAP attribution for Age and Sex with additivity residual = 0."""
    model = CNNViTGatedClinicalIDHModel()
    cp = torch.load("model/cnn_vit_clinical_gated_resumed_best.pth", map_location="cpu", weights_only=False)
    model.load_state_dict(cp["model_state_dict"], strict=True)
    model.eval()

    mri = torch.randn(1, 4, 128, 128, 96)
    clinical = torch.tensor([[0.5, 1.0]], dtype=torch.float32)

    clin_shap = ClinicalShapExplainer(model)
    res = clin_shap.explain(mri, clinical, target_class=1, raw_age=62.0, raw_sex="Female")

    assert len(res["features"]) == 2
    feats = {f["feature"] for f in res["features"]}
    assert feats == {"Age", "Sex"}
    assert abs(res["additivity_residual"]) < 1e-4


def test_health_status():
    """Test health status and ML model checkpoint/scaler readiness."""
    service = app.state.inference_service
    health_data = service.get_health_status()
    assert health_data["status"] == "ok"
    assert health_data["model_loaded"] is True
    assert health_data["age_scaler_configured"] is True
    assert Path(health_data["checkpoint_path"]).exists()


def test_invalid_age_validation():
    """Test validation rejection for non-positive or extreme age."""
    from app.ml.clinical import ClinicalPreprocessor
    config_path = settings.MODEL_DIR / "preprocessing_config.json"
    preprocessor = ClinicalPreprocessor(config_path)
    with pytest.raises(ValueError):
        preprocessor.preprocess(-5.0, "Male")
    with pytest.raises(ValueError):
        preprocessor.preprocess(150.0, "Male")


def test_missing_modality_validation(tmp_path):
    """Test validation rejection when required MRI modality is missing."""
    p = tmp_path / "test_mod.nii.gz"
    generate_synthetic_nifti(p)
    preprocessor = MRIPreprocessor()
    incomplete_paths = {"T1": p, "T2": p}  # missing T1ce, FLAIR
    with pytest.raises(Exception):
        preprocessor.preprocess_multimodal_mri(incomplete_paths)


def test_incorrect_file_format_validation(tmp_path):
    """Test validation rejection when uploading invalid non-NIfTI files."""
    bad_file = tmp_path / "invalid.txt"
    bad_file.write_text("not a nifti volume")
    is_valid, err = validate_nifti_file(bad_file)
    assert is_valid is False
    assert err is not None


def test_full_inference_and_explainability_pipeline(tmp_path):
    """End-to-end test of prediction and explainability caching using synthetic NIfTIs."""
    synthetic_paths = generate_synthetic_multimodal_set(tmp_path)
    service = app.state.inference_service
    test_analysis_id = "test-session-pytest-001"

    res = service.predict(
        mri_modality_inputs=synthetic_paths,
        age=58.0,
        sex="Female",
        analysis_id=test_analysis_id,
        patient_id="TEST_PATIENT_PYTEST",
    )

    assert "prediction" in res
    assert "probabilities" in res
    assert res["model"]["explainability_ready"] is True

    # 1. Retrieve explainability summary
    summary = service.get_explainability(test_analysis_id)
    assert summary is not None
    assert summary["analysis_id"] == test_analysis_id
    assert len(summary["shap"]["mri_modalities"]) == 4
    assert len(summary["shap"]["clinical_features"]) == 2
    assert "gradcam" in summary
    assert summary["gradcam"]["target_layer"] == "cnn.features[10]"
    assert summary["gradcam"]["initial_slice"]["overlay_slice_base64"].startswith("data:image/png;base64,")

    # 2. Retrieve dynamic slice across modalities
    for mod in ["FLAIR", "T1ce", "T2", "T1"]:
        slice_data = service.get_gradcam_slice(test_analysis_id, modality=mod, slice_idx=50, opacity=0.7)
        assert slice_data is not None
        assert slice_data["modality"] == mod
        assert slice_data["slice_index"] == 50
        assert slice_data["mri_slice_base64"].startswith("data:image/png;base64,")
        assert slice_data["overlay_slice_base64"].startswith("data:image/png;base64,")

    # 3. Patient isolation check: non-existent analysis_id returns None
    assert service.get_explainability("non-existent-uuid") is None
    assert service.get_gradcam_slice("non-existent-uuid", "FLAIR", 50, 0.7) is None

