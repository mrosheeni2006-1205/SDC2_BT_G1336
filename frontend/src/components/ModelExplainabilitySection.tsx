import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Brain,
  Sliders,
  RefreshCw,
  AlertCircle,
  Layers,
  Info,
  TrendingUp,
  TrendingDown,
  Target,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts';

import {
  ExplainabilityResponse,
  ModalityShapItem,
  ClinicalShapItem,
  GradCamSliceData,
} from '../types';
import { fetchExplainability, fetchGradCamSlice } from '../services/api';

interface ModelExplainabilitySectionProps {
  analysisId: string;
  predictedClass: number;
  predictedLabel: string;
}

export const ModelExplainabilitySection: React.FC<ModelExplainabilitySectionProps> = ({
  analysisId,
  predictedClass,
  predictedLabel: _predictedLabel,
}) => {
  const [data, setData] = useState<ExplainabilityResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Grad-CAM++ Interactive State
  const [selectedModality, setSelectedModality] = useState<string>('FLAIR');
  const [currentSliceIdx, setCurrentSliceIdx] = useState<number>(48);
  const [opacity, setOpacity] = useState<number>(0.65);
  const [sliceLoading, setSliceLoading] = useState<boolean>(false);
  const [sliceData, setSliceData] = useState<GradCamSliceData | null>(null);
  const [activeTab, setActiveTab] = useState<'both' | 'shap' | 'gradcam'>('both');

  // Collapsible Advanced Research Details
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Standardized scientific label
  const isMutated = predictedClass === 1;
  const displayPredictedLabel = isMutated ? 'IDH-mutant' : 'IDH-wildtype';

  // Load Explainability Data
  const loadExplainability = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchExplainability(analysisId);
      setData(response);
      if (response.gradcam?.initial_slice) {
        setSliceData(response.gradcam.initial_slice);
        setCurrentSliceIdx(response.gradcam.recommended_slice ?? 48);
        setSelectedModality(response.gradcam.initial_slice.modality || 'FLAIR');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load model explainability attributions.');
    } finally {
      setLoading(false);
    }
  }, [analysisId]);

  useEffect(() => {
    loadExplainability();
  }, [loadExplainability]);

  // Handle dynamic slice / modality / opacity update
  const handleSliceChange = async (newSlice: number, newModality?: string, newOpacity?: number) => {
    const mod = newModality ?? selectedModality;
    const op = newOpacity ?? opacity;
    setCurrentSliceIdx(newSlice);
    if (newModality) setSelectedModality(newModality);
    if (newOpacity !== undefined) setOpacity(newOpacity);

    setSliceLoading(true);
    try {
      const updatedSlice = await fetchGradCamSlice(analysisId, mod, newSlice, op);
      setSliceData(updatedSlice);
    } catch (err) {
      console.warn('Failed to fetch updated MRI slice:', err);
    } finally {
      setSliceLoading(false);
    }
  };

  // Jump to slice with highest displayed activation
  const handleJumpToPeak = () => {
    if (data?.gradcam?.recommended_slice !== undefined) {
      handleSliceChange(data.gradcam.recommended_slice);
    }
  };

  // -------------------------------------------------------------
  // Render: Loading State
  // -------------------------------------------------------------
  if (loading) {
    return (
      <section className="glass-panel p-8 rounded-3xl border border-slate-800 space-y-6 shadow-2xl">
        <div className="flex items-center gap-2.5 text-cyan-400 font-semibold text-sm">
          <Sparkles className="w-5 h-5 animate-spin" />
          <h3 className="font-heading text-lg text-white">Model Explainability</h3>
        </div>
        <div className="py-14 text-center space-y-4">
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-slate-200">
              Generating Model Explainability Attributions...
            </h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Computing modality-level SHAP attributions and 3D Grad-CAM++ convolutional saliency maps for the patient's MRI.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------
  // Render: Error State
  // -------------------------------------------------------------
  if (error || !data) {
    return (
      <section className="glass-panel p-8 rounded-3xl border border-slate-800 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-rose-400 font-semibold text-sm">
            <AlertCircle className="w-5 h-5" />
            <h3 className="font-heading text-lg text-white">Model Explainability</h3>
          </div>
          <button
            onClick={loadExplainability}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>

        <div className="p-6 bg-rose-950/30 border border-rose-800/60 rounded-2xl space-y-3">
          <p className="text-xs text-rose-200 leading-relaxed font-mono">
            {error || 'Explainability data unavailable.'}
          </p>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Please verify backend connectivity and ensure the session ID corresponds to an active analysis session.
          </p>
        </div>
      </section>
    );
  }

  // Formatting SHAP chart data
  const mriChartData = data.shap.mri_modalities.map((item: ModalityShapItem) => ({
    name: item.modality,
    shap: item.shap_value,
    percentage: item.percentage,
    direction: item.direction,
    abs: item.absolute_shap,
    // Cyan/green for positive (supports), Red/orange for negative (opposes)
    color: item.shap_value >= 0 ? '#10b981' : '#f43f5e',
  }));

  const clinicalChartData = data.shap.clinical_features.map((item: ClinicalShapItem) => ({
    name: `${item.feature} (${item.raw_value})`,
    feature: item.feature,
    shap: item.shap_value,
    percentage: item.percentage,
    direction: item.direction,
    // Cyan/green for positive (supports), Red/orange for negative (opposes)
    color: item.shap_value >= 0 ? '#06b6d4' : '#f59e0b',
  }));

  // Dynamically derive interpretations from actual values (never hardcoded)
  const positiveMriList = data.shap.mri_modalities.filter((m: ModalityShapItem) => m.shap_value > 0);
  const negativeMriList = data.shap.mri_modalities.filter((m: ModalityShapItem) => m.shap_value < 0);
  const topPosModality = positiveMriList.length > 0
    ? [...positiveMriList].sort((a, b) => b.shap_value - a.shap_value)[0]
    : null;
  const topNegModality = negativeMriList.length > 0
    ? [...negativeMriList].sort((a, b) => a.shap_value - b.shap_value)[0]
    : null;

  const dynamicMriStatement = topPosModality
    ? `Among the displayed MRI modality attributions, ${topPosModality.modality} had the largest positive contribution toward the selected model output (${topPosModality.percentage}% relative weight).`
    : topNegModality
    ? `Among the displayed MRI modality attributions, ${topNegModality.modality} had the strongest negative contribution opposing the selected model output (${topNegModality.percentage}% relative weight).`
    : `MRI modality contributions were balanced across all four sequences for this prediction.`;

  const ageItem = data.shap.clinical_features.find((f: ClinicalShapItem) => f.feature.toLowerCase().includes('age'));
  const sexItem = data.shap.clinical_features.find((f: ClinicalShapItem) => f.feature.toLowerCase().includes('sex'));
  const dynamicClinicalStatement = `Age and Sex contributed to the model output according to their displayed attribution values (${ageItem?.feature || 'Age'}: ${ageItem ? (ageItem.shap_value >= 0 ? `+${ageItem.shap_value.toFixed(4)}` : ageItem.shap_value.toFixed(4)) : 'N/A'}, ${sexItem?.feature || 'Sex'}: ${sexItem ? (sexItem.shap_value >= 0 ? `+${sexItem.shap_value.toFixed(4)}` : sexItem.shap_value.toFixed(4)) : 'N/A'}).`;

  const modalitiesList = ['FLAIR', 'T1', 'T1ce', 'T2'];
  const totalSlices = data.gradcam.total_slices || 96;
  const isZeroMap = data.gradcam.is_zero_map;

  return (
    <section className="space-y-6">
      {/* ── Section Title Banner ── */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                <Sparkles className="w-5 h-5" />
              </span>
              <div>
                <h2 className="font-heading font-extrabold text-2xl text-white tracking-tight">
                  Model Explainability
                </h2>
                <p className="text-xs text-slate-400">
                  Feature attributions (SHAP) and regional MRI activation maps (Grad-CAM++)
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('both')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'both' ? 'bg-cyan-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                All Insights
              </button>
              <button
                onClick={() => setActiveTab('shap')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'shap' ? 'bg-cyan-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                SHAP Attributions
              </button>
              <button
                onClick={() => setActiveTab('gradcam')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'gradcam' ? 'bg-cyan-500 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Grad-CAM++
              </button>
            </div>

            <button
              onClick={loadExplainability}
              title="Refresh explainability data"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Explainability Plain-Language Context Banner */}
        <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-800/40 flex items-start gap-3 text-xs text-cyan-200/90 leading-relaxed">
          <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-cyan-300 block">
              Explaining Model Prediction: {displayPredictedLabel}
            </span>
            <p className="text-slate-300">
              Model explanations show which MRI modalities, clinical features, and image regions were associated with the model's prediction. They describe model behavior and do not prove the underlying biological cause of the mutation.
            </p>
          </div>
        </div>
      </div>

      {/* ── 6. SHAP FEATURE ATTRIBUTION PANEL ── */}
      {(activeTab === 'both' || activeTab === 'shap') && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2 text-white font-heading font-bold text-lg">
              <Layers className="w-5 h-5 text-cyan-400" />
              <span>SHAP Feature Attribution Panel</span>
            </div>

            {/* Direction Legend */}
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-emerald-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                <span>+ Supports {displayPredictedLabel}</span>
              </span>
              <span className="flex items-center gap-1.5 text-rose-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                <span>- Opposes {displayPredictedLabel}</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 6A: MRI Modality Attribution Chart */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                    <Brain className="w-4 h-4 text-emerald-400" /> MRI Modality Attribution
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Marginal attribution of each 3D MRI sequence (FLAIR, T1, T2, T1ce)
                  </p>
                </div>
              </div>

              {/* Zero-Centered Horizontal Bar Chart */}
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mriChartData} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#f1f5f9', fontSize: 11, fontWeight: 700 }} />
                    <ReferenceLine x={0} stroke="#64748b" strokeDasharray="3 3" />
                    <Tooltip
                      formatter={(val: any, _name: any, item: any) => [
                        `SHAP: ${Number(val) > 0 ? '+' : ''}${Number(val).toFixed(4)} (${item.payload.percentage}% relative weight)`,
                        'Marginal Attribution',
                      ]}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', fontSize: '11px' }}
                    />
                    <Bar dataKey="shap" radius={[0, 4, 4, 0]} barSize={20}>
                      {mriChartData.map((entry: any, index: number) => (
                        <Cell key={`cell-mri-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Modality Breakdown Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-900 text-xs">
                {data.shap.mri_modalities.map((m: ModalityShapItem) => {
                  const isPos = m.direction === 'positive';
                  return (
                    <div key={m.modality} className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-200">{m.modality}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          isPos ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                        }`}>
                          {m.percentage}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-[11px]">
                        {isPos ? (
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                        )}
                        <span className={isPos ? 'text-emerald-400' : 'text-rose-400'}>
                          {m.shap_value > 0 ? `+${m.shap_value}` : m.shap_value}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 6B: Clinical Feature Attribution Chart */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-cyan-400" /> Clinical Feature Attribution
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Patient demographic impact holding MRI fixed (Age & Biological Sex)
                  </p>
                </div>
              </div>

              {/* Zero-Centered Horizontal Bar Chart */}
              <div className="h-56 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={clinicalChartData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#f1f5f9', fontSize: 11, fontWeight: 700 }} />
                    <ReferenceLine x={0} stroke="#64748b" strokeDasharray="3 3" />
                    <Tooltip
                      formatter={(val: any, _name: any, item: any) => [
                        `SHAP: ${Number(val) > 0 ? '+' : ''}${Number(val).toFixed(4)} (${item.payload.percentage}% relative weight)`,
                        'Marginal Attribution',
                      ]}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f8fafc', fontSize: '11px' }}
                    />
                    <Bar dataKey="shap" radius={[0, 4, 4, 0]} barSize={20}>
                      {clinicalChartData.map((entry: any, index: number) => (
                        <Cell key={`cell-clin-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Clinical Breakdown Badges */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900 text-xs">
                {data.shap.clinical_features.map((c: ClinicalShapItem) => {
                  const isPos = c.direction === 'positive';
                  return (
                    <div key={c.feature} className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/80 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-200">{c.feature}</span>
                        <span className="text-[10px] text-slate-400 font-mono">Value: {c.raw_value}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1 font-mono text-[11px]">
                          {isPos ? (
                            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                          ) : (
                            <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
                          )}
                          <span className={isPos ? 'text-cyan-400' : 'text-amber-400'}>
                            {c.shap_value > 0 ? `+${c.shap_value}` : c.shap_value}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">{c.percentage}% impact</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 6C: Plain-Language Dynamic Interpretation */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5 text-xs">
            <h5 className="font-bold text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Plain-Language Interpretation
            </h5>
            <div className="space-y-1.5 text-slate-300 leading-relaxed">
              <p>• {dynamicMriStatement}</p>
              <p>• {dynamicClinicalStatement}</p>
            </div>
            <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
              Positive values indicate features that shifted the network towards predicting <strong>{displayPredictedLabel}</strong>. Negative values indicate features that favored the alternative class.
            </p>
          </div>
        </div>
      )}

      {/* ── 7. GRAD-CAM++ MRI VISUALIZATION ── */}
      {(activeTab === 'both' || activeTab === 'gradcam') && (
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2 text-white font-heading font-bold text-lg">
              <Brain className="w-5 h-5 text-cyan-400" />
              <span>Grad-CAM++ MRI Visualization</span>
            </div>

            <div className="text-xs text-slate-400">
              Volumetric 3D convolutional activation mapping
            </div>
          </div>

          {isZeroMap ? (
            <div className="p-6 rounded-2xl bg-amber-950/30 border border-amber-800/60 text-amber-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>Zero Activation Map Detected</span>
              </div>
              <p className="leading-relaxed">
                No positive convolutional feature activations above baseline were detected in the final CNN layer for the{' '}
                <strong>{displayPredictedLabel}</strong> class. This indicates the prediction was influenced predominantly by clinical features or global patterns.
              </p>
            </div>
          ) : (
            <>
              {/* Interactive Controls Bar with Understandable Labels */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
                {/* 1. Modality Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                    Modality
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {modalitiesList.map((mod) => (
                      <button
                        key={mod}
                        onClick={() => handleSliceChange(currentSliceIdx, mod)}
                        className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                          selectedModality === mod
                            ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                            : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        {mod}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Slice Number Selector Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-semibold text-slate-300 uppercase tracking-wider">
                      Slice number
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-cyan-400 font-bold">
                        {currentSliceIdx + 1} / {totalSlices}
                      </span>
                      {data.gradcam.recommended_slice !== undefined && (
                        <button
                          onClick={handleJumpToPeak}
                          className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] font-semibold border border-emerald-800 hover:bg-emerald-900 transition-colors"
                          title="Jump to slice with highest displayed activation"
                        >
                          Slice with highest displayed activation (#{data.gradcam.recommended_slice + 1})
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={totalSlices - 1}
                    value={currentSliceIdx}
                    onChange={(e) => handleSliceChange(Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>Inferior (1)</span>
                    <span>Superior ({totalSlices})</span>
                  </div>
                </div>

                {/* 3. Heatmap Opacity Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1">
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" /> Heatmap opacity
                    </span>
                    <span className="font-mono text-cyan-400 font-bold">
                      {Math.round(opacity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={opacity}
                    onChange={(e) => handleSliceChange(currentSliceIdx, selectedModality, Number(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>0% (MRI only)</span>
                    <span>100% (Heatmap only)</span>
                  </div>
                </div>
              </div>

              {/* 3-View Slice Showcase (Understandable Primary View) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Original MRI */}
                <div className="space-y-2 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col items-center">
                  <div className="w-full flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-300">Original MRI</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-800">
                      {selectedModality} · Slice {currentSliceIdx + 1}
                    </span>
                  </div>
                  <div className="w-full aspect-square bg-black rounded-xl overflow-hidden relative flex items-center justify-center border border-slate-900 shadow-inner">
                    {sliceData?.mri_slice_base64 ? (
                      <img
                        src={sliceData.mri_slice_base64}
                        alt={`Original MRI ${selectedModality} Slice ${currentSliceIdx + 1}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-slate-600 text-xs">Loading slice...</div>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 text-center">
                    Standardized preprocessed {selectedModality} slice
                  </span>
                </div>

                {/* 2. Model Heatmap */}
                <div className="space-y-2 bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col items-center">
                  <div className="w-full flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-300">Model heatmap</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                      Grad-CAM++
                    </span>
                  </div>
                  <div className="w-full aspect-square bg-slate-950 rounded-xl overflow-hidden relative flex items-center justify-center border border-slate-900 shadow-inner">
                    {sliceData?.heatmap_slice_base64 ? (
                      <img
                        src={sliceData.heatmap_slice_base64}
                        alt={`Model Heatmap Slice ${currentSliceIdx + 1}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-slate-600 text-xs">Loading heatmap...</div>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 text-center">
                    Target class convolutional feature activation map
                  </span>
                </div>

                {/* 3. MRI + Heatmap Overlay */}
                <div className="space-y-2 bg-slate-950/80 border border-cyan-900/40 rounded-2xl p-4 flex flex-col items-center ring-1 ring-cyan-500/20 shadow-lg shadow-cyan-950/30">
                  <div className="w-full flex justify-between items-center text-xs">
                    <span className="font-bold text-cyan-300 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" /> MRI + heatmap overlay
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold">
                      α = {Math.round(opacity * 100)}%
                    </span>
                  </div>
                  <div className="w-full aspect-square bg-black rounded-xl overflow-hidden relative flex items-center justify-center border border-slate-800 shadow-inner">
                    {sliceData?.overlay_slice_base64 ? (
                      <img
                        src={sliceData.overlay_slice_base64}
                        alt={`MRI and model heatmap overlay Slice ${currentSliceIdx + 1}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-slate-600 text-xs">Loading overlay...</div>
                    )}
                    {sliceLoading && (
                      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-cyan-200/80 text-center font-medium">
                    MRI and model heatmap overlay
                  </span>
                </div>
              </div>

              {/* Colormap Legend Bar */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <span className="text-slate-400 text-[11px] flex items-center gap-1.5 font-medium">
                  <Info className="w-3.5 h-3.5 text-cyan-400" /> Saliency Intensity:
                </span>
                <div className="flex items-center gap-2 w-full sm:w-72">
                  <span className="text-[10px] font-mono text-slate-500">Low</span>
                  <div className="h-3 flex-1 rounded bg-gradient-to-r from-blue-700 via-emerald-500 via-amber-400 to-red-600 shadow-inner" />
                  <span className="text-[10px] font-mono text-red-400 font-bold">High</span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Slice max activation: {(sliceData?.max_activation ?? 0).toFixed(3)}
                </div>
              </div>

              {/* Required Heatmap Interpretation Disclaimer */}
              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs text-amber-200/90 flex items-start gap-2.5 leading-relaxed">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p>
                  The heatmap highlights MRI regions associated with the model's prediction. Highlighted areas do not necessarily correspond to tumor boundaries and do not prove the presence of a specific genetic mutation.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 8. ADVANCED EXPLANATION DETAILS (COLLAPSIBLE) ── */}
      <div className="glass-panel rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between p-5 bg-slate-900/60 hover:bg-slate-900 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Sliders className="w-4 h-4" />
            </span>
            <div>
              <h4 className="font-heading font-bold text-white text-base">
                Advanced Explanation Details
              </h4>
              <p className="text-xs text-slate-400">
                Technical metrics, quantitative saliency statistics, target layer information, and Shapley efficiency
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs shrink-0">
            <span>{showAdvanced ? 'Hide Technical Details' : 'Show Technical Details'}</span>
            {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showAdvanced && (
          <div className="p-6 border-t border-slate-800 space-y-6 bg-slate-950/50">
            {/* Quantitative Metrics Grid */}
            <div className="space-y-2">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Quantitative Saliency Statistics
              </h5>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] uppercase font-bold">Top 1% Activation</span>
                  <p className="font-mono text-cyan-300 font-extrabold text-base">
                    {(data.gradcam.top1pct_activation * 100).toFixed(1)}%
                  </p>
                  <span className="text-[10px] text-slate-400 block">Energy in peak 1% voxels</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] uppercase font-bold">Top 5% Activation</span>
                  <p className="font-mono text-cyan-300 font-extrabold text-base">
                    {(data.gradcam.top5pct_activation * 100).toFixed(1)}%
                  </p>
                  <span className="text-[10px] text-slate-400 block">Energy in peak 5% voxels</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] uppercase font-bold">Participation Ratio</span>
                  <p className="font-mono text-emerald-400 font-extrabold text-base">
                    {(data.gradcam.effective_volume_fraction * 100).toFixed(2)}%
                  </p>
                  <span className="text-[10px] text-slate-400 block">Effective volume fraction</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[10px] uppercase font-bold">Peak Slice Index</span>
                  <p className="font-mono text-amber-400 font-extrabold text-base">
                    Slice #{data.gradcam.recommended_slice + 1}
                  </p>
                  <span className="text-[10px] text-slate-400 block">Highest mean saliency slice</span>
                </div>
              </div>
            </div>

            {/* Target Layer & Architecture Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] block">
                  CNN Feature Layer & Grad-CAM++ Weights
                </span>
                <div className="space-y-1.5 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Target Layer:</span>
                    <span className="font-mono text-cyan-300">{data.gradcam.target_layer}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Feature Map Resolution:</span>
                    <span className="font-mono text-slate-300">16 × 16 × 12 voxels</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Interpolation Mode:</span>
                    <span className="font-mono text-slate-300">3D Trilinear to 128×128×96</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Weighting Formulation:</span>
                    <span className="font-mono text-slate-300">Analytical 2nd/3rd-Order Derivatives</span>
                  </div>
                </div>
              </div>

              {/* Exact SHAP Additivity Residual Verification */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] block">
                  Exact Shapley Additivity & Residual
                </span>
                <div className="space-y-1.5 text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Measured Residual:</span>
                    <span className="font-mono text-emerald-400">
                      Residual = {data.shap.mri_summary.additivity_residual}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Zero Baseline Margin:</span>
                    <span className="font-mono text-slate-300">{data.shap.mri_summary.baseline_margin}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sum of Modality SHAP:</span>
                    <span className="font-mono text-slate-300">{data.shap.mri_summary.shap_sum}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Full Patient Logit Margin:</span>
                    <span className="font-mono text-cyan-300">{data.shap.mri_summary.full_margin}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Scientific Methodological Limitations */}
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-2">
              <span className="font-semibold text-slate-300 block">
                Research Methodology & Scientific Constraints:
              </span>
              <ul className="space-y-1.5 list-disc list-inside text-slate-400 leading-relaxed">
                <li>
                  <strong>Coalition Grouping:</strong> Modality SHAP computes exact Shapley attributions across all $2^4 = 16$ sequence combinations. Individual voxel-level interactions within each sequence are aggregated into the sequence-level contribution.
                </li>
                <li>
                  <strong>Resolution Boundary:</strong> Convolutional feature activations originate from layer <code>cnn.features[10]</code> at downsampled spatial coordinates ($16 \times 16 \times 12$). While upsampled to the anatomical grid, boundaries reflect regional receptive fields rather than microvascular tumor contours.
                </li>
                <li>
                  <strong>Association vs Causation:</strong> Attributions explain how this neural network evaluated the multimodal input features relative to its training distribution; they do not establish biochemical or genetic causality.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
