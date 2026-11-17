import { useEffect, useRef, useState } from 'react';
import { GoFile, GoFileMedia, GoTrash, GoUpload } from 'react-icons/go';
import { supabase } from '../../lib/supabase';
import { toast } from '../../store/toastStore';
import { timeAgo } from '../workspace/WorkspaceCard';
import Button from '../ui/Button';

const BUCKET = 'workspace-files';
const MAX_BYTES = 10 * 1024 * 1024;
const LINK_SECONDS = 3600;
const isImage = (name) => /\.(png|jpe?g|gif|webp|svg)$/i.test(name);
// Stored as "<time>-<name>"; show just the name
const displayName = (name) => name.replace(/^\d+-/, '');
const sizeOf = (bytes) => (bytes == null ? '' : bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`);

// PDFs, images, designs, datasets: anything that isn't code, shared with the workspace.
// Private: links are signed and expire after an hour.
export default function AssetsPanel({ workspaceId, readOnly }) {
  const [items, setItems] = useState(null);
  const [thumbs, setThumbs] = useState({});
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef(null);

  const load = async () => {
    const { data, error } = await supabase.storage.from(BUCKET).list(workspaceId, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) return setItems([]);
    const files = (data || []).filter((f) => f.name && !f.name.startsWith('.'));
    setItems(files);
    const images = files.filter((f) => isImage(f.name)).map((f) => `${workspaceId}/${f.name}`);
    if (images.length) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(images, LINK_SECONDS);
      setThumbs(Object.fromEntries((signed || []).map((s) => [s.path, s.signedUrl])));
    }
  };
  useEffect(() => { load(); }, [workspaceId]);

  const upload = async (fileList) => {
    const files = [...fileList];
    if (!files.length) return;
    const tooBig = files.filter((f) => f.size > MAX_BYTES);
    if (tooBig.length) toast(`Skipped ${tooBig.map((f) => f.name).join(', ')}: files can be up to 10 MB.`, { tone: 'error' });
    setBusy(true);
    let done = 0;
    for (const f of files.filter((x) => x.size <= MAX_BYTES)) {
      const path = `${workspaceId}/${Date.now()}-${f.name.replace(/[^\w.-]+/g, '_')}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type || 'application/octet-stream' });
      if (error) toast(`${f.name}: ${error.message}`, { tone: 'error' });
      else done++;
    }
    setBusy(false);
    if (done) toast(`Uploaded ${done} ${done === 1 ? 'file' : 'files'}`, { tone: 'success' });
    load();
  };

  const open = async (item, download = false) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(`${workspaceId}/${item.name}`, LINK_SECONDS, download ? { download: displayName(item.name) } : undefined);
    if (error) return toast(error.message, { tone: 'error' });
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const remove = async (item) => {
    setItems((list) => list.filter((x) => x.name !== item.name));
    const { error } = await supabase.storage.from(BUCKET).remove([`${workspaceId}/${item.name}`]);
    if (error) toast(error.message, { tone: 'error' });
  };

  return (
    <div
      className={`flex h-full flex-col ${dragging ? 'bg-brand-soft/50' : ''}`}
      onDragOver={(e) => { if (!readOnly && e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (!readOnly) upload(e.dataTransfer.files); }}
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-line pl-4 pr-2">
        <h2 className="text-label-md text-ink">Shared files</h2>
        {!readOnly && (
          <Button size="sm" variant="ghost" className="!h-7" loading={busy} onClick={() => input.current?.click()}>
            {!busy && <GoUpload size={14} />} Upload
          </Button>
        )}
        <input ref={input} type="file" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {items === null && <li className="p-3 text-body-sm text-ink-muted">Loading…</li>}
        {items?.length === 0 && (
          <li className="px-3 py-8 text-center text-body-sm text-ink-muted">
            PDFs, images, designs and data for this workspace.{!readOnly && ' Drop files here or use Upload. Up to 10 MB each.'}
          </li>
        )}
        {items?.map((item) => {
          const thumb = thumbs[`${workspaceId}/${item.name}`];
          return (
            <li key={item.name} className="group flex items-center gap-2.5 rounded-md p-1.5 hover:bg-canvas-muted">
              <button type="button" onClick={() => open(item)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left" title="Open">
                {thumb ? (
                  <img src={thumb} alt="" className="h-9 w-9 shrink-0 rounded border border-line object-cover" />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-line bg-canvas text-ink-muted">
                    {isImage(item.name) ? <GoFileMedia size={16} aria-hidden="true" /> : <GoFile size={16} aria-hidden="true" />}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-body-sm text-ink">{displayName(item.name)}</span>
                  <span className="block text-label-sm text-ink-subtle">{[sizeOf(item.metadata?.size), item.created_at && timeAgo(item.created_at)].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
              <button type="button" onClick={() => open(item, true)} className="shrink-0 text-label-sm text-ink-muted opacity-0 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100">Download</button>
              {!readOnly && (
                <button type="button" onClick={() => remove(item)} className="icon-btn h-7 w-7 shrink-0 opacity-0 focus-visible:opacity-100 group-hover:opacity-100" aria-label={`Delete ${displayName(item.name)}`}>
                  <GoTrash size={13} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
