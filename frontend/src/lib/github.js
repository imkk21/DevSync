import { useEffect, useState } from 'react';
import { api } from './api';
import { toast } from '../store/toastStore';

// Off to GitHub to approve DevSync; it comes back to this same page
export async function connectGitHub() {
  try {
    const { url } = await api('/api/github/connect', { method: 'POST', body: { next: window.location.pathname + window.location.search } });
    window.location.assign(url);
  } catch (err) {
    toast(err.message, { tone: 'error' });
  }
}

// Back from GitHub: finish connecting while signed in, then tidy the address bar
export async function finishGitHubReturn() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('github_code');
  const state = params.get('github_state');
  const result = params.get('github');
  if (!code && !result) return;
  ['github_code', 'github_state', 'github'].forEach((k) => params.delete(k));
  const rest = params.toString();
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
  if (result) return toast(result === 'cancelled' ? 'GitHub connection cancelled.' : 'That GitHub sign-in expired. Try again.', { tone: result === 'cancelled' ? 'info' : 'error' });
  try {
    const { login } = await api('/api/github/finish', { method: 'POST', body: { code, state } });
    toast(`GitHub connected as ${login}`, { tone: 'success' });
    window.dispatchEvent(new Event('devsync:github'));
  } catch (err) {
    toast(err.message, { tone: 'error' });
  }
}

// Load something GitHub-related, and again whenever an account gets connected
export function useGitHub(path, enabled = true) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    const load = () => api(path).then((d) => live && (setData(d), setError(''))).catch((err) => live && setError(err.message));
    load();
    window.addEventListener('devsync:github', load);
    return () => {
      live = false;
      window.removeEventListener('devsync:github', load);
    };
  }, [path, enabled]);
  return [data, setData, error];
}
