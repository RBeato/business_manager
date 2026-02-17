#!/usr/bin/env tsx
/**
 * Seed biomarker topics for programmatic SEO
 * Generates 100+ topic entries across 4 layers:
 *   - Layer 1: Individual biomarkers (100+)
 *   - Layer 2: Lab panels (20+)
 *   - Layer 3: Condition-specific guides (30+)
 *   - Layer 4: Specific value interpretation (30+)
 *
 * Usage: npm run content:seed-biomarkers
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface BiomarkerTopic {
  topic: string
  keyword: string
  volume: number
  difficulty: 'easy' | 'medium' | 'hard'
  priority: number
  category: 'biomarker' | 'panel' | 'condition' | 'results'
}

// ============================================
// LAYER 1: Individual Biomarker Pages (100+)
// ============================================
const BIOMARKERS: BiomarkerTopic[] = [
  // === Blood Count (CBC) ===
  { topic: 'Hemoglobin: Complete Guide to Your Blood Oxygen Carrier', keyword: 'hemoglobin levels', volume: 14800, difficulty: 'medium', priority: 10, category: 'biomarker' },
  { topic: 'Hematocrit: What Your Red Blood Cell Volume Means', keyword: 'hematocrit levels', volume: 9900, difficulty: 'easy', priority: 9, category: 'biomarker' },
  { topic: 'White Blood Cell Count: What High and Low WBC Means', keyword: 'white blood cell count', volume: 22200, difficulty: 'hard', priority: 10, category: 'biomarker' },
  { topic: 'Platelet Count: Normal Ranges and What Abnormal Means', keyword: 'platelet count', volume: 18100, difficulty: 'medium', priority: 9, category: 'biomarker' },
  { topic: 'MCV Blood Test: What Mean Corpuscular Volume Reveals', keyword: 'MCV blood test', volume: 8100, difficulty: 'easy', priority: 8, category: 'biomarker' },
  { topic: 'MCH Blood Test: Mean Corpuscular Hemoglobin Explained', keyword: 'MCH blood test', volume: 6600, difficulty: 'easy', priority: 7, category: 'biomarker' },
  { topic: 'MCHC Blood Test: What It Measures and Why It Matters', keyword: 'MCHC blood test', volume: 5400, difficulty: 'easy', priority: 7, category: 'biomarker' },
  { topic: 'RDW Blood Test: Red Cell Distribution Width Explained', keyword: 'RDW blood test', volume: 6600, difficulty: 'easy', priority: 7, category: 'biomarker' },
  { topic: 'Neutrophils: What High and Low Counts Mean', keyword: 'neutrophils', volume: 12100, difficulty: 'medium', priority: 8, category: 'biomarker' },
  { topic: 'Lymphocytes: Understanding Your Immune Cell Count', keyword: 'lymphocytes', volume: 9900, difficulty: 'medium', priority: 8, category: 'biomarker' },
  { topic: 'Monocytes: What Elevated Levels Mean', keyword: 'monocytes high', volume: 4400, difficulty: 'easy', priority: 6, category: 'biomarker' },
  { topic: 'Eosinophils: Causes of High and Low Levels', keyword: 'eosinophils', volume: 6600, difficulty: 'easy', priority: 6, category: 'biomarker' },
  { topic: 'Basophils: What This Rare White Blood Cell Does', keyword: 'basophils', volume: 3600, difficulty: 'easy', priority: 5, category: 'biomarker' },
  { topic: 'Reticulocyte Count: How Your Body Makes New Red Blood Cells', keyword: 'reticulocyte count', volume: 2400, difficulty: 'easy', priority: 5, category: 'biomarker' },

  // === Iron Studies ===
  { topic: 'Ferritin Levels: Complete Guide to Iron Storage', keyword: 'ferritin levels', volume: 8100, difficulty: 'medium', priority: 10, category: 'biomarker' },
  { topic: 'Serum Iron: What Your Iron Blood Test Means', keyword: 'serum iron', volume: 4400, difficulty: 'easy', priority: 8, category: 'biomarker' },
  { topic: 'TIBC Test: Total Iron Binding Capacity Explained', keyword: 'TIBC test', volume: 2900, difficulty: 'easy', priority: 7, category: 'biomarker' },
  { topic: 'Transferrin Saturation: How to Interpret Your Results', keyword: 'transferrin saturation', volume: 2400, difficulty: 'easy', priority: 7, category: 'biomarker' },

  // === Lipid Panel ===
  { topic: 'Total Cholesterol: What Your Number Really Means', keyword: 'total cholesterol levels', volume: 14800, difficulty: 'hard', priority: 10, category: 'biomarker' },
  { topic: 'LDL Cholesterol: The "Bad" Cholesterol Explained', keyword: 'LDL cholesterol', volume: 22200, difficulty: 'hard', priority: 10, category: 'biomarker' },
  { topic: 'HDL Cholesterol: Why Higher Is Better', keyword: 'HDL cholesterol', volume: 18100, difficulty: 'hard', priority: 10, category: 'biomarker' },
  { topic: 'Triglycerides: Causes, Risks, and How to Lower Them', keyword: 'triglycerides', volume: 33100, difficulty: 'hard', priority: 10, category: 'biomarker' },
  { topic: 'VLDL Cholesterol: The Forgotten Lipid Marker', keyword: 'VLDL cholesterol', volume: 4400, difficulty: 'easy', priority: 6, category: 'biomarker' },
  { topic: 'Apolipoprotein B: A Better Cholesterol Marker?', keyword: 'apolipoprotein B', volume: 2900, difficulty: 'easy', priority: 7, category: 'biomarker' },
  { topic: 'Lp(a) Lipoprotein: The Hidden Heart Risk Factor', keyword: 'Lp(a) lipoprotein', volume: 2400, difficulty: 'easy', priority: 7, category: 'biomarker' },

  // === Metabolic Panel ===
  { topic: 'Blood Glucose: Fasting and Random Sugar Levels Explained', keyword: 'blood glucose levels', volume: 27100, difficulty: 'hard', priority: 10, category: 'biomarker' },
  { topic: 'HbA1c Test: Your 3-Month Blood Sugar Average', keyword: 'HbA1c test', volume: 22200, difficulty: 'hard', priority: 10, category: 'biomarker' },
  { topic: 'BUN Blood Test: Blood Urea Nitrogen Explained', keyword: 'BUN blood test', volume: 8100, difficulty: 'easy', priority: 8, category: 'biomarker' },
  { topic: 'Creatinine Levels: What They Say About Your Kidneys', keyword: 'creatinine levels', volume: 14800, difficulty: 'medium', priority: 9, category: 'biomarker' },
  { topic: 'eGFR: Estimated Glomerular Filtration Rate Explained', keyword: 'eGFR', volume: 12100, difficulty: 'medium', priority: 9, category: 'biomarker' },
  { topic: 'Sodium Levels: What High and Low Sodium Means', keyword: 'sodium levels blood test', volume: 6600, difficulty: 'easy', priority: 7, category: 'biomarker' },
  { topic: 'Potassium Levels: Why This Electrolyte Matters', keyword: 'potassium levels', volume: 9900, difficulty: 'medium', priority: 8, category: 'biomarker' },
  { topic: 'Calcium Blood Test: Beyond Bone Health', keyword: 'calcium blood test', volume: 6600, difficulty: 'easy', priority: 7, category: 'biomarker' },
  { topic: 'Magnesium Blood Test: The Most Deficient Mineral', keyword: 'magnesium blood test', volume: 4400, difficulty: 'easy', priority: 8, category: 'biomarker' },
  { topic: 'Chloride Blood Test: What It Measures', keyword: 'chloride blood test', volume: 2400, difficulty: 'easy', priority: 5, category: 'biomarker' },
  { topic: 'CO2 Blood Test: Bicarbonate and Acid-Base Balance', keyword: 'CO2 blood test', volume: 3600, difficulty: 'easy', priority: 5, category: 'biomarker' },
  { topic: 'Anion Gap: What This Calculated Value Reveals', keyword: 'anion gap', volume: 4400, difficulty: 'easy', priority: 6, category: 'biomarker' },
  { topic: 'Uric Acid Levels: Gout, Kidneys, and Heart Health', keyword: 'uric acid levels', volume: 9900, difficulty: 'medium', priority: 8, category: 'biomarker' },

  // === Liver Function ===
  { topic: 'ALT Blood Test: Alanine Aminotransferase Explained', keyword: 'ALT blood test', volume: 9900, difficulty: 'medium', priority: 9, category: 'biomarker' },
  { topic: 'AST Blood Test: Aspartate Aminotransferase Guide', keyword: 'AST blood test', volume: 8100, difficulty: 'medium', priority: 9, category: 'biomarker' },
  { topic: 'ALP Blood Test: Alkaline Phosphatase Explained', keyword: 'ALP blood test', volume: 6600, difficulty: 'easy', priority: 7, category: 'biomarker' },
  { topic: 'GGT Blood Test: Gamma-Glutamyl Transferase Guide', keyword: 'GGT blood test', volume: 4400, difficulty: 'easy', priority: 7, category: 'biomarker' },
  { topic: 'Bilirubin Levels: Total and Direct Bilirubin Explained', keyword: 'bilirubin levels', volume: 8100, difficulty: 'medium', priority: 8, category: 'biomarker' },
  { topic: 'Albumin Blood Test: What Low Albumin Means', keyword: 'albumin blood test', volume: 4400, difficulty: 'easy', priority: 7, category: 'biomarker' },
  { topic: 'Total Protein Blood Test: What It Reveals', keyword: 'total protein blood test', volume: 2900, difficulty: 'easy', priority: 6, category: 'biomarker' },

  // === Thyroid Function ===
  { topic: 'TSH Levels: The Master Thyroid Hormone Test', keyword: 'TSH levels', volume: 33100, difficulty: 'hard', priority: 10, category: 'biomarker' },
  { topic: 'Free T4: Thyroxine Levels Explained', keyword: 'free T4 levels', volume: 9900, difficulty: 'medium', priority: 9, category: 'biomarker' },
  { topic: 'Free T3: Triiodothyronine Test Guide', keyword: 'free T3 levels', volume: 6600, difficulty: 'medium', priority: 8, category: 'biomarker' },
  { topic: 'Thyroid Antibodies: TPO and Thyroglobulin Explained', keyword: 'thyroid antibodies', volume: 4400, difficulty: 'easy', priority: 7, category: 'biomarker' },
  { topic: 'Reverse T3: When to Test and What It Means', keyword: 'reverse T3', volume: 2400, difficulty: 'easy', priority: 6, category: 'biomarker' },

  // === Inflammation Markers ===
  { topic: 'CRP Blood Test: C-Reactive Protein and Inflammation', keyword: 'CRP blood test', volume: 12100, difficulty: 'medium', priority: 9, category: 'biomarker' },
  { topic: 'ESR Blood Test: Erythrocyte Sedimentation Rate Explained', keyword: 'ESR blood test', volume: 8100, difficulty: 'medium', priority: 8, category: 'biomarker' },
  { topic: 'Homocysteine Levels: Heart and Brain Health Marker', keyword: 'homocysteine levels', volume: 4400, difficulty: 'easy', priority: 8, category: 'biomarker' },
  { topic: 'Fibrinogen: Blood Clotting and Inflammation Marker', keyword: 'fibrinogen', volume: 3600, difficulty: 'easy', priority: 6, category: 'biomarker' },

  // === Vitamins and Minerals ===
  { topic: 'Vitamin D Levels: Complete Guide to the Sunshine Vitamin', keyword: 'vitamin D levels', volume: 22200, difficulty: 'hard', priority: 10, category: 'biomarker' },
  { topic: 'Vitamin B12 Levels: Deficiency, Symptoms, and Treatment', keyword: 'vitamin B12 levels', volume: 14800, difficulty: 'medium', priority: 9, category: 'biomarker' },
  { topic: 'Folate Blood Test: Why This B Vitamin Matters', keyword: 'folate blood test', volume: 4400, difficulty: 'easy', priority: 7, category: 'biomarker' },
  { topic: 'Zinc Blood Test: Signs of Deficiency and Optimal Levels', keyword: 'zinc blood test', volume: 3600, difficulty: 'easy', priority: 7, category: 'biomarker' },
  { topic: 'Selenium Levels: The Antioxidant Mineral', keyword: 'selenium levels', volume: 2400, difficulty: 'easy', priority: 6, category: 'biomarker' },
  { topic: 'Vitamin A Levels: What Your Blood Test Shows', keyword: 'vitamin A blood test', volume: 1800, difficulty: 'easy', priority: 5, category: 'biomarker' },
  { topic: 'Copper Blood Test: Levels, Deficiency, and Toxicity', keyword: 'copper blood test', volume: 1800, difficulty: 'easy', priority: 5, category: 'biomarker' },

  // === Hormones ===
  { topic: 'Testosterone Levels: Normal Ranges for Men and Women', keyword: 'testosterone levels', volume: 40500, difficulty: 'hard', priority: 10, category: 'biomarker' },
  { topic: 'Estradiol: Estrogen Levels and What They Mean', keyword: 'estradiol levels', volume: 9900, difficulty: 'medium', priority: 8, category: 'biomarker' },
  { topic: 'Cortisol Levels: The Stress Hormone Blood Test', keyword: 'cortisol levels', volume: 14800, difficulty: 'medium', priority: 9, category: 'biomarker' },
  { topic: 'DHEA-S: Dehydroepiandrosterone Sulfate Explained', keyword: 'DHEA-S levels', volume: 3600, difficulty: 'easy', priority: 6, category: 'biomarker' },
  { topic: 'Insulin Levels: Fasting Insulin and Insulin Resistance', keyword: 'insulin levels', volume: 9900, difficulty: 'medium', priority: 9, category: 'biomarker' },
  { topic: 'IGF-1: Insulin-Like Growth Factor Test Guide', keyword: 'IGF-1 levels', volume: 2400, difficulty: 'easy', priority: 6, category: 'biomarker' },
  { topic: 'Prolactin Levels: What High Prolactin Means', keyword: 'prolactin levels', volume: 4400, difficulty: 'easy', priority: 6, category: 'biomarker' },
  { topic: 'FSH and LH: Follicle Stimulating and Luteinizing Hormone', keyword: 'FSH levels', volume: 6600, difficulty: 'medium', priority: 7, category: 'biomarker' },
  { topic: 'Progesterone Levels: Fertility, Pregnancy, and Beyond', keyword: 'progesterone levels', volume: 8100, difficulty: 'medium', priority: 7, category: 'biomarker' },
  { topic: 'PSA Test: Prostate-Specific Antigen Explained', keyword: 'PSA test', volume: 18100, difficulty: 'hard', priority: 9, category: 'biomarker' },

  // === Cardiac Markers ===
  { topic: 'Troponin Levels: The Heart Attack Biomarker', keyword: 'troponin levels', volume: 9900, difficulty: 'medium', priority: 8, category: 'biomarker' },
  { topic: 'BNP Blood Test: Heart Failure Marker Explained', keyword: 'BNP blood test', volume: 4400, difficulty: 'easy', priority: 7, category: 'biomarker' },

  // === Coagulation ===
  { topic: 'PT/INR: Prothrombin Time and Blood Clotting', keyword: 'PT INR blood test', volume: 6600, difficulty: 'medium', priority: 7, category: 'biomarker' },
  { topic: 'D-Dimer Test: Blood Clot Detection Marker', keyword: 'D-dimer test', volume: 6600, difficulty: 'medium', priority: 7, category: 'biomarker' },

  // === Kidney Function ===
  { topic: 'Cystatin C: A Better Kidney Function Marker?', keyword: 'cystatin C', volume: 1800, difficulty: 'easy', priority: 6, category: 'biomarker' },
  { topic: 'Microalbumin Test: Early Kidney Damage Detection', keyword: 'microalbumin test', volume: 2900, difficulty: 'easy', priority: 7, category: 'biomarker' },

  // === Longevity / Advanced ===
  { topic: 'HOMA-IR: Insulin Resistance Index Explained', keyword: 'HOMA-IR', volume: 3600, difficulty: 'easy', priority: 8, category: 'biomarker' },
  { topic: 'Omega-3 Index: Why This Blood Test Matters', keyword: 'omega-3 index', volume: 2400, difficulty: 'easy', priority: 7, category: 'biomarker' },
  { topic: 'HsCRP: High-Sensitivity CRP for Heart Risk', keyword: 'hs-CRP test', volume: 3600, difficulty: 'easy', priority: 7, category: 'biomarker' },
  { topic: 'Fasting Insulin Test: Early Diabetes Detection', keyword: 'fasting insulin test', volume: 4400, difficulty: 'easy', priority: 8, category: 'biomarker' },
]

// ============================================
// LAYER 2: Lab Panel Pages (20+)
// ============================================
const PANELS: BiomarkerTopic[] = [
  { topic: 'Complete Blood Count (CBC): Every Test Explained', keyword: 'CBC test', volume: 49500, difficulty: 'hard', priority: 10, category: 'panel' },
  { topic: 'Comprehensive Metabolic Panel (CMP): Full Guide', keyword: 'CMP blood test', volume: 14800, difficulty: 'hard', priority: 10, category: 'panel' },
  { topic: 'Basic Metabolic Panel (BMP): What It Includes', keyword: 'BMP blood test', volume: 8100, difficulty: 'medium', priority: 9, category: 'panel' },
  { topic: 'Lipid Panel: Complete Cholesterol Test Guide', keyword: 'lipid panel', volume: 22200, difficulty: 'hard', priority: 10, category: 'panel' },
  { topic: 'Thyroid Panel: TSH, T3, T4 Complete Guide', keyword: 'thyroid panel', volume: 18100, difficulty: 'hard', priority: 10, category: 'panel' },
  { topic: 'Liver Function Tests (LFT): Complete Panel Guide', keyword: 'liver function test', volume: 14800, difficulty: 'medium', priority: 9, category: 'panel' },
  { topic: 'Renal Function Panel: Kidney Test Guide', keyword: 'kidney function test', volume: 9900, difficulty: 'medium', priority: 9, category: 'panel' },
  { topic: 'Iron Panel: Complete Iron Studies Guide', keyword: 'iron panel blood test', volume: 6600, difficulty: 'medium', priority: 9, category: 'panel' },
  { topic: 'Coagulation Panel: Blood Clotting Tests Explained', keyword: 'coagulation panel', volume: 3600, difficulty: 'easy', priority: 7, category: 'panel' },
  { topic: 'Hormone Panel for Men: Testosterone and Beyond', keyword: 'male hormone panel', volume: 4400, difficulty: 'medium', priority: 8, category: 'panel' },
  { topic: 'Hormone Panel for Women: Complete Fertility Workup', keyword: 'female hormone panel', volume: 4400, difficulty: 'medium', priority: 8, category: 'panel' },
  { topic: 'Inflammation Panel: CRP, ESR, and More', keyword: 'inflammation blood test', volume: 6600, difficulty: 'easy', priority: 8, category: 'panel' },
  { topic: 'Diabetes Panel: Glucose, HbA1c, Insulin', keyword: 'diabetes blood test', volume: 12100, difficulty: 'medium', priority: 9, category: 'panel' },
  { topic: 'Vitamin Panel: D, B12, Folate, and Iron', keyword: 'vitamin blood test', volume: 8100, difficulty: 'medium', priority: 8, category: 'panel' },
  { topic: 'Cardiac Risk Panel: Heart Health Blood Tests', keyword: 'heart health blood test', volume: 4400, difficulty: 'medium', priority: 8, category: 'panel' },
  { topic: 'Electrolyte Panel: Sodium, Potassium, Calcium', keyword: 'electrolyte panel', volume: 3600, difficulty: 'easy', priority: 7, category: 'panel' },
  { topic: 'Autoimmune Panel: ANA and Antibody Tests', keyword: 'autoimmune blood test', volume: 6600, difficulty: 'medium', priority: 7, category: 'panel' },
  { topic: 'STD Panel: Complete Sexual Health Screening', keyword: 'STD panel blood test', volume: 9900, difficulty: 'medium', priority: 7, category: 'panel' },
  { topic: 'Prenatal Panel: Essential Pregnancy Blood Tests', keyword: 'prenatal blood test', volume: 6600, difficulty: 'medium', priority: 8, category: 'panel' },
  { topic: 'Annual Wellness Panel: What Blood Tests to Get Yearly', keyword: 'annual blood test', volume: 8100, difficulty: 'medium', priority: 9, category: 'panel' },
]

// ============================================
// LAYER 3: Condition-Specific Lab Guides (30+)
// ============================================
const CONDITIONS: BiomarkerTopic[] = [
  { topic: 'Anemia Blood Tests: Iron Deficiency Diagnosis Guide', keyword: 'anemia blood test', volume: 8100, difficulty: 'medium', priority: 9, category: 'condition' },
  { topic: 'Type 2 Diabetes Lab Tests: Monitoring Guide', keyword: 'diabetes blood test results', volume: 6600, difficulty: 'medium', priority: 9, category: 'condition' },
  { topic: 'Hypothyroidism Labs: Hashimoto\'s Blood Test Guide', keyword: 'hypothyroidism blood test', volume: 6600, difficulty: 'medium', priority: 9, category: 'condition' },
  { topic: 'Hyperthyroidism Labs: Graves Disease Testing', keyword: 'hyperthyroidism blood test', volume: 4400, difficulty: 'easy', priority: 7, category: 'condition' },
  { topic: 'Heart Disease Blood Tests: Cardiac Risk Assessment', keyword: 'heart disease blood test', volume: 4400, difficulty: 'medium', priority: 8, category: 'condition' },
  { topic: 'Kidney Disease Lab Tests: CKD Staging and Monitoring', keyword: 'kidney disease blood test', volume: 4400, difficulty: 'medium', priority: 8, category: 'condition' },
  { topic: 'Liver Disease Lab Tests: Hepatitis and Fatty Liver', keyword: 'liver disease blood test', volume: 4400, difficulty: 'medium', priority: 8, category: 'condition' },
  { topic: 'PCOS Blood Tests: Polycystic Ovary Syndrome Diagnosis', keyword: 'PCOS blood test', volume: 6600, difficulty: 'medium', priority: 8, category: 'condition' },
  { topic: 'Pregnancy Blood Tests: Trimester-by-Trimester Guide', keyword: 'pregnancy blood test', volume: 8100, difficulty: 'medium', priority: 8, category: 'condition' },
  { topic: 'Celiac Disease Blood Tests: Antibody Testing Guide', keyword: 'celiac disease blood test', volume: 4400, difficulty: 'easy', priority: 7, category: 'condition' },
  { topic: 'Rheumatoid Arthritis Lab Tests: Diagnosis Guide', keyword: 'rheumatoid arthritis blood test', volume: 4400, difficulty: 'easy', priority: 7, category: 'condition' },
  { topic: 'Lupus Blood Tests: ANA and Autoimmune Panels', keyword: 'lupus blood test', volume: 4400, difficulty: 'easy', priority: 7, category: 'condition' },
  { topic: 'Menopause Blood Tests: Hormone Level Changes', keyword: 'menopause blood test', volume: 3600, difficulty: 'easy', priority: 7, category: 'condition' },
  { topic: 'Low Testosterone: Diagnosis and Lab Values', keyword: 'low testosterone blood test', volume: 6600, difficulty: 'medium', priority: 8, category: 'condition' },
  { topic: 'Insulin Resistance: HOMA-IR and Diagnosis Guide', keyword: 'insulin resistance test', volume: 4400, difficulty: 'easy', priority: 8, category: 'condition' },
  { topic: 'Vitamin D Deficiency: Testing and Treatment Guide', keyword: 'vitamin D deficiency test', volume: 8100, difficulty: 'medium', priority: 9, category: 'condition' },
  { topic: 'B12 Deficiency: Symptoms, Testing, and Recovery', keyword: 'B12 deficiency blood test', volume: 6600, difficulty: 'medium', priority: 8, category: 'condition' },
  { topic: 'Iron Deficiency vs Iron Overload: Lab Differences', keyword: 'iron deficiency blood test', volume: 6600, difficulty: 'medium', priority: 8, category: 'condition' },
  { topic: 'Gout Blood Tests: Uric Acid and Beyond', keyword: 'gout blood test', volume: 4400, difficulty: 'easy', priority: 6, category: 'condition' },
  { topic: 'Blood Clot Tests: DVT and PE Detection', keyword: 'blood clot test', volume: 6600, difficulty: 'medium', priority: 7, category: 'condition' },
  { topic: 'Prostate Cancer Screening: PSA and Beyond', keyword: 'prostate cancer blood test', volume: 6600, difficulty: 'medium', priority: 8, category: 'condition' },
  { topic: 'Osteoporosis Blood Tests: Bone Health Markers', keyword: 'osteoporosis blood test', volume: 2900, difficulty: 'easy', priority: 6, category: 'condition' },
  { topic: 'Chronic Fatigue: Blood Tests to Ask For', keyword: 'fatigue blood test', volume: 4400, difficulty: 'easy', priority: 8, category: 'condition' },
  { topic: 'Hair Loss Blood Tests: Hormones, Iron, and Thyroid', keyword: 'hair loss blood test', volume: 4400, difficulty: 'easy', priority: 7, category: 'condition' },
  { topic: 'Weight Gain Blood Tests: Thyroid, Hormones, Metabolic', keyword: 'unexplained weight gain blood test', volume: 2900, difficulty: 'easy', priority: 7, category: 'condition' },
  { topic: 'Inflammation: What Blood Tests Show Chronic Inflammation', keyword: 'inflammation blood test results', volume: 3600, difficulty: 'easy', priority: 8, category: 'condition' },
  { topic: 'Prediabetes Lab Tests: Early Detection Guide', keyword: 'prediabetes blood test', volume: 4400, difficulty: 'easy', priority: 8, category: 'condition' },
  { topic: 'Adrenal Fatigue: Cortisol and DHEA Testing', keyword: 'adrenal fatigue blood test', volume: 2900, difficulty: 'easy', priority: 6, category: 'condition' },
  { topic: 'Sleep Disorders: Blood Tests That Help Diagnose', keyword: 'sleep disorder blood test', volume: 1800, difficulty: 'easy', priority: 5, category: 'condition' },
  { topic: 'Food Allergies and Intolerances: IgE and IgG Testing', keyword: 'food allergy blood test', volume: 6600, difficulty: 'medium', priority: 7, category: 'condition' },
]

// ============================================
// LAYER 4: Specific Value Interpretation (30+)
// ============================================
const RESULTS: BiomarkerTopic[] = [
  // Ferritin values
  { topic: 'Ferritin Level 10-15: Is It Too Low?', keyword: 'ferritin level 10', volume: 1800, difficulty: 'easy', priority: 8, category: 'results' },
  { topic: 'Ferritin Level 500+: Causes of Very High Ferritin', keyword: 'ferritin 500', volume: 1200, difficulty: 'easy', priority: 7, category: 'results' },

  // TSH values
  { topic: 'TSH 4.0-5.0: Borderline High Thyroid', keyword: 'TSH 4.5', volume: 2400, difficulty: 'easy', priority: 8, category: 'results' },
  { topic: 'TSH Under 0.5: Low TSH Causes and Meaning', keyword: 'TSH low', volume: 4400, difficulty: 'easy', priority: 8, category: 'results' },
  { topic: 'TSH Over 10: What Very High TSH Means', keyword: 'TSH 10', volume: 1800, difficulty: 'easy', priority: 7, category: 'results' },

  // Vitamin D
  { topic: 'Vitamin D Level 20 ng/mL: Is It Deficient?', keyword: 'vitamin D 20', volume: 2400, difficulty: 'easy', priority: 8, category: 'results' },
  { topic: 'Vitamin D Level 50-80: Is Higher Better?', keyword: 'vitamin D 50', volume: 1200, difficulty: 'easy', priority: 6, category: 'results' },

  // Cholesterol
  { topic: 'LDL 130-160: Borderline High Cholesterol', keyword: 'LDL 130', volume: 1800, difficulty: 'easy', priority: 7, category: 'results' },
  { topic: 'Triglycerides 200-500: Moderately High Levels', keyword: 'triglycerides 200', volume: 2400, difficulty: 'easy', priority: 7, category: 'results' },
  { topic: 'HDL Below 40: Dangerously Low Good Cholesterol', keyword: 'low HDL cholesterol', volume: 3600, difficulty: 'easy', priority: 7, category: 'results' },

  // Blood glucose
  { topic: 'Fasting Blood Sugar 100-125: Prediabetes Range', keyword: 'fasting blood sugar 110', volume: 2400, difficulty: 'easy', priority: 8, category: 'results' },
  { topic: 'HbA1c 5.7-6.4: Prediabetes Explained', keyword: 'HbA1c 5.7', volume: 3600, difficulty: 'easy', priority: 8, category: 'results' },
  { topic: 'HbA1c 6.5+: Diabetes Diagnosis and What to Do', keyword: 'HbA1c 6.5', volume: 2400, difficulty: 'easy', priority: 8, category: 'results' },

  // Hemoglobin
  { topic: 'Hemoglobin 10-11: Mild Anemia Guide', keyword: 'hemoglobin 10', volume: 2400, difficulty: 'easy', priority: 7, category: 'results' },
  { topic: 'Hemoglobin Below 8: Severe Anemia Warning Signs', keyword: 'hemoglobin 8', volume: 1200, difficulty: 'easy', priority: 7, category: 'results' },

  // Liver enzymes
  { topic: 'ALT 40-100: Mildly Elevated Liver Enzymes', keyword: 'ALT 50', volume: 1800, difficulty: 'easy', priority: 7, category: 'results' },
  { topic: 'AST and ALT Both High: What Dual Elevation Means', keyword: 'AST ALT both high', volume: 2400, difficulty: 'easy', priority: 7, category: 'results' },

  // WBC
  { topic: 'WBC 3000-4000: Low White Blood Cell Count', keyword: 'low white blood cell count', volume: 6600, difficulty: 'medium', priority: 8, category: 'results' },
  { topic: 'WBC Over 11000: High White Blood Cell Count', keyword: 'high white blood cell count', volume: 8100, difficulty: 'medium', priority: 8, category: 'results' },

  // CRP
  { topic: 'CRP Over 10: High Inflammation Causes', keyword: 'CRP 10', volume: 1800, difficulty: 'easy', priority: 7, category: 'results' },
  { topic: 'CRP 1-3: Moderate Cardiovascular Risk', keyword: 'CRP 3', volume: 1200, difficulty: 'easy', priority: 6, category: 'results' },

  // Creatinine
  { topic: 'Creatinine 1.3-1.5: Mildly Elevated Kidney Marker', keyword: 'creatinine 1.5', volume: 1800, difficulty: 'easy', priority: 7, category: 'results' },
  { topic: 'eGFR 60-89: Stage 2 Kidney Disease Explained', keyword: 'eGFR 60', volume: 2400, difficulty: 'easy', priority: 7, category: 'results' },

  // Testosterone
  { topic: 'Testosterone Under 300: Low T in Men', keyword: 'testosterone 300', volume: 2400, difficulty: 'easy', priority: 8, category: 'results' },

  // Platelets
  { topic: 'Platelet Count Under 150,000: Low Platelets', keyword: 'low platelet count', volume: 8100, difficulty: 'medium', priority: 8, category: 'results' },
  { topic: 'Platelet Count Over 400,000: High Platelets', keyword: 'high platelet count', volume: 4400, difficulty: 'easy', priority: 7, category: 'results' },

  // B12
  { topic: 'B12 Level Under 200: Deficiency Diagnosis', keyword: 'B12 200', volume: 1800, difficulty: 'easy', priority: 7, category: 'results' },

  // Potassium
  { topic: 'Potassium 5.0-5.5: Borderline High Potassium', keyword: 'potassium 5.0', volume: 1800, difficulty: 'easy', priority: 7, category: 'results' },

  // Iron
  { topic: 'Iron Saturation Under 20%: Iron Deficiency?', keyword: 'low iron saturation', volume: 2400, difficulty: 'easy', priority: 7, category: 'results' },

  // Cortisol
  { topic: 'Morning Cortisol Under 10: Low Cortisol Guide', keyword: 'low cortisol morning', volume: 1800, difficulty: 'easy', priority: 6, category: 'results' },

  // PSA
  { topic: 'PSA 4-10: Gray Zone Explained', keyword: 'PSA 4', volume: 2400, difficulty: 'easy', priority: 7, category: 'results' },
]

// ============================================
// MAIN SEEDING FUNCTION
// ============================================

const ALL_TOPICS = [
  ...BIOMARKERS,
  ...PANELS,
  ...CONDITIONS,
  ...RESULTS,
]

async function main() {
  console.log('🧬 Seeding Biomarker Topics for Programmatic SEO...\n')
  console.log(`   Total topics: ${ALL_TOPICS.length}`)
  console.log(`   Biomarkers: ${BIOMARKERS.length}`)
  console.log(`   Panels: ${PANELS.length}`)
  console.log(`   Conditions: ${CONDITIONS.length}`)
  console.log(`   Results: ${RESULTS.length}`)
  console.log()

  let inserted = 0
  let skipped = 0
  let errors = 0

  for (const topic of ALL_TOPICS) {
    try {
      const { error } = await supabase
        .from('blog_topics')
        .insert({
          website: 'healthopenpage',
          topic: topic.topic,
          target_keyword: topic.keyword,
          search_volume: topic.volume,
          difficulty: topic.difficulty,
          priority: topic.priority,
          category: topic.category,
          status: 'queued'
        })

      if (error) {
        if (error.code === '23505') {
          skipped++
        } else {
          console.error(`  ❌ Error: ${topic.topic}`, error.message)
          errors++
        }
      } else {
        inserted++
        if (inserted % 10 === 0) {
          console.log(`  ✅ Inserted ${inserted} topics...`)
        }
      }
    } catch (error) {
      console.error(`  ❌ Failed: ${topic.topic}`, error)
      errors++
    }
  }

  console.log('\n📊 Seeding Summary:')
  console.log(`  ✅ Inserted: ${inserted}`)
  console.log(`  ⏭️  Skipped (duplicate): ${skipped}`)
  console.log(`  ❌ Errors: ${errors}`)

  // Print queue status
  const { count } = await supabase
    .from('blog_topics')
    .select('*', { count: 'exact', head: true })
    .eq('website', 'healthopenpage')
    .eq('status', 'queued')

  console.log(`\n  📝 Total queued healthopenpage topics: ${count}`)
  console.log('\n✅ Biomarker seeding complete!')
  console.log('\nNext steps:')
  console.log('  1. npm run content:generate-biomarker healthopenpage')
  console.log('  2. Review in Supabase or via Telegram')
  console.log('  3. npm run content:publish')
}

main().catch(console.error)
