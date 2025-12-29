/**
 * Import Monday Activities Excel file as interaction logs
 * Everything before "activities to-do" section is imported
 * Uses name matching to link to accounts/contacts
 * 
 * Usage:
 *   node import-monday-activities.js <path-to-excel-file>
 * 
 * Example:
 *   node import-monday-activities.js "monday activities.xlsx"
 * 
 * Requires environment variables:
 *   SUPABASE_URL - Your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Your Supabase service role key
 */

import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Try to load .env file if it exists (for local development)
try {
  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, ''); // Remove quotes
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
  }
} catch (error) {
  // Silently fail if .env doesn't exist or can't be read
}

// Initialize Supabase client
function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase environment variables not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env or environment');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

// Normalize name for matching (lowercase, trim, remove extra spaces)
function normalizeName(name) {
  if (!name) return '';
  return name.toString().toLowerCase().trim().replace(/\s+/g, ' ');
}

// Find account by name (fuzzy matching)
async function findAccountByName(supabase, name) {
  if (!name) return null;
  
  const normalizedName = normalizeName(name);
  
  // Try exact match first
  const { data: exactMatch } = await supabase
    .from('accounts')
    .select('id, name')
    .ilike('name', name.trim())
    .maybeSingle();
  
  if (exactMatch) return exactMatch.id;
  
  // Try normalized match
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name');
  
  if (!accounts) return null;
  
  // Find best match
  for (const account of accounts) {
    if (normalizeName(account.name) === normalizedName) {
      return account.id;
    }
  }
  
  // Try partial match (contains)
  for (const account of accounts) {
    const accountName = normalizeName(account.name);
    if (accountName.includes(normalizedName) || normalizedName.includes(accountName)) {
      console.log(`  ⚠️  Partial match: "${name}" -> "${account.name}"`);
      return account.id;
    }
  }
  
  return null;
}

// Find contact by name (fuzzy matching)
async function findContactByName(supabase, name, accountId = null) {
  if (!name) return null;
  
  const normalizedName = normalizeName(name);
  
  // If account is known, search within that account first
  if (accountId) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, account_id')
      .eq('account_id', accountId);
    
    if (contacts) {
      for (const contact of contacts) {
        if (normalizeName(contact.name) === normalizedName) {
          return contact.id;
        }
      }
    }
  }
  
  // Try exact match
  const { data: exactMatch } = await supabase
    .from('contacts')
    .select('id, name')
    .ilike('name', name.trim())
    .maybeSingle();
  
  if (exactMatch) return exactMatch.id;
  
  // Try normalized match across all contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name');
  
  if (!contacts) return null;
  
  for (const contact of contacts) {
    if (normalizeName(contact.name) === normalizedName) {
      return contact.id;
    }
  }
  
  return null;
}

// Parse date from various formats
function parseDate(dateValue) {
  if (!dateValue) return new Date();
  
  // If it's already a Date object
  if (dateValue instanceof Date) {
    return dateValue;
  }
  
  // If it's a number (Excel serial date)
  if (typeof dateValue === 'number') {
    // Excel serial date: days since 1900-01-01
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + dateValue * 24 * 60 * 60 * 1000);
  }
  
  // Try parsing as string
  const date = new Date(dateValue);
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  return new Date();
}

// Determine interaction type from activity description
function determineInteractionType(description) {
  if (!description) return 'other';
  
  const desc = description.toLowerCase();
  
  if (desc.includes('email') || desc.includes('sent') || desc.includes('replied')) {
    return 'email_sent';
  }
  if (desc.includes('call') || desc.includes('phone')) {
    return 'call';
  }
  if (desc.includes('meeting') || desc.includes('zoom') || desc.includes('teams')) {
    return 'meeting';
  }
  if (desc.includes('linkedin') || desc.includes('linked in')) {
    return 'linkedin';
  }
  if (desc.includes('note') || desc.includes('note')) {
    return 'note';
  }
  
  return 'other';
}

