import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { GoAlert, GoArrowLeft, GoMortarBoard, GoPeople } from 'react-icons/go';
import { api } from '../lib/api';
import Navbar from '../components/layout/Navbar';
import Button from '../components/ui/Button';
import LoadingSpinner from '../components/ui/LoadingSpinner';

// Where an invite link lands: say what you're joining, then join
export default function InvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  const join = async () => {
    setJoining(true);
    try {
      const { workspaceId } = await api(`/api/invites/${token}/accept`, { method: 'POST' });
      navigate(`/editor/${workspaceId}`, { replace: true });
    } catch (err) {
      setError(err.message);
      setJoining(false);
    }
  };

  useEffect(() => {
    api(`/api/invites/${token}`)
      .then((data) => {
        setInvite(data);
        if (data.member) join(); // already in: straight through
      })
      .catch((err) => setError(err.message));
  }, [token]);

  return (
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <main className="mx-auto flex max-w-md flex-col items-center px-4 pt-20 text-center">
        {error ? (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas-muted text-ink-muted"><GoAlert size={20} aria-hidden="true" /></span>
            <h1 className="mt-4 text-headline-sm font-semibold text-ink">This invite didn't work</h1>
            <p className="mt-2 text-body-sm text-ink-muted">{error}</p>
            <Link to="/dashboard" className="btn btn-md btn-secondary mt-6"><GoArrowLeft size={16} /> Your workspaces</Link>
          </>
        ) : !invite || invite.member ? (
          <LoadingSpinner size="lg" className="text-brand" />
        ) : (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand-fg">
              {invite.workspace.is_classroom ? <GoMortarBoard size={20} aria-hidden="true" /> : <GoPeople size={20} aria-hidden="true" />}
            </span>
            <p className="mt-4 text-body-sm text-ink-muted">{invite.owner} invited you to</p>
            <h1 className="mt-1 text-headline-md text-ink">{invite.workspace.name}</h1>
            {invite.workspace.description && <p className="mt-2 text-body-sm text-ink-muted">{invite.workspace.description}</p>}
            <p className="mt-4 text-body-sm text-ink">
              {invite.workspace.is_classroom
                ? "You'll get your own copy to work in. Your teacher can see it and help."
                : `You'll be able to ${invite.role === 'editor' ? 'edit and run' : 'view and run'} code with everyone in it.`}
            </p>
            <Button size="lg" className="mt-8 w-full max-w-[272px]" loading={joining} onClick={join}>
              {invite.workspace.is_classroom ? 'Get my copy' : 'Join workspace'}
            </Button>
          </>
        )}
      </main>
    </div>
  );
}
