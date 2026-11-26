import React from 'react';
import { User, Layers, Cpu, Award, Check } from 'lucide-react';
import { ActiveStep } from '../types';

interface StepperProps {
  currentStep: ActiveStep;
}

export const Stepper: React.FC<StepperProps> = ({ currentStep }) => {
  if (currentStep === 'landing') return null;

  const steps = [
    { id: 'patient', number: '01', title: 'Patient Information', icon: User },
    { id: 'mri', number: '02', title: 'MRI Uploads', icon: Layers },
    { id: 'analysis', number: '03', title: 'Multimodal Analysis', icon: Cpu },
    { id: 'results', number: '04', title: 'Results & Report', icon: Award },
  ];

  const getStepStatus = (stepId: string) => {
    const stepOrder = ['patient', 'mri', 'analysis', 'results'];
    const currentIndex = stepOrder.indexOf(currentStep);
    const stepIndex = stepOrder.indexOf(stepId);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'upcoming';
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-6 px-4">
      <div className="relative flex items-center justify-between">
        {/* Background Connecting Line */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-800 z-0" />

        {steps.map((step) => {
          const status = getStepStatus(step.id);

          return (

            <div key={step.id} className="relative z-10 flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 font-bold text-sm ${
                  status === 'completed'
                    ? 'bg-cyan-500 text-slate-950 ring-4 ring-cyan-500/20 shadow-lg shadow-cyan-500/30'
                    : status === 'active'
                    ? 'bg-slate-900 border-2 border-cyan-400 text-cyan-400 ring-4 ring-cyan-400/10 shadow-lg shadow-cyan-500/20'
                    : 'bg-slate-900 border border-slate-700 text-slate-500'
                }`}
              >
                {status === 'completed' ? (
                  <Check className="w-5 h-5 stroke-[3]" />
                ) : (
                  <span>{step.number}</span>
                )}
              </div>
              <div className="mt-2 text-center">
                <span
                  className={`text-xs font-semibold block transition-colors ${
                    status === 'active'
                      ? 'text-cyan-400 font-bold'
                      : status === 'completed'
                      ? 'text-slate-200'
                      : 'text-slate-500'
                  }`}
                >
                  {step.title}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
