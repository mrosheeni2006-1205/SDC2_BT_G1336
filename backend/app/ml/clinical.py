import json
from pathlib import Path
from typing import Dict, Any, Tuple, Optional
import torch


class ClinicalPreprocessor:
    """
    Clinical data preprocessor for Age standardization and Sex encoding.
    """

    def __init__(self, config_path: Path):
        self.config_path = config_path
        self.config: Dict[str, Any] = {}
        self.mean: Optional[float] = None
        self.scale: Optional[float] = None
        self.sex_mapping: Dict[str, float] = {"M": 0.0, "F": 1.0}
        self.reload_config()

    def reload_config(self) -> bool:
        """Reload configuration file and update scaler parameters."""
        if not self.config_path.exists():
            return False
        
        try:
            with open(self.config_path, "r", encoding="utf-8") as f:
                self.config = json.load(f)
            
            age_scaler = self.config.get("age_scaler", {})
            self.mean = age_scaler.get("mean")
            self.scale = age_scaler.get("scale")
            
            if "sex_mapping" in self.config:
                self.sex_mapping = self.config["sex_mapping"]
            return self.is_scaler_configured()
        except Exception:
            return False

    def is_scaler_configured(self) -> bool:
        """Return True if age scaler mean and scale values are configured."""
        return (
            self.mean is not None 
            and self.scale is not None 
            and isinstance(self.mean, (int, float)) 
            and isinstance(self.scale, (int, float))
            and self.scale > 0
        )

    def encode_sex(self, sex: str) -> float:
        """
        Encode sex string to float value.
        'M', 'Male', 'm', 'male' -> 0.0
        'F', 'Female', 'f', 'female' -> 1.0
        """
        s = sex.strip().upper()
        if s in ("M", "MALE"):
            return self.sex_mapping.get("M", 0.0)
        elif s in ("F", "FEMALE"):
            return self.sex_mapping.get("F", 1.0)
        else:
            raise ValueError(f"Invalid sex value '{sex}'. Expected 'Male' or 'Female'.")

    def preprocess(self, age: float, sex: str) -> torch.Tensor:
        """
        Preprocess clinical inputs into PyTorch tensor of shape [1, 2].
        
        Args:
            age: Patient age (float)
            sex: Patient sex ('Male' or 'Female')
            
        Returns:
            torch.Tensor: Tensor of shape [1, 2] containing [standardized_age, encoded_sex]
        """
        if age < 0 or age > 120:
            raise ValueError(f"Invalid age '{age}'. Must be between 0 and 120.")
            
        sex_val = self.encode_sex(sex)
        
        # If scaler is configured, compute standardized age
        if self.is_scaler_configured():
            standardized_age = (float(age) - float(self.mean)) / float(self.scale)
        else:
            # Fallback for unconfigured mode (will be flagged by health/readiness check)
            standardized_age = float(age)
            
        tensor = torch.tensor([[standardized_age, sex_val]], dtype=torch.float32)
        return tensor
