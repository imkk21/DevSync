import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import useAuthStore from '../store/authStore';

export default function useRealtime(channelName) {
  const { user, profile } = useAuthStore();
  const channelRef = useRef(null);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!user || !channelName) return;

    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: user.id },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state)
          .flat()
          .map((u) => ({
            id: u.user_id,
            display_name: u.display_name,
            email: u.email,
          }));
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            display_name: profile?.display_name || user.email,
            email: user.email,
            online_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [user, channelName, profile]);

  const broadcast = useCallback((event, payload) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event,
        payload: {
          ...payload,
          user_id: user?.id,
        },
      });
    }
  }, [user]);

  const onBroadcast = useCallback((event, callback) => {
    if (channelRef.current) {
      channelRef.current.on('broadcast', { event }, callback);
    }
  }, []);

  return { onlineUsers, broadcast, onBroadcast, channel: channelRef };
}
