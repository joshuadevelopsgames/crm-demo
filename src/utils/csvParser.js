/**
 * CSV Parser for Estimate Data
 * Parses the "Estimate Test - Sheet1.csv" file
 */

/**
 * Parse CSV text into array of objects
 * Handles quoted fields with commas properly
 */
export function parseCSV(csvText) {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];

  // Parse header row
  const headers = parseCSVLine(lines[0]);
  
  // Parse data rows
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    if (values.length === 0) continue;
    
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    data.push(row);
  }
  
  return data;
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
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
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

/**
 * Parse currency string to number
 * Handles formats like "$58,501.00" or "$58,501"
 */
export function parseCurrency(str) {
  if (!str) return 0;
  const cleaned = str.toString().replace(/[\$,]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Parse date string
 * Handles MM/DD/YYYY format from the CSV
 */
export function parseDate(dateStr) {
  if (!dateStr) return null;
  try {
    // Handle MM/DD/YYYY format
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const month = parseInt(parts[0]);
      const day = parseInt(parts[1]);
      const year = parseInt(parts[2]);
      return new Date(year, month - 1, day);
    }
    return new Date(dateStr);
  } catch (e) {
    return null;
  }
}

/**
 * Map status from CSV to our system
 * Maps various statuses to: won, lost, or pending
 */
export function mapStatus(status, pipelineStatus) {
  // Check pipeline status first (more reliable)
  const pipeline = (pipelineStatus || '').toLowerCase();
  if (pipeline === 'sold') return 'won';
  if (pipeline === 'lost') return 'lost';
  if (pipeline === 'pending') return 'pending';
  
  // Fall back to Status field
  const stat = (status || '').toLowerCase();
  
  // Won statuses
  if (
    stat.includes('contract signed') ||
    stat.includes('contract award') ||
    stat.includes('sold') ||
    stat.includes('email contract') ||
    stat.includes('verbal contract')
  ) {
    return 'won';
  }
  
  // Lost statuses
  if (stat.includes('lost') || stat.includes('estimate lost')) {
    return 'lost';
  }
  
  // Pending/In Progress
  if (
    stat.includes('in progress') ||
    stat.includes('pending') ||
    stat === ''
  ) {
    return 'pending';
  }
  
  // Default to pending
  return 'pending';
}

/**
 * Process raw CSV data into estimate objects for the system
 */
export function processEstimateData(rawData) {
  const estimates = [];
  
  rawData.forEach((row, index) => {
    // Skip if no contact name (invalid row)
    if (!row['Contact Name'] || !row['Contact Name'].trim()) {
      return;
    }
    
    const status = mapStatus(row['Status'], row['Sales Pipeline Status']);
    const estimateDate = parseDate(row['Estimate Date']);
    const closeDate = parseDate(row['Estimate Close Date']);
    const totalPrice = parseCurrency(row['Total Price']);
    
    // Skip if no valid data
    if (!estimateDate || totalPrice === 0) {
      return;
    }
    
    estimates.push({
      id: row['Estimate ID'] || `est-${index}`,
      account_name: row['Contact Name'].trim(),
      estimate_number: row['Estimate ID'] || '',
      estimate_date: estimateDate.toISOString().split('T')[0],
      close_date: closeDate ? closeDate.toISOString().split('T')[0] : null,
      description: row['Project Name'] || 'No description',
      total_amount: totalPrice,
      status: status,
      won_date: status === 'won' && closeDate ? closeDate.toISOString().split('T')[0] : null,
      lost_date: status === 'lost' && closeDate ? closeDate.toISOString().split('T')[0] : null,
      salesperson: row['Salesperson'] || '',
      estimator: row['Estimator'] || '',
      division: row['Division'] || '',
      confidence_level: row['Confidence Level'] || '',
      raw_status: row['Status'] || '',
      pipeline_status: row['Sales Pipeline Status'] || ''
    });
  });
  
  return estimates;
}
