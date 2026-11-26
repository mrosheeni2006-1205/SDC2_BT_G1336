import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Tuple, Dict, Any


class CNNBranch(nn.Module):
    def __init__(self, in_channels: int = 4):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv3d(in_channels, 32, kernel_size=3, padding=1),
            nn.BatchNorm3d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool3d(kernel_size=2, stride=2),
            nn.Conv3d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm3d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool3d(kernel_size=2, stride=2),
            nn.Conv3d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm3d(128),
            nn.ReLU(inplace=True),
            nn.MaxPool3d(kernel_size=2, stride=2),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.features(x)


class TokenProjection(nn.Module):
    def __init__(self, in_channels: int = 128, out_channels: int = 128):
        super().__init__()
        self.adaptive_pool = nn.AdaptiveAvgPool3d((4, 8, 12))
        self.projection = nn.Conv3d(in_channels, out_channels, kernel_size=1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.adaptive_pool(x)
        x = self.projection(x)
        B, C, D, H, W = x.shape
        x = x.view(B, C, D * H * W)
        return x.transpose(1, 2)  # [B, 384, 128]


class VisionTransformerBranch(nn.Module):
    def __init__(self, embed_dim: int = 128, num_heads: int = 4, num_layers: int = 2, dim_feedforward: int = 256, dropout: float = 0.1):
        super().__init__()
        self.pos_embedding = nn.Parameter(torch.zeros(1, 384, embed_dim))
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=embed_dim,
            nhead=num_heads,
            dim_feedforward=dim_feedforward,
            dropout=dropout,
            batch_first=True,
        )
        self.transformer = nn.TransformerEncoder(encoder_layer=encoder_layer, num_layers=num_layers)
        self.norm = nn.LayerNorm(embed_dim)

    def forward(self, tokens: torch.Tensor) -> torch.Tensor:
        x = tokens + self.pos_embedding
        x = self.transformer(x)
        x = self.norm(x)
        return x.mean(dim=1)  # [B, 128]


class ClinicalBranch(nn.Module):
    def __init__(self):
        super().__init__()
        self.network = nn.Sequential(
            nn.Linear(2, 64),
            nn.ReLU(inplace=True),
            nn.Dropout(0.2),
            nn.Linear(64, 128),
            nn.ReLU(inplace=True),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.network(x)


class MultimodalFusionBranch(nn.Module):
    def __init__(self):
        super().__init__()
        self.fusion = nn.Sequential(
            nn.Linear(256, 128),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
        )

    def forward(self, mri_emb: torch.Tensor, clinical_emb: torch.Tensor) -> torch.Tensor:
        fused = torch.cat([mri_emb, clinical_emb], dim=1)
        return self.fusion(fused)


class ClassifierBranch(nn.Module):
    def __init__(self):
        super().__init__()
        self.classifier = nn.Linear(128, 2)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.classifier(x)


class MultimodalCNNViT(nn.Module):
    """
    Multimodal 3D CNN + Vision Transformer for Brain Tumor IDH Classification matching trained checkpoint.
    """
    def __init__(self):
        super().__init__()
        self.cnn = CNNBranch(in_channels=4)
        self.token_projection = TokenProjection(in_channels=128, out_channels=128)
        self.vision_transformer = VisionTransformerBranch(embed_dim=128, num_heads=4, num_layers=2)
        self.clinical_encoder = ClinicalBranch()
        self.fusion = MultimodalFusionBranch()
        self.classifier = ClassifierBranch()

    def forward(self, mri: torch.Tensor, clinical: torch.Tensor) -> torch.Tensor:
        # 1. MRI 3D CNN
        cnn_features = self.cnn(mri)  # [B, 128, 16, 16, 12]

        # 2. Token Projection
        mri_tokens = self.token_projection(cnn_features)  # [B, 384, 128]

        # 3. Vision Transformer
        mri_embedding = self.vision_transformer(mri_tokens)  # [B, 128]

        # 4. Clinical Branch
        clinical_embedding = self.clinical_encoder(clinical)  # [B, 128]

        # 5. Multimodal Fusion
        fused_embedding = self.fusion(mri_embedding, clinical_embedding)  # [B, 128]

        # 6. IDH Classifier
        logits = self.classifier(fused_embedding)  # [B, 2]
        return logits


def create_model() -> MultimodalCNNViT:
    return MultimodalCNNViT()
