import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, ChevronDown, ChevronUp, Info, Copy, Check, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCurrentYear } from '@/contexts/TestModeContext';
import { detectContractTypo } from '@/utils/revenueSegmentCalculator';
import { format } from 'date-fns';

/**
 * Calculate contract duration in months between two dates
 * For exactly 12-month contracts (same day, one year apart), returns 12, not 13
 * Example: Apr 15, 2025 → Apr 15, 2026 = 12 months (1 year)
 * Example: Oct 1, 2024 → Sept 30, 2025 = 12 months (1 year)
 * @param {Date} startDate - Contract start date
 * @param {Date} endDate - Contract end date
 * @returns {number} - Duration in months
 */
function calculateDurationMonths(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Calculate year and month differences
  const yearDiff = end.getFullYear() - start.getFullYear();
  const monthDiff = end.getMonth() - start.getMonth();
  const dayDiff = end.getDate() - start.getDate();
  
  // Total months = years * 12 + months
  let totalMonths = yearDiff * 12 + monthDiff;
  
  // Only add 1 month if the end date is AFTER the start day (not same day)
  // This prevents exact 12-month contracts from being counted as 13 months
  // Example: Apr 15, 2025 → Apr 15, 2026:
  //   yearDiff = 1, monthDiff = 0, dayDiff = 0
  //   totalMonths = 12 + 0 = 12 (correct, not 13)
  // Example: Oct 1, 2024 → Sept 30, 2025:
  //   yearDiff = 1, monthDiff = -1, dayDiff = 29
  //   totalMonths = 12 + (-1) = 11
  //   Since dayDiff > 0 (not same day), add 1 → 12 months (correct)
  if (dayDiff > 0) {
    totalMonths += 1; // Include the end month only if end day is after start day
  }
  // If dayDiff === 0 (same day), don't add 1 - it's exactly N*12 months
  
  return totalMonths;
}

/**
 * Determine number of contract years based on duration in months
 * Rules:
 * - duration_months ≤ 12 → years_count = 1
 * - 12 < duration_months ≤ 24 → years_count = 2
 * - 24 < duration_months ≤ 36 → years_count = 3
 * - Exact multiples of 12 do NOT round up (24 months = 2 years, not 3)
 * - Otherwise: ceil(duration_months / 12)
 * @param {number} durationMonths - Duration in months
 * @returns {number} - Number of contract years
 */
function getContractYears(durationMonths) {
  if (durationMonths <= 12) return 1;
  if (durationMonths <= 24) return 2;
  if (durationMonths <= 36) return 3;
  // For longer contracts, use ceil but exact multiples of 12 don't round up
  if (durationMonths % 12 === 0) {
    return durationMonths / 12;
  }
  return Math.ceil(durationMonths / 12);
}

/**
 * Get the year an estimate applies to and its allocated value for the current year
 * Per spec R2-R9: Uses year determination priority and contract-year allocation logic
 * @param {Object} estimate - Estimate object
 * @param {number} currentYear - Current year (e.g., 2024)
 * @returns {Object|null} - { appliesToCurrentYear: boolean, value: number, determinationMethod: string } or null if no valid date
 */
