import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { socketService } from '../../services/socketService';
import useEditorStore from '../../store/editorStore';
import { toast } from '../../store/toastStore';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

const FORM_ID = 'suggest-form';

// Propose a change to the selected code; an editor accepts or rejects it.
// request: { fileId, start, end, original, line }
// onSend(row) replaces the database insert (live-stream guests send through the socket)
export default function SuggestModal({ request, onClose, userId, workspaceId, onSend }) {
  const [replacement, setReplacement] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const upsertSuggestion = useEditorStore((s) => s.upsertSuggestion);

  useEffect(() => {
    if (!request) return;
    setReplacement(request.original);
    setNote('');
  }, [request]);

  const submit = async (e) => {
    e.preventDefault();
    if (replacement === request.original) return toast('Change the code first, then send your suggestion.');
    const session = socketService.collab?.get(request.fileId);
    setBusy(true);
    const row = {
      workspace_id: workspaceId,
      file_id: request.fileId,
      user_id: userId,
      line: request.line,
      anchor_start: session?.anchorAt(request.start) ?? null,
      anchor_end: session?.anchorAt(request.end) ?? null,
      original: request.original,
      replacement,
      note: note.trim() || null,
    };
    if (onSend) {
      const res = await onSend(row);
      setBusy(false);
      if (res?.error) return toast(res.error, { tone: 'error' });
      toast('Suggestion sent to the people coding', { tone: 'success' });
      return onClose();
    }
    const { data, error } = await supabase.from('suggestions').insert(row).select().single();
    setBusy(false);
    if (error) return toast(`Couldn't send the suggestion: ${error.message}`, { tone: 'error' });
    upsertSuggestion(data);
    toast('Suggestion sent. An editor can accept it from the Comments panel.', { tone: 'success' });
    onClose();
  };

  const rows = Math.min(16, Math.max(3, (request?.original.split('\n').length || 1) + 1));

  return (
    <Modal
      isOpen={!!request}
      onClose={onClose}
      size="lg"
      title={`Suggest a change${request ? ` to line ${request.line}` : ''}`}
      description="Edit the code below. Nothing changes until an editor accepts it."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={FORM_ID} loading={busy}>Send suggestion</Button>
        </>
      }
    >
      {request && (
        <form id={FORM_ID} onSubmit={submit} className="space-y-4">
          <div>
            <span className="text-label-sm text-ink-muted">Now</span>
            <pre className="mt-1 max-h-40 overflow-auto rounded-md border border-line bg-canvas-subtle px-3 py-2 font-mono text-code-sm text-ink-muted">{request.original || '(empty line)'}</pre>
          </div>
          <label className="block">
            <span className="text-label-sm text-ink-muted">Your version</span>
            <textarea
              autoFocus
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              rows={rows}
              spellCheck={false}
              className="input input-multiline mt-1 font-mono sm:text-code-sm"
            />
          </label>
          <label className="block">
            <span className="text-label-sm text-ink-muted">Why (optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="e.g. handles empty input" className="input mt-1" />
          </label>
        </form>
      )}
    </Modal>
  );
}
