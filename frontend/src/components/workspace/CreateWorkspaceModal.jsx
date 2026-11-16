import { useState } from 'react';
import { GoCheck } from 'react-icons/go';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Alert from '../ui/Alert';
import LangDot from '../ui/LangDot';
import { LANGUAGES } from '../../lib/languages';

const FORM_ID = 'create-workspace-form';
const MAX_DESCRIPTION = 200;

export default function CreateWorkspaceModal({ isOpen, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [nameError, setNameError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  const close = () => {
    setName('');
    setDescription('');
    setLanguage('javascript');
    setNameError('');
    setSubmitError('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 3) return setNameError('Use at least 3 characters.');
    if (trimmed.length > 50) return setNameError('Use 50 characters or fewer.');

    setLoading(true);
    setSubmitError('');
    const result = await onCreate(trimmed, description.trim(), language);
    setLoading(false);
    if (result?.error) return setSubmitError(result.error.message || 'Could not create the workspace. Try again.');
    close();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Create a workspace"
      description="A workspace holds your files and the people you code with."
      footer={
        <>
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button type="submit" form={FORM_ID} loading={loading}>Create workspace</Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="space-y-6">
        <Input
          label="Name"
          placeholder="e.g. algorithms-practice"
          value={name}
          onChange={(e) => { setName(e.target.value); setNameError(''); }}
          error={nameError}
          hint="3 to 50 characters."
          maxLength={50}
          autoComplete="off"
        />

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="workspace-description" className="text-label-md text-ink">
              Description <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <span className="text-label-sm tabular-nums text-ink-subtle">{description.length}/{MAX_DESCRIPTION}</span>
          </div>
          <textarea
            id="workspace-description"
            className="input input-multiline"
            placeholder="What are you building?"
            value={description}
            maxLength={MAX_DESCRIPTION}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <fieldset>
          <legend className="text-label-md text-ink">Language</legend>
          <p className="mt-1.5 text-body-sm text-ink-muted">We'll add a starter file you can run straight away.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {LANGUAGES.map((lang) => {
              const selected = language === lang.id;
              return (
                <label
                  key={lang.id}
                  className={`flex h-10 cursor-pointer items-center gap-2.5 rounded-md border px-3 text-label-md text-ink transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand has-[:focus-visible]:ring-offset-1 ${
                    selected ? 'border-brand bg-brand-soft' : 'border-line-strong hover:border-line-emphasis hover:bg-canvas-subtle'
                  }`}
                >
                  <input
                    type="radio"
                    name="language"
                    value={lang.id}
                    checked={selected}
                    onChange={() => setLanguage(lang.id)}
                    className="sr-only"
                  />
                  <LangDot language={lang.id} />
                  {lang.label}
                  {selected && <GoCheck size={16} className="ml-auto text-brand" aria-hidden="true" />}
                </label>
              );
            })}
          </div>
        </fieldset>

        {submitError && <Alert>{submitError}</Alert>}
      </form>
    </Modal>
  );
}
