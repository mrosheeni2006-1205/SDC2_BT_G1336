
import torch
import torch.nn as nn


class CNNBranch(nn.Module):
    def __init__(self, in_channels=4):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv3d(in_channels, 32, kernel_size=3, padding=1),
            nn.BatchNorm3d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool3d(2, 2),
            nn.Conv3d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm3d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool3d(2, 2),
            nn.Conv3d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm3d(128),
            nn.ReLU(inplace=True),
            nn.MaxPool3d(2, 2),
        )

    def forward(self, x):
        return self.features(x)


class TokenProjection(nn.Module):
    def __init__(self):
        super().__init__()
        self.adaptive_pool = nn.AdaptiveAvgPool3d((4, 8, 12))
        self.projection = nn.Conv3d(128, 128, kernel_size=1)

    def forward(self, x):
        x = self.projection(self.adaptive_pool(x))
        batch, channels, depth, height, width = x.shape
        x = x.reshape(batch, channels, depth * height * width)
        return x.transpose(1, 2)


class VisionTransformerBranch(nn.Module):
    def __init__(self):
        super().__init__()
        self.pos_embedding = nn.Parameter(torch.zeros(1, 384, 128))
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=128,
            nhead=4,
            dim_feedforward=256,
            dropout=0.1,
            batch_first=True,
        )
        self.transformer = nn.TransformerEncoder(
            encoder_layer, num_layers=2
        )
        self.norm = nn.LayerNorm(128)

    def forward(self, tokens):
        x = tokens + self.pos_embedding
        x = self.transformer(x)
        x = self.norm(x)
        return x.mean(dim=1)


class CNNViTGatedClinicalIDHModel(nn.Module):
    def __init__(self):
        super().__init__()

        self.cnn = CNNBranch(in_channels=4)
        self.tokenizer = TokenProjection()
        self.vit = VisionTransformerBranch()

        self.mri_projection = nn.Sequential(
            nn.Linear(128, 64),
            nn.ReLU(inplace=True),
        )

        self.clinical_branch = nn.Sequential(
            nn.Linear(2, 32),
            nn.ReLU(inplace=True),
            nn.Dropout(0.2),
            nn.Linear(32, 16),
            nn.ReLU(inplace=True),
        )

        self.clinical_projection = nn.Sequential(
            nn.Linear(16, 64),
            nn.ReLU(inplace=True),
        )

        self.fusion_gate = nn.Sequential(
            nn.Linear(128, 64),
            nn.Sigmoid(),
        )

        self.classifier = nn.Sequential(
            nn.Linear(64, 64),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(64, 2),
        )

    def forward(self, mri, clinical):
        cnn_features = self.cnn(mri)
        tokens = self.tokenizer(cnn_features)
        mri_embedding = self.vit(tokens)
        mri_embedding = self.mri_projection(mri_embedding)

        clinical_embedding = self.clinical_branch(clinical)
        clinical_embedding = self.clinical_projection(
            clinical_embedding
        )

        combined = torch.cat(
            [mri_embedding, clinical_embedding], dim=1
        )
        gate = self.fusion_gate(combined)

        fused = (
            gate * mri_embedding
            + (1.0 - gate) * clinical_embedding
        )

        return self.classifier(fused)
