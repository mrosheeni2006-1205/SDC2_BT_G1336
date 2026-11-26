import { useState, useEffect } from 'react';

import { ActiveStep, PatientData, MRISet, AnalysisResponseData, SystemHealthStatus } from './types';
import { checkHealth } from './services/api';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { Stepper } from './components/Stepper';
import { LandingPage } from './pages/LandingPage';
import { PatientPage } from './pages/PatientPage';
import { MRIUploadPage } from './pages/MRIUploadPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { ResultsPage } from './pages/ResultsPage';

export function App() {
  const [activeStep, setActiveStep] = useState<ActiveStep>('landing');
  const [health, setHealth] = useState<SystemHealthStatus | null>(null);

  // Theme State: Default to 'light'
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('neuroinsight_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('neuroinsight_theme', theme);
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const [patientData, setPatientData] = useState<PatientData>({
    patientId: '',
    age: '',
    sex: '',
  });

  const [mriData, setMriData] = useState<MRISet>({
    t1: null,
    t1ce: null,
    t2: null,
    flair: null,
  });

  const [analysisResult, setAnalysisResult] = useState<AnalysisResponseData | null>(null);

  useEffect(() => {
    checkHealth()
      .then((status) => setHealth(status))
      .catch((err) => console.warn('Health check warning:', err));
  }, []);

  const handleStart = () => {
    setActiveStep('patient');
  };

  const handlePatientSubmit = (data: PatientData) => {
    setPatientData(data);
    setActiveStep('mri');
  };

  const handleMRISubmit = (mri: MRISet) => {
    setMriData(mri);
    setActiveStep('analysis');
  };

  const handleAnalysisSuccess = (result: AnalysisResponseData) => {
    setAnalysisResult(result);
    setActiveStep('results');
  };

  const handleNewAnalysis = () => {
    setPatientData({ patientId: '', age: '', sex: '' });
    setMriData({ t1: null, t1ce: null, t2: null, flair: null });
    setAnalysisResult(null);
    setActiveStep('landing');
  };

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-200 ${
        theme === 'light'
          ? 'light bg-slate-50 text-slate-900 selection:bg-cyan-500 selection:text-white'
          : 'dark bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950'
      }`}
    >
      <Header
        health={health}
        activeStep={activeStep}
        onNavigateHome={handleNewAnalysis}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <main className="flex-1 pb-12">
        <Stepper currentStep={activeStep} />

        {activeStep === 'landing' && <LandingPage onStart={handleStart} />}

        {activeStep === 'patient' && (
          <PatientPage
            initialData={patientData}
            onNext={handlePatientSubmit}
            onBack={() => setActiveStep('landing')}
          />
        )}

        {activeStep === 'mri' && (
          <MRIUploadPage
            initialMRI={mriData}
            onNext={handleMRISubmit}
            onBack={() => setActiveStep('patient')}
          />
        )}

        {activeStep === 'analysis' && (
          <AnalysisPage
            patient={patientData}
            mri={mriData}
            onSuccess={handleAnalysisSuccess}
            onErrorBack={() => setActiveStep('mri')}
          />
        )}

        {activeStep === 'results' && analysisResult && (
          <ResultsPage data={analysisResult} onNewAnalysis={handleNewAnalysis} />
        )}
      </main>

      <Footer />
    </div>
  );
}

export default App;
