# Testing Task Attachments

## Prerequisites

1. **Run Database Migration**
   - Go to Supabase Dashboard → SQL Editor
   - Copy and paste the contents of `add_task_attachments_schema.sql`
   - Click "Run" to execute

2. **Create Storage Bucket**
   - Go to Supabase Dashboard → Storage
   - Click "New bucket"
   - Name: `task-attachments`
   - Public: OFF (private)
   - File size limit: 10485760 (10MB) or leave empty
   - Click "Create bucket"

3. **Set up RLS Policies** (Optional but recommended)
   - Go to Supabase Dashboard → SQL Editor
   - Copy and paste the RLS policies from `create_task_attachments_bucket.sql`
   - Click "Run" to execute

## Testing Steps

### 1. Open the Application
- Navigate to your dev/staging environment
- Log in with your user account

### 2. Create or Open a Task
- Go to the Tasks page (`/tasks`)
- Either:
  - Click "New Task" to create a new task, OR
  - Click on an existing task to edit it

### 3. Test File Upload
- In the task dialog, click on the **"Files"** tab (should show "Files (0)")
- You should see:
  - A file input field
  - Text saying "Max file size: 10MB"
- Click "Choose File" or click the file input
- Select a test file (e.g., a PDF, image, or document)
- The file should upload automatically

### 4. Verify Upload Success
After uploading, you should see:
- ✅ A success toast notification: "File uploaded"
- ✅ The file appears in the attachments list with:
  - File name
  - File size
  - Uploader email
  - Upload date
  - Download button (download icon)
  - Delete button (trash icon) - only if you're the uploader

### 5. Test File Download
- Click the download icon next to an attachment
- The file should open/download in your browser

### 6. Test File Delete
- Click the trash icon next to an attachment you uploaded
- Confirm the deletion
- The file should disappear from the list
- ✅ A success toast: "File deleted"

### 7. Test Multiple Files
- Upload multiple files to the same task
- All should appear in the list
- Each should be downloadable and deletable

## Troubleshooting

### File Upload Fails
- **Check browser console** for errors
- **Verify storage bucket exists**: Go to Supabase → Storage → Check for `task-attachments` bucket
- **Check file size**: Must be under 10MB
- **Check RLS policies**: Make sure RLS policies are set up correctly

### File Doesn't Appear After Upload
- **Refresh the page** - The query should auto-refresh, but sometimes manual refresh helps
- **Check browser console** for API errors
- **Verify database**: Check `task_attachments` table in Supabase to see if record was created

### Can't Delete File
- **Check if you're the uploader**: Only the user who uploaded can delete
- **Check browser console** for errors
- **Verify RLS policies**: Make sure delete policy is set up

### Storage Errors
- **Check Supabase Storage logs**: Go to Supabase Dashboard → Logs → Storage
- **Verify bucket permissions**: Make sure the bucket allows authenticated users
- **Check file path**: Files should be stored at `task-attachments/{taskId}/{timestamp}-{filename}`

## Expected Behavior

✅ **Working correctly when:**
- Files upload successfully
- Files appear in the list immediately
- Files can be downloaded
- Files can be deleted by the uploader
- File metadata (name, size, date) displays correctly
- Multiple files can be uploaded to the same task
- Files persist after page refresh

❌ **Issues to watch for:**
- Upload fails silently
- Files don't appear after upload
- Can't download files (404 errors)
- Can't delete files
- File size limit not enforced
- Wrong file types accepted/rejected

## Testing Checklist

- [ ] Database migration run successfully
- [ ] Storage bucket created
- [ ] RLS policies set up
- [ ] Can upload a small file (< 1MB)
- [ ] Can upload a larger file (5-10MB)
- [ ] Upload fails for file > 10MB (if limit set)
- [ ] File appears in list after upload
- [ ] Can download uploaded file
- [ ] Can delete own uploaded file
- [ ] Cannot delete other user's file (if applicable)
- [ ] Multiple files can be uploaded
- [ ] Files persist after page refresh
- [ ] File metadata displays correctly