function getEstimateYearData(estimate, currentYear) {
  // Per spec R2: Year determination priority: estimate_close_date → contract_start → estimate_date → created_date
  const estimateCloseDate = estimate.estimate_close_date ? new Date(estimate.estimate_close_date) : null;
  const contractStart = estimate.contract_start ? new Date(estimate.contract_start) : null;
  const contractEnd = estimate.contract_end ? new Date(estimate.contract_end) : null;
  const estimateDate = estimate.estimate_date ? new Date(estimate.estimate_date) : null;
  const createdDate = estimate.created_date ? new Date(estimate.created_date) : null;
  
  // Per spec R3-R5: Price field selection with fallback
  const totalPriceWithTax = parseFloat(estimate.total_price_with_tax);
  const totalPriceNoTax = parseFloat(estimate.total_price);
  let totalPrice;
  if (isNaN(totalPriceWithTax) || totalPriceWithTax === 0) {
    if (totalPriceNoTax && totalPriceNoTax > 0) {
      totalPrice = totalPriceNoTax;
    } else {
      // Per spec R5: Both missing/zero → exclude
      return null;
    }
  } else {
    totalPrice = totalPriceWithTax;
  }
  
  // Per spec R2: Determine year using priority order
  let yearDeterminationDate = null;
  let yearSource = null;
  if (estimateCloseDate && !isNaN(estimateCloseDate.getTime())) {
    yearDeterminationDate = estimateCloseDate;
    yearSource = 'estimate_close_date';
  } else if (contractStart && !isNaN(contractStart.getTime())) {
    yearDeterminationDate = contractStart;
    yearSource = 'contract_start';
  } else if (estimateDate && !isNaN(estimateDate.getTime())) {
    yearDeterminationDate = estimateDate;
    yearSource = 'estimate_date';
  } else if (createdDate && !isNaN(createdDate.getTime())) {
    yearDeterminationDate = createdDate;
    yearSource = 'created_date';
  }
  
  if (!yearDeterminationDate) {
    // Per spec R22: Every estimate has at least one date, but handle gracefully
    return null;
  }
  
  // Per spec R9: Multi-year contracts allocate to sequential calendar years starting from contract_start
  // If we have both contract_start and contract_end, use contract allocation (not determination year)
  if (contractStart && !isNaN(contractStart.getTime()) && contractEnd && !isNaN(contractEnd.getTime())) {
    const startYear = contractStart.getFullYear();
    
    // Per spec R6-R7: Calculate duration and contract years
    const durationMonths = calculateDurationMonths(contractStart, contractEnd);
    if (durationMonths <= 0) return null;
    
    const yearsCount = getContractYears(durationMonths);
    
    // Per spec R9: Allocate to sequential calendar years starting from contract_start
    const yearsApplied = [];
    for (let i = 0; i < yearsCount; i++) {
      yearsApplied.push(startYear + i);
    }
    
    const appliesToCurrentYear = yearsApplied.includes(currentYear);
    
    // Per spec R8: Annualize revenue
    const annualAmount = totalPrice / yearsCount;
    
    // Build determination method string
    const determinationMethod = yearsCount > 1
      ? `Contract: ${startYear}-${startYear + yearsCount - 1} (${yearsCount} years, ${durationMonths} months, $${annualAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} per year)`
      : `Contract: ${startYear} (1 year, ${durationMonths} months)`;
    
    return {
      appliesToCurrentYear,
      value: appliesToCurrentYear ? annualAmount : 0,
      determinationMethod
    };
  }
  
  // Single-year or no contract dates: use determination year
  const determinationYear = yearDeterminationDate.getFullYear();
  const appliesToCurrentYear = currentYear === determinationYear;
  
  const determinationMethod = yearSource === 'estimate_close_date' 
    ? `Estimate Close Date: ${determinationYear}`
    : yearSource === 'contract_start'
    ? `Contract Start: ${determinationYear}`
    : yearSource === 'estimate_date'
    ? `Estimate Date: ${determinationYear}`
    : `Created Date: ${determinationYear}`;
  
  return {
    appliesToCurrentYear,
    value: appliesToCurrentYear ? totalPrice : 0,
    determinationMethod
  };
}

/**
 * Get readable estimate ID (prefer estimate_number, then lmn_estimate_id, then formatted id)
 */
function getReadableEstimateId(estimate) {
  if (estimate.estimate_number) return estimate.estimate_number;
  if (estimate.lmn_estimate_id) return estimate.lmn_estimate_id;
  if (estimate.id) {
    // If it's a UUID, try to extract a meaningful part or use a short version
    if (estimate.id.includes('-') && estimate.id.length > 20) {
      // It's likely a UUID, use first 8 chars
      return `EST${estimate.id.substring(0, 8).toUpperCase()}`;
    }
    return estimate.id;
  }
  return 'Unknown';
}

// Helper to get current year (respects test mode)
function getCurrentYearForCalculation() {
  try {
    return getCurrentYear();
  } catch (error) {
    // Fallback if context not initialized yet
    if (typeof window !== 'undefined' && window.__testModeGetCurrentYear) {
      return window.__testModeGetCurrentYear();
    }
    return new Date().getFullYear();
  }
}

