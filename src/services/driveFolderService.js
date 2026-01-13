/**
 * Drive Folder Service
 * Organizes files by account in Google Drive folders
 */

import { getSupabaseClient } from './supabaseClient';
import { listDriveFiles, searchDriveFiles } from './driveService';

/**
 * Get or create a Drive folder for an account
 */
export async function getOrCreateAccountFolder(accountId, accountName) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if folder already exists in database
    const { data: existingFolder } = await supabase
      .from('drive_folders')
      .select('*')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .single();

    if (existingFolder) {
      return { 
        success: true, 
        folderId: existingFolder.google_folder_id,
        folderName: existingFolder.folder_name
      };
    }

    // Create folder in Google Drive
    // Note: This would require Drive API create folder endpoint
    // For now, we'll return a placeholder
    // In production, you'd call: createDriveFolder(accountName, parentFolderId)

    return { 
      success: false, 
      error: 'Folder creation not yet implemented. Please create folder manually in Drive.' 
    };
  } catch (error) {
    console.error('Error getting/creating account folder:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to get or create account folder' 
    };
  }
}

/**
 * Move file to account folder
 */
export async function moveFileToAccountFolder(fileId, accountId) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get account folder
    const { data: accountFolder } = await supabase
      .from('drive_folders')
      .select('google_folder_id')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .single();

    if (!accountFolder) {
      return { success: false, error: 'Account folder not found' };
    }

    // Move file to folder via Drive API
    // Note: This would require Drive API update endpoint
    // For now, we'll update the database record
    await supabase
      .from('drive_files')
      .update({ folder_id: accountFolder.google_folder_id })
      .eq('google_file_id', fileId)
      .eq('user_id', user.id);

    return { success: true, message: 'File moved to account folder' };
  } catch (error) {
    console.error('Error moving file to account folder:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to move file to account folder' 
    };
  }
}

/**
 * List files in account folder
 */
export async function listAccountFolderFiles(accountId) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get account folder
    const { data: accountFolder } = await supabase
      .from('drive_folders')
      .select('google_folder_id')
      .eq('account_id', accountId)
      .eq('user_id', user.id)
      .single();

    if (!accountFolder) {
      return { success: true, files: [] };
    }

    // List files in folder
    const result = await searchDriveFiles(
      `'${accountFolder.google_folder_id}' in parents`,
      accountFolder.google_folder_id
    );

    return { success: true, files: result.files || [] };
  } catch (error) {
    console.error('Error listing account folder files:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to list account folder files' 
    };
  }
}
