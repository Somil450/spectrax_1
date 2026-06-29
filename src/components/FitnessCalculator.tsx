/**
 * FitnessCalculator.tsx
 *
 * Frontend-only Fitness Calculator Module for SpectraX.
 * Tabs: BMI · TDEE · Deficit · Surplus
 * All calculations are pure — no backend, no API, no DB.
 */

import React, { useState } from 'react';
import {
  ArrowLeft,
  Scale,
  Flame,
  TrendingDown,
  TrendingUp,
  Info,
  AlertCircle,
  Calculator,
  Activity,
} from 'lucide-react';
import {
  calculateBMI,
  calculateTDEE,
  getCalorieRecommendations,
  bmiCategoryColor,
  ACTIVITY_LABELS,
  type Gender,
  type ActivityLevel,
  type BMIResult,
  type TDEEResult,
  type CalorieRecommendations,
} from '../utils/fitnessCalculations';
import '../styles/FitnessCalculator.css';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

type Tab = 'bmi' | 'tdee' | 'deficit' | 'surplus';

export interface FitnessCalculatorProps {
  onBack: () => void;
}

interface SharedInputs {
  weight: string;
  height: string;
  age: string;
  gender: Gender;
  activity: ActivityLevel;
}

// ─────────────────────────────────────────────────────────────────
// REUSABLE PRIMITIVES
// ─────────────────────────────────────────────────────────────────

const InputField: React.FC<{
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  unit?: string;
}> = ({ label, id, value, onChange, placeholder, min, max, unit }) => (
  <div className="fitness-input-group">
    <label className="fitness-label" htmlFor={id}>
      {label}
      {unit && (
        <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>({unit})</span>
      )}
    </label>
    <input
      id={id}
      className="fitness-input"
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      aria-label={label}
    />
  </div>
);

const SelectField: React.FC<{
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ label, id, value, onChange, options }) => (
  <div className="fitness-input-group">
    <label className="fitness-label" htmlFor={id}>
      {label}
    </label>
    <div className="fitness-select-wrapper">
      <select
        id={id}
        className="fitness-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  </div>
);

const GenderToggle: React.FC<{
  value: Gender;
  onChange: (g: Gender) => void;
}> = ({ value, onChange }) => (
  <div className="fitness-input-group">
    <span className="fitness-label">Gender</span>
    <div className="fitness-gender-toggle" role="group" aria-label="Select gender">
      <button
        type="button"
        className={`fitness-gender-btn${value === 'male' ? ' active' : ''}`}
        onClick={() => onChange('male')}
        aria-pressed={value === 'male'}
      >
        ♂ Male
      </button>
      <button
        type="button"
        className={`fitness-gender-btn${value === 'female' ? ' active' : ''}`}
        onClick={() => onChange('female')}
        aria-pressed={value === 'female'}
      >
        ♀ Female
      </button>
    </div>
  </div>
);

const ErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div className="fitness-error" role="alert">
    <AlertCircle size={15} />
    {message}
  </div>
);

const InfoNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="fitness-info-note">
    <Info size={14} />
    <span>{children}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────
// VALIDATION HELPER
// ─────────────────────────────────────────────────────────────────

function validateBasic(weight: string, height: string): string {
  const w = parseFloat(weight);
  const h = parseFloat(height);
  if (!w || !h || w <= 0 || h <= 0) return 'Please enter valid weight and height values.';
  if (w < 20 || w > 300) return 'Weight must be between 20 and 300 kg.';
  if (h < 100 || h > 250) return 'Height must be between 100 and 250 cm.';
  return '';
}

function validateFull(weight: string, height: string, age: string): string {
  const basic = validateBasic(weight, height);
  if (basic) return basic;
  const a = parseFloat(age);
  if (!a || a <= 0) return 'Please enter a valid age.';
  if (a < 10 || a > 120) return 'Age must be between 10 and 120 years.';
  return '';
}

// ─────────────────────────────────────────────────────────────────
// BMI PANEL
// ─────────────────────────────────────────────────────────────────

