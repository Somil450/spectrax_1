import type { ReportTemplate, ReportData, ExportFormat } from "../../types/report";

function safe(value: unknown, fallback = "N/A"): string {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number" && !Number.isFinite(value)) return fallback;
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function renderHtml(data: ReportData): string {
  const s = data.session;
  const b = data.biomechanics;
  const r = data.risk;
  const v = data.vbt;
  const d = data.depthAnalysis;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Technical Report — ${safe(s?.exerciseName)}</title>
<style>
  body { font-family: 'Courier New', monospace; max-width: 960px; margin: 2rem auto; padding: 0 1rem; color: #1e293b; background: #f1f5f9; font-size: 0.9rem; }
  h1 { font-size: 1.3rem; border-bottom: 2px solid #475569; padding-bottom: 0.4rem; }
  h2 { font-size: 1.05rem; margin-top: 1.5rem; color: #334155; }
  h3 { font-size: 0.95rem; margin-top: 1rem; color: #475569; }
  table { width: 100%; border-collapse: collapse; margin: 0.5rem 0; font-size: 0.85rem; }
  th, td { text-align: left; padding: 0.35rem 0.5rem; border-bottom: 1px solid #e2e8f0; }
  th { background: #e2e8f0; font-weight: 600; }
  .section { background: #fff; border-radius: 0.375rem; padding: 1rem; margin: 0.75rem 0; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
  .warn { color: #b45309; }
  .crit { color: #dc2626; }
  footer { margin-top: 2rem; font-size: 0.7rem; color: #94a3b8; border-top: 1px solid #cbd5e1; padding-top: 0.75rem; }
</style></head>
<body>
  <h1>Technical Deep-Dive Report</h1>
  <p style="color:#64748b;">${safe(s?.exerciseName)} — ${fmt(s?.duration ?? 0)} — ${s?.timestamp ? new Date(s.timestamp).toISOString() : "N/A"}</p>

  <div class="section">
    <h2>1. Session Overview</h2>
    <table>
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Total Reps Rated</td><td>${safe(s?.totalReps)}</td></tr>
      <tr><td>Correct Reps</td><td>${safe(s?.correctReps)}</td></tr>
      <tr><td>Accuracy</td><td>${safe(s?.accuracy !== undefined ? Math.round(s.accuracy) + "%" : "N/A")}</td></tr>
      <tr><td>Total Score</td><td>${safe(s?.totalScore)}</td></tr>
      <tr><td>Frames Analyzed</td><td>${safe(s?.totalFrames)}</td></tr>
      <tr><td>Best Streak</td><td>${safe(s?.bestStreak)}</td></tr>
    </table>
  </div>

  ${b ? `<div class="section">
    <h2>2. Biomechanics & Rep Quality</h2>
    <table>
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Average Score</td><td>${safe(Math.round(b.averageScore))}%</td></tr>
      <tr><td>Best Rep</td><td>${safe(Math.round(b.maxScore))}%</td></tr>
      <tr><td>Worst Rep</td><td>${safe(Math.round(b.minScore))}%</td></tr>
      ${b.tempoRatio ? `<tr><td>Tempo (Ecc:Con:Iso)</td><td>${safe(b.tempoRatio)}</td></tr>` : ""}
      ${b.holdTime !== undefined ? `<tr><td>Total Hold Time</td><td>${safe(Math.round(b.holdTime))}s</td></tr>` : ""}
    </table>

    ${b.repScores.length > 0 ? `<h3>Per-Rep Scores</h3>
    <table><tr><th>Rep</th><th>Score</th><th>Deviation</th></tr>
    ${b.repScores.map((score, i) => `<tr><td>${i + 1}</td><td>${safe(Math.round(score))}%</td><td>${safe(b.repDeviations[i] !== undefined ? b.repDeviations[i].toFixed(3) : "N/A")}</td></tr>`).join("")}
    </table>` : ""}
  </div>` : ""}

  ${v ? `<div class="section">
    <h2>3. Velocity-Based Training (VBT) Metrics</h2>
    <table>
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Peak Concentric Velocity</td><td>${safe(v.peakConcentricVelocity.toFixed(3))} m/s</td></tr>
      <tr><td>Average Concentric Velocity</td><td>${safe(v.averageConcentricVelocity.toFixed(3))} m/s</td></tr>
      <tr><td>Baseline Velocity</td><td>${safe(v.baselineVelocity.toFixed(3))} m/s</td></tr>
      <tr><td>Current Velocity</td><td>${safe(v.currentVelocity.toFixed(3))} m/s</td></tr>
      <tr><td>Fatigue Dropoff</td><td class="${v.fatigueDropoff > 0.2 ? "crit" : v.fatigueDropoff > 0.1 ? "warn" : ""}">${safe((v.fatigueDropoff * 100).toFixed(1))}%</td></tr>
    </table>
  </div>` : ""}

  ${r ? `<div class="section">
    <h2>4. Injury Risk Assessment</h2>
    <table>
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Risk Index</td><td class="${r.riskIndex > 60 ? "crit" : r.riskIndex > 30 ? "warn" : ""}">${safe(Math.round(r.riskIndex))}/100</td></tr>
      <tr><td>Fatigue Index</td><td>${safe(Math.round(r.fatigueIndex))}/100</td></tr>
      <tr><td>Asymmetry Score</td><td>${safe(Math.round(r.asymmetryScore))}/100</td></tr>
      <tr><td>Recommended Stop Rep</td><td>${safe(r.recommendedStopRep !== null ? r.recommendedStopRep : "Not reached")}</td></tr>
    </table>
  </div>` : ""}

  ${d ? `<div class="section">
    <h2>5. Depth Analysis</h2>
    ${d.squatDepthStats ? `<table>
      <tr><th>Depth Category</th><th>Ratio</th></tr>
      <tr><td>Full Depth</td><td>${safe((d.squatDepthStats.fullDepthRatio * 100).toFixed(1))}%</td></tr>
      <tr><td>Partial</td><td>${safe((d.squatDepthStats.partialRatio * 100).toFixed(1))}%</td></tr>
      <tr><td>Above Parallel</td><td>${safe((d.squatDepthStats.aboveParallelRatio * 100).toFixed(1))}%</td></tr>
    </table>` : ""}
    ${d.pushupDepthStats ? `<table>
      <tr><th>Depth Category</th><th>Ratio</th></tr>
      <tr><td>Full Depth</td><td>${safe((d.pushupDepthStats.fullDepthRatio * 100).toFixed(1))}%</td></tr>
      <tr><td>Partial</td><td>${safe((d.pushupDepthStats.partialRatio * 100).toFixed(1))}%</td></tr>
    </table>` : ""}
  </div>` : ""}

  ${s?.mistakes && Object.keys(s.mistakes).length > 0 ? `<div class="section">
    <h2>6. Form Error Breakdown</h2>
    <table><tr><th>Issue</th><th>Count</th></tr>
    ${Object.entries(s.mistakes).sort((a, b) => b[1] - a[1]).map(([msg, count]) => `<tr><td>${safe(msg)}</td><td>${count}</td></tr>`).join("")}
    </table>
  </div>` : ""}

  <footer>SpectraX Technical Report · ${new Date().toISOString()} · Version 1.0</footer>
</body></html>`;
}

function renderJson(data: ReportData): string {
  const output = {
    reportType: "technical",
    generatedAt: new Date().toISOString(),
    version: "1.0",
    session: data.session,
    biomechanics: data.biomechanics,
    vbt: data.vbt,
    risk: data.risk,
    depthAnalysis: data.depthAnalysis,
  };
  return JSON.stringify(output, null, 2);
}

function renderMarkdown(data: ReportData): string {
  const s = data.session;
  const b = data.biomechanics;
  const r = data.risk;
  const v = data.vbt;

  const lines: string[] = [
    `# Technical Deep-Dive Report`,
    ``,
    `**Exercise:** ${safe(s?.exerciseName)}  `,
    `**Duration:** ${fmt(s?.duration ?? 0)}  `,
    `**Timestamp:** ${s?.timestamp ? new Date(s.timestamp).toISOString() : "N/A"}  `,
    ``,
    `## 1. Session Overview`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total Reps Rated | ${safe(s?.totalReps)} |`,
    `| Correct Reps | ${safe(s?.correctReps)} |`,
    `| Accuracy | ${safe(s?.accuracy !== undefined ? Math.round(s.accuracy) + "%" : "N/A")} |`,
    `| Total Score | ${safe(s?.totalScore)} |`,
    `| Frames Analyzed | ${safe(s?.totalFrames)} |`,
    `| Best Streak | ${safe(s?.bestStreak)} |`,
    ``,
  ];

  if (b) {
    lines.push(`## 2. Biomechanics & Rep Quality`, ``);
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Average Score | ${Math.round(b.averageScore)}% |`);
    lines.push(`| Best Rep | ${Math.round(b.maxScore)}% |`);
    lines.push(`| Worst Rep | ${Math.round(b.minScore)}% |`);
    if (b.tempoRatio) lines.push(`| Tempo (Ecc:Con:Iso) | ${safe(b.tempoRatio)} |`);
    lines.push(``);
    if (b.repScores.length > 0) {
      lines.push(`### Per-Rep Scores`, ``);
      lines.push(`| Rep | Score | Deviation |`);
      lines.push(`|-----|-------|-----------|`);
      b.repScores.forEach((score, i) => {
        lines.push(`| ${i + 1} | ${Math.round(score)}% | ${b.repDeviations[i]?.toFixed(3) ?? "N/A"} |`);
      });
      lines.push(``);
    }
  }

  if (v) {
    lines.push(`## 3. VBT Metrics`, ``);
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Peak Concentric Velocity | ${v.peakConcentricVelocity.toFixed(3)} m/s |`);
    lines.push(`| Average Concentric Velocity | ${v.averageConcentricVelocity.toFixed(3)} m/s |`);
    lines.push(`| Baseline Velocity | ${v.baselineVelocity.toFixed(3)} m/s |`);
    lines.push(`| Fatigue Dropoff | ${(v.fatigueDropoff * 100).toFixed(1)}% |`);
    lines.push(``);
  }

  if (r) {
    lines.push(`## 4. Injury Risk Assessment`, ``);
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Risk Index | ${Math.round(r.riskIndex)}/100 |`);
    lines.push(`| Fatigue Index | ${Math.round(r.fatigueIndex)}/100 |`);
    lines.push(`| Asymmetry Score | ${Math.round(r.asymmetryScore)}/100 |`);
    lines.push(`| Recommended Stop Rep | ${r.recommendedStopRep !== null ? r.recommendedStopRep : "Not reached"} |`);
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(`*SpectraX Technical Report · ${new Date().toISOString()} · Version 1.0*`);

  return lines.join("\n");
}

export const technicalTemplate: ReportTemplate = {
  type: "technical",
  label: "Technical Deep-Dive",
  description: "Full biomechanical analysis with per-rep scores, VBT metrics, injury risk, and depth classification data.",
  supportedFormats: ["html", "json", "markdown"],

  render(data: ReportData, format: ExportFormat): string {
    if (format === "json") return renderJson(data);
    if (format === "markdown") return renderMarkdown(data);
    return renderHtml(data);
  },
};
