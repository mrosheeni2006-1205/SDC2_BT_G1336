import React, { useState } from 'react';
import { Dna, FlaskConical, Microscope, Activity, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Pill, TrendingUp, BookOpen } from 'lucide-react';

interface BiologicalContextPanelProps {
  isMutated: boolean;
  confidence: number;
  patientAge: number;
  patientSex: string;
}

const IDH_WILD_TYPE_DATA = {
  geneStatus: 'IDH1/IDH2 Wild Type',
  whoGrade: 'WHO Grade IV (Glioblastoma)',
  altNames: ['GBM', 'Primary Glioblastoma', 'De Novo GBM'],
  medianSurvival: '14–16 months',
  molecularProfile: {
    description:
      'IDH Wild Type gliomas retain normal IDH enzyme function, producing α-ketoglutarate (α-KG) from isocitrate. These tumours harbour frequent co-alterations: TERT promoter mutations (>70%), EGFR amplification (~40%), PTEN loss (~30%), and the hallmark chromosome 7 gain / chromosome 10 loss pattern.',
    pathway: [
      { label: 'Isocitrate', arrow: '→', result: 'α-Ketoglutarate + CO₂  (normal)', normal: true },
      { label: 'α-KG', arrow: '→', result: 'Normal TCA cycle continues', normal: true },
      { label: 'TERT Promoter', arrow: '⚠', result: 'Telomerase reactivation → immortality', normal: false },
      { label: 'EGFR Amp.', arrow: '⚠', result: 'Hyper-proliferative RTK signalling', normal: false },
      { label: 'PTEN Loss', arrow: '⚠', result: 'PI3K/AKT/mTOR over-activation', normal: false },
    ],
  },
  epigenetics:
    'Lacks the hypermethylator phenotype (G-CIMP negative). Minimal CpG island methylation. Aggressive chromatin remodeling driven by RTK/RAS/PI3K pathway alterations. MGMT promoter methylation (~40%) is the key epigenetic marker influencing TMZ response.',
  prognosis: [
    { label: 'Median Overall Survival', value: '14–16 months', level: 'poor' },
    { label: '2-Year Survival Rate', value: '~10–15%', level: 'poor' },
    { label: '5-Year Survival Rate', value: '<5%', level: 'poor' },
    { label: 'Recurrence Rate', value: '>90% within 6–9 months', level: 'poor' },
    { label: 'MGMT Methylated Subgroup', value: 'Extended benefit from TMZ', level: 'moderate' },
  ],
  treatment: [
    'Maximal safe surgical resection (gross total resection when feasible)',
    'Concurrent Temozolomide (TMZ) + Radiotherapy — Stupp Protocol (60 Gy / 30 fractions)',
    'Adjuvant TMZ chemotherapy (6 cycles post-radiation)',
    'MGMT promoter methylation testing to guide TMZ decision',
    'Tumour Treating Fields (TTFields / Optune) — FDA-approved for newly diagnosed GBM',
    'Bevacizumab (anti-VEGF) for recurrent or refractory GBM',
    'Clinical trial consideration: EGFRvIII-targeted CAR-T, oncolytic virus (DNX-2401), PARP inhibitors',
  ],
  biomarkers: [
    { name: 'TERT Promoter Mutation', status: 'Frequently mutated (>70%)', color: 'red' },
    { name: 'EGFR Amplification', status: 'Often amplified (~40%)', color: 'orange' },
    { name: 'PTEN Loss', status: 'Often lost (~30%)', color: 'orange' },
    { name: 'Chr 7 gain / Chr 10 loss', status: 'Classic GBM molecular signature', color: 'red' },
    { name: 'MGMT Promoter Methylation', status: 'Variable — determines TMZ benefit', color: 'yellow' },
    { name: 'G-CIMP Status', status: 'Negative', color: 'red' },
  ],
};

