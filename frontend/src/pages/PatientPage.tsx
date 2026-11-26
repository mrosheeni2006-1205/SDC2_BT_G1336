import React, { useState } from 'react';
import { User, Calendar, UserCheck, ArrowRight, AlertCircle } from 'lucide-react';
import { PatientData } from '../types';

interface PatientPageProps {
  initialData: PatientData;
  onNext: (data: PatientData) => void;
  onBack: () => void;
}

export const PatientPage: React.FC<PatientPageProps> = ({ initialData, onNext, onBack }) => {
  const [patientId, setPatientId] = useState<string>(initialData.patientId || '');
  const [age, setAge] = useState<string>(initialData.age !== '' ? String(initialData.age) : '');
  const [sex, setSex] = useState<'Male' | 'Female' | ''>(initialData.sex || '');

  const [errors, setErrors] = useState<{ patientId?: string; age?: string; sex?: string }>({});

  const validate = () => {
    const newErrors: { patientId?: string; age?: string; sex?: string } = {};

    if (!patientId.trim()) {
      newErrors.patientId = 'Patient Reference ID is required.';
    }

    const ageNum = parseFloat(age);
    if (!age || isNaN(ageNum)) {
      newErrors.age = 'Patient age is required.';
    } else if (ageNum < 0 || ageNum > 120) {
      newErrors.age = 'Age must be a valid number between 0 and 120.';
    }

    if (!sex) {
      newErrors.sex = 'Please select patient sex.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onNext({
        patientId: patientId.trim(),
        age: parseFloat(age),
        sex: sex as 'Male' | 'Female',
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="glass-panel p-8 rounded-3xl space-y-6 border border-slate-800 shadow-2xl">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-cyan-950 text-cyan-400 flex items-center justify-center font-bold">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-2xl text-white">
                Patient Clinical Information
              </h2>
              <p className="text-xs text-slate-400">
                Enter demographic variables required for clinical encoder standardization.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Patient ID */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-cyan-400" /> Patient Reference ID
            </label>
            <input
              type="text"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="e.g. PAT-2026-089"
              className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all ${
                errors.patientId ? 'border-rose-500/80 bg-rose-950/10' : 'border-slate-800'
              }`}
            />
            {errors.patientId && (
              <p className="text-xs text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {errors.patientId}
              </p>
            )}
            <p className="text-[11px] text-slate-500">
              Anonymized identifier for clinical trial or session reference.
            </p>
          </div>

          {/* Age */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-cyan-400" /> Patient Age (Years)
            </label>
            <input
              type="number"
              min="0"
              max="120"
              step="1"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="e.g. 54"
              className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all ${
                errors.age ? 'border-rose-500/80 bg-rose-950/10' : 'border-slate-800'
              }`}
            />
            {errors.age && (
              <p className="text-xs text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {errors.age}
              </p>
            )}
          </div>

          {/* Sex */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Patient Biological Sex
            </label>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Male', val: 'Male', desc: 'Encoded as 0.0' },
                { label: 'Female', val: 'Female', desc: 'Encoded as 1.0' },
              ].map((item) => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setSex(item.val as 'Male' | 'Female')}
                  className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    sex === item.val
                      ? 'bg-cyan-950/60 border-cyan-400 text-white ring-2 ring-cyan-400/20'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <span className="font-heading font-semibold text-sm">{item.label}</span>
                  <span className="text-[10px] text-slate-500 font-mono mt-1">{item.desc}</span>
                </button>
              ))}
            </div>
            {errors.sex && (
              <p className="text-xs text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {errors.sex}
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
            >
              Back to Overview
            </button>

            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
            >
              <span>Continue to MRI Upload</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