const BMI_REFS: { label: string; range: string; color: string }[] = [
  { label: 'Underweight', range: '< 18.5',    color: 'var(--neon-cyan)'   },
  { label: 'Normal',      range: '18.5–24.9', color: 'var(--neon-green)'  },
  { label: 'Overweight',  range: '25–29.9',   color: 'var(--neon-yellow)' },
  { label: 'Obese',       range: '≥ 30',      color: 'var(--neon-red)'    },
];

const BMIPanel: React.FC<{
  inputs: SharedInputs;
  setInputs: React.Dispatch<React.SetStateAction<SharedInputs>>;
}> = ({ inputs, setInputs }) => {
  const [result, setResult] = useState<BMIResult | null>(null);
  const [error, setError] = useState('');

  const handleCalculate = () => {
    const err = validateBasic(inputs.weight, inputs.height);
    setError(err);
    if (err) return;
    setResult(calculateBMI(parseFloat(inputs.weight), parseFloat(inputs.height)));
  };

  const color = result ? bmiCategoryColor(result.category) : 'var(--neon-cyan)';

  return (
    <div className="fitness-card">
      
      <h2 className="fitness-card-title">
        <Scale size={18} /> BMI Calculator
      </h2>


      <div className="fitness-form-grid">
        <InputField
          label="Weight" id="bmi-weight" unit="kg"
          value={inputs.weight} onChange={(v) => setInputs((p) => ({ ...p, weight: v }))}
          placeholder="70" min={20} max={300}
        />
        <InputField
          label="Height" id="bmi-height" unit="cm"
          value={inputs.height} onChange={(v) => setInputs((p) => ({ ...p, height: v }))}
          placeholder="175" min={100} max={250}
        />
      </div>

      {error && <ErrorBanner message={error} />}

      <button className="fitness-calc-btn" onClick={handleCalculate} aria-label="Calculate BMI">
        <Calculator size={16} /> Calculate BMI
      </button>

      {result && (
        <div className="fitness-results">
          <div className="fitness-results-divider" />

          <div className="bmi-result-row">
            <div className="bmi-value-block">
              <span className="bmi-value" style={{ color }}>{result.bmi}</span>
              <span className="bmi-category-badge" style={{ color }}>{result.category}</span>
            </div>

            <div className="bmi-gauge-wrapper" aria-label={`BMI gauge: ${result.bmi}`}>
              <div className="bmi-gauge-track">
                <div className="bmi-gauge-marker" style={{ left: `${result.gaugePercent}%` }} />
              </div>
              <div className="bmi-gauge-labels">
                <span>10</span><span>18.5</span><span>25</span><span>30</span><span>45+</span>
              </div>
            </div>
          </div>

          <div className="bmi-reference" role="list" aria-label="BMI categories">
            {BMI_REFS.map((ref) => (
              <div
                key={ref.label}
                className={`bmi-ref-item${result.category === ref.label ? ' active-category' : ''}`}
                style={{ color: ref.color }}
                role="listitem"
              >
                <div className="bmi-ref-dot" />
                <span className="bmi-ref-label">{ref.label}</span>
                <span className="bmi-ref-range">{ref.range}</span>
              </div>
            ))}
          </div>

          <InfoNote>
            BMI is a screening tool, not a diagnostic measure. Consult a healthcare
            professional for personalised advice.
          </InfoNote>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// TDEE PANEL
// ─────────────────────────────────────────────────────────────────

const ACTIVITY_OPTIONS = (Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((k) => ({
  value: k,
  label: ACTIVITY_LABELS[k],
}));

const TDEEPanel: React.FC<{
  inputs: SharedInputs;
  setInputs: React.Dispatch<React.SetStateAction<SharedInputs>>;
  onTDEECalculated: (tdee: number) => void;
}> = ({ inputs, setInputs, onTDEECalculated }) => {
  const [result, setResult] = useState<TDEEResult | null>(null);
  const [error, setError] = useState('');

  const handleCalculate = () => {
    const err = validateFull(inputs.weight, inputs.height, inputs.age);
    setError(err);
    if (err) return;
    const res = calculateTDEE(
      parseFloat(inputs.weight),
      parseFloat(inputs.height),
      parseFloat(inputs.age),
      inputs.gender,
      inputs.activity,
    );
    setResult(res);
    onTDEECalculated(res.tdee);
  };

  return (
    <div className="fitness-card">
      <h2 className="fitness-card-title">
        <Flame size={18} /> Maintenance Calories (TDEE)
      </h2>

      <div className="fitness-form-grid">
        <InputField
          label="Weight" id="tdee-weight" unit="kg"
          value={inputs.weight} onChange={(v) => setInputs((p) => ({ ...p, weight: v }))}
          placeholder="70" min={20} max={300}
        />
        <InputField
          label="Height" id="tdee-height" unit="cm"
          value={inputs.height} onChange={(v) => setInputs((p) => ({ ...p, height: v }))}
          placeholder="175" min={100} max={250}
        />
        <InputField
          label="Age" id="tdee-age" unit="yrs"
          value={inputs.age} onChange={(v) => setInputs((p) => ({ ...p, age: v }))}
          placeholder="25" min={10} max={120}
        />
        <GenderToggle value={inputs.gender} onChange={(g) => setInputs((p) => ({ ...p, gender: g }))} />
      </div>

      <div style={{ marginBottom: 24 }}>
        <SelectField
          label="Activity Level" id="tdee-activity"
          value={inputs.activity}
          onChange={(v) => setInputs((p) => ({ ...p, activity: v as ActivityLevel }))}
          options={ACTIVITY_OPTIONS}
        />
      </div>

      {error && <ErrorBanner message={error} />}

      <button className="fitness-calc-btn" onClick={handleCalculate} aria-label="Calculate TDEE">
        <Calculator size={16} /> Calculate TDEE
      </button>

      {result && (
        <div className="fitness-results">
          <div className="fitness-results-divider" />
          <div className="tdee-result-grid">
            <div className="tdee-stat-card">
              <span className="tdee-stat-value" style={{ color: 'var(--neon-purple)' }}>
                {result.bmr.toLocaleString()}
              </span>
              <span className="tdee-stat-label">BMR</span>
              <span className="tdee-stat-sub">Basal Metabolic Rate (at rest)</span>
            </div>
            <div className="tdee-stat-card highlight">
              <span className="tdee-stat-value">{result.tdee.toLocaleString()}</span>
              <span className="tdee-stat-label">TDEE</span>
              <span className="tdee-stat-sub">Total Daily Energy Expenditure</span>
            </div>
          </div>
          <InfoNote>
            Calculated using the Mifflin-St Jeor equation with activity factor:{' '}
            <strong>{result.activityLabel}</strong>. Values are estimates — individual
            metabolism varies.
          </InfoNote>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// CALORIE RECOMMENDATIONS PANEL  (shared by Deficit + Surplus tabs)
// ─────────────────────────────────────────────────────────────────

const CalorieRecsPanel: React.FC<{
  mode: 'deficit' | 'surplus';
  inputs: SharedInputs;
  setInputs: React.Dispatch<React.SetStateAction<SharedInputs>>;
  cachedTDEE: number | null;
  onTDEECalculated: (tdee: number) => void;
}> = ({ mode, inputs, setInputs, cachedTDEE, onTDEECalculated }) => {
  const [recs, setRecs] = useState<CalorieRecommendations | null>(null);
  const [error, setError] = useState('');

  const isDeficit = mode === 'deficit';
  const Icon = isDeficit ? TrendingDown : TrendingUp;
  const title = isDeficit ? 'Calorie Deficit (Cutting)' : 'Calorie Surplus (Bulking)';

  const compute = (tdee: number) => {
    onTDEECalculated(tdee);
    setRecs(getCalorieRecommendations(tdee));
  };

  const handleCalculate = () => {
    const err = validateFull(inputs.weight, inputs.height, inputs.age);
    setError(err);
    if (err) return;
    const res = calculateTDEE(
      parseFloat(inputs.weight),
      parseFloat(inputs.height),
      parseFloat(inputs.age),
      inputs.gender,
      inputs.activity,
    );
    compute(res.tdee);
  };

  return (
    <div className="fitness-card">
      <h2 className="fitness-card-title">
        <Icon size={18} /> {title}
      </h2>

      <div className="fitness-form-grid">
        <InputField
          label="Weight" id={`${mode}-weight`} unit="kg"
          value={inputs.weight} onChange={(v) => setInputs((p) => ({ ...p, weight: v }))}
          placeholder="70" min={20} max={300}
        />
        <InputField
          label="Height" id={`${mode}-height`} unit="cm"
          value={inputs.height} onChange={(v) => setInputs((p) => ({ ...p, height: v }))}
          placeholder="175" min={100} max={250}
        />
        <InputField
          label="Age" id={`${mode}-age`} unit="yrs"
          value={inputs.age} onChange={(v) => setInputs((p) => ({ ...p, age: v }))}
          placeholder="25" min={10} max={120}
        />
        <GenderToggle value={inputs.gender} onChange={(g) => setInputs((p) => ({ ...p, gender: g }))} />
      </div>

      <div style={{ marginBottom: 24 }}>
        <SelectField
          label="Activity Level" id={`${mode}-activity`}
          value={inputs.activity}
          onChange={(v) => setInputs((p) => ({ ...p, activity: v as ActivityLevel }))}
          options={ACTIVITY_OPTIONS}
        />
      </div>

      {/* Quick-fill from TDEE tab if already computed */}
      {cachedTDEE && !recs && (
        <button
          type="button"
          className="fitness-calc-btn"
          style={{
            marginBottom: 12,
            background: 'rgba(0,240,255,0.08)',
            color: 'var(--neon-cyan)',
            boxShadow: 'none',
            border: '1.5px solid rgba(0,240,255,0.3)',
          }}
          onClick={() => compute(cachedTDEE)}
          aria-label="Use previously calculated TDEE"
        >
          <Activity size={15} />
          Use TDEE from previous tab ({cachedTDEE.toLocaleString()} kcal)
        </button>
      )}

      {error && <ErrorBanner message={error} />}

      <button
        className="fitness-calc-btn"
        onClick={handleCalculate}
        aria-label={`Calculate ${title}`}
      >
        <Calculator size={16} /> Calculate {isDeficit ? 'Deficit' : 'Surplus'}
      </button>

      {recs && (
        <div className="fitness-results">
          <div className="fitness-results-divider" />

          <div className="calorie-maintenance-row">
            <span className="calorie-maintenance-label"><Flame size={13} /> Maintenance (TDEE)</span>
            <span className="calorie-maintenance-value">{recs.tdee.toLocaleString()} kcal</span>
          </div>

          {isDeficit ? (
            <>
              <div className="calorie-section-label">
                <TrendingDown size={13} /> Cutting Targets
              </div>
              <div className="calorie-cards-row">
                <div className="calorie-rec-card deficit-mild">
                  <span className="calorie-rec-tag" style={{ color: 'var(--neon-cyan)' }}>Mild Cut</span>
                  <span className="calorie-rec-value" style={{ color: 'var(--neon-cyan)' }}>{recs.deficitMild.toLocaleString()}</span>
                  <span className="calorie-rec-unit">kcal / day</span>
                  <span className="calorie-rec-delta" style={{ color: 'var(--neon-cyan)' }}>−300 kcal from maintenance</span>
                </div>
                <div className="calorie-rec-card deficit-aggressive">
                  <span className="calorie-rec-tag" style={{ color: 'var(--neon-green)' }}>Aggressive Cut</span>
                  <span className="calorie-rec-value" style={{ color: 'var(--neon-green)' }}>{recs.deficitAggressive.toLocaleString()}</span>
                  <span className="calorie-rec-unit">kcal / day</span>
                  <span className="calorie-rec-delta" style={{ color: 'var(--neon-green)' }}>−500 kcal from maintenance</span>
                </div>
              </div>
              <InfoNote>
                A 300–500 kcal daily deficit creates sustainable fat loss of ~0.3–0.5 kg/week.
                Avoid going below 1 200 kcal (women) or 1 500 kcal (men) without medical supervision.
              </InfoNote>
            </>
          ) : (
            <>
              <div className="calorie-section-label">
                <TrendingUp size={13} /> Bulking Targets
              </div>
              <div className="calorie-cards-row">
                <div className="calorie-rec-card surplus-mild">
                  <span className="calorie-rec-tag" style={{ color: 'var(--neon-purple)' }}>Lean Bulk</span>
                  <span className="calorie-rec-value" style={{ color: 'var(--neon-purple)' }}>{recs.surplusMild.toLocaleString()}</span>
                  <span className="calorie-rec-unit">kcal / day</span>
                  <span className="calorie-rec-delta" style={{ color: 'var(--neon-purple)' }}>+300 kcal above maintenance</span>
                </div>
                <div className="calorie-rec-card surplus-aggressive">
                  <span className="calorie-rec-tag" style={{ color: 'var(--neon-purple-dim)' }}>Standard Bulk</span>
                  <span className="calorie-rec-value" style={{ color: 'var(--neon-purple-dim)' }}>{recs.surplusAggressive.toLocaleString()}</span>
                  <span className="calorie-rec-unit">kcal / day</span>
                  <span className="calorie-rec-delta" style={{ color: 'var(--neon-purple-dim)' }}>+500 kcal above maintenance</span>
                </div>
              </div>
              <InfoNote>
                A 300–500 kcal daily surplus supports lean muscle gain of ~0.25–0.5 kg/week.
                Pair with progressive resistance training for best results.
              </InfoNote>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'bmi',     label: 'BMI',                  icon: <Scale size={14} /> },
  { id: 'tdee',    label: 'Maintenance Calories',  icon: <Flame size={14} /> },
  { id: 'deficit', label: 'Deficit',               icon: <TrendingDown size={14} /> },
  { id: 'surplus', label: 'Surplus',               icon: <TrendingUp size={14} /> },
];

export const FitnessCalculator: React.FC<FitnessCalculatorProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<Tab>('bmi');

  // Shared inputs persist across tab switches so users don't re-enter data
  const [inputs, setInputs] = useState<SharedInputs>({
    weight: '',
    height: '',
    age: '',
    gender: 'male',
    activity: 'moderate',
  });

  // Cache TDEE so Deficit/Surplus tabs can reuse it without recalculating
  const [cachedTDEE, setCachedTDEE] = useState<number | null>(null);

  return (
    <div className="fitness-page" role="main" aria-label="Fitness Calculator">
      {/* Decorative ambient orbs */}
      <div className="fitness-orb fitness-orb--cyan" aria-hidden="true" />
      <div className="fitness-orb fitness-orb--purple" aria-hidden="true" />

      <div className="fitness-inner">
        {/* ── Back button ── */}
        <button
          className="fitness-back-btn"
          onClick={onBack}
          aria-label="Back to home"
          type="button"
        >
          <ArrowLeft size={15} /> Back
        </button>

        {/* ── Page header ── */}
        <header className="fitness-header">
          <div className="fitness-eyebrow" aria-hidden="true">
            <span className="fitness-eyebrow__dot" />
            Fitness Tools
          </div>
          <h1 className="fitness-title">Fitness Calculator</h1>
          <p className="fitness-subtitle">
            BMI · Maintenance Calories · Deficit &amp; Surplus — all calculated
            locally, no data sent anywhere.
          </p>
        </header>

        {/* ── Tab bar ── */}
        <nav className="fitness-tabs" role="tablist" aria-label="Calculator tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              className={`fitness-tab-btn${activeTab === tab.id ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* ── Tab panels ── */}
        <div id={`panel-${activeTab}`} role="tabpanel">
          {activeTab === 'bmi' && (
            <BMIPanel inputs={inputs} setInputs={setInputs} />
          )}
          {activeTab === 'tdee' && (
            <TDEEPanel
              inputs={inputs}
              setInputs={setInputs}
              onTDEECalculated={setCachedTDEE}
            />
          )}
          {activeTab === 'deficit' && (
            <CalorieRecsPanel
              mode="deficit"
              inputs={inputs}
              setInputs={setInputs}
              cachedTDEE={cachedTDEE}
              onTDEECalculated={setCachedTDEE}
            />
          )}
          {activeTab === 'surplus' && (
            <CalorieRecsPanel
              mode="surplus"
              inputs={inputs}
              setInputs={setInputs}
              cachedTDEE={cachedTDEE}
              onTDEECalculated={setCachedTDEE}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default FitnessCalculator;
