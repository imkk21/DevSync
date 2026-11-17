import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import useAuthStore from './store/authStore';
import useSettingsStore from './store/settingsStore';
import { PageLoader } from './components/ui/LoadingSpinner';
import { finishGitHubReturn } from './lib/github';

// Each page is its own chunk, so the landing page doesn't download the editor
const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const EditorPage = lazy(() => import('./pages/EditorPage'));
const InvitePage = lazy(() => import('./pages/InvitePage'));
const PublicPage = lazy(() => import('./pages/PublicPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const WallPage = lazy(() => import('./pages/WallPage'));
const MoviePage = lazy(() => import('./pages/MoviePage'));
const EmbedPage = lazy(() => import('./pages/EmbedPage'));
const ReviewPage = lazy(() => import('./pages/ReviewPage'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'));
const Toaster = lazy(() => import('./components/ui/Toaster')); // keeps the icon set out of the first download

function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore();
  const location = useLocation();

  if (loading) return <PageLoader />;

  if (!user) {
    // Come back here after signing in (the dashboard picks this up)
    try { sessionStorage.setItem('devsync:return-to', location.pathname + location.search); } catch { /* storage unavailable */ }
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuthStore();

  if (loading) return <PageLoader />;

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// Settings > Accessibility, applied to the whole app
function useAccessibility() {
  const { readableFont, highContrast, textScale, reduceMotion } = useSettingsStore();
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('a11y-font', readableFont);
    root.classList.toggle('a11y-contrast', highContrast);
    root.classList.toggle('a11y-motion', reduceMotion);
    root.style.zoom = textScale === 100 ? '' : String(textScale / 100); // type sizes are px, so zoom the whole page
    if (readableFont && !document.getElementById('a11y-font')) {
      const link = Object.assign(document.createElement('link'), {
        id: 'a11y-font', rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap',
      });
      document.head.appendChild(link);
    }
  }, [readableFont, highContrast, textScale, reduceMotion]);
}

export default function App() {
  const { initialize } = useAuthStore();
  useAccessibility();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Back from approving DevSync on GitHub: finish once signed in
  const signedIn = useAuthStore((s) => !!s.user);
  useEffect(() => {
    if (signedIn) finishGitHubReturn();
  }, [signedIn]);

  return (
    <div className="min-h-screen bg-canvas">
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />

        <Route path="/login" element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } />

        <Route path="/editor/:workspaceId" element={
          <ProtectedRoute>
            <EditorPage />
          </ProtectedRoute>
        } />
        <Route path="/editor/:workspaceId/wall" element={
          <ProtectedRoute>
            <WallPage />
          </ProtectedRoute>
        } />
        <Route path="/invite/:token" element={
          <ProtectedRoute>
            <InvitePage />
          </ProtectedRoute>
        } />
        <Route path="/settings" element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        } />
        <Route path="/review" element={
          <ProtectedRoute>
            <ReviewPage />
          </ProtectedRoute>
        } />
        <Route path="/p/:token" element={<PublicPage />} />
        <Route path="/u/:username" element={<PortfolioPage />} />
        <Route path="/movie/:token/:fileId" element={<MoviePage />} />
        <Route path="/embed/:token" element={<EmbedPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      <Suspense fallback={null}><Toaster /></Suspense>
    </div>
  );
}
