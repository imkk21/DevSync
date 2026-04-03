import { useState } from 'react';
import { HiPlay, HiStop, HiTerminal, HiChevronUp, HiChevronDown, HiClock, HiChip } from 'react-icons/hi';
import useEditorStore from '../../store/editorStore';
import axios from 'axios';

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript', judge0Id: 63 },
  { value: 'typescript', label: 'TypeScript', judge0Id: 74 },
  { value: 'python', label: 'Python 3', judge0Id: 71 },
  { value: 'java', label: 'Java', judge0Id: 62 },
  { value: 'c', label: 'C (GCC)', judge0Id: 50 },
  { value: 'cpp', label: 'C++ (GCC)', judge0Id: 54 },
  { value: 'go', label: 'Go', judge0Id: 60 },
  { value: 'rust', label: 'Rust', judge0Id: 73 },
  { value: 'ruby', label: 'Ruby', judge0Id: 72 },
  { value: 'php', label: 'PHP', judge0Id: 68 },
  { value: 'csharp', label: 'C#', judge0Id: 51 },
];

export default function OutputPanel() {
  const { editorContent, language, output, isRunning, stdin, setOutput, setIsRunning, setStdin } = useEditorStore();
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('output');

  const currentLang = LANGUAGES.find((l) => l.value === language) || LANGUAGES[0];

  const handleRun = async () => {
    setIsRunning(true);
    setOutput(null);
    setActiveTab('output');

    try {
      const response = await axios.post('/api/compiler/run', {
        source_code: editorContent,
        language_id: currentLang.judge0Id,
        stdin: stdin,
      });

      setOutput(response.data);
    } catch (error) {
      setOutput({
        stderr: error.response?.data?.message || error.message || 'Execution failed. Make sure the backend server is running.',
        status: { description: 'Error' },
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className={`border-t border-surface-800 bg-surface-950 flex flex-col transition-all duration-300 ${collapsed ? 'h-10' : 'h-64'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-surface-800 bg-surface-900/50">
        <div className="flex items-center gap-2">
          <HiTerminal className="text-surface-500" size={16} />
          <div className="flex gap-1">
            {['output', 'input'].map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setCollapsed(false); }}
                className={`px-2.5 py-1 text-xs rounded font-medium transition-colors capitalize
                  ${activeTab === tab ? 'bg-surface-800 text-white' : 'text-surface-500 hover:text-surface-300'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {output?.time && (
            <span className="flex items-center gap-1 text-xs text-surface-500">
              <HiClock size={12} />
              {output.time}s
            </span>
          )}
          {output?.memory && (
            <span className="flex items-center gap-1 text-xs text-surface-500">
              <HiChip size={12} />
              {(output.memory / 1024).toFixed(1)}MB
            </span>
          )}

          <button
            onClick={handleRun}
            disabled={isRunning || !editorContent}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold transition-all
              ${isRunning
                ? 'bg-red-500/20 text-red-400'
                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
              } disabled:opacity-50`}
          >
            {isRunning ? (
              <><HiStop size={14} /> Running...</>
            ) : (
              <><HiPlay size={14} /> Run</>
            )}
          </button>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded text-surface-500 hover:text-white hover:bg-surface-800 transition-colors"
          >
            {collapsed ? <HiChevronUp size={14} /> : <HiChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="flex-1 overflow-auto p-3">
          {activeTab === 'output' ? (
            <div className="code-font text-xs leading-relaxed">
              {isRunning ? (
                <div className="flex items-center gap-2 text-surface-400">
                  <div className="w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  Executing...
                </div>
              ) : output ? (
                <>
                  {output.compile_output && (
                    <div className="text-yellow-400 mb-2 whitespace-pre-wrap">{atob(output.compile_output)}</div>
                  )}
                  {output.stdout && (
                    <div className="text-emerald-300 whitespace-pre-wrap">{typeof output.stdout === 'string' && output.stdout.startsWith('base64:') ? output.stdout : output.stdout}</div>
                  )}
                  {output.stderr && (
                    <div className="text-red-400 whitespace-pre-wrap">{output.stderr}</div>
                  )}
                  {output.status && (
                    <div className={`mt-2 pt-2 border-t border-surface-800 text-xs
                      ${output.status.id === 3 ? 'text-emerald-500' : 'text-red-400'}`}
                    >
                      Status: {output.status.description}
                    </div>
                  )}
                  {!output.stdout && !output.stderr && !output.compile_output && (
                    <span className="text-surface-500">No output</span>
                  )}
                </>
              ) : (
                <span className="text-surface-600">Click "Run" to execute your code</span>
              )}
            </div>
          ) : (
            <div>
              <label className="text-xs text-surface-500 mb-1 block">Standard Input (stdin)</label>
              <textarea
                className="w-full bg-surface-900 border border-surface-700 rounded-lg p-2 text-xs code-font text-white
                  focus:outline-none focus:ring-1 focus:ring-brand-500/50 focus:border-brand-500 resize-none h-36"
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                placeholder="Enter input values here..."
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
