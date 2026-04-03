import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { HiCode, HiDocumentText } from 'react-icons/hi';

const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript', icon: '🟨' },
  { value: 'typescript', label: 'TypeScript', icon: '🔷' },
  { value: 'python', label: 'Python', icon: '🐍' },
  { value: 'java', label: 'Java', icon: '☕' },
  { value: 'c', label: 'C', icon: '⚙️' },
  { value: 'cpp', label: 'C++', icon: '⚡' },
  { value: 'go', label: 'Go', icon: '🐹' },
  { value: 'rust', label: 'Rust', icon: '🦀' },
  { value: 'ruby', label: 'Ruby', icon: '💎' },
  { value: 'php', label: 'PHP', icon: '🐘' },
  { value: 'csharp', label: 'C#', icon: '🎯' },
];

export default function CreateWorkspaceModal({ isOpen, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Workspace name is required';
    else if (name.trim().length < 3) errs.name = 'Must be at least 3 characters';
    else if (name.trim().length > 50) errs.name = 'Must be less than 50 characters';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setSubmitError('');
    const result = await onCreate(name.trim(), description.trim(), language);
    setLoading(false);
    if (result?.error) {
      setSubmitError(result.error.message || 'Failed to create workspace');
      return;
    }
    setName('');
    setDescription('');
    setLanguage('javascript');
    setSubmitError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Workspace">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Workspace Name"
          icon={HiCode}
          placeholder="My Awesome Project"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          id="workspace-name"
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-surface-300">Description (optional)</label>
          <textarea
            className="input-field resize-none h-20"
            placeholder="What's this workspace for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            id="workspace-description"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-surface-300">Default Language</label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.value}
                type="button"
                onClick={() => setLanguage(lang.value)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all
                  ${language === lang.value
                    ? 'bg-brand-500/20 border-brand-500 text-brand-300 border'
                    : 'bg-surface-800 border border-surface-700 text-surface-400 hover:border-surface-600'
                  }`}
              >
                <span>{lang.icon}</span>
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {submitError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {submitError}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" loading={loading} className="flex-1">
            Create Workspace
          </Button>
        </div>
      </form>
    </Modal>
  );
}
