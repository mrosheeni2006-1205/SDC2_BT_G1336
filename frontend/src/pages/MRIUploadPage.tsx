import React, { useState } from 'react';
import { Upload, FileCheck, Trash2, RefreshCw, AlertCircle, ArrowRight, Layers } from 'lucide-react';
import { MRISet } from '../types';

interface MRIUploadPageProps {
  initialMRI: MRISet;
  onNext: (mri: MRISet) => void;
  onBack: () => void;
}

export const MRIUploadPage: React.FC<MRIUploadPageProps> = ({ initialMRI, onNext, onBack }) => {
  const [mriFiles, setMriFiles] = useState<MRISet>(initialMRI);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const modalities = [
    { key: 't1' as const, name: 'T1-Weighted MRI', channel: 'Channel 0', desc: 'Anatomical reference 3D NIfTI volume' },
    { key: 't1ce' as const, name: 'T1ce (Contrast Enhanced)', channel: 'Channel 1', desc: 'Post-contrast enhancement volumetric MRI' },
    { key: 't2' as const, name: 'T2-Weighted MRI', channel: 'Channel 2', desc: 'Fluid sensitivity and edema 3D volume' },
    { key: 'flair' as const, name: 'FLAIR MRI', channel: 'Channel 3', desc: 'Fluid-attenuated inversion recovery 3D volume' },
  ];

  const handleFileChange = (key: keyof MRISet, file: File | null) => {
    setErrorMsg(null);
    if (file) {
      const name = file.name.toLowerCase();
      if (!name.endsWith('.nii') && !name.endsWith('.nii.gz')) {
        setErrorMsg(`Invalid file type for ${key.toUpperCase()}. Only .nii and .nii.gz formats are allowed.`);
        return;
      }
    }
    setMriFiles((prev) => ({ ...prev, [key]: file }));
  };


  const handleDrop = (key: keyof MRISet, e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(key, e.dataTransfer.files[0]);
    }
  };

  const isAllUploaded = Boolean(mriFiles.t1 && mriFiles.t1ce && mriFiles.t2 && mriFiles.flair);

  const handleSubmit = () => {
    if (!isAllUploaded) {
      setErrorMsg('Please upload all 4 required MRI modalities before proceeding.');
      return;
    }
    onNext(mriFiles);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 text-cyan-400 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-2xl text-white">
                MRI Modalities Upload
              </h2>
              <p className="text-xs text-slate-400">
                Provide 3D NIfTI (.nii or .nii.gz) files for all 4 required input channels.
              </p>
            </div>
          </div>

          <div className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
            Uploaded: <span className="text-cyan-400 font-bold">{Object.values(mriFiles).filter(Boolean).length} / 4</span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {modalities.map((mod) => {
            const currentFile = mriFiles[mod.key];

            return (
              <div
                key={mod.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(mod.key, e)}
                className={`glass-card p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  currentFile
                    ? 'border-emerald-500/40 bg-emerald-950/10'
                    : 'border-slate-800 hover:border-cyan-500/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-heading font-semibold text-base text-white">
                      {mod.name}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
                      {mod.channel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">{mod.desc}</p>

                  {currentFile ? (
                    <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <FileCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                          <div className="truncate">
                            <p className="text-xs font-semibold text-slate-200 truncate">
                              {currentFile.name}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              {formatSize(currentFile.size)}
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60 shrink-0">
                          Valid NIfTI
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
                        <label className="cursor-pointer text-[11px] font-semibold text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition-colors">
                          <RefreshCw className="w-3 h-3" />
                          <span>Replace</span>
                          <input
                            type="file"
                            accept=".nii,.nii.gz"
                            className="hidden"
                            onChange={(e) =>
                              e.target.files?.[0] && handleFileChange(mod.key, e.target.files[0])
                            }
                          />
                        </label>

                        <button
                          onClick={() => handleFileChange(mod.key, null)}
                          className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors ml-2"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-slate-800 hover:border-cyan-500/50 rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors group bg-slate-950/40">
                      <Upload className="w-6 h-6 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                      <span className="text-xs font-semibold text-slate-300 group-hover:text-cyan-300">
                        Drag & Drop or Click to Upload
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Accepted: .nii / .nii.gz
                      </span>
                      <input
                        type="file"
                        accept=".nii,.nii.gz"
                        className="hidden"
                        onChange={(e) =>
                          e.target.files?.[0] && handleFileChange(mod.key, e.target.files[0])
                        }
                      />
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-800">
          <button
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
          >
            Back to Patient Info
          </button>

          <button
            onClick={handleSubmit}
            disabled={!isAllUploaded}
            className={`px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-lg ${
              isAllUploaded
                ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            <span>Proceed to Multimodal Analysis</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
