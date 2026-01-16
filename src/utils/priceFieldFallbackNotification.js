/**
 * Utility to show toast notification when total_price_with_tax is used as fallback
 * Per Revenue Logic spec R4: Show toast notification once per session when fallback occurs
 * 
 * Serverless-safe: Only imports toast in browser environment, safe to call in serverless functions
 */

const SESSION_STORAGE_KEY = 'price_field_fallback_toast_shown';

// Lazy load toast only in browser environment (serverless-safe)
let toastPromise = null;
function getToast() {
  // Only try to import toast in browser environment
  if (typeof window === 'undefined') {
    return Promise.resolve(null);
  }
  
  // Lazy load toast on first use
  if (!toastPromise) {
    toastPromise = import('react-hot-toast')
      .then(module => module.default)
      .catch(() => null); // Return null if import fails (serverless environment)
  }
  
  return toastPromise;
}

/**
 * Check if total_price is missing and total_price_with_tax is being used as fallback
 * Shows toast notification once per session if fallback is detected (browser only)
 * 
 * Serverless-safe: Returns boolean without showing toast in serverless environment
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
  
  // If fallback is being used (total_price is missing AND total_price_with_tax exists)
  // This should never happen in normal operation since total_price always has a value
  if (isTotalPriceMissing && hasTotalPriceWithTax) {
    // Only show toast in browser environment (not in serverless)
    if (typeof window !== 'undefined') {
      showFallbackToastOnce();
    }
    return true;
  }
  
  return false;
}

/**
 * Show toast notification once per session when price field fallback is used
 * Per spec R4: Show notification once per session
 * Only works in browser environment (serverless-safe)
 */
async function showFallbackToastOnce() {
  // Only show toast in browser environment
  if (typeof window === 'undefined') return;
  
  // Check if toast has already been shown this session
  const toastShown = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (toastShown === 'true') {
    return;
  }
  
  // Lazy load toast (only in browser)
  const toast = await getToast();
  if (!toast) {
    // Toast not available (serverless environment) - skip
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
