import { supabase } from './supabase';

// Built-in pictures (frontend/public/avatars). Stored on profiles as "/avatars/<id>.svg".
export const BUILT_IN_AVATARS = [
  { id: 'glasses', label: 'Glasses' },
  { id: 'headphones', label: 'Headphones' },
  { id: 'beanie', label: 'Beanie' },
  { id: 'cap', label: 'Cap' },
  { id: 'bun', label: 'Bun' },
  { id: 'beard', label: 'Beard' },
  { id: 'curls', label: 'Curls' },
  { id: 'robot', label: 'Robot' },
].map((a) => ({ ...a, url: `/avatars/${a.id}.svg` }));

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const SIZE = 256;
const BUCKET = 'avatars';

// Centre-cropped square, resized, as WebP (PNG where WebP encoding isn't available)
export async function squareImage(file) {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close?.();
  const encode = (type) => new Promise((resolve) => canvas.toBlob(resolve, type, 0.86));
  const webp = await encode('image/webp');
  return webp?.type === 'image/webp' ? webp : encode('image/png');
}

// Upload to avatars/<userId>/<time>.<ext> and return its public URL
export async function uploadAvatar(userId, blob) {
  const path = `${userId}/${Date.now()}.${blob.type === 'image/webp' ? 'webp' : 'png'}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

const pathOf = (url) => url?.split(`/${BUCKET}/`)[1]?.split('?')[0];
export const isUploadedAvatar = (url) => !!url && url.includes(`/storage/v1/object/public/${BUCKET}/`);

// Remove your earlier uploads, keeping `keepUrl`. Failures are harmless (just leftover files).
export async function removeOldAvatars(userId, keepUrl) {
  const { data } = await supabase.storage.from(BUCKET).list(userId);
  const keep = pathOf(keepUrl);
  const old = (data || []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (old.length) await supabase.storage.from(BUCKET).remove(old);
}
