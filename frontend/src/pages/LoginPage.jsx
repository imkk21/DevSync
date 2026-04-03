import { useState } from 'react';
import { HiCode, HiLightningBolt, HiGlobe, HiUsers } from 'react-icons/hi';
import { FcGoogle } from 'react-icons/fc';
import { FaGithub } from 'react-icons/fa';
import Navbar from '../components/layout/Navbar';
import Button from '../components/ui/Button';
import useAuthStore from '../store/authStore';

export default function LoginPage() {
  const { signInWithGoogle, signInWithGithub, error, clearError } = useAuthStore();
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingGithub, setLoadingGithub] = useState(false);

  const handleGoogleLogin = async () => {
    setLoadingGoogle(true);
    clearError();
    const { error } = await signInWithGoogle();
    if (error) {
       setLoadingGoogle(false);
    }
  };

  const handleGithubLogin = async () => {
    setLoadingGithub(true);
    clearError();
    const { error } = await signInWithGithub();
    if (error) {
       setLoadingGithub(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 flex flex-col">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 pt-16">
        <div className="w-full max-w-md animate-slide-up">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mx-auto mb-4
              shadow-lg shadow-brand-500/30">
              <HiCode className="text-white text-2xl" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Welcome to DevSync</h1>
            <p className="text-surface-400 text-sm">Sign in or create your account instantly</p>
          </div>

          {/* Form Card */}
          <div className="glass rounded-2xl p-8 text-center flex flex-col items-center">
            
            {error && (
              <div className="w-full p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm mb-6 text-left">
                {error}
              </div>
            )}
            
            <div className="flex items-center justify-center gap-6 text-xs text-surface-400 mb-8">
              <span className="flex items-center gap-1.5 font-medium"><HiLightningBolt className="text-yellow-500" size={14} /> Instant Setup</span>
              <span className="flex items-center gap-1.5 font-medium"><HiGlobe className="text-blue-400" size={14} /> Cloud Sync</span>
              <span className="flex items-center gap-1.5 font-medium"><HiUsers className="text-purple-400" size={14} /> Teams</span>
            </div>

            <div className="w-full space-y-3">
              <Button 
                  onClick={handleGoogleLogin} 
                  className="w-full h-12 flex items-center justify-center gap-3 !bg-white hover:!bg-surface-200 !text-black !border-none custom-google-btn"
                  loading={loadingGoogle}
                  disabled={loadingGithub}
              >
                {!loadingGoogle && <FcGoogle size={22} />}
                <span className="font-semibold text-black">{loadingGoogle ? 'Connecting to Google...' : 'Continue with Google'}</span>
              </Button>

              <Button 
                  onClick={handleGithubLogin} 
                  className="w-full h-12 flex items-center justify-center gap-3 !bg-[#24292F] hover:!bg-[#24292F]/90 !text-white !border-white/10 ring-1 ring-white/10"
                  loading={loadingGithub}
                  disabled={loadingGoogle}
              >
                {!loadingGithub && <FaGithub size={22} />}
                <span className="font-semibold">{loadingGithub ? 'Connecting to GitHub...' : 'Continue with GitHub'}</span>
              </Button>
            </div>
            
          </div>
        </div>
      </main>
    </div>
  );
}
