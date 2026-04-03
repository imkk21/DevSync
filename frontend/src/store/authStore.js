import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { authService } from '../services/authService';

const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  session: null,
  loading: true,
  error: null,

  ensureProfile: async (user) => {
    // Check if profile exists, create if missing (handles pre-trigger signups)
    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    const idealName = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.display_name || user.email?.split('@')[0] || 'User';
    
    if (existing) {
      if ((existing.display_name === user.email?.split('@')[0] || existing.display_name === user.email) && idealName !== existing.display_name) {
        // Fix legacy profiles that incorrectly used the email prefix
        const { data: updated } = await supabase.from('profiles').update({ display_name: idealName }).eq('id', user.id).select().single();
        return updated || existing;
      }
      return existing;
    }

    // Profile missing — create it
    const displayName = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.display_name || user.email?.split('@')[0] || 'User';
    const { data: created } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        display_name: displayName,
      })
      .select()
      .single();

    return created || { id: user.id, email: user.email, display_name: displayName };
  },

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const profile = await get().ensureProfile(session.user);

        set({
          user: session.user,
          session,
          profile,
          loading: false,
        });
      } else {
        set({ loading: false });
      }

      supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          const profile = await get().ensureProfile(session.user);

          set({
            user: session.user,
            session,
            profile,
          });
        } else if (event === 'SIGNED_OUT') {
          set({ user: null, session: null, profile: null });
        }
      });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  signInWithGoogle: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await authService.signInWithGoogle();
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  signInWithGithub: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await authService.signInWithGithub();
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { data: null, error };
    }
  },

  signOut: async () => {
    // Eagerly clear the state so the UI logs out instantly
    set({ user: null, session: null, profile: null, loading: false });
    
    // Process the remote signout in the background
    try {
      await authService.signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
