import { Link, useNavigate, useLocation } from 'react-router-dom';
import { HiCode, HiLogout, HiViewGrid, HiMenu, HiX } from 'react-icons/hi';
import { useState } from 'react';
import useAuthStore from '../../store/authStore';
import Button from '../ui/Button';

export default function Navbar() {
  const { user, profile, signOut } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isLanding = location.pathname === '/';

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 glass border-b border-surface-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center
              group-hover:shadow-lg group-hover:shadow-brand-500/30 transition-all duration-300">
              <HiCode className="text-white text-lg" />
            </div>
            <span className="text-xl font-bold gradient-text">DevSync</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <>
                <Link to="/dashboard" className="btn-ghost flex items-center gap-2">
                  <HiViewGrid size={18} />
                  Dashboard
                </Link>
                <div className="flex items-center gap-3 pl-4 border-l border-surface-800">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center text-sm font-bold">
                    {(profile?.display_name || user.email)?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm text-surface-300 max-w-[120px] truncate">
                    {profile?.display_name || user.email}
                  </span>
                  <button onClick={handleSignOut} className="p-2 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Sign out">
                    <HiLogout size={18} />
                  </button>
                </div>
              </>
            ) : (
              <>
                {isLanding && (
                  <div className="flex items-center gap-3">
                    <Link to="/login">
                      <Button variant="ghost">Log In</Button>
                    </Link>
                    <Link to="/register">
                      <Button variant="primary">Get Started</Button>
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-surface-400 hover:text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <HiX size={24} /> : <HiMenu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-surface-800 bg-surface-950/95 backdrop-blur-xl animate-slide-down">
          <div className="px-4 py-4 space-y-3">
            {user ? (
              <>
                <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="block px-4 py-2 rounded-lg hover:bg-surface-800 text-surface-300">
                  Dashboard
                </Link>
                <button onClick={() => { handleSignOut(); setMobileOpen(false); }} className="block w-full text-left px-4 py-2 rounded-lg text-red-400 hover:bg-red-500/10">
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileOpen(false)} className="block px-4 py-2 rounded-lg hover:bg-surface-800 text-surface-300">
                  Log In
                </Link>
                <Link to="/register" onClick={() => setMobileOpen(false)} className="block px-4 py-2 rounded-lg bg-brand-600 text-white text-center">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
