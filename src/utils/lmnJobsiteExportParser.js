/**
 * LMN Jobsite Export Parser
 * Parses the "Jobsite Export.xlsx" file
 */

/**
 * Parse Jobsite Export CSV/XLSX data
 * Accepts either CSV text string or array of arrays (from XLSX)
 * Returns: { jobsites: [], stats: {} }
 */
export function parseJobsiteExport(csvTextOrRows) {
  try {
    // If it's already an array of arrays (from XLSX), use it directly
    // Otherwise, parse CSV text
    const rows = Array.isArray(csvTextOrRows) && Array.isArray(csvTextOrRows[0])
      ? csvTextOrRows
      : parseCSV(csvTextOrRows);
    
    if (!rows || rows.length < 2) {
      return { jobsites: [], stats: { error: 'Empty or invalid file' } };
    }

    const headers = rows[0];
    if (!Array.isArray(headers) || headers.length === 0) {
      return { jobsites: [], stats: { error: 'Invalid file format - no headers found' } };
    }

    // Map column indices
    const colMap = {
      contactId: headers.findIndex(h => h === 'Contact ID'),
      contactName: headers.findIndex(h => h === 'Contact Name'),
      jobsiteId: headers.findIndex(h => h === 'Jobsite ID'),
      jobsiteName: headers.findIndex(h => h === 'Jobsite Name'),
      address1: headers.findIndex(h => h === 'Address 1'),
      address2: headers.findIndex(h => h === 'Address 2'),
      city: headers.findIndex(h => h === 'City'),
      province: headers.findIndex(h => h === 'Province'),
      postalCode: headers.findIndex(h => h === 'Postal Code'),
      country: headers.findIndex(h => h === 'Country'),
      notes: headers.findIndex(h => h === 'Notes')
    };

    const jobsites = [];
    const errors = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      try {
        const contactId = row[colMap.contactId]?.toString().trim();
        const jobsiteId = row[colMap.jobsiteId]?.toString().trim();
        const jobsiteName = row[colMap.jobsiteName]?.toString().trim();
        
        if (!jobsiteId) {
          errors.push(`Row ${i + 1}: Missing Jobsite ID, skipped`);
          continue;
        }

        const jobsite = {
          id: `lmn-jobsite-${jobsiteId}`,
          lmn_jobsite_id: jobsiteId,
          lmn_contact_id: contactId || null,
          contact_id: contactId ? `lmn-contact-${contactId}` : null,
          contact_name: row[colMap.contactName]?.toString().trim() || '',
          name: jobsiteName || row[colMap.jobsiteName]?.toString().trim() || '',
          address_1: row[colMap.address1]?.toString().trim() || '',
          address_2: row[colMap.address2]?.toString().trim() || '',
          city: row[colMap.city]?.toString().trim() || '',
          state: row[colMap.province]?.toString().trim() || '',
          postal_code: row[colMap.postalCode]?.toString().trim() || '',
          country: row[colMap.country]?.toString().trim() || 'Canada',
          notes: row[colMap.notes]?.toString().trim() || '',
          source: 'lmn_jobsite_export',
          created_date: new Date().toISOString()
        };

        jobsites.push(jobsite);
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err.message}`);
      }
    }

    return {
      jobsites,
      stats: {
        total: jobsites.length,
        errors: errors.length > 0 ? errors.slice(0, 10) : null,
        errorsCount: errors.length
      }
    };
  } catch (err) {
    return {
      jobsites: [],
      stats: { error: `Error parsing Jobsite Export: ${err.message}` }
    };
  }
}

/**
 * Detect delimiter (tab vs comma) by analyzing first line
 */
function detectDelimiter(firstLine) {
  if (!firstLine || typeof firstLine !== 'string') return ',';
  
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  
  // If tabs significantly outnumber commas, use tabs
  // Otherwise default to comma (safer for existing files)
  if (tabCount > commaCount * 1.5) {
    return '\t';
  }
  return ',';
}

/**
 * Parse CSV text into array of arrays
 */
function parseCSV(csvText) {
  if (!csvText || typeof csvText !== 'string') {
    return [];
  }

  const lines = csvText.split('\n');
  if (lines.length < 1) return [];

  // Detect delimiter from first non-empty line
  const firstLine = lines.find(line => line.trim());
  const delimiter = firstLine ? detectDelimiter(firstLine) : ',';

  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Use appropriate parser based on delimiter
    const values = delimiter === '\t' 
      ? parseTSVLine(line)
      : parseCSVLine(line);
    if (values.length === 0) continue;
    rows.push(values);
  }
  return rows;
}

/**
 * Parse a TSV (tab-separated) line
 */
function parseTSVLine(line) {
  return line.split('\t').map(val => val.trim());
}

/**
 * Parse a single CSV line, handling quoted fields with commas
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}














