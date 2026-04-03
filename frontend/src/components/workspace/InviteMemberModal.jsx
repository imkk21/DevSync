import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { HiMail, HiUserAdd } from 'react-icons/hi';

export default function InviteMemberModal({ isOpen, onClose, onInvite }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Invalid email format');
      return;
    }

    setLoading(true);
    setError('');
    const result = await onInvite(email.trim(), role);
    setLoading(false);

    if (result?.error) {
      setError(result.error.message || 'Failed to invite user');
    } else {
      setEmail('');
      setRole('editor');
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite Collaborator" size="sm">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Email Address"
          type="email"
          icon={HiMail}
          placeholder="teammate@example.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }}
          error={error}
          id="invite-email"
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-surface-300">Role</label>
          <div className="flex gap-2">
            {[
              { value: 'editor', label: 'Editor', desc: 'Can edit files' },
              { value: 'viewer', label: 'Viewer', desc: 'Read-only access' },
            ].map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                className={`flex-1 p-3 rounded-lg text-left transition-all
                  ${role === r.value
                    ? 'bg-brand-500/20 border-brand-500 border'
                    : 'bg-surface-800 border border-surface-700 hover:border-surface-600'
                  }`}
              >
                <p className={`text-sm font-medium ${role === r.value ? 'text-brand-300' : 'text-surface-300'}`}>{r.label}</p>
                <p className="text-xs text-surface-500 mt-0.5">{r.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" loading={loading} className="flex-1">
            <HiUserAdd size={16} />
            Send Invite
          </Button>
        </div>
      </form>
    </Modal>
  );
}
