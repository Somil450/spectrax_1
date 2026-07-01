import React, { useState, useEffect } from "react";
import { Activity, Scale, Info } from "lucide-react";
import { calculateBMI, calculateTDEE } from "../utils/fitnessCalculations";
import type { ActivityLevel, Gender } from "../utils/fitnessCalculations";

export const BodyMetricsWidget: React.FC = () => {
  const [metrics, setMetrics] = useState<{
    weight: number;
    height: number;
    age: number;
    gender: Gender;
    activity: ActivityLevel;
  } | null>(null);

  useEffect(() => {
    // Load from localStorage
    const w = parseFloat(localStorage.getItem("spectrax_user_weight_kg") || "0");
    const h = parseFloat(localStorage.getItem("spectrax_user_height_cm") || "0");
    const a = parseFloat(localStorage.getItem("spectrax_user_age") || "0");
    const g = (localStorage.getItem("spectrax_user_gender") as Gender) || "male";
    const act = (localStorage.getItem("spectrax_user_activity") as ActivityLevel) || "moderate";

    if (w > 0 && h > 0) {
      setMetrics({ weight: w, height: h, age: a || 25, gender: g, activity: act });
    }
  }, []);

  if (!metrics) {
    return (
      <div className="fitness-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <Scale size={32} style={{ color: 'var(--neon-cyan)', marginBottom: '16px' }} />
        <h3 style={{ color: 'var(--text-bright)', marginBottom: '8px' }}>Body Metrics Not Set</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '16px' }}>
          Enter your body metrics in the Fitness Calculator to see your dashboard analytics.
        </p>
      </div>
    );
  }

  const bmiResult = calculateBMI(metrics.weight, metrics.height);
  const tdeeResult = calculateTDEE(metrics.weight, metrics.height, metrics.age, metrics.gender, metrics.activity);
  
  // Choose color based on BMI category
  let bmiColor = "var(--neon-green)";
  if (bmiResult.category === "Underweight") bmiColor = "var(--neon-cyan)";
  if (bmiResult.category === "Overweight") bmiColor = "var(--neon-yellow)";
  if (bmiResult.category === "Obese") bmiColor = "var(--neon-red)";

  return (
    <div className="fitness-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h2 className="fitness-card-title">
        <Activity size={18} /> Body Metrics Overview
      </h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px', flex: 1 }}>
        {/* BMI Section */}
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Current BMI</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: bmiColor }}>{bmiResult.bmi}</span>
            <span style={{ fontSize: '0.9rem', color: bmiColor, padding: '2px 8px', background: `${bmiColor}20`, borderRadius: '4px' }}>{bmiResult.category}</span>
          </div>
          <div className="bmi-gauge-wrapper" style={{ marginTop: '16px' }}>
            <div className="bmi-gauge-track">
              <div className="bmi-gauge-marker" style={{ left: `${bmiResult.gaugePercent}%` }} />
            </div>
            <div className="bmi-gauge-labels">
              <span>10</span><span>18.5</span><span>25</span><span>30</span><span>45+</span>
            </div>
          </div>
        </div>

        {/* TDEE Section */}
        <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Maintenance Calories</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--neon-magenta)' }}>{tdeeResult.tdee}</span>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>kcal / day</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '12px', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>Based on your weight of <b>{metrics.weight}kg</b> and <b>{metrics.activity.replace('_', ' ')}</b> activity level.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
