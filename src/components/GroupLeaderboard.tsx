import React from "react";

export const GroupLeaderboard: React.FC = () => {
  const users = [
    { rank: 1, name: "Alice", reps: 154 },
    { rank: 2, name: "Bob", reps: 132 },
    { rank: 3, name: "Charlie", reps: 98 },
  ];

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl shadow-md mt-6">
      <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Group Leaderboard</h3>
      <ul className="space-y-3">
        {users.map(u => (
          <li key={u.rank} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="font-semibold text-gray-700 dark:text-gray-300">#{u.rank} {u.name}</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">{u.reps} reps</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
