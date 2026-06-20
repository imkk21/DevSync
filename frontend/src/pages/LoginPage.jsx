import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HiCode, HiArrowLeft, HiLightningBolt, HiGlobe, HiUsers, HiShieldCheck } from 'react-icons/hi';
import { FcGoogle } from 'react-icons/fc';
import { FaGithub } from 'react-icons/fa';
import Navbar from '../components/layout/Navbar';
import useAuthStore from '../store/authStore';

export default function LoginPage() {
  const { signInWithGoogle, signInWithGithub, error, clearError } = useAuthStore();
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingGithub, setLoadingGithub] = useState(false);

  const handleGoogleLogin = async () => {
    setLoadingGoogle(true);
    clearError();
    const { error } = await signInWithGoogle();
    if (error) setLoadingGoogle(false);
  };

  const handleGithubLogin = async () => {
    setLoadingGithub(true);
    clearError();
    const { error } = await signInWithGithub();
    if (error) setLoadingGithub(false);
  };

  return (
    <div className="min-h-screen bg-surface-950 noise">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 dot-grid opacity-30" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-brand-500/[0.05] blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-accent-500/[0.04] blur-[100px]" />
      </div>

      <Navbar />

      <main className="relative z-10 flex-1 flex items-center justify-center min-h-screen px-4 pt-16 pb-12">
        <div className="w-full max-w-md">

          {/* Back link */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-surface-500 hover:text-white transition-colors duration-300 mb-8 group"
          >
            <HiArrowLeft className="group-hover:-translate-x-0.5 transition-transform duration-300" size={14} />
            Back to home
          </Link>

          {/* Login card */}
          <div className="animate-fade-up opacity-0" style={{ animationDelay: '200ms' }}>
            <div className="relative bg-white/[0.02] backdrop-blur-xl rounded-3xl border border-white/[0.06] p-8 shadow-2xl shadow-black/30 overflow-hidden">

              {/* Top edge shine */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-500/25 to-transparent" />

              {/* Header */}
              <div className="text-center mb-8">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-400 to-accent-500 flex items-center justify-center mx-auto mb-5
                  shadow-lg shadow-brand-500/20">
                  <HiCode className="text-white text-xl" />
                </div>
                <h1 className="text-2xl font-display font-bold text-white tracking-tight mb-1.5">
                  Welcome to DevSync
                </h1>
                <p className="text-sm text-surface-500">
                  Sign in to access your workspaces
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="w-full p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-6 animate-slide-down">
                  {error}
                </div>
              )}

              {/* Feature pills */}
              <div className="flex flex-wrap justify-center gap-2 mb-8">
                {[
                  { icon: HiLightningBolt, label: 'Instant Setup', color: 'text-amber-400' },
                  { icon: HiGlobe, label: 'Cloud Sync', color: 'text-brand-400' },
                  { icon: HiUsers, label: 'Team Collab', color: 'text-accent-400' },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-[11px] text-surface-400 font-medium">
                    <Icon className={color} size={12} />
                    {label}
                  </div>
                ))}
              </div>

              {/* OAuth buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleGoogleLogin}
                  disabled={loadingGoogle || loadingGithub}
                  className="w-full h-12 flex items-center justify-center gap-3 bg-white hover:bg-surface-100 text-black rounded-xl font-semibold text-sm transition-all duration-300 active:scale-[0.98] shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loadingGoogle ? (
                    <svg className="animate-spin h-4 w-4 text-black/40" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <FcGoogle size={18} />
                  )}
                  {loadingGoogle ? 'Connecting...' : 'Continue with Google'}
                </button>

                <button
                  onClick={handleGithubLogin}
                  disabled={loadingGoogle || loadingGithub}
                  className="w-full h-12 flex items-center justify-center gap-3 bg-[#161b22] hover:bg-[#1c2128] text-white rounded-xl font-semibold text-sm border border-white/[0.08] transition-all duration-300 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loadingGithub ? (
                    <svg className="animate-spin h-4 w-4 text-white/40" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <FaGithub size={18} />
                  )}
                  {loadingGithub ? 'Connecting...' : 'Continue with GitHub'}
                </button>
              </div>

              {/* Footer */}
              <div className="mt-8 pt-6 border-t border-white/[0.04] text-center">
                <p className="text-[10px] text-surface-600 uppercase tracking-widest flex items-center justify-center gap-1.5 font-medium">
                  <HiShieldCheck className="text-emerald-500" size={12} />
                  Secured by Supabase Auth
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
