/**
 * Format date strings without timezone conversion
 * 
 * Since we store dates as date-only strings (YYYY-MM-DD), we need to format them
 * without creating Date objects that would cause timezone conversion.
 * 
 * This ensures dates display exactly as stored, matching LMN's dates.
 */

/**
 * Format a date string (YYYY-MM-DD) to a readable format
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @param {string} format - Format string (default: 'MMM d, yyyy')
 * @returns {string} Formatted date string
 */
export function formatDateString(dateStr, format = 'MMM d, yyyy') {
  if (!dateStr) return null;
  
  // Parse date string directly (YYYY-MM-DD)
  const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) {
    // If not in YYYY-MM-DD format, try to parse it
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    // Extract date components to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return formatDateString(`${year}-${month}-${day}`, format);
  }
  
  const [, year, month, day] = dateMatch;
  const yearNum = parseInt(year);
  const monthNum = parseInt(month);
  const dayNum = parseInt(day);
  
  // Format based on requested format
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthNamesFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  switch (format) {
    case 'MMM d, yyyy':
      return `${monthNames[monthNum - 1]} ${dayNum}, ${yearNum}`;
    case 'MMMM d, yyyy':
      return `${monthNamesFull[monthNum - 1]} ${dayNum}, ${yearNum}`;
    case 'MMM d':
      return `${monthNames[monthNum - 1]} ${dayNum}`;
    case 'yyyy-MM-dd':
      return dateStr; // Already in this format
    case 'MM/dd/yyyy':
      return `${month}/${day}/${year}`;
    default:
      // Default to MMM d, yyyy
      return `${monthNames[monthNum - 1]} ${dayNum}, ${yearNum}`;
  }
}

/**
 * Parse a date string and return date components without timezone conversion
 * @param {string} dateStr - Date string in any format
 * @returns {Object|null} Object with {year, month, day} or null
 */
export function parseDateString(dateStr) {
  if (!dateStr) return null;
  
  // Try YYYY-MM-DD format first
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return {
      year: parseInt(isoMatch[1]),
      month: parseInt(isoMatch[2]),
      day: parseInt(isoMatch[3])
    };
  }
  
  // Try MM/DD/YYYY format
  const mmddyyyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyyMatch) {
    return {
      year: parseInt(mmddyyyyMatch[3]),
      month: parseInt(mmddyyyyMatch[1]),
      day: parseInt(mmddyyyyMatch[2])
    };
  }
  
  // Fallback: try parsing as Date and extract components
  // But use local date methods to avoid timezone conversion
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate()
    };
  }
  
  return null;
}

/**
 * Get year from a date string (YYYY-MM-DD)
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {number|null} Year or null
 */
export function getYearFromDateString(dateStr) {
  if (!dateStr) return null;
  const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    return parseInt(dateMatch[1]);
  }
  // Fallback: try parsing as Date
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.getFullYear();
  }
  return null;
}

/**
 * Compare two date strings (YYYY-MM-DD) for sorting
 * Returns negative if dateA < dateB, positive if dateA > dateB, 0 if equal
 * @param {string} dateA - First date string
 * @param {string} dateB - Second date string
 * @returns {number} Comparison result
 */
export function compareDateStrings(dateA, dateB) {
  // Date strings in YYYY-MM-DD format can be compared directly as strings
  if (!dateA && !dateB) return 0;
  if (!dateA) return -1;
  if (!dateB) return 1;
  
  // Direct string comparison works for YYYY-MM-DD format
  if (dateA < dateB) return -1;
  if (dateA > dateB) return 1;
  return 0;
}

/**
 * Get timestamp for date string (for sorting/comparison)
 * Parses date string as local date to avoid timezone conversion
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {number} Timestamp in milliseconds
 */
export function getDateStringTimestamp(dateStr) {
  if (!dateStr) return 0;
  
  // Parse YYYY-MM-DD directly as local date (not UTC)
  const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    const [, year, month, day] = dateMatch;
    // Create date in local timezone (not UTC) to avoid shifts
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.getTime();
  }
  
  // Fallback: try parsing as Date
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? 0 : date.getTime();
}

