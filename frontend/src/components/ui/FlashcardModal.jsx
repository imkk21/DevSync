import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from '../../store/toastStore';
import Modal from './Modal';
import Button from './Button';

// New flashcard. request: { front?, back?, workspaceId?, source } (prefilled from a failed test or selected code)
export default function FlashcardModal({ request, onClose, userId }) {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!request) return;
    setFront(request.front || '');
    setBack(request.back || '');
  }, [request]);

  const save = async (e) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return toast('Fill in both sides.');
    setBusy(true);
    const { error } = await supabase.from('flashcards').insert({
      user_id: userId, workspace_id: request.workspaceId || null, front: front.trim(), back: back.trim(), source: request.source || 'manual',
    });
    setBusy(false);
    if (error) return toast(error.message, { tone: 'error' });
    toast('Flashcard saved. Review it from your dashboard.', { tone: 'success' });
    onClose();
  };

  return (
    <Modal
      isOpen={!!request}
      onClose={onClose}
      title="New flashcard"
      description="It comes back for review just before you'd forget it."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" form="card-form" loading={busy}>Save card</Button></>}
    >
      <form id="card-form" onSubmit={save} className="space-y-4">
        <label className="block">
          <span className="text-label-md text-ink">Question</span>
          <textarea autoFocus value={front} onChange={(e) => setFront(e.target.value)} maxLength={4000} rows={3} className="input input-multiline mt-1.5" placeholder="e.g. What does this function return for an empty list?" />
        </label>
        <label className="block">
          <span className="text-label-md text-ink">Answer</span>
          <textarea value={back} onChange={(e) => setBack(e.target.value)} maxLength={8000} rows={5} className="input input-multiline mt-1.5 font-mono sm:text-code-sm" />
        </label>
      </form>
    </Modal>
  );
}
