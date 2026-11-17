// Single source of truth for languages: labels, file extensions, Judge0 ids
// (runnable languages only) and the colour dot shown across the UI.
// Ids double as Monaco language ids. Colours follow GitHub Linguist.
export const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript', ext: 'js', judge0Id: 63, color: '#F1E05A' },
  { id: 'typescript', label: 'TypeScript', ext: 'ts', judge0Id: 74, color: '#3178C6' },
  { id: 'python', label: 'Python', ext: 'py', judge0Id: 71, color: '#3572A5' },
  { id: 'java', label: 'Java', ext: 'java', judge0Id: 62, color: '#B07219' },
  { id: 'c', label: 'C', ext: 'c', judge0Id: 50, color: '#555555' },
  { id: 'cpp', label: 'C++', ext: 'cpp', judge0Id: 54, color: '#F34B7D' },
  { id: 'go', label: 'Go', ext: 'go', judge0Id: 60, color: '#00ADD8' },
  { id: 'rust', label: 'Rust', ext: 'rs', judge0Id: 73, color: '#DEA584' },
  { id: 'ruby', label: 'Ruby', ext: 'rb', judge0Id: 72, color: '#701516' },
  { id: 'php', label: 'PHP', ext: 'php', judge0Id: 68, color: '#4F5D95' },
  { id: 'csharp', label: 'C#', ext: 'cs', judge0Id: 51, color: '#178600' },
];

// Editable and highlighted, but not runnable
const OTHER = [
  { id: 'html', label: 'HTML', ext: 'html', color: '#E34C26' },
  { id: 'css', label: 'CSS', ext: 'css', color: '#663399' },
  { id: 'json', label: 'JSON', ext: 'json', color: '#292929' },
  { id: 'markdown', label: 'Markdown', ext: 'md', color: '#083FA1' },
  { id: 'mermaid', label: 'Mermaid diagram', ext: 'mmd', color: '#FF3670' },
  { id: 'whiteboard', label: 'Whiteboard', ext: 'board', color: '#6E40C9' },
];

const PLAINTEXT = { id: 'plaintext', label: 'Plain text', ext: 'txt', color: '#D2D9D4' };
const ALL = [...LANGUAGES, ...OTHER, PLAINTEXT];
const ALIASES = { jsx: 'javascript', mjs: 'javascript', cjs: 'javascript', tsx: 'typescript', h: 'c', hpp: 'cpp', cc: 'cpp', htm: 'html', mermaid: 'mermaid' };

export function getLanguage(id) {
  return ALL.find((l) => l.id === id) || PLAINTEXT;
}

export function languageForFile(name = '') {
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  return ALL.find((l) => l.ext === ext)?.id || ALIASES[ext] || 'plaintext';
}
