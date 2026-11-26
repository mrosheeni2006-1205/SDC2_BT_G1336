import React, { useState } from 'react';
import {
  Award,
  User,
  Download,
  RefreshCw,
  Sparkles,
  Brain,
  FlaskConical,
  Cpu,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

import { AnalysisResponseData } from '../types';
import { ModelArchitectureDiagram } from '../components/ModelArchitectureDiagram';
import { ReportModal } from '../components/ReportModal';
import { DisclaimerBanner } from '../components/DisclaimerBanner';
import { ConfidenceInsightsPanel } from '../components/ConfidenceInsightsPanel';
import { ModelExplainabilitySection } from '../components/ModelExplainabilitySection';

interface ResultsPageProps {
  data: AnalysisResponseData;
  onNewAnalysis: () => void;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({ data, onNewAnalysis }) => {
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);

  // Collapsible states for educational reference sections (to avoid overwhelming users)
  const [showMriRef, setShowMriRef] = useState<boolean>(false);
  const [showIdhSignificance, setShowIdhSignificance] = useState<boolean>(false);
  const [showArchitecture, setShowArchitecture] = useState<boolean>(false);

  const isMutated = data.prediction.class === 1;
  const displayPredictedClass = isMutated ? 'IDH-mutant' : 'IDH-wildtype';
  const wildTypeProb = data.probabilities.idh_wild_type;
  const mutatedProb = data.probabilities.idh_mutated;
  const modelScore = (isMutated ? mutatedProb : wildTypeProb) * 100;

  const chartData = [
    {
      name: 'IDH-wildtype',
      score: (wildTypeProb * 100).toFixed(1),
      raw: wildTypeProb,
      color: '#0284c7',
    },
    {
      name: 'IDH-mutant',
      score: (mutatedProb * 100).toFixed(1),
      raw: mutatedProb,
      color: '#8b5cf6',
    },
  ];

  const handleScrollToXai = () => {
    const el = document.getElementById('model-explainability');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-md bg-cyan-950 text-cyan-300 text-[11px] font-semibold font-mono border border-cyan-800/60">
              ID: {data.analysis_id.slice(0, 8)}
            </span>
            <span className="text-xs text-slate-400">
              {new Date(data.created_at).toLocaleString()}
            </span>
          </div>
          <h1 className="font-heading font-bold text-3xl text-white">
            Multimodal IDH Classification Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Research demonstration platform · Multimodal 3D CNN + Vision Transformer (v{data.model.version})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onNewAnalysis}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors border border-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
            <span>New Analysis</span>
          </button>

          <button
            onClick={() => setIsReportOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
          >
            <Download className="w-4 h-4" />
            <span>Download Report</span>
          </button>
        </div>
      </div>

      {/* ── 1. Research and Educational Disclaimer ── */}
      <DisclaimerBanner />

      {/* ── 2 & 3. Model Classification Result & Patient Input Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. Model Classification Result */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-8 rounded-3xl border border-slate-800 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-cyan-400" /> Model Classification Result
              </span>
              {data.model.degraded_mode && (
                <span className="px-2.5 py-1 rounded bg-amber-950 text-amber-300 border border-amber-800/60 text-[10px] font-semibold">
                  Demo Mode
                </span>
              )}
            </div>

            {/* Prediction Label Highlight Card */}
            <div
              className={`p-6 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-6 ${
                isMutated
                  ? 'bg-purple-950/30 border-purple-800/60 text-purple-200'
                  : 'bg-sky-950/30 border-sky-800/60 text-sky-200'
              }`}
            >
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">
                  Model Prediction
                </span>
                <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-white">
                  {displayPredictedClass}
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed max-w-md">
                  The model predicted {displayPredictedClass} glioma based on the provided MRI and clinical inputs.
                </p>
              </div>

              <div className="text-center sm:text-right shrink-0 bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                <span className="text-xs text-slate-400 block mb-1">Model Output Score</span>
                <span className="font-heading font-extrabold text-3xl sm:text-4xl text-cyan-400">
                  {modelScore.toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                  Model score: {modelScore.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Probability Distribution Bar Chart */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Model Score Distribution
                </h4>
                <span className="text-[11px] text-slate-500">
                  Softmax output scores across binary classes
                </span>
              </div>

              <div className="h-44 w-full bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 40, bottom: 10 }}
                  >
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      unit="%"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fill: '#e2e8f0', fontSize: 12, fontWeight: 600 }}
                    />
                    <Tooltip
                      formatter={(value: any) => [`${value}%`, 'Model Output Score']}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        color: '#f8fafc',
                      }}
                    />
                    <Bar dataKey="score" radius={[0, 8, 8, 0]} barSize={24}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Patient and MRI Input Summary */}
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-5 shadow-xl">
            <h3 className="font-heading font-semibold text-lg text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <User className="w-5 h-5 text-cyan-400" /> Patient & Input Summary
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400">Patient ID</span>
                <span className="font-mono text-white font-semibold">{data.patient.patient_id}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400">Age</span>
                <span className="text-white font-semibold">{data.patient.age} years</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400">Biological Sex</span>
                <span className="text-white font-semibold">{data.patient.sex}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                MRI Modalities Provided
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {['T1', 'T1ce', 'T2', 'FLAIR'].map((mod) => (
                  <div
                    key={mod}
                    className="p-2 rounded bg-slate-900 border border-slate-800 text-emerald-400 font-semibold flex items-center gap-1.5"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>{mod}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Architecture</span>
                <span className="text-slate-200 font-semibold">{data.model.name}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Model Version</span>
                <span className="text-slate-200 font-semibold">{data.model.version}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Volumetric Grid</span>
                <span className="text-slate-200 font-mono text-[11px]">[4, 128, 128, 96]</span>
              </div>
            </div>
          </div>

          {/* 4. Model Explainability Summary Card */}
          <div className="bg-gradient-to-br from-cyan-950/40 to-slate-900 border border-cyan-800/40 p-5 rounded-2xl space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
                <Sparkles className="w-4 h-4" />
                <span>Model Explainability Summary</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                Available
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Model explanations show which MRI modalities, clinical features, and image regions were associated with the model's prediction.
            </p>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Explanations reflect model sensitivity patterns and do not identify the biological cause of the mutation.
            </p>

            <button
              onClick={handleScrollToXai}
              className="w-full mt-1 py-2 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-semibold text-xs flex items-center justify-center gap-1.5 border border-cyan-500/30 transition-colors"
            >
              <span>Scroll to Model Explainability</span>
              <span>↓</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 5. Model Explainability Section (Contains 6. SHAP, 7. Grad-CAM++, 8. Advanced Details) ── */}
      <div id="model-explainability">
        <ModelExplainabilitySection
          analysisId={data.analysis_id}
          predictedClass={data.prediction.class}
          predictedLabel={displayPredictedClass}
        />
      </div>

      {/* ── 9. Statistical Interpretation ── */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 shadow-xl">
        <ConfidenceInsightsPanel
          isMutated={isMutated}
          wildTypeProb={wildTypeProb}
          mutatedProb={mutatedProb}
        />
      </div>

      {/* ── EDUCATIONAL SECTIONS (COLLAPSIBLE ACCORDIONS) ── */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <span>Educational & Reference Materials</span>
        </div>

        {/* ── 10. MRI Modality Reference (Collapsible) ── */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <button
            onClick={() => setShowMriRef(!showMriRef)}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-900 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Brain className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-heading font-semibold text-base text-slate-100">
                  MRI Modality Reference
                </h3>
                <p className="text-xs text-slate-400">
                  Clinical descriptions of T1, T1ce, T2, and FLAIR MRI sequences
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
              <span>{showMriRef ? 'Hide Reference' : 'Show Reference'}</span>
              {showMriRef ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {showMriRef && (
            <div className="p-6 border-t border-slate-800 space-y-4">
              <p className="text-xs text-slate-400">
                The model ingests a 4-channel volumetric MRI stack [128×128×96 voxels] through the 3D CNN branch.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    mod: 'T1',
                    color: 'sky',
                    title: 'T1-Weighted',
                    desc: 'Anatomical baseline. Highlights fat, contrast between grey/white matter. Used for tumour delineation and volume assessment.',
                  },
                  {
                    mod: 'T1ce',
                    color: 'cyan',
                    title: 'T1 + Contrast',
                    desc: 'T1 post-gadolinium. Enhancing regions indicate blood–brain barrier breakdown — characteristic of high-grade glioma and active tumour.',
                  },
                  {
                    mod: 'T2',
                    color: 'emerald',
                    title: 'T2-Weighted',
                    desc: 'Highlights oedema, tumour infiltration zones, and cystic components. Critical for gross tumour volume contouring.',
                  },
                  {
                    mod: 'FLAIR',
                    color: 'purple',
                    title: 'FLAIR',
                    desc: 'Fluid-Attenuated Inversion Recovery. Suppresses CSF signal, revealing peri-tumoral oedema and non-enhancing infiltrative margins.',
                  },
                ].map(({ mod, color, title, desc }) => (
                  <div
                    key={mod}
                    className={`p-4 rounded-xl border bg-${color}-950/20 border-${color}-800/40 space-y-2`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold bg-${color}-500/20 text-${color}-300 border border-${color}-700/50`}
                      >
                        {mod}
                      </span>
                      <span className={`text-xs font-semibold text-${color}-200`}>{title}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 11. IDH Mutation Clinical Significance (Collapsible) ── */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <button
            onClick={() => setShowIdhSignificance(!showIdhSignificance)}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-900 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <FlaskConical className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-heading font-semibold text-base text-slate-100">
                  IDH Mutation — Clinical Significance at a Glance
                </h3>
                <p className="text-xs text-slate-400">
                  Biological background on IDH-wildtype vs IDH-mutant glioma profiles
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
              <span>{showIdhSignificance ? 'Hide Background' : 'Show Background'}</span>
              {showIdhSignificance ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </button>

          {showIdhSignificance && (
            <div className="p-6 border-t border-slate-800">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <p className="font-semibold text-sky-300 uppercase tracking-wide text-[10px]">
                    IDH-wildtype Glioma
                  </p>
                  <ul className="space-y-1.5 text-slate-400 leading-relaxed">
                    <li>• Enzymatic profile: Normal isocitrate → α-ketoglutarate conversion</li>
                    <li>• Metabolic markers: Absence of 2-hydroxyglutarate (2-HG) accumulation</li>
                    <li>• Epigenetics: G-CIMP negative (non-hypermethylated genome)</li>
                    <li>• Genetic alterations: Frequent TERT promoter mutations, EGFR amplification, PTEN loss</li>
                    <li>• Typical WHO classification: WHO Grade 4 Glioblastoma by definition under 2021 WHO criteria</li>
                    <li>• Prognostic association: Aggressive clinical course requiring multimodal therapeutic protocols</li>
                  </ul>
                </div>
                <div className="space-y-2 p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <p className="font-semibold text-purple-300 uppercase tracking-wide text-[10px]">
                    IDH-mutant Glioma
                  </p>
                  <ul className="space-y-1.5 text-slate-400 leading-relaxed">
                    <li>• Enzymatic profile: Neomorphic gain-of-function activity producing 2-HG</li>
                    <li>• Epigenetics: Glioma CpG island methylator phenotype (G-CIMP positive)</li>
                    <li>• Lineage markers: Astrocytoma (ATRX + TP53 mutated) or Oligodendroglioma (1p/19q codeleted)</li>
                    <li>• WHO grading: Typically WHO Grade 2 or 3 (Grade 4 if homozygous CDKN2A/B deletion present)</li>
                    <li>• Prognostic association: Significantly prolonged survival relative to wild-type counterparts</li>
                    <li>• Targeted research: Investigational and approved IDH inhibitors (e.g., vorasidenib)</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── 12. Model Architecture (Collapsible) ── */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
          <button
            onClick={() => setShowArchitecture(!showArchitecture)}
            className="w-full flex items-center justify-between p-5 hover:bg-slate-900 transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Cpu className="w-4 h-4" />
              </span>
              <div>
                <h3 className="font-heading font-semibold text-base text-slate-100">
                  Model Architecture Schematic
                </h3>
                <p className="text-xs text-slate-400">
                  Multimodal 3D CNN + Vision Transformer + Clinical MLP feature fusion pipeline
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
              <span>{showArchitecture ? 'Hide Schematic' : 'Show Schematic'}</span>
              {showArchitecture ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </button>

          {showArchitecture && (
            <div className="border-t border-slate-800">
              <ModelArchitectureDiagram />
            </div>
          )}
        </div>
      </div>

      {/* Report Modal */}
      <ReportModal
        analysisId={data.analysis_id}
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
      />
    </div>
  );
};
