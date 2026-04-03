import Navbar from '../components/layout/Navbar';
import LoginForm from '../components/auth/LoginForm';
import { HiCode } from 'react-icons/hi';

export default function LoginPage() {
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
            <h1 className="text-2xl font-bold text-white mb-2">Welcome back</h1>
            <p className="text-surface-400 text-sm">Sign in to your DevSync account</p>
          </div>

          {/* Form Card */}
          <div className="glass rounded-2xl p-8">
            <LoginForm />
          </div>
        </div>
      </main>
    </div>
  );
}
