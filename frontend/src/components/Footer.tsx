import React from 'react';
import { Shield, Brain, GitCommit } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-slate-950 border-t border-slate-900 py-8 px-4 lg:px-8 text-slate-400 text-xs mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-cyan-400" />
          <div>
            <span className="font-heading font-semibold text-slate-200 text-sm">NeuroInsight AI</span>
            <p className="text-slate-500 text-[11px]">
              Multimodal CNN + Vision Transformer IDH Classification Platform
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-slate-400 text-xs">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>Privacy Compliant (Temporary In-Memory Processing)</span>
          </div>
          <div className="flex items-center gap-1.5 hidden sm:flex">
            <GitCommit className="w-3.5 h-3.5 text-slate-500" />
            <span>PyTorch 3D CNN + ViT</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
