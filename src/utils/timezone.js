/**
 * Timezone utilities for Calgary (America/Edmonton)
 * Calgary uses Mountain Time (MST/MDT)
 */

const CALGARY_TIMEZONE = 'America/Edmonton';

/**
 * Get the current date/time in Calgary timezone
 * @returns {Date} Date object representing current time in Calgary
 */
export function getCalgaryDate() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: CALGARY_TIMEZONE }));
}

/**
 * Parse a date string (YYYY-MM-DD) as a date in Calgary timezone
 * This ensures dates are interpreted correctly regardless of user's local timezone
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {Date} Date object representing the date in Calgary timezone
 */
export function parseCalgaryDate(dateString) {
  if (!dateString) return null;
  
  // Parse YYYY-MM-DD format
  const dateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) return null;
  
  const [, year, month, day] = dateMatch;
  
  // Create date string in ISO format with Calgary timezone
  // Use noon to avoid DST issues
  const isoString = `${year}-${month}-${day}T12:00:00`;
  
  // Parse as if it's in Calgary timezone
  // We'll use Intl.DateTimeFormat to convert
  const date = new Date(`${year}-${month}-${day}T00:00:00`);
  
  // Get the date components in Calgary timezone
  const calgaryDate = new Date(date.toLocaleString('en-US', { timeZone: CALGARY_TIMEZONE }));
  
  // Create a new date with the Calgary date components but in local timezone
  // This ensures comparisons work correctly
  return new Date(
    calgaryDate.getFullYear(),
    calgaryDate.getMonth(),
    calgaryDate.getDate()
  );
}

/**
 * Get today's date in Calgary timezone
 * @returns {Date} Date object representing today in Calgary
 */
export function getCalgaryToday() {
  const now = new Date();
  const calgaryString = now.toLocaleString('en-US', { timeZone: CALGARY_TIMEZONE });
  const calgaryDate = new Date(calgaryString);
  return new Date(
    calgaryDate.getFullYear(),
    calgaryDate.getMonth(),
    calgaryDate.getDate()
  );
}

/**
 * Format a date string (YYYY-MM-DD) using Calgary timezone
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @param {string} formatStr - Format string (e.g., 'MMM d', 'MMM d, yyyy')
 * @returns {string} Formatted date string
 */
export function formatCalgaryDate(dateString, formatStr = 'MMM d') {
  if (!dateString) return '';
  
  const date = parseCalgaryDate(dateString);
  if (!date) return '';
  
  // Use date-fns format with the parsed date
  const { format } = require('date-fns');
  return format(date, formatStr);
}

/**
 * Check if a date string represents today in Calgary timezone
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {boolean} True if the date is today in Calgary
 */
export function isCalgaryToday(dateString) {
  if (!dateString) return false;
  
  const taskDate = parseCalgaryDate(dateString);
  const today = getCalgaryToday();
  
  if (!taskDate) return false;
  
  return (
    taskDate.getFullYear() === today.getFullYear() &&
    taskDate.getMonth() === today.getMonth() &&
    taskDate.getDate() === today.getDate()
  );
}

/**
 * Calculate difference in days between today (Calgary) and a date string
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {number} Number of days difference (positive if date is in future, negative if in past)
 */
export function daysDifferenceFromCalgaryToday(dateString) {
  if (!dateString) return 0;
  
  const taskDate = parseCalgaryDate(dateString);
  const today = getCalgaryToday();
  
  if (!taskDate) return 0;
  
  // Calculate difference in milliseconds
  const diffMs = taskDate.getTime() - today.getTime();
  
  // Convert to days
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
