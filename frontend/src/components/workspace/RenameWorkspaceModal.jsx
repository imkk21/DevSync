import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Alert from '../ui/Alert';
import useWorkspaceStore from '../../store/workspaceStore';

const FORM_ID = 'rename-workspace-form';

export default function RenameWorkspaceModal({ workspace, onClose }) {
  const updateWorkspace = useWorkspaceStore((s) => s.updateWorkspace);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!workspace) return;
    setName(workspace.name);
    setDescription(workspace.description || '');
    setError('');
  }, [workspace]);

  const submit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 3 || trimmed.length > 50) return setError('Use 3 to 50 characters for the name.');
    setBusy(true);
    const { error: err } = await updateWorkspace(workspace.id, { name: trimmed, description: description.trim() });
    setBusy(false);
    if (err) return setError(err.message);
    onClose();
  };

  return (
    <Modal
      isOpen={!!workspace}
      onClose={onClose}
      title="Rename workspace"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form={FORM_ID} loading={busy}>Save</Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} noValidate className="space-y-5">
        <Input label="Name" value={name} maxLength={50} onChange={(e) => { setName(e.target.value); setError(''); }} autoComplete="off" />
        <div className="space-y-1.5">
          <label htmlFor="rename-description" className="text-label-md text-ink">
            Description <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <textarea id="rename-description" className="input input-multiline" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {error && <Alert>{error}</Alert>}
      </form>
    </Modal>
  );
}
