import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GoArrowLeft, GoShieldCheck } from 'react-icons/go';
import { FcGoogle } from 'react-icons/fc';
import { FaGithub } from 'react-icons/fa';
import Logo from '../components/ui/Logo';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import ThemeMenu from '../components/ui/ThemeMenu';
import useAuthStore from '../store/authStore';

export default function LoginPage() {
  const { signInWithGoogle, signInWithGithub, error, clearError } = useAuthStore();
  const [pending, setPending] = useState(null);

  const signIn = async (provider, start) => {
    setPending(provider);
    clearError();
    const { error } = await start();
    // On success the browser leaves for the provider; only reset on failure
    if (error) setPending(null);
  };

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" aria-label="DevSync home" className="rounded-md">
          <Logo />
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/" className="inline-flex items-center gap-1.5 text-label-md text-ink-muted transition-colors hover:text-ink">
            <GoArrowLeft size={16} /> <span className="hidden sm:inline">Back to home</span><span className="sm:hidden">Home</span>
          </Link>
          <ThemeMenu />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-16 pt-8">
        <div className="w-full max-w-[400px] animate-fade-up">
          <div className="text-center">
            <h1 className="text-headline-md text-ink">Sign in to DevSync</h1>
            <p className="mt-2 text-body-md text-ink-muted">Continue with your Google or GitHub account.</p>
          </div>

          <div className="card mt-8 space-y-3 p-6">
            {error && <Alert>{error}</Alert>}
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              loading={pending === 'google'}
              disabled={!!pending}
              onClick={() => signIn('google', signInWithGoogle)}
            >
              {pending !== 'google' && <FcGoogle size={20} aria-hidden="true" />}
              {pending === 'google' ? 'Redirecting to Google…' : 'Continue with Google'}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              loading={pending === 'github'}
              disabled={!!pending}
              onClick={() => signIn('github', signInWithGithub)}
            >
              {pending !== 'github' && <FaGithub size={20} aria-hidden="true" />}
              {pending === 'github' ? 'Redirecting to GitHub…' : 'Continue with GitHub'}
            </Button>
          </div>

          <p className="mt-6 text-center text-body-sm text-ink-muted">
            New to DevSync? Signing in creates your account.
          </p>
        </div>
      </main>

      <footer className="pb-8 text-center">
        <p className="inline-flex items-center gap-1.5 text-label-sm text-ink-subtle">
          <GoShieldCheck size={14} aria-hidden="true" /> Secured by Supabase Auth
        </p>
      </footer>
    </div>
  );
}
