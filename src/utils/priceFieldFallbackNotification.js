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
  
  // Check if total_price is missing/null/zero and total_price_with_tax exists
  const totalPrice = estimate.total_price;
  const totalPriceWithTax = estimate.total_price_with_tax;
  
  // Check if fallback is being used by simulating the || operator behavior
  // Fallback is used when: !total_price && total_price_with_tax
  // This matches: est.total_price || est.total_price_with_tax || 0
  
  // Check if total_price is falsy (null, undefined, 0, '', NaN, false)
  const isTotalPriceFalsy = !totalPrice || 
    (typeof totalPrice === 'number' && (isNaN(totalPrice) || totalPrice === 0)) ||
    (typeof totalPrice === 'string' && totalPrice.trim() === '');
  
  // Check if total_price_with_tax is truthy (has a valid value)
  const hasTotalPriceWithTax = totalPriceWithTax && 
    !(typeof totalPriceWithTax === 'number' && (isNaN(totalPriceWithTax) || totalPriceWithTax === 0)) &&
    !(typeof totalPriceWithTax === 'string' && totalPriceWithTax.trim() === '');
  
  // If fallback is being used (total_price is falsy AND total_price_with_tax is truthy), show toast once per session
  if (isTotalPriceFalsy && hasTotalPriceWithTax) {
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
