# NeuroInsight AI - System Architecture

NeuroInsight AI is a multimodal deep learning application for **Brain Tumor IDH Mutation Classification** using 3D MRI volumes and patient demographic features.

---

## Technical Pipeline Overview

```
Patient Data (Age, Sex)                     4 MRI Modalities (T1, T1ce, T2, FLAIR)
          │                                                    │
          ▼                                                    ▼
Clinical Preprocessor                                 MRI Preprocessor
- Age standardization                                 - Non-zero mean/std intensity scaling
- Binary Sex encoding (M=0, F=1)                      - Channel stacking [4, H, W, D]
          │                                           - 3D Trilinear resize [1, 4, 128, 128, 96]
          ▼                                                    │
Clinical Encoder (Dense 2->64->128)                            ▼
          │                                           3D CNN (32 -> 64 -> 128 channels)
          │                                                    │
          │                                                    ▼
          │                                           Adaptive Token Projection (384 Tokens)
          │                                                    │
          │                                                    ▼
          │                                           Vision Transformer (2 Layers, 4 Heads)
          │                                                    │
          ▼                                                    ▼
   Clinical Embedding [B, 128]                          MRI Embedding [B, 128]
          │                                                    │
          └──────────────────────────┬─────────────────────────┘
                                     │
                                     ▼
                     Multimodal Fusion (Dense 256->128)
                                     │
                                     ▼
                     IDH Classifier (Dense 128->2 Logits)
                                     │
                                     ▼
                     Softmax Probabilities & Class Call
```

---

## Multimodal Tensor Dimensions

| Stage | Input Shape | Output Shape | Operation |
|---|---|---|---|
| **MRI Preprocessing** | 4 raw NIfTI files | `[1, 4, 128, 128, 96]` | Stack + Trilinear Resize |
| **3D CNN Block 1** | `[B, 4, 128, 128, 96]` | `[B, 32, 64, 64, 48]` | Conv3d(3x3x3) + BN + ReLU + MaxPool(2) |
| **3D CNN Block 2** | `[B, 32, 64, 64, 48]` | `[B, 64, 32, 32, 24]` | Conv3d(3x3x3) + BN + ReLU + MaxPool(2) |
| **3D CNN Block 3** | `[B, 64, 32, 32, 24]` | `[B, 128, 16, 16, 12]` | Conv3d(3x3x3) + BN + ReLU + MaxPool(2) |
| **Token Projection** | `[B, 128, 16, 16, 12]` | `[B, 384, 128]` | AdaptivePool(4,8,12) + Conv1x1x1 + Flatten |
| **Vision Transformer** | `[B, 384, 128]` | `[B, 128]` | 2 Encoder Layers + Mean Token Pool |
| **Clinical Encoder** | `[B, 2]` | `[B, 128]` | Dense(2->64->128) + ReLU + Dropout(0.2) |
| **Multimodal Fusion** | `[B, 256]` | `[B, 128]` | Concat(MRI, Clinical) + Dense(256->128) |
| **Classifier** | `[B, 128]` | `[B, 2]` | Dense(128->2) Logits |
