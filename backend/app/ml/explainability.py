import os
import io
import math
import base64
import logging
import itertools
from typing import Dict, Any, List, Tuple, Optional
from collections import OrderedDict

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image

logger = logging.getLogger("neuroinsight.xai")


# =====================================================================
# Colormap & Visual Overlay Utilities
# =====================================================================

def colormap_turbo(values: np.ndarray) -> np.ndarray:
    """
    Polynomial approximation of Google's Turbo colormap (RGB float 0..1 to uint8 0..255).
    Smooth perceptual gradients ideal for medical visualization.
    """
    x = np.clip(values.astype(np.float32), 0.0, 1.0)
    r = 0.1357 + x * (4.5974 - x * (42.3277 - x * (130.5887 - x * (150.5614 - x * 58.1375))))
    g = 0.0914 + x * (2.1856 + x * (4.8052 - x * (14.0195 - x * (4.2109 - x * 2.7747))))
    b = 0.1067 + x * (12.5925 - x * (60.1818 - x * (109.0745 - x * (88.5066 - x * 26.8183))))
    rgb = np.clip(np.stack([r, g, b], axis=-1), 0.0, 1.0)
    return (rgb * 255.0).astype(np.uint8)


def array_to_base64_png(img_array: np.ndarray) -> str:
    """Encode 2D uint8 grayscale or 3D uint8 RGB/RGBA array to a data URL PNG string."""
    pil_img = Image.fromarray(img_array)
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")


def render_mri_slice_uint8(slice_2d: np.ndarray) -> np.ndarray:
    """Normalize a 2D float MRI slice to uint8 [0..255]."""
    slice_data = np.nan_to_num(slice_2d.astype(np.float32), nan=0.0)
    s_min = float(slice_data.min())
    s_max = float(slice_data.max())
    if s_max > s_min:
        norm = (slice_data - s_min) / (s_max - s_min)
    else:
        norm = np.zeros_like(slice_data)
    return (norm * 255.0).astype(np.uint8)


def render_heatmap_rgba(cam_slice: np.ndarray, alpha_max: float = 0.85) -> np.ndarray:
    """Convert a 2D float heatmap [0..1] into an RGBA uint8 image with transparent background."""
    v = np.clip(cam_slice.astype(np.float32), 0.0, 1.0)
    rgb = colormap_turbo(v)
    # Background threshold: voxels with < 5% activation become transparent
    alpha = np.where(v > 0.05, np.clip(v * alpha_max * 255.0, 40.0, 255.0), 0.0).astype(np.uint8)
    return np.dstack([rgb, alpha])


def render_overlay_rgb(mri_uint8: np.ndarray, cam_slice: np.ndarray, opacity: float = 0.6) -> np.ndarray:
    """Alpha-blend normalized grayscale MRI slice with Turbo colormapped heatmap."""
    opacity = max(0.0, min(1.0, float(opacity)))
    v = np.clip(cam_slice.astype(np.float32), 0.0, 1.0)
    heat_rgb = colormap_turbo(v).astype(np.float32)
    mri_rgb = np.repeat(mri_uint8[:, :, np.newaxis], 3, axis=2).astype(np.float32)

    # Effective alpha weighted by activation intensity
    effective_alpha = np.where(v > 0.04, opacity * np.clip(v / 0.7, 0.2, 1.0), 0.0)[:, :, np.newaxis]
    blended = (1.0 - effective_alpha) * mri_rgb + effective_alpha * heat_rgb
    return np.clip(blended, 0.0, 255.0).astype(np.uint8)


# =====================================================================
# Grad-CAM++ 3D Implementation (Following Research Notebook Step 40)
# =====================================================================

