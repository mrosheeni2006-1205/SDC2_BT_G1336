import React from 'react';
import { ArrowRight, Brain, Layers, CheckCircle2 } from 'lucide-react';
import { DisclaimerBanner } from '../components/DisclaimerBanner';


interface LandingPageProps {
  onStart: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-16">
      {/* Hero Section */}
      <div className="text-center space-y-6 max-w-4xl mx-auto pt-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 text-xs font-semibold">
          <Brain className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span>Multimodal Deep Learning Platform</span>
        </div>

        <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Brain Tumor IDH Classification via <span className="bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500 bg-clip-text text-transparent">Multimodal CNN + Vision Transformer</span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          NeuroInsight AI integrates four 3D MRI modalities (T1, T1ce, T2, FLAIR) with standardized clinical parameters to deliver precision AI decision support for binary Isocitrate Dehydrogenase (IDH) mutation status prediction.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button
            onClick={onStart}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-base flex items-center justify-center gap-3 transition-all duration-200 shadow-xl shadow-cyan-500/25 group"
          >
            <span>Start Multimodal Analysis</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <DisclaimerBanner />
      </div>

      {/* Supported Modalities & Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          {
            title: 'T1-Weighted',
            desc: 'Anatomical reference volume for tissue contrast evaluation.',
            badge: 'Channel 0',
            color: 'border-cyan-500/30 bg-cyan-950/20 text-cyan-400',
          },
          {
            title: 'T1ce (Contrast)',
            desc: 'Post-contrast enhancement highlighting active tumor margins.',
            badge: 'Channel 1',
            color: 'border-sky-500/30 bg-sky-950/20 text-sky-400',
          },
          {
            title: 'T2-Weighted',
            desc: 'Fluid sensitivity for edema and tumor infiltration bounds.',
            badge: 'Channel 2',
            color: 'border-blue-500/30 bg-blue-950/20 text-blue-400',
          },
          {
            title: 'FLAIR',
            desc: 'Fluid-attenuated inversion recovery suppressing CSF artifacts.',
            badge: 'Channel 3',
            color: 'border-indigo-500/30 bg-indigo-950/20 text-indigo-400',
          },
        ].map((item, idx) => (
          <div key={idx} className="glass-card p-5 rounded-2xl flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Layers className="w-5 h-5 text-cyan-400" />
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${item.color}`}>
                  {item.badge}
                </span>
              </div>
              <h3 className="font-heading font-semibold text-lg text-white">{item.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>3D NIfTI (.nii / .nii.gz)</span>
            </div>
          </div>
        ))}
      </div>

      {/* How It Works Section */}
      <div className="glass-panel p-8 rounded-3xl space-y-8 border border-slate-800">
        <div className="text-center space-y-2">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-white">
            Architecture & Workflow Pipeline
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            End-to-end multimodal deep learning pipeline matching exact training preprocessing specifications.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl space-y-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 text-cyan-400 flex items-center justify-center font-bold">
              01
            </div>
            <h4 className="font-heading font-semibold text-base text-white">Volume Standardization</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Each MRI modality undergoes non-zero voxel mean/std intensity normalization, stacking [T1, T1ce, T2, FLAIR], and 3D trilinear interpolation to [1, 4, 128, 128, 96].
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl space-y-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 text-cyan-400 flex items-center justify-center font-bold">
              02
            </div>
            <h4 className="font-heading font-semibold text-base text-white">3D CNN + ViT Feature Extraction</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Spatial feature maps are projected into 384 tokens of dimension 128, passed through a 2-layer 4-head Vision Transformer encoder, and pooled to an MRI embedding vector.
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl space-y-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 text-cyan-400 flex items-center justify-center font-bold">
              03
            </div>
            <h4 className="font-heading font-semibold text-base text-white">Multimodal Fusion & IDH Call</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Clinical features (standardized Age and encoded Sex) are fused with the MRI embedding (256 dims total) to compute Softmax probabilities for IDH Wild Type vs Mutated.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
