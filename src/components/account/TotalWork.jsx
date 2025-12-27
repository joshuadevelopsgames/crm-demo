import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, ChevronDown, ChevronUp, Info, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

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
 * Uses contract-year allocation logic: revenue allocated by contract years, not calendar year coverage
 * @param {Object} estimate - Estimate object
 * @param {number} currentYear - Current year (e.g., 2024)
 * @returns {Object|null} - { appliesToCurrentYear: boolean, value: number, determinationMethod: string } or null if no valid date
 */
function getEstimateYearData(estimate, currentYear) {
  const contractStart = estimate.contract_start ? new Date(estimate.contract_start) : null;
  const contractEnd = estimate.contract_end ? new Date(estimate.contract_end) : null;
  const estimateDate = estimate.estimate_date ? new Date(estimate.estimate_date) : null;
  
  // Use total_price_with_tax consistently
  const totalPrice = parseFloat(estimate.total_price_with_tax) || 0;
  if (totalPrice === 0) return null;
  
  // Case 1: Both contract_start and contract_end exist
  // Use contract-year allocation logic
  if (contractStart && !isNaN(contractStart.getTime()) && contractEnd && !isNaN(contractEnd.getTime())) {
    const startYear = contractStart.getFullYear();
    
    // STEP 1: Calculate duration in months
    const durationMonths = calculateDurationMonths(contractStart, contractEnd);
    if (durationMonths <= 0) return null;
    
    // STEP 2: Determine number of contract years
    const yearsCount = getContractYears(durationMonths);
    
    // STEP 3: Determine which calendar years receive allocation
    // years_applied = [start_year, start_year+1, ..., start_year+(years_count-1)]
    const yearsApplied = [];
    for (let i = 0; i < yearsCount; i++) {
      yearsApplied.push(startYear + i);
    }
    
    // Check if current year is in years_applied
    const appliesToCurrentYear = yearsApplied.includes(currentYear);
    
    // STEP 4: Allocate revenue
    // annual_amount = total_price / years_count
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
  
  // Case 2: Only contract_start exists
  if (contractStart && !isNaN(contractStart.getTime())) {
    const startYear = contractStart.getFullYear();
    const appliesToCurrentYear = currentYear === startYear;
    
    return {
      appliesToCurrentYear,
      value: totalPrice,
      determinationMethod: `Contract Start: ${startYear}`
    };
  }
  
  // Case 3: No contract dates, use estimate_date
  if (estimateDate && !isNaN(estimateDate.getTime())) {
    const estimateYear = estimateDate.getFullYear();
    const appliesToCurrentYear = currentYear === estimateYear;
    
    return {
      appliesToCurrentYear,
      value: totalPrice,
      determinationMethod: `Estimate Date: ${estimateYear}`
    };
  }
  
  // No valid date found
  return null;
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

export default function TotalWork({ estimates = [] }) {
  const currentYear = new Date().getFullYear();
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
  
  // Calculate totals
  const totalEstimated = useMemo(() => {
    return estimatedBreakdown.included.reduce((sum, item) => sum + item.value, 0);
  }, [estimatedBreakdown]);
  
  const totalSold = useMemo(() => {
    return soldBreakdown.included.reduce((sum, item) => sum + item.value, 0);
  }, [soldBreakdown]);
  
  // Calculate sold percentage
  const soldPercentage = totalEstimated > 0 
    ? Math.round((totalSold / totalEstimated) * 100) 
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            Total Work
          </CardTitle>
          <TrendingUp className="w-5 h-5 text-slate-400" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-slate-600">ESTIMATED</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
              ${totalEstimated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {estimatedBreakdown.included.length} estimate{estimatedBreakdown.included.length !== 1 ? 's' : ''} included
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600">SOLD</p>
            <p className="text-2xl font-semibold text-emerald-600 mt-1">
              ${totalSold.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {totalEstimated > 0 && (
                <span className="text-base ml-2">({soldPercentage}%)</span>
              )}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {soldBreakdown.included.length} won estimate{soldBreakdown.included.length !== 1 ? 's' : ''} included
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
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">ESTIMATED Breakdown</h4>
                <div className="space-y-2">
                  {estimatedBreakdown.included.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-slate-700 mb-1">Included ({estimatedBreakdown.included.length}):</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {estimatedBreakdown.included.map((item, idx) => (
                          <div key={idx} className="text-xs bg-slate-50 p-2 rounded border border-slate-200">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium text-slate-900 dark:text-white">
                                  ID: {getReadableEstimateId(item.estimate)}
                                </p>
                                <p className="text-slate-600 mt-0.5">{item.determinationMethod}</p>
                                <p className="text-slate-500 mt-0.5">
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
                    <p className="text-xs text-slate-500">No estimates included</p>
                  )}
                  
                  {estimatedBreakdown.excluded.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-700 mb-1">Excluded ({estimatedBreakdown.excluded.length}):</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {estimatedBreakdown.excluded.map((item, idx) => (
                          <div key={idx} className="text-xs bg-amber-50 p-2 rounded border border-amber-200">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium text-slate-900 dark:text-white">
                                  ID: {getReadableEstimateId(item.estimate)}
                                </p>
                                {item.determinationMethod && (
                                  <p className="text-slate-600 mt-0.5">{item.determinationMethod}</p>
                                )}
                                {item.totalPrice > 0 && (
                                  <p className="text-slate-500 mt-0.5">
                                    Total: ${item.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                )}
                                <p className="text-amber-700 mt-0.5 font-medium">Reason: {item.reason}</p>
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
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">SOLD Breakdown (Won Estimates Only)</h4>
                <div className="space-y-2">
                  {soldBreakdown.included.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-slate-700 mb-1">Included ({soldBreakdown.included.length}):</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {soldBreakdown.included.map((item, idx) => (
                          <div key={idx} className="text-xs bg-emerald-50 p-2 rounded border border-emerald-200">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium text-slate-900 dark:text-white">
                                  ID: {getReadableEstimateId(item.estimate)}
                                </p>
                                <p className="text-slate-600 mt-0.5">{item.determinationMethod}</p>
                                <p className="text-slate-500 mt-0.5">
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
                      <p className="text-xs font-medium text-slate-700 mb-1">Excluded ({soldBreakdown.excluded.length}):</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {soldBreakdown.excluded.map((item, idx) => (
                          <div key={idx} className="text-xs bg-amber-50 p-2 rounded border border-amber-200">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium text-slate-900 dark:text-white">
                                  ID: {getReadableEstimateId(item.estimate)}
                                </p>
                                {item.determinationMethod && (
                                  <p className="text-slate-600 mt-0.5">{item.determinationMethod}</p>
                                )}
                                {item.totalPrice > 0 && (
                                  <p className="text-slate-500 mt-0.5">
                                    Total: ${item.totalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                )}
                                <p className="text-amber-700 mt-0.5 font-medium">Reason: {item.reason}</p>
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
  );
}










