-- ============================================================
-- 008: Profile pictures. A public "avatars" storage bucket; each person can only
-- add, replace or delete files in their own folder (avatars/<user id>/...).
-- Run in the Supabase SQL Editor after 007. Safe to re-run.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', TRUE, 1048576, ARRAY['image/webp', 'image/png', 'image/jpeg'])
ON CONFLICT (id) DO UPDATE SET public = TRUE, file_size_limit = 1048576, allowed_mime_types = ARRAY['image/webp', 'image/png', 'image/jpeg'];

DROP POLICY IF EXISTS "Avatar owners can read" ON storage.objects;
DROP POLICY IF EXISTS "Avatar owners can upload" ON storage.objects;
DROP POLICY IF EXISTS "Avatar owners can update" ON storage.objects;
DROP POLICY IF EXISTS "Avatar owners can delete" ON storage.objects;

-- Anyone can view pictures through the public URL; these cover the API calls for your own folder
CREATE POLICY "Avatar owners can read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Avatar owners can upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Avatar owners can update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Avatar owners can delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
