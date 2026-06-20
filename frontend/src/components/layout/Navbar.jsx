import { Link, useNavigate, useLocation } from 'react-router-dom';
import { HiCode, HiLogout, HiViewGrid, HiMenu, HiX } from 'react-icons/hi';
import { useState, useEffect } from 'react';
import useAuthStore from '../../store/authStore';

export default function Navbar() {
  const { user, profile, signOut } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSignOut = async () => {
    await signOut();
  };

  const isLanding = location.pathname === '/';

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      scrolled
        ? 'bg-surface-950/80 backdrop-blur-2xl border-b border-white/[0.04] shadow-lg shadow-black/20'
        : 'bg-transparent border-b border-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-accent-500 flex items-center justify-center
              group-hover:shadow-lg group-hover:shadow-brand-500/25 transition-all duration-500">
              <HiCode className="text-white text-lg" />
            </div>
            <span className="text-lg font-bold font-display gradient-text">DevSync</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <>
                <Link to="/dashboard" className="btn-ghost flex items-center gap-2 text-sm">
                  <HiViewGrid size={16} />
                  Dashboard
                </Link>
                <div className="flex items-center gap-3 pl-3 ml-2 border-l border-white/[0.06]">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-400 to-accent-500 flex items-center justify-center text-xs font-bold text-white">
                    {(profile?.display_name || user.email)?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm text-surface-300 max-w-[120px] truncate">
                    {profile?.display_name || user.email}
                  </span>
                  <button onClick={handleSignOut} className="p-2 rounded-lg text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300" title="Sign out">
                    <HiLogout size={16} />
                  </button>
                </div>
              </>
            ) : (
              <>
                {isLanding && (
                  <div className="flex items-center gap-2">
                    <Link to="/login" className="btn-ghost text-sm">Log In</Link>
                    <Link to="/login">
                      <button className="px-5 py-2 rounded-xl text-sm font-semibold bg-white text-black hover:bg-surface-200 transition-all duration-300 active:scale-[0.97]">
                        Get Started
                      </button>
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-surface-400 hover:text-white transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <HiX size={24} /> : <HiMenu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/[0.04] bg-surface-950/95 backdrop-blur-2xl animate-slide-down">
          <div className="px-4 py-4 space-y-2">
            {user ? (
              <>
                <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="block px-4 py-2.5 rounded-xl hover:bg-white/5 text-surface-300 text-sm transition-colors">
                  Dashboard
                </Link>
                <button onClick={() => { handleSignOut(); setMobileOpen(false); }} className="block w-full text-left px-4 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 text-sm transition-colors">
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setMobileOpen(false)} className="block px-4 py-2.5 rounded-xl hover:bg-white/5 text-surface-300 text-sm transition-colors">
                  Log In
                </Link>
                <Link to="/login" onClick={() => setMobileOpen(false)} className="block px-4 py-2.5 rounded-xl bg-white text-black text-center text-sm font-semibold">
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
