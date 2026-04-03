import { HiCode, HiUsers, HiClock, HiDotsVertical, HiTrash, HiExternalLink } from 'react-icons/hi';
import { useNavigate } from 'react-router-dom';

const languageColors = {
  javascript: 'from-yellow-400 to-orange-500',
  typescript: 'from-blue-400 to-blue-600',
  python: 'from-green-400 to-emerald-600',
  java: 'from-red-400 to-red-600',
  c: 'from-gray-400 to-gray-600',
  cpp: 'from-purple-400 to-purple-600',
  go: 'from-cyan-400 to-teal-600',
  rust: 'from-orange-400 to-red-600',
  ruby: 'from-red-400 to-pink-600',
  php: 'from-indigo-400 to-purple-600',
  csharp: 'from-green-400 to-teal-600',
};

export default function WorkspaceCard({ workspace, onDelete }) {
  const navigate = useNavigate();
  const memberCount = workspace.workspace_members?.[0]?.count || 1;
  const lang = workspace.default_language || 'javascript';
  const gradientClass = languageColors[lang] || 'from-brand-400 to-brand-600';

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div className="group card hover:border-brand-500/30 hover:shadow-lg hover:shadow-brand-500/5 transition-all duration-300 cursor-pointer relative overflow-hidden"
      onClick={() => navigate(`/editor/${workspace.id}`)}
    >
      {/* Gradient accent */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradientClass} opacity-60 group-hover:opacity-100 transition-opacity`} />

      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradientClass} flex items-center justify-center shadow-lg`}>
          <HiCode className="text-white text-lg" />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(workspace.id);
          }}
          className="p-1.5 rounded-lg text-surface-600 opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition-all"
          title="Delete workspace"
        >
          <HiTrash size={16} />
        </button>
      </div>

      <h3 className="text-base font-semibold text-white mb-1 group-hover:text-brand-300 transition-colors">
        {workspace.name}
      </h3>
      <p className="text-sm text-surface-400 line-clamp-2 mb-4 min-h-[40px]">
        {workspace.description || 'No description'}
      </p>

      <div className="flex items-center justify-between text-xs text-surface-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <HiUsers size={14} />
            {memberCount}
          </span>
          <span className={`px-2 py-0.5 rounded-full bg-gradient-to-r ${gradientClass} text-white text-[10px] font-bold uppercase`}>
            {lang}
          </span>
        </div>
        <span className="flex items-center gap-1">
          <HiClock size={14} />
          {timeAgo(workspace.updated_at)}
        </span>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-surface-950/60 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
        <div className="flex items-center gap-2 text-brand-400 font-medium">
          <HiExternalLink size={18} />
          Open Workspace
        </div>
      </div>
    </div>
  );
}