// Extract potential account/contact names from activity text
// Looks for patterns like "with [Name]", "to [Name]", "[Name] -", etc.
function extractNamesFromText(text, accounts, contacts) {
  if (!text) return { accountId: null, contactId: null };
  
  const textLower = text.toLowerCase();
  const accountMatches = [];
  const contactMatches = [];
  
  // Ensure accounts and contacts are arrays
  const accountsList = Array.isArray(accounts) ? accounts : [];
  const contactsList = Array.isArray(contacts) ? contacts : [];
  
  // Extract potential company name from patterns like "Company - Activity" or "Company:" 
  let potentialCompanyName = null;
  const dashMatch = text.match(/^([^-]+?)\s*-\s*/);
  if (dashMatch) {
    potentialCompanyName = dashMatch[1].trim();
  } else {
    const colonMatch = text.match(/^([^:]+?):/);
    if (colonMatch) {
      potentialCompanyName = colonMatch[1].trim();
    }
  }
  
  // Try to find account names in the text
  for (const account of accountsList) {
    const accountName = normalizeName(account.name);
    if (accountName.length < 3) continue; // Skip very short names
    
    let matchFound = false;
    let matchQuality = 0;
    
    // Check if full account name appears in text
    if (textLower.includes(accountName)) {
      matchFound = true;
      matchQuality = accountName.length + 20; // Full match gets high score
    }
    // Check if account name words appear in text (whole word match)
    else {
      const nameWords = accountName.split(' ').filter(w => w.length > 2);
      if (nameWords.length > 0) {
        const allWordsMatch = nameWords.every(word => {
          const wordPattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          return wordPattern.test(text);
        });
        if (allWordsMatch) {
          matchFound = true;
          matchQuality = accountName.length + 10; // Partial match
        }
      }
    }
    
    // Special handling for potential company name extracted from "Company - Activity" pattern
    if (potentialCompanyName) {
      const potentialNormalized = normalizeName(potentialCompanyName);
      const accountNameWords = accountName.split(' ');
      const potentialWords = potentialNormalized.split(' ');
      
      // Check if potential name matches first word(s) of account name
      if (accountNameWords.length > 0 && potentialWords.length > 0) {
        const firstWordMatch = accountNameWords[0] === potentialWords[0];
        const multipleWordsMatch = potentialWords.every((word, idx) => 
          accountNameWords[idx] === word
        );
        
        if (firstWordMatch || multipleWordsMatch) {
          matchFound = true;
          // Higher quality if more words match
          matchQuality = Math.max(matchQuality, potentialNormalized.length + (multipleWordsMatch ? 15 : 5));
        }
      }
    }
    
    if (matchFound) {
      accountMatches.push({ account, quality: matchQuality });
    }
  }
  
  // Try to find contact names in the text
  for (const contact of contactsList) {
    const contactName = normalizeName(contact.name);
    if (contactName.length < 3) continue; // Skip very short names
    
    // Check if contact name appears in text
    const nameWords = contactName.split(' ');
    const namePattern = new RegExp(`\\b${nameWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')}\\b`, 'i');
    
    if (namePattern.test(text)) {
      const matchQuality = contactName.length + (textLower.includes(contactName) ? 10 : 0);
      contactMatches.push({ contact, quality: matchQuality });
    }
  }
  
  // Sort by quality and pick the best match
  // Prefer longer/more specific account names when quality is similar
  accountMatches.sort((a, b) => {
    const qualityDiff = b.quality - a.quality;
    if (Math.abs(qualityDiff) < 5) {
      // If quality is similar, prefer longer name (more specific)
      return b.account.name.length - a.account.name.length;
    }
    return qualityDiff;
  });
  contactMatches.sort((a, b) => b.quality - a.quality);
  
  const bestAccount = accountMatches.length > 0 ? accountMatches[0].account : null;
  const bestContact = contactMatches.length > 0 ? contactMatches[0].contact : null;
  
  // If we found a contact, try to get its account_id
  let accountId = bestAccount?.id || null;
  let contactId = bestContact?.id || null;
  
  // If contact has an account_id, prefer that over standalone account match
  if (bestContact?.account_id) {
    accountId = bestContact.account_id;
  }
  
  return { accountId, contactId };
}

