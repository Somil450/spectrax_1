import React from "react";

interface ChartData {
  label: string;
  heightClass: string;
  reps: number;
}

const CHART_DATA: ChartData[] = [
  { label: "Week 1", heightClass: "h-12", reps: 120 },
  { label: "Week 2", heightClass: "h-24", reps: 240 },
  { label: "Week 3", heightClass: "h-36", reps: 360 },
  { label: "Week 4", heightClass: "h-44", reps: 440 }
];

export const ProgressChart: React.FC = () => {
  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl shadow-md">
      <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Progressive Overload Analytics</h3>
      <div className="h-48 w-full flex items-end justify-between gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        {CHART_DATA.map((item, index) => (
          <div
            key={index}
            className={`w-full bg-indigo-500 hover:bg-indigo-600 rounded-t-lg transition-colors ${item.heightClass}`}
            role="img"
            aria-label={`${item.label}: ${item.reps} repetitions`}
            title={`${item.label}: ${item.reps} reps`}
          />
        ))}
      </div>
      <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Total repetitions completed over the last 4 weeks.</p>
    </div>
  );
};
