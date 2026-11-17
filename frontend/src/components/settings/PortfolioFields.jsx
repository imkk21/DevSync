import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import useAuthStore from '../../store/authStore';
import { toast } from '../../store/toastStore';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Alert from '../ui/Alert';

const USERNAME = /^[a-z0-9][a-z0-9_-]{2,29}$/;
const LINKS = [
  ['github', 'GitHub', 'https://github.com/you'],
  ['linkedin', 'LinkedIn', 'https://linkedin.com/in/you'],
  ['website', 'Website', 'https://you.dev'],
];

// Settings > Portfolio: your public page at /u/<username>
export default function PortfolioFields() {
  const { user, profile, updateProfile } = useAuthStore();
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [links, setLinks] = useState({});
  const [showcase, setShowcase] = useState([]);
  const [owned, setOwned] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const filled = useRef(false);

  useEffect(() => {
    if (!profile || filled.current) return;
    filled.current = true;
    setUsername(profile.username || '');
    setBio(profile.bio || '');
    setLinks(profile.links || {});
    setShowcase(profile.showcase || []);
  }, [profile]);
  useEffect(() => {
    if (!user) return;
    supabase.from('workspaces').select('id, name, public_token').eq('owner_id', user.id).order('updated_at', { ascending: false })
      .then(({ data }) => setOwned(data || []));
  }, [user?.id]);

  const save = async (e) => {
    e.preventDefault();
    const name = username.trim().toLowerCase();
    if (name && !USERNAME.test(name)) return setError('Use 3–30 lowercase letters, numbers, - or _, starting with a letter or number.');
    const clean = {};
    for (const [key] of LINKS) {
      const url = (links[key] || '').trim();
      if (url && !/^https?:\/\//i.test(url)) return setError('Links start with https://');
      if (url) clean[key] = url.slice(0, 200);
    }
    setSaving(true);
    setError('');
    const { error: err } = await updateProfile({ username: name || null, bio: bio.trim().slice(0, 300) || null, links: clean, showcase });
    setSaving(false);
    if (err) return setError(err.code === '23505' ? 'Someone already has that username.' : err.message);
    setUsername(name);
    toast('Portfolio saved', { tone: 'success' });
  };

  const toggle = (id) => setShowcase((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const live = profile?.username;

  return (
    <form onSubmit={save} noValidate className="space-y-5">
      <Input
        label="Username"
        value={username}
        onChange={(e) => { setUsername(e.target.value.toLowerCase()); setError(''); }}
        maxLength={30}
        autoComplete="username"
        hint={live ? <>Your page: <Link to={`/u/${live}`} className="font-semibold text-brand-fg hover:underline">{window.location.host}/u/{live}</Link></> : 'Pick one to turn on your public page.'}
      />
      <label className="block">
        <span className="text-label-md text-ink">Bio</span>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={300} rows={3} className="input input-multiline mt-1.5" placeholder="What you build, what you're learning" />
      </label>
      {LINKS.map(([key, label, placeholder]) => (
        <Input key={key} label={label} type="url" value={links[key] || ''} placeholder={placeholder} onChange={(e) => { setLinks((l) => ({ ...l, [key]: e.target.value })); setError(''); }} />
      ))}
      <fieldset>
        <legend className="text-label-md text-ink">Projects to show</legend>
        <p className="mt-1 text-body-sm text-ink-muted">Only workspaces you own with a public link turned on (Share › Public link) can be shown.</p>
        <ul className="mt-3 space-y-2">
          {owned === null && <li className="text-body-sm text-ink-subtle">Loading…</li>}
          {owned?.length === 0 && <li className="text-body-sm text-ink-subtle">You don't own any workspaces yet.</li>}
          {owned?.map((w) => (
            <li key={w.id}>
              <label className={`flex items-center gap-2.5 text-body-sm ${w.public_token ? 'cursor-pointer text-ink' : 'text-ink-subtle'}`}>
                <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" disabled={!w.public_token} checked={!!w.public_token && showcase.includes(w.id)} onChange={() => toggle(w.id)} />
                {w.name}
                {!w.public_token && <span className="text-label-sm">(not shared)</span>}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      {error && <Alert>{error}</Alert>}
      <Button type="submit" loading={saving}>Save portfolio</Button>
    </form>
  );
}