// Main import function
async function importMondayActivities(filePath) {
  console.log(`📖 Reading Excel file: ${filePath}`);
  
  const workbook = XLSX.readFile(filePath);
  const supabase = getSupabase();
  
  // Get all accounts and contacts for matching
  console.log('📋 Loading accounts and contacts...');
  const { data: accounts } = await supabase.from('accounts').select('id, name');
  const { data: contacts } = await supabase.from('contacts').select('id, name, account_id');
  
  console.log(`  Found ${accounts?.length || 0} accounts and ${contacts?.length || 0} contacts`);
  
  let totalImported = 0;
  let totalSkipped = 0;
  let errors = [];
  
  // Process each sheet
  for (const sheetName of workbook.SheetNames) {
    console.log(`\n📄 Processing sheet: ${sheetName}`);
    
    const worksheet = workbook.Sheets[sheetName];
    
    // Try to read with header row at index 4 (where actual headers are in Monday export)
    // First try with header row 4
    let data = XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: false, header: 4, range: 4 });
    
    // Check if we got proper column names (Monday format)
    const hasMondayFormat = data.length > 0 && (
      'ActivityDate' in data[0] || 
      'link to Accounts' in data[0] || 
      'link to Contacts' in data[0]
    );
    
    if (!hasMondayFormat) {
      // Fall back to default parsing
      data = XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: false });
    }
    
    if (data.length === 0) {
      console.log('  ⚠️  Sheet is empty, skipping');
      continue;
    }
    
    // Find where "activities to-do" section starts
    let stopIndex = data.length;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowValues = Object.values(row).map(v => String(v || '').toLowerCase());
      const rowText = rowValues.join(' ');
      
      if (rowText.includes('activities to-do') || rowText.includes('activities to do')) {
        stopIndex = i;
        console.log(`  🛑 Found "activities to-do" section at row ${i + 1}, stopping import`);
        break;
      }
    }
    
    const rowsToProcess = data.slice(0, stopIndex);
    console.log(`  Processing ${rowsToProcess.length} rows (before "activities to-do" section)`);
    
    // Get column names
    const firstRow = rowsToProcess[0];
    const columns = Object.keys(firstRow);
    
    console.log(`  Columns found: ${columns.join(', ')}`);
    
    // Map columns - prioritize Monday.com format columns
    const dateCol = columns.find(c => 
      c === 'ActivityDate' || 
      c.toLowerCase().includes('activitydate') ||
      c.toLowerCase().includes('date')
    );
    const accountCol = columns.find(c => 
      c === 'link to Accounts' ||
      c.toLowerCase().includes('link to accounts') ||
      c.toLowerCase().includes('account') && !c.toLowerCase().includes('activity')
    );
    const contactCol = columns.find(c => 
      c === 'link to Contacts' ||
      c.toLowerCase().includes('link to contacts') ||
      (c.toLowerCase().includes('contact') && !c.toLowerCase().includes('account'))
    );
    const activityCol = columns.find(c => 
      c === 'Name' ||
      c.toLowerCase() === 'name' ||
      c.toLowerCase().includes('activity') && !c.toLowerCase().includes('type') && !c.toLowerCase().includes('date')
    );
    const typeCol = columns.find(c => 
      c === 'Activity Type' ||
      c.toLowerCase().includes('activity type') ||
      c.toLowerCase().includes('type') && !c.toLowerCase().includes('date')
    );
    
    console.log(`  Mapped columns:`);
    console.log(`    Date: ${dateCol || 'NOT FOUND'}`);
    console.log(`    Account: ${accountCol || 'NOT FOUND'}`);
    console.log(`    Contact: ${contactCol || 'NOT FOUND'}`);
    console.log(`    Activity: ${activityCol || 'NOT FOUND'}`);
    console.log(`    Type: ${typeCol || 'NOT FOUND'}`);
    
    // Process each row (rowsToProcess already has the data, no need to skip header again if using Monday format)
    // If we're using Monday format, the data is already clean. Otherwise, skip the header row.
    const dataRows = hasMondayFormat ? rowsToProcess : (rowsToProcess.length > 0 && Object.keys(rowsToProcess[0]).some(k => k.toLowerCase().includes('date') || k.toLowerCase().includes('account')) ? rowsToProcess : rowsToProcess.slice(1));
    
    // If we still can't find columns, try using the first non-empty column as activity
    let finalActivityCol = activityCol;
    if (!finalActivityCol) {
      // Try to find the first column with substantial data
      for (const col of columns) {
        const sampleValues = dataRows.slice(0, 10).map(r => String(r[col] || '')).filter(v => v.length > 10);
        if (sampleValues.length > 3) {
          finalActivityCol = col;
          console.log(`  🔍 Using column "${col}" as activity (detected from data)`);
          break;
        }
      }
    }
    
    if (!finalActivityCol) {
      console.log('  ⚠️  Could not identify activity column, skipping sheet');
      continue;
    }
    
    // Process each row
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      // Skip empty rows
      const hasData = Object.values(row).some(v => v !== null && v !== undefined && String(v).trim() !== '');
      if (!hasData) continue;
      
      try {
        // Extract data
        const dateValue = dateCol ? row[dateCol] : null;
        const accountName = accountCol ? row[accountCol] : null;
        const contactName = contactCol ? row[contactCol] : null;
        const activity = finalActivityCol ? row[finalActivityCol] : null;
        const typeValue = typeCol ? row[typeCol] : null;
        
        // Skip if no activity/description
        if (!activity || String(activity).trim() === '') {
          continue;
        }
        
        // Parse date - ActivityDate is in YYYY-MM-DD format
        let interactionDate = parseDate(dateValue);
        
        // If dateValue looks like YYYY-MM-DD, parse it directly
        if (dateValue && typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
          const dateParts = dateValue.split(' ')[0].split('-');
          if (dateParts.length === 3) {
            const year = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1; // JS months are 0-indexed
            const day = parseInt(dateParts[2], 10);
            interactionDate = new Date(year, month, day);
          }
        }
        
        // Find account from explicit column or extract from activity text
        let accountId = null;
        if (accountName) {
          accountId = await findAccountByName(supabase, accountName);
          if (!accountId) {
            console.log(`  ⚠️  Row ${i + 1}: Account not found: "${accountName}"`);
          }
        }
        
        // Find contact from explicit column or extract from activity text
        let contactId = null;
        if (contactName) {
          contactId = await findContactByName(supabase, contactName, accountId);
          if (!contactId && contactName) {
            console.log(`  ⚠️  Row ${i + 1}: Contact not found: "${contactName}"`);
          }
        }
        
              // If we didn't find account/contact from columns, try extracting from activity text
        if ((!accountId && !contactId) && activity) {
          const extracted = extractNamesFromText(activity, accounts || [], contacts || []);
          if (extracted.accountId && !accountId) {
            accountId = extracted.accountId;
            console.log(`  ✓ Row ${i + 1}: Found account in activity text`);
          }
          if (extracted.contactId && !contactId) {
            contactId = extracted.contactId;
            // If contact has an account_id, use that
            const contactsList = Array.isArray(contacts) ? contacts : [];
            const contact = contactsList.find(c => c.id === contactId);
            if (contact?.account_id && !accountId) {
              accountId = contact.account_id;
            }
            console.log(`  ✓ Row ${i + 1}: Found contact in activity text`);
          }
        }
        
        // Determine interaction type
        const interactionType = typeValue 
          ? typeValue.toLowerCase().replace(/\s+/g, '_')
          : determineInteractionType(activity);
        
        // Create interaction
        const interactionData = {
          account_id: accountId,
          contact_id: contactId,
          type: interactionType,
          subject: activity.substring(0, 200), // Limit subject length
          content: activity,
          direction: 'outbound', // Default to outbound
          sentiment: 'neutral',
          interaction_date: interactionDate.toISOString(),
          logged_by: 'import_script',
          tags: accountName ? [accountName] : [],
          metadata: {
            imported_from: 'monday_activities',
            sheet_name: sheetName,
            row_number: i + 1,
            original_data: row
          }
        };
        
        const { data: interaction, error } = await supabase
          .from('interactions')
          .insert(interactionData)
          .select()
          .single();
        
        if (error) {
          console.error(`  ❌ Row ${i + 1}: Error creating interaction:`, error.message);
          errors.push({ row: i + 1, error: error.message, data: row });
          totalSkipped++;
        } else {
          totalImported++;
          if (totalImported % 10 === 0) {
            process.stdout.write(`  ✓ Imported ${totalImported} interactions...\r`);
          }
        }
        
        // Update account's last_interaction_date if account found
        if (accountId) {
          await supabase
            .from('accounts')
            .update({ 
              last_interaction_date: interactionDate.toISOString().split('T')[0],
              updated_at: new Date().toISOString()
            })
            .eq('id', accountId);
        }
        
      } catch (error) {
        console.error(`  ❌ Row ${i + 1}: Unexpected error:`, error.message);
        errors.push({ row: i + 1, error: error.message, data: row });
        totalSkipped++;
      }
    }
  }
  
  console.log(`\n\n✅ Import complete!`);
  console.log(`  ✓ Imported: ${totalImported} interactions`);
  console.log(`  ⚠️  Skipped: ${totalSkipped} rows`);
  
  if (errors.length > 0) {
    console.log(`\n❌ Errors (${errors.length}):`);
    errors.slice(0, 10).forEach(err => {
      console.log(`  Row ${err.row}: ${err.error}`);
    });
    if (errors.length > 10) {
      console.log(`  ... and ${errors.length - 10} more errors`);
    }
  }
}

// Run the import
const filePath = process.argv[2] || 'monday activities.xlsx';

if (!filePath) {
  console.error('Usage: node import-monday-activities.js <path-to-excel-file>');
  process.exit(1);
}

importMondayActivities(filePath)
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