const IDH_MUTATED_DATA = {
  geneStatus: 'IDH1 R132H / IDH2 R172K Mutant',
  whoGrade: 'WHO Grade II–III (Astrocytoma / Oligodendroglioma)',
  altNames: ['Lower-Grade Glioma', 'IDH-mutant Astrocytoma', 'Oligodendroglioma (1p/19q-codeleted)'],
  medianSurvival: '5–10+ years (Grade II–III)',
  molecularProfile: {
    description:
      'A missense point mutation (most commonly IDH1 R132H, ~80% of cases) creates a neomorphic enzymatic activity. The mutant enzyme converts α-ketoglutarate to 2-hydroxyglutarate (2-HG) — an oncometabolite that competitively inhibits α-KG–dependent dioxygenases (TET2, KDM histone demethylases). This triggers the G-CIMP hypermethylation phenotype and epigenetic silencing of tumour suppressors.',
    pathway: [
      { label: 'Isocitrate', arrow: '→', result: 'α-Ketoglutarate (normal step)', normal: true },
      { label: 'α-KG (mut. IDH)', arrow: '⚠', result: '2-Hydroxyglutarate (2-HG) — oncometabolite', normal: false },
      { label: '2-HG accumulates', arrow: '→', result: 'TET2 & KDM inhibition', normal: false },
      { label: 'TET2 inhibited', arrow: '→', result: 'DNA hypermethylation (G-CIMP+)', normal: false },
      { label: 'G-CIMP+', arrow: '→', result: 'Tumour suppressor gene silencing', normal: false },
    ],
  },
  epigenetics:
    'G-CIMP+ (Glioma CpG Island Methylator Phenotype positive). Extensive CpG island hypermethylation across the genome. Astrocytic lineage: ATRX loss + TP53 co-mutation. Oligodendroglial lineage: 1p/19q co-deletion. CDKN2A/B homozygous deletion upstages to WHO Grade IV.',
  prognosis: [
    { label: 'Median OS — Grade II', value: '10+ years', level: 'good' },
    { label: 'Median OS — Grade III Astrocytoma', value: '5–7 years', level: 'moderate' },
    { label: '5-Year Survival — Oligodendroglioma', value: '~70–80%', level: 'good' },
    { label: '5-Year Survival — Astrocytoma Gr. III', value: '~40–55%', level: 'moderate' },
    { label: 'Recurrence Pattern', value: 'Slower, often focal', level: 'good' },
  ],
  treatment: [
    'Surgical resection (extent of resection is an independent prognostic factor)',
    'Radiotherapy (54–60 Gy in 30 fractions)',
    'PCV chemotherapy (Procarbazine + CCNU + Vincristine) — preferred for 1p/19q co-deleted oligodendroglioma',
    'Temozolomide (TMZ) — for IDH-mutant astrocytoma (ATRX-mutant / TP53-mutant lineage)',
    'Vorasidenib (FDA approved 2023) — IDH1/2 inhibitor for Grade 2 IDH-mutant non-enhancing glioma',
    'Ivosidenib — IDH1-specific inhibitor for IDH1 R132H mutant variants',
    'Enasidenib — IDH2-specific inhibitor for IDH2 R172K/R172S variants',
    'Active surveillance (watchful waiting) acceptable in asymptomatic low-risk Grade II',
  ],
  biomarkers: [
    { name: 'IDH1 R132H', status: 'Defining mutation (~80% of IDH-mut)', color: 'green' },
    { name: '1p/19q Co-deletion', status: 'Oligodendroglioma lineage marker', color: 'green' },
    { name: 'ATRX Loss', status: 'Astrocytoma lineage (mut. excl. 1p/19q)', color: 'yellow' },
    { name: 'TP53 Mutation', status: 'Co-mutation in astrocytic lineage', color: 'yellow' },
    { name: 'CDKN2A/B Homozygous Del.', status: 'Upstages to WHO Grade IV', color: 'orange' },
    { name: 'G-CIMP Status', status: 'Positive (favourable epigenetic marker)', color: 'green' },
  ],
};

const levelColors: Record<string, string> = {
  poor: 'text-red-400',
  moderate: 'text-amber-400',
  good: 'text-emerald-400',
};

const biomarkerColors: Record<string, string> = {
  red: 'bg-red-500/10 border-red-500/30 text-red-300',
  orange: 'bg-orange-500/10 border-orange-500/30 text-orange-300',
  yellow: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  green: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
};

