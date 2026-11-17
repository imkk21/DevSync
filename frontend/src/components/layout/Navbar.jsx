import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GoGear, GoPerson, GoRepo, GoSignOut, GoStack, GoX } from 'react-icons/go';
import useAuthStore from '../../store/authStore';
import useDismiss from '../../hooks/useDismiss';
import Logo from '../ui/Logo';
import Avatar from '../ui/Avatar';
import ThemeMenu, { ThemeSwitcher } from '../ui/ThemeMenu';
import NotificationBell from './NotificationBell';

const SECTIONS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#languages', label: 'Languages' },
];

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function UserMenu({ user, profile, name, avatar, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useDismiss(ref, open, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex rounded-full transition-opacity hover:opacity-85"
      >
        <Avatar name={name} id={user.id} src={avatar} size={32} />
      </button>
      {open && (
        <div role="menu" className="menu absolute right-0 top-full z-50 mt-2 w-64 origin-top-right animate-scale-in">
          <div className="px-2.5 py-2">
            <p className="truncate text-label-md text-ink">{name}</p>
            <p className="mt-1 truncate text-body-sm text-ink-muted">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link role="menuitem" to="/dashboard" onClick={() => setOpen(false)} className="menu-item">
            <GoRepo size={16} className="text-ink-muted" /> Your workspaces
          </Link>
          <Link role="menuitem" to="/review" onClick={() => setOpen(false)} className="menu-item">
            <GoStack size={16} className="text-ink-muted" /> Flashcards
          </Link>
          {profile?.username && (
            <Link role="menuitem" to={`/u/${profile.username}`} onClick={() => setOpen(false)} className="menu-item">
              <GoPerson size={16} className="text-ink-muted" /> Your public page
            </Link>
          )}
          <Link role="menuitem" to="/settings" onClick={() => setOpen(false)} className="menu-item">
            <GoGear size={16} className="text-ink-muted" /> Settings
          </Link>
          <button role="menuitem" type="button" onClick={onSignOut} className="menu-item">
            <GoSignOut size={16} className="text-ink-muted" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { user, profile, signOut } = useAuthStore();
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isLanding = pathname === '/';
  const name = profile?.display_name || user?.email || '';
  // Your chosen picture once the profile has loaded (empty means initials); the sign-in picture until then
  const avatar = profile ? profile.avatar_url : user?.user_metadata?.avatar_url;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const closeMobile = () => setMobileOpen(false);

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-canvas transition-colors duration-200 ${
        scrolled || !isLanding ? 'border-line' : 'border-transparent'
      }`}
    >
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6 lg:px-8">
        <Link to="/" aria-label="DevSync home" className="rounded-md">
          <Logo />
        </Link>

        {isLanding && (
          <div className="hidden items-center gap-7 md:flex">
            {SECTIONS.map((s) => (
              <a key={s.href} href={s.href} className="text-label-md text-ink transition-colors hover:text-ink-muted">
                {s.label}
              </a>
            ))}
          </div>
        )}

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <ThemeMenu className="mr-1" />
          {user ? (
            <>
              {pathname !== '/dashboard' && (
                <Link to="/dashboard" className="btn btn-sm btn-secondary">Dashboard</Link>
              )}
              <NotificationBell />
              <div className="ml-2">
                <UserMenu user={user} profile={profile} name={name} avatar={avatar} onSignOut={signOut} />
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-sm btn-ghost">Sign in</Link>
              <Link to="/login" className="btn btn-sm btn-primary">Get started</Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          className="icon-btn ml-auto md:hidden"
        >
          {mobileOpen ? <GoX size={20} /> : <MenuIcon />}
        </button>
      </nav>

      {mobileOpen && (
        <div className="animate-fade-in border-t border-line bg-canvas md:hidden">
          <div className="mx-auto max-w-6xl space-y-1 px-4 py-3 sm:px-6">
            {isLanding &&
              SECTIONS.map((s) => (
                <a key={s.href} href={s.href} onClick={closeMobile} className="block rounded-md px-3 py-2.5 text-label-lg text-ink hover:bg-canvas-muted">
                  {s.label}
                </a>
              ))}
            <div className="flex items-center justify-between gap-4 px-3 py-2">
              <span className="text-label-lg text-ink">Theme</span>
              <ThemeSwitcher className="w-full max-w-[260px]" />
            </div>
            {user ? (
              <>
                <div className="flex items-center gap-3 px-3 py-3">
                  <Avatar name={name} id={user.id} src={avatar} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-label-md text-ink">{name}</p>
                    <p className="mt-1 truncate text-body-sm text-ink-muted">{user.email}</p>
                  </div>
                </div>
                <Link to="/dashboard" onClick={closeMobile} className="block rounded-md px-3 py-2.5 text-label-lg text-ink hover:bg-canvas-muted">
                  Your workspaces
                </Link>
                <Link to="/review" onClick={closeMobile} className="block rounded-md px-3 py-2.5 text-label-lg text-ink hover:bg-canvas-muted">
                  Flashcards
                </Link>
                <Link to="/settings" onClick={closeMobile} className="block rounded-md px-3 py-2.5 text-label-lg text-ink hover:bg-canvas-muted">
                  Settings
                </Link>
                <button
                  type="button"
                  onClick={() => { closeMobile(); signOut(); }}
                  className="block w-full rounded-md px-3 py-2.5 text-left text-label-lg text-ink hover:bg-canvas-muted"
                >
                  Sign out
                </button>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <Link to="/login" onClick={closeMobile} className="btn btn-md btn-secondary">Sign in</Link>
                <Link to="/login" onClick={closeMobile} className="btn btn-md btn-primary">Get started</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