export default function TotalWork({ estimates = [] }) {
  const currentYear = getCurrentYearForCalculation();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Calculate breakdown for ESTIMATED
  const estimatedBreakdown = useMemo(() => {
    const included = [];
    const excluded = [];
    
    estimates.forEach(est => {
      const yearData = getEstimateYearData(est, currentYear);
      // Use total_price_with_tax consistently
      const totalPrice = parseFloat(est.total_price_with_tax) || 0;
      
        let reason = '';
        
        if (totalPrice === 0) {
          reason = 'Total price is $0';
          excluded.push({ estimate: est, reason, determinationMethod: '' });
          return;
        }
        
        if (!yearData) {
          reason = 'No valid date found (no contract_start, contract_end, or estimate_date)';
          excluded.push({ estimate: est, reason, determinationMethod: '', totalPrice });
          return;
        }
        
        if (yearData.appliesToCurrentYear) {
          included.push({
            estimate: est,
            totalPrice,
            value: yearData.value,
            determinationMethod: yearData.determinationMethod
          });
        } else {
          reason = `Does not apply to ${currentYear}`;
          excluded.push({ estimate: est, reason, determinationMethod: yearData.determinationMethod, totalPrice });
        }
    });
    
    return { included, excluded };
  }, [estimates, currentYear]);
  
  // Calculate breakdown for SOLD
  const soldBreakdown = useMemo(() => {
    const included = [];
    const excluded = [];
    
    estimates
      .filter(est => est.status === 'won')
      .forEach(est => {
        const yearData = getEstimateYearData(est, currentYear);
        // Use total_price_with_tax consistently
        const totalPrice = parseFloat(est.total_price_with_tax) || 0;
        
        let reason = '';
        
        if (totalPrice === 0) {
          reason = 'Total price is $0';
          excluded.push({ estimate: est, reason, determinationMethod: '' });
          return;
        }
        
        if (!yearData) {
          reason = 'No valid date found (no contract_start, contract_end, or estimate_date)';
          excluded.push({ estimate: est, reason, determinationMethod: '', totalPrice });
          return;
        }
        
        if (yearData.appliesToCurrentYear) {
          included.push({
            estimate: est,
            totalPrice,
            value: yearData.value,
            determinationMethod: yearData.determinationMethod
          });
        } else {
          reason = `Does not apply to ${currentYear}`;
          excluded.push({ estimate: est, reason, determinationMethod: yearData.determinationMethod, totalPrice });
        }
      });
    
    return { included, excluded };
  }, [estimates, currentYear]);
  
  // Calculate totals for current year
  const totalEstimated = useMemo(() => {
    return estimatedBreakdown.included.reduce((sum, item) => sum + item.value, 0);
  }, [estimatedBreakdown]);
  
  const totalSold = useMemo(() => {
    return soldBreakdown.included.reduce((sum, item) => sum + item.value, 0);
  }, [soldBreakdown]);
  
  // Detect typo estimates (per spec R24-R27)
  const estimatesWithTypo = useMemo(() => {
    return estimates
      .filter(est => est.contract_start && est.contract_end && est.status?.toLowerCase() === 'won')
      .map(est => {
        const durationMonths = calculateDurationMonths(est.contract_start, est.contract_end);
        const contractYears = getContractYears(durationMonths);
        const hasTypo = detectContractTypo(durationMonths, contractYears);
        
        return {
          ...est,
          durationMonths,
          contractYears,
          hasTypo,
          typoReason: hasTypo 
            ? `Duration (${durationMonths} months) exceeds an exact ${contractYears - 1} year boundary by one month. Possible date entry error.`
            : null
        };
      })
      .filter(est => est.hasTypo);
  }, [estimates]);
  
  // Calculate all-time totals (all estimates regardless of year)
  // Try total_price_with_tax first, fall back to total_price if not available
  const allTimeEstimated = useMemo(() => {
    return estimates.reduce((sum, est) => {
      const totalPrice = parseFloat(est.total_price_with_tax) || parseFloat(est.total_price) || 0;
      return sum + totalPrice;
    }, 0);
  }, [estimates]);
  
  const allTimeSold = useMemo(() => {
    return estimates
      .filter(est => est.status && est.status.toLowerCase() === 'won')
      .reduce((sum, est) => {
        const totalPrice = parseFloat(est.total_price_with_tax) || parseFloat(est.total_price) || 0;
        return sum + totalPrice;
      }, 0);
  }, [estimates]);
  
  // Calculate sold percentage
  const soldPercentage = totalEstimated > 0 
    ? Math.round((totalSold / totalEstimated) * 100) 
    : 0;
  
  const allTimeSoldPercentage = allTimeEstimated > 0
    ? Math.round((allTimeSold / allTimeEstimated) * 100)
    : 0;

  return (
    <>
      {/* Typo Detection Warnings (per spec R24-R27) */}
      {estimatesWithTypo.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20 mb-4">
          <CardHeader>
            <CardTitle className="text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Possible Contract Date Typos ({estimatesWithTypo.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {estimatesWithTypo.map(est => (
                <div key={est.id || est.lmn_estimate_id} className="text-sm">
                  <div className="font-medium text-amber-900 dark:text-amber-200">
                    Estimate {est.estimate_number || est.lmn_estimate_id || est.id}
                  </div>
                  <div className="text-amber-700 dark:text-amber-300">
                    {est.typoReason}
                  </div>
                  <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Start: {format(new Date(est.contract_start), 'MMM d, yyyy')} → 
                    End: {format(new Date(est.contract_end), 'MMM d, yyyy')} 
                    ({est.durationMonths} months, calculated as {est.contractYears} years)
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
            Total Work
          </CardTitle>
          <TrendingUp className="w-5 h-5 text-slate-400 dark:text-slate-500" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400">ESTIMATED VALUE</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-[#ffffff] mt-1">
              ${allTimeEstimated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {estimates.length} total estimate{estimates.length !== 1 ? 's' : ''}
              {totalEstimated !== allTimeEstimated && (
                <span> • {estimatedBreakdown.included.length} for {currentYear}</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400">WON VALUE</p>
            <p className="text-2xl font-semibold text-emerald-600 mt-1">
              ${allTimeSold.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {allTimeEstimated > 0 && (
                <span className="text-base ml-2">({allTimeSoldPercentage}%)</span>
              )}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {estimates.filter(est => est.status && est.status.toLowerCase() === 'won').length} won estimate{estimates.filter(est => est.status && est.status.toLowerCase() === 'won').length !== 1 ? 's' : ''}
              {totalSold !== allTimeSold && (
                <span> • {soldBreakdown.included.length} for {currentYear}</span>
              )}
            </p>
          </div>
          
          {/* Breakdown Section */}
          <div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowBreakdown(!showBreakdown)}
              className="w-full justify-between text-xs text-slate-600 hover:text-slate-900 dark:hover:text-white"
            >
              <span className="flex items-center gap-1">
                <Info className="w-3 h-3" />
                Show calculation breakdown
              </span>
              {showBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            {showBreakdown && (
              <div className="space-y-4 mt-3 pt-3 border-t border-slate-200">
              {/* Copy to Clipboard Button */}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const currentYear = new Date().getFullYear();
                    let text = `Total Work Breakdown - ${currentYear}\n`;
                    text += `Generated: ${new Date().toLocaleString()}\n\n`;
                    
                    text += `ESTIMATED TOTAL: $${totalEstimated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
                    text += `SOLD TOTAL: $${totalSold.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
                    text += `SOLD PERCENTAGE: ${soldPercentage}%\n\n`;
                    
                    text += `=== ESTIMATED BREAKDOWN ===\n\n`;
                    text += `INCLUDED (${estimatedBreakdown.included.length} estimates):\n`;
                    estimatedBreakdown.included.forEach((item, idx) => {
                      text += `${idx + 1}. Estimate ID: ${getReadableEstimateId(item.estimate)}\n`;
                      text += `   Method: ${item.determinationMethod}\n`;
                      text += `   Total Price: $${item.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
                      text += `   Value (assigned to ${currentYear}): $${item.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
                      text += `\n`;
                    });
                    
                    if (estimatedBreakdown.excluded.length > 0) {
                      text += `EXCLUDED (${estimatedBreakdown.excluded.length} estimates):\n`;
                      estimatedBreakdown.excluded.forEach((item, idx) => {
                        text += `${idx + 1}. Estimate ID: ${getReadableEstimateId(item.estimate)}\n`;
                        if (item.determinationMethod) {
                          text += `   Method: ${item.determinationMethod}\n`;
                        }
                        if (item.totalPrice > 0) {
                          text += `   Total Price: $${item.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
                        }
                        text += `   Reason: ${item.reason}\n\n`;
                      });
                    }
                    
                    text += `\n=== SOLD BREAKDOWN (Won Estimates Only) ===\n\n`;
                    text += `INCLUDED (${soldBreakdown.included.length} estimates):\n`;
                    soldBreakdown.included.forEach((item, idx) => {
                      text += `${idx + 1}. Estimate ID: ${getReadableEstimateId(item.estimate)}\n`;
                      text += `   Method: ${item.determinationMethod}\n`;
                      text += `   Total Price: $${item.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
                      text += `   Value (assigned to ${currentYear}): $${item.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
                      text += `\n`;
                    });
                    
                    if (soldBreakdown.excluded.length > 0) {
                      text += `EXCLUDED (${soldBreakdown.excluded.length} estimates):\n`;
                      soldBreakdown.excluded.forEach((item, idx) => {
                        text += `${idx + 1}. Estimate ID: ${getReadableEstimateId(item.estimate)}\n`;
                        if (item.determinationMethod) {
                          text += `   Method: ${item.determinationMethod}\n`;
                        }
                        if (item.totalPrice > 0) {
                          text += `   Total Price: $${item.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
                        }
                        text += `   Reason: ${item.reason}\n\n`;
                      });
                    }
                    
                    try {
                      await navigator.clipboard.writeText(text);
                      setCopied(true);
                      toast.success('✓ Breakdown copied to clipboard');
                      setTimeout(() => setCopied(false), 2000);
                    } catch (err) {
                      console.error('Failed to copy:', err);
                      toast.error('Failed to copy to clipboard');
                    }
                  }}
                  className="text-xs"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 mr-1" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-1" />
                      Copy breakdown to clipboard
                    </>
                  )}
                </Button>
              </div>
              
              {/* ESTIMATED Breakdown */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-[#ffffff] mb-2">ESTIMATED Breakdown</h4>
                <div className="space-y-2">
                  {estimatedBreakdown.included.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Included ({estimatedBreakdown.included.length}):</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {estimatedBreakdown.included.map((item, idx) => (
                          <div key={idx} className="text-xs bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium text-slate-900 dark:text-[#ffffff]">
                                  ID: {getReadableEstimateId(item.estimate)}
                                </p>
                                <p className="text-slate-600 dark:text-slate-400 mt-0.5">{item.determinationMethod}</p>
                                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                                  Total: ${item.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  {item.value !== item.totalPrice && (
                                    <span> → Value: ${item.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">No estimates included</p>
                  )}
                  
                  {estimatedBreakdown.excluded.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Excluded ({estimatedBreakdown.excluded.length}):</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {estimatedBreakdown.excluded.map((item, idx) => (
                          <div key={idx} className="text-xs bg-amber-50 dark:bg-amber-900/20 p-2 rounded border border-amber-200 dark:border-amber-800">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium text-slate-900 dark:text-[#ffffff]">
                                  ID: {getReadableEstimateId(item.estimate)}
                                </p>
                                {item.determinationMethod && (
                                  <p className="text-slate-600 dark:text-slate-400 mt-0.5">{item.determinationMethod}</p>
                                )}
                                {item.totalPrice > 0 && (
                                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                                    Total: ${item.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                )}
                                <p className="text-amber-700 dark:text-amber-400 mt-0.5 font-medium">Reason: {item.reason}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* SOLD Breakdown */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-[#ffffff] mb-2">SOLD Breakdown (Won Estimates Only)</h4>
                <div className="space-y-2">
                  {soldBreakdown.included.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Included ({soldBreakdown.included.length}):</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {soldBreakdown.included.map((item, idx) => (
                          <div key={idx} className="text-xs bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded border border-emerald-200 dark:border-emerald-800">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium text-slate-900 dark:text-[#ffffff]">
                                  ID: {getReadableEstimateId(item.estimate)}
                                </p>
                                <p className="text-slate-600 dark:text-slate-400 mt-0.5">{item.determinationMethod}</p>
                                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                                  Total: ${item.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  {item.value !== item.totalPrice && (
                                    <span> → Value: ${item.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No won estimates included</p>
                  )}
                  
                  {soldBreakdown.excluded.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Excluded ({soldBreakdown.excluded.length}):</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {soldBreakdown.excluded.map((item, idx) => (
                          <div key={idx} className="text-xs bg-amber-50 dark:bg-amber-900/20 p-2 rounded border border-amber-200 dark:border-amber-800">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium text-slate-900 dark:text-[#ffffff]">
                                  ID: {getReadableEstimateId(item.estimate)}
                                </p>
                                {item.determinationMethod && (
                                  <p className="text-slate-600 dark:text-slate-400 mt-0.5">{item.determinationMethod}</p>
                                )}
                                {item.totalPrice > 0 && (
                                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                                    Total: ${item.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                )}
                                <p className="text-amber-700 dark:text-amber-400 mt-0.5 font-medium">Reason: {item.reason}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
    </>
  );
}










