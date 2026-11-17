import { useRef, useState } from 'react';
import { GoCheck, GoUpload } from 'react-icons/go';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import LoadingSpinner from '../ui/LoadingSpinner';
import { BUILT_IN_AVATARS, MAX_UPLOAD_BYTES, squareImage, uploadAvatar, isUploadedAvatar } from '../../lib/avatars';
import { toast } from '../../store/toastStore';

function Choice({ selected, onSelect, label, children }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      title={label}
      onClick={onSelect}
      className={`relative rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${selected ? 'ring-2 ring-brand ring-offset-2 ring-offset-canvas' : ''}`}
    >
      {children}
      {selected && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-white ring-2 ring-canvas" aria-hidden="true">
          <GoCheck size={10} />
        </span>
      )}
    </button>
  );
}

// Profile picture: a built-in avatar, an uploaded photo, your sign-in picture, or initials.
// value: the avatar URL ('' = initials). Nothing is saved until the form is saved.
export default function AvatarPicker({ userId, name, value, onChange, providerUrl }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const uploaded = isUploadedAvatar(value) ? value : null;

  const upload = async (file) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) return toast('Choose a JPG, PNG, WebP or GIF image.', { tone: 'error' });
    if (file.size > MAX_UPLOAD_BYTES) return toast('That image is over 5 MB. Choose a smaller one.', { tone: 'error' });
    setBusy(true);
    try {
      onChange(await uploadAvatar(userId, await squareImage(file)));
    } catch (err) {
      toast(`Upload failed: ${err.message}`, { tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`flex items-center gap-4 rounded-lg border border-dashed p-3 transition-colors ${dragging ? 'border-brand bg-brand-soft' : 'border-line-strong'}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files[0]); }}
      >
        <span className="relative">
          <Avatar name={name} id={userId} src={value || undefined} size={64} />
          {busy && (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-canvas/70">
              <LoadingSpinner className="text-brand" />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => input.current?.click()} loading={busy}>
              {!busy && <GoUpload size={14} />} Upload a photo
            </Button>
            {value && <Button size="sm" variant="ghost" onClick={() => onChange('')}>Remove</Button>}
          </div>
          <p className="mt-2 text-body-sm text-ink-muted">Or drop an image here. JPG, PNG or WebP, up to 5 MB. We crop it to a square.</p>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={(e) => { upload(e.target.files[0]); e.target.value = ''; }}
        />
      </div>

      <div>
        <p id="avatar-choices" className="text-label-md text-ink">Or pick one</p>
        <div role="radiogroup" aria-labelledby="avatar-choices" className="mt-3 flex flex-wrap gap-3">
          {BUILT_IN_AVATARS.map((a) => (
            <Choice key={a.id} label={a.label} selected={value === a.url} onSelect={() => onChange(a.url)}>
              <img src={a.url} alt="" width={48} height={48} className="h-12 w-12 rounded-full" />
            </Choice>
          ))}
          {uploaded && (
            <Choice label="Your photo" selected onSelect={() => onChange(uploaded)}>
              <img src={uploaded} alt="" width={48} height={48} className="h-12 w-12 rounded-full object-cover" />
            </Choice>
          )}
          {providerUrl && (
            <Choice label="Your sign-in picture" selected={value === providerUrl} onSelect={() => onChange(providerUrl)}>
              <img src={providerUrl} alt="" width={48} height={48} referrerPolicy="no-referrer" className="h-12 w-12 rounded-full object-cover" />
            </Choice>
          )}
          <Choice label="Initials only" selected={!value} onSelect={() => onChange('')}>
            <Avatar name={name} id={userId} size={48} />
          </Choice>
        </div>
      </div>
    </div>
  );
}
