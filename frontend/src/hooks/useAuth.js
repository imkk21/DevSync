import { useEffect } from 'react';
import useAuthStore from '../store/authStore';

export default function useAuth() {
  const store = useAuthStore();

  useEffect(() => {
    if (!store.user && !store.loading) {
      store.initialize();
    }
  }, []);

  return {
    user: store.user,
    profile: store.profile,
    session: store.session,
    loading: store.loading,
    error: store.error,
    signIn: store.signIn,
    signUp: store.signUp,
    signOut: store.signOut,
    clearError: store.clearError,
    isAuthenticated: !!store.user,
  };
}
