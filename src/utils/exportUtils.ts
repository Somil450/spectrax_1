// src/utils/exportUtils.ts
// Utility functions for exporting workout summary data as CSV, PNG, and PDF

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WorkoutExportData {
  exerciseName?: string;
  reps: number;
  totalReps: number;
  correctReps: number;
  repScores: number[];
  duration: number;
  accuracy: number;
  calories?: number;
  bestStreak: number;
  mistakes: Record<string, number>;
}

// ─── CSV Export ──────────────────────────────────────────────────────────────

export function exportWorkoutCSV(data: WorkoutExportData): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const exercise = data.exerciseName ?? 'Workout';

  // Summary section
  const summaryRows = [
    ['SpectraX Workout Export'],
    ['Exercise', exercise],
    ['Date', new Date().toLocaleDateString()],
    ['Duration (s)', data.duration],
    ['Correct Reps', data.reps],
    ['Total Reps', data.totalReps],
    ['Accuracy (%)', data.accuracy],
    ['Best Streak', data.bestStreak],
    ['Calories (kcal)', data.calories ?? 'N/A'],
    [],
    // Per-rep scores
    ['Rep #', 'Score (%)'],
    ...data.repScores.map((score, i) => [i + 1, score]),
    [],
    // Mistakes
    ['Mistake', 'Count'],
    ...Object.entries(data.mistakes).map(([k, v]) => [k, v]),
  ];

  const csv = summaryRows
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `spectrax-workout-${timestamp}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── PNG Screenshot Export ───────────────────────────────────────────────────

export async function exportSummaryPNG(elementId: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`[SpectraX] Export target #${elementId} not found`);
    return;
  }

  const canvas = await html2canvas(element, {
    backgroundColor: '#0a0a1a',  // matches SpectraX dark bg
    scale: 2,                    // retina-quality output
    useCORS: true,
    logging: false,
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const link = document.createElement('a');
  link.download = `spectrax-summary-${timestamp}.png`;
  link.href = canvas.toDataURL('image/png', 1.0);
  link.click();
}

// ─── PDF Report Export ───────────────────────────────────────────────────────

export async function exportWorkoutPDF(
  data: WorkoutExportData,
  elementId: string
): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // ── Header ──
  doc.setFillColor(10, 10, 26);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(157, 78, 221);   // neon-purple
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('SpectraX', 14, 16);

  doc.setTextColor(200, 200, 200);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('AI Fitness Tracker — Workout Report', 14, 24);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 31);

  // ── Exercise title ──
  doc.setTextColor(0, 224, 255);    // neon-cyan
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(data.exerciseName ?? 'Workout Session', 14, 52);

  // ── Key metrics grid ──
  const metrics = [
    ['Accuracy', `${data.accuracy}%`],
    ['Correct Reps', `${data.reps}`],
    ['Total Reps', `${data.totalReps}`],
    ['Duration', `${Math.floor(data.duration / 60)}m ${data.duration % 60}s`],
    ['Best Streak', `${data.bestStreak} reps`],
    ['Calories', data.calories ? `${data.calories} kcal` : 'N/A'],
  ];

  doc.setFontSize(10);
  metrics.forEach(([label, value], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 14 + col * 62;
    const y = 62 + row * 20;

    doc.setFillColor(20, 20, 40);
    doc.roundedRect(x, y, 58, 16, 2, 2, 'F');
    doc.setTextColor(150, 150, 180);
    doc.setFont('helvetica', 'normal');
    doc.text(label, x + 4, y + 6);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(value, x + 4, y + 13);
  });

  // ── Per-rep scores ──
  let y = 110;
  doc.setTextColor(157, 78, 221);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Rep Score Breakdown', 14, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  data.repScores.forEach((score, i) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    const barWidth = (score / 100) * 120;
    const color = score >= 80 ? [0, 255, 100] : score >= 60 ? [255, 235, 59] : [255, 80, 80];
    doc.setTextColor(200, 200, 200);
    doc.text(`Rep ${i + 1}`, 14, y + 4);
    doc.setFillColor(30, 30, 50);
    doc.rect(35, y, 120, 5, 'F');
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(35, y, barWidth, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(`${score}%`, 160, y + 4);
    y += 9;
  });

  // ── Mistakes section ──
  if (Object.keys(data.mistakes).length > 0) {
    y += 6;
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setTextColor(255, 80, 80);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Form Mistakes', 14, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    Object.entries(data.mistakes).forEach(([mistake, count]) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setTextColor(200, 200, 200);
      doc.text(`• ${mistake}: ${count}x`, 14, y);
      y += 7;
    });
  }

  // ── Embed screenshot of summary card ──
  const element = document.getElementById(elementId);
  if (element) {
    try {
      const canvas = await html2canvas(element, {
        backgroundColor: '#0a0a1a',
        scale: 1.5,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      if (y + 100 > 280) { doc.addPage(); y = 20; }
      y += 10;
      doc.setTextColor(0, 224, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Summary Screenshot', 14, y);
      y += 6;
      doc.addImage(imgData, 'PNG', 14, y, pageWidth - 28, 80);
    } catch {
      // Screenshot optional — skip if canvas fails (e.g. cross-origin)
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  doc.save(`spectrax-report-${timestamp}.pdf`);
}