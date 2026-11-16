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
      .insert({
        id: user.id,
        email: user.email,
        display_name: displayName,
      })
      .select()
      .single();

    return created || { id: user.id, email: user.email, display_name: displayName };
  },

  // Display name and picture load in the background; pages only wait for the session
  loadProfile: (user) => {
    get().ensureProfile(user)
      .then((profile) => get().user?.id === user.id && set({ profile }))
      .catch(() => {});
  },

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      set({ user: session?.user ?? null, session, loading: false });
      if (session) get().loadProfile(session.user);

      // Supabase runs this callback while holding its auth lock, and every query needs that
      // lock, so a query in here waits on itself until the lock times out. Do no queries here;
      // defer them until the callback has returned.
      supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          set({ user: null, session: null, profile: null });
          return;
        }
        if (!session) return;
        const sameUser = get().user?.id === session.user.id;
        // Keep the same user object on token refreshes so pages don't refetch everything
        set({ session, ...(!sameUser && { user: session.user, profile: null }) });
        if (!sameUser) setTimeout(() => get().loadProfile(session.user), 0);
      });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  // `loading` is only for the initial session check; the login buttons show
  // their own pending state while the browser redirects to the provider.
  signInWithGoogle: async () => {
    set({ error: null });
    try {
      const { data, error } = await authService.signInWithGoogle();
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      set({ error: error.message });
      return { data: null, error };
    }
  },

  signInWithGithub: async () => {
    set({ error: null });
    try {
      const { data, error } = await authService.signInWithGithub();
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      set({ error: error.message });
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

  // { display_name, avatar_url }
  updateProfile: async (patch) => {
    const { data, error } = await supabase.from('profiles').update(patch).eq('id', get().user.id).select().single();
    if (!error) set({ profile: data });
    return { error };
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
