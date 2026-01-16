/**
 * Utility to show toast notification when total_price_with_tax is used as fallback
 * Per Revenue Logic spec R4: Show toast notification once per session when fallback occurs
 */

import toast from 'react-hot-toast';

const SESSION_STORAGE_KEY = 'price_field_fallback_toast_shown';

/**
 * Check if total_price is missing and total_price_with_tax is being used as fallback
 * Shows toast notification once per session if fallback is detected
 * 
 * @param {Object} estimate - Estimate object
 * @returns {boolean} - true if fallback is being used, false otherwise
 */
export function checkPriceFieldFallback(estimate) {
  if (!estimate) return false;
  
  // Check if total_price is missing (null or undefined) and total_price_with_tax exists
  // Note: total_price will always have a value (even if 0), so we only check for null/undefined
  const totalPrice = estimate.total_price;
  const totalPriceWithTax = estimate.total_price_with_tax;
  
  // Only show toast if total_price is truly missing (null or undefined), not if it's 0
  // total_price will always exist (even if 0), so this should never trigger in normal operation
  const isTotalPriceMissing = totalPrice === null || totalPrice === undefined;
  
  // Check if total_price_with_tax has a valid value (not null, undefined, or NaN)
  const hasTotalPriceWithTax = totalPriceWithTax != null && 
    !(typeof totalPriceWithTax === 'number' && isNaN(totalPriceWithTax));
  
  // If fallback is being used (total_price is missing AND total_price_with_tax exists), show toast once per session
  // This should never happen in normal operation since total_price always has a value
  if (isTotalPriceMissing && hasTotalPriceWithTax) {
    showFallbackToastOnce();
    return true;
  }
  
  return false;
}

/**
 * Show toast notification once per session when price field fallback is used
 * Per spec R4: Show notification once per session
 */
function showFallbackToastOnce() {
  // Check if toast has already been shown this session
  const toastShown = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (toastShown === 'true') {
    return;
  }
  
  // Show toast notification
  toast(
    '⚠️ Using total_price_with_tax as fallback (total_price missing)',
    {
      icon: '⚠️',
      duration: 5000,
      style: {
        background: '#fef3c7',
        color: '#92400e',
        border: '1px solid #fbbf24',
      },
    }
  );
  
  // Mark toast as shown for this session
  sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
}

/**
 * Reset the toast notification flag (useful for testing)
 */
export function resetFallbackToastFlag() {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}
