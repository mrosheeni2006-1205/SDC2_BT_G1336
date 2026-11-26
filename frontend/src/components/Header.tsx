import React from 'react';
import { Brain, Server, AlertTriangle, CheckCircle2, Sun, Moon } from 'lucide-react';

import { SystemHealthStatus } from '../types';

interface HeaderProps {
  health: SystemHealthStatus | null;
  onNavigateHome: () => void;
  activeStep: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  onNavigateHome,
  activeStep,
  theme,
  onToggleTheme,
}) => {
  return (
    <header className="sticky top-0 z-40 glass-panel border-b border-slate-800/80 px-4 lg:px-8 py-3.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-3 group text-left focus:outline-none"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform duration-200">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-bold text-xl tracking-tight text-white group-hover:text-cyan-400 transition-colors">
                NeuroInsight <span className="text-cyan-400">AI</span>
              </span>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-md bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                Research v1.0
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Multimodal 3D CNN + ViT IDH Classifier
            </p>
          </div>
        </button>

        {/* Right Info, Backend Health & Theme Toggle */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Theme Toggle Button */}
          <button
            onClick={onToggleTheme}
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700/80 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition-all shadow-sm"
          >
            {theme === 'light' ? (
              <>
                <Moon className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">Dark Mode</span>
              </>
            ) : (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Light Mode</span>
              </>
            )}
          </button>

          {health ? (
            <div
              className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
                health.status === 'ok'
                  ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400'
                  : 'bg-amber-950/60 border-amber-800/60 text-amber-400'
              }`}
            >
              {health.status === 'ok' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>
                {health.status === 'ok'
                  ? 'Model Ready'
                  : !health.model_loaded
                  ? 'Model Unloaded (Dev Mode)'
                  : 'Age Scaler Unconfigured'}
              </span>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-900 border border-slate-800 text-slate-400">
              <Server className="w-3.5 h-3.5 animate-spin text-slate-400" />
              <span>Connecting to Backend...</span>
            </div>
          )}

          {activeStep !== 'landing' && (
            <button
              onClick={onNavigateHome}
              className="text-xs font-medium px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700"
            >
              Reset Workflow
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
