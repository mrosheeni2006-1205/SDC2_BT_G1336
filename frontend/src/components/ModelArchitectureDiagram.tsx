import React from 'react';
import { Cpu, Layers, Zap, Database } from 'lucide-react';


export const ModelArchitectureDiagram: React.FC = () => {
  return (
    <div className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center gap-2 mb-4">
        <Cpu className="w-5 h-5 text-cyan-400" />
        <h3 className="font-heading font-semibold text-lg text-slate-100">
          How the Multimodal Model Worked
        </h3>
      </div>
      <p className="text-xs text-slate-400 mb-6">
        Visual schematic of the 3D CNN + Vision Transformer feature fusion pipeline.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative">
        {/* MRI Branch Card */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-cyan-400" /> MRI Volumetric Branch
            </span>
            <span className="text-[10px] bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded font-mono">
              [1, 4, 128, 128, 96]
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center">
              <span className="text-slate-300 font-medium">Stacked Modalities</span>
              <span className="text-cyan-300 font-mono text-[11px]">T1, T1ce, T2, FLAIR</span>
            </div>
            <div className="text-center text-slate-600">↓</div>
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center">
              <span className="text-slate-300 font-medium">3D CNN Blocks (32 → 64 → 128)</span>
              <span className="text-cyan-300 font-mono text-[11px]">[B, 128, 16, 16, 12]</span>
            </div>
            <div className="text-center text-slate-600">↓</div>
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center">
              <span className="text-slate-300 font-medium">Adaptive Token Projection</span>
              <span className="text-cyan-300 font-mono text-[11px]">384 Tokens × 128 Dim</span>
            </div>
            <div className="text-center text-slate-600">↓</div>
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center">
              <span className="text-slate-300 font-medium">Vision Transformer (2 Layers, 4 Heads)</span>
              <span className="text-cyan-300 font-mono text-[11px]">Mean Pool [B, 128]</span>
            </div>
          </div>

          <div className="mt-auto pt-2 bg-cyan-950/30 border border-cyan-900/50 rounded-lg p-2 text-center">
            <span className="text-xs font-semibold text-cyan-300">MRI Embedding Vector: 128 Dimensions</span>
          </div>
        </div>

        {/* Clinical Branch Card */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-purple-400" /> Clinical Data Branch
            </span>
            <span className="text-[10px] bg-purple-950 text-purple-300 px-2 py-0.5 rounded font-mono">
              [B, 2]
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center">
              <span className="text-slate-300 font-medium">Clinical Inputs</span>
              <span className="text-purple-300 font-mono text-[11px]">Age (Scaled), Sex (Encoded)</span>
            </div>
            <div className="text-center text-slate-600">↓</div>
            <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center">
              <span className="text-slate-300 font-medium">Dense Projection (2 → 64 → 128)</span>
              <span className="text-purple-300 font-mono text-[11px]">ReLU + Dropout(0.2)</span>
            </div>
          </div>

          <div className="mt-auto pt-2 bg-purple-950/30 border border-purple-900/50 rounded-lg p-2 text-center">
            <span className="text-xs font-semibold text-purple-300">Clinical Embedding Vector: 128 Dimensions</span>
          </div>
        </div>
      </div>

      {/* Multimodal Fusion & Classification Footer */}
      <div className="mt-6 bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-cyan-800/40 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Multimodal Concatenation & Fusion (256 → 128)
            </h4>
            <p className="text-[11px] text-slate-400">
              Joint representation fed into binary classifier layer (Linear 128 → 2)
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <span className="px-3 py-1 rounded bg-slate-950 text-slate-300 text-xs font-mono border border-slate-800">
            Class 0: IDH Wild Type
          </span>
          <span className="px-3 py-1 rounded bg-slate-950 text-slate-300 text-xs font-mono border border-slate-800">
            Class 1: IDH Mutated
          </span>
        </div>
      </div>
    </div>
  );
};
