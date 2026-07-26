import React from "react";

export interface LeaderboardEntry {
  userId: string;
  rank: number;
  name: string;
  reps: number;
}

export interface GroupLeaderboardProps {
  entries?: LeaderboardEntry[];
}

const DEFAULT_ENTRIES: LeaderboardEntry[] = [
  { userId: "user-1", rank: 1, name: "Alice", reps: 154 },
  { userId: "user-2", rank: 2, name: "Bob", reps: 132 },
  { userId: "user-3", rank: 3, name: "Charlie", reps: 98 },
];

export const GroupLeaderboard: React.FC<GroupLeaderboardProps> = ({ entries = DEFAULT_ENTRIES }) => {
  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-3xl shadow-md mt-6">
      <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Group Leaderboard</h3>
      <ul className="space-y-3">
        {entries.map((u) => (
          <li key={u.userId} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="font-semibold text-gray-700 dark:text-gray-300">#{u.rank} {u.name}</span>
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">{u.reps} reps</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