class GradCAMPlusPlus3D:
    """
    3D Grad-CAM++ for Multimodal CNN-ViT architecture.
    Targets the final convolutional ReLU layer (model.cnn.features[10])
    and computes closed-form 2nd/3rd-order weighted class activation maps.
    """

    def __init__(self, model: nn.Module, target_layer_idx: int = 10):
        self.model = model
        self.target_layer_idx = target_layer_idx
        self.captured: Dict[str, torch.Tensor] = {}
        self.hook_handle: Optional[torch.utils.hooks.RemovableHandle] = None

        # Resolve target layer: model.cnn.features[10]
        if hasattr(model, "cnn") and hasattr(model.cnn, "features"):
            try:
                self.target_layer = model.cnn.features[target_layer_idx]
            except IndexError:
                self.target_layer = model.cnn.features[-2]
        else:
            raise AttributeError("Model does not expose 'cnn.features' Sequential container.")

    def _register_hook(self):
        def forward_hook(module, inputs, output):
            self.captured["activations"] = output

        self.hook_handle = self.target_layer.register_forward_hook(forward_hook)

    def _remove_hook(self):
        if self.hook_handle is not None:
            self.hook_handle.remove()
            self.hook_handle = None

    def generate(
        self,
        mri_tensor: torch.Tensor,
        clinical_tensor: torch.Tensor,
        target_class: int
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Compute genuine 3D Grad-CAM++ activation map for target class.

        Args:
            mri_tensor: Input volume [1, 4, 128, 128, 96]
            clinical_tensor: Input clinical vector [1, 2]
            target_class: 0 (IDH Wild Type) or 1 (IDH Mutated)

        Returns:
            Tuple of:
            - cam: 3D float32 array [128, 128, 96] normalized in [0, 1]
            - metrics: Dict of quantitative activation metrics and diagnostics
        """
        self.model.eval()
        self.captured.clear()
        self._register_hook()

        device = mri_tensor.device
        target_class = int(target_class)

        try:
            with torch.enable_grad():
                self.model.zero_grad(set_to_none=True)
                logits = self.model(mri_tensor, clinical_tensor)

                if "activations" not in self.captured:
                    raise RuntimeError("Grad-CAM++ failed: target-layer forward hook did not capture activations.")

                activations = self.captured["activations"]
                score = logits[0, target_class]

                # 1st-order gradient with respect to convolutional feature activations
                gradients = torch.autograd.grad(
                    outputs=score,
                    inputs=activations,
                    retain_graph=False,
                    create_graph=False
                )[0]

                # Analytical Grad-CAM++ 2nd and 3rd order terms (Chattopadhay et al., 2018)
                grad2 = gradients.pow(2)
                grad3 = gradients.pow(3)

                spatial_sum = activations.sum(dim=(2, 3, 4), keepdim=True)
                denominator = 2.0 * grad2 + spatial_sum * grad3
                alpha = grad2 / (denominator + 1e-8)

                positive_gradients = F.relu(gradients)
                weights = (alpha * positive_gradients).sum(dim=(2, 3, 4), keepdim=True)

                cam = (weights * activations).sum(dim=1, keepdim=True)
                cam = F.relu(cam)

                # Trilinear interpolation back to original MRI input resolution [128, 128, 96]
                target_spatial_shape = tuple(mri_tensor.shape[2:])
                cam = F.interpolate(
                    cam,
                    size=target_spatial_shape,
                    mode="trilinear",
                    align_corners=False
                )

                cam_np = cam[0, 0].detach().float().cpu().numpy()

        finally:
            self._remove_hook()
            self.captured.clear()

        # Quantitative diagnostics & normalization
        cam_max = float(cam_np.max())
        is_zero_map = bool(cam_max <= 0.0)

        if not is_zero_map:
            cam_norm = (cam_np / cam_max).astype(np.float32)
        else:
            cam_norm = np.zeros_like(cam_np, dtype=np.float32)

        # Calculate participation metrics (from research notebook Step 41)
        flat = cam_norm.ravel()
        total_act = float(flat.sum())

        if total_act > 0:
            sorted_v = np.sort(flat)[::-1]
            n_voxels = len(flat)
            top1 = max(1, int(np.ceil(0.01 * n_voxels)))
            top5 = max(1, int(np.ceil(0.05 * n_voxels)))
            top1_fraction = float(sorted_v[:top1].sum() / total_act)
            top5_fraction = float(sorted_v[:top5].sum() / total_act)
            sum_sq = float((flat ** 2).sum())
            effective_fraction = float((total_act ** 2 / (sum_sq + 1e-8)) / n_voxels)
        else:
            top1_fraction = 0.0
            top5_fraction = 0.0
            effective_fraction = 0.0

        # Axial slice activation profile (mean activation per slice z = 0..95)
        num_axial_slices = cam_norm.shape[2]
        slice_profile = [float(cam_norm[:, :, z].mean()) for z in range(num_axial_slices)]
        peak_slice = int(np.argmax(slice_profile))

        metrics = {
            "is_zero_map": is_zero_map,
            "cam_max": cam_max,
            "total_activation": total_act,
            "top1pct_activation": round(top1_fraction, 4),
            "top5pct_activation": round(top5_fraction, 4),
            "effective_volume_fraction": round(effective_fraction, 4),
            "total_slices": num_axial_slices,
            "peak_slice": peak_slice,
            "slice_profile": [round(p, 5) for p in slice_profile],
            "target_layer": f"cnn.features[{self.target_layer_idx}]",
        }

        return cam_norm, metrics


# =====================================================================
# Modality-Level SHAP (Following Research Notebook Steps 13A & 13B)
# =====================================================================

class ModalityShapExplainer:
    """
    Exact Grouped Modality-Level Shapley Attribution for Multimodal MRI.
    Ingests all 2^4 = 16 modality subsets across {T1, T1ce, T2, FLAIR}
    to compute exact, provably additive Shapley values relative to a zero baseline.
    """

    MODALITIES = ["T1", "T1ce", "T2", "FLAIR"]

    def __init__(self, model: nn.Module):
        self.model = model
        self.num_modalities = len(self.MODALITIES)
        # Precompute all 16 subset tuples
        self.all_subsets: List[Tuple[int, ...]] = []
        for r in range(self.num_modalities + 1):
            self.all_subsets.extend(itertools.combinations(range(self.num_modalities), r))

    def _eval_margin(self, mri: torch.Tensor, clinical: torch.Tensor, target_class: int) -> float:
        with torch.no_grad():
            logits = self.model(mri, clinical)
            # Logit margin favoring target class over alternative
            other_class = 1 - target_class
            margin = (logits[0, target_class] - logits[0, other_class]).item()
            return float(margin)

    def explain(
        self,
        mri_tensor: torch.Tensor,
        clinical_tensor: torch.Tensor,
        target_class: int
    ) -> Dict[str, Any]:
        """
        Compute exact modality Shapley attributions.
        """
        self.model.eval()
        baseline = torch.zeros_like(mri_tensor)
        target_class = int(target_class)

        # Evaluate model score for all 16 subsets
        subset_values: Dict[frozenset, float] = {}
        for subset_tuple in self.all_subsets:
            subset = frozenset(subset_tuple)
            masked_mri = baseline.clone()
            if len(subset) > 0:
                masked_mri[:, list(subset)] = mri_tensor[:, list(subset)]
            subset_values[subset] = self._eval_margin(masked_mri, clinical_tensor, target_class)

        # Exact Shapley formula summation across all marginal increments
        shapley_values: Dict[str, float] = {}
        n = self.num_modalities

        for mod_idx, mod_name in enumerate(self.MODALITIES):
            contribution = 0.0
            other_modalities = [j for j in range(n) if j != mod_idx]

            for s_len in range(n):
                for subset_tuple in itertools.combinations(other_modalities, s_len):
                    subset = frozenset(subset_tuple)
                    weight = (
                        math.factorial(s_len)
                        * math.factorial(n - s_len - 1)
                        / math.factorial(n)
                    )
                    v_without = subset_values[subset]
                    v_with = subset_values[subset | {mod_idx}]
                    contribution += weight * (v_with - v_without)

            shapley_values[mod_name] = float(contribution)

        baseline_margin = subset_values[frozenset()]
        full_margin = subset_values[frozenset(range(n))]
        shap_sum = sum(shapley_values.values())
        residual = (baseline_margin + shap_sum) - full_margin

        # Relative percentage importance
        abs_sum = sum(abs(v) for v in shapley_values.values()) + 1e-8
        items = []
        for rank, mod_name in enumerate(
            sorted(self.MODALITIES, key=lambda m: abs(shapley_values[m]), reverse=True),
            start=1
        ):
            val = shapley_values[mod_name]
            pct = (abs(val) / abs_sum) * 100.0
            items.append({
                "modality": mod_name,
                "shap_value": round(val, 4),
                "absolute_shap": round(abs(val), 4),
                "percentage": round(pct, 1),
                "direction": "positive" if val >= 0 else "negative",
                "rank": rank,
            })

        # Summary & qualitative clinical interpretation
        top_mod = items[0]["modality"]
        top_dir = items[0]["direction"]
        label_str = "IDH Mutated" if target_class == 1 else "IDH Wild Type"
        interpretation = (
            f"MRI Modality SHAP indicates that {top_mod} provided the strongest "
            f"marginal influence ({items[0]['percentage']}% relative attribution) with a {top_dir} "
            f"contribution towards the {label_str} classification. "
            f"The additive sum of modality Shapley values ({shap_sum:+.4f}) reconstructs the logit "
            f"margin transition from baseline ({baseline_margin:+.4f}) to full MRI ({full_margin:+.4f}) "
            f"with an additivity residual of {residual:.6f}."
        )

        return {
            "modalities": items,
            "baseline_margin": round(baseline_margin, 4),
            "full_margin": round(full_margin, 4),
            "shap_sum": round(shap_sum, 4),
            "additivity_residual": round(residual, 6),
            "interpretation": interpretation,
            "limitations": (
                "Modality SHAP measures the marginal contribution of each entire 3D sequence relative to a "
                "zero-MRI reference while holding clinical variables constant. It is a grouped sequence-level "
                "attribution and does not isolate individual voxel or sub-region contributions."
            ),
        }


# =====================================================================
# Clinical Feature SHAP (Following Research Notebook Steps 12C & 12D)
# =====================================================================

class ClinicalShapExplainer:
    """
    Exact Shapley Attribution for Patient Clinical Demographics (Age and Sex).
    Evaluates all 2^2 = 4 subsets relative to training-derived reference values
    while holding volumetric MRI inputs constant.
    """

    def __init__(self, model: nn.Module, bg_age_scaled: float = 0.0, bg_sex_encoded: float = 0.5):
        self.model = model
        self.bg_age_scaled = float(bg_age_scaled)
        self.bg_sex_encoded = float(bg_sex_encoded)

    def _eval_margin(self, mri: torch.Tensor, clinical: torch.Tensor, target_class: int) -> float:
        with torch.no_grad():
            logits = self.model(mri, clinical)
            other_class = 1 - target_class
            return float((logits[0, target_class] - logits[0, other_class]).item())

    def explain(
        self,
        mri_tensor: torch.Tensor,
        clinical_tensor: torch.Tensor,
        target_class: int,
        raw_age: float,
        raw_sex: str
    ) -> Dict[str, Any]:
        """
        Compute exact Shapley attributions for Age and Sex.
        """
        self.model.eval()
        device = clinical_tensor.device
        target_class = int(target_class)

        pt_age_scaled = float(clinical_tensor[0, 0].item())
        pt_sex_encoded = float(clinical_tensor[0, 1].item())

        # Subsets: 0: None, 1: {Age}, 2: {Sex}, 3: {Age, Sex}
        c_none = torch.tensor([[self.bg_age_scaled, self.bg_sex_encoded]], device=device, dtype=torch.float32)
        c_age = torch.tensor([[pt_age_scaled, self.bg_sex_encoded]], device=device, dtype=torch.float32)
        c_sex = torch.tensor([[self.bg_age_scaled, pt_sex_encoded]], device=device, dtype=torch.float32)
        c_both = torch.tensor([[pt_age_scaled, pt_sex_encoded]], device=device, dtype=torch.float32)

        v_none = self._eval_margin(mri_tensor, c_none, target_class)
        v_age = self._eval_margin(mri_tensor, c_age, target_class)
        v_sex = self._eval_margin(mri_tensor, c_sex, target_class)
        v_both = self._eval_margin(mri_tensor, c_both, target_class)

        # Exact Shapley values for 2 features
        phi_age = 0.5 * (v_age - v_none) + 0.5 * (v_both - v_sex)
        phi_sex = 0.5 * (v_sex - v_none) + 0.5 * (v_both - v_age)

        shap_sum = phi_age + phi_sex
        residual = (v_none + shap_sum) - v_both

        abs_total = abs(phi_age) + abs(phi_sex) + 1e-8
        pct_age = (abs(phi_age) / abs_total) * 100.0
        pct_sex = (abs(phi_sex) / abs_total) * 100.0

        features = [
            {
                "feature": "Age",
                "raw_value": f"{raw_age} yrs",
                "standardized_value": round(pt_age_scaled, 3),
                "shap_value": round(phi_age, 4),
                "absolute_shap": round(abs(phi_age), 4),
                "percentage": round(pct_age, 1),
                "direction": "positive" if phi_age >= 0 else "negative",
            },
            {
                "feature": "Sex",
                "raw_value": raw_sex,
                "standardized_value": round(pt_sex_encoded, 3),
                "shap_value": round(phi_sex, 4),
                "absolute_shap": round(abs(phi_sex), 4),
                "percentage": round(pct_sex, 1),
                "direction": "positive" if phi_sex >= 0 else "negative",
            },
        ]

        label_str = "IDH Mutated" if target_class == 1 else "IDH Wild Type"
        interpretation = (
            f"Clinical SHAP explains demographic feature contributions holding MRI fixed. "
            f"Patient Age ({raw_age} years) contributed {phi_age:+.4f} ({pct_age:.1f}% relative) towards {label_str}, "
            f"while Biological Sex ({raw_sex}) contributed {phi_sex:+.4f} ({pct_sex:.1f}% relative). "
            f"The additive baseline margin was {v_none:+.4f} and the final clinical-inclusive margin is {v_both:+.4f}."
        )

        return {
            "features": features,
            "baseline_margin": round(v_none, 4),
            "full_margin": round(v_both, 4),
            "shap_sum": round(shap_sum, 4),
            "additivity_residual": round(residual, 6),
            "interpretation": interpretation,
            "limitations": (
                "Clinical SHAP calculates conditional attributions for demographic variables with the patient's MRI held fixed. "
                "Baseline values are anchored to cohort training averages (mean Age ~54.2 years, Sex = 0.5)."
            ),
        }


# =====================================================================
# Explainability Service & Session Cache
# =====================================================================

class ExplainabilityManager:
    """
    Central Coordinator for Explainable AI (XAI).
    Generates, caches, and serves multimodal SHAP attributions and 3D Grad-CAM++ visualizations.
    Maintains safe in-memory session storage isolated by unique analysis_id.
    """

    MODALITY_INDEX = {"T1": 0, "T1CE": 1, "T2": 2, "FLAIR": 3}
    MODALITY_DISPLAY = {0: "T1", 1: "T1ce", 2: "T2", 3: "FLAIR"}

    def __init__(self, max_cache_entries: int = 50):
        self.max_cache_entries = max_cache_entries
        # Thread-safe in-memory cache: analysis_id -> session data
        self._cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()

    def generate(
        self,
        analysis_id: str,
        patient_id: str,
        age: float,
        sex: str,
        mri_tensor: torch.Tensor,
        clinical_tensor: torch.Tensor,
        pred_class: int,
        pred_label: str,
        model: nn.Module,
    ) -> Dict[str, Any]:
        """
        Generate full SHAP attributions and 3D Grad-CAM++ maps for the given prediction.
        Results are cached in memory for interactive frontend exploration.
        """
        logger.info(f"Generating XAI explanations for analysis_id={analysis_id}, patient={patient_id}...")

        # 1. 3D Grad-CAM++
        gradcam_engine = GradCAMPlusPlus3D(model, target_layer_idx=10)
        cam_3d, cam_metrics = gradcam_engine.generate(
            mri_tensor=mri_tensor,
            clinical_tensor=clinical_tensor,
            target_class=pred_class
        )

        # 2. Modality SHAP
        modality_engine = ModalityShapExplainer(model)
        mri_shap_result = modality_engine.explain(
            mri_tensor=mri_tensor,
            clinical_tensor=clinical_tensor,
            target_class=pred_class
        )

        # 3. Clinical SHAP
        clinical_engine = ClinicalShapExplainer(model)
        clinical_shap_result = clinical_engine.explain(
            mri_tensor=mri_tensor,
            clinical_tensor=clinical_tensor,
            target_class=pred_class,
            raw_age=age,
            raw_sex=sex
        )

        # 4. Extract peak activation slice for default view
        peak_slice = cam_metrics["peak_slice"]
        # Default modality to display: FLAIR (or channel 3)
        default_modality = "FLAIR"
        mod_idx = self.MODALITY_INDEX.get(default_modality, 3)

        # CPU numpy copies for slice rendering
        mri_cpu = mri_tensor[0].detach().cpu().numpy() # [4, 128, 128, 96]

        mri_slice_2d = mri_cpu[mod_idx, :, :, peak_slice]
        cam_slice_2d = cam_3d[:, :, peak_slice]

        mri_uint8 = render_mri_slice_uint8(mri_slice_2d)
        mri_b64 = array_to_base64_png(mri_uint8)
        heatmap_rgba = render_heatmap_rgba(cam_slice_2d)
        heatmap_b64 = array_to_base64_png(heatmap_rgba)
        overlay_rgb = render_overlay_rgb(mri_uint8, cam_slice_2d, opacity=0.6)
        overlay_b64 = array_to_base64_png(overlay_rgb)

        initial_slice = {
            "slice_index": peak_slice,
            "modality": default_modality,
            "mri_slice_base64": mri_b64,
            "heatmap_slice_base64": heatmap_b64,
            "overlay_slice_base64": overlay_b64,
            "mean_activation": round(float(cam_slice_2d.mean()), 4),
            "max_activation": round(float(cam_slice_2d.max()), 4),
        }

        # 5. Store in LRU cache
        if len(self._cache) >= self.max_cache_entries:
            self._cache.popitem(last=False)

        session_entry = {
            "analysis_id": analysis_id,
            "patient_id": patient_id,
            "age": age,
            "sex": sex,
            "pred_class": pred_class,
            "pred_label": pred_label,
            "mri_volume": mri_cpu,  # [4, 128, 128, 96]
            "cam_3d": cam_3d,        # [128, 128, 96]
            "cam_metrics": cam_metrics,
            "shap_modality": mri_shap_result,
            "shap_clinical": clinical_shap_result,
            "initial_slice": initial_slice,
        }
        self._cache[analysis_id] = session_entry

        return self.get_summary(analysis_id)

    def get_summary(self, analysis_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve explainability payload for API response."""
        entry = self._cache.get(analysis_id)
        if not entry:
            return None

        # Format full payload
        return {
            "analysis_id": entry["analysis_id"],
            "patient_id": entry["patient_id"],
            "prediction": {
                "class": entry["pred_class"],
                "label": entry["pred_label"],
            },
            "shap": {
                "mri_modalities": entry["shap_modality"]["modalities"],
                "mri_summary": {
                    "baseline_margin": entry["shap_modality"]["baseline_margin"],
                    "full_margin": entry["shap_modality"]["full_margin"],
                    "shap_sum": entry["shap_modality"]["shap_sum"],
                    "additivity_residual": entry["shap_modality"]["additivity_residual"],
                    "interpretation": entry["shap_modality"]["interpretation"],
                    "limitations": entry["shap_modality"]["limitations"],
                },
                "clinical_features": entry["shap_clinical"]["features"],
                "clinical_summary": {
                    "baseline_margin": entry["shap_clinical"]["baseline_margin"],
                    "full_margin": entry["shap_clinical"]["full_margin"],
                    "shap_sum": entry["shap_clinical"]["shap_sum"],
                    "additivity_residual": entry["shap_clinical"]["additivity_residual"],
                    "interpretation": entry["shap_clinical"]["interpretation"],
                    "limitations": entry["shap_clinical"]["limitations"],
                },
            },
            "gradcam": {
                "target_class": entry["pred_class"],
                "target_label": entry["pred_label"],
                "target_layer": entry["cam_metrics"]["target_layer"],
                "is_zero_map": entry["cam_metrics"]["is_zero_map"],
                "total_slices": entry["cam_metrics"]["total_slices"],
                "recommended_slice": entry["cam_metrics"]["peak_slice"],
                "top1pct_activation": entry["cam_metrics"]["top1pct_activation"],
                "top5pct_activation": entry["cam_metrics"]["top5pct_activation"],
                "effective_volume_fraction": entry["cam_metrics"]["effective_volume_fraction"],
                "slice_activation_profile": entry["cam_metrics"]["slice_profile"],
                "initial_slice": entry["initial_slice"],
                "disclaimer": (
                    "Grad-CAM++ visualizes convolutional gradient-weighted feature activations associated with the model's "
                    "prediction. High-intensity regions highlight spatial features that contributed strongly to the classification score. "
                    "It is a complementary visual aid for research inspection and does not constitute definitive anatomical proof of pathology."
                ),
            },
            "scientific_disclaimer": (
                "Explainable AI (SHAP and Grad-CAM++) attributions describe internal model decision patterns and feature associations. "
                "They are approximate, model-dependent, and do not establish medical causality or clinical proof. "
                "This application is designed for research decision-support and educational purposes only."
            ),
        }

    def render_slice(
        self,
        analysis_id: str,
        modality: str = "FLAIR",
        slice_idx: int = 48,
        opacity: float = 0.6
    ) -> Optional[Dict[str, Any]]:
        """
        Dynamically render a 2D slice for any modality, slice index, and opacity level.
        """
        entry = self._cache.get(analysis_id)
        if not entry:
            return None

        mod_norm = modality.strip().upper()
        if mod_norm not in self.MODALITY_INDEX:
            mod_norm = "FLAIR"

        mod_idx = self.MODALITY_INDEX[mod_norm]
        mod_name = self.MODALITY_DISPLAY.get(mod_idx, "FLAIR")
        total_slices = entry["cam_metrics"]["total_slices"]
        slice_idx = max(0, min(total_slices - 1, int(slice_idx)))

        mri_slice_2d = entry["mri_volume"][mod_idx, :, :, slice_idx]
        cam_slice_2d = entry["cam_3d"][:, :, slice_idx]

        mri_uint8 = render_mri_slice_uint8(mri_slice_2d)
        mri_b64 = array_to_base64_png(mri_uint8)
        heatmap_rgba = render_heatmap_rgba(cam_slice_2d)
        heatmap_b64 = array_to_base64_png(heatmap_rgba)
        overlay_rgb = render_overlay_rgb(mri_uint8, cam_slice_2d, opacity=opacity)
        overlay_b64 = array_to_base64_png(overlay_rgb)

        return {
            "slice_index": slice_idx,
            "total_slices": total_slices,
            "modality": mod_name,
            "opacity": opacity,
            "mri_slice_base64": mri_b64,
            "heatmap_slice_base64": heatmap_b64,
            "overlay_slice_base64": overlay_b64,
            "mean_activation": round(float(cam_slice_2d.mean()), 4),
            "max_activation": round(float(cam_slice_2d.max()), 4),
        }


# Global singleton manager instance
explainability_manager = ExplainabilityManager()
