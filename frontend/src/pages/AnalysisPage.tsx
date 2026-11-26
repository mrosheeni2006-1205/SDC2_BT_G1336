import React, { useState, useEffect } from 'react';
import { Cpu, CheckCircle2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { PatientData, MRISet, AnalysisResponseData } from '../types';
import { runAnalysis } from '../services/api';

interface AnalysisPageProps {
  patient: PatientData;
  mri: MRISet;
  onSuccess: (result: AnalysisResponseData) => void;
  onErrorBack: () => void;
}

export const AnalysisPage: React.FC<AnalysisPageProps> = ({
  patient,
  mri,
  onSuccess,
  onErrorBack,
}) => {
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const stages = [
    'Patient information validated',
    'MRI files received (T1, T1ce, T2, FLAIR)',
    'Preprocessing MRI volumes & non-zero normalization',
    '3D trilinear interpolation resize [1, 4, 128, 128, 96]',
    '3D CNN feature map extraction',
    'Adaptive token projection (384 tokens)',
    'Vision Transformer encoder pass (2 layers, 4 heads)',
    'Clinical feature encoding & age standardization',
    'Multimodal feature vector fusion (256 dims)',
    'Computing IDH binary classification Softmax probabilities',
  ];

  useEffect(() => {
    let isSubscribed = true;

    // Advance stage indicator every 400ms for visual user feedback
    const interval = setInterval(() => {
      setCurrentStageIndex((prev) => {
        if (prev < stages.length - 1) return prev + 1;
        return prev;
      });
    }, 400);

    // Call backend API
    runAnalysis(patient, mri)
      .then((data) => {
        if (isSubscribed) {
          setCurrentStageIndex(stages.length);
          setTimeout(() => {
            onSuccess(data);
          }, 600);
        }
      })
      .catch((err) => {
        if (isSubscribed) {
          setErrorMsg(err.message || 'An unexpected error occurred during inference.');
        }
      })
      .finally(() => {
        clearInterval(interval);
      });

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [patient, mri]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="glass-panel p-8 rounded-3xl border border-slate-800 space-y-8 shadow-2xl">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mx-auto shadow-lg shadow-cyan-500/30">
            <Cpu className="w-7 h-7 text-slate-950 animate-pulse" />
          </div>
          <h2 className="font-heading font-bold text-2xl text-white">
            Executing Multimodal AI Pipeline
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Processing volumetric MRI tensors and clinical demographic vectors through the 3D CNN + Vision Transformer architecture.
          </p>
        </div>

        {errorMsg ? (
          <div className="p-6 bg-rose-950/40 border border-rose-800/60 rounded-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-300 font-semibold text-sm">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>Analysis Pipeline Encountered an Error</span>
            </div>
            <p className="text-xs text-rose-200/80 leading-relaxed">{errorMsg}</p>
            <div className="pt-2">
              <button
                onClick={onErrorBack}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors border border-slate-700"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Return to Upload & Retry</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-6 space-y-3">
            {stages.map((stage, idx) => {
              const isCompleted = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;

              return (
                <div
                  key={idx}
                  className={`flex items-center gap-3 text-xs p-2.5 rounded-xl transition-all ${
                    isCompleted
                      ? 'text-emerald-400 bg-emerald-950/20 font-medium'
                      : isCurrent
                      ? 'text-cyan-300 bg-cyan-950/40 border border-cyan-800/60 font-bold'
                      : 'text-slate-600 opacity-60'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-slate-700 shrink-0" />
                  )}
                  <span>{stage}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
