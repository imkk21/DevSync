import { useEffect, useState } from 'react';
import { GoCode, GoLink } from 'react-icons/go';
import { supabase } from '../../lib/supabase';
import { toast } from '../../store/toastStore';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';
import ReplayPlayer, { fromBase64 } from './ReplayPlayer';

const copy = async (text, what) => {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${what} copied`, { tone: 'success' });
  } catch {
    toast(text, { duration: 10000 });
  }
};

// Plays back how a file was written. With a public link on, it can be shared as a "code movie".
export default function ReplayModal({ isOpen, onClose, file, people, publicToken }) {
  const [steps, setSteps] = useState(null);
  const nameOf = (id) => people.find((p) => p.id === id)?.name || 'Someone';

  useEffect(() => {
    if (!isOpen || !file) return;
    setSteps(null);
    // ponytail: loads the whole recording; page it if files get thousands of saves
    supabase
      .from('doc_updates').select('data, user_ids, created_at').eq('file_id', file.id).order('id').limit(5000)
      .then(({ data }) => setSteps((data || []).map((r) => ({ update: fromBase64(r.data), user_ids: r.user_ids, created_at: r.created_at }))));
  }, [isOpen, file?.id]);

  const movieUrl = publicToken && file ? `${window.location.origin}/movie/${publicToken}/${file.id}` : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={`Replay of ${file?.name ?? ''}`}
      description={movieUrl ? 'Every save, in order. Share it as a code movie anyone can watch.' : 'Every save, in order. Turn on the public link in Share to embed it as a code movie.'}
      footer={
        <>
          {movieUrl && (
            <>
              <Button variant="ghost" className="mr-auto" onClick={() => copy(movieUrl, 'Movie link')}><GoLink size={16} /> Copy link</Button>
              <Button variant="ghost" onClick={() => copy(`<iframe src="${movieUrl}" width="800" height="520" style="border:0;border-radius:8px" allowfullscreen></iframe>`, 'Embed code')}>
                <GoCode size={16} /> Copy embed code
              </Button>
            </>
          )}
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </>
      }
    >
      {steps === null ? (
        <div className="flex h-60 items-center justify-center"><LoadingSpinner className="text-brand" /></div>
      ) : steps.length === 0 ? (
        <p className="text-body-sm text-ink-muted">Nothing recorded for this file yet. Edits are recorded from now on.</p>
      ) : (
        <ReplayPlayer steps={steps} fileName={file.name} nameOf={nameOf} />
      )}
    </Modal>
  );
}
