import { useState, useEffect } from 'react';

const COLORS = [
  'from-blue-400 to-blue-600',
  'from-emerald-400 to-emerald-600',
  'from-purple-400 to-purple-600',
  'from-orange-400 to-orange-600',
  'from-pink-400 to-pink-600',
  'from-cyan-400 to-cyan-600',
  'from-yellow-400 to-yellow-600',
  'from-red-400 to-red-600',
];

export default function PresenceBar({ users = [] }) {
  const getColor = (index) => COLORS[index % COLORS.length];

  if (users.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-800">
        <div className="w-2 h-2 rounded-full bg-surface-600" />
        <span className="text-xs text-surface-600">No collaborators online</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-800 overflow-x-auto">
      <span className="text-xs text-surface-500 mr-1">Online:</span>
      <div className="flex -space-x-2">
        {users.slice(0, 5).map((user, i) => (
          <div
            key={user.id || i}
            className={`w-7 h-7 rounded-full bg-gradient-to-br ${getColor(i)} flex items-center justify-center
              text-xs font-bold text-white border-2 border-surface-950 relative group cursor-default`}
            title={user.display_name || user.email}
          >
            {(user.display_name || user.email)?.[0]?.toUpperCase()}
            <div className="absolute w-2.5 h-2.5 bg-emerald-500 rounded-full -bottom-0.5 -right-0.5 border-2 border-surface-950" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-surface-800 rounded text-[10px]
              text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {user.display_name || user.email}
            </div>
          </div>
        ))}
        {users.length > 5 && (
          <div className="w-7 h-7 rounded-full bg-surface-700 flex items-center justify-center text-xs font-medium text-surface-300
            border-2 border-surface-950">
            +{users.length - 5}
          </div>
        )}
      </div>
    </div>
  );
}
