import React from "react";

export const ProgressChart: React.FC = () => {
  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl shadow-md">
      <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Progressive Overload Analytics</h3>
      <div className="h-48 w-full flex items-end justify-between gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        <div className="w-full bg-indigo-500 rounded-t-lg h-12" title="Week 1" />
        <div className="w-full bg-indigo-500 rounded-t-lg h-24" title="Week 2" />
        <div className="w-full bg-indigo-500 rounded-t-lg h-36" title="Week 3" />
        <div className="w-full bg-indigo-600 rounded-t-lg h-44" title="Week 4" />
      </div>
      <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Total repetitions completed over the last 4 weeks.</p>
    </div>
  );
};
