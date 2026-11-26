import os
from pathlib import Path
from typing import List, Dict, Union, Tuple, BinaryIO
import nibabel as nib
import numpy as np
import torch
import torch.nn.functional as F


class MRIPreprocessor:
    """
    MRI volume preprocessor reproducing training steps:
    1. Load NIfTI via NiBabel
    2. Convert to float32
    3. Replace NaN, +Inf, -Inf with 0.0
    4. Independent voxel intensity standardization for non-zero voxels: (vol - mean) / std
    5. Channel stacking: [T1, T1ce, T2, FLAIR]
    6. Trilinear interpolation resize to [1, 4, 128, 128, 96] with align_corners=False
    """

    TARGET_SHAPE = (128, 128, 96)
    EXPECTED_MODALITIES = ["T1", "T1ce", "T2", "FLAIR"]

    def __init__(self, target_shape: Tuple[int, int, int] = (128, 128, 96)):
        self.target_shape = target_shape

    @staticmethod
    def preprocess_single_volume(nifti_input: Union[str, Path, nib.Nifti1Image]) -> np.ndarray:
        """
        Preprocess a single NIfTI MRI modality volume.
        
        Args:
            nifti_input: File path to NIfTI file or loaded nibabel Nifti1Image object.
            
        Returns:
            np.ndarray: Preprocessed 3D volume float32 array.
        """
        if isinstance(nifti_input, (str, Path)):
            img = nib.load(str(nifti_input))
        elif isinstance(nifti_input, nib.Nifti1Image):
            img = nifti_input
        else:
            raise TypeError("Expected file path or nibabel Nifti1Image instance.")

        # Get 3D numerical data array
        data = img.get_fdata(dtype=np.float32)
        if data.ndim > 3:
            # Squeeze extra dimensions if single timepoint 4D
            data = np.squeeze(data)
            if data.ndim != 3:
                raise ValueError(f"MRI volume must be 3D. Found shape {img.shape}.")

        # Replace NaN and Inf values with 0.0
        data = np.nan_to_num(data, nan=0.0, posinf=0.0, neginf=0.0).astype(np.float32)

        # Independent intensity normalization over non-zero voxels
        nonzero_mask = data != 0.0
        nonzero_count = int(nonzero_mask.sum())
        total_voxels = int(data.size)
        if np.any(nonzero_mask):
            nonzero_voxels = data[nonzero_mask]
            mean_val = float(np.mean(nonzero_voxels))
            std_val = float(np.std(nonzero_voxels))
            print(f"[DEBUG PREPROCESS] nonzero voxels: {nonzero_count}/{total_voxels} "
                  f"({100.0*nonzero_count/total_voxels:.1f}%), "
                  f"mean={mean_val:.4f}, std={std_val:.4f}")
            if std_val > 0:
                data = (data - mean_val) / std_val
                print(f"[DEBUG PREPROCESS] After norm: min={data.min():.4f}, max={data.max():.4f}, "
                      f"zero-voxel value={(0.0 - mean_val)/std_val:.4f} (background offset from 0)")
        else:
            print("[DEBUG PREPROCESS] WARNING: All voxels are zero — empty volume!")

        return data

    def preprocess_multimodal_mri(
        self,
        modality_paths: Dict[str, Union[str, Path, nib.Nifti1Image]]
    ) -> torch.Tensor:
        """
        Preprocess and stack all 4 MRI modalities into a single tensor [1, 4, 128, 128, 96].
        
        Args:
            modality_paths: Dictionary with keys 'T1', 'T1ce', 'T2', 'FLAIR' mapping to NIfTI inputs.
            
        Returns:
            torch.Tensor: Preprocessed tensor of shape [1, 4, 128, 128, 96] float32.
        """
        # Validate all required modalities are provided
        for mod in self.EXPECTED_MODALITIES:
            if mod not in modality_paths:
                raise KeyError(f"Missing required MRI modality: '{mod}'.")

        processed_volumes: List[np.ndarray] = []
        for mod in self.EXPECTED_MODALITIES:
            vol = self.preprocess_single_volume(modality_paths[mod])
            processed_volumes.append(vol)

        # Convert volumes to PyTorch tensors
        # PyTorch interpolate expects shape [B, C, D, H, W]
        tensors = [torch.from_numpy(vol) for vol in processed_volumes]

        # Stack into [4, H, W, D]
        stacked = torch.stack(tensors, dim=0) # [4, D1, D2, D3]

        # Add batch dimension [1, 4, D1, D2, D3]
        stacked_batch = stacked.unsqueeze(0).to(torch.float32)

        # Resize to target shape [1, 4, 128, 128, 96] using trilinear interpolation
        resized = F.interpolate(
            stacked_batch,
            size=self.target_shape,
            mode="trilinear",
            align_corners=False
        )

        print(f"[DEBUG PREPROCESS] Final MRI tensor shape: {resized.shape}  dtype: {resized.dtype}")
        print(f"[DEBUG PREPROCESS] Final MRI min={resized.min().item():.4f}, max={resized.max().item():.4f}, "
              f"mean={resized.mean().item():.4f}, std={resized.std().item():.4f}")
        for ch_idx, mod_name in enumerate(self.EXPECTED_MODALITIES):
            ch = resized[0, ch_idx]
            print(f"[DEBUG PREPROCESS] Channel {ch_idx} ({mod_name}): "
                  f"min={ch.min().item():.4f}, max={ch.max().item():.4f}, mean={ch.mean().item():.4f}")

        return resized


def validate_nifti_file(file_path: Union[str, Path]) -> Tuple[bool, str]:
    """
    Validate an uploaded NIfTI file.
    Checks extension, existence, NIfTI header loadability, and 3D volume structure.
    
    Returns:
        (is_valid, error_message)
    """
    path = Path(file_path)
    if not path.exists():
        return False, f"File not found: {path.name}"

    name_lower = path.name.lower()
    if not (name_lower.endswith(".nii") or name_lower.endswith(".nii.gz")):
        return False, f"Invalid file format '{path.name}'. Only .nii and .nii.gz files are accepted."

    if path.stat().st_size == 0:
        return False, f"Uploaded file '{path.name}' is empty (0 bytes)."

    try:
        img = nib.load(str(path))
        data_shape = img.shape
        if len(data_shape) < 3:
            return False, f"File '{path.name}' does not contain a valid 3D MRI volume (shape: {data_shape})."
    except Exception as e:
        return False, f"Failed to parse NIfTI volume '{path.name}': {str(e)}"

    return True, ""
