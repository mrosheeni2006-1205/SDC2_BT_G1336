import os
import logging
from pathlib import Path
from typing import Dict, Any, Tuple, Optional
import torch
import torch.nn.functional as F
import numpy as np

from app.ml.gated_fusion_model import CNNViTGatedClinicalIDHModel
from app.ml.clinical import ClinicalPreprocessor
from app.ml.preprocessing import MRIPreprocessor
from app.ml.explainability import explainability_manager

logger = logging.getLogger("neuroinsight.ml")


class InferenceService:
    """
    Standalone Model Management & Inference Service.
    Handles checkpoint loading, state verification, model health check, and prediction execution.
    """

    def __init__(self, model_dir: Path):
        self.model_dir = model_dir
        self.checkpoint_path = (model_dir / "cnn_vit_clinical_gated_resumed_best.pth")
        self.config_path = model_dir / "preprocessing_config.json"

        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model: Optional[CNNViTGatedClinicalIDHModel] = None
        self.clinical_preprocessor = ClinicalPreprocessor(self.config_path)
        self.mri_preprocessor = MRIPreprocessor()

        self.model_loaded = False
        self.load_error_message: Optional[str] = None

        # Attempt model initialization & loading
        self.initialize_model()

    def initialize_model(self) -> bool:
        """
        Build architecture, check checkpoint existence, load state_dict, and set eval mode.
        """
        self.model = CNNViTGatedClinicalIDHModel().to(self.device)
        self.model_loaded = False
        self.load_error_message = None

        if not self.checkpoint_path.exists():
            self.load_error_message = (
                f"Model checkpoint file not found at '{self.checkpoint_path.absolute()}'. "
                "Please place 'cnn_vit_clinical_gated_resumed_best.pth' ""in the backend/model/ directory."
            )
            logger.warning(self.load_error_message)
            return False

        try:
            # [DEBUG] 1. Print the checkpoint path
            print(f"[DEBUG] Checkpoint path: {self.checkpoint_path.absolute()}")
            print(f"[DEBUG] Checkpoint exists: {self.checkpoint_path.exists()}")

            checkpoint = torch.load(self.checkpoint_path,map_location=self.device,weights_only=True,)
            # Support both raw state_dict and dict wrappers (e.g. {'state_dict': ...})
            if isinstance(checkpoint, dict) and "state_dict" in checkpoint:
                state_dict = checkpoint["state_dict"]
                print("[DEBUG] Checkpoint format: nested 'state_dict' key")
            elif isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
                state_dict = checkpoint["model_state_dict"]
                print("[DEBUG] Checkpoint format: nested 'model_state_dict' key")
            elif isinstance(checkpoint, dict):
                state_dict = checkpoint
                print(f"[DEBUG] Checkpoint format: raw dict with keys: {list(checkpoint.keys())[:10]}")
            else:
                raise ValueError("Unrecognized checkpoint format.")

            # [DEBUG] 3. Print whether model.load_state_dict() succeeds
            missing, unexpected = self.model.load_state_dict(state_dict, strict=True), []
            print(f"[DEBUG] model.load_state_dict() succeeded. Missing keys: [], Unexpected keys: []")
            self.model.eval()
            print(f"[DEBUG] model.eval() called. model.training = {self.model.training}")

            # Run dummy verification tensor forward pass
            dummy_mri = torch.zeros(1, 4, 128, 128, 96, device=self.device, dtype=torch.float32)
            dummy_clinical = torch.zeros(1, 2, device=self.device, dtype=torch.float32)

            with torch.no_grad():
                out = self.model(dummy_mri, dummy_clinical)
                print(f"[DEBUG] Dummy forward pass output shape: {out.shape}")
                print(f"[DEBUG] Dummy forward pass logits: {out}")
                if out.shape != (1, 2):
                    raise ValueError(f"Unexpected output shape {out.shape}, expected (1, 2).")

            self.model_loaded = True
            logger.info("Successfully loaded model checkpoint and verified architecture.")
            return True

        except Exception as e:
            self.load_error_message = f"Failed to load or verify model checkpoint: {str(e)}"
            print(f"[DEBUG] model.load_state_dict() FAILED: {str(e)}")
            logger.error(self.load_error_message)
            self.model_loaded = False
            return False

    def get_health_status(self) -> Dict[str, Any]:
        """
        Check health status of backend model service.
        """
        scaler_ready = self.clinical_preprocessor.is_scaler_configured()
        is_ok = self.model_loaded and scaler_ready

        return {
            "status": "ok" if is_ok else "degraded",
            "model_loaded": self.model_loaded,
            "age_scaler_configured": scaler_ready,
            "checkpoint_path": str(self.checkpoint_path.absolute()),
            "config_path": str(self.config_path.absolute()),
            "device": str(self.device),
            "details": {
                "checkpoint_exists": self.checkpoint_path.exists(),
                "error": self.load_error_message if not self.model_loaded else None,
                "age_scaler_note": None if scaler_ready else "Age scaler mean/scale must be updated in preprocessing_config.json for production accuracy."
            }
        }

    def predict(
        self,
        mri_modality_inputs: Dict[str, Any],
        age: float,
        sex: str,
        analysis_id: Optional[str] = None,
        patient_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Execute full multimodal IDH classification inference pipeline.
        
        Args:
            mri_modality_inputs: Dict mapping 'T1', 'T1ce', 'T2', 'FLAIR' to NIfTI file paths or images.
            age: Patient age float.
            sex: Patient sex string ('Male' or 'Female').
            analysis_id: Optional analysis UUID to link and pre-generate explainability session.
            patient_id: Optional patient reference string.
            
        Returns:
            Dict containing class prediction, labels, probabilities, and explainability status.
        """
        # 1. Preprocess clinical inputs
        clinical_tensor = self.clinical_preprocessor.preprocess(age, sex).to(self.device)

        # 2. Preprocess MRI inputs
        mri_tensor = self.mri_preprocessor.preprocess_multimodal_mri(mri_modality_inputs).to(self.device)

        # 3. Model Inference (if model loaded, run actual forward pass; if in degraded mode for testing UI/API without .pth, compute structured fallback result with explicit degradation warning)
        print(f"[DEBUG] model_loaded = {self.model_loaded}")

        if self.model_loaded and self.model is not None:
            # [DEBUG] 14. Verify model.eval() is called
            self.model.eval()
            print(f"[DEBUG] model.eval() called. model.training = {self.model.training} (must be False)")

            # [DEBUG] 12. Verify uploaded files are actually used
            print(f"[DEBUG] MRI shape: {mri_tensor.shape}  (expected: [1, 4, 128, 128, 96])")
            print(f"[DEBUG] MRI dtype: {mri_tensor.dtype}  (expected: torch.float32)")
            print(f"[DEBUG] MRI min: {mri_tensor.min().item():.6f}  max: {mri_tensor.max().item():.6f}")
            print(f"[DEBUG] MRI mean: {mri_tensor.mean().item():.6f}  std: {mri_tensor.std().item():.6f}")

            # [DEBUG] 13. Verify age and sex are actually sent
            print(f"[DEBUG] Clinical tensor: {clinical_tensor}  shape: {clinical_tensor.shape}  (expected: [1, 2])")
            print(f"[DEBUG] Clinical[0] = age_scaled={clinical_tensor[0,0].item():.6f}, sex_encoded={clinical_tensor[0,1].item():.1f}")

            # [DEBUG] 15. Verify torch.no_grad() is used
            print("[DEBUG] Entering torch.no_grad() context for inference")
            with torch.no_grad():
                logits = self.model(mri_tensor, clinical_tensor)

                # [DEBUG] 4. Print raw model logits before softmax
                print(f"[DEBUG] Raw logits (before softmax): {logits}")
                print(f"[DEBUG] Logit[0] (Wild Type score): {logits[0,0].item():.6f}")
                print(f"[DEBUG] Logit[1] (Mutated score):   {logits[0,1].item():.6f}")

                probs = F.softmax(logits, dim=1).squeeze(0).cpu().numpy()

                # [DEBUG] 5. Print both softmax probabilities
                print(f"[DEBUG] Softmax probabilities: {probs}")
                print(f"[DEBUG] P(IDH Wild Type) = probs[0] = {probs[0]:.6f}")
                print(f"[DEBUG] P(IDH Mutated)   = probs[1] = {probs[1]:.6f}")

            # [DEBUG] 6. Print torch.argmax
            pred_class = int(torch.argmax(logits, dim=1).item())
            print(f"[DEBUG] torch.argmax(logits, dim=1) = {pred_class}")
            print(f"[DEBUG] Predicted label: {'IDH Mutated' if pred_class == 1 else 'IDH Wild Type'}")

            prob_wildtype = float(probs[0])
            prob_mutated = float(probs[1])

            # [DEBUG] 7. Verify backend does NOT always return class 0
            print(f"[DEBUG] Final pred_class={pred_class}, prob_wildtype={prob_wildtype:.4f}, prob_mutated={prob_mutated:.4f}")
            is_demo_fallback = False
        else:
            # Degraded/development test mode when checkpoint not yet provided
            # Calculate mock probabilities deterministically for initial development/testing
            logger.warning("Running inference in degraded mode (model checkpoint missing).")
            print("[DEBUG] *** DEGRADED MODE ACTIVE — model checkpoint not loaded, using mock probabilities ***")
            # Deterministic mock calculation based on age/sex input for test reproducibility
            base_score = 0.5 + (0.005 * (age - 50)) + (0.05 if sex.upper().startswith("F") else -0.05)
            prob_mutated = max(0.05, min(0.95, base_score))
            prob_wildtype = 1.0 - prob_mutated
            pred_class = 1 if prob_mutated >= 0.5 else 0
            is_demo_fallback = True
            print(f"[DEBUG] Degraded mode pred_class={pred_class}, prob_mutated={prob_mutated:.4f}")

        pred_label = "IDH Mutated" if pred_class == 1 else "IDH Wild Type"

        # Pre-generate explainability if analysis_id was supplied and model is loaded
        explainability_ready = False
        if self.model_loaded and self.model is not None and analysis_id:
            try:
                explainability_manager.generate(
                    analysis_id=analysis_id,
                    patient_id=patient_id or "patient",
                    age=age,
                    sex=sex,
                    mri_tensor=mri_tensor,
                    clinical_tensor=clinical_tensor,
                    pred_class=pred_class,
                    pred_label=pred_label,
                    model=self.model,
                )
                explainability_ready = True
                print(f"[DEBUG XAI] Successfully generated explainability session for {analysis_id}")
            except Exception as xai_err:
                logger.error(f"Failed to generate explainability session: {str(xai_err)}", exc_info=True)
                print(f"[DEBUG XAI] Explainability generation failed: {str(xai_err)}")

        return {
            "prediction": {
                "class": pred_class,
                "label": pred_label,
            },
            "probabilities": {
                "idh_wild_type": round(prob_wildtype, 4),
                "idh_mutated": round(prob_mutated, 4),
            },
            "model": {
                "name": "Gated-Fusion CNN-Vision Transformer",
                "version": "1.1",
                "architecture": "CNNViTGatedClinicalIDHModel",
                "degraded_mode": is_demo_fallback,
                "scaler_configured": self.clinical_preprocessor.is_scaler_configured(),
                "explainability_ready": explainability_ready,
            },
        }

    def get_explainability(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve pre-generated explainability summary for an analysis ID."""
        return explainability_manager.get_summary(analysis_id)

    def get_gradcam_slice(
        self,
        analysis_id: str,
        modality: str = "FLAIR",
        slice_idx: int = 48,
        opacity: float = 0.6
    ) -> Optional[Dict[str, Any]]:
        """Render and retrieve dynamic Grad-CAM++ slice visual for an analysis ID."""
        return explainability_manager.render_slice(
            analysis_id=analysis_id,
            modality=modality,
            slice_idx=slice_idx,
            opacity=opacity
        )
