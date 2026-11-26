import React from 'react';
import { BarChart3, CheckCircle2, Info } from 'lucide-react';

interface ConfidenceInsightsPanelProps {
  isMutated: boolean;
  wildTypeProb: number;
  mutatedProb: number;
}

export const ConfidenceInsightsPanel: React.FC<ConfidenceInsightsPanelProps> = ({
  isMutated,
  wildTypeProb,
  mutatedProb,
}) => {
  const modelScore = (isMutated ? mutatedProb : wildTypeProb) * 100;
  const altScore = (isMutated ? wildTypeProb : mutatedProb) * 100;
  const margin = modelScore - altScore;

  const separationTier =
    modelScore >= 90
      ? {
          label: `Strong class separation (Model score: ${modelScore.toFixed(1)}%)`,
          color: 'emerald',
          desc: 'The model separated the predicted class strongly from the alternative based on learned feature representations.',
        }
      : modelScore >= 75
      ? {
          label: `Moderate class separation (Model score: ${modelScore.toFixed(1)}%)`,
          color: 'cyan',
          desc: 'The model favored the predicted class, though feature overlap with the alternative class remains possible.',
        }
      : modelScore >= 60
      ? {
          label: `Intermediate class separation (Model score: ${modelScore.toFixed(1)}%)`,
          color: 'amber',
          desc: 'The classes are not cleanly separated by the model. Additional multimodal imaging or clinical context is especially relevant.',
        }
      : {
          label: `Low class separation (Model score: ${modelScore.toFixed(1)}%)`,
          color: 'red',
          desc: 'The model output is uncertain and near the decision threshold.',
        };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-cyan-400" />
        <div>
          <h3 className="font-heading font-bold text-white text-lg">Statistical Interpretation</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Understanding the model output score and class separation margin
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className={`md:col-span-2 flex items-start gap-3 p-4 rounded-2xl border text-xs ${
            separationTier.color === 'emerald'
              ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
              : separationTier.color === 'cyan'
              ? 'bg-cyan-950/30 border-cyan-800/50 text-cyan-300'
              : separationTier.color === 'amber'
              ? 'bg-amber-950/30 border-amber-800/50 text-amber-300'
              : 'bg-red-950/30 border-red-800/50 text-red-300'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">{separationTier.label}</p>
            <p className="opacity-80 leading-relaxed">{separationTier.desc}</p>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Derived metrics</p>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Class separation margin</span>
            <span
              className={`font-mono font-bold ${
                margin >= 30 ? 'text-emerald-400' : margin >= 15 ? 'text-amber-400' : 'text-red-400'
              }`}
            >
              {margin >= 0 ? '+' : ''}{margin.toFixed(1)} pp
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Output type</span>
            <span className="text-slate-200">Binary Softmax</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-400">Target classes</span>
            <span className="text-slate-200">IDH-mutant / IDH-wildtype</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5">
          <p className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400" /> Model Output vs Calibrated Probability
          </p>
          <p className="text-slate-400 leading-relaxed">
            The output score reflects neural network logit separation across learned multimodal patterns. It should not be interpreted as a calibrated biological probability or clinical confidence.
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5">
          <p className="font-semibold text-slate-200">Confirmatory Pathway</p>
          <p className="text-slate-400 leading-relaxed">
            Final glioma molecular subtyping requires validated histopathological and molecular testing, such as immunohistochemistry (IHC) or targeted DNA sequencing (NGS).
          </p>
        </div>
      </div>
    </div>
  );
};
