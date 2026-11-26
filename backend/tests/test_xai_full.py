import os
import sys
import tempfile
from pathlib import Path
import torch

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.ml.inference import InferenceService
from app.ml.model import create_model
from app.ml.clinical import ClinicalPreprocessor
from app.ml.preprocessing import MRIPreprocessor
from app.ml.explainability import (
    GradCAMPlusPlus3D,
    ModalityShapExplainer,
    ClinicalShapExplainer,
    explainability_manager,
)
from tests.create_synthetic_nifti import generate_synthetic_multimodal_set, generate_synthetic_nifti


def test_complete_xai_pipeline():
    print("=" * 70)
    print("NEUROINSIGHT AI — COMPLETE XAI & PIPELINE TEST")
    print("=" * 70)

    # 1. Architecture Check
    print("[1/6] Verifying MultimodalCNNViT architecture shape...")
    model_arch = create_model()
    model_arch.eval()
    dummy_mri = torch.randn(1, 4, 128, 128, 96)
    dummy_clin = torch.tensor([[0.5, 1.0]])
    with torch.no_grad():
        out = model_arch(dummy_mri, dummy_clin)
    assert out.shape == (1, 2)
    print(f"      PASS: Output shape = {tuple(out.shape)}")

    # 2. InferenceService Loading
    print("[2/6] Initializing InferenceService with trained checkpoint...")
    svc = InferenceService(settings.MODEL_DIR)
    assert svc.model_loaded is True
    print(f"      PASS: Model loaded = True on device = {svc.device}")

    # 3. Predict & Explain Session
    print("[3/6] Running full multimodal prediction with synthetic NIfTI volume...")
    with tempfile.TemporaryDirectory() as td:
        paths = generate_synthetic_multimodal_set(Path(td))
        res = svc.predict(
            mri_modality_inputs=paths,
            age=58.0,
            sex="Female",
            analysis_id="session-integration-001",
            patient_id="PATIENT_001",
        )

    assert "prediction" in res
    assert "probabilities" in res
    assert res["model"]["explainability_ready"] is True
    pred_label = res["prediction"]["label"]
    pred_class = res["prediction"]["class"]
    print(f"      PASS: Predicted '{pred_label}' (Class {pred_class})")
    print(f"      Probabilities: {res['probabilities']}")
    print(f"      Explainability Ready = {res['model']['explainability_ready']}")

    # 4. Retrieve SHAP attributions
    print("[4/6] Retrieving SHAP Attributions for the prediction...")
    summary = svc.get_explainability("session-integration-001")
    assert summary is not None
    assert summary["analysis_id"] == "session-integration-001"
    assert len(summary["shap"]["mri_modalities"]) == 4
    assert len(summary["shap"]["clinical_features"]) == 2
    assert abs(summary["shap"]["mri_summary"]["additivity_residual"]) < 1e-4
    assert abs(summary["shap"]["clinical_summary"]["additivity_residual"]) < 1e-4

    print("      PASS: Modality SHAP Attributions (Exact 16-Subset Shapley):")
    for m in summary["shap"]["mri_modalities"]:
        print(f"        - {m['modality']:<6}: SHAP={m['shap_value']:+.4f} ({m['percentage']:4.1f}%), direction={m['direction']}")
    print("      PASS: Clinical SHAP Attributions (Age and Biological Sex):")
    for c in summary["shap"]["clinical_features"]:
        print(f"        - {c['feature']:<6} ({c['raw_value']}): SHAP={c['shap_value']:+.4f} ({c['percentage']:4.1f}%), direction={c['direction']}")

    # 5. Retrieve Grad-CAM++ Saliency Maps
    print("[5/6] Retrieving 3D Grad-CAM++ Saliency Maps & Metrics...")
    gradcam_data = summary["gradcam"]
    assert gradcam_data["target_layer"] == "cnn.features[10]"
    assert 0 <= gradcam_data["recommended_slice"] < 96
    assert "top1pct_activation" in gradcam_data
    assert "effective_volume_fraction" in gradcam_data
    initial_slice = gradcam_data["initial_slice"]
    assert len(initial_slice["overlay_slice_base64"]) > 1000
    assert initial_slice["overlay_slice_base64"].startswith("data:image/png;base64,")

    print(f"      PASS: Target layer: {gradcam_data['target_layer']}")
    print(f"      Peak Slice: #{gradcam_data['recommended_slice'] + 1} / {gradcam_data['total_slices']}")
    print(f"      Top 1% Activation Fraction: {gradcam_data['top1pct_activation'] * 100:.1f}%")
    print(f"      Top 5% Activation Fraction: {gradcam_data['top5pct_activation'] * 100:.1f}%")
    print(f"      Participation Ratio: {gradcam_data['effective_volume_fraction'] * 100:.2f}%")
    print(f"      Initial Slice Overlay PNG Base64 Length: {len(initial_slice['overlay_slice_base64'])} characters")

    # 6. Dynamic Slice Rendering across Modalities and Slices
    print("[6/6] Testing Dynamic Slice Rendering for user slider interaction...")
    for test_mod in ["FLAIR", "T1ce", "T2", "T1"]:
        sl = svc.get_gradcam_slice("session-integration-001", modality=test_mod, slice_idx=52, opacity=0.7)
        assert sl is not None
        assert sl["modality"] == test_mod
        assert sl["slice_index"] == 52
        assert len(sl["mri_slice_base64"]) > 1000
        assert len(sl["heatmap_slice_base64"]) > 1000
        assert len(sl["overlay_slice_base64"]) > 1000
        print(f"      PASS: Dynamic slice rendered for modality '{test_mod}' at slice 52 (overlay len: {len(sl['overlay_slice_base64'])})")

    print("\n" + "=" * 70)
    print("ALL 6 VERIFICATION STAGES COMPLETED AND PASSED!")
    print("=" * 70)


if __name__ == "__main__":
    test_complete_xai_pipeline()
