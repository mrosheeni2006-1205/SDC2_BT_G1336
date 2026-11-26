import { SystemHealthStatus, AnalysisResponseData, PatientData, MRISet, ExplainabilityResponse, GradCamSliceData } from '../types';

const API_BASE_URL = '/api/v1';

export async function checkHealth(): Promise<SystemHealthStatus> {
  const response = await fetch(`${API_BASE_URL}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  return response.json();
}

export async function runAnalysis(
  patient: PatientData,
  mri: MRISet
): Promise<AnalysisResponseData> {
  if (!mri.t1 || !mri.t1ce || !mri.t2 || !mri.flair) {
    throw new Error('All 4 MRI modalities (T1, T1ce, T2, FLAIR) must be provided.');
  }

  const formData = new FormData();
  formData.append('patient_id', patient.patientId);
  formData.append('age', String(patient.age));
  formData.append('sex', patient.sex);
  formData.append('t1', mri.t1);
  formData.append('t1ce', mri.t1ce);
  formData.append('t2', mri.t2);
  formData.append('flair', mri.flair);

  const response = await fetch(`${API_BASE_URL}/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorMsg = 'Failed to process analysis.';
    try {
      const errJson = await response.json();
      errorMsg = errJson.detail || errorMsg;
    } catch {
      errorMsg = `Server error ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function fetchReportText(analysisId: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/analysis/${analysisId}/report`);
  if (!response.ok) {
    throw new Error(`Failed to fetch report for analysis ID ${analysisId}`);
  }
  return response.text();
}

export async function fetchExplainability(analysisId: string): Promise<ExplainabilityResponse> {
  const response = await fetch(`${API_BASE_URL}/analysis/${analysisId}/explainability`);
  if (!response.ok) {
    let errorMsg = 'Failed to load model explainability.';
    try {
      const errJson = await response.json();
      errorMsg = errJson.detail || errorMsg;
    } catch {
      errorMsg = `Server error ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMsg);
  }
  return response.json();
}

export async function fetchGradCamSlice(
  analysisId: string,
  modality: string = 'FLAIR',
  sliceIdx: number = 48,
  opacity: number = 0.6
): Promise<GradCamSliceData> {
  const params = new URLSearchParams({
    modality,
    slice_idx: String(sliceIdx),
    opacity: String(opacity),
  });
  const response = await fetch(`${API_BASE_URL}/analysis/${analysisId}/gradcam/slice?${params.toString()}`);
  if (!response.ok) {
    let errorMsg = 'Failed to load MRI slice.';
    try {
      const errJson = await response.json();
      errorMsg = errJson.detail || errorMsg;
    } catch {
      errorMsg = `Server error ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMsg);
  }
  return response.json();
}
