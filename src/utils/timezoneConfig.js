/**
 * Application Timezone Configuration
 * 
 * This file defines the timezone used throughout the application for date calculations.
 * All "start of day" calculations use this timezone to determine when a day begins.
 * 
 * To change the timezone, update the TIMEZONE_OFFSET_HOURS constant below.
 * 
 * Current setting: GMT-7 (Pacific Time, no DST adjustment)
 */

// Timezone offset in hours from UTC
// GMT-7 = -7 hours from UTC (7 hours behind UTC)
export const TIMEZONE_OFFSET_HOURS = -7;

// Timezone name for display/logging
export const TIMEZONE_NAME = 'GMT-7';

/**
 * Get the start of day in the application timezone (GMT-7)
 * 
 * This function determines what "today" means in GMT-7, then returns the start of that day.
 * 
 * Example: If current UTC time is 2024-01-15 06:00:00 UTC:
 * - GMT-7 time would be 2024-01-14 23:00:00 (previous day)
 * - Start of day in GMT-7 would be 2024-01-14 00:00:00 GMT-7 = 2024-01-14 07:00:00 UTC
 * 
 * @param {Date} date - Date to get start of day for (defaults to now)
 * @returns {Date} Date set to 00:00:00 in application timezone (returned as UTC Date object)
 */
export function getStartOfDayInTimezone(date = new Date()) {
  // Get current time in UTC
  const now = date instanceof Date ? date : new Date(date);
  const utcTime = now.getTime();
  
  // Convert to GMT-7 by subtracting offset (GMT-7 is 7 hours behind UTC)
  const gmt7Time = utcTime - (TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000);
  const gmt7Date = new Date(gmt7Time);
  
  // Get date components in GMT-7
  const year = gmt7Date.getUTCFullYear();
  const month = gmt7Date.getUTCMonth();
  const day = gmt7Date.getUTCDate();
  
  // Create start of day in GMT-7 (00:00:00 GMT-7)
  // This is represented as a UTC Date object where the UTC time = 07:00:00 UTC
  // (because GMT-7 midnight = UTC 07:00)
  const startOfDayGMT7 = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  // Adjust back to UTC representation: midnight GMT-7 = 07:00 UTC
  const offsetMs = TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000;
  const startOfDayUTC = new Date(startOfDayGMT7.getTime() - offsetMs);
  
  return startOfDayUTC;
}

/**
 * Get today's date at start of day in application timezone
 * @returns {Date} Today at 00:00:00 in application timezone
 */
export function getTodayStartOfDay() {
  return getStartOfDayInTimezone(new Date());
}

/**
 * Convert a date to start of day in application timezone
 * This is the primary function to use for date normalization throughout the app
 * Replaces date-fns startOfDay() to ensure consistent timezone handling
 * 
 * @param {Date|string} date - Date to normalize
 * @returns {Date} Date set to 00:00:00 in application timezone (as UTC Date object)
 */
export function normalizeToStartOfDay(date) {
  const dateObj = date instanceof Date ? date : new Date(date);
  return getStartOfDayInTimezone(dateObj);
}