export const BiologicalContextPanel: React.FC<BiologicalContextPanelProps> = ({
  isMutated,
  patientAge,
  patientSex,
}) => {
  const [openSection, setOpenSection] = useState<string | null>('molecular');
  const d = isMutated ? IDH_MUTATED_DATA : IDH_WILD_TYPE_DATA;

  const toggle = (key: string) => setOpenSection(openSection === key ? null : key);

  const Section: React.FC<{ id: string; icon: React.ReactNode; title: string; children: React.ReactNode }> = ({
    id, icon, title, children,
  }) => (
    <div className="border border-slate-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => toggle(id)}
        className="w-full flex items-center justify-between px-5 py-4 bg-slate-900/80 hover:bg-slate-800/60 transition-colors text-left"
      >
        <span className={`flex items-center gap-2 text-sm font-semibold ${isMutated ? 'text-purple-300' : 'text-sky-300'}`}>
          {icon}
          {title}
        </span>
        {openSection === id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {openSection === id && <div className="bg-slate-950/50 px-5 py-5">{children}</div>}
    </div>
  );

  const accentBg = isMutated ? 'bg-purple-950/30 border-purple-800/50' : 'bg-sky-950/30 border-sky-800/50';
  const accentText = isMutated ? 'text-purple-200' : 'text-sky-200';
  const accentIcon = isMutated ? 'bg-purple-500/10 border-purple-500/30' : 'bg-sky-500/10 border-sky-500/30';
  const accentIconText = isMutated ? 'text-purple-400' : 'text-sky-400';
  const checkColor = isMutated ? 'text-purple-400' : 'text-sky-400';

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className={`w-10 h-10 rounded-xl ${accentIcon} flex items-center justify-center`}>
          <Dna className={`w-5 h-5 ${accentIconText}`} />
        </div>
        <div>
          <h3 className="font-heading font-bold text-white text-lg">Biological Context & Clinical Interpretation</h3>
          <p className="text-xs text-slate-400">Molecular pathway · Epigenetics · Prognosis · Treatment · Evidence</p>
        </div>
      </div>

      {/* Quick Classification Banner */}
      <div className={`p-4 rounded-2xl ${accentBg} border grid grid-cols-2 sm:grid-cols-4 gap-4`}>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1">Gene Status</p>
          <p className={`text-xs font-bold ${accentText}`}>{d.geneStatus}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1">WHO Classification</p>
          <p className={`text-xs font-bold ${accentText}`}>{d.whoGrade}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1">Typical Survival</p>
          <p className={`text-xs font-bold ${accentText}`}>{d.medianSurvival}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1">Also Known As</p>
          <p className={`text-xs font-bold ${accentText}`}>{d.altNames[0]}</p>
        </div>
      </div>

      {/* Age / Sex Risk Contextualization */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex gap-3 items-start">
        <Activity className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-white mb-1">Patient Risk Contextualization</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            {isMutated
              ? patientAge < 45
                ? `At ${patientAge} years old, IDH-mutant gliomas in younger patients typically carry the most favourable prognosis within the glioma spectrum. IDH mutation is associated with secondary gliomagenesis and often shows slower progression. Oligodendroglioma with 1p/19q co-deletion is the most favourable subtype.`
                : patientAge < 60
                ? `At ${patientAge} years, IDH-mutant grade strongly correlates with outcome. Age ≥ 45 combined with IDH mutation without 1p/19q co-deletion leans towards WHO Grade III astrocytoma. ATRX and TP53 status should be evaluated for full classification.`
                : `At ${patientAge} years with IDH mutation, CDKN2A/B homozygous deletion must be excluded — its presence upstages the tumour to WHO Grade IV IDH-mutant astrocytoma with substantially worse prognosis (~median OS 2–3 years).`
              : patientAge < 50
              ? `IDH Wild Type gliomas in patients under 50 are uncommon but still carry the worst prognosis in the glioma spectrum. Molecular confirmation with IDH sequencing and next-gen panel is strongly recommended.`
              : `At ${patientAge} years, IDH Wild Type status is consistent with primary Glioblastoma, the most common and aggressive malignant primary brain tumour in adults (median age at diagnosis: 64 years). Aggressive multimodal treatment should begin promptly.`}
            {patientSex === 'Male' && !isMutated
              ? ' Male sex is associated with a marginally higher GBM incidence (M:F ratio ≈ 1.6:1).'
              : ''}
          </p>
        </div>
      </div>

      {/* Accordion Sections */}
      <Section id="molecular" icon={<FlaskConical className="w-4 h-4" />} title="Molecular Pathway & Oncometabolite Mechanism">
        <p className="text-xs text-slate-300 leading-relaxed mb-4">{d.molecularProfile.description}</p>
        <div className="space-y-2">
          {d.molecularProfile.pathway.map((step, i) => (
            <div key={i} className={`flex items-start gap-3 p-2.5 rounded-lg border text-xs
              ${step.normal
                ? 'bg-slate-900 border-slate-800 text-slate-300'
                : 'bg-red-950/20 border-red-900/40 text-red-200'}`}>
              <span className="text-slate-500 shrink-0 w-28 font-mono">{step.label}</span>
              <span className={`font-mono ${step.normal ? 'text-slate-500' : 'text-red-400'} shrink-0`}>{step.arrow}</span>
              <span>{step.result}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="epigenetics" icon={<Microscope className="w-4 h-4" />} title="Epigenetic Profile & Co-occurring Biomarkers">
        <p className="text-xs text-slate-300 leading-relaxed mb-4">{d.epigenetics}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {d.biomarkers.map((bm, i) => (
            <div key={i} className={`p-2.5 rounded-xl border text-xs ${biomarkerColors[bm.color]}`}>
              <p className="font-semibold">{bm.name}</p>
              <p className="text-[11px] opacity-80 mt-0.5">{bm.status}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="prognosis" icon={<TrendingUp className="w-4 h-4" />} title="Clinical Prognosis Indicators">
        <div className="space-y-2">
          {d.prognosis.map((p, i) => (
            <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
              <span className="text-slate-400">{p.label}</span>
              <span className={`font-bold ${levelColors[p.level]}`}>{p.value}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="treatment" icon={<Pill className="w-4 h-4" />} title="Standard-of-Care Treatment Pathways">
        <ul className="space-y-2.5">
          {d.treatment.map((t, i) => (
            <li key={i} className="flex gap-2.5 text-xs text-slate-300 leading-relaxed">
              <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${checkColor}`} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="references" icon={<BookOpen className="w-4 h-4" />} title="Clinical Evidence References">
        <ul className="space-y-2 text-xs text-slate-400">
          <li>• Louis DN et al. <em>Acta Neuropathol</em> 2021 — WHO Classification of CNS Tumours, 5th Edition</li>
          <li>• Yan H et al. <em>N Engl J Med</em> 2009 — IDH1 and IDH2 mutations in gliomas</li>
          <li>• Dang L et al. <em>Nature</em> 2009 — Cancer-associated IDH1 mutations produce 2-HG</li>
          <li>• Stupp R et al. <em>N Engl J Med</em> 2005 — Radiotherapy + TMZ for newly diagnosed GBM</li>
          <li>• Mellinghoff IK et al. <em>N Engl J Med</em> 2023 — Vorasidenib for IDH-mutant Grade 2 glioma</li>
          <li>• Hegi ME et al. <em>N Engl J Med</em> 2005 — MGMT gene silencing and benefit from TMZ</li>
          <li>• Cairncross G et al. <em>J Clin Oncol</em> 2013 — PCV + RT for 1p/19q co-deleted anaplastic glioma</li>
        </ul>
      </Section>

      {/* Research Disclaimer */}
      <div className="flex gap-2.5 p-3.5 rounded-xl bg-amber-950/20 border border-amber-900/40 text-xs text-amber-300/80">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
        <span>
          Biological context is provided for educational and research purposes only. Treatment decisions
          must be made by a multidisciplinary neuro-oncology team based on comprehensive clinical, histological,
          and molecular workup — not solely on AI model predictions.
        </span>
      </div>
    </div>
  );
};
