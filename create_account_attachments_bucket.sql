-- Create account-attachments storage bucket
-- This bucket stores file attachments for accounts

-- Note: Buckets must be created through the Supabase Dashboard UI or API
-- This SQL file documents the required bucket configuration

-- Bucket Configuration:
-- Name: account-attachments
-- Public: false (private bucket)
-- File size limit: 10485760 (10MB) or leave empty for default
-- Allowed MIME types: Leave empty for all types

-- RLS Policies for account-attachments bucket
-- These policies control who can upload, read, and delete files

-- Policy: Allow authenticated users to upload files
DROP POLICY IF EXISTS "Allow authenticated users to upload account attachments" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload account attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'account-attachments' AND
  (storage.foldername(name))[1] IS NOT NULL -- Ensure file is in a folder (account_id)
);

-- Policy: Allow authenticated users to read files
DROP POLICY IF EXISTS "Allow authenticated users to read account attachments" ON storage.objects;
CREATE POLICY "Allow authenticated users to read account attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'account-attachments');

-- Policy: Allow users to delete their own uploads
-- Note: This requires checking the account_attachments table to verify ownership
-- For simplicity, we allow all authenticated users to delete (can be restricted later)
DROP POLICY IF EXISTS "Allow authenticated users to delete account attachments" ON storage.objects;
CREATE POLICY "Allow authenticated users to delete account attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'account-attachments');

-- Alternative: More restrictive delete policy (requires checking account_attachments table)
-- This would need to be implemented via a function or trigger
-- For now, the simpler policy above is used

-- Instructions:
-- 1. Go to Supabase Dashboard → Storage
-- 2. Click "New bucket"
-- 3. Name: account-attachments
-- 4. Public: OFF (private)
-- 5. File size limit: 10485760 (10MB) or leave empty
-- 6. Click "Create bucket"
-- 7. Run this SQL file to set up RLS policies

