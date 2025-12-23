import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, ChevronDown, ChevronUp, Info, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Get the year an estimate applies to and its value for the current year
 * For multi-year contracts, assign the full amount to the start year
 * @param {Object} estimate - Estimate object
 * @param {number} currentYear - Current year (e.g., 2024)
 * @returns {Object|null} - { appliesToCurrentYear: boolean, value: number, determinationMethod: string } or null if no valid date
 */
function getEstimateYearData(estimate, currentYear) {
  const contractStart = estimate.contract_start ? new Date(estimate.contract_start) : null;
  const contractEnd = estimate.contract_end ? new Date(estimate.contract_end) : null;
  const estimateDate = estimate.estimate_date ? new Date(estimate.estimate_date) : null;
  
  const totalPrice = parseFloat(estimate.total_price_with_tax) || parseFloat(estimate.total_price) || 0;
  if (totalPrice === 0) return null;
  
  // Case 1: Both contract_start and contract_end exist
  // Assign full amount to the start year (e.g., Oct 1, 2024 to Sept 30, 2025 = 2024)
  if (contractStart && !isNaN(contractStart.getTime()) && contractEnd && !isNaN(contractEnd.getTime())) {
    const startYear = contractStart.getFullYear();
    const endYear = contractEnd.getFullYear();
    const numberOfYears = endYear - startYear + 1;
    
    if (numberOfYears <= 0) return null;
    
    // Full amount assigned to start year (not annualized)
    const appliesToCurrentYear = currentYear === startYear;
    const determinationMethod = numberOfYears > 1 
      ? `Contract: ${startYear}-${endYear} (${numberOfYears} years, full amount to ${startYear})`
      : `Contract Start: ${startYear}`;
    
    return {
      appliesToCurrentYear,
      value: totalPrice, // Full amount, not annualized
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
      const totalPrice = parseFloat(est.total_price_with_tax) || parseFloat(est.total_price) || 0;
      
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
        const totalPrice = parseFloat(est.total_price_with_tax) || parseFloat(est.total_price) || 0;
        
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
            <p className="text-2xl font-bold text-slate-900 mt-1">
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
              className="w-full justify-between text-xs text-slate-600 hover:text-slate-900"
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
                <h4 className="text-sm font-semibold text-slate-900 mb-2">ESTIMATED Breakdown</h4>
                <div className="space-y-2">
                  {estimatedBreakdown.included.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-slate-700 mb-1">Included ({estimatedBreakdown.included.length}):</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {estimatedBreakdown.included.map((item, idx) => (
                          <div key={idx} className="text-xs bg-slate-50 p-2 rounded border border-slate-200">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium text-slate-900">
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
                                <p className="font-medium text-slate-900">
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
                <h4 className="text-sm font-semibold text-slate-900 mb-2">SOLD Breakdown (Won Estimates Only)</h4>
                <div className="space-y-2">
                  {soldBreakdown.included.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-slate-700 mb-1">Included ({soldBreakdown.included.length}):</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {soldBreakdown.included.map((item, idx) => (
                          <div key={idx} className="text-xs bg-emerald-50 p-2 rounded border border-emerald-200">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium text-slate-900">
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
                                <p className="font-medium text-slate-900">
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










