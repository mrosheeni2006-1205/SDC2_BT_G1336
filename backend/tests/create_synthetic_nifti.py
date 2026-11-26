from pathlib import Path
from typing import Tuple, Dict
import nibabel as nib
import numpy as np


def generate_synthetic_nifti(
    output_path: Path,
    shape: Tuple[int, int, int] = (32, 32, 16),
    seed: int = 42
) -> Path:
    """
    Generate a valid synthetic 3D NIfTI (.nii.gz) file for automated testing.
    """
    np.random.seed(seed)
    # Generate synthetic brain intensity volume with background zeros
    data = np.zeros(shape, dtype=np.float32)
    center_mask = np.random.rand(*shape) > 0.3
    data[center_mask] = np.random.normal(loc=100.0, scale=15.0, size=np.sum(center_mask)).astype(np.float32)
    
    affine = np.eye(4)
    nifti_img = nib.Nifti1Image(data, affine)
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    nib.save(nifti_img, str(output_path))
    return output_path


def generate_synthetic_multimodal_set(
    target_dir: Path,
    prefix: str = "test"
) -> Dict[str, Path]:
    """
    Generate all 4 synthetic MRI modalities (T1, T1ce, T2, FLAIR) in target directory.
    """
    modalities = ["T1", "T1ce", "T2", "FLAIR"]
    paths = {}
    for i, mod in enumerate(modalities):
        path = target_dir / f"{prefix}_{mod}.nii.gz"
        generate_synthetic_nifti(path, seed=42 + i)
        paths[mod] = path
    return paths


if __name__ == "__main__":
    test_dir = Path("./temp_synthetic")
    paths = generate_synthetic_multimodal_set(test_dir)
    print(f"Generated synthetic NIfTI files: {list(paths.keys())}")
