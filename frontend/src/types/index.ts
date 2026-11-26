export type ActiveStep = 'landing' | 'patient' | 'mri' | 'analysis' | 'results';

export interface PatientData {
  patientId: string;
  age: number | '';
  sex: 'Male' | 'Female' | '';
}

export interface MRISet {
  t1: File | null;
  t1ce: File | null;
  t2: File | null;
  flair: File | null;
}

export interface PredictionResult {
  class: number; // 0: IDH Wild Type, 1: IDH Mutated
  label: 'IDH Wild Type' | 'IDH Mutated';
}

export interface PredictionProbabilities {
  idh_wild_type: number;
  idh_mutated: number;
}

export interface ModelMetadata {
  name: string;
  version: string;
  architecture: string;
  degraded_mode?: boolean;
  scaler_configured?: boolean;
  explainability_ready?: boolean;
}

export interface ModalityShapItem {
  modality: 'T1' | 'T1ce' | 'T2' | 'FLAIR';
  shap_value: number;
  absolute_shap: number;
  percentage: number;
  direction: 'positive' | 'negative';
  rank: number;
}

export interface ClinicalShapItem {
  feature: 'Age' | 'Sex';
  raw_value: string;
  standardized_value: number;
  shap_value: number;
  absolute_shap: number;
  percentage: number;
  direction: 'positive' | 'negative';
}

export interface ShapSummaryMetrics {
  baseline_margin: number;
  full_margin: number;
  shap_sum: number;
  additivity_residual: number;
  interpretation: string;
  limitations: string;
}

export interface GradCamSliceData {
  slice_index: number;
  total_slices: number;
  modality: string;
  opacity?: number;
  mri_slice_base64: string;
  heatmap_slice_base64: string;
  overlay_slice_base64: string;
  mean_activation: number;
  max_activation: number;
}

export interface GradCamSummary {
  target_class: number;
  target_label: string;
  target_layer: string;
  is_zero_map: boolean;
  total_slices: number;
  recommended_slice: number;
  top1pct_activation: number;
  top5pct_activation: number;
  effective_volume_fraction: number;
  slice_activation_profile: number[];
  initial_slice: GradCamSliceData;
  disclaimer: string;
}

export interface ExplainabilityResponse {
  analysis_id: string;
  patient_id: string;
  prediction: {
    class: number;
    label: string;
  };
  shap: {
    mri_modalities: ModalityShapItem[];
    mri_summary: ShapSummaryMetrics;
    clinical_features: ClinicalShapItem[];
    clinical_summary: ShapSummaryMetrics;
  };
  gradcam: GradCamSummary;
  scientific_disclaimer: string;
}


export interface AnalysisResponseData {
  analysis_id: string;
  status: string;
  created_at: string;
  patient: {
    patient_id: string;
    age: number;
    sex: string;
  };
  mri_modalities: string[];
  prediction: PredictionResult;
  probabilities: PredictionProbabilities;
  model: ModelMetadata;
  disclaimer: string;
}

export interface SystemHealthStatus {
  status: 'ok' | 'degraded';
  model_loaded: boolean;
  age_scaler_configured: boolean;
  checkpoint_path: string;
  config_path: string;
  device: string;
  details: {
    checkpoint_exists: boolean;
    error: string | null;
    age_scaler_note: string | null;
  };
}
