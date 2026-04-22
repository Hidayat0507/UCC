/**
 * Common Diagnoses with ICD-10 and SNOMED CT Codes
 * 
 * Use these for coding diagnoses in FHIR Condition resources
 */

export interface DiagnosisCode {
  icd10?: {
    code: string;
    display: string;
  };
  snomed?: {
    code: string;
    display: string;
  };
  text: string;
}

export interface DiagnosisSearchResult extends DiagnosisCode {
  key: string;
}

/**
 * Common diagnoses seen in primary care clinics in Malaysia
 */
export const COMMON_DIAGNOSES: Record<string, DiagnosisCode> = {
  // Respiratory
  'URTI': {
    icd10: { code: 'J06.9', display: 'Acute upper respiratory infection, unspecified' },
    snomed: { code: '54150009', display: 'Upper respiratory tract infection' },
    text: 'Upper Respiratory Tract Infection (URTI)'
  },
  'ACUTE_BRONCHITIS': {
    icd10: { code: 'J20.9', display: 'Acute bronchitis, unspecified' },
    snomed: { code: '10509002', display: 'Acute bronchitis' },
    text: 'Acute Bronchitis'
  },
  'ASTHMA': {
    icd10: { code: 'J45.9', display: 'Asthma, unspecified' },
    snomed: { code: '195967001', display: 'Asthma' },
    text: 'Asthma'
  },
  'ALLERGIC_RHINITIS': {
    icd10: { code: 'J30.9', display: 'Allergic rhinitis, unspecified' },
    snomed: { code: '61582004', display: 'Allergic rhinitis' },
    text: 'Allergic Rhinitis'
  },
  'PNEUMONIA': {
    icd10: { code: 'J18.9', display: 'Pneumonia, unspecified organism' },
    snomed: { code: '233604007', display: 'Pneumonia' },
    text: 'Pneumonia'
  },
  
  // Gastrointestinal
  'GASTRITIS': {
    icd10: { code: 'K29.7', display: 'Gastritis, unspecified' },
    snomed: { code: '4556007', display: 'Gastritis' },
    text: 'Gastritis'
  },
  'AGE': {
    icd10: { code: 'K52.9', display: 'Noninfective gastroenteritis and colitis, unspecified' },
    snomed: { code: '25374005', display: 'Gastroenteritis' },
    text: 'Acute Gastroenteritis (AGE)'
  },
  'GERD': {
    icd10: { code: 'K21.9', display: 'Gastro-esophageal reflux disease without esophagitis' },
    snomed: { code: '235595009', display: 'Gastroesophageal reflux disease' },
    text: 'Gastroesophageal Reflux Disease (GERD)'
  },
  
  // Cardiovascular
  'HYPERTENSION': {
    icd10: { code: 'I10', display: 'Essential (primary) hypertension' },
    snomed: { code: '38341003', display: 'Hypertension' },
    text: 'Hypertension'
  },
  'HYPERLIPIDEMIA': {
    icd10: { code: 'E78.5', display: 'Hyperlipidemia, unspecified' },
    snomed: { code: '55822004', display: 'Hyperlipidemia' },
    text: 'Hyperlipidemia'
  },
  
  // Endocrine
  'DIABETES_TYPE2': {
    icd10: { code: 'E11.9', display: 'Type 2 diabetes mellitus without complications' },
    snomed: { code: '44054006', display: 'Diabetes mellitus type 2' },
    text: 'Type 2 Diabetes Mellitus'
  },
  'DIABETES_TYPE1': {
    icd10: { code: 'E10.9', display: 'Type 1 diabetes mellitus without complications' },
    snomed: { code: '46635009', display: 'Diabetes mellitus type 1' },
    text: 'Type 1 Diabetes Mellitus'
  },
  'HYPOTHYROIDISM': {
    icd10: { code: 'E03.9', display: 'Hypothyroidism, unspecified' },
    snomed: { code: '40930008', display: 'Hypothyroidism' },
    text: 'Hypothyroidism'
  },
  
  // Musculoskeletal
  'BACK_PAIN': {
    icd10: { code: 'M54.9', display: 'Dorsalgia, unspecified' },
    snomed: { code: '161891005', display: 'Backache' },
    text: 'Back Pain'
  },
  'ARTHRITIS': {
    icd10: { code: 'M19.90', display: 'Unspecified osteoarthritis, unspecified site' },
    snomed: { code: '396275006', display: 'Osteoarthritis' },
    text: 'Osteoarthritis'
  },
  
  // Dermatological
  'DERMATITIS': {
    icd10: { code: 'L30.9', display: 'Dermatitis, unspecified' },
    snomed: { code: '43116000', display: 'Eczema' },
    text: 'Dermatitis/Eczema'
  },
  'URTICARIA': {
    icd10: { code: 'L50.9', display: 'Urticaria, unspecified' },
    snomed: { code: '126485001', display: 'Urticaria' },
    text: 'Urticaria (Hives)'
  },
  'FUNGAL_INFECTION': {
    icd10: { code: 'B35.9', display: 'Dermatophytosis, unspecified' },
    snomed: { code: '3218000', display: 'Mycosis' },
    text: 'Fungal Skin Infection'
  },
  
  // Infectious
  'FEVER': {
    icd10: { code: 'R50.9', display: 'Fever, unspecified' },
    snomed: { code: '386661006', display: 'Fever' },
    text: 'Fever'
  },
  'UTI': {
    icd10: { code: 'N39.0', display: 'Urinary tract infection, site not specified' },
    snomed: { code: '68566005', display: 'Urinary tract infection' },
    text: 'Urinary Tract Infection (UTI)'
  },
  'DENGUE': {
    icd10: { code: 'A97.9', display: 'Dengue fever [classical dengue]' },
    snomed: { code: '38362002', display: 'Dengue' },
    text: 'Dengue Fever'
  },
  
  // Neurological
  'HEADACHE': {
    icd10: { code: 'R51', display: 'Headache' },
    snomed: { code: '25064002', display: 'Headache' },
    text: 'Headache'
  },
  'MIGRAINE': {
    icd10: { code: 'G43.909', display: 'Migraine, unspecified, not intractable, without status migrainosus' },
    snomed: { code: '37796009', display: 'Migraine' },
    text: 'Migraine'
  },
  'VERTIGO': {
    icd10: { code: 'R42', display: 'Dizziness and giddiness' },
    snomed: { code: '399153001', display: 'Vertigo' },
    text: 'Vertigo/Dizziness'
  },
  
  // Other Common
  'ANXIETY': {
    icd10: { code: 'F41.9', display: 'Anxiety disorder, unspecified' },
    snomed: { code: '48694002', display: 'Anxiety' },
    text: 'Anxiety Disorder'
  },
  'DEPRESSION': {
    icd10: { code: 'F32.9', display: 'Major depressive disorder, single episode, unspecified' },
    snomed: { code: '35489007', display: 'Depressive disorder' },
    text: 'Depression'
  },
  'INSOMNIA': {
    icd10: { code: 'G47.00', display: 'Insomnia, unspecified' },
    snomed: { code: '193462001', display: 'Insomnia' },
    text: 'Insomnia'
  },
};

