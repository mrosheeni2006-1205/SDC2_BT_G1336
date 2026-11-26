# Multimodal CNN + Vision Transformer Model Specification

## Model Architecture (`MultimodalCNNViT`)

```python
MultimodalCNNViT(
  (cnn_block1): Sequential(
    (0): Conv3d(4, 32, kernel_size=(3, 3, 3), padding=(1, 1, 1))
    (1): BatchNorm3d(32)
    (2): ReLU(inplace=True)
    (3): MaxPool3d(kernel_size=2, stride=2)
  )
  (cnn_block2): Sequential(
    (0): Conv3d(32, 64, kernel_size=(3, 3, 3), padding=(1, 1, 1))
    (1): BatchNorm3d(64)
    (2): ReLU(inplace=True)
    (3): MaxPool3d(kernel_size=2, stride=2)
  )
  (cnn_block3): Sequential(
    (0): Conv3d(64, 128, kernel_size=(3, 3, 3), padding=(1, 1, 1))
    (1): BatchNorm3d(128)
    (2): ReLU(inplace=True)
    (3): MaxPool3d(kernel_size=2, stride=2)
  )
  (adaptive_pool): AdaptiveAvgPool3d(output_size=(4, 8, 12))
  (token_conv): Conv3d(128, 128, kernel_size=(1, 1, 1))
  (transformer_encoder): TransformerEncoder(
    (layers): ModuleList(
      (0-1): 2 x TransformerEncoderLayer(
        d_model=128, nhead=4, dim_feedforward=256, dropout=0.1, batch_first=True
      )
    )
  )
  (clinical_encoder): Sequential(
    (0): Linear(in_features=2, out_features=64)
    (1): ReLU(inplace=True)
    (2): Dropout(p=0.2)
    (3): Linear(in_features=64, out_features=128)
    (4): ReLU(inplace=True)
  )
  (fusion): Sequential(
    (0): Linear(in_features=256, out_features=128)
    (1): ReLU(inplace=True)
    (2): Dropout(p=0.3)
  )
  (classifier): Linear(in_features=128, out_features=2)
)
```

## Checkpoint & Configuration Placement

- Model Checkpoint: `backend/model/best_multimodal_cnn_vit_idh.pth`
- Preprocessing Config: `backend/model/preprocessing_config.json`

### `preprocessing_config.json` Template
```json
{
  "age_scaler": {
    "mean": 55.4,
    "scale": 14.2
  },
  "sex_mapping": {
    "M": 0.0,
    "F": 1.0
  },
  "mri_modalities": [
    "T1",
    "T1ce",
    "T2",
    "FLAIR"
  ],
  "target_shape": [
    128,
    128,
    96
  ],
  "class_mapping": {
    "0": "IDH Wild Type",
    "1": "IDH Mutated"
  }
}
```
