
import torch
from backend.app.ml.gated_fusion_model import (
    CNNViTGatedClinicalIDHModel,
)

checkpoint_path = (
    "backend/model/cnn_vit_clinical_gated_resumed_best.pth"
)

checkpoint = torch.load(
    checkpoint_path,
    map_location="cpu",
    weights_only=True,
)

model = CNNViTGatedClinicalIDHModel()

result = model.load_state_dict(
    checkpoint["model_state_dict"],
    strict=True,
)

model.eval()

print("Checkpoint loaded successfully!")
print("Epoch:", checkpoint.get("epoch"))
print("Validation accuracy:", checkpoint.get("val_accuracy"))
print("Validation loss:", checkpoint.get("val_loss"))
print("Strict loading:", result)

with torch.no_grad():
    mri = torch.randn(1, 4, 128, 128, 96)
    clinical = torch.randn(1, 2)
    logits = model(mri, clinical)

print("Output shape:", tuple(logits.shape))
print("Test passed:", tuple(logits.shape) == (1, 2))