/**
 * Search for a diagnosis by text (fuzzy matching)
 */
export function findDiagnosisByText(text: string): DiagnosisCode | null {
  const searchText = text.toLowerCase().trim();
  
  // Exact match first
  for (const [key, diagnosis] of Object.entries(COMMON_DIAGNOSES)) {
    if (diagnosis.text.toLowerCase() === searchText) {
      return diagnosis;
    }
  }
  
  // Partial match
  for (const [key, diagnosis] of Object.entries(COMMON_DIAGNOSES)) {
    if (diagnosis.text.toLowerCase().includes(searchText) || 
        searchText.includes(diagnosis.text.toLowerCase())) {
      return diagnosis;
    }
  }
  
  // Match by key
  for (const [key, diagnosis] of Object.entries(COMMON_DIAGNOSES)) {
    if (key.toLowerCase().includes(searchText.replace(/\s+/g, '_'))) {
      return diagnosis;
    }
  }
  
  return null;
}

/**
 * Get all diagnosis codes as an array
 */
export function getAllDiagnoses(): DiagnosisCode[] {
  return Object.values(COMMON_DIAGNOSES);
}

export function searchDiagnoses(query: string, limit = 20): DiagnosisSearchResult[] {
  const searchText = query.toLowerCase().trim();
  const entries = Object.entries(COMMON_DIAGNOSES);

  if (!searchText) {
    return entries.slice(0, limit).map(([key, diagnosis]) => ({ key, ...diagnosis }));
  }

  const scored = entries
    .map(([key, diagnosis]) => {
      const text = diagnosis.text.toLowerCase();
      const icd = diagnosis.icd10?.code.toLowerCase() ?? '';
      const snomed = diagnosis.snomed?.code.toLowerCase() ?? '';

      let score = 0;
      if (text === searchText) score += 100;
      if (text.startsWith(searchText)) score += 75;
      if (text.includes(searchText)) score += 50;
      if (key.toLowerCase().includes(searchText.replace(/\s+/g, '_'))) score += 25;
      if (icd.startsWith(searchText)) score += 40;
      if (snomed.startsWith(searchText)) score += 20;

      return score > 0 ? { key, diagnosis, score } : null;
    })
    .filter((entry): entry is { key: string; diagnosis: DiagnosisCode; score: number } => Boolean(entry))
    .sort((a, b) => b.score - a.score || a.diagnosis.text.localeCompare(b.diagnosis.text))
    .slice(0, limit)
    .map(({ key, diagnosis }) => ({ key, ...diagnosis }));

  return scored;
}






