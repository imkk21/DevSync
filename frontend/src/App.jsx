import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import useAuthStore from './store/authStore';
import { PageLoader } from './components/ui/LoadingSpinner';

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

export default function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

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
        <Route path="/p/:token" element={<PublicPage />} />
        <Route path="/movie/:token/:fileId" element={<MoviePage />} />
        <Route path="/embed/:token" element={<EmbedPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      <Suspense fallback={null}><Toaster /></Suspense>
    </div>
  );
}
