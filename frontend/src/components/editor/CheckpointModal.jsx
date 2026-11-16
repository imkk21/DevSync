import { useState } from 'react';
import { api } from '../../lib/api';
import { toast } from '../../store/toastStore';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';

const FORM_ID = 'checkpoint-form';

// A named point in every file's history, e.g. "Before refactor"
export default function CheckpointModal({ isOpen, onClose, workspaceId }) {
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { files } = await api(`/api/workspaces/${workspaceId}/checkpoint`, { method: 'POST', body: { label } });
      toast(`Checkpoint saved for ${files} ${files === 1 ? 'file' : 'files'}. Find it in each file's history.`, { tone: 'success' });
      setLabel('');
      onClose();
    } catch (err) {
      toast(err.message, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title="Save a checkpoint"
      description="Marks the current text of every file so you can compare with it or go back to it later."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={FORM_ID} loading={busy}>Save checkpoint</Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit}>
        <Input label="Name" placeholder="e.g. Before refactor" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} autoComplete="off" />
      </form>
    </Modal>
  );
}
