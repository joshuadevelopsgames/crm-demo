-- Create storage bucket for task attachments
-- Run this in Supabase SQL Editor if you prefer SQL over the UI

-- Note: Storage buckets are typically created via the Supabase Dashboard UI
-- This SQL is provided as a reference, but the UI method is recommended

-- If you need to create via SQL, you would use:
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'task-attachments',
--   'task-attachments',
--   false,  -- Private bucket (requires authentication)
--   10485760,  -- 10MB in bytes
--   NULL  -- Allow all MIME types (or specify array like ARRAY['image/*', 'application/pdf'])
-- );

-- However, the recommended approach is to use the Supabase Dashboard:
-- 1. Go to Storage in the left sidebar
-- 2. Click "New bucket"
-- 3. Name: task-attachments
-- 4. Public: OFF (private)
-- 5. File size limit: 10MB
-- 6. Create bucket

-- After creating the bucket, you may want to set up RLS policies:

-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload task attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-attachments');

-- Allow authenticated users to read files
CREATE POLICY "Allow authenticated users to read task attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'task-attachments');

-- Allow authenticated users to delete their own files
-- (This requires checking the metadata or using a custom function)
CREATE POLICY "Allow authenticated users to delete task attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'task-attachments');

